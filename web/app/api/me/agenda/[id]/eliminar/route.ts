// POST /api/me/agenda/[id]/eliminar (visits:report + persona de campo, F1a, migración 0850) — "Eliminar: lo agendé por
// error" (C8): SU cita pendiente de hoy en adelante pasa a eliminada (la fila se queda para auditoría, con cuándo y
// quién) y ya no sale en ninguna lectura ni indicador (A7). Inexistente, ajena o ya eliminada (P0002) → 404; hecha,
// cerrada, cancelada o de un día anterior (23514) → 400. Responde 200 { cita_id }. Sin la 0850: 503.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "F4.2").
// Tiempos: Server-Timing (auth, rpc, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MENSAJE_CITA_NO_EXISTE, type CitaEliminadaResponse } from '@/lib/reporte-visitas'
import { idDeRuta, requirePersonaDeCampo } from '../../../../config-visitas/_lib/visitas-server'
import { errorReporte, respuestaErrorAgenda } from '../../../_lib/reporte-server'
import { medirRuta } from '../../../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('POST /api/me/agenda/:id/eliminar', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/agenda/[id]/eliminar'))
    if (!auth.ok) return auth.response

    const id = idDeRuta(params?.id)
    if (!id) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)

    try {
      const { error } = await t.fase('rpc', () => supabaseAdmin.rpc('agenda_eliminar', { p_id: id, p_user: auth.user.id }))
      if (error) {
        const traducido = respuestaErrorAgenda(error, 'No se pudo eliminar la cita')
        if (traducido) return traducido
        throw error
      }
      const respuesta: CitaEliminadaResponse = { cita_id: id }
      return NextResponse.json(respuesta)
    } catch (error) {
      return errorReporte('POST /api/me/agenda/[id]/eliminar', error, 'Error al eliminar la cita')
    }
  })
}
