// /api/dias-libres — días libres de los Ejecutivos Comerciales. Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
//   GET ?desde=&hasta=&estado=&executive_id=
//       daysoff:approve → los de todos; daysoff:view (líder de línea) → solo los de las ejecutivas de SUS líneas
//       (executive_lines en líneas con business_lines.leader_user_id = él), sin aprobar.
//       { items, puede_aprobar, plazo_horas, motivos } (plazo y motivos vigentes hoy, para registrar por otra persona).
//   POST (daysoff:approve y rol en aprobacion_dias_libres.aprueban, o admin) registra por otra persona
//       (diaLibrePorOtraSchema): motivo de la lista vigente, día hábil para ELLA, sin duplicado (409), dentro del
//       plazo de gracia o, fuera, con justificación (queda fuera_de_plazo). Queda 'aprobado' con revisado_por = quien
//       lo registra (decisión 3 del contrato). Nunca para la ejecutiva enlazada con quien registra (403): sus propios
//       días van por /api/me/dias-libres y los aprueba otra persona (decisión 13 del contrato).
import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { consultaDiasLibresSchema, diaLibrePorOtraSchema } from '@/lib/visits-config-schemas'
import { MENSAJE_PROPIO_POR_OTRA, generalVigente, type DiaLibre, type DiasLibresResponse } from '@/lib/visits-rules'
import { leerPorIds } from '@/app/api/terceros/_lib/terceros-server'
import {
  COLUMNAS_DIA_LIBRE,
  MENSAJE_ROL_NO_APRUEBA,
  armarDiasLibres,
  cargarPersona,
  ejecutivasDeMisLineas,
  errorVisitas,
  hoyActual,
  leerGeneral,
  puedeAprobarHoy,
  registrarDiaLibre,
  requireAlgunPermiso,
} from '../config-visitas/_lib/visitas-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAlgunPermiso(request, ['daysoff:approve', 'daysoff:view'])
  if (!auth.ok) return auth.response
  const user = auth.user

  const parsed = consultaDiasLibresSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const filtros = parsed.data

  try {
    const hoy = hoyActual()
    const verTodos = hasPermission(user.role, 'daysoff:approve')
    let permitidas: string[] | null = null
    if (!verTodos) {
      const mias = await ejecutivasDeMisLineas(user.id)
      if (filtros.executive_id && !mias.has(filtros.executive_id)) {
        return jsonError('Solo puedes ver los días libres de los Ejecutivos Comerciales de tus líneas', 403)
      }
      permitidas = filtros.executive_id ? [filtros.executive_id] : Array.from(mias)
    }

    const consultaBase = () => supabaseAdmin.from('dias_libres').select(COLUMNAS_DIA_LIBRE)
    type Consulta = ReturnType<typeof consultaBase>
    const conFiltros = (consulta: Consulta): Consulta => {
      let q = consulta
      if (filtros.desde) q = q.gte('fecha', filtros.desde)
      if (filtros.hasta) q = q.lte('fecha', filtros.hasta)
      if (filtros.estado) q = q.eq('estado', filtros.estado)
      return q
    }
    let filas: DiaLibre[]
    if (permitidas === null) {
      filas = await fetchAllRows<DiaLibre>((from, to) => {
        let q = conFiltros(consultaBase())
        if (filtros.executive_id) q = q.eq('executive_id', filtros.executive_id)
        return q.order('fecha').order('id').range(from, to)
      })
    } else {
      filas = await leerPorIds<DiaLibre>(permitidas, (trozo, from, to) =>
        conFiltros(consultaBase()).in('executive_id', trozo).order('fecha').order('id').range(from, to)
      )
    }
    filas.sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

    const general = await leerGeneral()
    const respuesta: DiasLibresResponse = {
      items: await armarDiasLibres(filas, general, hoy),
      puede_aprobar: puedeAprobarHoy(user, general, hoy),
      // Vigentes hoy: los usa "Registrar por otra persona" (recursos humanos no lee /api/config-visitas).
      plazo_horas: generalVigente(general, 'plazo_gracia_horas', hoy),
      motivos: generalVigente(general, 'motivos_dia_libre', hoy),
    }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorVisitas('GET /api/dias-libres', error, 'Error al cargar los días libres')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'daysoff:approve')
  if (!auth.ok) return auth.response

  try {
    const general = await leerGeneral()
    if (!puedeAprobarHoy(auth.user, general, hoyActual())) return jsonError(MENSAJE_ROL_NO_APRUEBA, 403)

    const parsed = diaLibrePorOtraSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    const persona = await cargarPersona(datos.executive_id)
    if (!persona) return jsonError('El Ejecutivo Comercial elegido no existe', 400)
    // Separación entre quien pide y quien aprueba: sus propios días no se registran aprobados ni fuera de plazo.
    if (persona.userId === auth.user.id) return jsonError(MENSAJE_PROPIO_POR_OTRA, 403)

    return registrarDiaLibre({
      user: auth.user,
      persona,
      datos,
      porOtra: true,
      contexto: 'POST /api/dias-libres',
    })
  } catch (error) {
    return errorVisitas('POST /api/dias-libres', error, 'Error al registrar el día libre')
  }
}
