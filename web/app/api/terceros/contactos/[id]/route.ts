// PATCH /api/terceros/contactos/[id] (terceros:manage) — sede (de su misma cuenta), nombre, cargo, rol, teléfono,
// correo y activo. Cambiar el cargo no cambia el rol guardado. Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { contactoUpdateSchema } from '@/lib/terceros-schemas'
import { MENSAJE_CONTACTO_REPETIDO, MENSAJE_CONTACTO_SIN_TELEFONO_NI_CORREO, type ContactoRow } from '@/lib/terceros'
import { contactoRepetido, errorInterno, idDeRuta } from '../../_lib/terceros-server'

type Params = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:manage')
  if (!auth.ok) return auth.response

  const contactoId = idDeRuta(params.id)
  if (!contactoId) return jsonError('ID de contacto no válido', 400)

  try {
    const parsed = contactoUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('contactos')
      .select('id, cuenta_id, telefono, email')
      .eq('id', contactoId)
      .limit(1)
    if (actualError) throw actualError
    const actual =
      actualData && actualData.length > 0 ? (actualData[0] as { id: string; cuenta_id: string; telefono: string | null; email: string | null }) : null
    if (!actual) return jsonError('Contacto no encontrado', 404)

    // Sin duplicados (dueño, 2026-10-30): no puede quedar sin teléfono ni correo, ni con los de otro de la cuenta
    if (input.telefono !== undefined || input.email !== undefined) {
      const queda = {
        telefono: input.telefono !== undefined ? input.telefono : actual.telefono,
        email: input.email !== undefined ? input.email : actual.email,
      }
      if (!queda.telefono && !queda.email) return jsonError(MENSAJE_CONTACTO_SIN_TELEFONO_NI_CORREO, 400)
      const repetido = await contactoRepetido(actual.cuenta_id, queda, actual.id)
      if (repetido) return NextResponse.json({ error: MENSAJE_CONTACTO_REPETIDO, existente: repetido }, { status: 409 })
    }

    if (input.sede_id) {
      const { data: sedeData, error: sedeError } = await supabaseAdmin
        .from('sedes')
        .select('id, cuenta_id')
        .eq('id', input.sede_id)
        .limit(1)
      if (sedeError) throw sedeError
      const sede = sedeData && sedeData.length > 0 ? (sedeData[0] as { id: string; cuenta_id: string }) : null
      if (!sede || sede.cuenta_id !== actual.cuenta_id) return jsonError('La sede elegida no es de la cuenta del contacto', 400)
    }

    const cambios: Record<string, unknown> = {}
    if (input.sede_id !== undefined) cambios.sede_id = input.sede_id
    if (input.nombre !== undefined) cambios.nombre = input.nombre
    if (input.cargo_texto !== undefined) cambios.cargo_texto = input.cargo_texto
    if (input.rol !== undefined) cambios.rol = input.rol
    if (input.telefono !== undefined) cambios.telefono = input.telefono
    if (input.email !== undefined) cambios.email = input.email
    if (input.activo !== undefined) cambios.activo = input.activo

    const { data, error } = await supabaseAdmin.from('contactos').update(cambios).eq('id', contactoId).select('*')
    if (error) {
      if (error.code === '23514') return jsonError('La sede elegida no es de la cuenta del contacto o faltan datos', 400)
      throw error
    }
    if (!data || data.length === 0) return jsonError('Contacto no encontrado', 404)
    return NextResponse.json({ contacto: data[0] as ContactoRow })
  } catch (error) {
    return errorInterno('PATCH /api/terceros/contactos/[id]', error, 'Error al guardar el contacto')
  }
}
