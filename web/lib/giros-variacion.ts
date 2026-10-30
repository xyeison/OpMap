// IPS con cambios fuera de lo normal en sus giros ADRES (spec 2026-10-29-giros-variaciones). Compara los últimos N
// meses de cada prestador (NIT) con los N anteriores o con los mismos meses del año anterior, descuenta lo que creció
// el mercado y separa el cambio real del vaivén mensual con pruebas estadísticas. Puro: sin red ni base de datos.
import { monthsBetween } from './adres-parse.mjs'
import {
  addMonths,
  epsDisplayName,
  matchesFilter,
  nitOfHospital,
  sedeShares,
  sedesPorNit,
  type GirosFilter,
  type IntelHospital,
} from './adres-intelligence'
import { mesCorto, rangoTexto, type MesesDisponibles } from './periodo-giros'

export type VentanaMeses = 3 | 6 | 12
export const VENTANAS: readonly VentanaMeses[] = [3, 6, 12] as const
export type Comparacion = 'anterior' | 'anio_anterior'
export const COMPARACIONES: readonly Comparacion[] = ['anterior', 'anio_anterior'] as const

/** Tendencia: hasta 12 meses que terminan en el mes "hasta". */
export const MESES_TENDENCIA = 12
/** Un mes "explica" el cambio si aporta al menos esta parte del cambio frente al mercado (solo es la etiqueta). */
export const PARTE_UN_MES = 0.6
/** Significancia de las pruebas (valor p o q). */
export const ALFA = 0.05
/**
 * Cambio mínimo frente al mercado para que una señal cuente: un cambio significativo pero menor que esto queda como
 * "cambio pequeño" (la estadística dice que es real, pero no es noticia).
 */
export const CAMBIO_MINIMO_FRENTE_AL_MERCADO = 0.1
/** Mínimo por defecto: 100 M al mes en promedio en alguna de las dos ventanas. */
export const MINIMO_MENSUAL_DEFECTO = 100_000_000
export const MINIMOS_MENSUALES: readonly number[] = [0, 100_000_000, 1_000_000_000] as const
/** Entidades por fila en "quién explica el cambio". */
export const ENTIDADES_POR_FILA = 3

// ---------------------------------------------------------------------------
// Estadística
// ---------------------------------------------------------------------------

export function media(valores: number[]): number {
  return valores.length ? valores.reduce((acc, v) => acc + v, 0) / valores.length : 0
}

/** Varianza muestral (n − 1). */
export function varianza(valores: number[]): number {
  if (valores.length < 2) return 0
  const m = media(valores)
  return valores.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (valores.length - 1)
}

export function mediana(valores: number[]): number {
  if (!valores.length) return 0
  const orden = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

/** ln Γ(x) (aproximación de Lanczos). */
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  const z = x - 1
  let a = LANCZOS[0]
  const t = z + 7.5
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i)
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
}

function fraccionContinuaBeta(x: number, a: number, b: number): number {
  const MAX = 300
  const EPS = 3e-14
  const MIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < MIN) d = MIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < MIN) d = MIN
    c = 1 + aa / c
    if (Math.abs(c) < MIN) c = MIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < MIN) d = MIN
    c = 1 + aa / c
    if (Math.abs(c) < MIN) c = MIN
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPS) break
  }
  return h
}

/** Beta incompleta regularizada I_x(a, b). */
export function betaIncompleta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const frente = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (frente * fraccionContinuaBeta(x, a, b)) / a
  return 1 - (frente * fraccionContinuaBeta(1 - x, b, a)) / b
}

/** Valor p de dos colas de t con df grados de libertad (t de Student). */
export function pValorT(t: number, df: number): number {
  if (Number.isNaN(t) || !(df > 0)) return 1
  if (!Number.isFinite(t)) return 0
  return betaIncompleta(df / (df + t * t), df / 2, 0.5)
}

/** erfc(x) con error relativo < 1,2e-7 (Numerical Recipes). */
function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    )
  return x >= 0 ? r : 2 - r
}

/** Valor p de dos colas de una z normal estándar. */
export function pValorNormal(z: number): number {
  if (Number.isNaN(z)) return 1
  if (!Number.isFinite(z)) return 0
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2))
}

/**
 * Prueba t de Welch: ¿la media de `a` difiere de `factorB` veces la media de `b`? (factorB = 1 + crecimiento del
 * mercado: la hipótesis nula es "creció igual que el mercado"). null si alguna muestra tiene menos de 2 valores.
 * Con varianza cero en las dos: t = 0 si son iguales, ±∞ (p = 0) si no.
 */
