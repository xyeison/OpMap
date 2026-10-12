// Fase 5 · Compras públicas (SECOP): agregaciones puras para la API y la UI (sin red ni base de datos).
//
// Entrada: "hechos" de contratación (un contrato o un agregado de varios) ya normalizados por el servidor
// (app/api/secop/_lib/secop-server.ts) desde secop_contratos. NIT de entidad y proveedor SIEMPRE en 9
// dígitos (sin DV). Las personas naturales (médicos) llegan con una clave seudónima (hash), nunca con la
// cédula.
//
// Reglas:
// - Una entidad pública = un NIT. Si el NIT tiene varias sedes activas en OpMap, su compra se reparte
//   entre ellas en proporción a las camas (misma regla que los giros ADRES: sedeShares) para agregar por
//   zona o ejecutivo; el total nunca se cuenta dos veces.
// - Servicios de especialistas (personas o empresas con especialidad y sin línea de producto) no son
//   compras de material: van aparte ("médicos contratados") y no suman en compras ni proveedores. Una
//   persona natural con línea ortopédica (suministro) sí es proveedor de material.
// - Las líneas de producto (trauma, reemplazo, columna, deportiva, neurocirugía, otros implantes) vienen
//   clasificadas desde la carga (lib/secop.ts); aquí solo se agrupan y se rotulan. "Sin clasificar"
//   (no_clasificado: contratos de proveedores vigilados sin línea ortopédica detectada) se muestra aparte y
//   no suma en el total ortopédico salvo que se pida (linea=todas).
// - Valor fuera de escala (> 50.000 millones en UN contrato, VALOR_ATIPICO_COP de lib/secop.ts): se lista
//   pero no suma (suelen ser errores de digitación o el valor de un proceso entero). Los demás "atípicos" de
//   la carga (por encima del p99 de su entidad) son contratos grandes reales: suman y se marcan para revisar.
// - SECOP I: el valor es el ADJUDICADO a cada contratista (dataset SECOP I f789-7hwg, con detalle por contrato
//   desde 2017-2018); el valor del proceso se conserva como dato (valor_proceso). Las constancias que solo
//   trae el SECOP Integrado (sin fila secop1 de la misma entidad y constancia; sobre todo antes de 2018, pero
//   la marca NO mira la fecha) publican el valor del PROCESO repetido en cada contratista: se reparte por
//   partes iguales y se marcan "estimado". Los estimados SÍ suman en el total; la ficha dice cuántos son y
//   por cuánto (decisión 2026-10-12).
// - Entidad de compra pública: la marca manual hospitals.compra_publica manda; si es null, el REPS
//   (Pública/Mixta); si tampoco, que el NIT tenga contratos en SECOP (resolverCompraPublica).
import { nitOfHospital, sedeShares, type IntelHospital } from './adres-intelligence'
import { nextCronRun, parseCronExpression } from './fuentes-estado'
import { VALOR_ATIPICO_COP } from './secop'

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

export type SecopGroup = 'hospital' | 'proveedor' | 'zona' | 'ejecutivo'
export const SECOP_GROUPS: readonly SecopGroup[] = ['hospital', 'proveedor', 'zona', 'ejecutivo'] as const

/** ips = solo compras de entidades que son IPS de OpMap; todas = cualquier entidad pública (solo proveedor). */
export type SecopAmbito = 'ips' | 'todas'

/** Meses de la ventana de la ficha de IPS. */
export const SECOP_VENTANA_MESES = 24
/** Rango por defecto del ranking (meses hasta el mes actual). */
export const SECOP_DEFAULT_MESES = 24
/** Primer mes con datos posibles (SECOP Integrado trae desde 2005). */
export const SECOP_MIN_MES = '2005-01'
/** Filas máximas de la tabla proveedor × hospital. */
export const SECOP_MAX_PARES = 300
/** Contratos por página en la ficha. */
export const SECOP_PAGE_SIZE = 20

export interface LineaProducto {
  code: string
  label: string
  color: string
}

/**
 * Líneas de producto en el orden de la UI. Colores: paleta categórica (azul, naranja, verde, violeta,
 * rojo, gris para "otros").
 */
export const LINEAS_PRODUCTO: readonly LineaProducto[] = [
  { code: 'trauma', label: 'Trauma y osteosíntesis', color: '#2a78d6' },
  { code: 'reemplazo', label: 'Reemplazo articular', color: '#eb6834' },
  { code: 'columna', label: 'Columna', color: '#2f9e6b' },
  { code: 'deportiva', label: 'Medicina deportiva', color: '#8a5cd1' },
  { code: 'neurocirugia', label: 'Neurocirugía', color: '#d64550' },
  { code: 'otros', label: 'Otros implantes', color: '#9ca3af' },
] as const

/** Contratos sin línea ortopédica detectada (proveedor vigilado). No suman en el total ortopédico. */
export const SIN_CLASIFICAR = 'no_clasificado'
const SIN_CLASIFICAR_INFO: LineaProducto = { code: SIN_CLASIFICAR, label: 'Sin clasificar', color: '#cbd5e1' }

/** true si la línea es una de las 6 ortopédicas del catálogo. */
export function esOrto(linea: string | null | undefined): boolean {
  return Boolean(linea) && LINEAS_PRODUCTO.some(item => item.code === linea)
}

const ESPECIALIDADES: Record<string, string> = {
  ortopedia: 'Ortopedia',
  traumatologia: 'Ortopedia y traumatología',
  neurocirugia: 'Neurocirugía',
  columna: 'Columna',
  deportiva: 'Medicina deportiva',
}

export function especialidadLabel(code: string | null | undefined): string | null {
  if (!code) return null
  const key = sinTildes(String(code)).trim().toLowerCase()
  return ESPECIALIDADES[key] ?? String(code).charAt(0).toUpperCase() + String(code).slice(1)
}

const LINEA_ALIAS: Record<string, string> = {
  osteosintesis: 'trauma',
  trauma_osteosintesis: 'trauma',
  reemplazo_articular: 'reemplazo',
  artroplastia: 'reemplazo',
  medicina_deportiva: 'deportiva',
  neuro: 'neurocirugia',
  otro: 'otros',
  otros_implantes: 'otros',
  sin_clasificar: SIN_CLASIFICAR,
  no_clasificado: SIN_CLASIFICAR,
}

const sinTildes = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Código canónico de una línea de producto ('Reemplazo articular' → 'reemplazo'); null si viene vacía. */
export function normalizeLinea(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const key = sinTildes(String(raw)).trim().toLowerCase().replace(/[\s/-]+/g, '_')
  if (!key) return null
  if (LINEAS_PRODUCTO.some(item => item.code === key)) return key
  if (LINEA_ALIAS[key]) return LINEA_ALIAS[key]
  const byLabel = LINEAS_PRODUCTO.find(item => sinTildes(item.label).toLowerCase().replace(/[\s/-]+/g, '_') === key)
  return byLabel ? byLabel.code : key
}

export function lineaLabel(code: string | null | undefined): string {
  if (!code || code === SIN_CLASIFICAR) return SIN_CLASIFICAR_INFO.label
  return LINEAS_PRODUCTO.find(item => item.code === code)?.label ?? code.charAt(0).toUpperCase() + code.slice(1)
}

export function lineaColor(code: string | null | undefined): string {
  if (!code || code === SIN_CLASIFICAR) return SIN_CLASIFICAR_INFO.color
  return LINEAS_PRODUCTO.find(item => item.code === code)?.color ?? '#9ca3af'
}

/** Orden de la UI: las del catálogo, luego las desconocidas por nombre y al final "Sin clasificar". */
export function compareLineas(a: string, b: string): number {
  const rank = (code: string) => {
    const i = LINEAS_PRODUCTO.findIndex(item => item.code === code)
    return i >= 0 ? i : code === SIN_CLASIFICAR ? 1000 : 500
  }
  return rank(a) - rank(b) || a.localeCompare(b, 'es')
}

/** Líneas para el filtro de la UI: las 6 ortopédicas y "Sin clasificar". */
export const LINEAS_FILTRO: readonly LineaProducto[] = [...LINEAS_PRODUCTO, SIN_CLASIFICAR_INFO]

// ---------------------------------------------------------------------------
// NIT
// ---------------------------------------------------------------------------

const DV_PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

/** Dígito de verificación de la DIAN para un NIT (solo dígitos, sin DV). */
export function dvNit(nit: string): number {
  const digits = nit.replace(/\D/g, '')
  let sum = 0
  for (let i = 0; i < digits.length && i < DV_PESOS.length; i++) {
    sum += Number(digits[digits.length - 1 - i]) * DV_PESOS[i]
  }
  const mod = sum % 11
  return mod >= 2 ? 11 - mod : mod
}

