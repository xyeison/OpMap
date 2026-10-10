import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../../_lib/api-error'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .select(`
        indice_liquidez_requerido,
        indice_endeudamiento_maximo,
        cobertura_intereses_minimo,
        patrimonio_minimo,
        capital_trabajo_minimo,
        experiencia_anos_minimo,
        facturacion_anual_minima,
        rentabilidad_minima,
        otros_requisitos,
        requisitos_financieros
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (error) return serverError('contracts/[id]/requirements GET', error, 'Error al obtener requisitos')
    if (!data) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return serverError('contracts/[id]/requirements GET', error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    const body = (await readJsonBody(request)) as Record<string, any> | undefined
    if (!body || typeof body !== 'object') return badJson()

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .update({
        indice_liquidez_requerido: body.indice_liquidez_requerido,
        indice_endeudamiento_maximo: body.indice_endeudamiento_maximo,
        cobertura_intereses_minimo: body.cobertura_intereses_minimo,
        patrimonio_minimo: body.patrimonio_minimo,
        capital_trabajo_minimo: body.capital_trabajo_minimo,
        experiencia_anos_minimo: body.experiencia_anos_minimo,
        facturacion_anual_minima: body.facturacion_anual_minima,
        rentabilidad_minima: body.rentabilidad_minima,
        otros_requisitos: body.otros_requisitos,
        fecha_validacion_requisitos: null, // Reiniciar la validación al cambiar requisitos
        cumple_requisitos: null,
      })
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) return serverError('contracts/[id]/requirements PUT', error, 'Error al actualizar requisitos')
    if (!data) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    // Disparar la validación de cumplimiento
    const { data: validationResult, error: validationError } = await supabaseAdmin.rpc(
      'validar_cumplimiento_contrato',
      { p_contract_id: params.id }
    )

    if (validationError) {
      console.error('Error validando cumplimiento:', validationError)
    }

    return NextResponse.json({ data, validation: validationResult ?? null })
  } catch (error) {
    return serverError('contracts/[id]/requirements PUT', error)
  }
}
