// POST /api/me/agenda/[id]/cancelar (visits:report + Ejecutivo Comercial enlazado) — la persona cancela SU cita pendiente
// de hoy o futura, con motivo opcional (hasta 300 caracteres). La fila no se borra: agenda_cancelar deja estado
// cancelada, cancelada_at y el motivo. Inexistente o ajena (P0002) → 404; ya cancelada, hecha o de ayer (23514) → 400.
// Responde 200 { cita }. Sin la 0840 aplicada: 503. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md
// (sección "F4.1").
// Tiempos (spec 2026-10-15): Server-Timing (auth, rpc, cita, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { citaCancelarSchema } from '@/lib/reporte-visitas-schemas'
import { MENSAJE_CITA_NO_EXISTE, type CitaResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, idDeRuta, requireEjecutiva } from '../../../../config-visitas/_lib/visitas-server'
import { cargarCitaItem, errorReporte, respuestaErrorAgenda } from '../../../_lib/reporte-server'
import { medirRuta } from '../../../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('POST /api/me/agenda/:id/cancelar', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'POST /api/me/agenda/[id]/cancelar'))
    if (!auth.ok) return auth.response

    const id = idDeRuta(params?.id)
    if (!id) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)

    // Cuerpo vacío = sin motivo.
    const parsed = citaCancelarSchema.safeParse((await readJson(request)) ?? {})
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    try {
      const { error } = await t.fase('rpc', () => supabaseAdmin.rpc('agenda_cancelar', { p_id: id, p_motivo: parsed.data.motivo, p_user: auth.user.id }))
      if (error) {
        const traducido = respuestaErrorAgenda(error, 'No se pudo cancelar la cita')
        if (traducido) return traducido
        throw error
      }
      const cita = await t.fase('cita', () => cargarCitaItem(id, hoyBogota(ahora())))
      if (!cita) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)
      const respuesta: CitaResponse = { cita }
      return NextResponse.json(respuesta)
    } catch (error) {
      return errorReporte('POST /api/me/agenda/[id]/cancelar', error, 'Error al cancelar la cita', [parsed.data.motivo])
    }
  })
}
