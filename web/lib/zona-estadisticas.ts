// "Datos de la zona" (ventana de /executives): cuentas puras, sin red ni base de datos.
//
// La ventana muestra dos niveles para cada Ejecutivo Comercial (persona o vacante):
//   - Zona base: la zona de executives.base_kam_id.
//   - Territorio: las zonas que cubre en cada línea según la tabla coverage (local, por alcance o manual).
// Las cuentas REUTILIZAN las reglas que ya usa /inteligencia, sin inventar otras:
//   - Municipio → zona: municipioZoneShares (lib/poblacion-intelligence.ts). Un municipio con IPS asignadas va a sus
//     zonas en proporción a las camas (Bogotá entre sus 4 zonas, Sogamoso entre 2); uno sin IPS va entero a la zona
//     que lo tiene "de alcance" en municipality_zone (tiempo real de carretera). Fuera de alcance y sin acceso
//     terrestre no van a ninguna zona. Nada se cuenta dos veces.
//   - Camas: camasCapacidad (las del REPS si se importaron; si no, las de la ficha).
//   - Giros ADRES: el giro va al NIT y se reparte entre sus sedes activas por camas (hospitalGiroMap / sedeShares).
//   - SECOP: aggregateSecopRanking (lib/compras-publicas.ts) sobre la vista sin duplicados, valor adjudicado, solo las
//     6 líneas ortopédicas, fuera de escala y servicios de especialistas aparte, y el valor de un NIT repartido entre
//     sus sedes por camas.
// Quién ve qué (puedeVerDatosDeZona, veComprasPublicas, lineasConCobertura): las mismas reglas de las páginas de donde
// salen las cifras; la ruta las aplica antes de leer nada.
// Imports relativos (no '@/') para que las pruebas con tsx lo usen tal cual (scripts/zona-estadisticas-check.ts).
import { addMonthsYm, aggregateSecopRanking, monthEndYm, type SecopFact } from './compras-publicas'
import type { Role } from './permissions'
import { tienePermisoDe } from './empresas-reglas'
import {
  camasCapacidad,
  topEps,
  type BduaRegimenRow,
  type EpsAfiliadosRow,
  type EpsTop,
  type GiroRegimen,
  type PoblacionHospital,
  type ZoneShare,
} from './poblacion-intelligence'

/** NIT de VG Medical (9 dígitos, sin DV): sus ventas en SECOP se muestran aparte. */
export const VG_MEDICAL_NIT = '901080496'
/** Ventanas de la ventana: giros y SECOP de 12 meses; visitas de VMO de los últimos 3 meses con datos. */
export const ZONA_SECOP_MESES = 12
export const ZONA_VISITAS_MESES = 3
/** EPS principales que se muestran por bloque. */
export const ZONA_TOP_EPS = 3

export type KindCobertura = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'
export type KindTerritorio = 'local' | 'reach' | 'manual'

// ---------------------------------------------------------------------------
// Tipos de la respuesta (GET /api/executives/[id]/estadisticas). La UI los importa con `import type`.
// ---------------------------------------------------------------------------

export interface LineaRef {
  id: string
  code: string
  name: string
}

export interface ZonaRef {
  kam_id: string
  nombre: string
  ciudad_base: string | null
  activa: boolean
}

export interface BloqueMunicipios {
  total: number
  /** Con IPS activas asignadas a la zona hoy. */
  conIps: number
  /** Sin IPS hoy, dentro del alcance por carretera (municipality_zone). */
  alcance: number
  /** Repartidos con zonas fuera del grupo (Bogotá, Sogamoso): cuentan por su parte. */
  compartidos: number
  compartidosNombres: string[]
  departamentos: Array<{ code: string; nombre: string; municipios: number }>
}

export interface BloquePoblacion {
  anio: number
  total: number
  cabecera: number
  rural: number
  /** Municipios del bloque sin proyección del DANE para ese año. */
  municipiosSinDato: number
}

export interface BloqueAfiliados {
  corte: string
  contributivo: number
  subsidiado: number
  total: number
  municipiosSinDato: number
  eps: EpsTop[]
}

export interface BloqueIps {
  total: number
  camas: number
  /** Suma de quirófanos del REPS; null si ninguna IPS del bloque tiene el dato. */
  quirofanos: number | null
  /** IPS con servicios habilitados del REPS importados (hospital_services → service_flags). */
  conServiciosReps: number
  cirugiaOrtopedica: number
  neurocirugia: number
  /** Con cirugía ortopédica o neurocirugía (cada IPS una vez). */
  ortopediaONeuro: number
  repsActualizado: string | null
}

