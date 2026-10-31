// /api/calendario — días del calendario de visitas: festivos nacionales (calculados por el sistema y corregibles),
// días de empresa y días por ciudad. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
//   GET  ?desde=&hasta=&municipio=  (calendar:manage, daysoff:approve, daysoff:view o visits:report): máximo 400
//        días; con municipio, los nacionales, los de empresa y los de esa ciudad. Los anulados solo salen con
//        calendar:manage.
//   POST { fecha, alcance: 'empresa' | 'ciudad', municipality_id?, tipo, nombre } (calendar:manage): origen 'manual';
//        409 si ya hay un día activo igual (misma fecha, alcance y ciudad). Nada de esto recalcula asignaciones.
import { NextRequest, NextResponse } from 'next/server'
import { PERMISOS_CALENDARIO } from '@/lib/permissions'
import { tienePermiso } from '@/lib/empresas-reglas'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { calendarioDiaCreateSchema, consultaCalendarioSchema } from '@/lib/visits-config-schemas'
import { etiquetaAlcanceCalendario, type CalendarioDia, type CalendarioDiaItem, type CalendarioResponse } from '@/lib/visits-rules'
import { esViolacionUnica, MUNICIPIO_NO_EXISTE } from '@/app/api/terceros/_lib/terceros-server'
import {
  COLUMNAS_CALENDARIO,
  errorVisitas,
  leerCalendario,
  nombreMunicipio,
  nombresMunicipios,
  requireAlgunPermiso,
  respuestaErrorBase,
} from '../config-visitas/_lib/visitas-server'

export const dynamic = 'force-dynamic'

function itemCalendario(dia: CalendarioDia, ciudades: Map<string, string>): CalendarioDiaItem {
  return {
    id: dia.id,
    fecha: dia.fecha,
    alcance: dia.alcance,
    municipality_id: dia.municipality_id,
    ciudad: dia.municipality_id ? ciudades.get(dia.municipality_id) ?? dia.municipality_id : null,
    tipo: dia.tipo,
    nombre: dia.nombre,
    origen: dia.origen,
    anulado_at: dia.anulado_at,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAlgunPermiso(request, PERMISOS_CALENDARIO)
  if (!auth.ok) return auth.response

  const parsed = consultaCalendarioSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const { desde, hasta, municipio } = parsed.data

  try {
    const dias = await leerCalendario(desde, hasta, {
      municipio,
      todasLasCiudades: municipio === null,
      conAnulados: tienePermiso(auth.user.papeles, 'calendar:manage'),
    })
    const ciudades = await nombresMunicipios(dias.map(dia => dia.municipality_id))
    const respuesta: CalendarioResponse = { dias: dias.map(dia => itemCalendario(dia, ciudades)) }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorVisitas('GET /api/calendario', error, 'Error al cargar el calendario')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'calendar:manage')
  if (!auth.ok) return auth.response

  try {
    const parsed = calendarioDiaCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    let ciudad: string | null = null
    if (datos.municipality_id) {
      ciudad = await nombreMunicipio(datos.municipality_id)
      if (ciudad === null) return jsonError(MUNICIPIO_NO_EXISTE, 400)
    }

    const donde = datos.alcance === 'ciudad' && ciudad ? ` en ${ciudad}` : ''
    const repetido = (nombre?: string) =>
      `Ya hay un ${etiquetaAlcanceCalendario(datos.alcance).toLowerCase()} activo el ${datos.fecha}${donde}${nombre ? ` (${nombre})` : ''}: anúlalo antes de poner otro`

    let existente = supabaseAdmin
      .from('calendario')
      .select('id, nombre')
      .eq('fecha', datos.fecha)
      .eq('alcance', datos.alcance)
      .is('anulado_at', null)
    existente = datos.municipality_id ? existente.eq('municipality_id', datos.municipality_id) : existente.is('municipality_id', null)
    const { data: previos, error: previosError } = await existente.limit(1)
    if (previosError) throw previosError
    if (previos && previos.length > 0) return jsonError(repetido(String((previos[0] as { nombre: string }).nombre)), 409)

    const { data, error } = await supabaseAdmin
      .from('calendario')
      .insert({
        fecha: datos.fecha,
        alcance: datos.alcance,
        municipality_id: datos.municipality_id,
        tipo: datos.tipo,
        nombre: datos.nombre,
        origen: 'manual',
        created_by: auth.user.id,
      })
      .select(COLUMNAS_CALENDARIO)
    if (error) {
      if (esViolacionUnica(error)) return jsonError(repetido(), 409)
      const traducido = respuestaErrorBase(error, 'Los datos del día no son válidos')
      if (traducido) return traducido
      throw error
    }
    const dia = (data || [])[0] as unknown as CalendarioDia | undefined
    if (!dia) throw new Error('La base no devolvió el día creado')
    const ciudades = new Map<string, string>(dia.municipality_id && ciudad ? [[dia.municipality_id, ciudad]] : [])
    return NextResponse.json({ dia: itemCalendario(dia, ciudades) }, { status: 201 })
  } catch (error) {
    return errorVisitas('POST /api/calendario', error, 'Error al guardar el día del calendario')
  }
}
