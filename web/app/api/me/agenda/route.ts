// /api/me/agenda (visits:report + persona de campo, F1a) — la agenda propia (F4.1, 0840; desde la 0850 de la PERSONA:
// una sola agenda aunque tenga los dos papeles).
//   GET ?desde=&hasta=&canceladas= — sus citas (sin fechas: de hoy a hoy + 7; como mucho 31 días), por fecha y hora, con
//       el médico o la cuenta y el subtipo, la sede (con coordenadas y si está confirmada), si es anticipada (cuenta como
//       agendada), si la puede cancelar y (0850, aditivo) el motivo, "no se hizo", viene_de, su sucesora, como qué y el
//       estado visible. Nunca las eliminadas por error; sin canceladas=true, solo las pendientes y las hechas (con él,
//       también las canceladas y las que no se hicieron). → AgendaResponse (max_fecha null: sin tope hacia adelante).
//   POST — agenda UNA cita: citaCreateSchema (hora obligatoria; `como` opcional) → el pasado y la hora que ya pasó
//       (mensajeFechaCita, mensajeHoraCita: 400 sin ir a la base) → RPC agenda_crear (la base es la última palabra: día
//       libre, perfil, médico en la sede y, como líder, de sus líneas, cuenta, subtipo; 23514 → 400, 23505 repetida →
//       409, 23P01 choque de media hora → 409 con el error en `hora`) → 201 { cita }. Sin tope hacia adelante (A4).
//   Sin la 0850 aplicada: 503 con MENSAJE_FALTA_MIGRACION_0850.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "F4.1" y "F4.2"). Spec:
// docs/specs/2026-10-15-actividades-de-campo.md (A4, A7, C12, C13).
// Tiempos (spec 2026-10-15): Server-Timing (auth, citas o rpc y cita, total) y la línea [tiempos] sin contenido
// (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { agendaQuerySchema, citaCreateSchema } from '@/lib/reporte-visitas-schemas'
import { mensajeFechaCita, mensajeHoraCita, rangoConsultaAgenda, type AgendaResponse, type CitaResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, requirePersonaDeCampo } from '../../config-visitas/_lib/visitas-server'
import { armarCitaItems, cargarCitaItem, errorReporte, jsonbCita, leerCitas, respuestaErrorAgenda } from '../_lib/reporte-server'
import { medirRuta } from '../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/agenda', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'GET /api/me/agenda'))
    if (!auth.ok) return auth.response

    const params = request.nextUrl.searchParams
    const consulta = agendaQuerySchema.safeParse({ desde: params.get('desde'), hasta: params.get('hasta'), canceladas: params.get('canceladas') })
    if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)

    const instante = ahora()
    const hoy = hoyBogota(instante)
    const rango = rangoConsultaAgenda(consulta.data, hoy)
    if (rango.error !== null) return jsonError(rango.error, 400)

    try {
      const items = await t.fase('citas', async () => {
        const filas = await leerCitas(auth.persona.userId, rango.desde, rango.hasta, { conCanceladas: consulta.data.canceladas })
        return armarCitaItems(filas, { hoy, ahora: instante })
      })
      const respuesta: AgendaResponse = { desde: rango.desde, hasta: rango.hasta, hoy, max_fecha: null, items }
      return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorReporte('GET /api/me/agenda', error, 'Error al cargar tu agenda')
    }
  })
}

/** Errores de zod como lista { campo, mensaje } (la app los muestra junto a cada campo). */
function erroresDeZod(issues: readonly { path: (string | number)[]; message: string }[]) {
  return issues.map(issue => ({ campo: issue.path.length > 0 ? String(issue.path[0]) : 'cita', mensaje: issue.message }))
}

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/agenda', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/agenda'))
    if (!auth.ok) return auth.response

    const parsed = citaCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400, { errores: erroresDeZod(parsed.error.issues) })
    const datos = parsed.data
    // "Como qué" (C12): el que llegó, o null y decide la base (Paola, con los dos papeles, lo elige en la app).
    const como = datos.como ?? null

    const instante = ahora()
    const hoy = hoyBogota(instante)
    // El pasado y, hoy, la hora que ya pasó se responden sin ir a la base (sin tope hacia adelante: A4; el día libre, el
    // choque y lo demás los mira la base).
    const fueraDeVentana = mensajeFechaCita(datos.fecha, hoy)
    if (fueraDeVentana) return jsonError(fueraDeVentana, 400, { errores: [{ campo: 'fecha', mensaje: fueraDeVentana }] })
    const horaPasada = mensajeHoraCita(datos.fecha, datos.hora, instante)
    if (horaPasada) return jsonError(horaPasada, 400, { errores: [{ campo: 'hora', mensaje: horaPasada }] })

    try {
      // La persona la saca la base de p_user (persona_de_campo); "como qué", de `como` (C12; con la app solo para
      // líderes, siempre 'lider').
      const { data, error } = await t.fase('rpc', () => supabaseAdmin.rpc('agenda_crear', { p: { ...jsonbCita(datos), como }, p_user: auth.user.id }))
      if (error) {
        const traducido = respuestaErrorAgenda(error, 'Los datos de la cita no son válidos')
        if (traducido) return traducido
        throw error
      }
      const citaId = ((data ?? {}) as { cita_id?: string }).cita_id
      if (!citaId) throw new Error('agenda_crear no devolvió la cita')
      const cita = await t.fase('cita', () => cargarCitaItem(citaId, hoy, instante))
      if (!cita) throw new Error('No se encontró la cita recién agendada')
      const respuesta: CitaResponse = { cita }
      return NextResponse.json(respuesta, { status: 201 })
    } catch (error) {
      // Sin la nota en el log (texto libre de la persona).
      return errorReporte('POST /api/me/agenda', error, 'Error al agendar la cita', [datos.nota])
    }
  })
}