/**
 * NIT de empresa escrito a mano → 9 dígitos. Acepta puntos, espacios y guion ("900.123.456-7").
 * 9 dígitos → tal cual; 9 + DV (10 dígitos o con guion) → valida el DV con la regla de la DIAN y lo quita.
 */
export function normalizeNitEmpresa(raw: unknown): { ok: true; nit: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' && typeof raw !== 'number') return { ok: false, error: 'Escribe el NIT' }
  const text = String(raw).trim()
  const dash = /^([\d.\s]+)-\s*(\d)$/.exec(text)
  const body = (dash ? dash[1] : text).replace(/[.\s]/g, '')
  if (!/^\d+$/.test(body)) return { ok: false, error: 'El NIT solo puede tener números, puntos y un guion antes del DV' }
  if (dash) {
    if (body.length !== 9) return { ok: false, error: 'El NIT de una empresa tiene 9 dígitos antes del DV' }
    if (dvNit(body) !== Number(dash[2])) return { ok: false, error: `El dígito de verificación no corresponde (para ${body} es ${dvNit(body)})` }
    return { ok: true, nit: body }
  }
  if (body.length === 9) return { ok: true, nit: body }
  if (body.length === 10) {
    const nit = body.slice(0, 9)
    if (dvNit(nit) === Number(body[9])) return { ok: true, nit }
    return { ok: false, error: `10 dígitos pero el último no es el DV de ${nit} (sería ${dvNit(nit)})` }
  }
  return { ok: false, error: 'El NIT de una empresa tiene 9 dígitos (sin DV)' }
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export function addMonthsYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const index = y * 12 + (m - 1) + delta
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Último día del mes 'YYYY-MM' → 'YYYY-MM-DD'. */
export function monthEndYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/** Ventana de N meses que termina en el mes de `hoy` ('YYYY-MM-DD'): { desde: día 1, hasta: hoy }. */
export function ventanaMeses(hoy: string, meses: number): { desde: string; hasta: string } {
  const ym = hoy.slice(0, 7)
  return { desde: `${addMonthsYm(ym, -(meses - 1))}-01`, hasta: hoy.slice(0, 10) }
}

const inRange = (fecha: string | null, desde: string, hasta: string) => Boolean(fecha) && (fecha as string) >= desde && (fecha as string) <= hasta
const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b)
const minDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b)
const round2 = (value: number) => Math.round(value * 100) / 100

// ---------------------------------------------------------------------------
// Hechos de contratación
// ---------------------------------------------------------------------------

/** Contrato (o agregado de contratos) normalizado. */
export interface SecopFact {
  nit_entidad: string
  nombre_entidad: string | null
  /** 'nit:<9 dígitos>' (empresa), 'persona:<hash>' (persona natural) o 'nombre:<texto>' (sin documento). */
  proveedor_key: string
  proveedor_nit: string | null
  proveedor_nombre: string | null
  es_persona: boolean
  /**
   * Servicio profesional de especialistas: tiene especialidad (ortopedia, neurocirugía…) y ninguna línea de
   * producto. Vale para personas naturales y para empresas de especialistas.
   */
  es_servicio?: boolean
  /** secop_contratos.atipico (> 50.000 M o > p99 de su entidad): solo marca para revisar. */
  atipico?: boolean
  /** Valor fuera de escala (> VALOR_ATIPICO_COP en un contrato): se lista pero NO suma. */
  fuera_escala?: boolean
  /** Especialidad del servicio (ortopedia, neurocirugia, columna, deportiva). */
  especialidad: string | null
  /** Línea de producto canónica (normalizeLinea); null o 'no_clasificado' = sin clasificar. */
  linea: string | null
  /** Fecha de firma (o la última del agregado) 'YYYY-MM-DD'. */
  fecha: string | null
  valor: number
  contratos: number
  /**
   * true = valor ESTIMADO: fila de SECOP I que solo trae el SECOP Integrado (sin fila secop1 de la misma
   * constancia; sobre todo antes de 2018, pero la marca no depende de la fecha), con el valor del proceso
   * repartido por partes iguales entre sus contratistas (secop_contratos_unicos.estimado, clave 'est' de
   * secop_hechos()). Suma en los totales; la ficha lo señala.
   */
  estimado?: boolean
}

/** Contrato individual para la ficha (con objeto y enlace al expediente). */
export interface SecopContrato extends SecopFact {
  id: string
  /** Etiqueta de la fuente para la UI: 'SECOP I' | 'SECOP II' (por origen) o el nombre crudo de la fuente. */
  fuente: string | null
  objeto: string | null
  estado: string | null
  modalidad: string | null
  url: string | null
  /** Valor estimado (ver SecopFact.estimado). Siempre informado en un contrato individual. */
  estimado: boolean
  /** 'SECOPI' | 'SECOPII' (origen del dato; informativo). */
  origen?: string | null
  /** Constancia del contrato en SECOP I (numero_contrato). */
  numero_contrato?: string | null
  /**
   * Valor del PROCESO: en SECOP I (dataset f789-7hwg) viene de la columna secop_contratos.valor_proceso
   * (cuantia_proceso) y acompaña al valor adjudicado; en los estimados lo pone repartirProcesosSecopI con el
   * valor publicado antes del reparto. null si no se conoce.
   */
  valor_proceso?: number | null
  /** Nº de contratistas entre los que se repartió el valor del proceso (1 = sin reparto). */
  contratistas_proceso?: number
}

/**
 * Reparto del valor del proceso de SECOP I: SOLO para los contratos marcados `estimado` (filas del SECOP
 * Integrado sin equivalente en el dataset SECOP I: sobre todo antes de 2018, pero también cualquier constancia
 * posterior que f789-7hwg no traiga o cuya fila secop1 no pase el prefiltro; la marca no mira la fecha).
 *
 * Por qué solo esos: el Integrado publica el valor del PROCESO repetido en cada contratista (misma entidad,
 * constancia y valor en varias filas), así que contarlas tal cual multiplica el proceso; repartir por
 * partes iguales es lo mejor que se puede hacer con ese dato y por eso queda marcado "estimado". El
 * dataset SECOP I (f789-7hwg, fuente 'secop1', origen 'SECOPI') ya trae el valor ADJUDICADO a cada
 * contratista: ahí no hay nada que repartir, aunque dos contratistas compartan constancia y valor. Antes
 * (0720) se repartía por origen 'SECOPI', lo que habría partido también los adjudicados reales.
 *
 * valor_proceso: en los repartidos guarda el valor publicado (si la base no traía uno). Misma regla que
 * secop_hechos() en la migración 2026-10-12_0730 para que la ficha y el ranking cuadren.
 */
export function repartirProcesosSecopI<T extends SecopContrato>(contratos: T[]): T[] {
  const clave = (c: T) => (c.estimado === true && c.numero_contrato && c.valor > 0 ? `${c.nit_entidad}|${c.numero_contrato}|${c.valor}` : null)
  const cuenta = new Map<string, number>()
  for (const c of contratos) {
    const k = clave(c)
    if (k) cuenta.set(k, (cuenta.get(k) || 0) + 1)
  }
  return contratos.map(c => {
    const k = clave(c)
    const n = k ? cuenta.get(k) || 1 : 1
    return n > 1 ? { ...c, valor: c.valor / n, valor_proceso: c.valor_proceso ?? c.valor, contratistas_proceso: n } : c
  })
}

// ---------------------------------------------------------------------------
// Entidad de compra pública (SECOP)
// ---------------------------------------------------------------------------

/** De dónde sale que una IPS cuente (o no) como entidad de compra pública. */
export type CompraPublicaOrigen = 'manual' | 'reps' | 'contratos' | 'ninguno'

/**
 * ¿Es la IPS una entidad de compra pública (SECOP)? Orden de precedencia (decisión 2026-10-12):
 * 1. hospitals.compra_publica marcado a mano (true/false) manda, aunque el REPS diga otra cosa: sirve para
 *    entidades públicas sin sede del REPS (UPRES, Policía, Armada, ESE) y para excluir falsos positivos.
 * 2. Si es null, el REPS: naturaleza Pública o Mixta.
 * 3. Si tampoco, que su NIT ya tenga contratos cargados en SECOP (contratos > 0).
 * 4. Si no, no es entidad de compra pública ('ninguno').
 */
export function resolverCompraPublica(
  compra_publica: boolean | null | undefined,
  naturaleza: string | null | undefined,
  contratos: number
): { publica: boolean; origen: CompraPublicaOrigen } {
  if (compra_publica === true || compra_publica === false) return { publica: compra_publica, origen: 'manual' }
  const nat = sinTildes(String(naturaleza ?? '')).trim().toLowerCase()
  if (nat === 'publica' || nat === 'mixta') return { publica: true, origen: 'reps' }
  if (contratos > 0) return { publica: true, origen: 'contratos' }
  return { publica: false, origen: 'ninguno' }
}

