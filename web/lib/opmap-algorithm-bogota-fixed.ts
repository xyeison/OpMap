/**
 * OpMap Algorithm con lógica correcta para Bogotá
 * Respeta las localidades como territorios independientes
 */

import { supabase } from './supabase'

interface KAM {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2: boolean
  max_travel_time: number
  priority: number
}

interface Hospital {
  id: string
  code: string
  name: string
  department_id: string
  municipality_id: string
  locality_id: string | null
  lat: number
  lng: number
}

interface Assignment {
  kam_id: string
  hospital_id: string
  travel_time: number | null
  assignment_type: 'territory_base' | 'automatic' | 'manual'
}

export class OpMapAlgorithmBogotaFixed {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private travelTimeCache: Map<string, number> = new Map()
  private cacheHits = 0
  private cacheMisses = 0

  async initialize() {
    console.log('📦 Inicializando algoritmo OpMap (BOGOTÁ FIXED)...')
    
    // Cargar KAMs
    const { data: kamsData } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    this.kams = kamsData || []
    console.log(`✅ ${this.kams.length} KAMs activos cargados`)
    
    // Cargar Hospitales
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    this.hospitals = hospitalsData || []
    console.log(`🏥 ${this.hospitals.length} hospitales activos cargados`)

    // Cargar matriz de adyacencia
    const { data: adjacencyData } = await supabase
      .from('department_adjacency')
      .select('department_code, adjacent_department_code')
    
    adjacencyData?.forEach(row => {
      if (!this.adjacencyMatrix[row.department_code]) {
        this.adjacencyMatrix[row.department_code] = []
      }
      this.adjacencyMatrix[row.department_code].push(row.adjacent_department_code)
    })

    // Cargar caché de tiempos
    console.log('⏳ Cargando caché de tiempos de viaje...')
    const startCache = Date.now()
    
    let offset = 0
    const batchSize = 1000
    let totalLoaded = 0
    
    while (true) {
      const { data: cacheData, error } = await supabase
        .from('travel_time_cache')
        .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
        .range(offset, offset + batchSize - 1)
      
      if (error || !cacheData || cacheData.length === 0) break
      
      cacheData.forEach(item => {
        const key = this.getCacheKey(
          item.origin_lat, item.origin_lng,
          item.dest_lat, item.dest_lng
        )
        this.travelTimeCache.set(key, item.travel_time)
        totalLoaded++
      })
      
      offset += batchSize
      if (cacheData.length < batchSize) break
    }
    
    console.log(`✅ ${totalLoaded} rutas en caché cargadas en ${Date.now() - startCache}ms`)
  }

  private getCacheKey(originLat: number, originLng: number, destLat: number, destLng: number): string {
    return `${originLat.toFixed(6)},${originLng.toFixed(6)},${destLat.toFixed(6)},${destLng.toFixed(6)}`
  }