export function welch(a: number[], b: number[], factorB = 1): { t: number; df: number; p: number } | null {
  if (a.length < 2 || b.length < 2) return null
  const diferencia = media(a) - factorB * media(b)
  const va = varianza(a) / a.length
  const vb = (varianza(b) * factorB * factorB) / b.length
  const se2 = va + vb
  if (se2 <= 0) {
    const df = a.length + b.length - 2
    if (diferencia === 0) return { t: 0, df, p: 1 }
    return { t: diferencia > 0 ? Infinity : -Infinity, df, p: 0 }
  }
  const t = diferencia / Math.sqrt(se2)
  const df = (se2 * se2) / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1))
  return { t, df, p: pValorT(t, df) }
}

/**
 * ¿Un mes se sale de lo normal? t de predicción contra los meses de la base:
 * (x − factor·media(base)) / (factor·s_base·√(1 + 1/n)), con n − 1 grados de libertad. Con varianza cero en la base,
 * p = 0 si x difiere de lo esperado y 1 si no. null con menos de 2 meses de base.
 */
export function pruebaMesAtipico(valor: number, base: number[], factorB = 1): { t: number; df: number; p: number } | null {
  if (base.length < 2) return null
  const esperado = factorB * media(base)
  const s = factorB * Math.sqrt(varianza(base))
  const df = base.length - 1
  if (s <= 0) return valor === esperado ? { t: 0, df, p: 1 } : { t: valor > esperado ? Infinity : -Infinity, df, p: 0 }
  const t = (valor - esperado) / (s * Math.sqrt(1 + 1 / base.length))
  return { t, df, p: pValorT(t, df) }
}

/**
 * Prueba de tendencia de Mann–Kendall (con corrección por empates y por continuidad): S, tau, z y valor p de dos colas.
 * null con menos de 4 valores.
 */
export function mannKendall(valores: number[]): { s: number; tau: number; z: number; p: number } | null {
  const n = valores.length
  if (n < 4) return null
  let s = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(valores[j] - valores[i])
  }
  const empates = new Map<number, number>()
  for (const v of valores) empates.set(v, (empates.get(v) || 0) + 1)
  let correccion = 0
  empates.forEach(t => {
    if (t > 1) correccion += t * (t - 1) * (2 * t + 5)
  })
  const var_s = (n * (n - 1) * (2 * n + 5) - correccion) / 18
  const z = var_s > 0 ? (s > 0 ? (s - 1) / Math.sqrt(var_s) : s < 0 ? (s + 1) / Math.sqrt(var_s) : 0) : 0
  return { s, tau: s / ((n * (n - 1)) / 2), z, p: var_s > 0 ? pValorNormal(z) : 1 }
}

/** Pendiente de Sen: mediana de las pendientes entre todos los pares de puntos (robusta a un mes atípico). */
export function pendienteSen(valores: number[]): number {
  const pendientes: number[] = []
  for (let i = 0; i < valores.length - 1; i++) {
    for (let j = i + 1; j < valores.length; j++) pendientes.push((valores[j] - valores[i]) / (j - i))
  }
  return mediana(pendientes)
}

/** Valores q de Benjamini–Hochberg (tasa de falsos descubrimientos); los null quedan null. */
export function benjaminiHochberg(pValores: Array<number | null>): Array<number | null> {
  const conValor = pValores
    .map((p, index) => ({ p, index }))
    .filter((item): item is { p: number; index: number } => item.p !== null && Number.isFinite(item.p))
    .sort((a, b) => a.p - b.p)
  const m = conValor.length
  const q: Array<number | null> = pValores.map(() => null)
  let minimo = 1
  for (let k = m - 1; k >= 0; k--) {
    minimo = Math.min(minimo, (conValor[k].p * m) / (k + 1))
    q[conValor[k].index] = minimo
  }
  return q
}

// ---------------------------------------------------------------------------
// Ventanas de meses
// ---------------------------------------------------------------------------

export interface TramoMeses {
  desde: string
  hasta: string
  meses: string[]
}

export interface VentanasVariacion {
  ventana: VentanaMeses
  comparacion: Comparacion
  reciente: TramoMeses
  base: TramoMeses
  /** Hasta MESES_TENDENCIA meses que terminan en "hasta" (los que haya con datos). */
  tendencia: string[]
  /** Todos los meses que se cargan, en orden (base, reciente, tendencia y lo que hay entre ellos). */
  meses: string[]
  /** Meses de la tendencia que no están ni en la base ni en la reciente: se piden aparte. */
  extra: Array<{ desde: string; hasta: string }>
  /** "abr–sep 2026 frente a oct 2025 – mar 2026". */
  texto: string
}

