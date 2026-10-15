// GET /api/me/cuota?mes=AAAA-MM (visits:report) — "Mi cuota del mes" del Ejecutivo Comercial enlazado con el
// usuario: médica, institucional y subtipos con meta propia, días hábiles de SU calendario, días libres, por aprobar
// y ritmo. Sin mes: el mes de hoy. Sin ejecutiva enlazada: 403. El cálculo es cuotaPeriodo (lógica pura) con las
// filas reales. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
// Tiempos (spec 2026-10-15): Server-Timing (auth, cuota, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { mesSchema } from '@/lib/visits-config-schemas'
import { mesDe } from '@/lib/visits-rules'
import { calcularCuota, errorVisitas, hoyActual, requireEjecutiva } from '../../config-visitas/_lib/visitas-server'
import { medirRuta } from '../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/cuota', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'GET /api/me/cuota'))
    if (!auth.ok) return auth.response

    const hoy = hoyActual()
    const mesTexto = request.nextUrl.searchParams.get('mes')
    const mes = mesSchema.safeParse(mesTexto && mesTexto.trim() ? mesTexto : mesDe(hoy))
    if (!mes.success) return jsonError(zodMessage(mes.error), 400)

    try {
      const cuota = await t.fase('cuota', () => calcularCuota(auth.persona, mes.data, hoy))
      return NextResponse.json(cuota, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorVisitas('GET /api/me/cuota', error, 'Error al calcular tu cuota')
    }
  })
}