export interface BloqueGiros {
  valor: number
  ipsConGiro: number
  fuente: 'identifica' | 'reporte29'
  desde: string // 'YYYY-MM'
  hasta: string
  regimenes: GiroRegimen[]
}

export interface BloqueSecop {
  valor: number
  contratos: number
  /** Entidades (NIT) con compras en el periodo. */
  entidades: number
  ultimaFecha: string | null
  vg: { valor: number; contratos: number; entidades: number }
  desde: string // 'YYYY-MM-DD'
  hasta: string
  actualizado: string | null
}

export interface BloqueVisitas {
  desde: string // 'YYYY-MM-DD'
  hasta: string
  total: number
  efectivas: number
  noEfectivas: number
  /** "Visita extra" u otro tipo. */
  otras: number
  presenciales: number
  virtuales: number
  ipsVisitadas: number
  /** Última visita de VMO registrada en estas zonas (aunque sea anterior a la ventana). */
  ultimaVisita: string | null
}

export interface BloqueZona {
  zonas: ZonaRef[]
  municipios: BloqueMunicipios
  /** null = sin datos (la fuente no está cargada). */
  poblacion: BloquePoblacion | null
  afiliados: BloqueAfiliados | null
  ips: BloqueIps
  giros: BloqueGiros | null
  secop: BloqueSecop | null
  visitas: BloqueVisitas | null
}

/** Quién cubre la zona base en una línea. kind null = la línea no tiene fila de cobertura para esa zona. */
export interface CoberturaZonaLinea {
  line: LineaRef
  kind: KindCobertura | null
  executive: { id: string; full_name: string; status: string } | null
  travel_minutes: number | null
  nearest: { full_name: string; minutes: number } | null
}

/** Zonas que cubre la persona en una línea. */
export interface CoberturaLineaEjecutivo {
  line: LineaRef
  /** La persona lleva la línea (executive_lines). */
  lleva: boolean
  zonas: Array<{ kam_id: string; nombre: string; kind: KindTerritorio; travel_minutes: number | null }>
}

export interface ZonaEstadisticasResponse {
  executive: {
    id: string
    full_name: string
    status: 'active' | 'placeholder' | 'inactive'
    created_at: string | null
    lineas: LineaRef[]
  }
  zonaBase: ZonaRef | null
  /** Zona base; null si la persona no tiene zona base. */
  base: BloqueZona | null
  /** Unión de las zonas que cubre en las líneas de acceso.lineasCobertura; null si no cubre ninguna. */
  territorio: BloqueZona | null
  /** El territorio es exactamente la zona base. */
  territorioIgualBase: boolean
  /** Quién cubre la zona base, solo en las líneas de acceso.lineasCobertura. */
  coberturaBase: CoberturaZonaLinea[]
  /** Zonas que cubre la persona, solo en las líneas de acceso.lineasCobertura. */
  coberturaEjecutivo: CoberturaLineaEjecutivo[]
  /** Fecha del último cálculo de la cobertura (coverage.computed_at) de esas líneas. */
  coberturaCalculada: string | null
  /** La persona se creó después del último cálculo de la cobertura: falta recalcularla. */
  coberturaDesactualizada: boolean
  /** null = quien consulta no ve Terceros (terceros:view). */
  medicos: { total: number; porLinea: Array<{ line: LineaRef; total: number }> } | null
  fuentes: {
    /** municipality_zone.computed_at más reciente. */
    municipiosCalculados: string | null
    poblacionAnio: number | null
    bduaCorte: string | null
  }
  /** Lo que ve quien abre la ventana (puedeVerDatosDeZona, veComprasPublicas, lineasConCobertura). */
  acceso: {
    /** Compras públicas de SECOP y la parte de VG Medical. Sin él, `secop` va null en los bloques y no se lee SECOP. */
    comprasPublicas: boolean
    /** Ve la cobertura de todas las líneas activas (map:all-lines). */
    todasLasLineas: boolean
    /** Líneas cuya cobertura (y con ella el territorio) se muestra. */
    lineasCobertura: LineaRef[]
  }
  notas: string[]
  generado: string
}

