import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, requireUser } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError, validationError } from '../../_lib/api-error'
import { patchHospitalSchema, updateHospitalSchema } from '../../_lib/hospital-schemas'
import { touchesZoneFields, type ZoneFieldValues } from '../../_lib/hospital-routes'
import {
  getHospitalPendingStatus,
  locationChangeHistoryRow,
  PENDING_ASSIGNMENT_WARNING,
} from '../../_lib/pending-assignment'

// PUT/PATCH solo guardan: NO llaman a Google ni recalculan el territorio. Si cambia la ubicación de una IPS
// activa, queda pendiente (app/api/_lib/pending-assignment.ts) hasta "Calcular rutas y asignar pendientes".

const ZONE_SELECT = 'lat, lng, department_id, municipality_id, locality_id, active'

/**
 * Tras guardar una edición: si cambió algún campo que decide la zona (coordenadas o territorio), lo
 * registra en hospital_history (action 'edited', changes.zone_fields) para que la cola de pendientes lo
 * detecte; hospitals.updated_at no sirve porque cambia con cualquier edición. `before` = null cuando no se
 * pudo leer el estado anterior (se registra igual). Nunca lanza: devuelve { pending, warnings }.
 */
async function markLocationChange(
  hospitalId: string,
  before: ZoneFieldValues | null,
  after: ZoneFieldValues & { active?: boolean | null },
  userId: string,
  context: string
): Promise<{ pending: boolean; warnings: string[] }> {
  const row = locationChangeHistoryRow({ hospitalId, userId, before, after })
  if (!row) return { pending: false, warnings: [] }

  const { error } = await supabaseAdmin.from('hospital_history').insert(row)
  if (error) console.error(`${context}: no se pudo registrar el cambio de ubicación`, error)

  if (after.active !== true) return { pending: false, warnings: [] }
  const warnings = [PENDING_ASSIGNMENT_WARNING]
  if (error) {
    warnings.push(
      "No se pudo registrar el cambio de ubicación: si la IPS no aparece en pendientes, usa 'Calcular rutas y recalcular territorio' en su ficha"
    )
  }
  return { pending: true, warnings }
}

async function readZoneFields(hospitalId: string, context: string): Promise<ZoneFieldValues | null> {
  const { data, error } = await supabaseAdmin.from('hospitals').select(ZONE_SELECT).eq('id', hospitalId).maybeSingle()
  if (error) {
    console.error(`${context}: no se pudo leer el estado anterior de la IPS`, error)
    return null
  }
  return data
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .maybeSingle()

    if (hospitalError) return serverError('hospitals/[id] GET', hospitalError)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const [municipalityRes, departmentRes, assignmentRes, contractsRes, historyRes] = await Promise.all([
      supabaseAdmin.from('municipalities').select('name').eq('code', hospital.municipality_id).maybeSingle(),
      supabaseAdmin.from('departments').select('name').eq('code', hospital.department_id).maybeSingle(),
      supabaseAdmin.from('assignments').select('kam_id').eq('hospital_id', hospitalId).maybeSingle(),
      supabaseAdmin
        .from('hospital_contracts')
        .select('contract_value')
        .eq('hospital_id', hospitalId)
        .eq('active', true),
      supabaseAdmin
        .from('hospital_history')
        .select(`
          *,
          users!hospital_history_user_id_fkey (
            full_name,
            email
          )
        `)
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false }),
    ])

    for (const res of [municipalityRes, departmentRes, assignmentRes, contractsRes, historyRes]) {
      if (res.error) console.error('hospitals/[id] GET (consulta secundaria):', res.error)
    }

    let kam = null
    let kamMunicipalityName = null

    const kamId = assignmentRes.data?.kam_id
    if (kamId) {
      const { data: kamData } = await supabaseAdmin.from('kams').select('*').eq('id', kamId).maybeSingle()
      kam = kamData

      if (kamData) {
        const { data: kamMunicipality } = await supabaseAdmin
          .from('municipalities')
          .select('name')
          .eq('code', kamData.area_id)
          .maybeSingle()
        kamMunicipalityName = kamMunicipality?.name ?? null
      }
    }

    // IPS activa con coordenadas: zonas candidatas, tiempos que faltan y si está pendiente de rutas y
    // asignación (la ficha muestra el motivo y el botón "Calcular rutas y recalcular territorio").
    let routeStatus = null
    if (hospital.active === true && hospital.lat !== null && hospital.lng !== null) {
      try {
        routeStatus = await getHospitalPendingStatus(hospitalId)
      } catch (error) {
        console.error('hospitals/[id] GET (estado de rutas):', error)
      }
    }

    const contracts = contractsRes.data || []
    const contractStats = {
      activeCount: contracts.length,
      totalValue: contracts.reduce((sum, contract) => sum + (Number(contract.contract_value) || 0), 0),
    }

    return NextResponse.json({
      hospital,
      municipalityName: municipalityRes.data?.name,
      departmentName: departmentRes.data?.name,
      kam,
      kamMunicipalityName,
      contractStats,
      history: historyRes.data || [],
      routeStatus,
    })
  } catch (error) {
    return serverError('hospitals/[id] GET', error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === undefined) return badJson()

    const parsed = updateHospitalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const updateData: Record<string, unknown> = { ...parsed.data }

    // Solo admin puede editar coordenadas
    if (auth.user.role !== 'admin') {
      delete updateData.lat
      delete updateData.lng
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    // Estado anterior solo si la edición toca campos que deciden la zona (el formulario manda lat/lng siempre)
    const zoneTouched = touchesZoneFields(updateData)
    const before = zoneTouched ? await readZoneFields(hospitalId, 'hospitals/[id] PUT') : null

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', hospitalId)
      .select()
      .maybeSingle()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un hospital con ese código' }, { status: 409 })
      }
      return serverError('hospitals/[id] PUT', error, 'Error al actualizar el hospital')
    }
    if (!data) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const marked = zoneTouched
      ? await markLocationChange(hospitalId, before, data, auth.user.id, 'hospitals/[id] PUT')
      : { pending: false, warnings: [] }

    return NextResponse.json({ ...data, pending: marked.pending, warnings: marked.warnings })
  } catch (error) {
    return serverError('hospitals/[id] PUT', error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === undefined) return badJson()

    const parsed = patchHospitalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    // Hoy patchHospitalSchema no admite campos de zona; si se añaden, el registro del cambio ya queda enganchado
    const zoneTouched = touchesZoneFields(parsed.data)
    const before = zoneTouched ? await readZoneFields(hospitalId, 'hospitals/[id] PATCH') : null

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', hospitalId)
      .select()
      .maybeSingle()

    if (error) return serverError('hospitals/[id] PATCH', error, 'Error al actualizar el hospital')
    if (!data) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    const marked = zoneTouched
      ? await markLocationChange(hospitalId, before, data, auth.user.id, 'hospitals/[id] PATCH')
      : { pending: false, warnings: [] }

    return NextResponse.json({ ...data, pending: marked.pending, warnings: marked.warnings })
  } catch (error) {
    return serverError('hospitals/[id] PATCH', error)
  }
}
