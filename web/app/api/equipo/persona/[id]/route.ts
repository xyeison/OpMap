// GET /api/equipo/persona/[id]?fecha= (team:view): el día de una persona visible: dónde está, el rastro por hora y lo
// que sigue (lo de ese día que falta y los dos días que vienen). Fuera del alcance → 404 (no 403: no confirma que
// exista). Spec: Entrega 2, "Equipo › Hoy".
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { dondeEsta, estadoVisible, rastroDelDia, soloComoEjecutivo } from '@/lib/equipo'
import type { EquipoPersonaDiaResponse, PasoRastroItem } from '@/lib/reporte-visitas'
import { equipoDiaQuerySchema } from '@/lib/reporte-visitas-schemas'
import { hoyBogota, sumarDias } from '@/lib/visits-rules'
import { ahora } from '../../../config-visitas/_lib/visitas-server'
import { diasEspeciales, pasoItem, personaItem, requireEquipo, ubicacionItem, visitasYCitasEquipo } from '../../_lib/equipo-server'

export const dynamic = 'force-dynamic'
/** "Siguiente": lo de ese día que falta y los dos días que vienen. */
const DIAS_SIGUIENTE = 2

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireEquipo(request, 'GET /api/equipo/persona/[id]')
  if (!auth.ok) return auth.response
  const consulta = equipoDiaQuerySchema.safeParse({ fecha: request.nextUrl.searchParams.get('fecha') })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)
  const { alcance, lineas } = auth.contexto
  const persona = alcance.personas.find(p => p.userId === params.id)
  if (!persona) return jsonError('Esa persona no está en tu equipo', 404)
  const instante = ahora()
  const fecha = consulta.data.fecha ?? hoyBogota(instante)
  const hasta = sumarDias(fecha, DIAS_SIGUIENTE)
  try {
    const [{ visitas, citas }, especiales] = await Promise.all([visitasYCitasEquipo([persona.userId], fecha, hasta), diasEspeciales([persona], fecha, fecha)])
    const visitasVisibles = soloComoEjecutivo(visitas, alcance).filter(v => v.userId === persona.userId)
    const citasVisibles = soloComoEjecutivo(citas, alcance).filter(c => c.userId === persona.userId)
    const donde = dondeEsta({
      fecha,
      ahora: instante,
      visitas: visitasVisibles,
      citas: citasVisibles,
      diaLibre: especiales.libres.get(persona.userId)?.has(fecha) ?? false,
      festivo: especiales.festivos.get(persona.userId)?.has(fecha) ?? false,
    })
    const rastro = rastroDelDia({ fecha, ahora: instante, visitas: visitasVisibles, citas: citasVisibles }).map(p => pasoItem(p, fecha, lineas))
    const siguiente: PasoRastroItem[] = citasVisibles
      .filter(c => c.estado === 'pendiente' && c.fecha >= fecha && c.fecha <= hasta && (c.fecha > fecha || estadoVisible(c, instante) === 'programada'))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '99').localeCompare(b.hora ?? '99'))
      .map(c => pasoItem(rastroDelDia({ fecha: c.fecha, ahora: instante, visitas: [], citas: [c] })[0], c.fecha, lineas))
    const respuesta: EquipoPersonaDiaResponse = { fecha, persona: personaItem(persona, alcance, lineas), donde: ubicacionItem(donde), rastro, siguiente }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/equipo/persona/[id]:', error instanceof Error ? error.message : error)
    return jsonError('Error al cargar el día de la persona', 500)
  }
}
