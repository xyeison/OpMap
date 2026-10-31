// GET /api/equipo/hoy?fecha= (team:view): "¿Dónde está mi gente?": por persona visible, dónde está ese día según lo
// reportado y agendado (nunca GPS en vivo), y el resumen por ciudad. Sin fecha: hoy. Spec: Entrega 2, "Equipo › Hoy".
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { dondeEsta, resumenPorCiudad, soloComoEjecutivo } from '@/lib/equipo'
import { TEXTO_FIJO_EQUIPO, type EquipoHoyResponse } from '@/lib/reporte-visitas'
import { equipoDiaQuerySchema } from '@/lib/reporte-visitas-schemas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora } from '../../config-visitas/_lib/visitas-server'
import { diasEspeciales, personaItem, requireEquipo, ubicacionItem, visitasYCitasEquipo } from '../_lib/equipo-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEquipo(request, 'GET /api/equipo/hoy')
  if (!auth.ok) return auth.response
  const consulta = equipoDiaQuerySchema.safeParse({ fecha: request.nextUrl.searchParams.get('fecha') })
  if (!consulta.success) return jsonError(zodMessage(consulta.error), 400)
  const instante = ahora()
  const fecha = consulta.data.fecha ?? hoyBogota(instante)
  const { alcance, lineas } = auth.contexto
  try {
    const [{ visitas, citas }, especiales] = await Promise.all([
      visitasYCitasEquipo(alcance.personas.map(p => p.userId), fecha, fecha),
      diasEspeciales(alcance.personas, fecha, fecha),
    ])
    const visitasVisibles = soloComoEjecutivo(visitas, alcance)
    const citasVisibles = soloComoEjecutivo(citas, alcance)
    const personas = alcance.personas
      .map(p => ({
        persona: personaItem(p, alcance, lineas),
        ubicacion: dondeEsta({
          fecha,
          ahora: instante,
          visitas: visitasVisibles.filter(v => v.userId === p.userId),
          citas: citasVisibles.filter(c => c.userId === p.userId),
          diaLibre: especiales.libres.get(p.userId)?.has(fecha) ?? false,
          festivo: especiales.festivos.get(p.userId)?.has(fecha) ?? false,
        }),
      }))
      .sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es', { sensitivity: 'base' }))
    const resumen = resumenPorCiudad(personas.map(p => p.ubicacion))
    const respuesta: EquipoHoyResponse = {
      fecha,
      texto_fijo: TEXTO_FIJO_EQUIPO,
      resumen: { ciudades: resumen.ciudades, sin_nada: resumen.sinNada },
      personas: personas.map(p => ({ persona: p.persona, donde: ubicacionItem(p.ubicacion) })),
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/equipo/hoy:', error instanceof Error ? error.message : error)
    return jsonError('Error al cargar el equipo', 500)
  }
}
