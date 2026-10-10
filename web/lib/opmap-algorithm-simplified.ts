// Algoritmo OpMap Simplificado - Usa hospital_kam_distances como fuente de verdad
// IMPORTANTE: travel_time en hospital_kam_distances está en SEGUNDOS
// Solo servidor: usa el cliente service_role (lib/supabase-admin.ts), obtenido de forma perezosa
// dentro de cada método para que importar este módulo no falle durante el build.

import { getSupabaseAdmin } from './supabase-admin'

// ---------------------------------------------------------------------------
// Reglas de elegibilidad KAM -> IPS (funciones puras exportadas).
// Fuente única: la clase SimplifiedOpMapAlgorithm y app/api/_lib/kam-eligibility.ts delegan aquí.
// ---------------------------------------------------------------------------

export type AdjacencyMatrix = Record<string, string[]>

// Forma mínima de KAM que necesitan las reglas de elegibilidad
export interface EligibilityKamShape {
  area_id: string
  enable_level2: boolean | null
}

// Forma mínima de IPS que necesitan las reglas de elegibilidad
export interface EligibilityHospitalShape {
  department_id: string
  municipality_id: string
  locality_id?: string | null
}

// Código DANE de Bogotá D.C. como municipio. Un KAM con area_id === '11001' es una
// configuración inválida: los KAMs de Bogotá deben tener un código de localidad (11001XX).
// Si se aceptara, se quedaría como "territorio base" con TODAS las IPS de Bogotá.
export const BOGOTA_MUNICIPALITY_ID = '11001'

/**
 * true si el area_id del KAM es válido para la asignación territorial.
 */
export function hasValidKamArea(kam: { area_id: string | null | undefined }): boolean {
  return typeof kam.area_id === 'string' && kam.area_id.length > 0 && kam.area_id !== BOGOTA_MUNICIPALITY_ID
}

export function isBogotaKam(kam: EligibilityKamShape): boolean {
  return kam.area_id.startsWith(BOGOTA_MUNICIPALITY_ID) && kam.area_id.length > 5
}

export function isBogotaHospital(hospital: EligibilityHospitalShape): boolean {
  return hospital.locality_id?.startsWith(BOGOTA_MUNICIPALITY_ID) || false
}

export function isBaseTerritory(kam: EligibilityKamShape, hospital: EligibilityHospitalShape): boolean {
  // Para localidades de Bogotá
  if (isBogotaKam(kam)) {
    return hospital.locality_id === kam.area_id
  }
  // Para municipios regulares
  return hospital.municipality_id === kam.area_id
}

export function canKamCompeteForHospital(
  kam: EligibilityKamShape,
  hospital: EligibilityHospitalShape,
  adjacency: AdjacencyMatrix
): boolean {
  // Si es territorio base, siempre puede
  if (isBaseTerritory(kam, hospital)) return true

  const kamDept = kam.area_id.substring(0, 2)
  const hospitalDept = hospital.department_id

  // Mismo departamento
  if (kamDept === hospitalDept) return true

  // Departamento adyacente (Nivel 1)
  if (adjacency[kamDept]?.includes(hospitalDept)) return true

  // Nivel 2 (si está habilitado)
  if (kam.enable_level2) {
    for (const dept of adjacency[kamDept] || []) {
      if (adjacency[dept]?.includes(hospitalDept)) return true
    }
  }

  // Regla especial para Bogotá
  if (isBogotaKam(kam)) {
    // KAMs de Bogotá pueden competir en Bogotá y Cundinamarca
    if (hospitalDept === '11' || hospitalDept === '25') return true
    // Y departamentos adyacentes a Cundinamarca
    if (adjacency['25']?.includes(hospitalDept)) return true
    // Y nivel 2 desde Cundinamarca si está habilitado
    if (kam.enable_level2) {
      for (const dept of adjacency['25'] || []) {
        if (adjacency[dept]?.includes(hospitalDept)) return true
      }
    }
  }

  return false
}

/**
 * KAMs que pueden competir por una IPS: en Bogotá solo KAMs de localidad; fuera, cualquiera
 * que cumpla las restricciones geográficas (mismo depto, N1, N2, regla Bogotá).
 * Los KAMs con area_id inválido ('11001') nunca son elegibles.
 */
