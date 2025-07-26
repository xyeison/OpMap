/**
 * OpMap Algorithm for TypeScript/Next.js - FIXED VERSION
 * Fixes issue where KAMs without hospitals in their base territory get no assignments
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

export class OpMapAlgorithmFixed {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private travelTimeCache: Record<string, number> = {}
  private cacheHits = 0
  private cacheMisses = 0

  async initialize() {
    console.log('📦 Inicializando algoritmo OpMap (FIXED)...')
    
    // Cargar KAMs
    const { data: kamsData } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    this.kams = kamsData || []
    console.log(`✅ ${this.kams.length} KAMs activos cargados`)
    
    // Log específico para Cartagena
    const cartagenaKam = this.kams.find(k => k.name === 'KAM Cartagena')
    if (cartagenaKam) {
      console.log(`🏖️ Cartagena KAM encontrado: ID=${cartagenaKam.id}, area_id=${cartagenaKam.area_id}`)
    } else {
      console.log('⚠️ Cartagena KAM NO encontrado en KAMs activos')
    }

    // Cargar Hospitales
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    this.hospitals = hospitalsData || []
    console.log(`🏥 ${this.hospitals.length} hospitales activos cargados`)
    
    // Contar hospitales en Cartagena
    const cartagenaHospitals = this.hospitals.filter(h => h.municipality_id === '13001')
    console.log(`🏥 Hospitales en Cartagena (13001): ${cartagenaHospitals.length}`)
    
    // Contar hospitales en Bolívar
    const bolivarHospitals = this.hospitals.filter(h => h.department_id === '13')
    console.log(`🏥 Hospitales en Bolívar (13): ${bolivarHospitals.length}`)

    // Cargar matriz de adyacencia
    const { data: adjacencyData } = await supabase
      .from('department_adjacency')
      .select('department_code, adjacent_department_code')
    
    // Construir matriz
    adjacencyData?.forEach(row => {
      if (!this.adjacencyMatrix[row.department_code]) {
        this.adjacencyMatrix[row.department_code] = []
      }
      this.adjacencyMatrix[row.department_code].push(row.adjacent_department_code)
    })
    
    // Verificar adyacencia Atlántico-Bolívar
    console.log(`📍 Adyacencias de Atlántico (08): ${this.adjacencyMatrix['08']?.join(', ') || 'Ninguna'}`)
    console.log(`📍 Adyacencias de Bolívar (13): ${this.adjacencyMatrix['13']?.join(', ') || 'Ninguna'}`)

    // Cargar caché de tiempos
    const { data: cacheData } = await supabase
      .from('travel_time_cache')
      .select('*')
    
    cacheData?.forEach(row => {
      const key = `${row.origin_lat},${row.origin_lng}|${row.dest_lat},${row.dest_lng}`
      this.travelTimeCache[key] = row.travel_time
    })
    console.log(`🗑️ ${Object.keys(this.travelTimeCache).length} rutas en caché`)
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  private async getTravelTime(
    originLat: number, 
    originLng: number, 
    destLat: number, 
    destLng: number
  ): Promise<number> {
    // Primero revisar caché en memoria
    const cacheKey = `${originLat},${originLng}|${destLat},${destLng}`
    if (this.travelTimeCache[cacheKey]) {
      this.cacheHits++
      return this.travelTimeCache[cacheKey]
    }

    // Si no está en caché de memoria, buscar en BD
    const { data: cachedTime } = await supabase
      .from('travel_time_cache')
      .select('travel_time')
      .eq('origin_lat', originLat)
      .eq('origin_lng', originLng)
      .eq('dest_lat', destLat)
      .eq('dest_lng', destLng)
      .single()

    if (cachedTime) {
      this.travelTimeCache[cacheKey] = cachedTime.travel_time
      this.cacheHits++
      return cachedTime.travel_time
    }

    // Si no está en BD, calcular con Haversine
    this.cacheMisses++
    const distance = this.haversineDistance(originLat, originLng, destLat, destLng)
    const avgSpeed = 60 // km/h promedio
    const time = Math.round((distance / avgSpeed) * 60) // minutos
    
    // Guardar en caché
    this.travelTimeCache[cacheKey] = time
    
    // También guardar en BD para futuras consultas
    await supabase.from('travel_time_cache').insert({
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
      travel_time: time,
      distance: distance,
      source: 'haversine'
    })

    return time
  }

  async calculateAssignments(): Promise<Assignment[]> {
    const assignments: Assignment[] = []
    const assignedHospitals = new Set<string>()

    // Identificar KAMs de Bogotá
    const bogotaKams = this.kams.filter(k => k.area_id === '11001')
    
    console.log('\n🏙️ FASE 1: Manejar IPS de Bogotá con lógica especial')
    const bogotaHospitals = this.hospitals.filter(h => 
      h.department_id === '11' && h.locality_id && !assignedHospitals.has(h.id)
    )
    
    if (bogotaHospitals.length > 0 && bogotaKams.length > 0) {
      // Agrupar hospitales por localidad
      const hospitalsByLocality: Record<string, Hospital[]> = {}
      bogotaHospitals.forEach(h => {
        if (h.locality_id) {
          if (!hospitalsByLocality[h.locality_id]) {
            hospitalsByLocality[h.locality_id] = []
          }
          hospitalsByLocality[h.locality_id].push(h)
        }
      })

      // Para cada localidad, determinar qué KAM tiene mayoría
      for (const [localityId, localityHospitals] of Object.entries(hospitalsByLocality)) {
        const kamVotes: Record<string, number> = {}
        
        // Calcular votos (qué KAM está más cerca de cada hospital)
        for (const hospital of localityHospitals) {
          let bestKam: KAM | null = null
          let bestTime = Infinity

          for (const kam of bogotaKams) {
            const time = await this.getTravelTime(
              kam.lat, kam.lng,
              hospital.lat, hospital.lng
            )
            if (time < bestTime) {
              bestTime = time
              bestKam = kam
            }
          }

          if (bestKam) {
            kamVotes[bestKam.id] = (kamVotes[bestKam.id] || 0) + 1
          }
        }

        // Determinar KAM ganador
        const winner = Object.entries(kamVotes)
          .sort(([,a], [,b]) => b - a)[0]
        
        if (winner) {
          const winnerKamId = winner[0]
          // Asignar todos los hospitales de esta localidad al KAM ganador
          for (const hospital of localityHospitals) {
            assignments.push({
              kam_id: winnerKamId,
              hospital_id: hospital.id,
              travel_time: null,
              assignment_type: 'automatic'
            })
            assignedHospitals.add(hospital.id)
          }
        }
      }
    }

    // FASE 2: Asignar territorio base (hospitales en el mismo municipio del KAM)
    console.log('\n🏠 FASE 2: Asignando territorios base...')
    for (const kam of this.kams) {
      const baseHospitals = this.hospitals.filter(h => 
        h.municipality_id === kam.area_id && !assignedHospitals.has(h.id)
      )

      console.log(`   KAM ${kam.name} (${kam.area_id}): ${baseHospitals.length} hospitales en territorio base`)

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

    // FASE 3: Asignación competitiva MEJORADA
    console.log('\n🏃 FASE 3: Asignación competitiva...')
    const unassignedHospitals = this.hospitals.filter(h => !assignedHospitals.has(h.id))
    console.log(`   Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // Agrupar hospitales por departamento para debugging
    const unassignedByDept: Record<string, number> = {}
    unassignedHospitals.forEach(h => {
      unassignedByDept[h.department_id] = (unassignedByDept[h.department_id] || 0) + 1
    })
    console.log('   Distribución por departamento:', unassignedByDept)
    
    for (const hospital of unassignedHospitals) {
      let bestKam: KAM | null = null
      let bestTime = Infinity
      let candidateKams: Array<{kam: KAM, time: number}> = []

      // Buscar TODOS los KAMs que pueden atender este hospital
      for (const kam of this.kams) {
        const kamDept = kam.area_id.substring(0, 2)
        const hospitalDept = hospital.department_id

        // MEJORA: Incluir KAMs del mismo departamento siempre
        const isSameDepartment = kamDept === hospitalDept
        const isAdjacent = this.adjacencyMatrix[kamDept]?.includes(hospitalDept)
        const isLevel2Adjacent = kam.enable_level2 && this.isLevel2Adjacent(kamDept, hospitalDept)
        
        // Un KAM puede competir si:
        // 1. Está en el mismo departamento que el hospital
        // 2. Está en un departamento adyacente
        // 3. Tiene Level2 habilitado y está en un departamento adyacente de segundo nivel
        if (!isSameDepartment && !isAdjacent && !isLevel2Adjacent) {
          continue
        }

        // Calcular tiempo
        const time = await this.getTravelTime(
          kam.lat, kam.lng,
          hospital.lat, hospital.lng
        )

        // Logging especial para Cartagena y Barranquilla
        if (hospital.municipality_id === '13001' && kam.name.includes('Barranquilla')) {
          console.log(`   🔍 ${kam.name} -> Hospital en Cartagena: ${time} min (límite: ${kam.max_travel_time} min)`)
        }

        // Solo considerar si está dentro del límite de tiempo del KAM
        if (time <= kam.max_travel_time) {
          candidateKams.push({ kam, time })
          
          if (time < bestTime) {
            bestTime = time
            bestKam = kam
          }
        }
      }

      // Si hay múltiples candidatos con tiempos similares, priorizar por:
      // 1. KAMs del mismo departamento
      // 2. Mayor prioridad
      // 3. Menor tiempo
      if (candidateKams.length > 0) {
        candidateKams.sort((a, b) => {
          const aDept = a.kam.area_id.substring(0, 2)
          const bDept = b.kam.area_id.substring(0, 2)
          const hospitalDept = hospital.department_id
          
          // Priorizar mismo departamento
          const aSameDept = aDept === hospitalDept
          const bSameDept = bDept === hospitalDept
          
          if (aSameDept && !bSameDept) return -1
          if (!aSameDept && bSameDept) return 1
          
          // Si ambos están en el mismo estado (mismo dept o no), comparar por tiempo
          // con un margen de tolerancia
          const timeDiff = Math.abs(a.time - b.time)
          if (timeDiff < 10) { // Si la diferencia es menor a 10 minutos
            // Usar prioridad como desempate
            return b.kam.priority - a.kam.priority
          }
          
          // Si no, el de menor tiempo gana
          return a.time - b.time
        })
        
        bestKam = candidateKams[0].kam
        bestTime = candidateKams[0].time
      }

      if (bestKam) {
        if (hospital.municipality_id === '13001') {
          console.log(`   ✅ Hospital de Cartagena asignado a ${bestKam.name} (${Math.round(bestTime)} min)`)
        }
        assignments.push({
          kam_id: bestKam.id,
          hospital_id: hospital.id,
          travel_time: bestTime,
          assignment_type: 'automatic'
        })
        assignedHospitals.add(hospital.id)
      } else {
        if (hospital.municipality_id === '13001') {
          console.log(`   ⚠️ Hospital de Cartagena sin asignar: ${hospital.name} - Sin KAMs candidatos dentro del límite de tiempo`)
        }
      }
    }

    // Resumen final
    console.log('\n📊 RESUMEN DE ASIGNACIONES:')
    const assignmentsByKam: Record<string, number> = {}
    assignments.forEach(a => {
      assignmentsByKam[a.kam_id] = (assignmentsByKam[a.kam_id] || 0) + 1
    })
    
    for (const kam of this.kams) {
      const count = assignmentsByKam[kam.id] || 0
      console.log(`   ${kam.name}: ${count} hospitales`)
      if (count === 0) {
        console.log(`      ⚠️ ALERTA: ${kam.name} no tiene hospitales asignados!`)
      }
    }

    // Verificar hospitales no asignados
    const totalUnassigned = this.hospitals.length - assignments.length
    if (totalUnassigned > 0) {
      console.log(`\n⚠️ Hospitales sin asignar: ${totalUnassigned}`)
    }

    // Mostrar estadísticas de caché
    console.log('\n📊 Estadísticas de caché:')
    console.log(`✅ Hits de caché: ${this.cacheHits}`)
    console.log(`❌ Misses de caché: ${this.cacheMisses}`)
    console.log(`🎯 Tasa de acierto: ${((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1)}%`)
    
    return assignments
  }

  private isLevel2Adjacent(kamDept: string, hospitalDept: string): boolean {
    // Verificar adyacencia de segundo nivel
    const level1Depts = this.adjacencyMatrix[kamDept] || []
    
    for (const dept of level1Depts) {
      if (this.adjacencyMatrix[dept]?.includes(hospitalDept)) {
        return true
      }
    }
    
    return false
  }

  async saveAssignments(assignments: Assignment[]) {
    console.log(`💾 Guardando ${assignments.length} asignaciones...`)
    
    try {
      // Estrategia: Usar una transacción para eliminar y recrear
      console.log('🗑️ Eliminando todas las asignaciones anteriores...')
      
      // Primero obtener todas las asignaciones existentes
      const { data: existingAssignments } = await supabase
        .from('assignments')
        .select('id')
      
      if (existingAssignments && existingAssignments.length > 0) {
        // Eliminar por lotes usando los IDs
        const deletePromises = []
        const batchSize = 100
        
        for (let i = 0; i < existingAssignments.length; i += batchSize) {
          const batch = existingAssignments.slice(i, i + batchSize)
          const ids = batch.map(a => a.id)
          
          deletePromises.push(
            supabase
              .from('assignments')
              .delete()
              .in('id', ids)
          )
        }
        
        await Promise.all(deletePromises)
        console.log(`✅ Eliminadas ${existingAssignments.length} asignaciones anteriores`)
      }

      // Insertar nuevas asignaciones
      console.log(`📝 Insertando ${assignments.length} nuevas asignaciones...`)
      
      // Insertar por lotes para evitar problemas
      const insertPromises = []
      const batchSize = 100
      
      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize)
        insertPromises.push(
          supabase
            .from('assignments')
            .insert(batch)
        )
      }
      
      const results = await Promise.all(insertPromises)
      
      // Verificar errores
      for (const result of results) {
        if (result.error) {
          console.error('Error en inserción:', result.error)
          throw new Error(`Error saving assignments: ${result.error.message}`)
        }
      }

      console.log(`✅ ${assignments.length} asignaciones guardadas exitosamente`)
      return assignments.length
      
    } catch (error) {
      console.error('Error en saveAssignments:', error)
      throw error
    }
  }
}