const tramo = (desde: string, hasta: string): TramoMeses => ({ desde, hasta, meses: monthsBetween(desde, hasta) })

/** Tramos contiguos de una lista ordenada de meses. */
function tramosContiguos(meses: string[]): Array<{ desde: string; hasta: string }> {
  const out: Array<{ desde: string; hasta: string }> = []
  for (const mes of meses) {
    const ultimo = out[out.length - 1]
    if (ultimo && addMonths(ultimo.hasta, 1) === mes) ultimo.hasta = mes
    else out.push({ desde: mes, hasta: mes })
  }
  return out
}

/**
 * Ventanas de la comparación. La reciente son los N meses que terminan en "hasta"; la base, los N anteriores o los
 * mismos meses del año anterior. Error con el porqué si la base empieza antes de los datos cargados.
 */
export function ventanasVariacion(params: {
  hasta: string
  ventana: VentanaMeses
  comparacion: Comparacion
  disponible: MesesDisponibles
}): { ok: true; value: VentanasVariacion } | { ok: false; error: string } {
  const { hasta, ventana, comparacion, disponible } = params
  if (hasta < disponible.min || hasta > disponible.max) {
    return { ok: false, error: `No hay giros cargados en ${mesCorto(hasta)}: la fuente tiene de ${mesCorto(disponible.min)} a ${mesCorto(disponible.max)}.` }
  }
  const reciente = tramo(addMonths(hasta, -(ventana - 1)), hasta)
  const baseHasta = comparacion === 'anterior' ? addMonths(hasta, -ventana) : addMonths(hasta, -12)
  const base = tramo(addMonths(baseHasta, -(ventana - 1)), baseHasta)
  if (base.desde < disponible.min) {
    const contra = comparacion === 'anterior' ? `con los ${ventana} anteriores` : 'con los mismos meses del año anterior'
    const necesarios = monthsBetween(base.desde, hasta).length
    return {
      ok: false,
      error: `Comparar ${ventana} meses ${contra} pide ${necesarios} meses de giros (desde ${mesCorto(base.desde)}); los cargados empiezan en ${mesCorto(disponible.min)}.`,
    }
  }
  const inicioTendencia = addMonths(hasta, -(MESES_TENDENCIA - 1)) > disponible.min ? addMonths(hasta, -(MESES_TENDENCIA - 1)) : disponible.min
  const tendencia = monthsBetween(inicioTendencia, hasta)
  const enVentanas = new Set([...base.meses, ...reciente.meses])
  const extra = tramosContiguos(tendencia.filter(mes => !enVentanas.has(mes)))
  const primero = base.desde < inicioTendencia ? base.desde : inicioTendencia
  return {
    ok: true,
    value: {
      ventana,
      comparacion,
      reciente,
      base,
      tendencia,
      meses: monthsBetween(primero, hasta),
      extra,
      texto: `${rangoTexto(reciente.desde, reciente.hasta)} frente a ${rangoTexto(base.desde, base.hasta)}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Análisis por prestador (NIT)
// ---------------------------------------------------------------------------

export type SenalVariacion =
  /** La mayoría de los meses recientes por encima de lo esperado (MESES_SOSTENIDO). */
  | 'sube_sostenido'
  | 'sube'
  /** Un solo mes explica al menos PARTE_UN_MES del cambio frente al mercado (un pago extraordinario). */
  | 'sube_un_mes'
  | 'giros_nuevos'
  | 'baja_sostenido'
  | 'baja'
  | 'baja_un_mes'
  | 'dejo_de_recibir'
  /** Frente al mercado baja, pero en pesos no: crece, menos que el resto. */
  | 'crece_menos'
  /** Frente al mercado sube, pero en pesos no: cae, menos que el resto (cuando el mercado cae). */
  | 'cae_menos'
  /** Significativo pero menor que CAMBIO_MINIMO_FRENTE_AL_MERCADO. */
  | 'cambio_pequeno'
  | 'sin_cambio'

export type ConfianzaVariacion = 'alta' | 'media' | 'baja'

export const SENAL_TEXTO: Record<SenalVariacion, string> = {
  sube_sostenido: 'Sube sostenido',
  sube: 'Sube',
  sube_un_mes: 'Pago grande en un mes',
  giros_nuevos: 'Giros nuevos',
  baja_sostenido: 'Baja sostenido',
  baja: 'Baja',
  baja_un_mes: 'Un mes muy bajo',
  dejo_de_recibir: 'Dejó de recibir',
  crece_menos: 'Crece menos que el mercado',
  cae_menos: 'Cae menos que el mercado',
  cambio_pequeno: 'Cambio pequeño',
  sin_cambio: 'Sin cambio claro',
}

/** La señal en palabras, con el mes cuando un solo mes explica el cambio ("Pago grande en jul 2026"). */
export function textoSenal(fila: Pick<VariacionIps, 'senal' | 'mesPico'>): string {
  if (fila.senal === 'sube_un_mes' && fila.mesPico) return `Pago grande en ${mesCorto(fila.mesPico)}`
  if (fila.senal === 'baja_un_mes' && fila.mesPico) return `Mes muy bajo: ${mesCorto(fila.mesPico)}`
  return SENAL_TEXTO[fila.senal]
}

export const CONFIANZA_TEXTO: Record<ConfianzaVariacion, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

/** Por encima del mercado (incluye los giros nuevos y "cae menos que el mercado"). */
export function senalSube(senal: SenalVariacion): boolean {
  return senal === 'sube_sostenido' || senal === 'sube' || senal === 'sube_un_mes' || senal === 'giros_nuevos' || senal === 'cae_menos'
}

/** Por debajo del mercado (incluye "dejó de recibir" y "crece menos que el mercado"). */
export function senalBaja(senal: SenalVariacion): boolean {
  return senal === 'baja_sostenido' || senal === 'baja' || senal === 'baja_un_mes' || senal === 'dejo_de_recibir' || senal === 'crece_menos'
}

export interface EntidadCambio {
  clave: string
  nombre: string
  base: number
  reciente: number
  cambio: number
  /** No giraba en la ventana base. */
  nueva: boolean
  /** Giraba en la base y no en la reciente. */
  dejo: boolean
}

export interface VariacionIps {
  nit: string
  /** Sede principal en el filtro (la de más camas): nombre, ubicación y Zona de la fila. */
  hospital_id: string
  nombre: string
  /** Sedes activas del NIT en OpMap y cuántas entran en el filtro. */
  sedes: number
  sedesEnFiltro: number
  municipio: string | null
  departamento: string | null
  zona: string | null
  ejecutivo: string | null
  ejecutivo_color: string | null
  /** Parte del giro del NIT que va al filtro (reparto por camas; 1 sin filtro o si todas sus sedes entran). */
  parte: number
  base: number
  reciente: number
  cambio: number
  /** reciente / base − 1 (0,25 = +25 %); null si no tenía giros en la base. */
  variacion: number | null
  /** (1 + variacion) / (1 + variación del mercado) − 1. */
  frenteAlMercado: number | null
  /**
   * Valor p de la fila: el menor entre Welch (promedio mensual) y el mes atípico (corregido por Šidák por los meses de
   * la ventana), multiplicado por 2 (Bonferroni por usar dos pruebas). Su valor q es de Benjamini–Hochberg entre TODOS
   * los NIT evaluados del país, no solo los del filtro.
   */
  p: number | null
  q: number | null
  /** La prueba que dio el menor valor p: 'nivel' (Welch) o 'mes' (un mes fuera de lo normal); null sin prueba. */
  prueba: 'nivel' | 'mes' | null
  /** Tendencia de los últimos 12 meses (o los que haya): solo informativa. */
  tendencia: { tau: number; p: number; pendientePct: number | null } | null
  /** Mes que explica al menos PARTE_UN_MES del cambio frente al mercado, si lo hay. */
  mesPico: string | null
  senal: SenalVariacion
  confianza: ConfianzaVariacion
  entidades: EntidadCambio[]
  /** Giro de cada mes de ventanas.meses (con el reparto por camas). */
  serie: number[]
}

export interface TotalesVariacion {
  base: number
  reciente: number
  variacion: number | null
}

export interface ResultadoVariaciones {
  /** Todos los NIT cargados en OpMap con los meses completos (sin filtros): el "mercado" con el que se compara. */
  mercado: TotalesVariacion & { nits: number }
  /** Las IPS del filtro, con el reparto por camas (también las pequeñas). */
  grupo: TotalesVariacion & { nits: number }
  filas: VariacionIps[]
  resumen: {
    /** Filas del filtro (todas las confianzas). */
    evaluadas: number
    /** Por encima del mercado (senalSube sin los giros nuevos), por confianza. */
    suben: { alta: number; media: number }
    /** Por debajo del mercado (senalBaja sin "dejó de recibir"), por confianza. */
    bajan: { alta: number; media: number }
    nuevas: number
    dejan: number
    /** Sin cambio claro o con un cambio pequeño frente al mercado. */
    sinCambio: number
    /** NIT del filtro cuyo giro total (del NIT, no de su parte) está por debajo del mínimo mensual: no se listan. */
    pequenas: number
    /** NIT con giros que no tienen ninguna IPS activa en OpMap (no se listan). */
    sinIps: number
    /** NIT sin consulta correcta a la ADRES en todos los meses comparados (bitácora): ni se listan ni van al mercado. */
    sinDatosCompletos: number
    /** Cuántos NIT entran en la corrección de Benjamini–Hochberg (todo el país). */
    familia: number
  }
}

/** Meses consultados a la ADRES de un NIT (bitácora: consultas ok o sin registros), como rangos 'YYYY-MM'. */
export type CoberturaNits = Map<string, Array<{ desde: string; hasta: string }>>

/** ¿Los rangos consultados cubren todos los meses pedidos? */
export function cubreMeses(rangos: Array<{ desde: string; hasta: string }> | undefined, meses: string[]): boolean {
  if (!rangos || rangos.length === 0) return false
  return meses.every(mes => rangos.some(rango => rango.desde <= mes && mes <= rango.hasta))
}

const suma = (valores: number[]) => valores.reduce((acc, v) => acc + v, 0)
const variacionDe = (base: number, reciente: number) => (base > 0 ? reciente / base - 1 : null)

/** Meses recientes (de la ventana) que deben ir por encima (o por debajo) de lo esperado para llamarlo "sostenido". */
export const mesesSostenido = (ventana: number) => Math.ceil((2 * ventana) / 3)

function ejecutivoDe(hospital: IntelHospital): { nombre: string; color: string | null } {
  if (hospital.executive) return { nombre: hospital.executive.full_name, color: hospital.executive.color }
  if (!hospital.kam_id) return { nombre: 'Sin zona asignada', color: null }
  if (hospital.coverage_kind === 'conflict') return { nombre: 'Conflicto (varios en la Zona)', color: null }
  return { nombre: 'Sin cobertura', color: null }
}

/** Entidades que más aportan al cambio, en su misma dirección. */
export function entidadesDelCambio(
  base: Record<string, number> | undefined,
  reciente: Record<string, number> | undefined,
  parte: number,
  direccion: number,
  nombres: Record<string, string> | undefined,
  n = ENTIDADES_POR_FILA
): EntidadCambio[] {
  if (direccion === 0) return []
  const claves = new Set([...Object.keys(base || {}), ...Object.keys(reciente || {})])
  const out: EntidadCambio[] = []
  claves.forEach(clave => {
    const b = (base?.[clave] || 0) * parte
    const r = (reciente?.[clave] || 0) * parte
    const cambio = r - b
    if (cambio === 0 || Math.sign(cambio) !== Math.sign(direccion)) return
    out.push({ clave, nombre: epsDisplayName(clave, nombres), base: b, reciente: r, cambio, nueva: b <= 0 && r > 0, dejo: b > 0 && r <= 0 })
  })
  return out.sort((x, y) => Math.abs(y.cambio) - Math.abs(x.cambio) || x.nombre.localeCompare(y.nombre, 'es')).slice(0, n)
}

/** Lo que se calcula una vez por NIT, sin filtro: totales, pruebas y forma del cambio. */
interface PruebaNit {
  base: number
  reciente: number
  pNivel: number | null
  pMes: number | null
  p: number | null
  prueba: VariacionIps['prueba']
  /** Índice (en la ventana reciente) del mes que más se aparta, y su parte del cambio frente al mercado. */
  indiceExtremo: number | null
  parteExtremo: number | null
  /** Meses recientes por encima (o por debajo, según la dirección) de lo esperado. */
  mesesEnDireccion: number
  q: number | null
}

/**
 * Pruebas de un NIT contra "creció como el mercado" (factor = 1 + crecimiento del mercado):
 * - Welch sobre los giros mensuales de las dos ventanas;
 * - el mes reciente que más se aparta, frente a los meses de la base, con la corrección de Šidák por haber elegido el
 *   más extremo de N meses: 1 − (1 − p)^N;
 * - p de la fila = mín(1, 2 × el menor de los dos) (Bonferroni por usar dos pruebas).
 * Se elige "el mes más extremo" antes de probar, pero la corrección lo paga: bajo la hipótesis nula la fila no da
 * p < 0,05 más del 5 % de las veces (prueba de calibración en scripts/giros-variacion-check.ts).
 */
export function probarNit(base: number[], reciente: number[], factor: number): Omit<PruebaNit, 'q'> {
  const B = suma(base)
  const R = suma(reciente)
  const sinPrueba = { base: B, reciente: R, pNivel: null, pMes: null, p: null, prueba: null, indiceExtremo: null, parteExtremo: null, mesesEnDireccion: 0 }
  if (B <= 0 || R <= 0) return sinPrueba
  const esperado = factor * media(base)
  const exceso = R - factor * B
  const direccion = Math.sign(exceso)
  const excesos = reciente.map(v => v - esperado)
  const indiceExtremo = direccion >= 0 ? excesos.indexOf(Math.max(...excesos)) : excesos.indexOf(Math.min(...excesos))
  const nivel = welch(reciente, base, factor)
  const mes = pruebaMesAtipico(reciente[indiceExtremo], base, factor)
  const pMes = mes ? 1 - Math.pow(1 - mes.p, reciente.length) : null
  const pNivel = nivel ? nivel.p : null
  const menor = pNivel === null ? pMes : pMes === null ? pNivel : Math.min(pNivel, pMes)
  return {
    base: B,
    reciente: R,
    pNivel,
    pMes,
    p: menor === null ? null : Math.min(1, 2 * menor),
    prueba: menor === null ? null : pMes !== null && pMes === menor && (pNivel === null || pMes < pNivel) ? 'mes' : 'nivel',
    indiceExtremo: exceso !== 0 ? indiceExtremo : null,
    parteExtremo: exceso !== 0 ? excesos[indiceExtremo] / exceso : null,
    mesesEnDireccion: direccion === 0 ? 0 : excesos.filter(e => Math.sign(e) === direccion).length,
  }
}

/**
 * Analiza los NIT:
 * 1. Solo los que tienen consulta correcta a la ADRES en todos los meses comparados (bitácora `cobertura`; null = sin
 *    bitácora, se toman todos): un mes sin consultar no es un mes sin giro.
 * 2. El mercado: todos esos NIT, sin filtro, con la misma fuente y régimen.
 * 3. Las pruebas (probarNit) para cada NIT con IPS activa en OpMap y giro total ≥ mínimo mensual, en TODO el país, y
 *    Benjamini–Hochberg entre todos ellos: filtrar por municipio no le quita la corrección.
 * 4. Las filas del filtro, con los pesos según la parte de sus sedes (reparto por camas) y las entidades que explican
 *    el cambio.
 */
export function analizarVariaciones(params: {
  hospitals: IntelHospital[]
  /** NIT → mes 'YYYY-MM' → giro total del mes. */
  series: Map<string, Record<string, number>>
  /** NIT → entidad → giro en la ventana base / en la reciente. */
  entidadesBase: Map<string, Record<string, number>>
  entidadesReciente: Map<string, Record<string, number>>
  nombresEntidades?: Record<string, string>
  ventanas: VentanasVariacion
  filtro: GirosFilter
  minimoMensual: number
  conEjecutivo: boolean
  /** Meses consultados de cada NIT (bitácora); null = sin bitácora. */
  cobertura?: CoberturaNits | null
}): ResultadoVariaciones {
  const { hospitals, series, entidadesBase, entidadesReciente, nombresEntidades, ventanas, filtro, minimoMensual, conEjecutivo, cobertura } = params
  const valoresDe = (nit: string, meses: string[]) => meses.map(mes => series.get(nit)?.[mes] || 0)
  const comparados = [...ventanas.base.meses, ...ventanas.reciente.meses]

  // 1. Con los meses completos
  const completos = new Set<string>()
  let sinDatosCompletos = 0
  series.forEach((_, nit) => {
    if (!cobertura || cubreMeses(cobertura.get(nit), comparados)) completos.add(nit)
    else sinDatosCompletos++
  })

  // 2. Mercado
  let mercadoBase = 0
  let mercadoReciente = 0
  completos.forEach(nit => {
    mercadoBase += suma(valoresDe(nit, ventanas.base.meses))
    mercadoReciente += suma(valoresDe(nit, ventanas.reciente.meses))
  })
  const mercadoVariacion = variacionDe(mercadoBase, mercadoReciente)
  const factorMercado = 1 + (mercadoVariacion ?? 0)

  // Sedes por NIT (todas) y las del filtro
  const partes = sedeShares(hospitals)
  const sedes = sedesPorNit(hospitals)
  const enFiltro = new Map<string, IntelHospital[]>()
  const nitsConIps = new Set<string>()
  for (const hospital of hospitals) {
    const nit = nitOfHospital(hospital)
    if (!nit) continue
    nitsConIps.add(nit)
    if (!matchesFilter(hospital, filtro)) continue
    const lista = enFiltro.get(nit)
    if (lista) lista.push(hospital)
    else enFiltro.set(nit, [hospital])
  }
  let sinIps = 0
  series.forEach((_, nit) => {
    if (!nitsConIps.has(nit)) sinIps++
  })

  // 3. Pruebas de todo el país y Benjamini–Hochberg entre todas
  const pruebas = new Map<string, PruebaNit>()
  completos.forEach(nit => {
    if (!nitsConIps.has(nit)) return
    const b = valoresDe(nit, ventanas.base.meses)
    const r = valoresDe(nit, ventanas.reciente.meses)
    if (suma(b) <= 0 && suma(r) <= 0) return
    if (Math.max(suma(b), suma(r)) / ventanas.ventana < minimoMensual) return
    pruebas.set(nit, { ...probarNit(b, r, factorMercado), q: null })
  })
  const nitsProbados = Array.from(pruebas.keys())
  const q = benjaminiHochberg(nitsProbados.map(nit => pruebas.get(nit)!.p))
  nitsProbados.forEach((nit, index) => {
    pruebas.get(nit)!.q = q[index]
  })

  // 4. Filas del filtro
  const grupo = { base: 0, reciente: 0, nits: 0 }
  let pequenas = 0
  const filas: VariacionIps[] = []
  const umbralSostenido = mesesSostenido(ventanas.ventana)
  enFiltro.forEach((lista, nit) => {
    if (!completos.has(nit)) return
    const parte = lista.reduce((acc, hospital) => acc + (partes.get(hospital.id) ?? 0), 0)
    const escalar = (valores: number[]) => valores.map(v => v * parte)
    const base = suma(valoresDe(nit, ventanas.base.meses)) * parte
    const reciente = suma(valoresDe(nit, ventanas.reciente.meses)) * parte
    if (base <= 0 && reciente <= 0) return
    grupo.base += base
    grupo.reciente += reciente
    grupo.nits++
    const prueba = pruebas.get(nit)
    if (!prueba) {
      pequenas++
      return
    }

    const principal = [...lista].sort((x, y) => (y.beds || 0) - (x.beds || 0) || x.name.localeCompare(y.name, 'es'))[0]
    const ejecutivo = conEjecutivo ? ejecutivoDe(principal) : null
    const variacion = variacionDe(prueba.base, prueba.reciente)
    const frenteAlMercado = variacion === null ? null : (1 + variacion) / factorMercado - 1
    const tendenciaValores = valoresDe(nit, ventanas.tendencia)
    const mk = mannKendall(tendenciaValores)
    const tipico = mediana(tendenciaValores)
    const mesesConGiro = (meses: string[]) => valoresDe(nit, meses).filter(v => v > 0).length

    let senal: SenalVariacion = 'sin_cambio'
    let confianza: ConfianzaVariacion = 'baja'
    let mesPico: string | null = null
    if (prueba.base <= 0) {
      senal = 'giros_nuevos'
      confianza = mesesConGiro(ventanas.reciente.meses) >= 2 ? 'alta' : 'media'
    } else if (prueba.reciente <= 0) {
      senal = 'dejo_de_recibir'
      confianza = mesesConGiro(ventanas.base.meses) >= 2 ? 'alta' : 'media'
    } else {
      confianza = prueba.q !== null && prueba.q < ALFA ? 'alta' : prueba.p !== null && prueba.p < ALFA ? 'media' : 'baja'
      if (confianza !== 'baja') {
        if (frenteAlMercado !== null && Math.abs(frenteAlMercado) < CAMBIO_MINIMO_FRENTE_AL_MERCADO) senal = 'cambio_pequeno'
        else {
          const sube = prueba.reciente > factorMercado * prueba.base
          if (prueba.parteExtremo !== null && prueba.indiceExtremo !== null && prueba.parteExtremo >= PARTE_UN_MES) {
            mesPico = ventanas.reciente.meses[prueba.indiceExtremo]
            senal = sube ? 'sube_un_mes' : 'baja_un_mes'
          } else if (prueba.mesesEnDireccion >= umbralSostenido) senal = sube ? 'sube_sostenido' : 'baja_sostenido'
          else senal = sube ? 'sube' : 'baja'
          // Frente al mercado sí, en pesos no: que la palabra no diga "baja" de una IPS que creció
          if (!sube && prueba.reciente >= prueba.base) senal = 'crece_menos'
          if (sube && prueba.reciente < prueba.base) senal = 'cae_menos'
        }
      }
    }

    filas.push({
      nit,
      hospital_id: principal.id,
      nombre: principal.name,
      sedes: sedes.get(nit) ?? lista.length,
      sedesEnFiltro: lista.length,
      municipio: principal.municipality_name,
      departamento: principal.department_name,
      zona: principal.zone_name,
      ejecutivo: ejecutivo?.nombre ?? null,
      ejecutivo_color: ejecutivo?.color ?? null,
      parte,
      base,
      reciente,
      cambio: reciente - base,
      variacion,
      frenteAlMercado,
      p: prueba.p,
      q: prueba.q,
      prueba: prueba.prueba,
      tendencia: mk ? { tau: mk.tau, p: mk.p, pendientePct: tipico > 0 ? pendienteSen(tendenciaValores) / tipico : null } : null,
      mesPico,
      senal,
      confianza,
      // Las entidades explican el cambio en pesos (sin descontar el mercado): las que más movieron en su misma dirección
      entidades: entidadesDelCambio(entidadesBase.get(nit), entidadesReciente.get(nit), parte, Math.sign(reciente - base), nombresEntidades),
      serie: escalar(valoresDe(nit, ventanas.meses)),
    })
  })

  filas.sort((x, y) => Math.abs(y.cambio) - Math.abs(x.cambio) || x.nombre.localeCompare(y.nombre, 'es'))
  const contar = (condicion: (fila: VariacionIps) => boolean) => filas.filter(condicion).length
  const porConfianza = (en: (senal: SenalVariacion) => boolean, excluir: SenalVariacion) => ({
    alta: contar(fila => en(fila.senal) && fila.senal !== excluir && fila.confianza === 'alta'),
    media: contar(fila => en(fila.senal) && fila.senal !== excluir && fila.confianza === 'media'),
  })
  return {
    mercado: { base: mercadoBase, reciente: mercadoReciente, variacion: mercadoVariacion, nits: completos.size },
    grupo: { base: grupo.base, reciente: grupo.reciente, variacion: variacionDe(grupo.base, grupo.reciente), nits: grupo.nits },
    filas,
    resumen: {
      evaluadas: filas.length,
      suben: porConfianza(senalSube, 'giros_nuevos'),
      bajan: porConfianza(senalBaja, 'dejo_de_recibir'),
      nuevas: contar(fila => fila.senal === 'giros_nuevos'),
      dejan: contar(fila => fila.senal === 'dejo_de_recibir'),
      sinCambio: contar(fila => fila.senal === 'sin_cambio' || fila.senal === 'cambio_pequeno'),
      pequenas,
      sinIps,
      sinDatosCompletos,
      familia: pruebas.size,
    },
  }
}

// ---------------------------------------------------------------------------
// Parámetros de la API
// ---------------------------------------------------------------------------

export interface VariacionQuery {
  ventana: VentanaMeses
  comparacion: Comparacion
  hasta: string | null
  minimoMensual: number
}

const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** ventana=3|6|12, comparar=anterior|anio_anterior, hasta=YYYY-MM, minimo=<pesos al mes> (0, 100 M o 1.000 M). */
export function parseVariacionQuery(params: URLSearchParams): { ok: true; value: VariacionQuery } | { ok: false; error: string } {
  const ventana = Number(params.get('ventana') || 6)
  if (!(VENTANAS as readonly number[]).includes(ventana)) return { ok: false, error: 'ventana debe ser 3, 6 o 12 meses' }
  const comparacion = (params.get('comparar') || 'anterior').trim().toLowerCase()
  if (!(COMPARACIONES as readonly string[]).includes(comparacion)) return { ok: false, error: 'comparar debe ser anterior o anio_anterior' }
  const hasta = (params.get('hasta') || '').trim() || null
  if (hasta && !MES_RE.test(hasta)) return { ok: false, error: 'hasta debe tener el formato YYYY-MM' }
  const minimoTexto = params.get('minimo')
  const minimoMensual = minimoTexto === null || minimoTexto === '' ? MINIMO_MENSUAL_DEFECTO : Number(minimoTexto)
  if (!MINIMOS_MENSUALES.includes(minimoMensual)) return { ok: false, error: 'minimo debe ser 0, 100000000 o 1000000000' }
  return { ok: true, value: { ventana: ventana as VentanaMeses, comparacion: comparacion as Comparacion, hasta, minimoMensual } }
}
