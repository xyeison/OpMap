// PATCH /api/config-visitas/subtipos/[id] (visits:config) — cambia nombre, para qué, cargos sugeridos u orden de un
// subtipo institucional, o lo apaga con vigente_hasta (null lo vuelve a abrir). El código no cambia y un subtipo
// nunca se borra. 404 si no existe; 400 si vigente_hasta es anterior a su inicio. 200 { subtipo }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { subtipoUpdateSchema } from '@/lib/visits-config-schemas'
import type { Subtipo } from '@/lib/visits-rules'
import { errorVisitas, idDeRuta, respuestaErrorBase } from '../../_lib/visitas-server'

const COLUMNAS_SUBTIPO =
  'id, codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta, created_by, created_at, updated_at'

type Params = { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  const id = idDeRuta(params.id)
  if (!id) return jsonError('ID de subtipo no válido', 400)

  try {
    const parsed = subtipoUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('subtipos_institucionales')
      .select('id, vigente_desde')
      .eq('id', id)
      .limit(1)
    if (actualError) throw actualError
    const actual = actualData && actualData.length > 0 ? (actualData[0] as { id: string; vigente_desde: string }) : null
    if (!actual) return jsonError('Subtipo no encontrado', 404)
    if (datos.vigente_hasta && datos.vigente_hasta < actual.vigente_desde) {
      return jsonError(`La fecha en que se apaga no puede ser anterior a su inicio (${actual.vigente_desde})`, 400)
    }

    const cambios: Record<string, unknown> = {}
    if (datos.nombre !== undefined) cambios.nombre = datos.nombre
    if (datos.para_que !== undefined) cambios.para_que = datos.para_que
    if (datos.roles_sugeridos !== undefined) cambios.roles_sugeridos = datos.roles_sugeridos
    if (datos.orden !== undefined) cambios.orden = datos.orden
    if (datos.vigente_hasta !== undefined) cambios.vigente_hasta = datos.vigente_hasta

    const { data, error } = await supabaseAdmin
      .from('subtipos_institucionales')
      .update(cambios)
      .eq('id', id)
      .select(COLUMNAS_SUBTIPO)
    if (error) {
      const traducido = respuestaErrorBase(error, 'Los datos del subtipo no son válidos')
      if (traducido) return traducido
      throw error
    }
    const subtipo = (data || [])[0] as unknown as Subtipo | undefined
    if (!subtipo) return jsonError('Subtipo no encontrado', 404)
    return NextResponse.json({ subtipo })
  } catch (error) {
    return errorVisitas('PATCH /api/config-visitas/subtipos/[id]', error, 'Error al actualizar el subtipo')
  }
}