  private async getTravelTime(originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> {
    const cacheKey = this.getCacheKey(originLat, originLng, destLat, destLng)
    
    // Primero revisar caché en memoria
    if (this.travelTimeCache.has(cacheKey)) {
      this.cacheHits++
      return this.travelTimeCache.get(cacheKey)!
    }
    
    this.cacheMisses++
    
    // Buscar en Supabase con las coordenadas redondeadas
    const roundedOriginLat = parseFloat(originLat.toFixed(6))
    const roundedOriginLng = parseFloat(originLng.toFixed(6))
    const roundedDestLat = parseFloat(destLat.toFixed(6))
    const roundedDestLng = parseFloat(destLng.toFixed(6))
    
    const { data: cachedTime } = await supabase
      .from('travel_time_cache')
      .select('travel_time')
      .eq('origin_lat', roundedOriginLat)
      .eq('origin_lng', roundedOriginLng)
      .eq('dest_lat', roundedDestLat)
      .eq('dest_lng', roundedDestLng)
      .single()
    
    if (cachedTime) {
      const time = cachedTime.travel_time
      // Guardar en caché local para futuras consultas
      this.travelTimeCache.set(cacheKey, time)
      return time
    }
    
    // Si no está en Supabase, retornar infinito
    return 999999
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

  async calculateAssignments(): Promise<Assignment[]> {
    const assignments: Assignment[] = []
    const assignedHospitals = new Set<string>()

    // Identificar KAMs de Bogotá correctamente
    const bogotaKams = this.kams.filter(k => this.isBogotaKam(k))
    console.log(`\n🏙️ KAMs de Bogotá identificados: ${bogotaKams.map(k => k.name).join(', ')}`)

    // FASE 1: Asignar territorio base
    console.log('\n🏠 FASE 1: Asignando territorios base...')
    
    for (const kam of this.kams) {
      let baseHospitals: Hospital[] = []
      
      if (this.isBogotaKam(kam)) {
        // Para KAMs de Bogotá, buscar por locality_id
        baseHospitals = this.hospitals.filter(h => 
          h.locality_id === kam.area_id && !assignedHospitals.has(h.id)
        )
        console.log(`   KAM ${kam.name} (Localidad ${kam.area_id}): ${baseHospitals.length} hospitales en territorio base`)
      } else {
        // Para otros KAMs, buscar por municipality_id
        baseHospitals = this.hospitals.filter(h => 
          h.municipality_id === kam.area_id && !assignedHospitals.has(h.id)
        )
        console.log(`   KAM ${kam.name} (Municipio ${kam.area_id}): ${baseHospitals.length} hospitales en territorio base`)
      }

      for (const hospital of baseHospitals) {
        assignments.push({
          kam_id: kam.id,
          hospital_id: hospital.id,
          travel_time: 0,
          assignment_type: 'territory_base'
        })
        assignedHospitals.add(hospital.id)
      }
    }

    // FASE 2: Competencia por localidades de Bogotá sin KAM
    console.log('\n🏙️ FASE 2: Competencia por localidades de Bogotá...')
    
    const bogotaHospitals = this.hospitals.filter(h => 
      h.department_id === '11' && 
      h.locality_id && 
      !assignedHospitals.has(h.id)
    )
    
    if (bogotaHospitals.length > 0 && bogotaKams.length > 0) {
      // Agrupar por localidad
      const hospitalsByLocality: Record<string, Hospital[]> = {}
      bogotaHospitals.forEach(h => {
        if (h.locality_id) {
          if (!hospitalsByLocality[h.locality_id]) {
            hospitalsByLocality[h.locality_id] = []
          }
          hospitalsByLocality[h.locality_id].push(h)
        }
      })

      // Procesar cada localidad
      for (const [localityId, localityHospitals] of Object.entries(hospitalsByLocality)) {
        console.log(`   📍 Localidad ${localityId}: ${localityHospitals.length} hospitales`)
        
        const kamVotes: Record<string, number> = {}
        const hospitalAssignments: Array<{hospital: Hospital, kam: KAM, time: number}> = []
        
        // Determinar qué KAM está más cerca de cada hospital
        for (const hospital of localityHospitals) {
          let bestKam: KAM | null = null
          let bestTime = Infinity

          // Solo KAMs de Bogotá pueden competir por localidades de Bogotá
          for (const kam of bogotaKams) {
            const time = await this.getTravelTime(
              kam.lat, kam.lng,
              hospital.lat, hospital.lng
            )
            
            if (time < bestTime && time <= kam.max_travel_time) {
              bestTime = time
              bestKam = kam
            }
          }

          if (bestKam) {
            kamVotes[bestKam.id] = (kamVotes[bestKam.id] || 0) + 1
            hospitalAssignments.push({ hospital, kam: bestKam, time: bestTime })
          }
        }

        // Determinar KAM ganador por mayoría
        let winnerKamId = ''
        let maxVotes = 0
        
        for (const [kamId, votes] of Object.entries(kamVotes)) {
          if (votes > maxVotes) {
            maxVotes = votes
            winnerKamId = kamId
          }
        }

        // Asignar TODOS los hospitales de la localidad al ganador
        if (winnerKamId) {
          const winnerKam = this.kams.find(k => k.id === winnerKamId)!
          console.log(`      Ganador: ${winnerKam.name} con ${maxVotes}/${localityHospitals.length} hospitales`)
          
          for (const { hospital, kam, time } of hospitalAssignments) {
            assignments.push({
              kam_id: winnerKamId,
              hospital_id: hospital.id,
              travel_time: kam.id === winnerKamId ? time : null,
              assignment_type: 'automatic'
            })
            assignedHospitals.add(hospital.id)
          }
        }
      }
    }

    // FASE 3: Asignación competitiva por municipio (fuera de Bogotá)
    console.log('\n🏃 FASE 3: Asignación competitiva por municipio...')
    
    const unassignedHospitals = this.hospitals.filter(h => 
      !assignedHospitals.has(h.id) && h.department_id !== '11' // Excluir Bogotá
    )
    
    console.log(`   Hospitales sin asignar (fuera de Bogotá): ${unassignedHospitals.length}`)
    
    // Agrupar por municipio
    const hospitalsByMunicipality: Record<string, Hospital[]> = {}
    unassignedHospitals.forEach(h => {
      if (!hospitalsByMunicipality[h.municipality_id]) {
        hospitalsByMunicipality[h.municipality_id] = []
      }
      hospitalsByMunicipality[h.municipality_id].push(h)
    })
    
    // Procesar cada municipio
    for (const [municipalityId, municipalityHospitals] of Object.entries(hospitalsByMunicipality)) {
      const kamVotes: Record<string, number> = {}
      const hospitalAssignments: Array<{hospital: Hospital, kam: KAM, time: number}> = []
      
      for (const hospital of municipalityHospitals) {
        let bestKam: KAM | null = null
        let bestTime = Infinity

        for (const kam of this.kams) {
          const kamDept = kam.area_id.substring(0, 2)
          const hospitalDept = hospital.department_id

          // Verificar si el KAM puede competir
          const isSameDepartment = kamDept === hospitalDept
          const isAdjacent = this.adjacencyMatrix[kamDept]?.includes(hospitalDept)
          const isLevel2Adjacent = kam.enable_level2 && this.isLevel2Adjacent(kamDept, hospitalDept)
          
          // KAMs de Bogotá pueden competir en Cundinamarca y adyacentes
          const isBogotaCompeting = this.isBogotaKam(kam) && 
            (hospitalDept === '25' || this.adjacencyMatrix['25']?.includes(hospitalDept))
          
          if (!isSameDepartment && !isAdjacent && !isLevel2Adjacent && !isBogotaCompeting) {
            continue
          }

          const time = await this.getTravelTime(
            kam.lat, kam.lng,
            hospital.lat, hospital.lng
          )

          if (time <= kam.max_travel_time && time < bestTime) {
            bestTime = time
            bestKam = kam
          }
        }

        if (bestKam) {
          kamVotes[bestKam.id] = (kamVotes[bestKam.id] || 0) + 1
          hospitalAssignments.push({ hospital, kam: bestKam, time: bestTime })
        }
      }

      // Determinar ganador por mayoría
      let winnerKamId = ''
      let maxVotes = 0
      
      for (const [kamId, votes] of Object.entries(kamVotes)) {
        if (votes > maxVotes) {
          maxVotes = votes
          winnerKamId = kamId
        }
      }

      // Asignar todos los hospitales del municipio al ganador
      if (winnerKamId) {
        const winnerKam = this.kams.find(k => k.id === winnerKamId)!
        console.log(`   📍 Municipio ${municipalityId}: ${municipalityHospitals.length} hospitales → ${winnerKam.name}`)
        
        for (const { hospital, kam, time } of hospitalAssignments) {
          assignments.push({
            kam_id: winnerKamId,
            hospital_id: hospital.id,
            travel_time: kam.id === winnerKamId ? time : null,
            assignment_type: 'automatic'
          })
          assignedHospitals.add(hospital.id)
        }
      }
    }

    // Resumen
    console.log('\n📊 RESUMEN DE ASIGNACIONES:')
    const assignmentsByKam: Record<string, number> = {}
    assignments.forEach(a => {
      assignmentsByKam[a.kam_id] = (assignmentsByKam[a.kam_id] || 0) + 1
    })
    
    for (const kam of this.kams) {
      console.log(`   ${kam.name}: ${assignmentsByKam[kam.id] || 0} hospitales`)
    }

    console.log(`\n📊 Estadísticas de caché:`)
    console.log(`✅ Hits de caché: ${this.cacheHits}`)
    console.log(`❌ Misses de caché: ${this.cacheMisses}`)
    console.log(`🎯 Tasa de acierto: ${(this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1)}%`)

    return assignments
  }

  async saveAssignments(assignments: Assignment[]): Promise<number> {
    console.log(`💾 Guardando ${assignments.length} asignaciones...`)
    
    // Eliminar asignaciones anteriores
    console.log('🗑️ Eliminando todas las asignaciones anteriores...')
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Eliminar todas
    
    if (deleteError) {
      console.error('Error eliminando asignaciones:', deleteError)
      throw deleteError
    }
    
    // Insertar nuevas asignaciones
    console.log(`📝 Insertando ${assignments.length} nuevas asignaciones...`)
    const { data, error } = await supabase
      .from('assignments')
      .insert(assignments)
      .select()
    
    if (error) {
      console.error('Error guardando asignaciones:', error)
      throw error
    }
    
    console.log(`✅ ${data.length} asignaciones guardadas exitosamente`)
    return data.length
  }
}