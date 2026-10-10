import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, readJsonBody, serverError } from '../_lib/api-error'

// Estados financieros de la empresa: solo roles que gestionan contratos (igual que el menú
// "Mi Empresa", que se muestra con contracts:edit). Lectura y escritura con service_role.

function configFromBody(body: Record<string, any>) {
  return {
    nombre: body.nombre,
    nit: body.nit,
    anio_fiscal: body.anio_fiscal,
    activo_corriente: body.activo_corriente,
    activo_total: body.activo_total,
    pasivo_corriente: body.pasivo_corriente,
    pasivo_total: body.pasivo_total,
    patrimonio: body.patrimonio,
    ingresos_anuales: body.ingresos_anuales,
    utilidad_neta: body.utilidad_neta,
    gastos_intereses: body.gastos_intereses,
    utilidad_operacional: body.utilidad_operacional,
    anos_experiencia: body.anos_experiencia,
    certificaciones: body.certificaciones,
  }
}

async function insertConfig(body: Record<string, any>) {
  const { data, error } = await supabaseAdmin
    .from('mi_empresa_config')
    .insert({
      ...configFromBody(body),
      anio_fiscal: body.anio_fiscal || new Date().getFullYear(),
    })
    .select()
    .single()

  if (error) return serverError('mi-empresa insert', error, 'Error al crear configuración')
  return NextResponse.json({ data })
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from('mi_empresa_config')
      .select('*')
      .order('anio_fiscal', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return serverError('mi-empresa GET', error, 'Error al obtener configuración')

    return NextResponse.json({ data: data || null })
  } catch (error) {
    return serverError('mi-empresa GET', error)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object') return badJson()
    return await insertConfig(body as Record<string, any>)
  } catch (error) {
    return serverError('mi-empresa POST', error)
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const body = (await readJsonBody(request)) as Record<string, any> | undefined
    if (!body || typeof body !== 'object') return badJson()

    // Última configuración
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('mi_empresa_config')
      .select('id')
      .order('anio_fiscal', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) return serverError('mi-empresa PUT (lectura)', fetchError)

    // Si no existe configuración, se crea (el body ya está leído: no se vuelve a leer el stream)
    if (!existing) return await insertConfig(body)

    const { data, error } = await supabaseAdmin
      .from('mi_empresa_config')
      .update(configFromBody(body))
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return serverError('mi-empresa PUT', error, 'Error al actualizar configuración')

    // Revalidar el cumplimiento de todos los contratos
    const { error: validationError } = await supabaseAdmin.rpc('validar_todos_contratos')
    if (validationError) {
      console.error('Error revalidando contratos:', validationError)
    }

    return NextResponse.json({ data })
  } catch (error) {
    return serverError('mi-empresa PUT', error)
  }
}
