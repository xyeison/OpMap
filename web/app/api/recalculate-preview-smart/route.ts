import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // 1. Obtener KAMs activos con sus ubicaciones
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id, name, area_id, lat, lng, enable_level2')
      .eq('active', true)
    
    if (kamsError || !kams || kams.length === 0) {
      return NextResponse.json({
        success: true,
        preview: {
          totalKams: 0,
          totalHospitals: 0,
          actualRoutesNeeded: 0,
          routesInCache: 0,
          missingRoutes: 0,
          googleMapsApiCalls: 0,
          estimatedTimeSeconds: 0,
          estimatedCostUSD: "0.00",
          warning: "No hay KAMs activos. Active al menos un KAM antes de recalcular.",
          details: []
        }
      })
    }

    // 2. Obtener hospitales activos
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('id, department_id, municipality_id, lat, lng')
      .eq('active', true)

    // 3. Cargar matriz de adyacencia
    const { data: adjacencyData } = await supabase
      .from('department_adjacency')
      .select('department_code, adjacent_department_code')

    // Construir matriz de adyacencia
    const adjacencyMatrix: Record<string, string[]> = {}
    adjacencyData?.forEach(row => {
      if (!adjacencyMatrix[row.department_code]) {
        adjacencyMatrix[row.department_code] = []
      }
      adjacencyMatrix[row.department_code].push(row.adjacent_department_code)
    })

    // 4. Calcular qué rutas realmente se necesitan
    let actualRoutesNeeded = 0
    const routePairs: Array<{origin: string, dest: string}> = []

    for (const hospital of hospitals || []) {
      const hospitalDept = hospital.department_id
      
      for (const kam of kams) {
        const kamDept = kam.area_id.substring(0, 2)
        
        // Verificar si el KAM puede competir por este hospital
        const isSameDepartment = kamDept === hospitalDept
        const isAdjacent = adjacencyMatrix[kamDept]?.includes(hospitalDept)
        const isLevel2 = kam.enable_level2 && isLevel2Adjacent(kamDept, hospitalDept, adjacencyMatrix)
        
        if (isSameDepartment || isAdjacent || isLevel2) {
          actualRoutesNeeded++
          routePairs.push({
            origin: `${kam.lat},${kam.lng}`,
            dest: `${hospital.lat},${hospital.lng}`
          })
        }
      }
    }

    // 5. Verificar cuántas de estas rutas ya están en caché
    let routesInCache = 0
    const batchSize = 1000
    
    // Procesar en lotes para evitar queries muy grandes
    for (let i = 0; i < routePairs.length; i += batchSize) {
      const batch = routePairs.slice(i, i + batchSize)
      
      // Construir condiciones OR para este lote
      let query = supabase.from('travel_time_cache').select('id', { count: 'exact', head: true })
      
      // Agregar condiciones para cada par en el lote
      const orConditions = batch.map(pair => 
        `origin_lat.eq.${pair.origin.split(',')[0]},origin_lng.eq.${pair.origin.split(',')[1]},dest_lat.eq.${pair.dest.split(',')[0]},dest_lng.eq.${pair.dest.split(',')[1]}`
      ).join(',')
      
      if (orConditions) {
        query = query.or(orConditions)
      }
      
      const { count } = await query
      routesInCache += count || 0
    }

    const missingRoutes = actualRoutesNeeded - routesInCache
    const estimatedTime = Math.ceil(missingRoutes / 10) // 10 llamadas por segundo
    const estimatedCost = (missingRoutes * 0.005).toFixed(2)

    // 6. Detalles adicionales para debugging
    const details = []
    
    // Hospitales sin asignar (que necesitarán nuevas rutas)
    const { data: unassignedHospitals } = await supabase
      .from('hospitals')
      .select('id')
      .eq('active', true)
      .is('assignments', null)
    
    if (unassignedHospitals?.length) {
      details.push(`${unassignedHospitals.length} hospitales sin asignar`)
    }

    // Hospitales recientemente agregados (últimas 24 horas)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const { data: recentHospitals } = await supabase
      .from('hospitals')
      .select('id')
      .eq('active', true)
      .gte('created_at', yesterday.toISOString())
    
    if (recentHospitals?.length) {
      details.push(`${recentHospitals.length} hospitales agregados recientemente`)
    }

    return NextResponse.json({
      success: true,
      preview: {
        totalKams: kams.length,
        totalHospitals: hospitals?.length || 0,
        actualRoutesNeeded,
        routesInCache,
        missingRoutes,
        googleMapsApiCalls: missingRoutes,
        estimatedTimeSeconds: estimatedTime,
        estimatedCostUSD: estimatedCost,
        cacheInfo: {
          percentage: ((routesInCache / actualRoutesNeeded) * 100).toFixed(1),
          efficiency: `${routesInCache} de ${actualRoutesNeeded} rutas ya calculadas`
        },
        details: details.length > 0 ? details : ['Sistema optimizado - solo se calcularán rutas nuevas']
      }
    })
  } catch (error: any) {
    console.error('Error in smart preview:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}

function isLevel2Adjacent(kamDept: string, hospitalDept: string, adjacencyMatrix: Record<string, string[]>): boolean {
  const level1Depts = adjacencyMatrix[kamDept] || []
  
  for (const dept of level1Depts) {
    if (adjacencyMatrix[dept]?.includes(hospitalDept)) {
      return true
    }
  }
  
  return false
}