/**
 * GET /api/kams/[id]/estadisticas: "Datos de la zona" de UNA Zona (ciudad base), sin persona, territorio, médicos ni
 * visitas, para que una Zona sin nadie (Ibagué, Engativá…) también tenga dónde verlas (spec 2026-10-23, E1 "Ver datos").
 * Mismas reglas y la misma puerta (puedeVerDatosDeZona, veComprasPublicas, lineasConCobertura) que la ventana de
 * /executives. La UI (app/kams/ZonaDatosModal.tsx) lo importa con `import type`.
 */
export interface ZonaDatosResponse {
  zona: ZonaRef
  /** construirBloque([kam_id]): IPS y camas, municipios, población, afiliados, giros y, con intelligence:view, SECOP. */
  bloque: BloqueZona
  /** Quién cubre la Zona en cada línea, solo en las de acceso.lineasCobertura (coberturaDeZona). */
  coberturaBase: CoberturaZonaLinea[]
  /** Fecha del último cálculo de la cobertura (coverage.computed_at) de esas líneas. */
  coberturaCalculada: string | null
  fuentes: {
    municipiosCalculados: string | null
    poblacionAnio: number | null
    bduaCorte: string | null
  }
  acceso: {
    comprasPublicas: boolean
    todasLasLineas: boolean
    lineasCobertura: LineaRef[]
  }
  notas: string[]
  generado: string
}

// ---------------------------------------------------------------------------
// Quién ve qué
// ---------------------------------------------------------------------------

/**
 * ¿Puede abrir la ventana? Además de executives:view (la página /executives), hospitals:view: sus cifras salen de las
 * IPS (camas, servicios del REPS, giros repartidos por sede, población repartida por camas), lo mismo que pide la ficha
 * de la IPS con sus tarjetas de giros y de entorno. Hoy lo tienen todos los roles salvo recursos humanos (hr).
 */
export function puedeVerDatosDeZona(role: Role | undefined | readonly { papel: Role }[]): boolean {
  return tienePermisoDe(role, 'executives:view') && tienePermisoDe(role, 'hospitals:view')
}

/**
 * ¿Ve las compras públicas (SECOP y la parte de VG Medical)? intelligence:view, el permiso de /api/secop/* y de la
 * tarjeta de SECOP de la ficha de la IPS. Sin él la ruta ni siquiera lee SECOP.
 */
export function veComprasPublicas(role: Role | undefined | readonly { papel: Role }[]): boolean {
  return tienePermisoDe(role, 'intelligence:view')
}

/**
 * Líneas cuya cobertura muestra la ventana (y con ella el territorio): las de GET /api/me/lines (resolveUserLines de
 * lib/coverage.ts), la misma regla de /api/coverage?line=, que responde 403 en las demás. Con map:all-lines (canSeeAll)
 * todas; si no, las que lidera o lleva como Ejecutivo Comercial; sin ninguna, ninguna. Conserva el orden de `lineas`.
 */
export function lineasConCobertura<T extends { id: string }>(
  lineas: readonly T[],
  me: { canSeeAll: boolean; lines: ReadonlyArray<{ id: string }> }
): T[] {
  if (me.canSeeAll) return [...lineas]
  const mias = new Set(me.lines.map(line => line.id))
  return lineas.filter(line => mias.has(line.id))
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const nonNegative = (value: number | null | undefined): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}
const maxDate = (a: string | null, b: string | null | undefined): string | null => (!b ? a : !a ? b : a > b ? a : b)
const compareEs = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })
const normalizeText = (value: string | null | undefined) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/** ¿Tienen las dos listas las mismas zonas (sin importar el orden)? */
export function mismasZonas(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  return Array.from(sa).every(id => sb.has(id))
}

// ---------------------------------------------------------------------------
// Cobertura por línea
// ---------------------------------------------------------------------------

export interface CoberturaFila {
  kam_id: string
  zone_name: string
  kind: KindCobertura
  executive: { id: string; full_name: string; status: string } | null
  travel_minutes: number | null
  nearest: { full_name: string; minutes: number } | null
}

export interface CoberturaLineaEntrada {
  line: LineaRef
  rows: CoberturaFila[]
}

