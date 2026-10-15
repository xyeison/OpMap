// /api/me/dias-libres (visits:report) — los días libres del Ejecutivo Comercial enlazado con el usuario. Sin
// ejecutiva enlazada: 403 "Tu usuario no está enlazado con un Ejecutivo Comercial". Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
//   GET ?desde=&hasta= → { ejecutiva: { id, nombre }, items, plazo_horas, requiere_aprobacion, motivos } (plazo,
//       aprobación y motivos vigentes hoy).
//   POST diaLibreCreateSchema → plazo de gracia vigente hoy (400 con la fecha límite), día hábil en SU calendario
//       (400 "Ese día no es hábil en tu calendario"), sin duplicado (409), motivo de la lista vigente; nace
//       'por_aprobar' si se exige aprobación o 'registrado' si no → 201 { dia }.
// Tiempos (spec 2026-10-15): Server-Timing y la línea [tiempos] sin contenido (me/_lib/tiempos.ts). GET: auth, db, armar.
// POST: auth, registrar.
import { NextRequest, NextResponse } from 'next/server'
import { fetchAllRows, jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { consultaDiasLibresSchema, diaLibreCreateSchema } from '@/lib/visits-config-schemas'
import { generalVigente, type DiaLibre, type MisDiasLibresResponse } from '@/lib/visits-rules'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  COLUMNAS_DIA_LIBRE,
  armarDiasLibres,
  errorVisitas,
  hoyActual,
  leerGeneral,
  registrarDiaLibre,
  requireEjecutiva,
} from '../../config-visitas/_lib/visitas-server'
import { medirRuta } from '../_lib/tiempos'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/dias-libres', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'GET /api/me/dias-libres'))
    if (!auth.ok) return auth.response
    const { persona } = auth

    const parametros = request.nextUrl.searchParams
    const parsed = consultaDiasLibresSchema.safeParse({ desde: parametros.get('desde'), hasta: parametros.get('hasta') })
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const { desde, hasta } = parsed.data

    try {
      const hoy = hoyActual()
      const [general, filas] = await t.fase('db', () =>
        Promise.all([
          leerGeneral(),
          fetchAllRows<DiaLibre>((from, to) => {
            let q = supabaseAdmin.from('dias_libres').select(COLUMNAS_DIA_LIBRE).eq('executive_id', persona.id)
            if (desde) q = q.gte('fecha', desde)
            if (hasta) q = q.lte('fecha', hasta)
            return q.order('fecha').order('id').range(from, to)
          }),
        ])
      )
      const items = await t.fase('armar', () => armarDiasLibres(filas, general, hoy, new Map([[persona.id, persona]])))
      const respuesta: MisDiasLibresResponse = {
        ejecutiva: { id: persona.id, nombre: persona.nombre },
        items,
        plazo_horas: generalVigente(general, 'plazo_gracia_horas', hoy),
        requiere_aprobacion: generalVigente(general, 'aprobacion_dias_libres', hoy).requiere,
        motivos: generalVigente(general, 'motivos_dia_libre', hoy),
      }
      return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorVisitas('GET /api/me/dias-libres', error, 'Error al cargar tus días libres')
    }
  })
}

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/dias-libres', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'POST /api/me/dias-libres'))
    if (!auth.ok) return auth.response

    const parsed = diaLibreCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    return t.fase('registrar', () =>
      registrarDiaLibre({
        user: auth.user,
        persona: auth.persona,
        datos: parsed.data,
        porOtra: false,
        contexto: 'POST /api/me/dias-libres',
      })
    )
  })
}
