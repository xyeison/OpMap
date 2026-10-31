// GET /api/kams/[id]/estadisticas — "Datos de la zona" de UNA Zona (ciudad base), sin persona: la ventana "Ver datos" de la
// pantalla "Zonas" (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md, E1). Una Zona sin nadie (Ibagué,
// Engativá…) también tiene así dónde ver sus cifras, que son las mismas para todas las líneas.
//
// Qué devuelve (ZonaDatosResponse, lib/zona-estadisticas.ts):
//   - zona: la fila de kams (404 si no existe; una Zona inactiva sí responde, marcada activa: false);
//   - bloque: construirBloque([kam_id], datos) con el cargador compartido de la pantalla (app/api/kams/_lib/zonas-server.ts:
//     las mismas cifras que la tabla de /kams), más los servicios del REPS y, solo con intelligence:view, las compras
//     públicas de SECOP de las IPS de la Zona (el valor va al NIT y se reparte entre sus sedes por camas);
//   - coberturaBase: quién cubre la Zona en cada línea, SOLO en las líneas que el usuario ve (lineasConCobertura sobre
//     resolveUserLines, como /api/coverage?line=): las demás ni se leen; leída de la tabla coverage (loadCoverageResponse);
//   - fuentes, acceso y notas con los cortes reales.
// Quién: executives:view (la pantalla) y hospitals:view (las cifras salen de las IPS): puedeVerDatosDeZona; recursos
// humanos (hr) recibe 403 sin leer nada más que su sesión. Solo lectura: nada de esta ruta recalcula asignaciones ni
// consulta Google.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { serverError } from '@/app/api/_lib/api-error'
import { UUID_RE } from '@/lib/fase1-schemas'
import { loadCoverageResponse, resolveUserLines } from '@/lib/coverage'
import { zoneDisplayName } from '@/lib/zone-names'
import type { CoverageLineInfo } from '@/lib/types/coverage'
import {
  coberturaDeZona,
  construirBloque,
  lineasConCobertura,
  puedeVerDatosDeZona,
  ultimaFecha,
  veComprasPublicas,
  type CoberturaLineaEntrada,
  type LineaRef,
  type ZonaDatosResponse,
  type ZonaRef,
} from '@/lib/zona-estadisticas'
import { cargarDatosZonas, dbError } from '@/app/api/kams/_lib/zonas-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

const NO_STORE = { 'Cache-Control': 'no-store' }

const NOTAS = [
  'Lo que hay en la Zona es igual para todas las líneas; lo que cambia por línea es quién la atiende.',
  'Municipios: los que tienen IPS activas asignadas a la Zona y los que no tienen IPS pero están dentro de su alcance por tiempo real de carretera (municipality_zone). Fuera de alcance y sin acceso terrestre no cuentan para nadie.',
  'Bogotá y los municipios con IPS de varias Zonas se reparten entre ellas por camas, como en "Población y cobertura" de Inteligencia: su población y sus afiliados cuentan solo por la parte de la Zona.',
  'Afiliados: BDUA de la ADRES, solo afiliados activos de los regímenes contributivo y subsidiado (la BDUA no trae el régimen de excepción). EPS principales: suma de las 12 EPS más grandes de cada municipio.',
  'IPS objetivo: IPS activas asignadas hoy a la Zona. Camas del REPS si se importaron; si no, las de la ficha. Cirugía ortopédica y neurocirugía: servicios habilitados del REPS importados.',
  'Giros ADRES: van al NIT; si el NIT tiene varias sedes en OpMap se reparten entre ellas por camas, así que nada se suma dos veces.',
]
// Solo para quien ve las compras públicas (veComprasPublicas: intelligence:view, como /api/secop/*).
const NOTA_SECOP =
  'Compras públicas (SECOP): también van al NIT y se reparten igual entre sus sedes. Valor adjudicado a cada contratista, sin duplicados entre fuentes, solo material ortopédico y de neurocirugía; los contratos fuera de escala y los servicios de especialistas no suman.'
const NOTA_SIN_SECOP = 'Las compras públicas (SECOP) de la Zona se ven con el acceso a Inteligencia.'
const NOTA_FINAL = 'Nada de esta ventana recalcula asignaciones ni consulta Google.'

interface LineRow {
  id: string
  code: string
  name: string
  max_reach_minutes: number
}

async function loadLineas(): Promise<LineRow[]> {
  const { data, error } = await supabaseAdmin
    .from('business_lines')
    .select('id, code, name, max_reach_minutes')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(0, 999)
  if (error) throw dbError('business_lines', error)
  return (data || []) as LineRow[]
}

