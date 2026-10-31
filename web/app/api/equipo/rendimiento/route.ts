// GET /api/equipo/rendimiento?desde&hasta&linea&papel (team:view): las cifras del periodo del equipo que ve quien
// pregunta y una fila por persona (cumplimiento del plan ascendente), con el reparto por línea; quien ya no está pero
// tuvo filas sale marcado; la cuota solo en un mes completo. Como mucho 93 días. Spec: Entrega 2, "Rendimiento".
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { esMesCompleto } from '@/lib/equipo'
import type { EquipoRendimientoResponse } from '@/lib/reporte-visitas'
import { equipoRendimientoQuerySchema } from '@/lib/reporte-visitas-schemas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora } from '../../config-visitas/_lib/visitas-server'
import { cifrasItem, filaItem, rendimientoEquipo, requireEquipo } from '../_lib/equipo-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEquipo(request, 'GET /api/equipo/rendimiento')
  if (!auth.ok) return auth.response
  const q = request.nextUrl.searchParams
  const consulta = equipoRendimientoQuerySchema.safeParse({ desde: q.get('desde'), hasta: q.get('hasta'), linea: q.get('linea'), papel: q.get('papel') })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)
  const { desde, hasta, linea, papel } = consulta.data
  const instante = ahora()
  const hoy = hoyBogota(instante)
  try {
    const r = await rendimientoEquipo(auth.contexto, desde, hasta, hoy, instante, { linea, papel })
    const { lineas } = auth.contexto
    const respuesta: EquipoRendimientoResponse = {
      desde,
      hasta,
      mes_completo: esMesCompleto(desde, hasta),
      equipo: cifrasItem(r.equipo, lineas),
      por_persona: r.porPersona.map(f => filaItem(f, auth.contexto.alcanceConInactivas, lineas)),
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/equipo/rendimiento:', error instanceof Error ? error.message : error)
    return jsonError('Error al calcular el rendimiento', 500)
  }
}