/** Umbral de "fuera de escala" por contrato (50.000 millones, el mismo de la carga). */
export const VALOR_FUERA_ESCALA = VALOR_ATIPICO_COP

/** true si el contrato (o el grupo) no suma: valor de un contrato por encima de 50.000 millones. */
export function esFueraEscala(fact: Pick<SecopFact, 'fuera_escala' | 'valor' | 'contratos'>): boolean {
  if (fact.fuera_escala !== undefined) return fact.fuera_escala
  return (fact.contratos || 1) === 1 && fact.valor > VALOR_FUERA_ESCALA
}

/**
 * true si el contrato es de servicios de especialistas (no material): marcado como servicio, o persona
 * natural sin línea ortopédica. Una persona natural con línea (p. ej. suministro de osteosíntesis) es un
 * proveedor de material más.
 */
export function esServicio(fact: Pick<SecopFact, 'es_persona' | 'es_servicio' | 'linea'>): boolean {
  return Boolean(fact.es_servicio) || (fact.es_persona && !esOrto(fact.linea))
}

const lineaDe = (fact: Pick<SecopFact, 'linea'>) => fact.linea || SIN_CLASIFICAR

/** Clave estable del proveedor: NIT de 9 dígitos, hash de la persona o nombre normalizado. */
export function proveedorKey(input: { nit: string | null; personaHash: string | null; nombre: string | null; esPersona: boolean }): string {
  if (input.esPersona && input.personaHash) return `persona:${input.personaHash}`
  if (!input.esPersona && input.nit) return `nit:${input.nit}`
  const nombre = sinTildes(input.nombre || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  return `nombre:${nombre || 'SIN NOMBRE'}`
}

// ---------------------------------------------------------------------------
// Ficha de IPS
// ---------------------------------------------------------------------------

export interface LineaResumen {
  linea: string
  label: string
  color: string
  /** false para "Sin clasificar": se muestra pero no suma en el total ortopédico. */
  orto: boolean
  valorVentana: number
  contratosVentana: number
  valorTotal: number
  contratosTotal: number
}

export interface AnioPunto {
  anio: number
  total: number
  /** Valor por línea de producto (código → valor). */
  lineas: Record<string, number>
}

export interface ProveedorResumen {
  key: string
  nit: string | null
  nombre: string
  vigilado: boolean
  /** Valor ortopédico histórico (las 6 líneas). */
  valor: number
  /** Valor sin clasificar (no suma en el total ortopédico). */
  valorSinClasificar: number
  contratos: number
  ultimaFecha: string | null
  lineas: string[]
  /** Valor ortopédico dentro de la ventana de 24 meses. */
  valorVentana: number
}

export interface MedicoResumen {
  key: string
  nombre: string
  /** true si es una empresa de especialistas (no persona natural). */
  empresa: boolean
  especialidad: string | null
  contratos: number
  valor: number
  ultimaFecha: string | null
}

export interface ContratoFila {
  id: string
  fuente: string | null
  fecha: string | null
  proveedor: string
  proveedorNit: string | null
  esPersona: boolean
  /** Servicio de especialistas (persona o empresa), no material. */
  esServicio: boolean
  vigilado: boolean
  /** Marcado atípico por la carga (valor alto para su entidad): suma, pero conviene revisarlo. */
  atipico: boolean
  /** Valor fuera de escala: no suma. */
  fueraEscala: boolean
  linea: string | null
  especialidad: string | null
  /** Valor que suma: en SECOP I el adjudicado a este contratista; si es estimado, su parte del proceso. */
  valor: number
  /**
   * Valor del proceso, si se conoce: en SECOP I (dataset) acompaña al adjudicado ("Proceso: X · adjudicado:
   * Y"); en los estimados es el publicado antes del reparto.
   */
  valorProceso: number | null
  /** Entre cuántos contratistas se repartió el valor del proceso (1 = sin reparto). */
  contratistasProceso: number
  /** true = valor estimado (SECOP I solo en el Integrado, sin valor adjudicado en el dataset): suma, pero se señala. */
  estimado: boolean
  objeto: string | null
  estado: string | null
  url: string | null
}

export interface HospitalSecopSummary {
  ventana: { desde: string; hasta: string; meses: number }
  totales: {
    /** Material ortopédico (6 líneas), sin valores fuera de escala. */
    valorVentana: number
    contratosVentana: number
    valorTotal: number
    contratosTotal: number
    primeraFecha: string | null
    ultimaFecha: string | null
    /** Sin clasificar (proveedores vigilados), histórico. */
    valorSinClasificar: number
    contratosSinClasificar: number
    /** Especialistas contratados (personas y empresas) y sus contratos. */
    medicos: number
    contratosMedicos: number
    /** Contratos con valor fuera de escala (no suman). */
    fueraEscala: number
    valorFueraEscala: number
    /** Contratos marcados atípicos por la carga que sí suman (valor alto para la entidad). */
    atipicos: number
  }
  /**
   * Parte ESTIMADA del total histórico ortopédico (totales.valorTotal / contratosTotal): contratos de SECOP I
   * que solo trae el Integrado (sin valor adjudicado en el dataset SECOP I; la marca no depende de la fecha,
   * aunque en la práctica sean sobre todo anteriores a 2018), con el valor del proceso repartido por partes iguales. Ya
   * están sumados en los totales; aquí se dice cuántos son y por cuánto. No cuenta sin clasificar, médicos
   * ni fuera de escala (esos no entran en el total).
   */
  estimados: { contratos: number; valor: number }
  porLinea: LineaResumen[]
  anual: AnioPunto[]
  proveedores: ProveedorResumen[]
  medicos: MedicoResumen[]
  contratos: { total: number; page: number; pageSize: number; pages: number; rows: ContratoFila[] }
}

/** Filtros de la lista de contratos de la ficha (además de un código de línea). */
export const FILTRO_MEDICOS = 'medicos'
export const FILTRO_ATIPICOS = 'atipicos'

/**
 * Resumen de la contratación de una entidad (ficha de IPS).
 * - totales y anual: material ortopédico (6 líneas), sin valores fuera de escala; "Sin clasificar" aparte.
 * - porLinea: las líneas con contratos (ventana de 24 meses e histórico), "Sin clasificar" al final.
 * - proveedores: empresas de material, por valor ortopédico histórico; vigilado si su NIT está activo en
 *   la lista vigilada.
 * - medicos: servicios de especialistas (personas naturales y empresas sin línea), por nº de contratos.
 * - contratos: todos (incluidos médicos y fuera de escala), del más reciente al más antiguo, paginados.
 */
export function summarizeHospitalSecop(params: {
  contratos: SecopContrato[]
  vigilados: Set<string>
  hoy: string
  page?: number
  pageSize?: number
  /** Filtro de la lista de contratos: código de línea, 'medicos' o 'atipicos'. */
  lineaContratos?: string | null
}): HospitalSecopSummary {
  const { contratos, vigilados, hoy } = params
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? SECOP_PAGE_SIZE))
  const ventana = ventanaMeses(hoy, SECOP_VENTANA_MESES)

  const totales: HospitalSecopSummary['totales'] = {
    valorVentana: 0,
    contratosVentana: 0,
    valorTotal: 0,
    contratosTotal: 0,
    primeraFecha: null,
    ultimaFecha: null,
    valorSinClasificar: 0,
    contratosSinClasificar: 0,
    medicos: 0,
    contratosMedicos: 0,
    fueraEscala: 0,
    valorFueraEscala: 0,
    atipicos: 0,
  }
  const estimados = { contratos: 0, valor: 0 }
  const lineas = new Map<string, LineaResumen>()
  const anios = new Map<number, AnioPunto>()
  const proveedores = new Map<string, ProveedorResumen & { lineSet: Set<string> }>()
  const medicos = new Map<string, MedicoResumen & { especialidades: Map<string, number> }>()

  for (const c of contratos) {
    const valor = Number.isFinite(c.valor) ? c.valor : 0
    const n = c.contratos || 1
    if (esFueraEscala(c)) {
      totales.fueraEscala += n
      totales.valorFueraEscala += valor
      continue
    }
    if (c.atipico) totales.atipicos += n
    const enVentana = inRange(c.fecha, ventana.desde, ventana.hasta)
    if (esServicio(c)) {
      totales.contratosMedicos += n
      const current =
        medicos.get(c.proveedor_key) ??
        {
          key: c.proveedor_key,
          nombre: c.proveedor_nombre || 'Sin nombre',
          empresa: !c.es_persona,
          especialidad: null,
          contratos: 0,
          valor: 0,
          ultimaFecha: null,
          especialidades: new Map<string, number>(),
        }
      current.contratos += n
      current.valor += valor
      current.ultimaFecha = maxDate(current.ultimaFecha, c.fecha)
      if (c.especialidad) current.especialidades.set(c.especialidad, (current.especialidades.get(c.especialidad) || 0) + n)
      if (c.proveedor_nombre && current.nombre === 'Sin nombre') current.nombre = c.proveedor_nombre
      medicos.set(c.proveedor_key, current)
      continue
    }

    const linea = lineaDe(c)
    const orto = esOrto(linea)
    if (orto) {
      totales.valorTotal += valor
      totales.contratosTotal += n
      totales.primeraFecha = minDate(totales.primeraFecha, c.fecha)
      totales.ultimaFecha = maxDate(totales.ultimaFecha, c.fecha)
      if (c.estimado) {
        estimados.contratos += n
        estimados.valor += valor
      }
      if (enVentana) {
        totales.valorVentana += valor
        totales.contratosVentana += n
      }
      if (c.fecha) {
        const anio = Number(c.fecha.slice(0, 4))
        const point = anios.get(anio) ?? { anio, total: 0, lineas: {} }
        point.total += valor
        point.lineas[linea] = (point.lineas[linea] || 0) + valor
        anios.set(anio, point)
      }
    } else {
      totales.valorSinClasificar += valor
      totales.contratosSinClasificar += n
    }

    const lr =
      lineas.get(linea) ??
      { linea, label: lineaLabel(linea), color: lineaColor(linea), orto, valorVentana: 0, contratosVentana: 0, valorTotal: 0, contratosTotal: 0 }
    lr.valorTotal += valor
    lr.contratosTotal += n
    if (enVentana) {
      lr.valorVentana += valor
      lr.contratosVentana += n
    }
    lineas.set(linea, lr)

    const prov =
      proveedores.get(c.proveedor_key) ??
      {
        key: c.proveedor_key,
        nit: c.proveedor_nit,
        nombre: c.proveedor_nombre || 'Sin nombre',
        vigilado: Boolean(c.proveedor_nit && vigilados.has(c.proveedor_nit)),
        valor: 0,
        valorSinClasificar: 0,
        contratos: 0,
        ultimaFecha: null,
        lineas: [],
        valorVentana: 0,
        lineSet: new Set<string>(),
      }
    if (orto) {
      prov.valor += valor
      if (enVentana) prov.valorVentana += valor
    } else {
      prov.valorSinClasificar += valor
    }
    prov.contratos += n
    prov.ultimaFecha = maxDate(prov.ultimaFecha, c.fecha)
    prov.lineSet.add(linea)
    proveedores.set(c.proveedor_key, prov)
  }

  totales.medicos = medicos.size

  // Años sin compras entre el primero y el último: en 0 (el gráfico no salta años).
  const yearsSorted = Array.from(anios.keys()).sort((a, b) => a - b)
  if (yearsSorted.length > 0) {
    for (let y = yearsSorted[0]; y <= yearsSorted[yearsSorted.length - 1]; y++) {
      if (!anios.has(y)) anios.set(y, { anio: y, total: 0, lineas: {} })
    }
  }

  const filtro = params.lineaContratos || null
  const contratosFiltrados = contratos.filter(c => {
    if (!filtro) return true
    if (filtro === FILTRO_ATIPICOS) return Boolean(c.atipico) || esFueraEscala(c)
    if (filtro === FILTRO_MEDICOS) return esServicio(c)
    return !esServicio(c) && lineaDe(c) === filtro
  })
  const ordenados = contratosFiltrados
    .slice()
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.valor - a.valor || a.id.localeCompare(b.id))
  const pages = Math.max(1, Math.ceil(ordenados.length / pageSize))
  const page = Math.max(1, Math.min(pages, Math.floor(params.page ?? 1)))
  const rows: ContratoFila[] = ordenados.slice((page - 1) * pageSize, page * pageSize).map(c => {
    const servicio = esServicio(c)
    return {
      id: c.id,
      fuente: c.fuente,
      fecha: c.fecha,
      proveedor: c.proveedor_nombre || 'Sin nombre',
      proveedorNit: c.es_persona ? null : c.proveedor_nit,
      esPersona: c.es_persona,
      esServicio: servicio,
      vigilado: Boolean(!c.es_persona && c.proveedor_nit && vigilados.has(c.proveedor_nit)),
      atipico: Boolean(c.atipico),
      fueraEscala: esFueraEscala(c),
      linea: servicio ? null : lineaDe(c),
      especialidad: c.especialidad,
      valor: round2(c.valor || 0),
      valorProceso: c.valor_proceso ?? null,
      contratistasProceso: c.contratistas_proceso ?? 1,
      estimado: c.estimado === true,
      objeto: c.objeto,
      estado: c.estado,
      url: safeUrl(c.url),
    }
  })

  return {
    ventana: { ...ventana, meses: SECOP_VENTANA_MESES },
    totales: {
      ...totales,
      valorVentana: round2(totales.valorVentana),
      valorTotal: round2(totales.valorTotal),
      valorSinClasificar: round2(totales.valorSinClasificar),
      valorFueraEscala: round2(totales.valorFueraEscala),
    },
    estimados: { contratos: estimados.contratos, valor: round2(estimados.valor) },
    porLinea: Array.from(lineas.values())
      .map(item => ({ ...item, valorVentana: round2(item.valorVentana), valorTotal: round2(item.valorTotal) }))
      .sort((a, b) => compareLineas(a.linea, b.linea)),
    anual: Array.from(anios.values())
      .sort((a, b) => a.anio - b.anio)
      .map(point => ({ anio: point.anio, total: round2(point.total), lineas: roundRecord(point.lineas) })),
    proveedores: Array.from(proveedores.values())
      .map(({ lineSet, ...rest }) => ({
        ...rest,
        valor: round2(rest.valor),
        valorSinClasificar: round2(rest.valorSinClasificar),
        valorVentana: round2(rest.valorVentana),
        lineas: Array.from(lineSet).sort(compareLineas),
      }))
      .sort((a, b) => b.valor - a.valor || b.valorSinClasificar - a.valorSinClasificar || a.nombre.localeCompare(b.nombre, 'es')),
    medicos: Array.from(medicos.values())
      .map(({ especialidades, ...rest }) => ({ ...rest, valor: round2(rest.valor), especialidad: topKey(especialidades) ?? rest.especialidad }))
      .sort((a, b) => b.contratos - a.contratos || (b.ultimaFecha || '').localeCompare(a.ultimaFecha || '') || a.nombre.localeCompare(b.nombre, 'es')),
    contratos: { total: ordenados.length, page, pageSize, pages, rows },
  }
}

