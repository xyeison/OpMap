// POST /api/me/agenda/[id]/otra-fecha (visits:report + persona de campo, F1a, migración 0850) — "Agendar otra fecha"
// (A7): una cita NUEVA con viene_de = la anterior, que debe ser suya y estar cerrada (no se hizo, cancelada no por salida,
// o hecha con una visita no efectiva) y sin otra sucesora. Copia tipo, médico o cuenta, subtipo y sede (la sede y la
// nota pueden cambiar); la fecha y la hora son nuevas. citaOtraFechaSchema { fecha, hora, sede_id?, nota?, como? } → el
// pasado y la hora que ya pasó sin ir a la base → RPC agenda_otra_fecha (pasa por todas las reglas de agenda_crear) →
// 201 { cita } con viene_de. Inexistente o ajena (P0002) → 404; sigue programada, efectiva o por salida (23514) → 400;
// ya tiene otra fecha (23505) → 409; choque de media hora (23P01) → 409 con el error en `hora`. Sin la 0850: 503.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "F4.2").
// Tiempos: Server-Timing (auth, rpc, cita, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { citaOtraFechaSchema } from '@/lib/reporte-visitas-schemas'
import { MENSAJE_CITA_NO_EXISTE, mensajeFechaCita, mensajeHoraCita, type CitaResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, idDeRuta, requirePersonaDeCampo } from '../../../../config-visitas/_lib/visitas-server'
import { cargarCitaItem, errorReporte, respuestaErrorAgenda } from '../../../_lib/reporte-server'
import { medirRuta } from '../../../_lib/tiempos'

export const dynamic = 'force-dynamic'

/** Errores de zod como lista { campo, mensaje } (la app los muestra junto a cada campo). */
function erroresDeZod(issues: readonly { path: (string | number)[]; message: string }[]) {
  return issues.map(issue => ({ campo: issue.path.length > 0 ? String(issue.path[0]) : 'cita', mensaje: issue.message }))
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return medirRuta('POST /api/me/agenda/:id/otra-fecha', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/agenda/[id]/otra-fecha'))
    if (!auth.ok) return auth.response

    const id = idDeRuta(params?.id)
    if (!id) return jsonError(MENSAJE_CITA_NO_EXISTE, 404)

    const parsed = citaOtraFechaSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400, { errores: erroresDeZod(parsed.error.issues) })
    const datos = parsed.data

    const instante = ahora()
    const hoy = hoyBogota(instante)
    const fueraDeVentana = mensajeFechaCita(datos.fecha, hoy)
    if (fueraDeVentana) return jsonError(fueraDeVentana, 400, { errores: [{ campo: 'fecha', mensaje: fueraDeVentana }] })
    const horaPasada = mensajeHoraCita(datos.fecha, datos.hora, instante)
    if (horaPasada) return jsonError(horaPasada, 400, { errores: [{ campo: 'hora', mensaje: horaPasada }] })

    try {
      // jsonb de agenda_otra_fecha: allow-list. Sin `nota` (clave ausente) la base copia la de la anterior.
      const p: Record<string, unknown> = { fecha: datos.fecha, hora: datos.hora, sede_id: datos.sede_id, como: datos.como ?? null }
      if (datos.nota !== undefined) p.nota = datos.nota
      const { data, error } = await t.fase('rpc', () => supabaseAdmin.rpc('agenda_otra_fecha', { p_id: id, p, p_user: auth.user.id }))
      if (error) {
        const traducido = respuestaErrorAgenda(error, 'No se pudo agendar la otra fecha')
        if (traducido) return traducido
        throw error
      }
      const citaId = ((data ?? {}) as { cita_id?: string }).cita_id
      if (!citaId) throw new Error('agenda_otra_fecha no devolvió la cita')
      const cita = await t.fase('cita', () => cargarCitaItem(citaId, hoy, instante))
      if (!cita) throw new Error('No se encontró la cita recién agendada')
      const respuesta: CitaResponse = { cita }
      return NextResponse.json(respuesta, { status: 201 })
    } catch (error) {
      return errorReporte('POST /api/me/agenda/[id]/otra-fecha', error, 'Error al agendar la otra fecha', [typeof datos.nota === 'string' ? datos.nota : null])
    }
  })
}
