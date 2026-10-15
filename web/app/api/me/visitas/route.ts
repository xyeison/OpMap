// /api/me/visitas (visits:report + Ejecutivo Comercial enlazado).
//   GET ?fecha=AAAA-MM-DD (sin fecha: hoy) — sus visitas de la app de ese día (sin las anuladas), con a qué meta suma
//       cada una (valorVisita con el conteo vigente en su fecha) y si aún puede corregirla.
//   POST — reporta UNA visita: visitaCreateSchema → idempotencia por client_id (la misma visita otra vez devuelve la
//       que ya estaba, `repetida: true`, sin validar de nuevo) → pre-validación pura (validarVisita: 400 con todos los
//       errores) → RPC visitas_registrar (la base es la última palabra: 23514 → 400 con su mensaje) → 201
//       { visita, repetida }.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (decisiones 3 a 9 y sección "API").
// Tiempos (spec 2026-10-15): Server-Timing y la línea [tiempos] sin contenido (_lib/tiempos.ts). GET: auth, db, armar.
// POST: auth, previa (client_id), validar (contextoValidacion y lo de hoy), rpc (visitas_registrar), leer.
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { visitaCreateSchema, visitasQuerySchema } from '@/lib/reporte-visitas-schemas'
import { validarVisita, type ErrorVisita, type VisitaCreateResponse, type VisitasResponse } from '@/lib/reporte-visitas'
import { ahora, leerConfig, leerGeneral, requireEjecutiva } from '../../config-visitas/_lib/visitas-server'
import { hoyBogota } from '@/lib/visits-rules'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  armarVisitaItems,
  cargarVisitaItem,
  configDeHoy,
  contextoValidacion,
  errorReporte,
  jsonbRegistrar,
  leerConteo,
  leerVisitas,
  respuestaErrorVisita,
  visitaPorClientId,
  visitasParaTopes,
} from '../_lib/reporte-server'
import { medirRuta } from '../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/visitas', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'GET /api/me/visitas'))
    if (!auth.ok) return auth.response

    const consulta = visitasQuerySchema.safeParse({ fecha: request.nextUrl.searchParams.get('fecha') })
    if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)

    try {
      const hoy = hoyBogota(ahora())
      const fecha = consulta.data.fecha ?? hoy
      const [filas, conteo, general] = await t.fase('db', () => Promise.all([leerVisitas(auth.persona.id, fecha, fecha), leerConteo(), leerGeneral()]))
      const items = await t.fase('armar', () => armarVisitaItems(filas, { persona: auth.persona, hoy, conteo, general }))
      const respuesta: VisitasResponse = { fecha, items }
      return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorReporte('GET /api/me/visitas', error, 'Error al cargar tus visitas')
    }
  })
}

/** Errores de zod como lista { campo, mensaje } (la app los muestra junto a cada campo). */
function erroresDeZod(issues: readonly { path: (string | number)[]; message: string }[]): ErrorVisita[] {
  return issues.map(issue => ({ campo: issue.path.length > 0 ? String(issue.path[0]) : 'visita', mensaje: issue.message }))
}

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/visitas', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'POST /api/me/visitas'))
    if (!auth.ok) return auth.response
    const { user, persona } = auth

    const parsed = visitaCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400, { errores: erroresDeZod(parsed.error.issues) })
    }
    const datos = parsed.data

    try {
      const instante = ahora()
      const hoy = hoyBogota(instante)

      // 1. Idempotencia: el mismo client_id (reintento de la cola sin señal) devuelve la visita que ya estaba.
      const previa = await t.fase('previa', () => visitaPorClientId(datos.client_id))
      if (previa) {
        if (previa.executive_id !== persona.id) return jsonError('Ese client_id ya se usó en otra visita', 409)
        const [conteo, general] = await t.fase('leer', () => Promise.all([leerConteo(), leerGeneral()]))
        const [visita] = await t.fase('armar', () => armarVisitaItems([previa], { persona, hoy, conteo, general }))
        const respuesta: VisitaCreateResponse = { visita, repetida: true }
        return NextResponse.json(respuesta, { status: 201 })
      }

      // 2. Pre-validación pura (todos los errores a la vez), con lo que la base tiene hoy.
      const [contexto, general, personas, deHoy] = await t.fase('validar', () =>
        Promise.all([
          contextoValidacion(datos, persona, hoy),
          leerGeneral(),
          leerConfig('config_personas', { soloActivas: true, executiveId: persona.id }),
          leerVisitas(persona.id, hoy, hoy),
        ])
      )
      const resultado = validarVisita({
        datos,
        contexto,
        config: configDeHoy(general, personas, persona.id, hoy),
        hoy,
        ahora: instante,
        visitasDeHoy: visitasParaTopes(deHoy),
      })
      if (!resultado.ok) return jsonError(resultado.errores[0].mensaje, 400, { errores: resultado.errores })

      // 3. La base registra (atómica: visita + líneas, topes con candado por ejecutiva). Devuelve { visita_id,
      //    repetida, out_of_territory, distance_m, visit_date }.
      const { data, error } = await t.fase('rpc', () => supabaseAdmin.rpc('visitas_registrar', { p: jsonbRegistrar(datos, persona.id), p_user: user.id }))
      if (error) {
        const traducido = respuestaErrorVisita(error, 'Los datos de la visita no son válidos')
        if (traducido) return traducido
        throw error
      }
      const registro = (data ?? {}) as { visita_id?: string; repetida?: boolean }
      if (!registro.visita_id) throw new Error('visitas_registrar no devolvió la visita')

      const visitaId = registro.visita_id
      const visita = await t.fase('leer', () => cargarVisitaItem(visitaId, { persona, hoy, general }))
      if (!visita) throw new Error('No se encontró la visita recién registrada')
      const respuesta: VisitaCreateResponse = { visita, repetida: Boolean(registro.repetida) }
      return NextResponse.json(respuesta, { status: 201 })
    } catch (error) {
      // Sin datos de la visita en el log: ni la fila que falló ni estos textos (transcript no sale en logs).
      return errorReporte('POST /api/me/visitas', error, 'Error al registrar la visita', [datos.transcript, datos.conclusion, datos.compromisos, datos.failure_reason])
    }
  })
}
