// /api/me/agenda (visits:report + Ejecutivo Comercial enlazado) — la agenda propia (F4.1, migración 0840).
//   GET ?desde=&hasta=&canceladas= — sus citas (sin fechas: de hoy a hoy + 7; como mucho 31 días; sin las canceladas
//       salvo canceladas=true), por fecha y hora, con el médico o la cuenta y el subtipo, la sede (con coordenadas y si
//       está confirmada), si es anticipada (cuenta como agendada) y si la puede cancelar. → AgendaResponse.
//   POST — agenda UNA cita: citaCreateSchema → ventana (de hoy a hoy + 30, mensajeFechaCita: 400 sin ir a la base) →
//       RPC agenda_crear (la base es la última palabra: día libre aprobado, perfil en la fecha, médico en la sede,
//       cuenta, subtipo vigente; 23514 → 400, 23505 repetida → 409) → 201 { cita }.
//   Sin la 0840 aplicada: 503 con MENSAJE_FALTA_MIGRACION_0840.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "F4.1"). Spec:
// docs/specs/2026-10-14-agenda-dictado-y-marca.md (decisiones 1 a 5).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { agendaQuerySchema, citaCreateSchema } from '@/lib/reporte-visitas-schemas'
import { mensajeFechaCita, rangoConsultaAgenda, ventanaAgenda, type AgendaResponse, type CitaResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, requireEjecutiva } from '../../config-visitas/_lib/visitas-server'
import { armarCitaItems, cargarCitaItem, errorReporte, jsonbCita, leerCitas, respuestaErrorAgenda } from '../_lib/reporte-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'GET /api/me/agenda')
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const consulta = agendaQuerySchema.safeParse({ desde: params.get('desde'), hasta: params.get('hasta'), canceladas: params.get('canceladas') })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)

  const hoy = hoyBogota(ahora())
  const rango = rangoConsultaAgenda(consulta.data, hoy)
  if (rango.error !== null) return jsonError(rango.error, 400)

  try {
    const filas = await leerCitas(auth.persona.id, rango.desde, rango.hasta, { conCanceladas: consulta.data.canceladas })
    const respuesta: AgendaResponse = {
      desde: rango.desde,
      hasta: rango.hasta,
      hoy,
      max_fecha: ventanaAgenda(hoy).hasta,
      items: await armarCitaItems(filas, { hoy }),
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorReporte('GET /api/me/agenda', error, 'Error al cargar tu agenda')
  }
}

/** Errores de zod como lista { campo, mensaje } (la app los muestra junto a cada campo). */
function erroresDeZod(issues: readonly { path: (string | number)[]; message: string }[]) {
  return issues.map(issue => ({ campo: issue.path.length > 0 ? String(issue.path[0]) : 'cita', mensaje: issue.message }))
}

export async function POST(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'POST /api/me/agenda')
  if (!auth.ok) return auth.response

  const parsed = citaCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400, { errores: erroresDeZod(parsed.error.issues) })
  const datos = parsed.data

  const hoy = hoyBogota(ahora())
  // Ventana (decisión 3): el pasado y más de 30 días se responden sin ir a la base (el día libre lo mira la base).
  const fueraDeVentana = mensajeFechaCita(datos.fecha, hoy)
  if (fueraDeVentana) return jsonError(fueraDeVentana, 400, { errores: [{ campo: 'fecha', mensaje: fueraDeVentana }] })

  try {
    // La persona la saca la base de p_user (executives.user_id), como visitas_anular.
    const { data, error } = await supabaseAdmin.rpc('agenda_crear', { p: jsonbCita(datos), p_user: auth.user.id })
    if (error) {
      const traducido = respuestaErrorAgenda(error, 'Los datos de la cita no son válidos')
      if (traducido) return traducido
      throw error
    }
    const citaId = ((data ?? {}) as { cita_id?: string }).cita_id
    if (!citaId) throw new Error('agenda_crear no devolvió la cita')
    const cita = await cargarCitaItem(citaId, hoy)
    if (!cita) throw new Error('No se encontró la cita recién agendada')
    const respuesta: CitaResponse = { cita }
    return NextResponse.json(respuesta, { status: 201 })
  } catch (error) {
    // Sin la nota en el log (texto libre de la persona).
    return errorReporte('POST /api/me/agenda', error, 'Error al agendar la cita', [datos.nota])
  }
}
