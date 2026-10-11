import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { hasPermission } from '@/lib/permissions'
import { LINE_CODE_RE, findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import type { CoverageExecutiveRef, CoverageLineInfo } from '@/lib/types/coverage'
import { computeTerritoryWinners, territoryIdOf } from '@/lib/territory-rules'
import { zoneDisplayName } from '@/lib/zone-names'

// Columnas de hospital que realmente usa el mapa (marcadores, tooltips, filtros y búsqueda).
// Se evita hospitals(*) para no enviar al navegador dirección, teléfono, email, servicios, etc.
const HOSPITAL_COLUMNS =
  'id, code, name, department_id, municipality_id, locality_id, lat, lng, beds, service_level, ' +
  'surgeries, ambulances, municipality_name, department_name, locality_name, type, doctors'

const KAM_COLUMNS = 'id, name, area_id, lat, lng, color, zone_id'
// base_city llega con la migración de la Fase 2; mientras no exista se usa KAM_COLUMNS
const KAM_COLUMNS_WITH_CITY = `${KAM_COLUMNS}, base_city`

// Ejecutivo Comercial que vive en una zona (base_kam_id). Solo activos o por contratar.
interface MapZoneExecutive {
  id: string
  full_name: string
  status: 'active' | 'placeholder'
}

// PostgREST corta en 1.000 filas por petición: se pagina con .range() hasta agotar la tabla
// (municipalities tiene más de 1.000 filas).
const PAGE_SIZE = 1000

async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<{ data: T[]; error: any }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}

// Columna inexistente (migración aún no aplicada): PostgreSQL 42703. Se reintenta con columnas antiguas.
const isUndefinedColumn = (error: any) => error?.code === '42703' || /does not exist/i.test(error?.message || '')

async function selectWithFallback<T>(
  run: (columns: string) => PromiseLike<{ data: T | null; error: any }>,
  columns: string,
  legacyColumns: string
): Promise<{ data: T | null; error: any }> {
  const result = await run(columns)
  if (result.error && isUndefinedColumn(result.error)) return run(legacyColumns)
  return result
}

/**
 * Cobertura de la línea elegida, con la MISMA forma que GET /api/coverage (lib/coverage.ts:
 * filas guardadas o, si la línea aún no se ha recalculado nunca, calculadas en memoria), más los
 * Ejecutivos Comerciales de la línea (activos o por contratar) con su color, para la leyenda.
 */