async function loadZona(kamId: string): Promise<ZonaRef | null> {
  const { data, error } = await supabaseAdmin.from('kams').select('id, name, base_city, active').eq('id', kamId).limit(1)
  if (error) throw dbError('kams', error)
  const row = (data?.[0] ?? null) as { id: string; name: string | null; base_city: string | null; active: boolean | null } | null
  if (!row) return null
  return { kam_id: row.id, nombre: zoneDisplayName(row.name) || 'Zona sin nombre', ciudad_base: row.base_city ?? null, activa: row.active === true }
}

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:view')
  if (!auth.ok) return auth.response
  if (!puedeVerDatosDeZona(auth.user.papeles)) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  const verSecop = veComprasPublicas(auth.user.papeles)

  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'ID de Zona no válido' }, { status: 400 })
  const kamId = params.id.toLowerCase()

  try {
    const zona = await loadZona(kamId)
    if (!zona) return NextResponse.json({ error: 'Zona no encontrada' }, { status: 404 })

    const avisos: string[] = []
    // Cobertura solo de las líneas que ve el usuario: las demás ni se leen (misma regla que /api/coverage?line=).
    const visiblesPromise = Promise.all([loadLineas(), resolveUserLines(auth.user)]).then(([lineas, me]) => ({
      todas: me.canSeeAll,
      lineas: lineasConCobertura(lineas, me),
    }))
    const coberturasPromise = visiblesPromise.then(visibles =>
      Promise.all(
        visibles.lineas.map(line => loadCoverageResponse({ id: line.id, code: line.code, name: line.name, max_reach_minutes: line.max_reach_minutes } as CoverageLineInfo))
      )
    )
    const [visibles, coberturas, cargados] = await Promise.all([
      visiblesPromise,
      coberturasPromise,
      cargarDatosZonas(avisos, { contexto: 'kams/[id]/estadisticas', serviciosReps: true, fechaMunicipios: true, secop: verSecop ? { kamIds: [kamId] } : null }),
    ])
    const { datos } = cargados

    const toRef = (line: LineRow): LineaRef => ({ id: line.id, code: line.code, name: line.name })
    const lineasCobertura: LineaRef[] = visibles.lineas.map(toRef)
    const entradas: CoberturaLineaEntrada[] = coberturas.map((cobertura, index) => ({
      line: lineasCobertura[index],
      rows: cobertura.rows.map(row => ({
        kam_id: row.kam_id,
        zone_name: row.zone_name,
        kind: row.kind,
        executive: row.executive ? { id: row.executive.id, full_name: row.executive.full_name, status: row.executive.status } : null,
        travel_minutes: row.travel_minutes,
        nearest: row.nearest ? { full_name: row.nearest.full_name, minutes: row.nearest.minutes } : null,
      })),
    }))

    const notas = [...NOTAS, verSecop ? NOTA_SECOP : NOTA_SIN_SECOP]
    if (!visibles.todas) {
      notas.push(
        lineasCobertura.length > 0
          ? `Quién cubre la Zona por línea: solo en las líneas que lideras o llevas (${lineasCobertura.map(line => line.name).join(', ')}), como en el mapa y en Líneas.`
          : 'Quién cubre la Zona por línea: solo se ve en las líneas que lideras o llevas, y tu usuario no tiene ninguna.'
      )
    }
    if (!cargados.alcanceDisponible) notas.push('Sin la tabla municipality_zone: los municipios sin IPS no se cuentan.')
    if (cargados.girosSinCargar) notas.push('Aún no hay giros de la ADRES cargados.')
    if (!zona.activa) notas.push('La Zona está inactiva: no participa en la asignación ni en la cobertura.')
    notas.push(NOTA_FINAL)

    const body: ZonaDatosResponse = {
      zona,
      bloque: construirBloque([kamId], datos),
      coberturaBase: coberturaDeZona(entradas, kamId),
      coberturaCalculada: ultimaFecha(coberturas.map(item => item.computed_at)),
      fuentes: {
        municipiosCalculados: cargados.municipiosCalculados,
        poblacionAnio: datos.dane?.anio ?? null,
        bduaCorte: datos.bdua?.corte ?? null,
      },
      acceso: { comprasPublicas: verSecop, todasLasLineas: visibles.todas, lineasCobertura },
      notas: [...notas, ...avisos],
      generado: new Date().toISOString(),
    }
    return NextResponse.json(body, { headers: NO_STORE })
  } catch (error) {
    return serverError('kams/[id]/estadisticas GET', error, 'Error al cargar los datos de la zona')
  }
}
