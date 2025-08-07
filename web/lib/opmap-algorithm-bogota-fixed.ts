// Algoritmo OpMap con lógica especial para Bogotá y uso de hospital_kam_distances
// IMPORTANTE: travel_time en hospital_kam_distances está en SEGUNDOS

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface KAM {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2: boolean
  max_travel_time: number  // En MINUTOS (desde configuración)
  priority: number
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

interface Assignment {
  kam_id: string
  hospital_id: string
  travel_time: number  // En SEGUNDOS (para consistencia con DB)
  assignment_type: 'base_territory' | 'competitive'
  is_base_territory: boolean
}

export class BogotaOpMapAlgorithm {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private excludedDepartments: string[] = []
  private travelTimeCache: Map<string, number> = new Map()
  
  // Estadísticas
  private cacheHits = 0
  private cacheMisses = 0
  private routesNotFound = 0

  async loadData() {
    console.log('🔄 Cargando datos...')
    
    // Cargar KAMs activos
    const { data: kamsData } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    this.kams = (kamsData || []).map(kam => ({
      id: kam.id,
      name: kam.name,
      area_id: kam.area_id,
      lat: kam.lat,
      lng: kam.lng,
      enable_level2: kam.enable_level2 !== false,
      max_travel_time: kam.max_travel_time || 240,  // Minutos
      priority: kam.priority || 1
    }))
    
    console.log(`✅ ${this.kams.length} KAMs cargados`)
    
    // Cargar hospitales activos
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    this.hospitals = hospitalsData || []
    console.log(`✅ ${this.hospitals.length} hospitales cargados`)
    
    // Cargar matriz de adyacencia
    const { data: adjacencyData } = await supabase
      .from('department_adjacency')
      .select('*')
    
    if (adjacencyData) {
      adjacencyData.forEach(adj => {
        if (!this.adjacencyMatrix[adj.department_code]) {
          this.adjacencyMatrix[adj.department_code] = []
        }
        this.adjacencyMatrix[adj.department_code].push(adj.adjacent_department_code)
      })
    }
    
    console.log(`✅ Matriz de adyacencia cargada`)
    
    // Departamentos excluidos (hardcoded por ahora)
    this.excludedDepartments = ['27', '97', '99', '88', '95', '94', '91']
  }

  private async assignBaseTerritory(): Promise<Assignment[]> {
    console.log('\n📍 FASE 1: Asignando territorios base...')
    const baseAssignments: Assignment[] = []
    
    for (const kam of this.kams) {
      const baseHospitals = this.hospitals.filter(h => {
        // Localidad para KAMs de Bogotá
        if (kam.area_id.startsWith('11001') && kam.area_id.length > 5) {
          return h.locality_id === kam.area_id
        }
        // Municipio para el resto
        return h.municipality_id === kam.area_id
      })
      
      for (const hospital of baseHospitals) {
        baseAssignments.push({
          kam_id: kam.id,
          hospital_id: hospital.id,
          travel_time: 0,  // Territorio base = 0 segundos
          assignment_type: 'base_territory',
          is_base_territory: true
        })
      }
      
      console.log(`  ✓ ${kam.name}: ${baseHospitals.length} hospitales en territorio base`)
    }
    
    return baseAssignments
  }

  private async getTravelTime(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    kamId?: string,
    hospitalId?: string
  ): Promise<number | null> {
    // Crear clave de caché
    const cacheKey = `${originLat},${originLng}-${destLat},${destLng}`
    
    // Verificar caché local primero
    if (this.travelTimeCache.has(cacheKey)) {
      this.cacheHits++
      return this.travelTimeCache.get(cacheKey)!
    }
    
    this.cacheMisses++
    console.log(`🔍 Cache miss para ruta: ${cacheKey}`)
    
    // Si tenemos IDs, buscar primero en hospital_kam_distances
    if (kamId && hospitalId) {
      const { data: distance, error } = await supabase
        .from('hospital_kam_distances')
        .select('travel_time')
        .eq('kam_id', kamId)
        .eq('hospital_id', hospitalId)
        .single()
      
      if (distance && distance.travel_time !== null) {
        // travel_time está en SEGUNDOS en la DB
        const timeInSeconds = distance.travel_time
        this.travelTimeCache.set(cacheKey, timeInSeconds)
        return timeInSeconds
      }
    }
    
    // No hay ruta en caché - retornar un valor muy alto para indicar que no es alcanzable
    console.log(`📍 Ruta no encontrada en caché: ${kamId} → ${hospitalId}`)
    this.routesNotFound++
    return 999999 // Retornar un valor muy alto para indicar ruta no calculada
  }

  private isBogotaKam(kam: KAM): boolean {
    // Un KAM es de Bogotá si su area_id es una localidad (empieza con 11001)
    return kam.area_id.startsWith('11001') && kam.area_id.length > 5
  }

  private isLevel2Adjacent(kamDept: string, hospitalDept: string): boolean {
    // Verificar adyacencia de nivel 2
    if (!this.adjacencyMatrix[kamDept]) return false
    
    // Nivel 1: departamentos adyacentes directos
    const level1Deps = this.adjacencyMatrix[kamDept]
    
    // Nivel 2: departamentos adyacentes a los adyacentes
    for (const dept of level1Deps) {
      if (this.adjacencyMatrix[dept]?.includes(hospitalDept)) {
        return true
      }
    }
    
    return false
  }

  private async getTravelTimeWithValidation(
    kam: KAM,
    hospital: Hospital
  ): Promise<number | null> {
    // Primero intentar obtener de caché, pasando los IDs para usar hospital_kam_distances
    let cachedTime = await this.getTravelTime(
      kam.lat, kam.lng,
      hospital.lat, hospital.lng,
      kam.id,
      hospital.id
    )
    
    if (cachedTime !== null && cachedTime < 999999) {
      return cachedTime  // Retornar tiempo en SEGUNDOS
    }
    
    // Si no está en caché, validar si DEBE calcularse
    const kamDept = kam.area_id.substring(0, 2)
    const hospitalDept = hospital.department_id
    
    // Verificar criterios de proximidad
    const isSameDepartment = kamDept === hospitalDept
    const isAdjacent = this.adjacencyMatrix[kamDept]?.includes(hospitalDept)
    const isLevel2 = kam.enable_level2 && this.isLevel2Adjacent(kamDept, hospitalDept)
    
    // Para KAMs de Bogotá
    if (this.isBogotaKam(kam)) {
      // Pueden buscar en Bogotá, Cundinamarca y departamentos adyacentes
      const canSearch = hospitalDept === '11' || // Bogotá
                       hospitalDept === '25' || // Cundinamarca
                       this.adjacencyMatrix['25']?.includes(hospitalDept) || // Adyacente a Cundinamarca
                       (kam.enable_level2 && this.isLevel2Adjacent('25', hospitalDept)) // Nivel 2 desde Cundinamarca
      
      if (!canSearch) {
        return null // No calcular si está fuera del área de búsqueda
      }
    } else {
      // KAMs fuera de Bogotá: usar lógica normal
      if (!isSameDepartment && !isAdjacent && !isLevel2) {
        return null // No calcular si está fuera del área de búsqueda
      }
    }
    
    // Si llegamos aquí, la ruta debería existir pero no está en caché
    // Retornar null para indicar que no hay datos
    return null
  }

  private async assignCompetitiveHospitalsInBogota(
    baseAssignments: Assignment[]
  ): Promise<Assignment[]> {
    console.log('\n🏙️ FASE 2: Asignación competitiva en Bogotá...')
    
    const assignedHospitalIds = new Set(baseAssignments.map(a => a.hospital_id))
    const bogotaKams = this.kams.filter(kam => this.isBogotaKam(kam))
    const competitiveAssignments: Assignment[] = []
    
    // Hospitales en localidades de Bogotá sin asignar
    const bogotaHospitals = this.hospitals.filter(h => 
      !assignedHospitalIds.has(h.id) &&
      h.locality_id && 
      h.locality_id.startsWith('11001')
    )
    
    console.log(`  Hospitales en Bogotá sin asignar: ${bogotaHospitals.length}`)
    console.log(`  KAMs de Bogotá compitiendo: ${bogotaKams.length}`)
    
    // Para cada hospital, encontrar el KAM más cercano
    for (const hospital of bogotaHospitals) {
      let bestKam: KAM | null = null
      let bestTime = Infinity
      
      for (const kam of bogotaKams) {
        const time = await this.getTravelTimeWithValidation(kam, hospital)
        
        if (time !== null && time < bestTime) {
          const timeInMinutes = time / 60  // Convertir segundos a minutos para comparar con límite
          if (timeInMinutes <= kam.max_travel_time) {
            bestTime = time
            bestKam = kam
          }
        }
      }
      
      if (bestKam && bestTime < 999999) {
        competitiveAssignments.push({
          kam_id: bestKam.id,
          hospital_id: hospital.id,
          travel_time: bestTime,  // Guardar en SEGUNDOS
          assignment_type: 'competitive',
          is_base_territory: false
        })
        assignedHospitalIds.add(hospital.id)
        console.log(`  ✓ ${hospital.name} → ${bestKam.name} (${Math.round(bestTime/60)} min)`)
      }
    }
    
    return competitiveAssignments
  }

  private async resolveSharedLocalities(
    assignments: Assignment[]
  ): Promise<Assignment[]> {
    console.log('\n🏘️ FASE 3: Resolviendo localidades compartidas por mayoría...')
    
    // Agrupar asignaciones por localidad
    const localityAssignments: Record<string, Assignment[]> = {}
    
    for (const assignment of assignments) {
      const hospital = this.hospitals.find(h => h.id === assignment.hospital_id)
      if (hospital?.locality_id) {
        if (!localityAssignments[hospital.locality_id]) {
          localityAssignments[hospital.locality_id] = []
        }
        localityAssignments[hospital.locality_id].push(assignment)
      }
    }
    
    // Para cada localidad con múltiples KAMs
    const resolvedAssignments = [...assignments]
    
    for (const [localityId, localAssignments] of Object.entries(localityAssignments)) {
      // Contar asignaciones por KAM
      const kamCounts: Record<string, number> = {}
      localAssignments.forEach(a => {
        kamCounts[a.kam_id] = (kamCounts[a.kam_id] || 0) + 1
      })
      
      // Si hay múltiples KAMs
      if (Object.keys(kamCounts).length > 1) {
        // Encontrar el KAM ganador
        const winner = Object.entries(kamCounts)
          .sort(([,a], [,b]) => b - a)[0][0]
        
        const winnerKam = this.kams.find(k => k.id === winner)
        console.log(`  Localidad ${localityId}: ${winnerKam?.name} gana con ${kamCounts[winner]} hospitales`)
        
        // Reasignar todos los hospitales de la localidad al ganador
        for (let i = 0; i < resolvedAssignments.length; i++) {
          const assignment = resolvedAssignments[i]
          const hospital = this.hospitals.find(h => h.id === assignment.hospital_id)
          
          if (hospital?.locality_id === localityId && assignment.kam_id !== winner) {
            // Obtener tiempo de viaje del ganador a este hospital
            const time = await this.getTravelTimeWithValidation(
              winnerKam!,
              hospital
            )
            
            resolvedAssignments[i] = {
              ...assignment,
              kam_id: winner,
              travel_time: time || 0  // En SEGUNDOS
            }
          }
        }
      }
    }
    
    return resolvedAssignments
  }

  private async assignRemainingHospitals(
    currentAssignments: Assignment[]
  ): Promise<Assignment[]> {
    console.log('\n🏥 FASE 4: Asignando hospitales restantes...')
    
    const assignedHospitalIds = new Set(currentAssignments.map(a => a.hospital_id))
    const unassignedHospitals = this.hospitals.filter(h => !assignedHospitalIds.has(h.id))
    const newAssignments: Assignment[] = []
    
    console.log(`  Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // Filtrar hospitales en departamentos excluidos
    const validHospitals = unassignedHospitals.filter(h => 
      !this.excludedDepartments.includes(h.department_id)
    )
    
    console.log(`  Hospitales válidos para asignar: ${validHospitals.length}`)
    
    for (const hospital of validHospitals) {
      let bestKam: KAM | null = null
      let bestTime = Infinity
      
      // Para hospitales en Bogotá, solo KAMs de Bogotá pueden competir
      const eligibleKams = hospital.locality_id?.startsWith('11001')
        ? this.kams.filter(kam => this.isBogotaKam(kam))
        : this.kams
      
      for (const kam of eligibleKams) {
        const time = await this.getTravelTimeWithValidation(kam, hospital)
        
        if (time !== null && time < bestTime) {
          const timeInMinutes = time / 60  // Convertir segundos a minutos para comparar con límite
          if (timeInMinutes <= kam.max_travel_time) {
            bestTime = time
            bestKam = kam
          }
        }
      }
      
      if (bestKam && bestTime < 999999) {
        newAssignments.push({
          kam_id: bestKam.id,
          hospital_id: hospital.id,
          travel_time: bestTime,  // En SEGUNDOS
          assignment_type: 'competitive',
          is_base_territory: false
        })
        console.log(`  ✓ ${hospital.name} → ${bestKam.name} (${Math.round(bestTime/60)} min)`)
      } else {
        console.log(`  ❌ ${hospital.name} - Sin KAM disponible`)
      }
    }
    
    return newAssignments
  }

  async calculateAssignments(): Promise<Assignment[]> {
    console.log('\n🚀 INICIANDO ALGORITMO OPMAP BOGOTÁ')
    console.log('=' + '='.repeat(59))
    
    // 1. Asignar territorios base
    const baseAssignments = await this.assignBaseTerritory()
    
    // 2. Asignar hospitales en Bogotá competitivamente
    const bogotaAssignments = await this.assignCompetitiveHospitalsInBogota(baseAssignments)
    
    // 3. Combinar asignaciones
    let allAssignments = [...baseAssignments, ...bogotaAssignments]
    
    // 4. Resolver localidades compartidas por mayoría
    allAssignments = await this.resolveSharedLocalities(allAssignments)
    
    // 5. Asignar hospitales restantes
    const remainingAssignments = await this.assignRemainingHospitals(allAssignments)
    allAssignments = [...allAssignments, ...remainingAssignments]
    
    // Estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES:')
    console.log('=' + '='.repeat(59))
    console.log(`Total hospitales: ${this.hospitals.length}`)
    console.log(`Total asignaciones: ${allAssignments.length}`)
    console.log(`Hospitales sin asignar: ${this.hospitals.length - allAssignments.length}`)
    console.log(`Cache hits: ${this.cacheHits}`)
    console.log(`Cache misses: ${this.cacheMisses}`)
    console.log(`Rutas no encontradas: ${this.routesNotFound}`)
    
    // Resumen por KAM
    const kamSummary: Record<string, number> = {}
    allAssignments.forEach(a => {
      kamSummary[a.kam_id] = (kamSummary[a.kam_id] || 0) + 1
    })
    
    console.log('\n📈 Asignaciones por KAM:')
    for (const [kamId, count] of Object.entries(kamSummary)) {
      const kam = this.kams.find(k => k.id === kamId)
      console.log(`  ${kam?.name}: ${count} hospitales`)
    }
    
    return allAssignments
  }

  async saveAssignments(assignments: Assignment[]) {
    console.log('\n💾 Guardando asignaciones...')
    
    // Limpiar asignaciones anteriores
    await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insertar nuevas asignaciones
    const { error } = await supabase.from('assignments').insert(assignments)
    
    if (error) {
      console.error('❌ Error guardando asignaciones:', error)
      throw error
    }
    
    console.log(`✅ ${assignments.length} asignaciones guardadas`)
  }
}

export async function runBogotaAlgorithm() {
  const algorithm = new BogotaOpMapAlgorithm()
  
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