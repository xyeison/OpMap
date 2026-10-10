import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { fetchAllRows, isUuid, serverError } from '../../_lib/api-error'

// Cobertura: IPS asignadas sin visitas a menos de 5 km en el período. Requiere sesión.
// Lecturas paginadas con .range() (M-01).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    
    // Obtener parámetros de consulta
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const kamIdParam = searchParams.get('kamId')
    if (kamIdParam && !isUuid(kamIdParam)) {
      return NextResponse.json({ error: 'kamId inválido' }, { status: 400 })
    }
    const kamId = kamIdParam

    // Construir filtros de fecha
    let dateFilter: { start?: string; end?: string } = {}
    if (month && year && /^\d{1,2}$/.test(month) && /^\d{4}$/.test(year)) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1
      const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
      
      dateFilter = {
        start: startDate,
        end: endDate
      }
    }

    // 1. Obtener todos los hospitales asignados (con KAM si se especifica)
    const buildHospitalsQuery = (from: number, to: number) => {
    let hospitalsQuery = supabase
      .from('hospitals')
      .select(`
        id,
        name,
        code,
        lat,
        lng,
        municipality_id,
        municipality_name,
        department_name,
        assignments!inner(
          kam_id,
          kams!inner(
            id,
            name,
            color
          )
        )
      `)
      .eq('active', true)

    if (kamId) {
      hospitalsQuery = hospitalsQuery.eq('assignments.kam_id', kamId)
    }
    return hospitalsQuery.order('id').range(from, to)
    }

    const { data: hospitals, error: hospitalsError } = await fetchAllRows<any>(buildHospitalsQuery)
    if (hospitalsError) return serverError('visits/unvisited-zones (hospitales)', hospitalsError)

    // 2. Obtener visitas del período (la columna deleted_at ya no existe en visits)
    const buildVisitsQuery = (from: number, to: number) => {
    let visitsQuery = supabase
      .from('visits')
      .select('id, lat, lng, kam_id, visit_type')

    if (dateFilter.start && dateFilter.end) {
      visitsQuery = visitsQuery
        .gte('visit_date', dateFilter.start)
        .lt('visit_date', dateFilter.end)
    }

    if (kamId) {
      visitsQuery = visitsQuery.eq('kam_id', kamId)
    }
    return visitsQuery.order('id').range(from, to)
    }

    const { data: visits, error: visitsError } = await fetchAllRows<any>(buildVisitsQuery)
    if (visitsError) return serverError('visits/unvisited-zones (visitas)', visitsError)

    // 3. Analizar hospitales no visitados
    const unvisitedHospitals: any[] = []
    const visitedHospitalIds = new Set<string>()

    if (hospitals && visits) {
      // Para cada visita, encontrar hospitales cercanos (5km)
      for (const visit of visits) {
        for (const hospital of hospitals) {
          const distance = calculateDistance(
            visit.lat,
            visit.lng,
            hospital.lat,
            hospital.lng
          )
          
          if (distance <= 5) {
            visitedHospitalIds.add(hospital.id)
          }
        }
      }

      // Identificar hospitales no visitados
      for (const hospital of hospitals) {
        if (!visitedHospitalIds.has(hospital.id)) {
          const assignment = hospital.assignments?.[0]
          const kam = assignment?.kams as any
          unvisitedHospitals.push({
            ...hospital,
            kam_id: kam?.id || null,
            kam_name: kam?.name || null,
            kam_color: kam?.color || null
          })
        }
      }
    }

    // 4. Agrupar por municipio para análisis de zonas
    const unvisitedByMunicipality = unvisitedHospitals.reduce((acc: Record<string, any>, hospital: any) => {
      const key = hospital.municipality_id
      if (!acc[key]) {
        acc[key] = {
          municipality_id: key,
          municipality_name: hospital.municipality_name,
          department_name: hospital.department_name,
          hospitals: [],
          count: 0
        }
      }
      acc[key].hospitals.push(hospital)
      acc[key].count++
      return acc
    }, {} as Record<string, any>)

    // Convertir a array y ordenar por cantidad
    const unvisitedZones = Object.values(unvisitedByMunicipality as Record<string, any>)
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      success: true,
      period: dateFilter,
      totalHospitals: hospitals?.length || 0,
      unvisitedHospitals: unvisitedHospitals.length,
      visitedHospitals: visitedHospitalIds.size,
      coveragePercentage: hospitals?.length ? 
        ((visitedHospitalIds.size / hospitals.length) * 100).toFixed(1) : 0,
      unvisitedZones,
      unvisitedHospitalsList: unvisitedHospitals
    })
  } catch (error) {
    return serverError('visits/unvisited-zones', error, 'Error al analizar zonas no visitadas')
  }
}

// Función para calcular distancia Haversine en km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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