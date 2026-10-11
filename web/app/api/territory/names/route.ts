import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { TERRITORY_UUID_RE, canManageTerritoryLine, saveTerritoryName } from '@/lib/territory'

export const dynamic = 'force-dynamic'

const idSchema = (label: string) =>
  z
    .string({ required_error: `Falta ${label}`, invalid_type_error: `${label} no válido` })
    .regex(TERRITORY_UUID_RE, `${label} no válido`)
    .transform(value => value.toLowerCase())

const nameSchema = z.object({
  line_id: idSchema('line_id'),
  executive_id: idSchema('executive_id'),
  name: z
    .string({ required_error: 'El nombre es obligatorio', invalid_type_error: 'Nombre no válido' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(120, 'El nombre no puede superar 120 caracteres'),
})

// PUT /api/territory/names { line_id, executive_id, name } — nombre comercial de la zona de un
// Ejecutivo Comercial en una línea (line_territory_names). lines:edit; line_leader solo su línea.
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, 'lines:edit')
  if (!auth.ok) return auth.response

  const body = await readJson(request)
  if (body === null) return jsonError('Cuerpo JSON no válido', 400)
  const parsed = nameSchema.safeParse(body)
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const input = parsed.data

  try {
    if (!(await canManageTerritoryLine(auth.user, input.line_id, 'lines:edit'))) {
      return jsonError('Solo puedes nombrar zonas de la línea que lideras', 403)
    }

    // El ejecutivo debe llevar la línea
    const { data: link, error: linkError } = await supabaseAdmin
      .from('executive_lines')
      .select('executive_id')
      .eq('line_id', input.line_id)
      .eq('executive_id', input.executive_id)
      .limit(1)
    if (linkError) throw linkError
    if (!link || link.length === 0) return jsonError('El Ejecutivo Comercial no lleva esta línea', 404)

    const result = await saveTerritoryName({
      lineId: input.line_id,
      executiveId: input.executive_id,
      name: input.name,
      userId: auth.user.id,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return NextResponse.json({ line_id: input.line_id, executive_id: input.executive_id, name: result.value.name })
  } catch (error) {
    console.error('Error en PUT /api/territory/names:', error)
    return jsonError('Error al guardar el nombre de la zona', 500)
  }
}