function roundRecord(record: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(record)) out[key] = round2(value)
  return out
}

function topKey(map: Map<string, number>): string | null {
  let best: string | null = null
  let bestCount = -1
  map.forEach((count, key) => {
    if (count > bestCount || (count === bestCount && best !== null && key.localeCompare(best, 'es') < 0)) {
      best = key
      bestCount = count
    }
  })
  return best
}

/** Solo enlaces http(s) al expediente (nunca javascript: ni data:). */
export function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = String(raw).trim()
  return /^https?:\/\/[^\s"'<>]+$/i.test(text) ? text : null
}

// ---------------------------------------------------------------------------
// Ranking (hospital | proveedor | zona | ejecutivo)
// ---------------------------------------------------------------------------

/** Filtro de línea del ranking: null = las 6 ortopédicas; 'todas' = también "Sin clasificar"; o un código. */
export const LINEA_TODAS = 'todas'

export interface SecopRankingFilter {
  linea?: string | null
  departamento?: string | null
}

/** ¿El contrato de material con esta línea entra con el filtro? */
export function lineaPasaFiltro(linea: string, filtro: string | null | undefined): boolean {
  if (!filtro) return esOrto(linea)
  if (filtro === LINEA_TODAS) return true
  return linea === filtro
}

export interface SecopRankingRow {
  key: string
  label: string
  valor: number
  /** % del total filtrado. */
  pct: number
  contratos: number
  ultimaFecha: string | null
  /** Valor por línea de producto. */
  lineas: Record<string, number>
  // hospital
  hospital_id?: string
  nit?: string
  nombre_secop?: string | null
  sedes?: number
  municipio?: string | null
  departamento?: string | null
  zona?: string | null
  ejecutivo?: string | null
  ejecutivo_color?: string | null
  top_proveedor?: string | null
  // proveedor
  vigilado?: boolean
  entidades?: number
  top_entidad?: string | null
  // zona / ejecutivo
  color?: string | null
  zonas?: string[]
  hospitales?: number
}

export interface SecopPar {
  proveedor_key: string
  proveedor: string
  proveedor_nit: string | null
  vigilado: boolean
  nit_entidad: string
  hospital: string
  hospital_id: string | null
  valor: number
  contratos: number
  ultimaFecha: string | null
}

