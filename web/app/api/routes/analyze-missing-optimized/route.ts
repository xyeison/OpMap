import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { fetchAllRows, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import { routeCandidateKams } from '../../_lib/kam-eligibility'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Solo lectura (no llama a Google): lista los pares IPS-KAM elegibles que aún no tienen
// fila en hospital_kam_distances. Requiere sesión.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    console.log('analyze-missing-optimized: Starting with geographic optimization')
    
    const body = ((await readJsonBody(request)) || {}) as { hospitalIds?: unknown; includeAll?: unknown }
    const includeAll = body.includeAll
    if (body.hospitalIds != null && (!Array.isArray(body.hospitalIds) || !body.hospitalIds.every(isUuid))) {
      return NextResponse.json({ error: 'hospitalIds debe ser una lista de UUID' }, { status: 400 })
    }
    const hospitalIds = (body.hospitalIds as string[] | null | undefined) || null
    console.log('analyze-missing-optimized: Request params:', { 
      hospitalIds: hospitalIds?.length || 0, 
      includeAll 
    })
    
    // Cargar matriz de adyacencia de departamentos
    const { data: adjacencyData } = await supabaseAdmin
      .from('department_adjacency')
      .select('*')
    
    const adjacencyMatrix: Record<string, string[]> = {}
    if (adjacencyData) {
      adjacencyData.forEach(adj => {
        if (!adjacencyMatrix[adj.department_code]) {
          adjacencyMatrix[adj.department_code] = []
        }
        adjacencyMatrix[adj.department_code].push(adj.adjacent_department_code)
      })
    }
    console.log('analyze-missing-optimized: Adjacency matrix loaded')
    
    // Cargar nombres de departamentos
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('code, name')
    
    const deptNames: Record<string, string> = {}
    if (departments) {
      departments.forEach(d => {
        deptNames[d.code] = d.name
      })
    }

    // Primero obtener departamentos excluidos
    const { data: excludedDepts } = await supabaseAdmin
      .from('departments')
      .select('code')
      .eq('excluded', true)
    
    const excludedDeptCodes = new Set((excludedDepts || []).map(d => d.code))
    console.log('analyze-missing-optimized: Departamentos excluidos:', Array.from(excludedDeptCodes))

    // Obtener hospitales - SIEMPRE filtrar por activos y NO en departamentos excluidos (paginado)
    const buildHospitalsQuery = (from: number, to: number) => {
      let hospitalsQuery = supabaseAdmin
        .from('hospitals')
        .select('*')
        .eq('active', true) // SIEMPRE filtrar por activos

      // Excluir hospitales en departamentos excluidos
      if (excludedDeptCodes.size > 0) {
        hospitalsQuery = hospitalsQuery.not('department_id', 'in', `(${Array.from(excludedDeptCodes).join(',')})`)
      }

      if (hospitalIds && hospitalIds.length > 0) {
        hospitalsQuery = hospitalsQuery.in('id', hospitalIds)
      }

      return hospitalsQuery.order('id').range(from, to)
    }

    const { data: hospitals, error: hospitalsError } = await fetchAllRows<any>(buildHospitalsQuery)

    if (hospitalsError) {
      return serverError('analyze-missing-optimized (hospitales)', hospitalsError, 'Error al obtener hospitales')
    }
    
    console.log('analyze-missing-optimized: Hospitals fetched:', hospitals?.length || 0)
    if (hospitalIds && hospitals.length < hospitalIds.length) {
      console.warn(`analyze-missing-optimized: Only found ${hospitals.length} of ${hospitalIds.length} requested hospitals`)
      
      // Log which ones are missing
      const foundIds = new Set(hospitals.map(h => h.id))
      const missingIds = hospitalIds.filter((id: string) => !foundIds.has(id))
      if (missingIds.length > 0) {
        console.log('analyze-missing-optimized: Missing hospital IDs:', missingIds)
      }
    }

    // Obtener KAMs activos que participan en la asignación (los únicos que usa el algoritmo)
    const { data: kams, error: kamsError } = await supabaseAdmin
      .from('kams')
      .select('*')
      .eq('active', true)
      .eq('participates_in_assignment', true)

    if (kamsError) {
      return serverError('analyze-missing-optimized (kams)', kamsError, 'Error al obtener las zonas')
    }

    console.log('analyze-missing-optimized: KAMs fetched:', kams?.length || 0)
    
    // Log de departamentos con hospitales
    const hospitalsByDept = hospitals?.reduce((acc: any, h: any) => {
      acc[h.department_id] = (acc[h.department_id] || 0) + 1
      return acc
    }, {}) || {}
    console.log('analyze-missing-optimized: Hospitals by department:', hospitalsByDept)

    // Obtener rutas existentes de hospital_kam_distances - PAGINAR para obtener TODAS
    let existingRoutesSet: Set<string>
    
    console.log('analyze-missing-optimized: Checking existing routes in hospital_kam_distances...')
    
    // Primero obtener el conteo total
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('hospital_kam_distances')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('analyze-missing-optimized: Error counting routes:', countError)
    } else {
      console.log('analyze-missing-optimized: Total routes in database:', totalCount)
    }
    
    // Ahora obtener TODAS las rutas paginando si es necesario
    const pageSize = 1000
    let allExistingRoutes: any[] = []
    let offset = 0
    
    while (true) {
      const { data: batch, error: routesError } = await supabaseAdmin
        .from('hospital_kam_distances')
        .select('hospital_id, kam_id')
        .order('id')
        .range(offset, offset + pageSize - 1)
      
      if (routesError) {
        // Sin la lista completa de rutas existentes se propondría recalcular (y pagar) pares ya calculados
        return serverError('analyze-missing-optimized (rutas existentes)', routesError, 'Error al leer las rutas existentes')
      }
      
      if (batch && batch.length > 0) {
        allExistingRoutes = allExistingRoutes.concat(batch)
        console.log(`analyze-missing-optimized: Loaded batch ${Math.floor(offset/pageSize) + 1}, total so far: ${allExistingRoutes.length}`)
        offset += pageSize
        
        if (batch.length < pageSize) {
          break // Última página
        }
      } else {
        break
      }
    }
    
    // Crear el set con todas las rutas
    existingRoutesSet = new Set(
      allExistingRoutes.map(r => `${r.hospital_id}-${r.kam_id}`)
    )
    
    console.log('analyze-missing-optimized: ✅ Successfully loaded', existingRoutesSet.size, 'existing routes from database')
    
    if (existingRoutesSet.size > 0) {
      // Mostrar algunos ejemplos
      const samples = Array.from(existingRoutesSet).slice(0, 3)
      console.log('analyze-missing-optimized: Sample existing routes:', samples)
    } else {
      console.log('analyze-missing-optimized: ⚠️ No existing routes found in database - table appears to be empty')
    }

    // Criterio de candidatas: routeCandidateKams (lib/opmap-algorithm-simplified.ts), el MISMO que
    // usan el algoritmo de asignación y app/api/_lib/hospital-routes.ts (IPS nuevas o editadas).
    // Antes había aquí una copia propia de la regla que además proponía pares Neiva/Ibagué -> IPS de
    // Bogotá que el algoritmo nunca usa (en Bogotá solo compiten zonas de Bogotá).
    const kamsWithCoordinates = (kams || []).filter(kam => kam.lat && kam.lng)

    // Analizar rutas faltantes respetando la lógica de expansión territorial
    const missingRoutes = []
    let totalPossibleRoutes = 0
    let skippedByGeography = 0
    let alreadyCalculated = 0
    let needToCalculate = 0

    console.log('analyze-missing-optimized: Starting geographic analysis for', hospitals?.length || 0, 'hospitals and', kams?.length || 0, 'KAMs')
    
    // Para debugging: analizar solo los primeros N hospitales
    const DEBUG_MODE = false // Cambiar a true para modo debug
    const DEBUG_LIMIT = 10
    const hospitalsToAnalyze = DEBUG_MODE ? (hospitals || []).slice(0, DEBUG_LIMIT) : (hospitals || [])
    
    if (DEBUG_MODE) {
      console.log(`analyze-missing-optimized: DEBUG MODE - Analyzing only first ${DEBUG_LIMIT} hospitals`)
    }

    for (const hospital of hospitalsToAnalyze) {
      if (!hospital.lat || !hospital.lng) {
        console.warn(`Hospital ${hospital.id} (${hospital.name}) sin coordenadas`)
        continue
      }

      // Zonas que pueden competir por este hospital según la geografía (criterio único)
      const eligibleKams = routeCandidateKams(kamsWithCoordinates, hospital, adjacencyMatrix, excludedDeptCodes)
      totalPossibleRoutes += eligibleKams.length
      skippedByGeography += kamsWithCoordinates.length - eligibleKams.length

      // Ahora verificar cuáles de estas rutas posibles ya existen
      for (const kam of eligibleKams) {
        const routeKey = `${hospital.id}-${kam.id}`
        
        if (existingRoutesSet.has(routeKey)) {
          alreadyCalculated++
          continue
        }
        
        needToCalculate++

        // Determinar las zonas de búsqueda para este KAM (excluyendo departamentos excluidos)
        const kamDept = kam.area_id.substring(0, 2)
        const searchZoneCodes: string[] = []
        
        // Solo agregar el departamento del KAM si no está excluido
        if (!excludedDeptCodes.has(kamDept)) {
          searchZoneCodes.push(kamDept)
        }
        
        // Agregar departamentos vecinos no excluidos
        const kamAdjacent = (adjacencyMatrix[kamDept] || []).filter(dept => !excludedDeptCodes.has(dept))
        searchZoneCodes.push(...kamAdjacent)
        
        // Si tiene level2, agregar vecinos de vecinos no excluidos
        if (kam.enable_level2) {
          for (const adjDept of kamAdjacent) {
            const secondLevel = (adjacencyMatrix[adjDept] || []).filter(dept => !excludedDeptCodes.has(dept))
            secondLevel.forEach(dept => {
              if (!searchZoneCodes.includes(dept)) {
                searchZoneCodes.push(dept)
              }
            })
          }
        }
        
        // Convertir códigos a nombres de departamentos
        const searchZones = searchZoneCodes.map(code => deptNames[code] || `Dept ${code}`)

        // Agregar ruta faltante
        missingRoutes.push({
          hospital_id: hospital.id,
          hospital_name: hospital.name || 'Sin nombre',
          hospital_location: `${hospital.municipality_name || 'Municipio'}, ${hospital.department_name || 'Departamento'}`,
          hospital_coords: { lat: hospital.lat, lng: hospital.lng },
          kam_id: kam.id,
          kam_name: kam.name || 'Sin nombre',
          kam_coords: { lat: kam.lat, lng: kam.lng },
          search_zones: searchZones,
          level2_enabled: kam.enable_level2
        })
      }
    }
    
    // Logging detallado del análisis
    console.log('==================================================')
    console.log('analyze-missing-optimized: 📊 FINAL ANALYSIS SUMMARY:')
    console.log('==================================================') 
    console.log(`📍 Hospitales analizados: ${hospitals?.length || 0}`)
    console.log(`👥 KAMs activos: ${kams?.length || 0}`)
    console.log(`🔢 Combinaciones teóricas (sin restricciones): ${(hospitals?.length || 0) * (kams?.length || 0)}`)
    console.log(`✅ Rutas geográficamente válidas: ${totalPossibleRoutes}`)
    console.log(`❌ Descartadas por geografía: ${skippedByGeography}`)
    console.log(`💾 Rutas YA EXISTENTES en BD: ${existingRoutesSet.size}`)
    console.log(`🔄 Rutas válidas ya calculadas: ${alreadyCalculated}`)
    console.log(`🆕 RUTAS QUE FALTAN CALCULAR: ${needToCalculate}`)
    console.log(`📋 Rutas en respuesta: ${missingRoutes.length}`)
    console.log('==================================================') 
    
    // Verificación de consistencia
    if (needToCalculate !== missingRoutes.length) {
      console.warn('analyze-missing-optimized: INCONSISTENCY DETECTED!', {
        needToCalculate,
        missingRoutesLength: missingRoutes.length
      })
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        hospitalsAnalyzed: hospitals?.length || 0,
        kamsAnalyzed: kams?.length || 0,
        totalTheoreticalCombinations: (hospitals?.length || 0) * (kams?.length || 0),
        totalPossibleRoutes: totalPossibleRoutes,
        skippedByGeography: skippedByGeography,
        existingRoutesInDB: existingRoutesSet.size,
        alreadyCalculated: alreadyCalculated,
        needToCalculate: needToCalculate,
        affectedHospitals: [...new Set(missingRoutes.map(r => r.hospital_id))].length
      },
      missingRoutes,
      missingRoutesCount: missingRoutes.length
    })

  } catch (error) {
    return serverError('analyze-missing-optimized', error, 'Error al analizar rutas')
  }
}