/** Quién cubre una zona en cada línea (todas las líneas activas, en el orden recibido). */
export function coberturaDeZona(lineas: CoberturaLineaEntrada[], kamId: string): CoberturaZonaLinea[] {
  return lineas.map(({ line, rows }) => {
    const row = rows.find(item => item.kam_id === kamId)
    if (!row) return { line, kind: null, executive: null, travel_minutes: null, nearest: null }
    return {
      line,
      kind: row.kind,
      executive: row.executive ? { id: row.executive.id, full_name: row.executive.full_name, status: row.executive.status } : null,
      travel_minutes: row.travel_minutes,
      nearest: row.kind === 'vacant' ? row.nearest : null,
    }
  })
}

const KIND_ORDEN: Record<KindTerritorio, number> = { local: 0, manual: 1, reach: 2 }

/**
 * Zonas que cubre la persona en cada línea (filas de coverage con su executive_id y kind local, reach o manual). Entran
 * las líneas que lleva y las que, sin llevarlas, le dan alguna zona. Orden de zonas: local, manual, por alcance (de
 * menos a más minutos) y nombre.
 */
export function coberturaDeEjecutivo(
  lineas: CoberturaLineaEntrada[],
  executiveId: string,
  lineasQueLleva: ReadonlySet<string>
): CoberturaLineaEjecutivo[] {
  const out: CoberturaLineaEjecutivo[] = []
  for (const { line, rows } of lineas) {
    const zonas = rows
      .filter(row => row.executive?.id === executiveId && (row.kind === 'local' || row.kind === 'reach' || row.kind === 'manual'))
      .map(row => ({ kam_id: row.kam_id, nombre: row.zone_name, kind: row.kind as KindTerritorio, travel_minutes: row.travel_minutes }))
      .sort(
        (a, b) =>
          KIND_ORDEN[a.kind] - KIND_ORDEN[b.kind] ||
          (a.travel_minutes ?? 0) - (b.travel_minutes ?? 0) ||
          compareEs(a.nombre, b.nombre) ||
          a.kam_id.localeCompare(b.kam_id)
      )
    const lleva = lineasQueLleva.has(line.id)
    if (lleva || zonas.length > 0) out.push({ line, lleva, zonas })
  }
  return out
}

/** Zonas del territorio: la unión de las de todas sus líneas, sin repetir, en orden de aparición. */
export function zonasDelTerritorio(cobertura: CoberturaLineaEjecutivo[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const linea of cobertura) {
    for (const zona of linea.zonas) {
      if (seen.has(zona.kam_id)) continue
      seen.add(zona.kam_id)
      out.push(zona.kam_id)
    }
  }
  return out
}

/** Fecha más reciente de un conjunto de cálculos (ISO), o null. */
export function ultimaFecha(fechas: Array<string | null | undefined>): string | null {
  return fechas.reduce<string | null>((acc, value) => maxDate(acc, value), null)
}

/** ¿La persona se creó después del último cálculo de la cobertura? (sin fechas: no se sabe → false) */
export function coberturaDesactualizada(createdAt: string | null, calculada: string | null): boolean {
  if (!createdAt || !calculada) return false
  const a = Date.parse(createdAt)
  const b = Date.parse(calculada)
  return Number.isFinite(a) && Number.isFinite(b) && a > b
}

// ---------------------------------------------------------------------------
// Municipios, población y afiliados
// ---------------------------------------------------------------------------

export interface MunicipioZona {
  code: string
  nombre: string
  department_code: string
  /** Parte del municipio que toca al grupo de zonas (0..1]. */
  parte: number
  tipo: 'ips' | 'alcance'
  /** Una parte va a zonas fuera del grupo. */
  compartido: boolean
}

/** Municipios con IPS activas asignadas hoy a alguna zona (para separar "con IPS" de "de alcance"). */
export function municipiosConIps(hospitals: Array<Pick<PoblacionHospital, 'municipality_id' | 'kam_id'>>): Set<string> {
  const out = new Set<string>()
  for (const hospital of hospitals) {
    const code = (hospital.municipality_id || '').trim()
    if (code && hospital.kam_id) out.add(code)
  }
  return out
}

const EPS_PARTE = 1e-9

/**
 * Municipios de un grupo de zonas con la parte que le toca a cada uno (de municipioZoneShares). Un municipio entra si
 * alguna de las zonas tiene parte en él.
 */