export interface SecopRankingKpis {
  valor: number
  contratos: number
  entidades: number
  proveedores: number
  /** Valor comprado a proveedores de la lista vigilada. */
  valorVigilados: number
  vigiladosPct: number | null
  /** Especialistas (personas y empresas de servicios) contratados en el rango y sus contratos. */
  medicos: number
  contratosMedicos: number
  /** Contratos de material con valor fuera de escala en el rango (no suman). */
  fueraEscala: number
  valorFueraEscala: number
  ultimaFecha: string | null
}

export interface SecopRanking {
  kpis: SecopRankingKpis
  /** Valor por línea ANTES del filtro de línea (para ver lo que el filtro deja fuera, p. ej. "Sin clasificar"). */
  porLinea: Array<{ linea: string; label: string; color: string; orto: boolean; valor: number; contratos: number }>
  rows: SecopRankingRow[]
  pares: SecopPar[]
}

function executiveGroup(hospital: IntelHospital): { key: string; label: string; color: string | null } {
  if (!hospital.kam_id) return { key: 'sin_zona', label: 'Sin zona asignada', color: null }
  if (hospital.executive) return { key: hospital.executive.id, label: hospital.executive.full_name, color: hospital.executive.color }
  if (hospital.coverage_kind === 'conflict') return { key: 'conflicto', label: 'Conflicto (varios ejecutivos en la zona)', color: '#f59e0b' }
  return { key: 'vacante', label: 'Vacante', color: '#9ca3af' }
}

interface RowAcc extends SecopRankingRow {
  provMap?: Map<string, { nombre: string; valor: number }>
  entMap?: Map<string, { nombre: string; valor: number }>
  zoneSet?: Set<string>
  hospSet?: Set<string>
}

function newRow(key: string, label: string): RowAcc {
  return { key, label, valor: 0, pct: 0, contratos: 0, ultimaFecha: null, lineas: {} }
}

function addTo(row: RowAcc, valor: number, contratos: number, linea: string, fecha: string | null) {
  row.valor += valor
  row.contratos += contratos
  row.lineas[linea] = (row.lineas[linea] || 0) + valor
  row.ultimaFecha = maxDate(row.ultimaFecha, fecha)
}

function bump(map: Map<string, { nombre: string; valor: number }>, key: string, nombre: string, valor: number) {
  const current = map.get(key)
  if (current) current.valor += valor
  else map.set(key, { nombre, valor })
}

function topName(map: Map<string, { nombre: string; valor: number }> | undefined): string | null {
  if (!map || map.size === 0) return null
  let best: { nombre: string; valor: number } | null = null
  map.forEach(item => {
    if (!best || item.valor > best.valor || (item.valor === best.valor && item.nombre.localeCompare(best.nombre, 'es') < 0)) best = item
  })
  return best ? (best as { nombre: string }).nombre : null
}

/**
 * Ranking de compras públicas.
 * - Solo material: los servicios de especialistas cuentan aparte en kpis.medicos; los valores fuera de
 *   escala en kpis.fueraEscala. Línea: por defecto las 6 ortopédicas (lineaPasaFiltro).
 * - ámbito 'ips' (por defecto): solo entidades cuyo NIT es de una IPS activa de OpMap; el valor de cada
 *   contrato se reparte entre las sedes del NIT que pasan el filtro de departamento (por camas).
 * - ámbito 'todas' (solo group=proveedor): cualquier entidad pública; el filtro de departamento no aplica.
 * - hospital: una fila por NIT de entidad (etiqueta = la sede con más camas); zona / ejecutivo: por la zona
 *   actual de cada sede y quien la cubre en la línea de negocio.
 * - Contratos: cuenta entera del contrato en cada fila que toca (un contrato de un NIT con sedes en dos
 *   zonas cuenta en las dos; el valor no se duplica).
 * - pares: proveedor × hospital (ámbito IPS), los SECOP_MAX_PARES de más valor.
 */
export function aggregateSecopRanking(params: {
  facts: SecopFact[]
  hospitals: IntelHospital[]
  group: SecopGroup
  filter: SecopRankingFilter
  vigilados: Set<string>
  withExecutive: boolean
  ambito?: SecopAmbito
}): SecopRanking {
  const { facts, hospitals, group, filter, vigilados, withExecutive } = params
  const ambito: SecopAmbito = group === 'proveedor' && params.ambito === 'todas' ? 'todas' : 'ips'
  const shares = sedeShares(hospitals)
  const sedesByNit = new Map<string, IntelHospital[]>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    if (!nit) continue
    const list = sedesByNit.get(nit)
    if (list) list.push(hospital)
    else sedesByNit.set(nit, [hospital])
  }
  const principal = new Map<string, IntelHospital>()
  sedesByNit.forEach((list, nit) => {
    const sorted = list.slice().sort((a, b) => (b.beds || 0) - (a.beds || 0) || a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
    principal.set(nit, sorted[0])
  })

  const kpis: SecopRankingKpis = {
    valor: 0,
    contratos: 0,
    entidades: 0,
    proveedores: 0,
    valorVigilados: 0,
    vigiladosPct: null,
    medicos: 0,
    contratosMedicos: 0,
    fueraEscala: 0,
    valorFueraEscala: 0,
    ultimaFecha: null,
  }
  const entidades = new Set<string>()
  const proveedores = new Set<string>()
  const medicos = new Set<string>()
  const porLinea = new Map<string, { valor: number; contratos: number }>()
  const rows = new Map<string, RowAcc>()
  const pares = new Map<string, SecopPar>()
  const lineaFiltro = !filter.linea ? null : filter.linea === LINEA_TODAS ? LINEA_TODAS : normalizeLinea(filter.linea)

  for (const fact of facts) {
    const linea = lineaDe(fact)
    const n = fact.contratos || 1
    const valorTotal = Number.isFinite(fact.valor) ? fact.valor : 0

    // Sedes del NIT que pasan el filtro (ámbito IPS) y la fracción del valor que les toca.
    const sedes = sedesByNit.get(fact.nit_entidad) || []
    const sedesFiltradas = filter.departamento ? sedes.filter(h => h.department_id === filter.departamento) : sedes
    if (ambito === 'ips' && sedesFiltradas.length === 0) continue
    const fraccion = ambito === 'ips' ? sedesFiltradas.reduce((acc, h) => acc + (shares.get(h.id) ?? 1), 0) : 1

    if (esServicio(fact)) {
      medicos.add(fact.proveedor_key)
      kpis.contratosMedicos += n
      continue
    }
    if (esFueraEscala(fact)) {
      kpis.fueraEscala += n
      kpis.valorFueraEscala += valorTotal * fraccion
      continue
    }
    const valor = valorTotal * fraccion
    const pl = porLinea.get(linea) ?? { valor: 0, contratos: 0 }
    pl.valor += valor
    pl.contratos += n
    porLinea.set(linea, pl)
    if (!lineaPasaFiltro(linea, lineaFiltro)) continue

    kpis.valor += valor
    kpis.contratos += n
    kpis.ultimaFecha = maxDate(kpis.ultimaFecha, fact.fecha)
    entidades.add(fact.nit_entidad)
    proveedores.add(fact.proveedor_key)
    const vigilado = Boolean(fact.proveedor_nit && vigilados.has(fact.proveedor_nit))
    if (vigilado) kpis.valorVigilados += valor

    const proveedorNombre = fact.proveedor_nombre || 'Sin nombre'
    const hospPrincipal = principal.get(fact.nit_entidad) ?? null
    const entidadNombre = hospPrincipal?.name || fact.nombre_entidad || `NIT ${fact.nit_entidad}`

    if (ambito === 'ips') {
      const parKey = `${fact.proveedor_key}|${fact.nit_entidad}`
      const par =
        pares.get(parKey) ??
        {
          proveedor_key: fact.proveedor_key,
          proveedor: proveedorNombre,
          proveedor_nit: fact.proveedor_nit,
          vigilado,
          nit_entidad: fact.nit_entidad,
          hospital: entidadNombre,
          hospital_id: hospPrincipal?.id ?? null,
          valor: 0,
          contratos: 0,
          ultimaFecha: null,
        }
      par.valor += valor
      par.contratos += n
      par.ultimaFecha = maxDate(par.ultimaFecha, fact.fecha)
      pares.set(parKey, par)
    }

    if (group === 'hospital') {
      const row = rows.get(fact.nit_entidad) ?? (() => {
        const created = newRow(fact.nit_entidad, entidadNombre)
        created.hospital_id = hospPrincipal?.id
        created.nit = fact.nit_entidad
        created.nombre_secop = fact.nombre_entidad
        created.sedes = sedes.length
        created.municipio = hospPrincipal?.municipality_name ?? null
        created.departamento = hospPrincipal?.department_name ?? null
        created.zona = hospPrincipal?.zone_name ?? null
        if (withExecutive && hospPrincipal) {
          const exec = executiveGroup(hospPrincipal)
          created.ejecutivo = exec.label
          created.ejecutivo_color = exec.color
        }
        created.provMap = new Map()
        return created
      })()
      addTo(row, valor, n, linea, fact.fecha)
      bump(row.provMap!, fact.proveedor_key, proveedorNombre, valor)
      rows.set(fact.nit_entidad, row)
    } else if (group === 'proveedor') {
      const row = rows.get(fact.proveedor_key) ?? (() => {
        const created = newRow(fact.proveedor_key, proveedorNombre)
        created.nit = fact.proveedor_nit ?? undefined
        created.vigilado = vigilado
        created.entMap = new Map()
        return created
      })()
      addTo(row, valor, n, linea, fact.fecha)
      bump(row.entMap!, fact.nit_entidad, entidadNombre, valor)
      rows.set(fact.proveedor_key, row)
    } else {
      // zona / ejecutivo: el valor se reparte por sede (camas) y cae en la zona de cada sede.
      const touched = new Set<string>()
      for (const sede of sedesFiltradas) {
        const share = shares.get(sede.id) ?? 1
        let key: string
        let label: string
        let color: string | null = null
        if (group === 'zona') {
          key = sede.kam_id ?? 'sin_zona'
          label = sede.zone_name ?? 'Sin zona asignada'
        } else {
          const exec = executiveGroup(sede)
          key = exec.key
          label = exec.label
          color = exec.color
        }
        const row = rows.get(key) ?? (() => {
          const created = newRow(key, label)
          created.color = color
          created.zoneSet = new Set()
          created.hospSet = new Set()
          created.entMap = new Map()
          return created
        })()
        row.valor += valorTotal * share
        row.lineas[linea] = (row.lineas[linea] || 0) + valorTotal * share
        row.ultimaFecha = maxDate(row.ultimaFecha, fact.fecha)
        if (!touched.has(key)) {
          row.contratos += n
          touched.add(key)
        }
        if (sede.zone_name) row.zoneSet!.add(sede.zone_name)
        row.hospSet!.add(fact.nit_entidad)
        bump(row.entMap!, fact.nit_entidad, entidadNombre, valorTotal * share)
        rows.set(key, row)
      }
    }
  }

  kpis.entidades = entidades.size
  kpis.proveedores = proveedores.size
  kpis.medicos = medicos.size
  kpis.vigiladosPct = kpis.valor > 0 ? round2((kpis.valorVigilados / kpis.valor) * 100) : null
  kpis.valor = round2(kpis.valor)
  kpis.valorVigilados = round2(kpis.valorVigilados)
  kpis.valorFueraEscala = round2(kpis.valorFueraEscala)

  const total = kpis.valor
  const outRows: SecopRankingRow[] = Array.from(rows.values())
    .filter(row => row.valor > 0 || row.contratos > 0)
    .map(row => {
      const { provMap, entMap, zoneSet, hospSet, ...rest } = row
      const out: SecopRankingRow = { ...rest, valor: round2(rest.valor), pct: total > 0 ? round2((rest.valor / total) * 100) : 0, lineas: roundRecord(rest.lineas) }
      if (provMap) out.top_proveedor = topName(provMap)
      if (entMap) {
        out.top_entidad = topName(entMap)
        out.entidades = entMap.size
      }
      if (zoneSet) out.zonas = Array.from(zoneSet).sort((a, b) => a.localeCompare(b, 'es'))
      if (hospSet) out.hospitales = hospSet.size
      return out
    })
    .sort((a, b) => b.valor - a.valor || b.contratos - a.contratos || a.label.localeCompare(b.label, 'es'))

  return {
    kpis,
    porLinea: Array.from(porLinea.entries())
      .map(([linea, item]) => ({ linea, label: lineaLabel(linea), color: lineaColor(linea), orto: esOrto(linea), valor: round2(item.valor), contratos: item.contratos }))
      .sort((a, b) => compareLineas(a.linea, b.linea)),
    rows: outRows,
    pares: Array.from(pares.values())
      .map(par => ({ ...par, valor: round2(par.valor) }))
      .sort((a, b) => b.valor - a.valor || a.proveedor.localeCompare(b.proveedor, 'es') || a.hospital.localeCompare(b.hospital, 'es'))
      .slice(0, SECOP_MAX_PARES),
  }
}

