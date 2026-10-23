// cargarDatosZonas: lo que construirBloque (lib/zona-estadisticas.ts) necesita, cargado UNA sola vez por petición, para las
// dos rutas de la pantalla "Zonas" (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md):
//   - GET /api/kams/zonas: la tabla (sin servicios del REPS ni SECOP: ZonaCifras no los trae);
//   - GET /api/kams/[id]/estadisticas: "Datos de la zona" de UNA Zona, con los servicios del REPS y, solo con
//     intelligence:view (veComprasPublicas), las compras públicas de SECOP de las IPS de esa Zona.
// Así las cifras de /kams y las de "Datos de la zona" salen del mismo cargador y no pueden divergir. Sin visitas ni
// médicos (la ventana de /executives sigue con su propia carga en app/api/executives/[id]/estadisticas/route.ts).
// Las fuentes opcionales (DANE, BDUA, giros, SECOP, fecha de municipios) nunca tumban la respuesta: si fallan, la cifra
// sale "sin datos" y queda una nota (opcional). Nada de aquí calcula rutas ni consulta Google.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/app/api/_lib/api-error'
import { zoneDisplayName } from '@/lib/zone-names'
import { nitOfHospital } from '@/lib/adres-intelligence'
import { ventanaMeses } from '@/lib/compras-publicas'
import { hospitalGiroMap, municipioZoneShares, pickDaneYear } from '@/lib/poblacion-intelligence'
import { ZONA_SECOP_MESES, municipiosConIps, ultimaFecha, type DaneFila, type DatosZonas, type HospitalZona, type ZonaRef } from '@/lib/zona-estadisticas'
import {
  loadBduaResumen,
  loadGirosTotales,
  loadMunicipalityBase,
  loadPoblacionCortes,
  loadPoblacionHospitals,
  loadReachZones,
} from '@/app/api/intelligence/_lib/poblacion-server'
import { loadHechos, loadSecopActualizado } from '@/app/api/secop/_lib/secop-server'
import { hoyBogota } from '@/app/api/secop/_lib/hoy'

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Error de lectura con la tabla en el mensaje (y el error de PostgREST en `dbError`, para isMissingRelationError). */
export function dbError(label: string, error: unknown): Error {
  const message = (error as { message?: string } | null)?.message ?? String(error)
  return Object.assign(new Error(`Error leyendo ${label}: ${message}`), { dbError: error })
}

/**
 * Una fuente opcional: si falla (tabla o función ausente, tiempo de espera…), esa cifra sale "sin datos" con una nota y
 * el resto responde. El error queda en el registro del servidor con el nombre de la ruta.
 */
export async function opcional<T>(contexto: string, label: string, avisos: string[], load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`[api] ${contexto} · ${label}:`, error)
    avisos.push(`No se pudo leer ${label}: esa cifra aparece como "sin datos".`)
    return null
  }
}

/** Todas las Zonas (activas e inactivas) por id, con el nombre visible (sin el prefijo heredado "KAM "). */
export async function loadZonas(): Promise<Map<string, ZonaRef>> {
  const { data, error } = await supabaseAdmin.from('kams').select('id, name, base_city, active').range(0, 9999)
  if (error) throw dbError('kams', error)
  const map = new Map<string, ZonaRef>()
  for (const row of (data || []) as Array<{ id: string; name: string | null; base_city: string | null; active: boolean | null }>) {
    map.set(row.id, { kam_id: row.id, nombre: zoneDisplayName(row.name) || 'Zona sin nombre', ciudad_base: row.base_city ?? null, activa: row.active === true })
  }
  return map
}

/** Proyección DANE (total, cabecera, resto) de un año, por municipio. */
async function loadDaneAreas(anio: number): Promise<Map<string, DaneFila>> {
  const { data, error } = await fetchAllRows<{ municipality_code: string; total: unknown; cabecera: unknown; resto: unknown }>((from, to) =>
    supabaseAdmin.from('dane_proyecciones').select('municipality_code, total, cabecera, resto').eq('anio', anio).order('municipality_code').range(from, to)
  )
  if (error) throw dbError('dane_proyecciones', error)
  const map = new Map<string, DaneFila>()
  for (const row of data) {
    const total = toNumber(row.total)
    if (total !== null) map.set(row.municipality_code, { total, cabecera: toNumber(row.cabecera), resto: toNumber(row.resto) })
  }
  return map
}

/** service_flags y fecha de importación del REPS de las IPS activas (cirugía ortopédica y neurocirugía en la tarjeta de IPS). */
async function loadFlags(): Promise<Map<string, { service_flags: Record<string, unknown> | null; reps_updated_at: string | null }>> {
  const { data, error } = await fetchAllRows<{ id: string; service_flags: unknown; reps_updated_at: string | null }>((from, to) =>
    supabaseAdmin.from('hospitals').select('id, service_flags, reps_updated_at').eq('active', true).order('id').range(from, to)
  )
  if (error) throw dbError('hospitals', error)
  return new Map(
    data.map(row => [
      row.id,
      {
        service_flags: row.service_flags && typeof row.service_flags === 'object' && !Array.isArray(row.service_flags) ? (row.service_flags as Record<string, unknown>) : null,
        reps_updated_at: row.reps_updated_at ?? null,
      },
    ])
  )
}

/** municipality_zone.computed_at más reciente (fuente de la tarjeta de Municipios). */
async function loadMunicipalityZoneCalculo(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('municipality_zone').select('computed_at').order('computed_at', { ascending: false }).limit(1)
  if (error) throw dbError('municipality_zone', error)
  return (data?.[0] as { computed_at?: string | null } | undefined)?.computed_at ?? null
}

