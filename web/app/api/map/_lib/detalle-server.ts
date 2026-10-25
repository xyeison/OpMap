// Tarjetas del mapa · giros ADRES y compras públicas SECOP de 12 meses: lecturas de Supabase y armado de la
// respuesta de GET /api/map/detalle/territorio y GET /api/map/detalle/ips/[id] (solo servidor; "_lib" no es ruta).
// Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md. Las cuentas son las funciones PURAS de
// lib/mapa-detalle.ts (reparto por camas, ventanas, estados, textos); aquí solo se lee y se junta.
//
// Por qué se lee así:
//   - Las IPS activas se leen de `hospitals` en una sola consulta (loadSedesMapa) y no con loadIntelHospitals: esa
//     función trae zona y asignaciones (3 consultas) que la tarjeta no usa y NO trae locality_id (una localidad de
//     Bogotá quedaría con 0 IPS) ni compra_publica (la marca manual que manda sobre el REPS). Se leen TODAS las
//     activas porque la parte por camas de un NIT se calcula sobre todas sus sedes (lib/mapa-detalle.ts).
//   - Giros: loadGirosNits (RPC adres_giros_nits o respaldo adres_giros_intel) solo con los NIT del territorio; la
//     ventana termina en el último mes cargado (loadIdentificaBounds), como /inteligencia.
//   - Compras: loadHechos({ desde, hasta, nits }) con los 12 meses hasta hoy y solo los NIT del territorio. Nunca
//     loadContratosEntidad, que trae todo el histórico de la entidad (UPRES Santander: 4.438 contratos).
//   - Entidad de compra pública por SEDE (resolverPublicaPorSede): resolverCompraPublica(marca manual de ESA sede,
//     naturaleza del REPS del NIT, contratos del NIT cargados en SECOP), la misma regla en la tarjeta del territorio,
//     en la de la IPS y en la ficha (/api/secop/hospital/[id]); así el municipio suma exactamente lo que muestran sus
//     IPS. El tercer criterio mira TODO el histórico, como la ficha: una entidad que contrató hace años pero no en la
//     ventana es pública "sin contratos en 12 meses", nunca "IPS privada". Para no traer el histórico se pregunta solo
//     si existe algún contrato (nitsConContratosHistoricos) y solo para los NIT que ni la marca ni el REPS deciden.
//     Diferencia conocida con /inteligencia y con la carga de SECOP: secop_nits_ips (0730) toma el bool_or de las marcas
//     NO nulas de las sedes del NIT (el REPS solo si ninguna está marcada) y la carga baja por entidad solo esos NIT.
//     Cambia algo si un NIT tiene sedes con marcas distintas o una sede marcada y otra sin marca; con No + sin marca, la
//     sede sin marca sale pública por el REPS aunque su NIT no se cargue como entidad (solo llegan sus contratos con
//     proveedores vigilados). El 2026-10-24 había 0 NIT en cualquiera de esas combinaciones (de 47 con varias sedes).
//     Una sede que no es entidad de compra pública no entra en las compras del territorio aunque SECOP traiga
//     contratos a su nombre (marca manual = false: falso positivo, decisión 2026-10-12).
// Privacidad: la respuesta nunca lleva proveedor_key, proveedor_hash, documentos ni nombres de personas naturales ni de
// médicos (lo garantiza resumirCompras). Ninguna lectura escribe en la base ni llama a Google.
import { fetchAllRows } from '@/app/api/_lib/api-error'
import { isMissingRelationError, loadGirosNits, loadIdentificaBounds } from '@/app/api/intelligence/_lib/giros-server'
import { hoyBogota } from '@/app/api/secop/_lib/hoy'
import { loadHechos, loadSecopActualizado, loadVigiladosActivos } from '@/app/api/secop/_lib/secop-server'
import { nitOfHospital, parseResumen } from '@/lib/adres-intelligence'
import { resolverCompraPublica, type CompraPublicaOrigen, type SecopActualizado, type SecopFact } from '@/lib/compras-publicas'
import {
  MAPA_DETALLE_TEXTOS,
  contratosEnVentana,
  estadoCompras,
  ipsDelTerritorio,
  notaEstadoCompras,
  notaParteSede,
  textoSinIps,
  parteDeSede,
  resumirCompras,
  resumirGiros,
  ventanaGiros,
  ventanaSecop,
  type SedeMapa,
} from '@/lib/mapa-detalle'
import { supabaseAdmin, type SupabaseAdminClient } from '@/lib/supabase-admin'
import type { ComprasDetalle, GirosDetalle, IpsDetalle, TerritorioDetalle, Ventana } from '@/lib/types/mapa-detalle'

