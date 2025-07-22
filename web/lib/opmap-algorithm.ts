/**
 * OpMap Algorithm for TypeScript/Next.js
 * Calcula asignaciones de hospitales a KAMs
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

export class OpMapAlgorithm {
  private kams: KAM[] = []
  private hospitals: Hospital[] = []
  private adjacencyMatrix: Record<string, string[]> = {}
  private travelTimeCache: Record<string, number> = {}

  async initialize() {
    // Cargar KAMs
    const { data: kamsData } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    this.kams = kamsData || []

    // Cargar Hospitales
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    this.hospitals = hospitalsData || []

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

    // Cargar caché de tiempos
    const { data: cacheData } = await supabase
      .from('travel_time_cache')
      .select('*')
    
    cacheData?.forEach(row => {
      const key = `${row.origin_lat},${row.origin_lng}|${row.dest_lat},${row.dest_lng}`
      this.travelTimeCache[key] = row.travel_time
    })
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
      return cachedTime.travel_time
    }

    // Si no está en BD, calcular con Haversine
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
    
    // Fase 1: Manejar IPS de Bogotá con lógica especial
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

    // Fase 2: Asignar territorio base (hospitales en el mismo municipio del KAM)
    for (const kam of this.kams) {
      const baseHospitals = this.hospitals.filter(h => 
        h.municipality_id === kam.area_id && !assignedHospitals.has(h.id)
      )

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

    // Fase 2: Asignación competitiva
    const unassignedHospitals = this.hospitals.filter(h => !assignedHospitals.has(h.id))
    
    for (const hospital of unassignedHospitals) {
      let bestKam: KAM | null = null
      let bestTime = Infinity

      // Buscar el KAM más cercano
      for (const kam of this.kams) {
        // Verificar si el hospital está en zona de búsqueda del KAM
        const kamDept = kam.area_id.substring(0, 2)
        const hospitalDept = hospital.department_id

        // Verificar adyacencia
        const isAdjacent = 
          kamDept === hospitalDept ||
          this.adjacencyMatrix[kamDept]?.includes(hospitalDept) ||
          (kam.enable_level2 && this.isLevel2Adjacent(kamDept, hospitalDept))

        if (!isAdjacent) continue

        // Calcular tiempo
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
        assignments.push({
          kam_id: bestKam.id,
          hospital_id: hospital.id,
          travel_time: bestTime,
          assignment_type: 'automatic'
        })
        assignedHospitals.add(hospital.id)
      }
    }

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
    // Limpiar asignaciones automáticas anteriores
    await supabase
      .from('assignments')
      .delete()
      .in('assignment_type', ['automatic', 'territory_base'])

    // Insertar nuevas asignaciones
    const { error } = await supabase
      .from('assignments')
      .insert(assignments)

    if (error) {
      throw new Error(`Error saving assignments: ${error.message}`)
    }

    return assignments.length
  }
}