export function municipiosDeZonas(params: {
  shares: Map<string, ZoneShare[]>
  kamIds: Iterable<string>
  conIps: ReadonlySet<string>
  municipios: Map<string, { name: string; department_code: string }>
}): MunicipioZona[] {
  const set = new Set(params.kamIds)
  const out: MunicipioZona[] = []
  params.shares.forEach((list, code) => {
    let parte = 0
    let fuera = 0
    for (const item of list) {
      if (item.kam_id && set.has(item.kam_id)) parte += item.share
      else fuera += item.share
    }
    if (parte <= EPS_PARTE) return
    const municipio = params.municipios.get(code)
    out.push({
      code,
      nombre: municipio?.name || code,
      department_code: municipio?.department_code || code.slice(0, 2),
      parte: Math.min(1, parte),
      tipo: params.conIps.has(code) ? 'ips' : 'alcance',
      compartido: fuera > EPS_PARTE,
    })
  })
  return out.sort((a, b) => compareEs(a.nombre, b.nombre) || a.code.localeCompare(b.code))
}

/** Conteos de municipios y departamentos (departamentos de más a menos municipios, luego por nombre). */
export function resumirMunicipios(lista: MunicipioZona[], departamentos: Map<string, string>): BloqueMunicipios {
  const porDepartamento = new Map<string, number>()
  for (const municipio of lista) porDepartamento.set(municipio.department_code, (porDepartamento.get(municipio.department_code) || 0) + 1)
  return {
    total: lista.length,
    conIps: lista.filter(item => item.tipo === 'ips').length,
    alcance: lista.filter(item => item.tipo === 'alcance').length,
    compartidos: lista.filter(item => item.compartido).length,
    compartidosNombres: lista.filter(item => item.compartido).map(item => item.nombre),
    departamentos: Array.from(porDepartamento, ([code, municipios]) => ({ code, nombre: departamentos.get(code) || code, municipios })).sort(
      (a, b) => b.municipios - a.municipios || compareEs(a.nombre, b.nombre)
    ),
  }
}

export interface DaneFila {
  total: number
  cabecera: number | null
  resto: number | null
}

/** Población DANE del grupo: cada municipio por su parte. null si no hay proyecciones cargadas. */
export function poblacionDeZonas(lista: MunicipioZona[], dane: Map<string, DaneFila> | null, anio: number | null): BloquePoblacion | null {
  if (!dane || dane.size === 0 || anio === null) return null
  let total = 0
  let cabecera = 0
  let rural = 0
  let sinDato = 0
  for (const municipio of lista) {
    const fila = dane.get(municipio.code)
    if (!fila) {
      sinDato++
      continue
    }
    total += nonNegative(fila.total) * municipio.parte
    cabecera += nonNegative(fila.cabecera) * municipio.parte
    rural += nonNegative(fila.resto) * municipio.parte
  }
  return { anio, total: Math.round(total), cabecera: Math.round(cabecera), rural: Math.round(rural), municipiosSinDato: sinDato }
}

/**
 * Afiliados activos de la BDUA por régimen (contributivo y subsidiado; la BDUA no trae excepción) y las EPS principales
 * (de las 12 más grandes de cada municipio que da poblacion_bdua_resumen), cada municipio por su parte.
 */
export function afiliadosDeZonas(
  lista: MunicipioZona[],
  bdua: { corte: string; regimen: BduaRegimenRow[]; eps: EpsAfiliadosRow[] } | null,
  topN = ZONA_TOP_EPS
): BloqueAfiliados | null {
  if (!bdua || bdua.regimen.length === 0) return null
  const porMunicipio = new Map<string, { contributivo: number; subsidiado: number }>()
  for (const row of bdua.regimen) {
    const current = porMunicipio.get(row.municipio) || { contributivo: 0, subsidiado: 0 }
    const regimen = normalizeText(row.regimen)
    if (regimen === 'contributivo') current.contributivo += nonNegative(row.afiliados)
    else if (regimen === 'subsidiado') current.subsidiado += nonNegative(row.afiliados)
    porMunicipio.set(row.municipio, current)
  }
  const partes = new Map(lista.map(item => [item.code, item.parte]))
  let contributivo = 0
  let subsidiado = 0
  let sinDato = 0
  for (const municipio of lista) {
    const fila = porMunicipio.get(municipio.code)
    if (!fila) {
      sinDato++
      continue
    }
    contributivo += fila.contributivo * municipio.parte
    subsidiado += fila.subsidiado * municipio.parte
  }
  const porEps = new Map<string, { nombre: string; afiliados: number }>()
  for (const row of bdua.eps) {
    const parte = partes.get(row.municipio)
    if (!parte) continue
    const current = porEps.get(row.eps_codigo)
    if (current) current.afiliados += nonNegative(row.afiliados) * parte
    else porEps.set(row.eps_codigo, { nombre: row.eps_nombre, afiliados: nonNegative(row.afiliados) * parte })
  }
  const c = Math.round(contributivo)
  const s = Math.round(subsidiado)
  return { corte: bdua.corte, contributivo: c, subsidiado: s, total: c + s, municipiosSinDato: sinDato, eps: topEps(porEps, topN) }
}

