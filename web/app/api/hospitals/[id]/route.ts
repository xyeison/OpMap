import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, requireUser } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError, validationError } from '../../_lib/api-error'
import { patchHospitalSchema, updateHospitalSchema } from '../../_lib/hospital-schemas'

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

    return NextResponse.json(data)
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

    return NextResponse.json(data)
  } catch (error) {
    return serverError('hospitals/[id] PATCH', error)
  }
}
