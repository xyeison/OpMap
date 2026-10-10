import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, requireUser } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'

// Gestión de contratos de un hospital (ContractsInlineManager).
// Servidor siempre con service_role; la autorización se hace aquí por método.

function computeDurationMonths(start: unknown, end: unknown): number {
  const startDate = new Date(String(start))
  const endDate = new Date(String(end))
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
  return Math.max(1, Math.round(monthsDiff))
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const hospitalId = searchParams.get('hospital_id')

    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'hospital_id es requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (error) return serverError('contracts/manage GET', error, 'Error al cargar los contratos')

    return NextResponse.json(data || [])
  } catch (error) {
    return serverError('contracts/manage GET', error, 'Error al cargar los contratos')
  }
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const body = (await readJsonBody(request)) as Record<string, any> | undefined
    if (!body || typeof body !== 'object') return badJson()

    if (!isUuid(body.hospital_id) || !body.contract_number || !body.contract_value) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const contractData = {
      hospital_id: body.hospital_id,
      contract_number: String(body.contract_number),
      contract_type: body.contract_type || 'capita',
      contracting_model: body.contracting_model || 'contratacion_directa',
      contract_value: body.contract_value,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_months: computeDurationMonths(body.start_date, body.end_date),
      current_provider: body.provider || body.current_provider || 'Proveedor',
      provider: body.provider || null,
      proveedor_id: isUuid(body.proveedor_id) ? body.proveedor_id : null,
      description: body.description || null,
      active: body.active !== undefined ? Boolean(body.active) : true,
      created_by: auth.user.id,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin.from('hospital_contracts').insert(contractData).select()

    if (error) return serverError('contracts/manage POST', error, 'Error al crear el contrato')

    return NextResponse.json(data?.[0] || {})
  } catch (error) {
    return serverError('contracts/manage POST', error, 'Error al crear el contrato')
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const body = (await readJsonBody(request)) as Record<string, any> | undefined
    if (!body || typeof body !== 'object') return badJson()

    if (!isUuid(body.id)) {
      return NextResponse.json({ error: 'El ID del contrato es requerido' }, { status: 400 })
    }

    const updateData = {
      contract_number: body.contract_number,
      contract_type: body.contract_type,
      contracting_model: body.contracting_model || 'contratacion_directa',
      contract_value: body.contract_value,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_months: computeDurationMonths(body.start_date, body.end_date),
      provider: body.provider,
      current_provider: body.provider || body.current_provider || 'Proveedor',
      proveedor_id: isUuid(body.proveedor_id) ? body.proveedor_id : null,
      description: body.description,
      active: body.active,
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .update(updateData)
      .eq('id', body.id)
      .select()

    if (error) return serverError('contracts/manage PUT', error, 'Error al actualizar el contrato')
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    return serverError('contracts/manage PUT', error, 'Error al actualizar el contrato')
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, 'contracts:delete')
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!isUuid(id)) {
      return NextResponse.json({ error: 'El ID del contrato es requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) return serverError('contracts/manage DELETE', error, 'Error al eliminar el contrato')
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError('contracts/manage DELETE', error, 'Error al eliminar el contrato')
  }
}
