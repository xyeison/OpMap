import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Params = { params: { id: string } }

// GET /api/territories/[id] — detalle de un municipio o localidad (hospitales, contratos y KAM asignado)
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'territories:view')
  if (!auth.ok) return auth.response

  const territoryId = params.id
  if (!/^(\d{5}|\d{7})$/.test(territoryId)) {
    return NextResponse.json({ error: 'Código de territorio no válido' }, { status: 400 })
  }

  try {
    const isLocality = territoryId.length > 5

    // 1. Datos del territorio
    let territory: {
      id: string
      name: string
      type: 'municipality' | 'locality'
      department_name?: string
      population?: number
      lat?: number
      lng?: number
    } | null = null

    if (!isLocality) {
      const { data: municData, error: municError } = await supabaseAdmin
        .from('municipalities')
        .select('*, departments!inner(name)')
        .eq('code', territoryId)
        .maybeSingle()
      if (municError) throw municError

      if (municData) {
        const department = Array.isArray(municData.departments) ? municData.departments[0] : municData.departments
        territory = {
          id: municData.code,
          name: municData.name,
          type: 'municipality',
          department_name: department?.name,
          population: municData.population_2025,
          lat: municData.lat,
          lng: municData.lng,
        }
      }
    } else {
      const { data: localityRows, error: localityError } = await supabaseAdmin
        .from('hospitals')
        .select('locality_id, locality_name')
        .eq('locality_id', territoryId)
        .limit(1)
      if (localityError) throw localityError

      const localityData = localityRows?.[0]
      if (localityData) {
        territory = {
          id: localityData.locality_id,
          name: localityData.locality_name,
          type: 'locality',
          department_name: 'Bogotá D.C.',
        }
      }
    }

    // 2. Hospitales del territorio
    const { data: hospitals, error: hospitalsError } = await supabaseAdmin
      .from('hospitals')
      .select('*')
      .eq(isLocality ? 'locality_id' : 'municipality_id', territoryId)
      .order('beds', { ascending: false })
    if (hospitalsError) throw hospitalsError

    const hospitalIds = (hospitals || []).map(h => h.id)

    // 3. Contratos activos
    let contracts: Record<string, unknown>[] = []
    if (hospitalIds.length > 0) {
      const { data: contractsData, error: contractsError } = await supabaseAdmin
        .from('hospital_contracts')
        .select('*, hospitals!inner(name)')
        .in('hospital_id', hospitalIds)
        .eq('active', true)
        .order('contract_value', { ascending: false })
      if (contractsError) throw contractsError

      contracts = (contractsData || []).map(c => {
        const hospital = Array.isArray(c.hospitals) ? c.hospitals[0] : c.hospitals
        return { ...c, hospital_name: hospital?.name }
      })
    }

    // 4. KAM asignado: primero la forzada activa, si no la asignación del primer hospital
    let assignment: {
      kam_id: string
      kam_name?: string
      kam_color?: string
      is_forced: boolean
      forced_reason?: string | null
    } | null = null

    const { data: forcedRows, error: forcedError } = await supabaseAdmin
      .from('forced_assignments')
      .select('kam_id, reason, kams!inner(name, color)')
      .eq('territory_id', territoryId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (forcedError) throw forcedError

    const forcedData = forcedRows?.[0]
    if (forcedData) {
      const kam = Array.isArray(forcedData.kams) ? forcedData.kams[0] : forcedData.kams
      assignment = {
        kam_id: forcedData.kam_id,
        kam_name: kam?.name,
        kam_color: kam?.color,
        is_forced: true,
        forced_reason: forcedData.reason,
      }
    } else if (hospitalIds.length > 0) {
      const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
        .from('assignments')
        .select('kam_id, kams!inner(name, color)')
        .eq('hospital_id', hospitalIds[0])
        .limit(1)
      if (assignmentError) throw assignmentError

      const assignmentData = assignmentRows?.[0]
      if (assignmentData) {
        const kam = Array.isArray(assignmentData.kams) ? assignmentData.kams[0] : assignmentData.kams
        assignment = {
          kam_id: assignmentData.kam_id,
          kam_name: kam?.name,
          kam_color: kam?.color,
          is_forced: false,
        }
      }
    }

    return NextResponse.json({
      territory,
      hospitals: hospitals || [],
      contracts,
      assignment,
    })
  } catch (error) {
    console.error('Error en GET /api/territories/[id]:', error)
    return NextResponse.json({ error: 'Error al cargar el territorio' }, { status: 500 })
  }
}