// ---------------------------------------------------------------------------
// IPS, giros y compras públicas
// ---------------------------------------------------------------------------

/** IPS activa con sus servicios del REPS (hospitals.service_flags, que llena la importación de hospital_services). */
export interface HospitalZona extends PoblacionHospital {
  service_flags: Record<string, unknown> | null
  reps_updated_at: string | null
}

const flagsDe = (hospital: Pick<HospitalZona, 'service_flags'>): Record<string, unknown> => {
  const flags = hospital.service_flags
  return flags && typeof flags === 'object' && !Array.isArray(flags) ? flags : {}
}

const enZonas = (hospital: Pick<PoblacionHospital, 'kam_id'>, set: ReadonlySet<string>) => Boolean(hospital.kam_id && set.has(hospital.kam_id))

/** IPS objetivo del grupo: activas asignadas hoy (assignments) a sus zonas. */
export function ipsDeZonas(hospitals: HospitalZona[], kamIds: Iterable<string>): BloqueIps {
  const set = new Set(kamIds)
  const out: BloqueIps = {
    total: 0,
    camas: 0,
    quirofanos: null,
    conServiciosReps: 0,
    cirugiaOrtopedica: 0,
    neurocirugia: 0,
    ortopediaONeuro: 0,
    repsActualizado: null,
  }
  for (const hospital of hospitals) {
    if (!enZonas(hospital, set)) continue
    out.total++
    out.camas += camasCapacidad(hospital)
    if (typeof hospital.quirofanos === 'number' && Number.isFinite(hospital.quirofanos)) {
      out.quirofanos = (out.quirofanos ?? 0) + nonNegative(hospital.quirofanos)
    }
    const flags = flagsDe(hospital)
    if (Object.keys(flags).length > 0) out.conServiciosReps++
    const ortopedica = flags.cirugia_ortopedica === true
    const neuro = flags.neurocirugia === true
    if (ortopedica) out.cirugiaOrtopedica++
    if (neuro) out.neurocirugia++
    if (ortopedica || neuro) out.ortopediaONeuro++
    out.repsActualizado = maxDate(out.repsActualizado, hospital.reps_updated_at)
  }
  out.camas = Math.round(out.camas)
  return out
}

/** Giro ADRES del grupo: suma del giro de cada IPS (ya repartido por sede con hospitalGiroMap). */
export function girosDeZonas(
  hospitals: Array<Pick<PoblacionHospital, 'id' | 'kam_id'>>,
  kamIds: Iterable<string>,
  porIps: Map<string, number>
): { valor: number; ipsConGiro: number } {
  const set = new Set(kamIds)
  let valor = 0
  let ipsConGiro = 0
  for (const hospital of hospitals) {
    if (!enZonas(hospital, set)) continue
    const giro = porIps.get(hospital.id) ?? 0
    if (giro > 0) {
      valor += giro
      ipsConGiro++
    }
  }
  return { valor: Math.round(valor * 100) / 100, ipsConGiro }
}

const GRUPO_SECOP = '__zonas__'

/**
 * Compras públicas del grupo con la misma agregación del ranking por zona de /inteligencia (aggregateSecopRanking):
 * todas las sedes del grupo pasan a una sola "zona" para que un contrato cuente una vez aunque su NIT tenga sedes en
 * dos de sus zonas; las sedes de fuera conservan su zona (su parte del valor no entra). VG Medical: lo mismo con sus
 * contratos (proveedor NIT 901080496).
 */