export function eligibleKamsForHospital<T extends EligibilityKamShape>(
  kams: T[],
  hospital: EligibilityHospitalShape,
  adjacency: AdjacencyMatrix
): T[] {
  const valid = kams.filter(hasValidKamArea)
  const pool = isBogotaHospital(hospital) ? valid.filter(isBogotaKam) : valid
  return pool.filter(kam => canKamCompeteForHospital(kam, hospital, adjacency))
}

interface KAM {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2: boolean
  max_travel_time: number  // En MINUTOS
  priority: number
  active: boolean
  participates_in_assignment?: boolean  // Si participa en asignación territorial
}

interface Hospital {
  id: string
  code: string
  name: string
  department_id: string
  municipality_id: string
  locality_id?: string
  lat: number
  lng: number
  beds: number
  active: boolean
}

export interface Assignment {
  kam_id: string
  hospital_id: string
  travel_time: number | null  // En SEGUNDOS (null si no hay tiempo calculado, p.ej. territorio forzado)
  assignment_type: 'forced' | 'base_territory' | 'competitive' | 'majority_rule'
  is_base_territory: boolean
}

interface DistanceRecord {
  hospital_id: string
  kam_id: string
  travel_time: number  // En SEGUNDOS
}

interface ForcedAssignment {
  territory_id: string
  territory_type: 'municipality' | 'locality'
  territory_name: string
  kam_id: string
  reason?: string
  active: boolean
}