export type TerritorioTipo = TerritorioDetalle['territorio']['tipo']

/** IPS activa con lo que la tarjeta necesita: ubicarla, repartir por camas, nombrarla y saber su marca manual. */
export interface SedeMapaRow extends SedeMapa {
  name: string
  municipality_name: string | null
  department_name: string | null
  locality_id: string | null
  locality_name: string | null
  /** hospitals.compra_publica (0730): null = según el REPS; true/false = marcado a mano en la ficha. */
  compra_publica: boolean | null
}

const SEDE_COLUMNS = 'id, code, name, municipality_id, municipality_name, department_name, locality_id, locality_name, beds, compra_publica'

type Row = Record<string, unknown>
const str = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value))

function dbError(label: string, error: unknown): Error {
  const message = (error as { message?: string } | null)?.message ?? String(error)
  return Object.assign(new Error(`Error leyendo ${label}: ${message}`), { dbError: error })
}

/** TODAS las IPS activas (la parte por camas de un NIT necesita todas sus sedes). Una consulta paginada. */
export async function loadSedesMapa(db: SupabaseAdminClient = supabaseAdmin): Promise<SedeMapaRow[]> {
  const { data, error } = await fetchAllRows<Row>((from, to) =>
    db.from('hospitals').select(SEDE_COLUMNS).eq('active', true).order('id').range(from, to)
  )
  if (error) throw dbError('hospitals', error)
  return data.map(row => ({
    id: String(row.id),
    code: str(row.code),
    name: str(row.name) ?? '',
    municipality_id: str(row.municipality_id),
    municipality_name: str(row.municipality_name),
    department_name: str(row.department_name),
    locality_id: str(row.locality_id),
    locality_name: str(row.locality_name),
    beds: typeof row.beds === 'number' ? row.beds : null,
    compra_publica: row.compra_publica === true || row.compra_publica === false ? row.compra_publica : null,
  }))
}

/**
 * Naturaleza del REPS por NIT (reps_sedes.naturaleza), misma regla que naturalezaDeNit de secop-server.ts: 'Pública' si
 * alguna sede del NIT es pública, si no 'Mixta', si no 'Privada'; sin filas, el NIT no está en el mapa. Listas largas
 * en trozos de 150 por el largo de URL de PostgREST. Sin la tabla (migración 0620 sin aplicar) devuelve vacío.
 */