async function loadLineCoverage(line: CoverageLineInfo) {
  const [coverage, linksResult] = await Promise.all([
    loadCoverageResponse(line),
    supabaseAdmin.from('executive_lines').select('executive_id').eq('line_id', line.id),
  ])
  if (linksResult.error) throw linksResult.error

  // Leyenda: quienes llevan la línea y quien cubra alguna zona (p. ej. por ajuste manual)
  const legendIds = new Set<string>((linksResult.data || []).map((l: any) => l.executive_id as string))
  coverage.rows.forEach(r => {
    if (r.executive) legendIds.add(r.executive.id)
  })

  let executives: CoverageExecutiveRef[] = []
  if (legendIds.size > 0) {
    const { data, error } = await supabaseAdmin
      .from('executives')
      .select('id, full_name, status, color')
      .in('id', Array.from(legendIds))
      .in('status', ['active', 'placeholder'])
    if (error) throw error
    executives = ((data || []) as any[])
      .map(e => ({
        id: e.id as string,
        full_name: e.full_name as string,
        status: e.status as CoverageExecutiveRef['status'],
        color: typeof e.color === 'string' ? e.color : null,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  }

  return { coverage: { line: coverage.line, rows: coverage.rows }, executives }
}

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación (sesión de usuario activo)
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    const supabase = supabaseAdmin

    // Acceso por línea: con ?line=<code> la línea debe estar entre las del usuario;
    // sin ?line (vista por zonas) solo quien ve todas las líneas.
    // Misma regla que GET /api/me/lines (lib/coverage.ts: resolveUserLines / findAccessibleLine).
    const lineCode = (request.nextUrl.searchParams.get('line') || '').trim().toLowerCase()
    let selectedLine: CoverageLineInfo | null = null
    if (lineCode) {
      if (!LINE_CODE_RE.test(lineCode)) {
        return NextResponse.json({ error: 'Código de línea no válido' }, { status: 400 })
      }
      const access = await findAccessibleLine(auth.user, lineCode)
      if (!access) {
        return NextResponse.json({ error: 'No tienes acceso a esta línea' }, { status: 403 })
      }
      selectedLine = access.line
    } else if (!hasPermission(auth.user.role, 'map:all-lines')) {
      return NextResponse.json({ error: 'Debes elegir una línea de negocio' }, { status: 403 })
    }

    // Cargar todos los datos necesarios para el mapa
    const [kamsResult, assignmentsResult, municipalitiesResult, hospitalsResult, contractsResult, executivesResult] = await Promise.all([
      selectWithFallback<any[]>(
        cols => supabase.from('kams')
          .select(cols)
          .eq('active', true)
          .eq('participates_in_assignment', true),  // Solo zonas con territorio
        KAM_COLUMNS_WITH_CITY,
        KAM_COLUMNS
      ),
      fetchAllRows<any>((from, to) =>
        supabase.from('assignments')
          .select(`id, kam_id, hospital_id, travel_time, assignment_type, is_base_territory, hospitals!inner(${HOSPITAL_COLUMNS}), kams!inner(id, name, color)`)
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<any>((from, to) =>
        supabase.from('municipalities')
          .select('code, name, population_2025')
          .order('code')
          .range(from, to)
      ),
      fetchAllRows<any>((from, to) =>
        supabase.from('hospitals')
          .select(HOSPITAL_COLUMNS)
          .eq('active', true)
          .order('id')
          .range(from, to)
      ),
      supabase.from('hospital_contracts').select('hospital_id, contract_value, provider').eq('active', true),
      // Una sola consulta de ejecutivos; se agrupan por zona en memoria (sin N+1)
      supabase.from('executives')
        .select('id, full_name, status, base_kam_id')
        .in('status', ['active', 'placeholder'])
        .not('base_kam_id', 'is', null)
        .order('full_name')
    ])

    // Si cualquier consulta falla, responder 500 genérico (el detalle solo va al log del servidor)
    const failed = [
      ['kams', kamsResult.error],
      ['assignments', assignmentsResult.error],
      ['municipalities', municipalitiesResult.error],
      ['hospitals', hospitalsResult.error],
      ['hospital_contracts', contractsResult.error],
      ['executives', executivesResult.error],
    ].filter(([, error]) => error)
    if (failed.length > 0) {
      failed.forEach(([table, error]) => console.error(`Error consultando ${table} en /api/map/data:`, error))
      return NextResponse.json(
        { error: 'No se pudieron cargar los datos del mapa' },
        { status: 500 }
      )
    }

    // Agrupar ejecutivos por zona (base_kam_id)
    const executivesByZone: Record<string, MapZoneExecutive[]> = {}
    ;(executivesResult.data || []).forEach((e: any) => {
      if (!e.base_kam_id) return
      ;(executivesByZone[e.base_kam_id] ||= []).push({
        id: e.id,
        full_name: e.full_name,
        status: e.status,
      })
    })

    const kamsFiltered = (kamsResult.data || []).map((kam: any) => ({
      ...kam,
      executives: executivesByZone[kam.id] || [],
    }))

    console.log('Map data loaded:', {
      kams: kamsFiltered.length,
      assignments: assignmentsResult.data?.length || 0,
      hospitals: hospitalsResult.data?.length || 0,
      contracts: contractsResult.data?.length || 0
    })

    // Crear mapas de población y nombres por municipio
    const populationMap: Record<string, number> = {}
    const municipalityNames: Record<string, string> = {}
    municipalitiesResult.data.forEach((m: any) => {
      populationMap[m.code] = m.population_2025 || 0
      municipalityNames[m.code] = m.name
    })

    // Crear mapa de valores de contratos activos y proveedores por hospital
    const contractValuesByHospital: Record<string, number> = {}
    const contractProvidersByHospital: Record<string, string[]> = {}
    
    contractsResult.data?.forEach(contract => {
      if (!contractValuesByHospital[contract.hospital_id]) {
        contractValuesByHospital[contract.hospital_id] = 0
        contractProvidersByHospital[contract.hospital_id] = []
      }
      contractValuesByHospital[contract.hospital_id] += Number(contract.contract_value) || 0
      
      // Agregar proveedor si existe y no está duplicado
      if (contract.provider && !contractProvidersByHospital[contract.hospital_id].includes(contract.provider)) {
        contractProvidersByHospital[contract.hospital_id].push(contract.provider)
      }
    })

    // Identificar hospitales sin asignar (zonas vacantes)
    const assignedHospitalIds = new Set(assignmentsResult.data?.map(a => a.hospitals.id) || [])
    const unassignedHospitals = hospitalsResult.data?.filter(h => !assignedHospitalIds.has(h.id)) || []

    // Calcular estadísticas por territorio
    const territoryStats: Record<string, any> = {}
    
    // Estadísticas de hospitales asignados
    assignmentsResult.data?.forEach(assignment => {
      const territoryId = assignment.hospitals.locality_id || assignment.hospitals.municipality_id
      if (!territoryId) return
      
      if (!territoryStats[territoryId]) {
        territoryStats[territoryId] = {
          totalHospitals: 0,
          totalBeds: 0,
          totalAmbulances: 0,
          totalSurgeries: 0,
          totalContracts: 0,
          contractValue: 0,
          providers: new Set(),
          kamId: assignment.kams.id,
          kamName: assignment.kams.name
        }
      }
      
      territoryStats[territoryId].totalHospitals++
      territoryStats[territoryId].totalBeds += assignment.hospitals.beds || 0
      territoryStats[territoryId].totalAmbulances += assignment.hospitals.ambulances || 0
      territoryStats[territoryId].totalSurgeries += assignment.hospitals.surgeries || 0
      
      // Agregar información de contratos
      if (contractValuesByHospital[assignment.hospitals.id]) {
        territoryStats[territoryId].totalContracts++
        territoryStats[territoryId].contractValue += contractValuesByHospital[assignment.hospitals.id]
      }
      if (contractProvidersByHospital[assignment.hospitals.id]) {
        contractProvidersByHospital[assignment.hospitals.id].forEach(provider => {
          territoryStats[territoryId].providers.add(provider)
        })
      }
    })
    
    // Estadísticas de hospitales sin asignar
    unassignedHospitals.forEach(hospital => {
      const territoryId = hospital.locality_id || hospital.municipality_id
      if (!territoryId) return
      
      if (!territoryStats[territoryId]) {
        territoryStats[territoryId] = {
          totalHospitals: 0,
          totalBeds: 0,
          totalAmbulances: 0,
          totalSurgeries: 0,
          totalContracts: 0,
          contractValue: 0,
          providers: new Set(),
          kamId: null,
          kamName: 'Sin asignar'
        }
      }
      
      territoryStats[territoryId].totalHospitals++
      territoryStats[territoryId].totalBeds += hospital.beds || 0
      territoryStats[territoryId].totalAmbulances += hospital.ambulances || 0
      territoryStats[territoryId].totalSurgeries += hospital.surgeries || 0
      
      // Agregar información de contratos
      if (contractValuesByHospital[hospital.id]) {
        territoryStats[territoryId].totalContracts++
        territoryStats[territoryId].contractValue += contractValuesByHospital[hospital.id]
      }
      if (contractProvidersByHospital[hospital.id]) {
        contractProvidersByHospital[hospital.id].forEach(provider => {
          territoryStats[territoryId].providers.add(provider)
        })
      }
    })
    
    // Zona del territorio (kamId/kamName) por la regla de mayoría compartida (lib/territory-rules.ts:
    // camas, desempate determinista). Es la MISMA función que usan el mapa al colorear, el motor de
    // municipios (municipality_zone 'ips') y el anexo de territorio; antes aquí quedaba la primera
    // asignación que llegara.
    const zoneNameById: Record<string, string> = {}
    ;(assignmentsResult.data || []).forEach((a: any) => {
      if (a.kams?.id && !zoneNameById[a.kams.id]) zoneNameById[a.kams.id] = zoneDisplayName(a.kams.name)
    })
    const winners = computeTerritoryWinners(
      (assignmentsResult.data || [])
        .filter((a: any) => a.kams?.id && a.hospitals)
        .map((a: any) => ({ kam_id: a.kams.id as string, beds: a.hospitals.beds ?? null, territory: territoryIdOf(a.hospitals) })),
      item => item.territory,
      kamId => zoneNameById[kamId] ?? null
    )
    const kamNameById: Record<string, string> = {}
    ;(assignmentsResult.data || []).forEach((a: any) => {
      if (a.kams?.id) kamNameById[a.kams.id] = a.kams.name
    })
    winners.forEach((winner, territoryId) => {
      if (!territoryStats[territoryId]) return
      territoryStats[territoryId].kamId = winner.kam_id
      territoryStats[territoryId].kamName = kamNameById[winner.kam_id] ?? territoryStats[territoryId].kamName
    })

    // Convertir Sets a arrays
    Object.keys(territoryStats).forEach(key => {
      territoryStats[key].providers = Array.from(territoryStats[key].providers)
    })

    // Cobertura de la línea elegida (filas ya guardadas por el motor)
    const lineData = selectedLine ? await loadLineCoverage(selectedLine) : null

    return NextResponse.json({
      ...(lineData ? { coverage: lineData.coverage, executives: lineData.executives } : {}),
      kams: kamsFiltered,
      assignments: assignmentsResult.data || [],
      hospitals: hospitalsResult.data || [],
      unassignedHospitals,
      populationMap,
      municipalityNames,
      contractValuesByHospital,
      contractProvidersByHospital,
      territoryStats
    })
  } catch (error) {
    console.error('Error in GET /api/map/data:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}