export class SimplifiedOpMapAlgorithm {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private excludedDepartments: string[] = []
  private distances: DistanceRecord[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private forcedAssignments: ForcedAssignment[] = []
  
  async loadData() {
    console.log('🔄 Cargando datos...')
    const supabase = getSupabaseAdmin()

    // 1. Cargar departamentos excluidos
    const { data: excludedDepts, error: excludedError } = await supabase
      .from('departments')
      .select('code')
      .eq('excluded', true)
    if (excludedError) {
      throw new Error(`Error cargando departments: ${excludedError.message}`)
    }

    this.excludedDepartments = (excludedDepts || []).map(d => d.code)
    console.log(`✅ ${this.excludedDepartments.length} departamentos excluidos`)

    // 2. Cargar KAMs activos que participan en asignación territorial (orden determinista)
    const { data: kamsData, error: kamsError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
      .eq('participates_in_assignment', true)
      .order('name')
    if (kamsError) {
      throw new Error(`Error cargando kams: ${kamsError.message}`)
    }

    // area_id === '11001' (Bogotá como municipio) es una configuración inválida: se excluye
    this.kams = ((kamsData || []) as KAM[]).filter(kam => {
      if (hasValidKamArea(kam)) return true
      console.warn(
        `⚠️ KAM "${kam.name}" (${kam.id}) excluido de la asignación: area_id "${kam.area_id}" no es válido. ` +
        `Los KAMs de Bogotá deben configurarse con un código de localidad (11001XX), no con ${BOGOTA_MUNICIPALITY_ID}.`
      )
      return false
    })
    console.log(`✅ ${this.kams.length} KAMs activos con territorio`)

    // 3. Cargar hospitales activos (NO filtrar por departamentos aquí)
    const { data: hospitalsData, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    if (hospitalsError) {
      throw new Error(`Error cargando hospitals: ${hospitalsError.message}`)
    }

    this.hospitals = hospitalsData || []
    console.log(`✅ ${this.hospitals.length} hospitales activos`)

    // 4. Cargar matriz de adyacencia
    const { data: adjacencyData, error: adjacencyError } = await supabase
      .from('department_adjacency')
      .select('*')
    if (adjacencyError) {
      throw new Error(`Error cargando department_adjacency: ${adjacencyError.message}`)
    }

    this.adjacencyMatrix = {}
    for (const adj of adjacencyData || []) {
      if (!this.adjacencyMatrix[adj.department_code]) {
        this.adjacencyMatrix[adj.department_code] = []
      }
      this.adjacencyMatrix[adj.department_code].push(adj.adjacent_department_code)
    }
    console.log(`✅ Matriz de adyacencia cargada`)

    // 5. Cargar TODAS las distancias precalculadas
    console.log('📊 Cargando distancias precalculadas...')
    this.distances = []

    // Cargar TODAS las distancias sin filtros, paginando
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: distBatch, error } = await supabase
        .from('hospital_kam_distances')
        .select('hospital_id, kam_id, travel_time')
        .range(offset, offset + batchSize - 1)

      // Un error a mitad de la paginación dejaría distancias incompletas: abortar
      if (error) {
        throw new Error(`Error cargando hospital_kam_distances: ${error.message}`)
      }

      if (distBatch && distBatch.length > 0) {
        this.distances.push(...distBatch)
        console.log(`  Cargadas ${this.distances.length} distancias...`)
        offset += batchSize

        if (distBatch.length < batchSize) {
          break // Última página
        }
      } else {
        break
      }
    }

    console.log(`✅ ${this.distances.length} distancias cargadas`)

    // 6. Cargar asignaciones forzadas
    console.log('🔒 Cargando asignaciones forzadas...')
    const { data: forcedData, error: forcedError } = await supabase
      .from('forced_assignments')
      .select('*')
      .eq('active', true)
    if (forcedError) {
      throw new Error(`Error cargando forced_assignments: ${forcedError.message}`)
    }

    this.forcedAssignments = forcedData || []
    console.log(`✅ ${this.forcedAssignments.length} asignaciones forzadas activas`)
  }

  // Delegan en las funciones puras exportadas (fuente única de las reglas de elegibilidad)
  canKamCompeteForHospital(kam: KAM, hospital: Hospital): boolean {
    return canKamCompeteForHospital(kam, hospital, this.adjacencyMatrix)
  }

  isBaseTerritory(kam: KAM, hospital: Hospital): boolean {
    return isBaseTerritory(kam, hospital)
  }

  private getDistance(hospitalId: string, kamId: string): number | null {
    const distance = this.distances.find(
      d => d.hospital_id === hospitalId && d.kam_id === kamId
    )
    return distance ? distance.travel_time : null
  }

  private isForcedTerritory(hospital: Hospital): ForcedAssignment | null {
    // Verificar si el hospital está en un territorio con asignación forzada
    const territoryId = hospital.locality_id || hospital.municipality_id
    return this.forcedAssignments.find(fa => fa.territory_id === territoryId) || null
  }

  async calculateAssignments(): Promise<Assignment[]> {
    console.log('\n🚀 INICIANDO ALGORITMO SIMPLIFICADO')
    console.log('=' + '='.repeat(59))
    const startTime = Date.now()
    
    const assignments: Assignment[] = []
    const assignedHospitals = new Set<string>()
    
    // FASE 0: Aplicar asignaciones forzadas
    console.log('\n🔒 FASE 0: Aplicando asignaciones forzadas...')
    const forcedTerritories = new Set<string>()
    
    const warnedForcedTerritories = new Set<string>()

    for (const hospital of this.hospitals) {
      const forcedAssignment = this.isForcedTerritory(hospital)
      if (!forcedAssignment) continue

      // this.kams solo contiene KAMs activos que participan en la asignación (y con area_id válido)
      const kam = this.kams.find(k => k.id === forcedAssignment.kam_id)
      if (!kam) {
        if (!warnedForcedTerritories.has(forcedAssignment.territory_id)) {
          warnedForcedTerritories.add(forcedAssignment.territory_id)
          console.warn(
            `⚠️ Asignación forzada ignorada: ${forcedAssignment.territory_name} (${forcedAssignment.territory_id}) ` +
            `apunta al KAM ${forcedAssignment.kam_id}, que está inactivo, no participa en la asignación ` +
            `o tiene un area_id inválido. El territorio entra en la asignación normal.`
          )
        }
        continue
      }

      // Tiempo de viaje si existe; null si no está calculado (no inventar 0 segundos)
      const travelTime = this.getDistance(hospital.id, kam.id) ?? null

      assignments.push({
        kam_id: kam.id,
        hospital_id: hospital.id,
        travel_time: travelTime,
        assignment_type: 'forced',
        is_base_territory: false
      })
      assignedHospitals.add(hospital.id)

      if (!forcedTerritories.has(forcedAssignment.territory_id)) {
        forcedTerritories.add(forcedAssignment.territory_id)
        console.log(`  ✓ ${forcedAssignment.territory_name} → ${kam.name} (FORZADO: ${forcedAssignment.reason || 'Sin razón'})`)
      }
    }

    console.log(`  Total territorios forzados: ${forcedTerritories.size}`)
    console.log(`  Total hospitales en territorios forzados: ${assignments.length}`)
    
    // FASE 1: Asignar territorios base (excepto los ya forzados)
    console.log('\n📍 FASE 1: Asignando territorios base...')
    
    for (const kam of this.kams) {
      const baseHospitals = this.hospitals.filter(h => 
        this.isBaseTerritory(kam, h) && !assignedHospitals.has(h.id)
      )
      
      for (const hospital of baseHospitals) {
        assignments.push({
          kam_id: kam.id,
          hospital_id: hospital.id,
          travel_time: 0,  // Territorio base = 0 segundos
          assignment_type: 'base_territory',
          is_base_territory: true
        })
        assignedHospitals.add(hospital.id)
      }
      
      if (baseHospitals.length > 0) {
        console.log(`  ✓ ${kam.name}: ${baseHospitals.length} hospitales en territorio base`)
      }
    }
    
    // FASE 2: Asignación competitiva
    console.log('\n🏥 FASE 2: Asignación competitiva...')
    console.log(`  Tiempo transcurrido: ${(Date.now() - startTime) / 1000}s`)
    
    // Filtrar hospitales sin asignar y que NO estén en departamentos excluidos
    const unassignedHospitals = this.hospitals.filter(h => 
      !assignedHospitals.has(h.id) && 
      !this.excludedDepartments.includes(h.department_id)
    )
    console.log(`  Hospitales por asignar: ${unassignedHospitals.length}`)
    console.log(`  (Excluidos ${this.hospitals.filter(h => this.excludedDepartments.includes(h.department_id)).length} hospitales en departamentos remotos)`)
    
    let processedCount = 0
    for (const hospital of unassignedHospitals) {
      processedCount++
      if (processedCount % 50 === 0) {
        console.log(`  Procesados ${processedCount}/${unassignedHospitals.length} hospitales...`)
      }
      let bestKam: KAM | null = null
      let bestTime = Infinity
      
      // Solo KAMs de Bogotá pueden competir por hospitales en Bogotá
      // (incluye las restricciones geográficas: mismo depto, N1, N2 y regla Bogotá)
      const eligibleKams = eligibleKamsForHospital(this.kams, hospital, this.adjacencyMatrix)

      for (const kam of eligibleKams) {
        // Obtener tiempo de viaje desde la tabla
        const travelTime = this.getDistance(hospital.id, kam.id)
        
        if (travelTime !== null) {
          const timeInMinutes = travelTime / 60
          
          // Verificar límite de tiempo del KAM
          if (timeInMinutes <= kam.max_travel_time) {
            // En caso de empate, usar prioridad
            if (travelTime < bestTime || 
                (travelTime === bestTime && kam.priority > (bestKam?.priority || 0))) {
              bestTime = travelTime
              bestKam = kam
            }
          }
        }
      }
      
      if (bestKam && bestTime < Infinity) {
        assignments.push({
          kam_id: bestKam.id,
          hospital_id: hospital.id,
          travel_time: bestTime,  // En SEGUNDOS
          assignment_type: 'competitive',
          is_base_territory: false
        })
        assignedHospitals.add(hospital.id)
        // Solo mostrar log para algunos hospitales para no saturar
        if (processedCount <= 5 || processedCount % 50 === 0) {
          console.log(`  ✓ ${hospital.name} → ${bestKam.name} (${Math.round(bestTime/60)} min)`)
        }
      } else {
        console.log(`  ❌ ${hospital.name} - Sin KAM disponible`)
      }
    }
    
    // FASE 3: Regla de mayoría para zonas compartidas (NO aplicar a territorios forzados)
    console.log('\n🏘️ FASE 3: Aplicando regla de mayoría por CAMAS en localidades...')
    console.log(`  Tiempo transcurrido: ${(Date.now() - startTime) / 1000}s`)
    
    // Cambio: usar número de CAMAS en lugar de número de hospitales
    const localityBeds: Record<string, Record<string, number>> = {}
    
    // Contar CAMAS por localidad y KAM
    for (const assignment of assignments) {
      const hospital = this.hospitals.find(h => h.id === assignment.hospital_id)
      if (hospital?.locality_id && hospital.locality_id.startsWith('11001')) {
        if (!localityBeds[hospital.locality_id]) {
          localityBeds[hospital.locality_id] = {}
        }
        // Sumar CAMAS del hospital al KAM
        const beds = hospital.beds || 0
        localityBeds[hospital.locality_id][assignment.kam_id] = 
          (localityBeds[hospital.locality_id][assignment.kam_id] || 0) + beds
      }
    }
    
    // Aplicar regla de mayoría basada en CAMAS (excepto territorios forzados)
    for (const [localityId, kamBedCounts] of Object.entries(localityBeds)) {
      // Verificar si este territorio tiene asignación forzada
      const isForcedTerritory = this.forcedAssignments.some(fa => fa.territory_id === localityId)
      
      if (!isForcedTerritory && Object.keys(kamBedCounts).length > 1) {
        // Encontrar KAM con más CAMAS (no hospitales)
        const winner = Object.entries(kamBedCounts)
          .sort(([,a], [,b]) => b - a)[0][0]
        
        const winnerKam = this.kams.find(k => k.id === winner)
        const winnerBeds = kamBedCounts[winner]
        const totalBeds = Object.values(kamBedCounts).reduce((sum, beds) => sum + beds, 0)
        console.log(`  Localidad ${localityId}: ${winnerKam?.name} gana con ${winnerBeds} de ${totalBeds} camas`)
        
        // Reasignar todos los hospitales de la localidad al ganador
        for (let i = 0; i < assignments.length; i++) {
          const hospital = this.hospitals.find(h => h.id === assignments[i].hospital_id)
          if (hospital?.locality_id === localityId && assignments[i].kam_id !== winner) {
            const newTime = this.getDistance(hospital.id, winner)
            // Solo reasignar si existe el tiempo de viaje
            if (newTime !== null) {
              assignments[i] = {
                ...assignments[i],
                kam_id: winner,
                travel_time: newTime,
                assignment_type: 'majority_rule'
              }
            } else {
              console.log(`  ⚠️ No se pudo reasignar ${hospital.name} al ganador por falta de tiempo de viaje`)
              // Mantener la asignación original
            }
          }
        }
      }
    }
    
    // Estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES:')
    console.log('=' + '='.repeat(59))
    console.log(`⏱️ Tiempo total de cálculo: ${(Date.now() - startTime) / 1000}s`)
    console.log(`Total hospitales activos: ${this.hospitals.length}`)
    console.log(`Total asignaciones: ${assignments.length}`)
    console.log(`Hospitales sin asignar: ${this.hospitals.length - assignments.length}`)
    
    // Resumen por KAM
    const kamSummary: Record<string, number> = {}
    assignments.forEach(a => {
      kamSummary[a.kam_id] = (kamSummary[a.kam_id] || 0) + 1
    })
    
    console.log('\n📈 Asignaciones por KAM:')
    for (const [kamId, count] of Object.entries(kamSummary)) {
      const kam = this.kams.find(k => k.id === kamId)
      console.log(`  ${kam?.name}: ${count} hospitales`)
    }
    
    return assignments
  }
  
  async saveAssignments(assignments: Assignment[]) {
    console.log('\n💾 Guardando asignaciones...')
    const supabase = getSupabaseAdmin()
    
    // Limpiar asignaciones anteriores
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) {
      throw new Error(`Error limpiando assignments: ${deleteError.message}`)
    }
    
    // Insertar nuevas asignaciones en lotes
    const batchSize = 500
    for (let i = 0; i < assignments.length; i += batchSize) {
      const batch = assignments.slice(i, i + batchSize)
      const { error } = await supabase.from('assignments').insert(batch)
      
      if (error) {
        console.error(`❌ Error en lote ${i/batchSize + 1}:`, error)
        throw error
      }
    }
    
    console.log(`✅ ${assignments.length} asignaciones guardadas`)
  }
}

export async function runSimplifiedAlgorithm() {
  const algorithm = new SimplifiedOpMapAlgorithm()
  
  try {
    await algorithm.loadData()
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    return {
      success: true,
      assignments: assignments.length,
      message: `Algoritmo completado: ${assignments.length} asignaciones realizadas`
    }
  } catch (error) {
    console.error('Error ejecutando algoritmo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}