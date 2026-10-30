// POST /api/me/voz/proponer (visits:report + persona de campo, F1a) — { transcript, lat?, lng?, precision?,
// hora, cita_id? } → el contexto (el mismo de GET /api/me/contexto, recortado por contextoDictado: sin documentos ni
// teléfonos) → Claude (claude-sonnet-5-5, herramienta proponer_visitas con esquema cerrado) → propuestaSchema →
// normalizarPropuesta (descarta todo id que no esté en el contexto; un médico que no cruza sale como
// medico_nombre_dicho con medico_id null y sugerir_crear_medico) → { visitas, aviso }.
// NADA SE GUARDA aquí: la ejecutiva confirma cada tarjeta y la app la manda a POST /api/me/visitas.
//   400 cuerpo · 429 demasiadas propuestas seguidas (LIMITES_VOZ, por persona) · 503 sin ANTHROPIC_API_KEY · 502 si
//   Claude falla, rechaza o no devuelve una propuesta válida.
// Costo estimado ≈ 0,005 USD por dictado (decisión 12). La transcripción no se registra en los logs.
// F4.1 (0840): el contexto de Claude trae las citas pendientes de hoy y, si viene cita_id (la cita que eligió en
// Reportar), cita_elegida: Claude prefiere esa cita (sus ids también valen en normalizarPropuesta).
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (decisión 12 y sección "API").
// Tiempos (spec 2026-10-15): Server-Timing (auth, ctx, claude, total) y la línea [tiempos] sin contenido
// (_lib/tiempos.ts), con el `usage` de Claude solo como números (claude_in, claude_out, claude_cache, claude_n).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { propuestaSchema, proponerSchema } from '@/lib/reporte-visitas-schemas'
import { MENSAJE_FALLO_PROPUESTA, contextoDictado, horaBogota, normalizarPropuesta, type PropuestaResponse } from '@/lib/reporte-visitas'
import { ahora, requirePersonaDeCampo } from '../../../config-visitas/_lib/visitas-server'
import { hoyBogota } from '@/lib/visits-rules'
import {
  cargarContexto,
  errorReporte,
  esErrorDeProveedor,
  limiteVoz,
  proponerVisitas,
  puntoDe,
  respuestaSinLlave,
  resumenErrorVoz,
} from '../../_lib/reporte-server'
import { anotarUsoClaude, medirRuta, sumarUsoClaude } from '../../_lib/tiempos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/voz/proponer', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/voz/proponer'))
    if (!auth.ok) return auth.response

    const sinLlave = respuestaSinLlave('anthropic')
    if (sinLlave) return sinLlave

    const cuerpo = await readJson(request)
    // Sin hora del dictado, la del servidor (la app la manda; así un cliente viejo no recibe un 400).
    const conHora =
      cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) && (cuerpo as Record<string, unknown>).hora === undefined
        ? { ...(cuerpo as Record<string, unknown>), hora: ahora().toISOString() }
        : cuerpo
    const parsed = proponerSchema.safeParse(conHora)
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    let contexto
    try {
      const instante = ahora()
      contexto = await t.fase('ctx', () => cargarContexto(auth.persona, puntoDe(datos), hoyBogota(instante), instante))
    } catch (error) {
      return errorReporte('POST /api/me/voz/proponer', error, 'Error al cargar el contexto del dictado')
    }

    // Límite por persona: solo cuentan las llamadas que de verdad van a Claude.
    const limitado = limiteVoz('proponer', auth.persona.userId)
    if (limitado) return limitado

    try {
      const dictado = contextoDictado(contexto, horaBogota(datos.hora), datos.cita_id)
      const entrada = await t.fase('claude', () =>
        proponerVisitas({ contexto: dictado, transcript: datos.transcript }, usage => anotarUsoClaude(t, sumarUsoClaude(null, usage)))
      )
      const cruda = propuestaSchema.safeParse(entrada)
      if (!cruda.success) {
        console.error('POST /api/me/voz/proponer: la propuesta de Claude no cumple el esquema')
        return jsonError(MENSAJE_FALLO_PROPUESTA, 502)
      }
      const respuesta: PropuestaResponse = normalizarPropuesta(cruda.data, contexto)
      return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      // El resumen nunca repite lo dictado ni el contexto (nombres de médicos, cuentas, sedes): resumenErrorVoz.
      console.error(`POST /api/me/voz/proponer: fallo al proponer (${resumenErrorVoz(error, [datos.transcript, contexto])})`)
      if (esErrorDeProveedor(error)) return jsonError(MENSAJE_FALLO_PROPUESTA, 502)
      return jsonError('Error interno al armar la propuesta', 500)
    }
  })
}