// ---------------------------------------------------------------------------
// Proveedor: dónde vende
// ---------------------------------------------------------------------------

export interface ProveedorEntidad {
  nit: string
  nombre: string
  esIps: boolean
  hospital_id: string | null
  sedes: number
  valor: number
  contratos: number
  ultimaFecha: string | null
  lineas: Record<string, number>
  anios: Record<string, number>
}

export interface ProveedorSecopSummary {
  nit: string
  nombre: string | null
  vigilado: boolean
  /** Todo el material (incluye "Sin clasificar"), sin valores fuera de escala. */
  total: number
  contratos: number
  /** Parte ortopédica (6 líneas) del total. */
  totalOrto: number
  totalIps: number
  fueraEscala: number
  primeraFecha: string | null
  ultimaFecha: string | null
  porLinea: Array<{ linea: string; label: string; color: string; orto: boolean; valor: number; contratos: number }>
  anual: AnioPunto[]
  entidades: ProveedorEntidad[]
}

/**
 * Dónde vende un proveedor (empresa): por entidad, línea y año, todo el material (incluye "Sin
 * clasificar"; sin servicios de especialistas ni valores fuera de escala). Las entidades que son IPS de OpMap
 * van marcadas.
 */
export function summarizeProveedorSecop(params: {
  nit: string
  facts: SecopFact[]
  hospitals: IntelHospital[]
  vigilados: Set<string>
}): ProveedorSecopSummary {
  const { nit, facts, hospitals, vigilados } = params
  const sedesByNit = new Map<string, IntelHospital[]>()
  for (const hospital of hospitals) {
    const hnit = nitOfHospital(hospital)
    if (!hnit) continue
    const list = sedesByNit.get(hnit)
    if (list) list.push(hospital)
    else sedesByNit.set(hnit, [hospital])
  }

  const summary: ProveedorSecopSummary = {
    nit,
    nombre: null,
    vigilado: vigilados.has(nit),
    total: 0,
    contratos: 0,
    totalOrto: 0,
    totalIps: 0,
    fueraEscala: 0,
    primeraFecha: null,
    ultimaFecha: null,
    porLinea: [],
    anual: [],
    entidades: [],
  }
  const porLinea = new Map<string, { valor: number; contratos: number }>()
  const anios = new Map<number, AnioPunto>()
  const entidades = new Map<string, ProveedorEntidad>()
  const nombres = new Map<string, number>()

  for (const fact of facts) {
    if (esServicio(fact) || fact.proveedor_nit !== nit) continue
    const linea = lineaDe(fact)
    const valor = Number.isFinite(fact.valor) ? fact.valor : 0
    const n = fact.contratos || 1
    if (fact.proveedor_nombre) nombres.set(fact.proveedor_nombre, (nombres.get(fact.proveedor_nombre) || 0) + n)
    if (esFueraEscala(fact)) {
      summary.fueraEscala += n
      continue
    }
    summary.total += valor
    if (esOrto(linea)) summary.totalOrto += valor
    summary.contratos += n
    summary.primeraFecha = minDate(summary.primeraFecha, fact.fecha)
    summary.ultimaFecha = maxDate(summary.ultimaFecha, fact.fecha)
    const pl = porLinea.get(linea) ?? { valor: 0, contratos: 0 }
    pl.valor += valor
    pl.contratos += n
    porLinea.set(linea, pl)
    if (fact.fecha) {
      const anio = Number(fact.fecha.slice(0, 4))
      const point = anios.get(anio) ?? { anio, total: 0, lineas: {} }
      point.total += valor
      point.lineas[linea] = (point.lineas[linea] || 0) + valor
      anios.set(anio, point)
    }
    const sedes = sedesByNit.get(fact.nit_entidad) || []
    const principalSede = sedes.slice().sort((a, b) => (b.beds || 0) - (a.beds || 0) || a.name.localeCompare(b.name, 'es'))[0]
    if (sedes.length > 0) summary.totalIps += valor
    const ent =
      entidades.get(fact.nit_entidad) ??
      {
        nit: fact.nit_entidad,
        nombre: principalSede?.name || fact.nombre_entidad || `NIT ${fact.nit_entidad}`,
        esIps: sedes.length > 0,
        hospital_id: principalSede?.id ?? null,
        sedes: sedes.length,
        valor: 0,
        contratos: 0,
        ultimaFecha: null,
        lineas: {},
        anios: {},
      }
    ent.valor += valor
    ent.contratos += n
    ent.ultimaFecha = maxDate(ent.ultimaFecha, fact.fecha)
    ent.lineas[linea] = (ent.lineas[linea] || 0) + valor
    if (fact.fecha) ent.anios[fact.fecha.slice(0, 4)] = (ent.anios[fact.fecha.slice(0, 4)] || 0) + valor
    entidades.set(fact.nit_entidad, ent)
  }

  summary.nombre = topKey(nombres)
  summary.total = round2(summary.total)
  summary.totalOrto = round2(summary.totalOrto)
  summary.totalIps = round2(summary.totalIps)
  summary.porLinea = Array.from(porLinea.entries())
    .map(([linea, item]) => ({ linea, label: lineaLabel(linea), color: lineaColor(linea), orto: esOrto(linea), valor: round2(item.valor), contratos: item.contratos }))
    .sort((a, b) => compareLineas(a.linea, b.linea))
  summary.anual = Array.from(anios.values())
    .sort((a, b) => a.anio - b.anio)
    .map(point => ({ anio: point.anio, total: round2(point.total), lineas: roundRecord(point.lineas) }))
  summary.entidades = Array.from(entidades.values())
    .map(ent => ({ ...ent, valor: round2(ent.valor), lineas: roundRecord(ent.lineas), anios: roundRecord(ent.anios) }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, 'es'))
  return summary
}