export function secopDeZonas(
  facts: SecopFact[],
  hospitals: PoblacionHospital[],
  kamIds: Iterable<string>
): Pick<BloqueSecop, 'valor' | 'contratos' | 'entidades' | 'ultimaFecha' | 'vg'> {
  const set = new Set(kamIds)
  const mapped = hospitals.map(hospital => (enZonas(hospital, set) ? { ...hospital, kam_id: GRUPO_SECOP, zone_name: 'Zonas' } : hospital))
  const fila = (lista: SecopFact[]) =>
    aggregateSecopRanking({ facts: lista, hospitals: mapped, group: 'zona', filter: {}, vigilados: new Set(), withExecutive: false }).rows.find(
      row => row.key === GRUPO_SECOP
    ) ?? null
  const total = fila(facts)
  const vg = fila(facts.filter(fact => fact.proveedor_nit === VG_MEDICAL_NIT))
  return {
    valor: total?.valor ?? 0,
    contratos: total?.contratos ?? 0,
    entidades: total?.hospitales ?? 0,
    ultimaFecha: total?.ultimaFecha ?? null,
    vg: { valor: vg?.valor ?? 0, contratos: vg?.contratos ?? 0, entidades: vg?.hospitales ?? 0 },
  }
}

// ---------------------------------------------------------------------------
// Visitas (histórico de VMO) y médicos
// ---------------------------------------------------------------------------

export interface VisitaFila {
  kam_id: string | null
  visit_date: string
  visit_type: string | null
  contact_type: string | null
  hospital_id: string | null
}

/** Los N meses calendario que terminan en el mes de la última visita cargada: { desde: día 1, hasta: fin de mes }. */
export function ventanaVisitas(ultima: string | null, meses = ZONA_VISITAS_MESES): { desde: string; hasta: string } | null {
  if (!ultima || !/^\d{4}-\d{2}/.test(ultima)) return null
  const ym = ultima.slice(0, 7)
  return { desde: `${addMonthsYm(ym, -(Math.max(1, meses) - 1))}-01`, hasta: monthEndYm(ym) }
}

/** Visitas del grupo en la ventana, por tipo (efectiva / no efectiva) y contacto (presencial / virtual). */
export function resumirVisitas(
  filas: VisitaFila[],
  kamIds: Iterable<string>,
  ventana: { desde: string; hasta: string }
): BloqueVisitas {
  const set = new Set(kamIds)
  const out: BloqueVisitas = {
    desde: ventana.desde,
    hasta: ventana.hasta,
    total: 0,
    efectivas: 0,
    noEfectivas: 0,
    otras: 0,
    presenciales: 0,
    virtuales: 0,
    ipsVisitadas: 0,
    ultimaVisita: null,
  }
  const ips = new Set<string>()
  for (const fila of filas) {
    if (!fila.kam_id || !set.has(fila.kam_id)) continue
    const fecha = (fila.visit_date || '').slice(0, 10)
    out.ultimaVisita = maxDate(out.ultimaVisita, fecha || null)
    if (!fecha || fecha < ventana.desde || fecha > ventana.hasta) continue
    out.total++
    const tipo = normalizeText(fila.visit_type)
    if (tipo === 'visita efectiva') out.efectivas++
    else if (tipo === 'visita no efectiva') out.noEfectivas++
    else out.otras++
    const contacto = normalizeText(fila.contact_type)
    if (contacto === 'visita presencial') out.presenciales++
    else if (contacto === 'visita virtual') out.virtuales++
    if (fila.hospital_id) ips.add(fila.hospital_id)
  }
  out.ipsVisitadas = ips.size
  return out
}

/** Médicos con la persona como visitante vigente (medico_visitantes con hasta NULL): total sin repetir y por línea. */
export function contarMedicos(
  filas: Array<{ medico_id: string; line_id: string }>,
  lineas: LineaRef[]
): { total: number; porLinea: Array<{ line: LineaRef; total: number }> } {
  const total = new Set<string>()
  const porLinea = new Map<string, Set<string>>()
  for (const fila of filas) {
    total.add(fila.medico_id)
    const set = porLinea.get(fila.line_id) || new Set<string>()
    set.add(fila.medico_id)
    porLinea.set(fila.line_id, set)
  }
  const byId = new Map(lineas.map(line => [line.id, line]))
  return {
    total: total.size,
    porLinea: Array.from(porLinea, ([lineId, set]) => ({ line: byId.get(lineId) ?? { id: lineId, code: '', name: 'Línea desconocida' }, total: set.size })).sort(
      (a, b) => b.total - a.total || compareEs(a.line.name, b.line.name)
    ),
  }
}

