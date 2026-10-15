// PATCH /api/me/visitas/[id] (visits:report + Ejecutivo Comercial enlazado) — la ejecutiva corrige SU visita de la
// app el MISMO día: conclusión, compromisos, próxima reunión, si fue efectiva (con su motivo), fecha de reintento y
// líneas (decisión 10). No cambia tipo, médico, cuenta ni sede: para eso anula y vuelve a reportar. Todo pasa por la
// RPC visitas_editar (al volver a efectiva revalida los topes): 23514 → 400 con el mensaje de la base; inexistente o
// ajena (P0002) → 404. Responde { visita }.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "API").
// Tiempos (spec 2026-10-15): Server-Timing (auth, rpc, leer, total) y la línea [tiempos] sin contenido (_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { visitaUpdateSchema } from '@/lib/reporte-visitas-schemas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, idDeRuta, requireEjecutiva } from '../../../config-visitas/_lib/visitas-server'
import { cargarVisitaItem, errorReporte, respuestaErrorVisita } from '../../_lib/reporte-server'
import { medirRuta } from '../../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('PATCH /api/me/visitas/:id', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'PATCH /api/me/visitas/[id]'))
    if (!auth.ok) return auth.response
    const { user, persona } = auth

    const id = idDeRuta(params?.id)
    if (!id) return jsonError('Esa visita no existe', 404)

    const parsed = visitaUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    try {
      // jsonb de visitas_editar: solo las claves que cambian (allow-list del esquema) y la ejecutiva de la sesión.
      const p: Record<string, unknown> = { ...parsed.data, executive_id: persona.id }
      const { error } = await t.fase('rpc', () => supabaseAdmin.rpc('visitas_editar', { p_id: id, p, p_user: user.id }))
      if (error) {
        const traducido = respuestaErrorVisita(error, 'Los datos de la corrección no son válidos')
        if (traducido) return traducido
        throw error
      }
      const visita = await t.fase('leer', () => cargarVisitaItem(id, { persona, hoy: hoyBogota(ahora()) }))
      if (!visita) return jsonError('Esa visita no existe', 404)
      return NextResponse.json({ visita })
    } catch (error) {
      const { conclusion, compromisos, failure_reason } = parsed.data
      return errorReporte('PATCH /api/me/visitas/[id]', error, 'Error al corregir la visita', [conclusion, compromisos, failure_reason])
    }
  })
}
