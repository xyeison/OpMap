// POST /api/terceros/contactos (terceros:create) — persona de una cuenta, con su sede opcional (de la misma cuenta).
// Sin rol, se toma el que sugiere el cargo (rolDesdeCargo, en contactoCreateSchema). Contrato:
// docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { contactoCreateSchema } from '@/lib/terceros-schemas'
import type { ContactoRow } from '@/lib/terceros'
import { errorInterno } from '../_lib/terceros-server'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response

  try {
    const parsed = contactoCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: cuentaData, error: cuentaError } = await supabaseAdmin
      .from('cuentas')
      .select('id, activo')
      .eq('id', input.cuenta_id)
      .limit(1)
    if (cuentaError) throw cuentaError
    const cuenta = cuentaData && cuentaData.length > 0 ? (cuentaData[0] as { id: string; activo: boolean }) : null
    if (!cuenta) return jsonError('La cuenta elegida no existe', 400)

    if (input.sede_id) {
      const { data: sedeData, error: sedeError } = await supabaseAdmin
        .from('sedes')
        .select('id, cuenta_id')
        .eq('id', input.sede_id)
        .limit(1)
      if (sedeError) throw sedeError
      const sede = sedeData && sedeData.length > 0 ? (sedeData[0] as { id: string; cuenta_id: string }) : null
      if (!sede || sede.cuenta_id !== input.cuenta_id) return jsonError('La sede elegida no es de esa cuenta', 400)
    }

    const { data, error } = await supabaseAdmin
      .from('contactos')
      .insert({
        cuenta_id: input.cuenta_id,
        sede_id: input.sede_id ?? null,
        nombre: input.nombre,
        cargo_texto: input.cargo_texto ?? null,
        rol: input.rol,
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        created_by: auth.user.id,
      })
      .select('*')
    if (error) {
      if (error.code === '23514') return jsonError('La sede elegida no es de esa cuenta o faltan datos del contacto', 400)
      if (error.code === '23503') return jsonError('La cuenta o la sede elegidas no existen', 400)
      throw error
    }
    const contacto = (data || [])[0] as ContactoRow | undefined
    if (!contacto) return jsonError('No se pudo crear el contacto', 500)
    return NextResponse.json({ id: contacto.id, contacto }, { status: 201 })
  } catch (error) {
    return errorInterno('POST /api/terceros/contactos', error, 'Error al crear el contacto')
  }
}
