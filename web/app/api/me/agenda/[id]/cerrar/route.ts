// POST /api/me/agenda/[id]/cerrar (visits:report + persona de campo, F1a, migración 0850) — "No se hizo" (A7, C7): la
// persona cierra SU cita pendiente de su día o anterior con un motivo de la lista (citaCerrarSchema: motivo_codigo sin
// 'salida' y, con 'otro', el texto de 3 a 300). No se mueve de fecha: si hace falta otra, se pide con otra-fecha. La fila
// no se borra (estado no_realizada, no_realizada_at y el motivo). Inexistente o ajena (P0002) → 404; ya cerrada o
// futura ("Esa cita todavía no llega: cancélala") (23514) → 400. Responde 200 { cita }. Sin la 0850: 503.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "F4.2").
// Tiempos: Server-Timing (auth, rpc, cita, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { citaCerrarSchema } from '@/lib/reporte-visitas-schemas'
import { MENSAJE_CITA_NO_EXISTE, type CitaResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, idDeRuta, requirePersonaDeCampo } from '../../../../config-visitas/_lib/visitas-server'
import { cargarCitaItem, errorReporte, respuestaErrorAgenda } from '../../../_lib/reporte-server'
import { medirRuta } from '../../../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('POST /api/me/agenda/:id/cerrar', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/agenda/[id]/cerrar'))
    if (!auth.ok) return auth.response

    const id = idDeRuta(params?.id)
    if (!id) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)

    const parsed = citaCerrarSchema.safeParse((await readJson(request)) ?? {})
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    try {
      const { error } = await t.fase('rpc', () =>
        supabaseAdmin.rpc('agenda_cerrar', {
          p_id: id,
          p: { motivo_codigo: parsed.data.motivo_codigo, motivo: parsed.data.motivo },
          p_user: auth.user.id,
        })
      )
      if (error) {
        const traducido = respuestaErrorAgenda(error, 'No se pudo cerrar la cita')
        if (traducido) return traducido
        throw error
      }
      const instante = ahora()
      const cita = await t.fase('cita', () => cargarCitaItem(id, hoyBogota(instante), instante))
      if (!cita) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)
      const respuesta: CitaResponse = { cita }
      return NextResponse.json(respuesta)
    } catch (error) {
      return errorReporte('POST /api/me/agenda/[id]/cerrar', error, 'Error al cerrar la cita', [parsed.data.motivo])
    }
  })
}