// ---------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------

export interface SecopRankingQuery {
  group: SecopGroup
  linea: string | null
  line: string | null
  departamento: string | null
  desde: string
  hasta: string
  ambito: SecopAmbito
}

/**
 * Parámetros de GET /api/secop/ranking. `hoy` = 'YYYY-MM-DD' (para el rango por defecto: los 24 meses que
 * terminan en el mes actual). desde/hasta = 'YYYY-MM'.
 */
export function parseSecopRankingQuery(
  params: URLSearchParams,
  hoy: string
): { ok: true; value: SecopRankingQuery } | { ok: false; error: string } {
  const groupRaw = (params.get('group') || 'hospital').trim().toLowerCase()
  if (!SECOP_GROUPS.includes(groupRaw as SecopGroup)) return { ok: false, error: 'group debe ser hospital, proveedor, zona o ejecutivo' }
  const group = groupRaw as SecopGroup

  const lineaRaw = (params.get('linea') || '').trim()
  const linea = !lineaRaw ? null : lineaRaw.toLowerCase() === LINEA_TODAS ? LINEA_TODAS : normalizeLinea(lineaRaw)
  if (linea && linea !== LINEA_TODAS && !LINEAS_FILTRO.some(item => item.code === linea)) return { ok: false, error: 'linea no válida' }

  const lineRaw = (params.get('line') || '').trim().toLowerCase()
  if (lineRaw && !/^[a-z0-9_-]{1,40}$/.test(lineRaw)) return { ok: false, error: 'line no válida' }
  const line = lineRaw || null
  if (group === 'ejecutivo' && !line) return { ok: false, error: 'Para agrupar por Ejecutivo Comercial elige una línea de negocio (line)' }

  const departamento = (params.get('departamento') || '').trim() || null
  if (departamento && !/^\d{2}$/.test(departamento)) return { ok: false, error: 'departamento debe ser el código DANE de 2 dígitos' }

  const hoyYm = hoy.slice(0, 7)
  const desdeRaw = (params.get('desde') || '').trim()
  const hastaRaw = (params.get('hasta') || '').trim()
  if (desdeRaw && !MONTH_RE.test(desdeRaw)) return { ok: false, error: 'desde debe tener el formato YYYY-MM' }
  if (hastaRaw && !MONTH_RE.test(hastaRaw)) return { ok: false, error: 'hasta debe tener el formato YYYY-MM' }
  const hasta = hastaRaw || hoyYm
  const desde = desdeRaw || (hastaRaw ? addMonthsYm(hastaRaw, -(SECOP_DEFAULT_MESES - 1)) : addMonthsYm(hoyYm, -(SECOP_DEFAULT_MESES - 1)))
  if (desde > hasta) return { ok: false, error: 'desde no puede ser posterior a hasta' }
  if (desde < SECOP_MIN_MES) return { ok: false, error: `desde no puede ser anterior a ${SECOP_MIN_MES}` }

  const ambitoRaw = (params.get('ambito') || 'ips').trim().toLowerCase()
  if (ambitoRaw !== 'ips' && ambitoRaw !== 'todas') return { ok: false, error: 'ambito debe ser ips o todas' }
  const ambito: SecopAmbito = group === 'proveedor' && ambitoRaw === 'todas' ? 'todas' : 'ips'

  return { ok: true, value: { group, linea, line, departamento, desde, hasta, ambito } }
}

