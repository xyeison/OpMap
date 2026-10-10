import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import {
  escapeLike,
  pickAllowed,
  PROVIDER_STATES,
  PROVIDER_UPDATE_COLUMNS,
} from '../../_lib/allow-list'

// GET /api/providers/[id] - Obtener un proveedor específico
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'providers:view')
  if (!auth.ok) return auth.response

  try {
    const { id } = params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('proveedores')
      .select(`
        *,
        finanzas:proveedor_finanzas(*),
        indicadores:proveedor_indicadores(*),
        contactos:proveedor_contactos(*),
        enlaces:proveedor_enlaces(*),
        contratos:hospital_contracts(
          *,
          hospital:hospitals(
            id,
            name,
            municipality_name,
            department_name
          )
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) return serverError('providers/[id] GET', error, 'Error al obtener proveedor')
    if (!data) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    // Ordenar finanzas e indicadores por año
    if (data.finanzas) data.finanzas.sort((a: any, b: any) => b.anio - a.anio)
    if (data.indicadores) data.indicadores.sort((a: any, b: any) => b.anio - a.anio)

    return NextResponse.json({ data, success: true })
  } catch (error) {
    return serverError('providers/[id] GET', error)
  }
}

// PUT /api/providers/[id] - Actualizar un proveedor
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'providers:edit')
  if (!auth.ok) return auth.response

  try {
    const { id } = params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const rawBody = await readJsonBody(request)
    if (!rawBody || typeof rawBody !== 'object') return badJson()

    // Allow-list de columnas (nunca el body entero)
    const body = pickAllowed(rawBody as Record<string, unknown>, PROVIDER_UPDATE_COLUMNS) as Record<string, any>
    if (body.estado !== undefined && !(PROVIDER_STATES as readonly string[]).includes(body.estado)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('proveedores')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (existingError) return serverError('providers/[id] PUT (lectura)', existingError)
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    // Si se actualiza el NIT, verificar que no exista otro con el mismo
    if (body.nit) {
      const { data: duplicateNit, error: duplicateError } = await supabaseAdmin
        .from('proveedores')
        .select('id')
        .eq('nit', body.nit)
        .neq('id', id)
        .limit(1)
        .maybeSingle()

      if (duplicateError) return serverError('providers/[id] PUT (nit)', duplicateError)
      if (duplicateNit) {
        return NextResponse.json({ error: 'Ya existe otro proveedor con ese NIT' }, { status: 409 })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('proveedores')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return serverError('providers/[id] PUT', error, 'Error al actualizar proveedor')

    return NextResponse.json({ data, success: true, message: 'Proveedor actualizado exitosamente' })
  } catch (error) {
    return serverError('providers/[id] PUT', error)
  }
}

// DELETE /api/providers/[id] - Baja lógica: estado = 'inactivo' (no se borra la ficha).
// Se mantiene la guarda de contratos: por proveedor_id o por nombre en current_provider.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'providers:edit')
  if (!auth.ok) return auth.response

  try {
    const { id } = params
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const { data: provider, error: providerError } = await supabaseAdmin
      .from('proveedores')
      .select('id, nombre, estado')
      .eq('id', id)
      .maybeSingle()

    if (providerError) return serverError('providers/[id] DELETE (lectura)', providerError)
    if (!provider) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    // Contratos enlazados por FK o citados por nombre (44 contratos tienen proveedor_id NULL)
    const [byId, byName] = await Promise.all([
      supabaseAdmin.from('hospital_contracts').select('id').eq('proveedor_id', id).limit(1),
      provider.nombre
        ? supabaseAdmin
            .from('hospital_contracts')
            .select('id')
            .ilike('current_provider', escapeLike(String(provider.nombre).trim()))
            .limit(1)
        : Promise.resolve({ data: [] as { id: string }[], error: null }),
    ])

    if (byId.error) return serverError('providers/[id] DELETE (contratos por id)', byId.error)
    if (byName.error) return serverError('providers/[id] DELETE (contratos por nombre)', byName.error)

    if ((byId.data && byId.data.length > 0) || (byName.data && byName.data.length > 0)) {
      return NextResponse.json(
        {
          error: 'No se puede dar de baja el proveedor porque tiene contratos asociados',
          suggestion: 'Reasigne o cierre los contratos antes de darlo de baja',
        },
        { status: 409 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('proveedores')
      .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) return serverError('providers/[id] DELETE (baja)', updateError, 'Error al dar de baja el proveedor')

    console.info(`[providers] baja lógica proveedor=${id} usuario=${auth.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Proveedor marcado como inactivo',
    })
  } catch (error) {
    return serverError('providers/[id] DELETE', error)
  }
}