// ---------------------------------------------------------------------------
// Bloque completo
// ---------------------------------------------------------------------------

/** Todo lo cargado de la base, una sola vez por petición (los dos bloques lo comparten). */
export interface DatosZonas {
  zonas: Map<string, ZonaRef>
  hospitals: HospitalZona[]
  shares: Map<string, ZoneShare[]>
  conIps: ReadonlySet<string>
  municipios: Map<string, { name: string; department_code: string }>
  departamentos: Map<string, string>
  dane: { anio: number; filas: Map<string, DaneFila> } | null
  bdua: { corte: string; regimen: BduaRegimenRow[]; eps: EpsAfiliadosRow[] } | null
  giros: { porIps: Map<string, number>; fuente: 'identifica' | 'reporte29'; desde: string; hasta: string; regimenes: GiroRegimen[] } | null
  secop: { facts: SecopFact[]; desde: string; hasta: string; actualizado: string | null } | null
  visitas: { ventana: { desde: string; hasta: string }; filas: VisitaFila[] } | null
}

export function construirBloque(kamIds: string[], datos: DatosZonas): BloqueZona {
  const lista = municipiosDeZonas({ shares: datos.shares, kamIds, conIps: datos.conIps, municipios: datos.municipios })
  const giros = datos.giros ? girosDeZonas(datos.hospitals, kamIds, datos.giros.porIps) : null
  const secop = datos.secop ? secopDeZonas(datos.secop.facts, datos.hospitals, kamIds) : null
  return {
    zonas: kamIds
      .map(id => datos.zonas.get(id) ?? { kam_id: id, nombre: 'Zona sin nombre', ciudad_base: null, activa: false })
      .sort((a, b) => compareEs(a.nombre, b.nombre)),
    municipios: resumirMunicipios(lista, datos.departamentos),
    poblacion: poblacionDeZonas(lista, datos.dane?.filas ?? null, datos.dane?.anio ?? null),
    afiliados: afiliadosDeZonas(lista, datos.bdua),
    ips: ipsDeZonas(datos.hospitals, kamIds),
    giros:
      giros && datos.giros
        ? { ...giros, fuente: datos.giros.fuente, desde: datos.giros.desde, hasta: datos.giros.hasta, regimenes: datos.giros.regimenes }
        : null,
    secop: secop && datos.secop ? { ...secop, desde: datos.secop.desde, hasta: datos.secop.hasta, actualizado: datos.secop.actualizado } : null,
    visitas: datos.visitas ? resumirVisitas(datos.visitas.filas, kamIds, datos.visitas.ventana) : null,
  }
}

// ---------------------------------------------------------------------------
// Formato (es-CO; lo usa la ventana)
// ---------------------------------------------------------------------------

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** 'YYYY-MM-DD' o una marca de tiempo ISO → '2 oct 2026' (fecha de Bogotá). null → 'sin fecha'. */
export function fechaEs(value: string | null | undefined): string {
  if (!value) return 'sin fecha'
  let iso = value.slice(0, 10)
  if (value.length > 10) {
    const time = Date.parse(value)
    if (Number.isFinite(time)) iso = new Date(time).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  }
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d || m < 1 || m > 12) return value
  return `${d} ${MESES[m - 1]} ${y}`
}

/** 'YYYY-MM' (o 'YYYY-MM-DD') → 'oct 2026'. */
export function mesEs(value: string | null | undefined): string {
  if (!value) return 'sin fecha'
  const [y, m] = value.slice(0, 7).split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return value
  return `${MESES[m - 1]} ${y}`
}

/** Rango de meses: 'nov 2025 – oct 2026' (un solo mes: 'oct 2026'). */
export function rangoMesesEs(desde: string | null | undefined, hasta: string | null | undefined): string {
  const a = mesEs(desde)
  const b = mesEs(hasta)
  return a === b ? a : `${a} – ${b}`
}

/** 12.345 */
export function numeroEs(value: number | null | undefined): string {
  return Math.round(Number(value) || 0).toLocaleString('es-CO')
}

/** Porcentaje de una parte (0 si el total es 0): '45,2 %'. */
export function pctEs(parte: number, total: number): string {
  if (!(total > 0)) return '0 %'
  return `${((parte / total) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`
}
