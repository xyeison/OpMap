import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { fetchAllRows, serverError } from '../../_lib/api-error'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Hospitales activos sin asignación con sus tiempos (segundos) a cada KAM activo. Requiere sesión.
export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    // 1. Obtener TODOS los hospitales activos (paginado: PostgREST corta en 1.000 filas)
    const { data: allHospitals, error: hospitalsError } = await fetchAllRows<any>((from, to) =>
      supabase.from('hospitals').select('*').eq('active', true).order('id').range(from, to)
    )
    if (hospitalsError) return serverError('travel-times/unassigned-optimized (hospitales)', hospitalsError)
    
    if (!allHospitals || allHospitals.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0,
        error: 'No active hospitals found' 
      })
    }
    
    // 2. Obtener hospitales asignados - IMPORTANTE: usar la consulta correcta
    const { data: assignments, error: assignmentsError } = await fetchAllRows<{ hospital_id: string }>((from, to) =>
      supabase
        .from('assignments')
        .select('hospital_id')
        .not('hospital_id', 'is', null)
        .order('id')
        .range(from, to)
    )
    
    if (assignmentsError) {
      // Sin asignaciones completas se mostrarían como vacantes IPS que sí tienen KAM
      return serverError('travel-times/unassigned-optimized (assignments)', assignmentsError)
    }
    
    console.log(`📊 Assignments encontrados: ${assignments?.length || 0}`)
    
    const assignedIds = new Set((assignments || []).map(a => a.hospital_id).filter(id => id !== null))
    
    // 3. Filtrar hospitales sin asignar en memoria
    const unassignedHospitals = allHospitals.filter(h => !assignedIds.has(h.id))
    
    console.log(`📊 Total hospitales activos: ${allHospitals.length}`)
    console.log(`✅ Hospitales asignados: ${assignedIds.size}`)
    console.log(`❌ Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    // Log de verificación - mostrar algunos IDs
    if (unassignedHospitals.length > 0) {
      console.log(`🔍 Primeros 3 hospitales sin asignar:`)
      unassignedHospitals.slice(0, 3).forEach(h => {
        console.log(`  - ${h.name} (ID: ${h.id})`)
      })
    }
    
    // 4. Obtener todos los KAMs activos
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (!kams || kams.length === 0) {
      return NextResponse.json({ 
        unassigned_hospitals: [],
        total: 0,
        error: 'No active KAMs found' 
      })
    }
    
    // 5. Obtener TODOS los tiempos de una sola vez desde hospital_kam_distances
    const hospitalIds = unassignedHospitals.map(h => h.id)
    
    console.log(`🔍 Buscando tiempos para ${hospitalIds.length} hospitales sin asignar`)
    console.log(`🔍 Primeros 3 IDs de hospitales sin asignar:`, hospitalIds.slice(0, 3))
    
    // Primero obtener las distancias
    const { data: allDistances, error: distancesError } = hospitalIds.length === 0
      ? { data: [] as any[], error: null }
      : await fetchAllRows<any>((from, to) =>
          supabase
            .from('hospital_kam_distances')
            .select('hospital_id, kam_id, travel_time, distance')
            .in('hospital_id', hospitalIds)
            .order('id')
            .range(from, to)
        )
    
    if (distancesError) {
      console.error('❌ Error obteniendo distancias:', distancesError)
    }
    
    console.log(`📊 Distancias encontradas: ${allDistances?.length || 0} registros`)
    
    // Crear mapa de distancias por hospital
    const distancesByHospital: Record<string, any[]> = {}
    
    // Crear mapa de KAMs para búsqueda rápida
    const kamsMap: Record<string, any> = {}
    kams?.forEach(kam => {
      kamsMap[kam.id] = kam
    })
    
    if (allDistances) {
      allDistances.forEach(d => {
        const kam = kamsMap[d.kam_id]
        if (kam && kam.active) {  // Solo incluir KAMs activos
          if (!distancesByHospital[d.hospital_id]) {
            distancesByHospital[d.hospital_id] = []
          }
          distancesByHospital[d.hospital_id].push({
            kam_id: d.kam_id,
            kam_name: kam.name,
            travel_time: d.travel_time,
            max_travel_time: kam.max_travel_time || 240
          })
        }
      })
    }
    
    // Log hospitales que tienen distancias
    const hospitalsWithDistances = Object.keys(distancesByHospital)
    console.log(`🏥 Hospitales con distancias calculadas: ${hospitalsWithDistances.length}`)
    if (hospitalsWithDistances.length > 0) {
      console.log(`📍 Ejemplo - Hospital ${hospitalsWithDistances[0]} tiene ${distancesByHospital[hospitalsWithDistances[0]].length} rutas`)
    }
    
    // 6. Construir hospitales con tiempos
    const hospitalsWithTimes: any[] = []
    
    for (const hospital of unassignedHospitals) {
      const distances = distancesByHospital[hospital.id] || []
      
      // Agregar KAMs que no tienen tiempo calculado
      const kamsWithTimes = new Set(distances.map(d => d.kam_id))
      kams?.forEach(kam => {
        if (!kamsWithTimes.has(kam.id)) {
          distances.push({
            kam_id: kam.id,
            kam_name: kam.name,
            travel_time: null,
            max_travel_time: kam.max_travel_time || 240
          })
        }
      })
      
      // Ordenar: primero los que tienen tiempo (menor a mayor), luego los null
      distances.sort((a, b) => {
        if (a.travel_time === null && b.travel_time === null) return 0
        if (a.travel_time === null) return 1
        if (b.travel_time === null) return -1
        return a.travel_time - b.travel_time
      })
        
      
      hospitalsWithTimes.push({
        id: hospital.id,
        name: hospital.name,
        code: hospital.code,
        municipality_name: hospital.municipality_name,
        department_name: hospital.department_name,
        lat: hospital.lat,
        lng: hospital.lng,
        beds: hospital.beds || 0,
        service_level: hospital.service_level || 1,
        travel_times: distances
      })
    }
    
    // Ordenar hospitales por nombre para consistencia
    hospitalsWithTimes.sort((a, b) => a.name.localeCompare(b.name))
    
    return NextResponse.json({
      unassigned_hospitals: hospitalsWithTimes,
      total: hospitalsWithTimes.length,
      debug: {
        total_active_hospitals: allHospitals.length,
        total_assignments: assignedIds.size,
        total_unassigned: unassignedHospitals.length,
        hospitals_returned: hospitalsWithTimes.length,
        with_travel_times: hospitalsWithTimes.filter((h: any) => h.travel_times.some((t: any) => t.travel_time !== null)).length,
        without_any_travel_times: hospitalsWithTimes.filter((h: any) => h.travel_times.every((t: any) => t.travel_time === null)).length,
        total_active_kams: kams?.length || 0
      }
    })
    
  } catch (error) {
    return serverError('travel-times/unassigned-optimized', error, 'Error al obtener los tiempos de viaje')
  }
}