async function loadNaturalezaPorNit(nits: string[], db: SupabaseAdminClient): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (nits.length === 0) return out
  const valores = new Map<string, Set<string>>()
  for (let i = 0; i < nits.length; i += 150) {
    const chunk = nits.slice(i, i + 150)
    const { data, error } = await fetchAllRows<Row>((from, to) =>
      db.from('reps_sedes').select('nit, naturaleza').in('nit', chunk).order('nit').range(from, to)
    )
    if (error) {
      if (isMissingRelationError(error)) return out
      throw dbError('reps_sedes', error)
    }
    for (const row of data) {
      const nit = str(row.nit)
      if (!nit) continue
      const set = valores.get(nit) ?? new Set<string>()
      set.add((str(row.naturaleza) || '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
      valores.set(nit, set)
    }
  }
  valores.forEach((set, nit) => {
    if (set.has('publica')) out.set(nit, 'Pública')
    else if (set.has('mixta')) out.set(nit, 'Mixta')
    else out.set(nit, 'Privada')
  })
  return out
}

/** Contratos (hechos) de la ventana por NIT de entidad: si hay alguno, el criterio 3 ya está decidido sin ir a la vista. */
function hechosPorNit(facts: SecopFact[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const fact of facts) out.set(fact.nit_entidad, (out.get(fact.nit_entidad) ?? 0) + (fact.contratos || 1))
  return out
}

/**
 * Criterio 3 de resolverCompraPublica ("el NIT tiene contratos cargados en SECOP") sobre TODO el histórico, como la
 * ficha (loadContratosEntidad), pero sin traerlo: una consulta de existencia por NIT (select id … limit 1) en la vista
 * secop_contratos_unicos, de a 10 en paralelo. Solo se llama con los NIT que siguen sin decidir (sin marca manual,
 * REPS no Pública/Mixta y sin hechos en la ventana): en un territorio son pocos. Sin la vista (0730 sin aplicar) →
 * ninguno, como hace loadNaturalezaPorNit sin reps_sedes.
 */
async function nitsConContratosHistoricos(nits: string[], db: SupabaseAdminClient): Promise<Set<string>> {
  const out = new Set<string>()
  for (let i = 0; i < nits.length; i += 10) {
    const chunk = nits.slice(i, i + 10)
    const resultados = await Promise.all(chunk.map(nit => db.from('secop_contratos_unicos').select('id').eq('nit_entidad', nit).limit(1)))
    for (let j = 0; j < chunk.length; j++) {
      const { data, error } = resultados[j]
      if (error) {
        if (isMissingRelationError(error)) return out
        throw dbError('secop_contratos_unicos', error)
      }
      if ((data?.length ?? 0) > 0) out.add(chunk[j])
    }
  }
  return out
}

type CompraPublicaResuelta = ReturnType<typeof resolverCompraPublica>

/**
 * Entidad de compra pública por SEDE (id → veredicto): marca manual de la sede → REPS del NIT → contratos del NIT en
 * SECOP (resolverCompraPublica). La usan las dos tarjetas, así que territorio, IPS y ficha dan el mismo veredicto. El
 * tercer criterio usa primero los hechos de la ventana, ya leídos, y para las sedes que quedan en 'ninguno' pregunta
 * por el histórico de su NIT (hallazgo de la revisión del 2026-10-24). Las sedes sin NIT válido no entran.
 */
async function resolverPublicaPorSede(
  sedes: SedeMapaRow[],
  naturaleza: Map<string, string>,
  hechos: Map<string, number>,
  db: SupabaseAdminClient
): Promise<Map<string, CompraPublicaResuelta>> {
  const out = new Map<string, CompraPublicaResuelta>()
  const sinDecidir = new Set<string>()
  for (const sede of sedes) {
    const nit = nitOfHospital(sede)
    if (!nit) continue
    const resuelto = resolverCompraPublica(sede.compra_publica, naturaleza.get(nit) ?? null, hechos.get(nit) ?? 0)
    out.set(sede.id, resuelto)
    if (resuelto.origen === 'ninguno') sinDecidir.add(nit)
  }
  if (sinDecidir.size === 0) return out
  const conHistorico = await nitsConContratosHistoricos(Array.from(sinDecidir), db)
  for (const sede of sedes) {
    const nit = nitOfHospital(sede)
    if (nit && conHistorico.has(nit) && out.get(sede.id)?.origen === 'ninguno') {
      out.set(sede.id, resolverCompraPublica(sede.compra_publica, naturaleza.get(nit) ?? null, 1))
    }
  }
  return out
}

/** "Actualizado el…" de SECOP para la tarjeta: el último OK más reciente entre las fuentes secop*. */
export function actualizadoSecop(actualizado: SecopActualizado): string | null {
  let max: string | null = null
  for (const value of Object.values(actualizado)) if (value && (!max || value > max)) max = value
  return max
}

const nitsDe = (sedes: SedeMapa[]): string[] => {
  const out = new Set<string>()
  for (const sede of sedes) {
    const nit = nitOfHospital(sede)
    if (nit) out.add(nit)
  }
  return Array.from(out)
}

/** Nombre del municipio cuando no tiene IPS (no hay sede de la que tomarlo): tabla municipalities. */
async function nombreMunicipio(code: string, db: SupabaseAdminClient): Promise<{ nombre: string; departamento: string | null }> {
  const { data, error } = await db.from('municipalities').select('code, name, department_code').eq('code', code).limit(1)
  if (error) throw dbError('municipalities', error)
  const row = (data?.[0] as Row | undefined) ?? null
  const nombre = str(row?.name) ?? code
  const departmentCode = str(row?.department_code)
  if (!departmentCode) return { nombre, departamento: null }
  const { data: deps, error: depError } = await db.from('departments').select('code, name').eq('code', departmentCode).limit(1)
  if (depError) throw dbError('departments', depError)
  return { nombre, departamento: str((deps?.[0] as Row | undefined)?.name) }
}

/**
 * Detalle de un municipio (code = DANE de 5 dígitos, hospitals.municipality_id) o de una localidad de Bogotá (code =
 * 7 dígitos, hospitals.locality_id; nunca se pide el 11001 entero). Sin IPS activas: ips.total = 0, giros y compras
 * null y una sola nota (textoSinIps: "este municipio" / "esta localidad"). Con IPS: giros de todas; compras solo de las que son entidad de
 * compra pública; estado y notas según lib/mapa-detalle.ts.
 */
export async function cargarDetalleTerritorio(tipo: TerritorioTipo, code: string, db: SupabaseAdminClient = supabaseAdmin): Promise<TerritorioDetalle> {
  const [sedes, bounds] = await Promise.all([loadSedesMapa(db), loadIdentificaBounds(db)])
  const ips = ipsDelTerritorio(sedes, tipo, code)
  const enTerritorio = sedes.filter(sede => ips.has(sede.id))

  if (enTerritorio.length === 0) {
    // Municipio de alcance (o localidad) sin IPS en OpMap: el giro se atribuye a la IPS, así que aquí no hay dato.
    const { nombre, departamento } = tipo === 'municipio' ? await nombreMunicipio(code, db) : { nombre: `Localidad ${code}`, departamento: 'Bogotá, D.C.' }
    return {
      territorio: { code, tipo, nombre, departamento },
      ips: { total: 0, publicas: 0 },
      giros: null,
      compras: null,
      comprasEstado: 'sin_entidad_publica',
      notas: [textoSinIps(tipo)],
    }
  }

  const primera = enTerritorio[0]
  const nombre = (tipo === 'localidad' ? primera.locality_name : primera.municipality_name) ?? code
  const departamento = primera.department_name
  const nits = nitsDe(enTerritorio)
  if (nits.length === 0) {
    // Ninguna IPS del territorio tiene NIT válido: estado neutro, como la tarjeta de la IPS (ni giros en cero ni
    // "sin entidades públicas", que serían falsos).
    return {
      territorio: { code, tipo, nombre, departamento },
      ips: { total: enTerritorio.length, publicas: 0 },
      giros: null,
      compras: null,
      comprasEstado: 'sin_nit',
      notas: notas([notaEstadoCompras('sin_nit', tipo)]),
    }
  }
  const vGiros = ventanaGiros(bounds?.max ?? null)
  const vSecop = ventanaSecop(hoyBogota())

  const [resumenRaw, facts, vigilados, actualizado, naturaleza] = await Promise.all([
    vGiros ? loadGirosNits({ desde: vGiros.desde, hasta: vGiros.hasta, nits }, db) : Promise.resolve([] as unknown[]),
    loadHechos({ desde: vSecop.desde, hasta: vSecop.hasta, nits }, db),
    loadVigiladosActivos(db),
    loadSecopActualizado(db),
    loadNaturalezaPorNit(nits, db),
  ])

  // Qué sedes del territorio son entidad de compra pública (marca manual de la sede → REPS → contrató en SECOP).
  const publicaPorSede = await resolverPublicaPorSede(enTerritorio, naturaleza, hechosPorNit(facts), db)
  const ipsPublicas = new Set<string>()
  for (const sede of enTerritorio) if (publicaPorSede.get(sede.id)?.publica) ipsPublicas.add(sede.id)

  const giros: GirosDetalle | null = vGiros ? resumirGiros({ resumen: parseResumen(resumenRaw), hospitals: sedes, ips, ventana: vGiros }) : null
  const compras: ComprasDetalle | null =
    ipsPublicas.size > 0
      ? resumirCompras({ facts, hospitals: sedes, ips: ipsPublicas, vigilados, ventana: vSecop, actualizado: actualizadoSecop(actualizado) })
      : null
  const comprasEstado = estadoCompras(ipsPublicas.size, contratosEnVentana(compras), false)

  return {
    territorio: { code, tipo, nombre, departamento },
    ips: { total: enTerritorio.length, publicas: ipsPublicas.size },
    giros,
    compras,
    comprasEstado,
    notas: notas([notaEstadoCompras(comprasEstado, tipo), giros?.estimadoPorCamas ? MAPA_DETALLE_TEXTOS.estimadoPorCamas : null]),
  }
}

/**
 * Detalle de una IPS activa (null si no existe o está inactiva → la ruta responde 404). Cifras de ESTA sede: giros =
 * giro del NIT × parte por camas; compras = la misma parte sobre los hechos del NIT, solo si es entidad de compra
 * pública (la marca manual de la sede manda sobre el REPS). Sin NIT válido en hospitals.code no hay cruce posible.
 */
export async function cargarDetalleIps(id: string, db: SupabaseAdminClient = supabaseAdmin): Promise<IpsDetalle | null> {
  const [sedes, bounds] = await Promise.all([loadSedesMapa(db), loadIdentificaBounds(db)])
  const hospital = sedes.find(sede => sede.id === id)
  if (!hospital) return null
  const parte = parteDeSede(id, sedes) ?? { nit: null, sedesNit: 1, parte: 1 }
  const vGiros = ventanaGiros(bounds?.max ?? null)
  const vSecop = ventanaSecop(hoyBogota())

  if (!parte.nit) {
    // Estado neutro: sin NIT no hay giros ni compras que cruzar, y la tarjeta no la llama "privada". publica/origen
    // como la ficha sin NIT (false, 'ninguno'): no hay entidad con la cual cruzar, aunque la sede tenga marca manual.
    return {
      hospital: { id, nombre: hospital.name, nit: null, sedesNit: 1, parte: 1, compraPublica: false, compraPublicaOrigen: 'ninguno' },
      giros: null,
      compras: null,
      comprasEstado: 'sin_nit',
      notas: notas([MAPA_DETALLE_TEXTOS.sinNit]),
    }
  }

  const nits = [parte.nit]
  const [resumenRaw, facts, vigilados, actualizado, naturaleza] = await Promise.all([
    vGiros ? loadGirosNits({ desde: vGiros.desde, hasta: vGiros.hasta, nits }, db) : Promise.resolve([] as unknown[]),
    loadHechos({ desde: vSecop.desde, hasta: vSecop.hasta, nits }, db),
    loadVigiladosActivos(db),
    loadSecopActualizado(db),
    loadNaturalezaPorNit(nits, db),
  ])

  const resuelto = await resolverPublicaPorSede([hospital], naturaleza, hechosPorNit(facts), db)
  const { publica, origen } = resuelto.get(id) ?? { publica: false, origen: 'ninguno' as CompraPublicaOrigen }
  const giros: GirosDetalle | null = vGiros ? resumirGiros({ resumen: parseResumen(resumenRaw), hospitals: sedes, ips: [id], ventana: vGiros }) : null
  const compras: ComprasDetalle | null = publica
    ? resumirCompras({ facts, hospitals: sedes, ips: [id], vigilados, ventana: vSecop, actualizado: actualizadoSecop(actualizado) })
    : null
  const comprasEstado = estadoCompras(publica ? 1 : 0, contratosEnVentana(compras), !publica)

  return {
    hospital: {
      id,
      nombre: hospital.name,
      nit: parte.nit,
      sedesNit: parte.sedesNit,
      parte: parte.parte,
      compraPublica: publica,
      compraPublicaOrigen: origen,
    },
    giros,
    compras,
    comprasEstado,
    // Con n > 1 sedes la nota de parte ya dice "reparto por camas": no se repite la de estimación.
    notas: notas([notaEstadoCompras(comprasEstado), notaParteSede(parte.nit, parte.sedesNit)]),
  }
}

/** Notas de la tarjeta en orden, sin nulos y con el pie de fuentes al final. */
function notas(items: Array<string | null>): string[] {
  return [...items.filter((item): item is string => Boolean(item)), MAPA_DETALLE_TEXTOS.fuentes]
}

export type { Ventana }
