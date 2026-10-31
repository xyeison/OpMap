// GET /api/equipo/persona/[id]/rendimiento?desde&hasta (team:view): la fila de una persona del equipo en ese periodo
// y sus visitas y citas (reducidas: sin GPS ni documentos). Fuera del alcance → 404. Spec: Entrega 2, "Rendimiento".
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { esMesCompleto, rastroDelDia } from '@/lib/equipo'
import type { EquipoPersonaRendimientoResponse, PasoRastroItem } from '@/lib/reporte-visitas'
import { equipoRendimientoQuerySchema } from '@/lib/reporte-visitas-schemas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora } from '../../../../config-visitas/_lib/visitas-server'
import { filaItem, pasoItem, rendimientoEquipo, requireEquipo } from '../../../_lib/equipo-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEquipo(request, 'GET /api/equipo/persona/[id]/rendimiento')
  if (!auth.ok) return auth.response
  const q = request.nextUrl.searchParams
  const consulta = equipoRendimientoQuerySchema.safeParse({ desde: q.get('desde'), hasta: q.get('hasta'), linea: null, papel: null })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)
  const { desde, hasta } = consulta.data
  const { alcanceConInactivas, lineas } = auth.contexto
  if (!alcanceConInactivas.personas.some(p => p.userId === params.id)) return jsonError('Esa persona no está en tu equipo', 404)
  const instante = ahora()
  const hoy = hoyBogota(instante)
  try {
    const r = await rendimientoEquipo(auth.contexto, desde, hasta, hoy, instante, { linea: null, papel: null, userId: params.id })
    const fila = r.porPersona.find(f => f.persona.userId === params.id)
    if (!fila) return jsonError('Esa persona no está en tu equipo', 404)
    const pasos = (filas: PasoRastroItem[]) => filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '99').localeCompare(b.hora ?? '99'))
    const visitas = pasos(r.visitas.map(v => pasoItem(rastroDelDia({ fecha: v.fecha, ahora: instante, visitas: [v], citas: [] })[0], v.fecha, lineas)))
    const citas = pasos(r.citas.filter(c => c.fecha >= desde && c.fecha <= hasta).map(c => pasoItem(rastroDelDia({ fecha: c.fecha, ahora: instante, visitas: [], citas: [c] })[0], c.fecha, lineas)))
    const respuesta: EquipoPersonaRendimientoResponse = { desde, hasta, mes_completo: esMesCompleto(desde, hasta), fila: filaItem(fila, alcanceConInactivas, lineas), visitas, citas }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/equipo/persona/[id]/rendimiento:', error instanceof Error ? error.message : error)
    return jsonError('Error al calcular el rendimiento', 500)
  }
}
