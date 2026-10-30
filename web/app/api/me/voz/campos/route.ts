// POST /api/me/voz/campos (visits:report + persona de campo, F1a) — dictado por campo (F4.1, decisión 9):
// { transcript, tipo } → Claude (el mismo proveedor y los mismos parámetros que proponer: claude-sonnet-5-5, herramienta
// estricta repartir_campos) → camposSchema → normalizarCampos (textos acotados y sin números largos; la próxima reunión
// solo si es una fecha desde hoy) → { conclusion, compromisos, next_step_date }. NADA SE GUARDA aquí: la app añade lo
// repartido a lo ya escrito y la persona confirma.
//   400 cuerpo (texto vacío o tipo no válido) · 429 los límites de proponer (LIMITES_VOZ.proponer, compartidos por
//   persona) · 503 sin ANTHROPIC_API_KEY · 502 si Claude falla o no devuelve el reparto. El texto nunca va a los logs.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "F4.1").
// Tiempos (spec 2026-10-15): Server-Timing (auth, claude, total) y la línea [tiempos] sin contenido (_lib/tiempos.ts),
// con el `usage` de Claude solo como números (claude_in, claude_out, claude_cache, claude_n).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { camposDictadoSchema, camposSchema } from '@/lib/reporte-visitas-schemas'
import { MENSAJE_FALLO_CAMPOS, normalizarCampos, type CamposDictadoResponse } from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, requirePersonaDeCampo } from '../../../config-visitas/_lib/visitas-server'
import { esErrorDeProveedor, limiteVoz, repartirCampos, respuestaSinLlave, resumenErrorVoz } from '../../_lib/reporte-server'
import { anotarUsoClaude, medirRuta, sumarUsoClaude } from '../../_lib/tiempos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/voz/campos', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/voz/campos'))
    if (!auth.ok) return auth.response

    const sinLlave = respuestaSinLlave('anthropic')
    if (sinLlave) return sinLlave

    const parsed = camposDictadoSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    // Los mismos límites que proponer (comparten el contador por persona): solo cuentan las llamadas que van a Claude.
    const limitado = limiteVoz('proponer', auth.persona.userId)
    if (limitado) return limitado

    try {
      const hoy = hoyBogota(ahora())
      const entrada = await t.fase('claude', () =>
        repartirCampos({ transcript: datos.transcript, tipo: datos.tipo, hoy }, usage => anotarUsoClaude(t, sumarUsoClaude(null, usage)))
      )
      const crudos = camposSchema.safeParse(entrada)
      if (!crudos.success) {
        console.error('POST /api/me/voz/campos: el reparto de Claude no cumple el esquema')
        return jsonError(MENSAJE_FALLO_CAMPOS, 502)
      }
      const respuesta: CamposDictadoResponse = normalizarCampos(crudos.data, hoy)
      return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error(`POST /api/me/voz/campos: fallo al repartir el dictado (${resumenErrorVoz(error, [datos.transcript])})`)
      if (esErrorDeProveedor(error)) return jsonError(MENSAJE_FALLO_CAMPOS, 502)
      return jsonError('Error interno al repartir el dictado', 500)
    }
  })
}
