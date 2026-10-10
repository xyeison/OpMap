import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import { CONTRACT_EDITABLE_COLUMNS, pickAllowed } from '../../_lib/allow-list'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const { data: contract, error } = await supabaseAdmin
      .from('hospital_contracts')
      .select(`
        *,
        hospital:hospitals(
          id,
          name,
          municipality_name,
          department_name
        )
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (error) return serverError('contracts/[id] GET', error, 'Error al obtener contrato')
    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json(contract)
  } catch (error) {
    return serverError('contracts/[id] GET', error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:delete')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .delete()
      .eq('id', params.id)
      .select('id')

    if (error) return serverError('contracts/[id] DELETE', error, 'Error al eliminar el contrato')
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Contrato eliminado exitosamente' })
  } catch (error) {
    return serverError('contracts/[id] DELETE', error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object') return badJson()

    // Solo columnas reales y editables de hospital_contracts (sin id, created_by, created_at...)
    const contractData = pickAllowed(body as Record<string, unknown>, CONTRACT_EDITABLE_COLUMNS)
    if ('proveedor_id' in contractData) {
      contractData.proveedor_id = isUuid(contractData.proveedor_id) ? contractData.proveedor_id : null
    }
    if (Object.keys(contractData).length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .update({ ...contractData, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) return serverError('contracts/[id] PUT', error, 'Error al actualizar el contrato')
    if (!data) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return serverError('contracts/[id] PUT', error)
  }
}
