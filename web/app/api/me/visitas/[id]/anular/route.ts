// POST /api/me/visitas/[id]/anular (visits:report + Ejecutivo Comercial enlazado) — la ejecutiva anula SU visita de
// la app el MISMO día, con motivo (5 a 300 caracteres). La fila no se borra: visitas_anular deja deleted_at,
// deleted_reason y updated_by. Dos veces → 400 "Esa visita ya está anulada"; inexistente o ajena (P0002) → 404.
// Responde 200 { ok: true, id }. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (decisión 10).
// Tiempos (spec 2026-10-15): Server-Timing (auth, rpc, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { anularSchema } from '@/lib/reporte-visitas-schemas'
import { idDeRuta, requireEjecutiva } from '../../../../config-visitas/_lib/visitas-server'
import { errorReporte, respuestaErrorVisita } from '../../../_lib/reporte-server'
import { medirRuta } from '../../../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('POST /api/me/visitas/:id/anular', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'POST /api/me/visitas/[id]/anular'))
    if (!auth.ok) return auth.response

    const id = idDeRuta(params?.id)
    if (!id) return jsonError('Esa visita no existe', 404)

    const parsed = anularSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    try {
      // La ejecutiva la saca la base de p_user (executives.user_id), como personaDelUsuario.
      const { error } = await t.fase('rpc', () => supabaseAdmin.rpc('visitas_anular', { p_id: id, p_motivo: parsed.data.motivo, p_user: auth.user.id }))
      if (error) {
        const traducido = respuestaErrorVisita(error, 'No se pudo anular la visita')
        if (traducido) return traducido
        throw error
      }
      return NextResponse.json({ ok: true, id })
    } catch (error) {
      return errorReporte('POST /api/me/visitas/[id]/anular', error, 'Error al anular la visita', [parsed.data.motivo])
    }
  })
}