export interface OpcionesDatosZonas {
  /** Nombre de la ruta para el registro del servidor ("kams/zonas", "kams/[id]/estadisticas"). */
  contexto?: string
  /**
   * Leer service_flags y reps_updated_at de las IPS (una lectura más de hospitals): la ventana "Datos de la zona" muestra
   * los servicios habilitados del REPS; la tabla de Zonas no.
   */
  serviciosReps?: boolean
  /** Fecha del último cálculo de municipality_zone (tarjeta Municipios de la ventana). */
  fechaMunicipios?: boolean
  /**
   * Compras públicas de SECOP de las IPS de estas Zonas (ventana de ZONA_SECOP_MESES meses). Solo quien ve las compras
   * públicas (veComprasPublicas: intelligence:view); con null no se lee SECOP y los bloques salen con secop: null.
   */
  secop?: { kamIds: string[] } | null
}

export interface DatosCargados {
  datos: DatosZonas
  /** municipality_zone existe (sin ella los municipios sin IPS no se cuentan). */
  alcanceDisponible: boolean
  /** Hay tablas de giros pero ninguna fuente con giros cargados. */
  girosSinCargar: boolean
  /** municipality_zone.computed_at más reciente; solo con fechaMunicipios. */
  municipiosCalculados: string | null
}

/**
 * Carga, una sola vez, todo lo que construirBloque necesita. Las fuentes obligatorias (kams, hospitals, assignments,
 * municipios, cortes) lanzan si fallan; las demás son opcionales y dejan una nota en `avisos`.
 */
export async function cargarDatosZonas(avisos: string[], opciones: OpcionesDatosZonas = {}): Promise<DatosCargados> {
  const contexto = opciones.contexto ?? 'kams'
  const hoy = hoyBogota()
  const [zonas, hospitalData, reach, base, cortes, flags, mzCalculo] = await Promise.all([
    loadZonas(),
    loadPoblacionHospitals(null),
    loadReachZones(),
    loadMunicipalityBase(),
    loadPoblacionCortes(),
    opciones.serviciosReps ? loadFlags() : Promise.resolve(null),
    opciones.fechaMunicipios ? opcional(contexto, 'el cálculo de municipios por zona', avisos, loadMunicipalityZoneCalculo) : Promise.resolve(null),
  ])
  // Sin serviciosReps los flags van vacíos para no leer hospitals dos veces (la tabla de Zonas no los muestra).
  const hospitals: HospitalZona[] = hospitalData.hospitals.map(hospital => ({
    ...hospital,
    service_flags: flags?.get(hospital.id)?.service_flags ?? null,
    reps_updated_at: flags?.get(hospital.id)?.reps_updated_at ?? null,
  }))

  const daneAnio = cortes.dane.length > 0 ? pickDaneYear(hoy, cortes.dane) : Number(hoy.slice(0, 4))
  const bduaCorte = cortes.bdua.length > 0 ? cortes.bdua[cortes.bdua.length - 1] : null

  // SECOP solo de las IPS de las Zonas pedidas: el valor va al NIT y construirBloque lo reparte entre sus sedes por camas.
  const secopVentana = opciones.secop ? ventanaMeses(hoy, ZONA_SECOP_MESES) : null
  const enGrupo = new Set(opciones.secop?.kamIds ?? [])
  const nits = opciones.secop
    ? Array.from(new Set(hospitals.filter(hospital => hospital.kam_id && enGrupo.has(hospital.kam_id)).map(hospital => nitOfHospital(hospital)).filter((nit): nit is string => Boolean(nit))))
    : []

  const [dane, bdua, giros, facts, secopActualizado] = await Promise.all([
    daneAnio !== null ? opcional(contexto, 'las proyecciones del DANE', avisos, () => loadDaneAreas(daneAnio)) : Promise.resolve(null),
    bduaCorte ? opcional(contexto, 'los afiliados de la BDUA', avisos, () => loadBduaResumen(bduaCorte)) : Promise.resolve(null),
    opcional(contexto, 'los giros de la ADRES', avisos, () => loadGirosTotales(hospitals.map(hospital => hospital.code))),
    secopVentana ? opcional(contexto, 'las compras públicas de SECOP', avisos, () => loadHechos({ desde: secopVentana.desde, hasta: secopVentana.hasta, nits })) : Promise.resolve(null),
    secopVentana ? opcional(contexto, 'la fecha de actualización de SECOP', avisos, loadSecopActualizado) : Promise.resolve(null),
  ])

  const datos: DatosZonas = {
    zonas,
    hospitals,
    shares: municipioZoneShares(hospitals, reach.value),
    conIps: municipiosConIps(hospitals),
    municipios: new Map(base.municipalities.map(m => [m.code, { name: m.name, department_code: m.department_code }])),
    departamentos: base.departmentNames,
    dane: dane && dane.size > 0 && daneAnio !== null ? { anio: daneAnio, filas: dane } : null,
    bdua: bdua && bduaCorte ? { corte: bduaCorte, regimen: bdua.regimen, eps: bdua.eps } : null,
    giros:
      giros && giros.info.fuente && giros.info.desde && giros.info.hasta
        ? {
            porIps: hospitalGiroMap(hospitals, giros.totals),
            fuente: giros.info.fuente,
            desde: giros.info.desde,
            hasta: giros.info.hasta,
            regimenes: giros.info.regimenes,
          }
        : null,
    secop:
      facts && secopVentana
        ? { facts, desde: secopVentana.desde, hasta: secopVentana.hasta, actualizado: secopActualizado ? ultimaFecha(Object.values(secopActualizado)) : null }
        : null,
    visitas: null,
  }
  return { datos, alcanceDisponible: reach.available, girosSinCargar: Boolean(giros && !giros.info.fuente), municipiosCalculados: mzCalculo }
}