// ---------------------------------------------------------------------------
// CSV (Excel en español: BOM, ";", CRLF, sin fórmulas)
// ---------------------------------------------------------------------------

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value)) : ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`
  return text
}

/** CSV del ranking y de la tabla proveedor × hospital (una sección debajo de la otra). */
export function buildSecopCsv(data: {
  group: SecopGroup
  range: { desde: string; hasta: string }
  linea: string | null
  line: { name: string } | null
  ambito: SecopAmbito
  rows: SecopRankingRow[]
  pares: SecopPar[]
}): string {
  const lines: string[] = []
  const push = (cells: Array<string | number | boolean | null | undefined>) => lines.push(cells.map(csvCell).join(';'))
  const lineaCols = LINEAS_FILTRO.filter(l => (!data.linea ? esOrto(l.code) : data.linea === LINEA_TODAS ? true : l.code === data.linea))
  push([
    'Fuente: SECOP (Colombia Compra Eficiente, datos.gov.co)',
    `Rango: ${data.range.desde} a ${data.range.hasta}`,
    `Línea de producto: ${!data.linea ? 'Ortopédicas (6 líneas)' : data.linea === LINEA_TODAS ? 'Todas (incluye sin clasificar)' : lineaLabel(data.linea)}`,
    data.line ? `Línea de negocio: ${data.line.name}` : '',
    data.ambito === 'todas' ? 'Ámbito: todas las entidades públicas' : 'Ámbito: IPS de OpMap',
  ])
  const lineaHeaders = lineaCols.map(l => `${l.label} (COP)`)
  const lineaValues = (row: SecopRankingRow) => lineaCols.map(l => row.lineas[l.code] || 0)
  if (data.group === 'hospital') {
    push(['IPS', 'NIT', 'Nombre en SECOP', 'Sedes en OpMap', 'Municipio', 'Departamento', 'Zona', ...(data.line ? ['Ejecutivo Comercial'] : []), 'Valor (COP)', '% del total', 'Contratos', ...lineaHeaders, 'Principal proveedor', 'Último contrato'])
    for (const row of data.rows) {
      push([row.label, row.nit, row.nombre_secop, row.sedes, row.municipio, row.departamento, row.zona ?? 'Sin zona asignada', ...(data.line ? [row.ejecutivo] : []), row.valor, row.pct.toLocaleString('es-CO'), row.contratos, ...lineaValues(row), row.top_proveedor, row.ultimaFecha])
    }
  } else if (data.group === 'proveedor') {
    push(['Proveedor', 'NIT', 'Vigilado', 'Valor (COP)', '% del total', 'Contratos', 'Entidades', ...lineaHeaders, 'Principal entidad', 'Último contrato'])
    for (const row of data.rows) {
      push([row.label, row.nit, Boolean(row.vigilado), row.valor, row.pct.toLocaleString('es-CO'), row.contratos, row.entidades, ...lineaValues(row), row.top_entidad, row.ultimaFecha])
    }
  } else {
    const first = data.group === 'zona' ? 'Zona' : 'Ejecutivo Comercial'
    push([first, ...(data.group === 'ejecutivo' ? ['Zonas'] : []), 'Entidades', 'Valor (COP)', '% del total', 'Contratos', ...lineaHeaders, 'Principal entidad', 'Último contrato'])
    for (const row of data.rows) {
      push([row.label, ...(data.group === 'ejecutivo' ? [(row.zonas || []).join(', ')] : []), row.hospitales, row.valor, row.pct.toLocaleString('es-CO'), row.contratos, ...lineaValues(row), row.top_entidad, row.ultimaFecha])
    }
  }
  if (data.pares.length > 0) {
    lines.push('')
    push(['Proveedor × hospital'])
    push(['Proveedor', 'NIT proveedor', 'Vigilado', 'IPS', 'NIT IPS', 'Valor (COP)', 'Contratos', 'Último contrato'])
    for (const par of data.pares) {
      push([par.proveedor, par.proveedor_nit, par.vigilado, par.hospital, par.nit_entidad, par.valor, par.contratos, par.ultimaFecha])
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Fuentes de datos (panel de admin)
// ---------------------------------------------------------------------------

export type FuenteTipo = 'ligera' | 'pesada'

export interface FuenteCatalogo {
  fuente: string
  nombre: string
  frecuencia: string
  tipo: FuenteTipo
  /** Cómo se actualiza (texto para el panel). */
  como: string
  /** true si el botón "Actualizar ahora" puede correrla (cargas ligeras incrementales). */
  manual: boolean
}

export type FuenteSemaforo = 'ok' | 'atrasada' | 'error' | 'en_curso' | 'nunca'

/** Estado de una fuente tal como lo muestra el panel (fila de fuentes_estado + catálogo). */
export interface FuenteEstadoFila extends FuenteCatalogo {
  /** Expresión cron en UTC (fuentes_estado.programacion), p. ej. '0 6 * * *'. */
  programacion: string | null
  /** Horario legible en hora de Colombia ("Todos los días a la 1:00 a. m."). */
  horario: string | null
  /** vercel_cron | github_actions | manual */
  ejecutor: string | null
  ultimo_ok: string | null
  ultimo_intento: string | null
  estado: string | null
  filas: number | null
  mensaje: string | null
  /** fuentes_estado.siguiente_programado o, si está vacío, la próxima según la expresión cron. */
  siguiente_programado: string | null
  semaforo: FuenteSemaforo
}

// Cron de 5 campos en UTC con números o '*' (lo que usan vercel.json y datos.yml; parseo y próxima
// ejecución en lib/fuentes-estado.ts). Colombia = UTC−5 sin horario de verano.
const BOGOTA_OFFSET_H = -5
const DIAS_SEMANA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** "Todos los días a la 1:00 a. m.", "Los lunes a las 2:00 a. m.", "El día 3 de cada mes a las 2:00 a. m." (hora de Colombia). */
export function describeCron(expr: string | null | undefined): string | null {
  if (!expr) return null
  const cron = parseCronExpression(expr)
  if (!cron || cron.mes !== null || (cron.diaMes !== null && cron.diaSemana !== null)) return `Cron ${expr} (UTC)`
  let hour = cron.hora + BOGOTA_OFFSET_H
  let dayShift = 0
  if (hour < 0) {
    hour += 24
    dayShift = -1
  }
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const hora = `${h12}:${String(cron.minuto).padStart(2, '0')} ${hour < 12 ? 'a. m.' : 'p. m.'}`
  const art = h12 === 1 ? 'a la' : 'a las'
  if (cron.diaMes === null && cron.diaSemana === null) return `Todos los días ${art} ${hora}`
  if (cron.diaSemana !== null) return `Los ${DIAS_SEMANA[(cron.diaSemana + dayShift + 7) % 7]} ${art} ${hora}`
  const dia = (cron.diaMes as number) + dayShift
  return dia >= 1 ? `El día ${dia} de cada mes ${art} ${hora}` : `El último día de cada mes ${art} ${hora}`
}

/** Días entre cargas esperadas según la frecuencia del catálogo (para el semáforo "atrasada"). */
export function periodoDias(frecuencia: string): number {
  const f = sinTildes(frecuencia).toLowerCase()
  if (f.startsWith('diaria')) return 1
  if (f.startsWith('semanal')) return 7
  return 31
}

/** Une el catálogo con las filas de fuentes_estado (por `fuente`); las filas desconocidas van al final. */
/** Fila de fuentes_estado tal como la lee el servidor (todo opcional salvo la clave). */
export interface FuenteEstadoInput {
  fuente: string
  nombre?: string | null
  programacion?: string | null
  ejecutor?: string | null
  ultimo_ok?: string | null
  ultimo_intento?: string | null
  estado?: string | null
  filas?: number | string | null
  mensaje?: string | null
  siguiente_programado?: string | null
}

export function mergeFuentes(catalogo: readonly FuenteCatalogo[], estados: FuenteEstadoInput[], ahora: Date = new Date()): FuenteEstadoFila[] {
  const byFuente = new Map(estados.map(row => [row.fuente, row]))
  const build = (item: FuenteCatalogo, row: FuenteEstadoInput | undefined): FuenteEstadoFila => {
    const programacion = row?.programacion ?? null
    const base = {
      ...item,
      nombre: row?.nombre || item.nombre,
      programacion,
      horario: describeCron(programacion),
      ejecutor: row?.ejecutor ?? null,
      ultimo_ok: row?.ultimo_ok ?? null,
      ultimo_intento: row?.ultimo_intento ?? null,
      estado: row?.estado ?? null,
      filas: typeof row?.filas === 'number' ? row.filas : row?.filas != null && Number.isFinite(Number(row.filas)) ? Number(row.filas) : null,
      mensaje: row?.mensaje ?? null,
      siguiente_programado: row?.siguiente_programado ?? (programacion ? nextCronRun(programacion, ahora)?.toISOString() ?? null : null),
    }
    return { ...base, semaforo: fuenteSemaforo(base, periodoDias(item.frecuencia), ahora) }
  }
  const out: FuenteEstadoFila[] = catalogo.map(item => build(item, byFuente.get(item.fuente)))
  for (const row of estados) {
    if (catalogo.some(item => item.fuente === row.fuente)) continue
    out.push(build({ fuente: row.fuente, nombre: row.fuente, frecuencia: '—', tipo: 'ligera', como: '—', manual: false }, row))
  }
  return out
}

/**
 * Semáforo del panel: 'ok' si la última carga terminó bien y está al día; 'atrasada' si el último OK es
 * más viejo que 2 veces su periodo; 'error' si el último intento falló; 'nunca' si no hay registro.
 */
export function fuenteSemaforo(row: Pick<FuenteEstadoFila, 'estado' | 'ultimo_ok' | 'ultimo_intento'>, periodo: number, ahora: Date): FuenteSemaforo {
  const estado = (row.estado || '').toLowerCase()
  if (!row.ultimo_ok && !row.ultimo_intento && !estado) return 'nunca'
  if (estado === 'error') return 'error'
  if (estado === 'en_curso' || estado === 'corriendo' || estado === 'parcial') return 'en_curso'
  if (!row.ultimo_ok) return estado ? 'error' : 'nunca'
  const edadDias = (ahora.getTime() - new Date(row.ultimo_ok).getTime()) / 86400000
  return edadDias > periodo * 2 ? 'atrasada' : 'ok'
}

// ---------------------------------------------------------------------------
// Formas de respuesta de la API (compartidas por las rutas y la UI)
// ---------------------------------------------------------------------------

/** Fecha de la última carga correcta de cada fuente SECOP (fuentes_estado.ultimo_ok). */
export type SecopActualizado = Record<string, string | null>

export interface HospitalSecopResponse {
  hospital: { id: string; name: string; nit: string | null }
  /** Naturaleza en el REPS ('Pública', 'Mixta', 'Privada') o null si no se sabe. */
  naturaleza: string | null
  /**
   * true si la IPS es entidad de compra pública: marca manual (compra_publica) → REPS Pública/Mixta → NIT
   * con contratos en SECOP (resolverCompraPublica).
   */
  publica: boolean
  /** hospitals.compra_publica tal como está guardado: null = según REPS, true/false = marcado a mano. */
  compra_publica: boolean | null
  /** De dónde sale `publica`. */
  publica_origen: CompraPublicaOrigen
  /** Nombre con el que figura en SECOP (el más reciente). */
  entidad: { nit: string; nombre: string | null } | null
  summary: HospitalSecopSummary | null
  actualizado: SecopActualizado
  notes: string[]
}

export interface SecopRankingResponse extends SecopRanking {
  group: SecopGroup
  ambito: SecopAmbito
  linea: string | null
  line: { code: string; name: string } | null
  range: { desde: string; hasta: string }
  filters: {
    departamentos: Array<{ code: string; name: string }>
    lineas: Array<{ code: string; label: string; color: string }>
  }
  actualizado: SecopActualizado
  notes: string[]
}

export interface ProveedorSecopResponse extends ProveedorSecopSummary {
  /** Datos de la lista vigilada (Odoo o manual) si está en ella. */
  lista: { nombre: string | null; ciudad: string | null; origen: string | null; activo: boolean } | null
  actualizado: SecopActualizado
  notes: string[]
}

export interface VigiladoFila {
  nit: string
  dv: string | null
  nombre: string | null
  ciudad: string | null
  origen: string | null
  /** Compras de la compañía a este proveedor según Odoo (COP), si viene de Odoo. */
  compras_gcp_cop: number | null
  activo: boolean
  nota: string | null
  updated_at: string | null
  /** Ventas de material a entidades públicas en SECOP (todas las cargadas, sin valores fuera de escala). */
  ventas: { valor: number; contratos: number; entidades: number; ultimaFecha: string | null } | null
}

export interface VigiladosResponse {
  vigilados: VigiladoFila[]
  canEdit: boolean
}

export interface FuentesResponse {
  fuentes: FuenteEstadoFila[]
  /** true si CRON_SECRET existe en el servidor (sin revelar su valor). */
  cronConfigurado: boolean
  ahora: string
}

export interface FuenteActualizarResponse {
  fuente: string
  ok: boolean
  /** true si la carga llegó al final; false si se cortó por el presupuesto de tiempo (seguir con otro clic). */
  terminado: boolean
  estado: string | null
  filas: number | null
  mensaje: string | null
  duracionMs: number
}
