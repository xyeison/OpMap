import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const diagnostics: any = {}

  // 1. Estado de los KAMs
  const { data: kams } = await supabase
    .from('sellers')
    .select('*')
    .in('id', ['cartagena', 'barranquilla'])

  diagnostics.kams = kams?.map(kam => ({
    name: kam.name,
    id: kam.id,
    active: kam.active,
    areaId: kam.area_id,
    enableLevel2: kam.enable_level2,
    maxTravelTime: kam.max_travel_time,
    lat: kam.lat,
    lng: kam.lng
  }))

  // 2. Hospitales en Barranquilla
  const { data: barranquillaHospitals, count } = await supabase
    .from('hospitals')
    .select('*', { count: 'exact' })
    .eq('municipality_id', '08001')
    .eq('active', true)

  diagnostics.barranquillaHospitalsCount = count
  diagnostics.sampleHospitals = barranquillaHospitals?.slice(0, 3).map(h => ({
    id: h.id,
    name: h.name,
    lat: h.lat,
    lng: h.lng
  }))

  // 3. Asignaciones actuales
  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      hospital_id,
      kam_id,
      travel_time,
      hospitals!inner(
        name,
        municipality_id
      )
    `)
    .eq('hospitals.municipality_id', '08001')

  const kamCounts: Record<string, number> = {}
  assignments?.forEach(a => {
    const kamId = a.kam_id || 'unknown'
    kamCounts[kamId] = (kamCounts[kamId] || 0) + 1
  })
  diagnostics.currentAssignments = kamCounts

  // 4. Tiempos de viaje Cartagena-Barranquilla
  const cartagena = kams?.find(k => k.id === 'cartagena')
  if (cartagena && barranquillaHospitals?.[0]) {
    // Buscar tiempos entre Cartagena y el primer hospital de Barranquilla
    const { data: travelTime } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('origin_lat', cartagena.lat)
      .eq('origin_lng', cartagena.lng)
      .eq('dest_lat', barranquillaHospitals[0].lat)
      .eq('dest_lng', barranquillaHospitals[0].lng)
      .single()

    diagnostics.sampleTravelTime = travelTime ? {
      minutes: Math.round(travelTime.travel_time / 60),
      source: travelTime.source,
      distance: travelTime.distance
    } : null

    // Buscar cualquier tiempo de viaje desde Cartagena hacia la zona de Barranquilla
    const { data: anyTravelTimes } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('origin_lat', cartagena.lat)
      .eq('origin_lng', cartagena.lng)
      .gte('dest_lat', 10.9)
      .lte('dest_lat', 11.1)
      .gte('dest_lng', -74.9)
      .lte('dest_lng', -74.7)
      .limit(5)

    diagnostics.travelTimesInArea = anyTravelTimes?.length || 0
    
    // Calcular distancia Haversine como referencia
    if (cartagena && barranquillaHospitals?.[0]) {
      const R = 6371 // Radio de la Tierra en km
      const dLat = (barranquillaHospitals[0].lat - cartagena.lat) * Math.PI / 180
      const dLon = (barranquillaHospitals[0].lng - cartagena.lng) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(cartagena.lat * Math.PI / 180) * Math.cos(barranquillaHospitals[0].lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      const distance = R * c
      
      // Estimar tiempo: 60 km/h promedio
      const estimatedMinutes = Math.round((distance / 60) * 60)
      
      diagnostics.haversineEstimate = {
        distanceKm: Math.round(distance),
        estimatedMinutes: estimatedMinutes,
        withinLimit: estimatedMinutes <= (cartagena.max_travel_time || 240)
      }
    }
  }

  // 5. Matriz de adyacencia
  const { data: adjacency } = await supabase
    .from('department_adjacency')
    .select('*')
    .in('department_code', ['08', '13'])

  diagnostics.adjacency = {}
  adjacency?.forEach(a => {
    if (!diagnostics.adjacency[a.department_code]) {
      diagnostics.adjacency[a.department_code] = []
    }
    diagnostics.adjacency[a.department_code].push(a.adjacent_department_code)
  })

  // 6. Análisis
  diagnostics.analysis = {
    canCartagenaCompeteForBarranquilla: diagnostics.adjacency['13']?.includes('08'),
    isBarranquillaActive: diagnostics.kams?.find((k: any) => k.id === 'barranquilla')?.active,
    cartagenaHasLevel2: diagnostics.kams?.find((k: any) => k.id === 'cartagena')?.enableLevel2,
    expectedBehavior: "Cuando Barranquilla se desactiva, Cartagena debería poder competir por sus hospitales porque Bolívar (13) es adyacente a Atlántico (08)"
  }

  return NextResponse.json(diagnostics, { status: 200 })
}