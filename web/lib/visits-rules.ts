/**
 * Fase 7 · F2 Configuración y calendario (app de visita): lógica PURA (sin red, sin base de datos, sin node:*),
 * compartida por la API (/api/config-visitas/**, /api/calendario/**, /api/dias-libres/**, /api/me/**), la
 * interfaz (/configuracion, /calendario) y las pruebas (scripts/visits-check.ts).
 * Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Código puro").
 * Spec: docs/specs/2026-10-12-app-de-visita-opmap.md (secciones 6, 7, 11 y 12).
 *
 * Qué hay aquí:
 *   1. Constantes con su etiqueta en español (tipos de visita, alcances de meta, modos de conteo, calendario,
 *      estados de día libre...) y mensajes que la API y la base comparten.
 *   2. Fechas como texto ISO AAAA-MM-DD, sin zona horaria. Colombia es UTC−5 todo el año (sin horario de
 *      verano), así que "hoy en Bogotá" es la hora UTC menos 5 horas.
 *   3. Festivos de Colombia (Ley 51 de 1983): fijos, trasladados al lunes y los que dependen de Pascua. Los
 *      mismos 18 por año, con los mismos nombres, que calendario_festivos_colombia() de la migración 0810.
 *   4. Vigencias: valor que regía en una fecha, superposición y planearCambio, espejo de los pasos 3 a 6 de
 *      config_registrar (la interfaz lo usa para la vista previa antes de guardar).
 *   5. Configuración general (con respaldo a la semilla), configuración por persona, metas (ejecutiva > zona >
 *      general) y meta diaria (la semanal se reparte entre los días hábiles de la semana).
 *   6. Calendario: fracción hábil de un día (ciudad > empresa > festivo nacional > día de la semana).
 *   7. Días libres: fracción libre o por aprobar, plazo de gracia y transiciones de estado.
 *   8. Cuota del periodo y ritmo.
 *   9. Conteo: cuánto vale una visita según config_conteo vigente en su fecha (ninguna visita lo usa en F2).
 *  10. Tipos de filas y de respuestas de la API, para que API e interfaz hablen igual.
 */
import type { Role } from './permissions'
import { etiquetaDe, valoresDe, type Opcion, type SubtipoRow } from './terceros'

// ---------------------------------------------------------------------------------------------
// 1. Constantes y mensajes
// ---------------------------------------------------------------------------------------------

/** Tipos de visita (config_metas.tipo y config_personas.perfil). */
export const TIPOS_VISITA = [
  { valor: 'medica', etiqueta: 'Médica' },
  { valor: 'institucional', etiqueta: 'Institucional' },
] as const satisfies readonly Opcion[]
export type TipoVisita = (typeof TIPOS_VISITA)[number]['valor']
export const VALORES_TIPO_VISITA = valoresDe<TipoVisita>(TIPOS_VISITA)

/** Alcance de una meta (config_metas.scope): valor general, de una zona o de una persona (excepción). */
export const SCOPES_META = [
  { valor: 'general', etiqueta: 'Toda la empresa' },
  { valor: 'zona', etiqueta: 'Zona' },
  { valor: 'ejecutiva', etiqueta: 'Ejecutivo Comercial' },
] as const satisfies readonly Opcion[]
export type ScopeMeta = (typeof SCOPES_META)[number]['valor']
export const VALORES_SCOPE_META = valoresDe<ScopeMeta>(SCOPES_META)

/** Periodo de una meta (config_metas.periodo). */
export const PERIODOS_META = [
  { valor: 'dia', etiqueta: 'Al día' },
  { valor: 'semana', etiqueta: 'A la semana' },
] as const satisfies readonly Opcion[]
export type PeriodoMeta = (typeof PERIODOS_META)[number]['valor']
export const VALORES_PERIODO_META = valoresDe<PeriodoMeta>(PERIODOS_META)

/** Qué hace una visita institucional de un subtipo (config_conteo.modo). */
export const MODOS_CONTEO = [
  { valor: 'suma_institucional', etiqueta: 'Suma a la meta institucional' },
  { valor: 'meta_propia', etiqueta: 'Tiene meta propia' },
  { valor: 'seguimiento', etiqueta: 'Solo seguimiento' },
] as const satisfies readonly Opcion[]
export type ModoConteo = (typeof MODOS_CONTEO)[number]['valor']
export const VALORES_MODO_CONTEO = valoresDe<ModoConteo>(MODOS_CONTEO)

/** Alcance de un día del calendario (calendario.alcance). 'nacional' solo lo pone el sistema (festivos). */
export const ALCANCES_CALENDARIO = [
  { valor: 'nacional', etiqueta: 'Festivo nacional' },
  { valor: 'empresa', etiqueta: 'Día de empresa' },
  { valor: 'ciudad', etiqueta: 'Día de ciudad' },
] as const satisfies readonly Opcion[]
export type AlcanceCalendario = (typeof ALCANCES_CALENDARIO)[number]['valor']
export const VALORES_ALCANCE_CALENDARIO = valoresDe<AlcanceCalendario>(ALCANCES_CALENDARIO)

/** Tipo de un día del calendario (calendario.tipo). */
export const TIPOS_DIA_CALENDARIO = [
  { valor: 'no_habil', etiqueta: 'No hábil' },
  { valor: 'habil', etiqueta: 'Hábil' },
] as const satisfies readonly Opcion[]
export type TipoDiaCalendario = (typeof TIPOS_DIA_CALENDARIO)[number]['valor']
export const VALORES_TIPO_DIA_CALENDARIO = valoresDe<TipoDiaCalendario>(TIPOS_DIA_CALENDARIO)

export type OrigenCalendario = 'calculado' | 'manual'

/** Estado de un día libre (dias_libres.estado). */
export const ESTADOS_DIA_LIBRE = [
  { valor: 'registrado', etiqueta: 'Registrado' },
  { valor: 'por_aprobar', etiqueta: 'Por aprobar' },
  { valor: 'aprobado', etiqueta: 'Aprobado' },
  { valor: 'rechazado', etiqueta: 'Rechazado' },
  { valor: 'anulado', etiqueta: 'Anulado' },
] as const satisfies readonly Opcion[]
export type EstadoDiaLibre = (typeof ESTADOS_DIA_LIBRE)[number]['valor']
export const VALORES_ESTADO_DIA_LIBRE = valoresDe<EstadoDiaLibre>(ESTADOS_DIA_LIBRE)

/** Estados que ocupan la fecha (índice único parcial de dias_libres): no se puede registrar otro ese día. */
export const ESTADOS_DIA_LIBRE_VIGENTES: readonly EstadoDiaLibre[] = ['registrado', 'por_aprobar', 'aprobado']
/** Estados que cuentan como libres para la cuota. */
export const ESTADOS_DIA_LIBRE_LIBRES: readonly EstadoDiaLibre[] = ['registrado', 'aprobado']

/** Día completo o medio día (dias_libres.fraccion). */
export const FRACCIONES_DIA_LIBRE = [
  { valor: 1, etiqueta: 'Día completo' },
  { valor: 0.5, etiqueta: 'Medio día' },
] as const
export type FraccionDiaLibre = (typeof FRACCIONES_DIA_LIBRE)[number]['valor']

/** Acciones de la revisión en bloque (POST /api/dias-libres/revisar). */
export const ACCIONES_REVISION = [
  { valor: 'aprobar', etiqueta: 'Aprobar' },
  { valor: 'rechazar', etiqueta: 'Rechazar' },
  { valor: 'anular', etiqueta: 'Anular' },
] as const satisfies readonly Opcion[]
export type AccionRevision = (typeof ACCIONES_REVISION)[number]['valor']
export const VALORES_ACCION_REVISION = valoresDe<AccionRevision>(ACCIONES_REVISION)

/** Medios de una visita telefónica (config_general.telefonicas.medios). */
export const MEDIOS_TELEFONICA = [
  { valor: 'llamada', etiqueta: 'Llamada' },
  { valor: 'videollamada', etiqueta: 'Videollamada' },
] as const satisfies readonly Opcion[]
export type MedioTelefonica = (typeof MEDIOS_TELEFONICA)[number]['valor']
export const VALORES_MEDIO_TELEFONICA = valoresDe<MedioTelefonica>(MEDIOS_TELEFONICA)

/** Roles que pueden aprobar días libres (config_general.aprobacion_dias_libres.aprueban). admin siempre puede. */
export const ROLES_APROBADORES = [
  { valor: 'commercial_director', etiqueta: 'Dirección comercial' },
  { valor: 'hr', etiqueta: 'Recursos humanos' },
] as const satisfies readonly Opcion[]
export type RolAprobador = (typeof ROLES_APROBADORES)[number]['valor']
export const VALORES_ROL_APROBADOR = valoresDe<RolAprobador>(ROLES_APROBADORES)

/** Las 4 tablas de configuración con vigencias (las únicas que acepta config_registrar). */
export const TABLAS_CONFIG = [
  { valor: 'config_metas', etiqueta: 'Metas' },
  { valor: 'config_conteo', etiqueta: 'Qué cuenta' },
  { valor: 'config_general', etiqueta: 'General' },
  { valor: 'config_personas', etiqueta: 'Personas' },
] as const satisfies readonly Opcion[]
export type TablaConfig = (typeof TABLAS_CONFIG)[number]['valor']
export const VALORES_TABLA_CONFIG = valoresDe<TablaConfig>(TABLAS_CONFIG)

/** Parámetros de config_general (los mismos del CHECK de la migración 0810), con su etiqueta. */
export const PARAMETROS_GENERALES = [
  { valor: 'radio_presencial_m', etiqueta: 'Radio de presencial (metros)' },
  { valor: 'plazo_gracia_horas', etiqueta: 'Plazo de gracia de días libres (horas)' },
  { valor: 'dias_habiles_semana', etiqueta: 'Días hábiles de la semana' },
  { valor: 'tope_visitas_medico_dia', etiqueta: 'Visitas que suman por médico al día' },
  { valor: 'telefonicas', etiqueta: 'Visitas telefónicas' },
  { valor: 'aprobacion_dias_libres', etiqueta: 'Aprobación de días libres' },
  { valor: 'motivos_dia_libre', etiqueta: 'Motivos de día libre' },
  { valor: 'primer_mes_factor', etiqueta: 'Factor del primer mes' },
  { valor: 'alertas_mezcla', etiqueta: 'Alertas de mezcla' },
] as const satisfies readonly Opcion[]
export type ParametroGeneral = (typeof PARAMETROS_GENERALES)[number]['valor']
export const VALORES_PARAMETRO_GENERAL = valoresDe<ParametroGeneral>(PARAMETROS_GENERALES)

export const etiquetaTipoVisita = (valor: string | null | undefined) => etiquetaDe(TIPOS_VISITA, valor)
export const etiquetaScopeMeta = (valor: string | null | undefined) => etiquetaDe(SCOPES_META, valor)
export const etiquetaPeriodoMeta = (valor: string | null | undefined) => etiquetaDe(PERIODOS_META, valor)
export const etiquetaModoConteo = (valor: string | null | undefined) => etiquetaDe(MODOS_CONTEO, valor)
export const etiquetaAlcanceCalendario = (valor: string | null | undefined) => etiquetaDe(ALCANCES_CALENDARIO, valor)
export const etiquetaTipoDiaCalendario = (valor: string | null | undefined) => etiquetaDe(TIPOS_DIA_CALENDARIO, valor)
export const etiquetaEstadoDiaLibre = (valor: string | null | undefined) => etiquetaDe(ESTADOS_DIA_LIBRE, valor)
export const etiquetaMedioTelefonica = (valor: string | null | undefined) => etiquetaDe(MEDIOS_TELEFONICA, valor)
export const etiquetaRolAprobador = (valor: string | null | undefined) => etiquetaDe(ROLES_APROBADORES, valor)
export const etiquetaTablaConfig = (valor: string | null | undefined) => etiquetaDe(TABLAS_CONFIG, valor)
export const etiquetaParametroGeneral = (valor: string | null | undefined) => etiquetaDe(PARAMETROS_GENERALES, valor)

/** "Día completo" o "Medio día". */
export function etiquetaFraccionDiaLibre(fraccion: number | null | undefined): string {
  if (fraccion === null || fraccion === undefined) return ''
  return Number(fraccion) === 0.5 ? 'Medio día' : 'Día completo'
}

/** Fecha desde la que rigen los valores semilla (decisión del dueño). */
export const CONFIG_VIGENTE_DESDE = '2026-10-12'
/** Motivo de las filas semilla de la migración 0810. */
export const MOTIVO_SEMILLA = 'Valor inicial (decisión del dueño 2026-10-12)'
/** anulado_motivo de la fila que config_registrar reemplaza porque empezaba el mismo día. */
export const MOTIVO_REEMPLAZO_MISMO_DIA = 'Reemplazado por un valor nuevo con la misma fecha de inicio'
/** motivo de la continuación que config_registrar crea después de un valor temporal. */
export const MOTIVO_CONTINUACION = 'Continúa después de un valor temporal'
/**
 * motivo de la copia que config_cerrar crea cuando, al cancelar o acortar un valor, vuelve a regir el valor que
 * ese había cortado o reemplazado (decisión 12 del contrato).
 */
export const MOTIVO_VUELVE_ANTERIOR = 'Vuelve a regir el valor anterior'
/** motivo_revision cuando la ejecutiva anula su propio día libre. */
export const MOTIVO_ANULADO_POR_EJECUTIVA = 'Anulado por la ejecutiva'

/** Largo mínimo de un motivo o una justificación (el mismo de la base). */
export const MOTIVO_MINIMO = 5

// Los mensajes de config_registrar y config_cerrar son los mismos de la migración 0810 (salvo las fechas que la
// base añade entre paréntesis), para que la vista previa diga lo mismo que dirá la base al guardar.
export const MENSAJE_MOTIVO_PASADO = 'Para cambiar el pasado hace falta un motivo'
export const MENSAJE_MOTIVO_CIERRE_PASADO = 'Para cerrar o anular un valor en el pasado hace falta un motivo'
export const MENSAJE_HASTA_ANTES_DE_DESDE = 'La fecha "hasta" no puede ser anterior a "Rige desde"'
export const MENSAJE_VALOR_NO_EXISTE = 'No existe ese valor de configuración'
export const MENSAJE_VALOR_ANULADO = 'Ese valor de configuración ya está anulado'
export const MENSAJE_SIN_EJECUTIVA = 'Tu usuario no está enlazado con un Ejecutivo Comercial'
export const MENSAJE_DIA_NO_HABIL = 'Ese día no es hábil en tu calendario'
/** 403 de POST /api/dias-libres cuando quien aprueba intenta registrarse a sí misma "por otra persona". */
export const MENSAJE_PROPIO_POR_OTRA =
  'Tus propios días libres no se registran como "otra persona": regístralos en «Mis días libres» y que los apruebe otra persona'
/** Razón en `omitidos` de /api/dias-libres/revisar para un día de la ejecutiva enlazada con quien revisa. */
export const RAZON_DIA_PROPIO = 'Es tu propio día libre: lo revisa otra persona que apruebe'

/** Mensaje del 23P01 de config_registrar (el rango choca con un valor que empieza después). */
export function mensajeSuperposicion(fecha: string): string {
  return `El rango se superpone con un valor que empieza el ${fecha}`
}

// ---------------------------------------------------------------------------------------------
// 2. Fechas (texto ISO AAAA-MM-DD)
// ---------------------------------------------------------------------------------------------

const DIA_MS = 24 * 60 * 60 * 1000
const HORA_MS = 60 * 60 * 1000
/** Colombia: UTC−5 todo el año. */
const DESFASE_BOGOTA_MS = 5 * HORA_MS
const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MES_RE = /^(\d{4})-(\d{2})$/
/** Fin abierto de una vigencia, para comparar texto (vigente_hasta NULL). */
const SIN_FIN = '9999-12-31'

/** ¿Es una fecha AAAA-MM-DD que existe en el calendario? */
export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false
  const partes = FECHA_RE.exec(valor)
  if (!partes) return false
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/** ¿Es un mes AAAA-MM (01 a 12)? */
export function esMesIso(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false
  const partes = MES_RE.exec(valor)
  if (!partes) return false
  const mes = Number(partes[2])
  return mes >= 1 && mes <= 12
}

/** Milisegundos UTC del inicio del día (lanza si la fecha no es válida: la API valida antes). */
function aUtc(fecha: string): number {
  if (!esFechaIso(fecha)) throw new Error(`Fecha no válida: ${String(fecha)} (se espera AAAA-MM-DD)`)
  return Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)))
}

function desdeUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

function iso(anio: number, mes: number, dia: number): string {
  return desdeUtc(Date.UTC(anio, mes - 1, dia))
}

/** La fecha n días después (n negativo: antes). */
export function sumarDias(fecha: string, n: number): string {
  return desdeUtc(aUtc(fecha) + n * DIA_MS)
}

/** Día de la semana ISO: 1 lunes … 7 domingo. */
export function diaSemanaIso(fecha: string): number {
  const dia = new Date(aUtc(fecha)).getUTCDay()
  return dia === 0 ? 7 : dia
}

/** Todas las fechas de desde a hasta, ambas incluidas ([] si hasta < desde). */
export function rangoFechas(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  const fin = aUtc(hasta)
  for (let ms = aUtc(desde); ms <= fin; ms += DIA_MS) fechas.push(desdeUtc(ms))
  return fechas
}

/** Días entre dos fechas (hasta − desde); negativo si hasta es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS)
}

/** Fecha de hoy (AAAA-MM-DD) en Bogotá para un instante dado. */
export function hoyBogota(ahora: Date = new Date()): string {
  return desdeUtc(ahora.getTime() - DESFASE_BOGOTA_MS)
}

/** Fecha y hora (AAAA-MM-DD y HH:MM) de un instante en Bogotá. */
export function fechaHoraBogota(instante: Date): { fecha: string; hora: string } {
  const local = new Date(instante.getTime() - DESFASE_BOGOTA_MS)
  return {
    fecha: local.toISOString().slice(0, 10),
    hora: `${dosDigitos(local.getUTCHours())}:${dosDigitos(local.getUTCMinutes())}`,
  }
}

/** Mes AAAA-MM de una fecha. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

/** Primer y último día de un mes AAAA-MM. */
export function limitesMes(mes: string): { desde: string; hasta: string } {
  if (!esMesIso(mes)) throw new Error(`Mes no válido: ${String(mes)} (se espera AAAA-MM)`)
  const anio = Number(mes.slice(0, 4))
  const numero = Number(mes.slice(5, 7))
  return { desde: `${mes}-01`, hasta: desdeUtc(Date.UTC(anio, numero, 0)) }
}

/** Meses AAAA-MM de desdeMes a hastaMes, ambos incluidos ([] si hastaMes es anterior). */
export function mesesEntre(desdeMes: string, hastaMes: string): string[] {
  const meses: string[] = []
  let anio = Number(desdeMes.slice(0, 4))
  let mes = Number(desdeMes.slice(5, 7))
  const finAnio = Number(hastaMes.slice(0, 4))
  const finMes = Number(hastaMes.slice(5, 7))
  while (anio < finAnio || (anio === finAnio && mes <= finMes)) {
    meses.push(`${anio}-${dosDigitos(mes)}`)
    mes++
    if (mes > 12) {
      mes = 1
      anio++
    }
  }
  return meses
}

const menorFecha = (a: string, b: string) => (a <= b ? a : b)
const mayorFecha = (a: string, b: string) => (a >= b ? a : b)

/** Redondeo a 2 decimales (cuotas, días). */
export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

// ---------------------------------------------------------------------------------------------
// 3. Festivos de Colombia (Ley 51 de 1983)
// ---------------------------------------------------------------------------------------------

export interface Festivo {
  fecha: string
  nombre: string
}

/** Domingo de Pascua (algoritmo gregoriano anónimo, de Meeus/Jones/Butcher). */
export function pascua(anio: number): string {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return iso(anio, mes, dia)
}

/** Si la fecha no es lunes, el lunes siguiente (Ley Emiliani). */
export function alLunesSiguiente(fecha: string): string {
  const dia = diaSemanaIso(fecha)
  return dia === 1 ? fecha : sumarDias(fecha, 8 - dia)
}

const FESTIVOS_FIJOS: readonly [number, number, string][] = [
  [1, 1, 'Año Nuevo'],
  [5, 1, 'Día del Trabajo'],
  [7, 20, 'Día de la Independencia'],
  [8, 7, 'Batalla de Boyacá'],
  [12, 8, 'Inmaculada Concepción'],
  [12, 25, 'Navidad'],
]

const FESTIVOS_TRASLADABLES: readonly [number, number, string][] = [
  [1, 6, 'Día de los Reyes Magos'],
  [3, 19, 'Día de San José'],
  [6, 29, 'San Pedro y San Pablo'],
  [8, 15, 'Asunción de la Virgen'],
  [10, 12, 'Día de la Raza'],
  [11, 1, 'Todos los Santos'],
  [11, 11, 'Independencia de Cartagena'],
]

/** Días desde Pascua; los de traslado = true pasan al lunes (los de +43, +64 y +71 ya caen en lunes). */
const FESTIVOS_PASCUA: readonly [number, boolean, string][] = [
  [-3, false, 'Jueves Santo'],
  [-2, false, 'Viernes Santo'],
  [43, true, 'Ascensión del Señor'],
  [64, true, 'Corpus Christi'],
  [71, true, 'Sagrado Corazón de Jesús'],
]

/**
 * Los 18 festivos nacionales de un año, ordenados por fecha (y por nombre si dos caen el mismo día). Mismos
 * nombres que calendario_festivos_colombia(). Nota: algunos años dos festivos caen el mismo lunes (por ejemplo
 * en 2038, Sagrado Corazón de Jesús y San Pedro y San Pablo, el 5 de julio); la lista trae los dos, igual que
 * la función SQL, y calendario_cargar_festivos debe insertar esa fecha una sola vez (índice único).
 */
export function festivosColombia(anio: number): Festivo[] {
  const festivos: Festivo[] = []
  for (const [mes, dia, nombre] of FESTIVOS_FIJOS) festivos.push({ fecha: iso(anio, mes, dia), nombre })
  for (const [mes, dia, nombre] of FESTIVOS_TRASLADABLES) {
    festivos.push({ fecha: alLunesSiguiente(iso(anio, mes, dia)), nombre })
  }
  const domingo = pascua(anio)
  for (const [dias, traslado, nombre] of FESTIVOS_PASCUA) {
    const fecha = sumarDias(domingo, dias)
    festivos.push({ fecha: traslado ? alLunesSiguiente(fecha) : fecha, nombre })
  }
  return festivos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.nombre.localeCompare(b.nombre, 'es')))
}

// ---------------------------------------------------------------------------------------------
// 4. Vigencias
// ---------------------------------------------------------------------------------------------

/** Lo mínimo de una fila con vigencia (vigente_hasta inclusive; NULL = abierta). */
export interface Vigencia {
  id?: string
  vigente_desde: string
  vigente_hasta: string | null
  anulado_at?: string | null
  /**
   * La fila que este valor cortó o reemplazó (la que regía en su vigente_desde) cuando se registró, y el
   * vigente_hasta que esa tenía antes (NULL = abierta). Las guarda config_registrar; config_cerrar las usa para
   * que, al cancelar o acortar este valor, vuelva a regir el anterior (decisión 12 del contrato).
   */
  anterior_id?: string | null
  anterior_hasta?: string | null
}

const activa = (fila: Vigencia) => !fila.anulado_at

/** ¿Rige la fila en esa fecha? (sin mirar si está anulada) */
export function rigeEn(fila: Vigencia, fecha: string): boolean {
  return fila.vigente_desde <= fecha && (fila.vigente_hasta === null || fecha <= fila.vigente_hasta)
}

/**
 * La fila que rige en una fecha: ignora las anuladas; si hubiera varias (no debería: la base lo impide), la
 * de inicio más reciente. null si ninguna rige.
 */
export function valorVigente<T extends Vigencia>(filas: readonly T[], fecha: string): T | null {
  let elegida: T | null = null
  for (const fila of filas) {
    if (!activa(fila) || !rigeEn(fila, fecha)) continue
    if (!elegida || fila.vigente_desde > elegida.vigente_desde) elegida = fila
  }
  return elegida
}

/**
 * ¿Se superponen dos rangos (inclusive, NULL = abierto)? Una fila anulada no choca con nada (la restricción de
 * exclusión de la base solo mira las activas).
 */
export function seSuperponen(a: Vigencia, b: Vigencia): boolean {
  if (!activa(a) || !activa(b)) return false
  return a.vigente_desde <= (b.vigente_hasta ?? SIN_FIN) && b.vigente_desde <= (a.vigente_hasta ?? SIN_FIN)
}

/** Lo que haría config_registrar con un valor nuevo (vista previa; nada se escribe). */
export interface PlanCambio {
  /** Filas activas que empiezan el mismo día que el valor nuevo: se anulan (MOTIVO_REEMPLAZO_MISMO_DIA). */
  anular: string[]
  /** Fila que empezaba antes y seguía vigente: se corta al día anterior al valor nuevo. */
  cortar: { id: string; vigente_hasta: string }[]
  /** Continuación del valor anterior después de un valor temporal (MOTIVO_CONTINUACION). */
  continuar: { deId: string; vigente_desde: string; vigente_hasta: string | null }[]
  /** Hasta cuándo rige el valor nuevo (NULL = abierto). */
  hastaEfectivo: string | null
  /** Error con el que la base rechazaría el cambio (con error, las listas van vacías: no pasaría nada). */
  error: string | null
  /** El cambio empieza antes de hoy (corrige el pasado): exige motivo de 5 caracteres o más. */
  requiereMotivo: boolean
}

/**
 * Espejo exacto de los pasos 3 a 6 de config_registrar sobre las filas de UNA clave (activas y anuladas; las
 * anuladas se ignoran):
 *   3. desde < hoy exige motivo (requiereMotivo). El motivo solo se revisa si viene la clave `motivo` (string o
 *      null): la vista previa puede omitirlo para mostrar el plan antes de que lo escriban.
 *   4. hasta < desde → error.
 *   5. La activa que empieza el mismo día se anula; la que empieza antes y sigue vigente en `desde` se corta a
 *      desde − 1. Si cualquiera de las dos seguía después de `hasta`, su continuación va de hasta + 1 a su fin.
 *   6. hastaEfectivo = hasta o, sin hasta, el día anterior al inicio de la siguiente activa (o NULL). Si `hasta`
 *      alcanza a una activa que empieza después de `desde` → error de superposición con su fecha.
 */
export function planearCambio(
  filasDeLaClave: readonly Vigencia[],
  cambio: { desde: string; hasta?: string | null; motivo?: string | null },
  hoy: string
): PlanCambio {
  const { desde } = cambio
  const hasta = cambio.hasta ?? null
  const requiereMotivo = desde < hoy
  const rechazo = (error: string): PlanCambio => ({
    anular: [],
    cortar: [],
    continuar: [],
    hastaEfectivo: null,
    error,
    requiereMotivo,
  })

  // Paso 3
  if (requiereMotivo && cambio.motivo !== undefined && (cambio.motivo ?? '').trim().length < MOTIVO_MINIMO) {
    return rechazo(MENSAJE_MOTIVO_PASADO)
  }
  // Paso 4
  if (hasta !== null && hasta < desde) return rechazo(MENSAJE_HASTA_ANTES_DE_DESDE)

  const activas = filasDeLaClave.filter(activa)

  // Paso 6 (se mira antes de armar el plan: si falla, la base no deja nada hecho)
  const posteriores = activas
    .filter(fila => fila.vigente_desde > desde)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? -1 : a.vigente_desde > b.vigente_desde ? 1 : 0))
  let hastaEfectivo: string | null
  if (hasta !== null) {
    const choque = posteriores.find(fila => fila.vigente_desde <= hasta)
    if (choque) return rechazo(mensajeSuperposicion(choque.vigente_desde))
    hastaEfectivo = hasta
  } else {
    hastaEfectivo = posteriores.length > 0 ? sumarDias(posteriores[0].vigente_desde, -1) : null
  }

  // Paso 5
  const plan: PlanCambio = { anular: [], cortar: [], continuar: [], hastaEfectivo, error: null, requiereMotivo }
  for (const fila of activas) {
    const mismoDia = fila.vigente_desde === desde
    const vigenteAntes = fila.vigente_desde < desde && (fila.vigente_hasta === null || fila.vigente_hasta >= desde)
    if (!mismoDia && !vigenteAntes) continue
    if (mismoDia) plan.anular.push(fila.id ?? '')
    else plan.cortar.push({ id: fila.id ?? '', vigente_hasta: sumarDias(desde, -1) })
    if (hasta !== null && (fila.vigente_hasta === null || fila.vigente_hasta > hasta)) {
      plan.continuar.push({ deId: fila.id ?? '', vigente_desde: sumarDias(hasta, 1), vigente_hasta: fila.vigente_hasta })
    }
  }
  return plan
}

/**
 * El valor anterior que vuelve a regir en el hueco que deja cancelar o acortar un valor: config_cerrar alarga
 * esa fila ('extender', si termina justo el día antes del hueco) o crea una copia de sus valores ('copiar', con
 * MOTIVO_VUELVE_ANTERIOR) para [desde, hasta].
 */
export interface RestauraCierre {
  /** La fila cuyos valores vuelven a regir. */
  deId: string
  accion: 'extender' | 'copiar'
  /** Primer día en que vuelve a regir. */
  desde: string
  /** Último día (NULL = abierto). */
  hasta: string | null
}

/** Lo que haría config_cerrar con una fila (vista previa). */
export interface PlanCierre {
  /** 'cerrar' pone vigente_hasta; 'anular' si hasta es anterior a su inicio; 'nada' si ya terminaba antes. */
  accion: 'cerrar' | 'anular' | 'nada'
  vigente_hasta: string | null
  requiereMotivo: boolean
  error: string | null
  /**
   * El valor que había antes y vuelve a regir en el hueco, o null si no hay (entonces rige el valor por defecto
   * de esa configuración: el general, la meta de la zona o de toda la empresa, ninguna meta...). Solo se calcula
   * si quien llama pasa las filas de la clave.
   */
  restaura: RestauraCierre | null
}

/** El menor de dos fines de rango (NULL = abierto, mayor que cualquier fecha). */
function finMenor(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return menorFecha(a, b)
}

/**
 * Espejo de config_cerrar: fila inexistente o anulada → error (P0002); motivo (5+) si hasta < hoy (como en
 * planearCambio, solo se revisa si viene la clave `motivo`); hasta < vigente_desde → la anula; si no, la cierra
 * en hasta (solo si estaba abierta o terminaba después).
 *
 * Después, si quedó un hueco [h, fin original de la fila] y la fila había cortado o reemplazado otra al
 * registrarse (anterior_id), vuelve a regir ese valor anterior hasta min(fin original de la fila, anterior_hasta)
 * (decisión 12 del contrato: cancelar o acortar un valor no deja un hueco donde antes regía otro):
 *   - si el anterior empezaba el mismo día que la fila (la fila lo reemplazó y quedó anulado), se copian sus
 *     valores;
 *   - si no, vuelve la fila activa de la clave que hoy termina justo el día antes de la fila (el anterior
 *     cortado, o el que lo reemplazó o alargó después): se alarga si el hueco empieza ahí ('extender'; al anular)
 *     o se copian sus valores ('copiar'; al acortar).
 * Sin anterior_id (la fila se registró sobre un hueco, es una continuación o una semilla) no vuelve nada.
 * `filasDeLaClave`: todas las filas de la misma clave (activas y anuladas); sin ellas `restaura` es null.
 */
export function planearCierre(
  fila: Vigencia | null | undefined,
  cierre: { hasta: string; motivo?: string | null },
  hoy: string,
  filasDeLaClave: readonly Vigencia[] = []
): PlanCierre {
  const requiereMotivo = cierre.hasta < hoy
  const nada = (vigente_hasta: string | null, error: string | null): PlanCierre => ({
    accion: 'nada',
    vigente_hasta,
    requiereMotivo,
    error,
    restaura: null,
  })
  if (!fila) return nada(null, MENSAJE_VALOR_NO_EXISTE)
  if (!activa(fila)) return nada(fila.vigente_hasta, MENSAJE_VALOR_ANULADO)
  if (requiereMotivo && cierre.motivo !== undefined && (cierre.motivo ?? '').trim().length < MOTIVO_MINIMO) {
    return nada(fila.vigente_hasta, MENSAJE_MOTIVO_CIERRE_PASADO)
  }
  let plan: PlanCierre
  let hueco: string
  if (cierre.hasta < fila.vigente_desde) {
    plan = { accion: 'anular', vigente_hasta: fila.vigente_hasta, requiereMotivo, error: null, restaura: null }
    hueco = fila.vigente_desde
  } else if (fila.vigente_hasta === null || fila.vigente_hasta > cierre.hasta) {
    plan = { accion: 'cerrar', vigente_hasta: cierre.hasta, requiereMotivo, error: null, restaura: null }
    hueco = sumarDias(cierre.hasta, 1)
  } else {
    return nada(fila.vigente_hasta, null)
  }
  plan.restaura = valorQueVuelve(fila, hueco, filasDeLaClave)
  return plan
}

/** El valor anterior que vuelve a regir desde `hueco` al cancelar o acortar `fila` (ver planearCierre). */
function valorQueVuelve(fila: Vigencia, hueco: string, filasDeLaClave: readonly Vigencia[]): RestauraCierre | null {
  const anteriorId = fila.anterior_id ?? null
  if (!anteriorId) return null
  const fin = finMenor(fila.vigente_hasta, fila.anterior_hasta ?? null)
  if (fin !== null && fin < hueco) return null
  const anterior = filasDeLaClave.find(f => f.id === anteriorId)
  if (!anterior) return null
  let fuente: Vigencia | undefined
  if (anterior.vigente_desde === fila.vigente_desde) {
    fuente = anterior // la reemplazó el mismo día (quedó anulada): vuelven sus valores
  } else {
    const diaAntes = sumarDias(fila.vigente_desde, -1)
    fuente = filasDeLaClave.find(f => activa(f) && f.id !== fila.id && f.vigente_hasta === diaAntes)
  }
  if (!fuente?.id) return null
  const extender = activa(fuente) && fuente.vigente_hasta === sumarDias(hueco, -1)
  return { deId: fuente.id, accion: extender ? 'extender' : 'copiar', desde: hueco, hasta: fin }
}

/**
 * Meses (AAAA-MM) que se recalculan con un cambio: si empieza antes de hoy, desde el mes de `desde` hasta el de
 * min(hastaEfectivo, hoy); si empieza hoy o después, ninguno.
 */
export function mesesAfectados(desde: string, hastaEfectivo: string | null, hoy: string): string[] {
  if (!(desde < hoy)) return []
  const fin = hastaEfectivo !== null ? menorFecha(hastaEfectivo, hoy) : hoy
  if (fin < desde) return []
  return mesesEntre(mesDe(desde), mesDe(fin))
}

/**
 * La `clave` de una fila de configuración, con la misma expresión que la columna generada de la migración 0810
 * (uuid en minúsculas, como uuid::text en PostgreSQL). Sirve para traer las filas de la misma clave.
 */
export function claveConfig(tabla: TablaConfig, valores: Record<string, unknown>): string {
  const texto = (valor: unknown) => (valor === null || valor === undefined || valor === '' ? null : String(valor).toLowerCase())
  switch (tabla) {
    case 'config_metas':
      return [
        String(valores.scope ?? ''),
        texto(valores.kam_id) ?? texto(valores.executive_id) ?? '-',
        String(valores.tipo ?? ''),
        texto(valores.subtipo_id) ?? '-',
      ].join(':')
    case 'config_conteo':
      return texto(valores.subtipo_id) ?? ''
    case 'config_general':
      return String(valores.parametro ?? '')
    case 'config_personas':
      return texto(valores.executive_id) ?? ''
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Configuración general, por persona y metas
// ---------------------------------------------------------------------------------------------

/** Clave "1" (lunes) a "7" (domingo) de dias_habiles_semana. */
export type DiaSemanaClave = '1' | '2' | '3' | '4' | '5' | '6' | '7'
/** Fracción hábil de cada día de la semana (0, 0.5 o 1). */
export type DiasHabilesSemana = Record<DiaSemanaClave, number>

export interface ConfigTelefonicas {
  tope_dia: number
  peso: number
  medios: MedioTelefonica[]
}

export interface ConfigAprobacionDiasLibres {
  requiere: boolean
  aprueban: RolAprobador[]
}

export interface MotivoDiaLibre {
  codigo: string
  nombre: string
}

/** Forma de cada parámetro de config_general. */
export interface ValoresGenerales {
  radio_presencial_m: number
  plazo_gracia_horas: number
  dias_habiles_semana: DiasHabilesSemana
  tope_visitas_medico_dia: number
  telefonicas: ConfigTelefonicas
  aprobacion_dias_libres: ConfigAprobacionDiasLibres
  motivos_dia_libre: MotivoDiaLibre[]
  primer_mes_factor: number
  alertas_mezcla: Record<string, number>
}

/** Un parámetro con su valor (cuerpo de un cambio de config_general). */
export type ValorGeneralCambio = { [P in ParametroGeneral]: { parametro: P; valor: ValoresGenerales[P] } }[ParametroGeneral]

/** La semilla de la migración 0810 (vigente desde 2026-10-12): respaldo si no hay fila vigente. No mutar. */
export const GENERAL_POR_DEFECTO: Readonly<ValoresGenerales> = {
  radio_presencial_m: 500,
  plazo_gracia_horas: 24,
  dias_habiles_semana: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 0, '7': 0 },
  tope_visitas_medico_dia: 1,
  telefonicas: { tope_dia: 1, peso: 1, medios: ['llamada', 'videollamada'] },
  aprobacion_dias_libres: { requiere: true, aprueban: ['commercial_director', 'hr'] },
  motivos_dia_libre: [
    { codigo: 'vacaciones', nombre: 'Vacaciones' },
    { codigo: 'incapacidad', nombre: 'Incapacidad' },
    { codigo: 'cita_medica', nombre: 'Cita médica' },
    { codigo: 'capacitacion', nombre: 'Capacitación' },
    { codigo: 'congreso', nombre: 'Congreso' },
    { codigo: 'acompanamiento_cirugia', nombre: 'Acompañamiento de cirugía' },
    { codigo: 'administrativo', nombre: 'Administrativo' },
    { codigo: 'otro', nombre: 'Otro' },
  ],
  primer_mes_factor: 0.5,
  alertas_mezcla: {},
}

/** Perfil de quien no tiene fila en config_personas: médica e institucional. */
export const PERFIL_POR_DEFECTO: readonly TipoVisita[] = ['medica', 'institucional']

/** Semilla de metas: general · médica · día · 6 y general · institucional · día · 1 (sin subtipo). */
export const METAS_SEMILLA: readonly { scope: ScopeMeta; tipo: TipoVisita; periodo: PeriodoMeta; cantidad: number }[] = [
  { scope: 'general', tipo: 'medica', periodo: 'dia', cantidad: 6 },
  { scope: 'general', tipo: 'institucional', periodo: 'dia', cantidad: 1 },
]

/** Semilla de conteo por código de subtipo (peso 1 en todos). */
export const CONTEO_SEMILLA: Readonly<Record<string, ModoConteo>> = {
  compras: 'suma_institucional',
  autorizaciones: 'suma_institucional',
  quimico_farmaceutico: 'seguimiento',
  programacion: 'seguimiento',
  otro: 'seguimiento',
}

export interface GeneralCampos {
  parametro: string
  valor: unknown
}
/** Fila de config_general para los cálculos (lo mínimo). */
export type GeneralVigencia = Vigencia & GeneralCampos

/** Valor de un parámetro general vigente en una fecha; sin fila vigente, el de la semilla. */
export function generalVigente<P extends ParametroGeneral>(
  filasGeneral: readonly GeneralVigencia[],
  parametro: P,
  fecha: string
): ValoresGenerales[P] {
  const fila = valorVigente(
    filasGeneral.filter(f => f.parametro === parametro),
    fecha
  )
  if (!fila || fila.valor === null || fila.valor === undefined) return GENERAL_POR_DEFECTO[parametro]
  return fila.valor as ValoresGenerales[P]
}

/** Todos los parámetros generales vigentes en una fecha. */
export function generalesVigentes(filasGeneral: readonly GeneralVigencia[], fecha: string): ValoresGenerales {
  return {
    radio_presencial_m: generalVigente(filasGeneral, 'radio_presencial_m', fecha),
    plazo_gracia_horas: generalVigente(filasGeneral, 'plazo_gracia_horas', fecha),
    dias_habiles_semana: generalVigente(filasGeneral, 'dias_habiles_semana', fecha),
    tope_visitas_medico_dia: generalVigente(filasGeneral, 'tope_visitas_medico_dia', fecha),
    telefonicas: generalVigente(filasGeneral, 'telefonicas', fecha),
    aprobacion_dias_libres: generalVigente(filasGeneral, 'aprobacion_dias_libres', fecha),
    motivos_dia_libre: generalVigente(filasGeneral, 'motivos_dia_libre', fecha),
    primer_mes_factor: generalVigente(filasGeneral, 'primer_mes_factor', fecha),
    alertas_mezcla: generalVigente(filasGeneral, 'alertas_mezcla', fecha),
  }
}

/** Nombre de un motivo de día libre por su código (el código tal cual si ya no está en la lista). */
export function nombreMotivoDiaLibre(motivos: readonly MotivoDiaLibre[], codigo: string | null | undefined): string {
  if (!codigo) return ''
  return motivos.find(motivo => motivo.codigo === codigo)?.nombre ?? codigo
}

export interface PersonaCampos {
  executive_id: string
  perfil: readonly string[]
  telefonica_habilitada: boolean
  tope_telefonicas_dia: number | null
  radio_m: number | null
}
/** Fila de config_personas para los cálculos (lo mínimo). */
export type PersonaVigencia = Vigencia & PersonaCampos

/** Configuración de una persona vigente en una fecha, con los respaldos de la decisión 9 del contrato. */
export interface PersonaResuelta {
  /** Fila de config_personas que rige, o null (sin configuración propia). */
  id: string | null
  perfil: TipoVisita[]
  telefonicaHabilitada: boolean
  topeTelefonicasDia: number
  radioM: number
}

/**
 * Sin fila vigente: perfil médica e institucional, telefónica no habilitada, tope de telefónicas y radio los
 * generales. Con fila: lo suyo, y el tope y el radio generales donde dejó NULL.
 */
export function configPersonaVigente(
  personas: readonly PersonaVigencia[],
  general: readonly GeneralVigencia[],
  executiveId: string,
  fecha: string
): PersonaResuelta {
  const fila = valorVigente(
    personas.filter(p => p.executive_id === executiveId),
    fecha
  )
  const perfil = fila
    ? VALORES_TIPO_VISITA.filter(tipo => fila.perfil.includes(tipo))
    : [...PERFIL_POR_DEFECTO]
  return {
    id: fila?.id ?? null,
    perfil,
    telefonicaHabilitada: fila?.telefonica_habilitada ?? false,
    topeTelefonicasDia: fila?.tope_telefonicas_dia ?? generalVigente(general, 'telefonicas', fecha).tope_dia,
    radioM: fila?.radio_m ?? generalVigente(general, 'radio_presencial_m', fecha),
  }
}

/** Perfil vigente de una persona en una fecha (por defecto, médica e institucional). */
export function perfilVigente(personas: readonly PersonaVigencia[], executiveId: string, fecha: string): TipoVisita[] {
  return configPersonaVigente(personas, [], executiveId, fecha).perfil
}

export interface MetaCampos {
  scope: ScopeMeta
  kam_id: string | null
  executive_id: string | null
  tipo: TipoVisita
  subtipo_id: string | null
  periodo: PeriodoMeta
  cantidad: number
}
/** Fila de config_metas para los cálculos (lo mínimo). */
export type MetaVigencia = Vigencia & MetaCampos

export type OrigenMeta = 'ejecutiva' | 'zona' | 'general' | null

export interface MetaResuelta {
  cantidad: number
  periodo: PeriodoMeta
  origen: OrigenMeta
  /** Fila de config_metas que rige, o null si no hay meta para ese tipo. */
  id: string | null
}

/**
 * Meta de una persona para un tipo (y subtipo, si tiene meta propia) en una fecha. Prioridad: la excepción de
 * la persona, luego la de su zona, luego la general. Sin ninguna: cantidad 0 y origen null.
 */
export function resolverMeta(entrada: {
  metas: readonly MetaVigencia[]
  fecha: string
  executiveId?: string | null
  kamId?: string | null
  tipo: TipoVisita
  subtipoId?: string | null
}): MetaResuelta {
  const subtipo = entrada.subtipoId ?? null
  const delTipo = entrada.metas.filter(meta => meta.tipo === entrada.tipo && (meta.subtipo_id ?? null) === subtipo)
  const candidatas: [Exclude<OrigenMeta, null>, MetaVigencia[]][] = [
    [
      'ejecutiva',
      entrada.executiveId ? delTipo.filter(m => m.scope === 'ejecutiva' && m.executive_id === entrada.executiveId) : [],
    ],
    ['zona', entrada.kamId ? delTipo.filter(m => m.scope === 'zona' && m.kam_id === entrada.kamId) : []],
    ['general', delTipo.filter(m => m.scope === 'general')],
  ]
  for (const [origen, filas] of candidatas) {
    const fila = valorVigente(filas, entrada.fecha)
    if (fila) return { cantidad: Number(fila.cantidad), periodo: fila.periodo, origen, id: fila.id ?? null }
  }
  return { cantidad: 0, periodo: 'dia', origen: null, id: null }
}

/** Suma de las fracciones hábiles de una semana estándar (lunes a viernes = 5). */
export function sumaSemana(diasHabilesSemana: DiasHabilesSemana): number {
  let suma = 0
  for (let dia = 1; dia <= 7; dia++) suma += Number(diasHabilesSemana[String(dia) as DiaSemanaClave] ?? 0)
  return suma
}

/**
 * Meta por día hábil completo: la diaria tal cual; la semanal repartida entre los días hábiles de la semana
 * estándar (10 a la semana con lunes a viernes = 2 por día). Semana sin días hábiles → 0.
 */
export function metaDiaria(meta: { cantidad: number; periodo: PeriodoMeta }, diasHabilesSemana: DiasHabilesSemana): number {
  const cantidad = Number(meta.cantidad)
  if (meta.periodo === 'dia') return cantidad
  const suma = sumaSemana(diasHabilesSemana)
  return suma > 0 ? cantidad / suma : 0
}

// ---------------------------------------------------------------------------------------------
// 6. Calendario
// ---------------------------------------------------------------------------------------------

/** Un día del calendario para los cálculos (lo mínimo). */
export interface DiaCalendarioEntrada {
  fecha: string
  alcance: AlcanceCalendario
  municipality_id: string | null
  tipo: TipoDiaCalendario
  nombre?: string
  anulado_at?: string | null
}

export type FuenteDiaHabil = 'ciudad' | 'empresa' | 'nacional' | 'semana'

/** Fracción hábil de un día y de dónde sale (para explicar el día en la interfaz). */
export interface DiaHabilResuelto {
  fraccion: number
  fuente: FuenteDiaHabil
  /** Nombre del día del calendario que decide (festivo, día de empresa o de ciudad); null si decide la semana. */
  nombre: string | null
}

/**
 * Precedencia: día de la ciudad de la persona > día de empresa > festivo nacional > día de la semana. Un día
 * 'habil' de ciudad o empresa vale 1 (aunque sea sábado); 'no_habil' vale 0. Ignora los anulados y los días de
 * otras ciudades. Sin municipio, ningún día de ciudad aplica.
 */
export function resolverDiaHabil(entrada: {
  fecha: string
  diasHabilesSemana: DiasHabilesSemana
  calendario: readonly DiaCalendarioEntrada[]
  municipio?: string | null
}): DiaHabilResuelto {
  const delDia = entrada.calendario.filter(dia => dia.fecha === entrada.fecha && !dia.anulado_at)
  const ciudad = entrada.municipio
    ? delDia.find(dia => dia.alcance === 'ciudad' && dia.municipality_id === entrada.municipio)
    : undefined
  const decide =
    ciudad ??
    delDia.find(dia => dia.alcance === 'empresa') ??
    delDia.find(dia => dia.alcance === 'nacional')
  if (decide) {
    return {
      fraccion: decide.tipo === 'habil' ? 1 : 0,
      fuente: decide.alcance === 'ciudad' ? 'ciudad' : decide.alcance === 'empresa' ? 'empresa' : 'nacional',
      nombre: decide.nombre ?? null,
    }
  }
  const clave = String(diaSemanaIso(entrada.fecha)) as DiaSemanaClave
  const fraccion = Number(entrada.diasHabilesSemana[clave] ?? 0)
  return { fraccion: Math.min(1, Math.max(0, Number.isFinite(fraccion) ? fraccion : 0)), fuente: 'semana', nombre: null }
}

/** Fracción hábil (0..1) de un día para una persona de ese municipio (ver resolverDiaHabil). */
export function fraccionHabil(entrada: {
  fecha: string
  diasHabilesSemana: DiasHabilesSemana
  calendario: readonly DiaCalendarioEntrada[]
  municipio?: string | null
}): number {
  return resolverDiaHabil(entrada).fraccion
}

/**
 * Municipio (código DANE de 5 dígitos) de la ciudad base de una zona: left(kams.area_id, 5). Las celdas de
 * Bogotá ('1100102' Chapinero...) son 11001. null si no hay un código legible.
 */
export function municipioDeZona(areaId: string | null | undefined): string | null {
  const texto = (areaId ?? '').trim()
  return /^\d{5}/.test(texto) ? texto.slice(0, 5) : null
}

// ---------------------------------------------------------------------------------------------
// 7. Días libres
// ---------------------------------------------------------------------------------------------

/** Un día libre para los cálculos (lo mínimo). */
export interface DiaLibreEntrada {
  executive_id?: string
  fecha: string
  fraccion: number
  estado: EstadoDiaLibre
}

function sumaFraccion(diasLibres: readonly DiaLibreEntrada[], fecha: string, estados: readonly EstadoDiaLibre[]): number {
  let suma = 0
  for (const dia of diasLibres) if (dia.fecha === fecha && estados.includes(dia.estado)) suma += Number(dia.fraccion)
  return Math.min(1, suma)
}

/** Fracción libre de un día (registrado o aprobado; máx. 1). Las filas deben ser de UNA persona. */
export function fraccionLibre(diasLibres: readonly DiaLibreEntrada[], fecha: string): number {
  return sumaFraccion(diasLibres, fecha, ESTADOS_DIA_LIBRE_LIBRES)
}

/** Fracción por aprobar de un día (no resta en la cuota; sale aparte). */
export function fraccionPorAprobar(diasLibres: readonly DiaLibreEntrada[], fecha: string): number {
  return sumaFraccion(diasLibres, fecha, ['por_aprobar'])
}

/**
 * Hasta cuándo se puede registrar un día libre: el inicio del día siguiente en Bogotá más el plazo de gracia.
 * Con 24 horas, el lunes se puede registrar hasta el martes a las 23:59 (decisión 1 del contrato).
 */
export function venceRegistroDiaLibre(fecha: string, plazoHoras: number): Date {
  return new Date(aUtc(sumarDias(fecha, 1)) + DESFASE_BOGOTA_MS + Math.max(0, plazoHoras) * HORA_MS)
}

/** Último minuto en que todavía se podía registrar, en hora de Colombia: "AAAA-MM-DD a las HH:MM". */
export function textoLimiteRegistro(venceAt: Date): string {
  const { fecha, hora } = fechaHoraBogota(new Date(venceAt.getTime() - 60 * 1000))
  return `${fecha} a las ${hora}`
}

export interface ResultadoRegistroDiaLibre {
  ok: boolean
  error: string | null
  /** Instante en que vence el plazo (null si la fecha no es válida). */
  venceAt: Date | null
}

/** Hasta cuántos días hacia adelante se registra un día libre (puedeRegistrarDiaLibre, la API y la interfaz). */
export const DIAS_ADELANTE_DIA_LIBRE = 366

/** Días hacia atrás que lista "Mis días libres". */
export const DIAS_ATRAS_MIS_DIAS_LIBRES = 90

/**
 * Rango de GET /api/me/dias-libres para "Mis días libres": desde DIAS_ATRAS_MIS_DIAS_LIBRES días atrás y SIN fin,
 * para que salga todo lo que se puede registrar hacia adelante (hasta DIAS_ADELANTE_DIA_LIBRE días) y se pueda
 * anular. (Con fin, la API limita la consulta a 400 días y no cabrían 90 atrás y 366 adelante.)
 */
export function consultaMisDiasLibres(hoy: string): { desde: string } {
  return { desde: sumarDias(hoy, -DIAS_ATRAS_MIS_DIAS_LIBRES) }
}

/**
 * ¿Puede la ejecutiva registrar ese día libre ahora? Antes del día o hasta el plazo de gracia después; no más
 * de diasAdelanteMax días hacia adelante. El plazo es el vigente el día en que se registra (lo elige quien llama).
 */
export function puedeRegistrarDiaLibre(entrada: {
  fecha: string
  ahora: Date
  plazoHoras: number
  diasAdelanteMax?: number
}): ResultadoRegistroDiaLibre {
  const { fecha, ahora, plazoHoras } = entrada
  const diasAdelanteMax = entrada.diasAdelanteMax ?? DIAS_ADELANTE_DIA_LIBRE
  if (!esFechaIso(fecha)) return { ok: false, error: 'Fecha no válida: usa AAAA-MM-DD', venceAt: null }
  const venceAt = venceRegistroDiaLibre(fecha, plazoHoras)
  if (ahora.getTime() >= venceAt.getTime()) {
    return {
      ok: false,
      error: `Ya pasó el plazo para registrar ese día: se podía hasta el ${textoLimiteRegistro(venceAt)} (hora de Colombia)`,
      venceAt,
    }
  }
  const maximo = sumarDias(hoyBogota(ahora), diasAdelanteMax)
  if (fecha > maximo) {
    return { ok: false, error: `Solo se pueden registrar días libres hasta el ${maximo}`, venceAt }
  }
  return { ok: true, error: null, venceAt }
}

/** Estado con el que nace un día libre que registra la propia ejecutiva. */
export function estadoInicialDiaLibre(requiereAprobacion: boolean): 'por_aprobar' | 'registrado' {
  return requiereAprobacion ? 'por_aprobar' : 'registrado'
}

/** Resultado de aplicar una acción de revisión a un día libre. */
export type TransicionDiaLibre = { ok: true; estado: EstadoDiaLibre } | { ok: false; razon: string }

/** Días libres como máximo por petición a POST /api/dias-libres/revisar (revisarDiasLibresSchema). */
export const MAX_IDS_REVISION = 200

/**
 * Parte una lista en lotes de `tamano` (la interfaz manda la revisión en bloque en lotes de MAX_IDS_REVISION, uno
 * tras otro, y suma actualizados y omitidos).
 */
export function enLotes<T>(lista: readonly T[], tamano: number = MAX_IDS_REVISION): T[][] {
  const paso = Math.max(1, Math.floor(tamano))
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += paso) lotes.push(lista.slice(i, i + paso))
  return lotes
}

/** Aprobar y rechazar solo desde 'por_aprobar'; anular desde registrado, por_aprobar o aprobado. */
export function revisarDiaLibre(estado: EstadoDiaLibre, accion: AccionRevision): TransicionDiaLibre {
  if (accion === 'anular') {
    return ESTADOS_DIA_LIBRE_VIGENTES.includes(estado)
      ? { ok: true, estado: 'anulado' }
      : { ok: false, razon: `No se puede anular un día ${etiquetaEstadoDiaLibre(estado).toLowerCase()}` }
  }
  if (estado !== 'por_aprobar') {
    return {
      ok: false,
      razon: `Solo se ${accion === 'aprobar' ? 'aprueban' : 'rechazan'} días por aprobar (este está ${etiquetaEstadoDiaLibre(estado).toLowerCase()})`,
    }
  }
  return { ok: true, estado: accion === 'aprobar' ? 'aprobado' : 'rechazado' }
}

/** La ejecutiva anula lo suyo: en 'por_aprobar' siempre; en 'registrado' o 'aprobado' solo si la fecha es hoy o después. */
export function ejecutivaPuedeAnular(dia: { estado: EstadoDiaLibre; fecha: string }, hoy: string): boolean {
  if (dia.estado === 'por_aprobar') return true
  return (dia.estado === 'registrado' || dia.estado === 'aprobado') && dia.fecha >= hoy
}

/** ¿Puede ese rol aprobar días libres con esta configuración? admin siempre; los demás si están en `aprueban`. */
export function rolPuedeAprobar(role: Role | string | null | undefined, aprobacion: ConfigAprobacionDiasLibres): boolean {
  if (!role) return false
  if (role === 'admin') return true
  return (aprobacion.aprueban as readonly string[]).includes(role)
}

/** Pestañas de /calendario. */
export type PestanaCalendario = 'mis' | 'dias-libres' | 'calendario'
/** Enlace del usuario con un Ejecutivo Comercial (null mientras no se sabe; 'desconocido' si la consulta falló). */
export type EnlaceEjecutiva = 'enlazado' | 'sin_ejecutiva' | 'desconocido' | null

/**
 * Pestañas de /calendario según permisos y enlace: "Mis días libres" con visits:report salvo que el usuario no
 * esté enlazado con un Ejecutivo Comercial (/api/me/* responde 403); "Días libres" con daysoff:approve o
 * daysoff:view; "Calendario" siempre. Si reporta pero no está enlazado, `avisoSinEjecutiva` pide mostrar por qué
 * no aparece "Mis días libres" y qué hacer (decisión 11 del contrato).
 */
export function pestanasCalendario(entrada: {
  reporta: boolean
  veDias: boolean
  enlace: EnlaceEjecutiva
}): { pestanas: PestanaCalendario[]; avisoSinEjecutiva: boolean } {
  const sinEjecutiva = entrada.enlace === 'sin_ejecutiva'
  const pestanas: PestanaCalendario[] = []
  if (entrada.reporta && !sinEjecutiva) pestanas.push('mis')
  if (entrada.veDias) pestanas.push('dias-libres')
  pestanas.push('calendario')
  return { pestanas, avisoSinEjecutiva: entrada.reporta && sinEjecutiva }
}

// ---------------------------------------------------------------------------------------------
// 8. Cuota del periodo
// ---------------------------------------------------------------------------------------------

export interface ConteoCampos {
  subtipo_id: string
  modo: ModoConteo
  peso: number
}
/** Fila de config_conteo para los cálculos (lo mínimo). */
export type ConteoVigencia = Vigencia & ConteoCampos

/** La persona para la cuota: su zona base (base_kam_id), el municipio de esa zona y sus fechas de entrada y salida. */
export interface PersonaCuota {
  executiveId: string
  kamId: string | null
  municipio: string | null
  startedAt: string | null
  leftAt: string | null
}

export interface DiaCuota {
  fecha: string
  /** La persona estaba activa ese día (startedAt <= d y, si salió, d <= leftAt). */
  activo: boolean
  /** Fracción hábil del día en su calendario (0 si no estaba activa). */
  habil: number
  /** De dónde sale la fracción hábil y el nombre del día del calendario que decide, si lo hay. */
  fuente: FuenteDiaHabil
  nombreDia: string | null
  /** Fracción libre (registrado o aprobado), como mucho la hábil. */
  libre: number
  /** Fracción por aprobar (no resta), como mucho lo que queda hábil. */
  porAprobar: number
  /** Meta por día hábil completo (0 si el perfil no incluye el tipo o no estaba activa). */
  metaDia: number
  /** primer_mes_factor en el mes calendario de startedAt; 1 en los demás. */
  factor: number
  /** metaDia × max(0, habil − libre) × factor. */
  aporte: number
}

export interface ResultadoCuota {
  /** Suma de los aportes, redondeada a 2 decimales. */
  cuota: number
  diasHabiles: number
  /** Días hábiles hasta hoy, incluido. */
  diasHabilesTranscurridos: number
  diasLibres: number
  diasPorAprobar: number
  /** Meta del día completo que rige hoy (con el perfil y el factor del primer mes; 0 si no aplica). */
  metaDiaHoy: number
  /** De dónde sale la meta de hoy (ejecutiva, zona, general) o null si no hay meta. */
  origenMeta: OrigenMeta
  /** El perfil de hoy incluye el tipo. */
  aplicaPerfil: boolean
  /**
   * El perfil incluye el tipo ALGÚN día del periodo (con el perfil que regía cada día). Es lo que decide si la
   * interfaz muestra la cuota de ese tipo: un mes pasado o futuro no se juzga con el perfil de hoy.
   */
  aplicaEnPeriodo: boolean
  porDia: DiaCuota[]
}

/**
 * Cuota de un tipo (o de un subtipo con meta propia) en un periodo = Σ metaDia × max(0, hábil − libre) × factor.
 * Cada día usa la configuración que regía ese día (metas, perfil, días hábiles de la semana, factor del primer
 * mes). `hoy` (por defecto `hasta`) marca los días transcurridos y la meta de hoy. Con `conteo` y un subtipo, la
 * meta del subtipo solo cuenta los días en que su modo vigente es 'meta_propia'.
 */
export function cuotaPeriodo(entrada: {
  desde: string
  hasta: string
  hoy?: string
  persona: PersonaCuota
  tipo: TipoVisita
  subtipoId?: string | null
  metas: readonly MetaVigencia[]
  personas: readonly PersonaVigencia[]
  general: readonly GeneralVigencia[]
  calendario: readonly DiaCalendarioEntrada[]
  diasLibres: readonly DiaLibreEntrada[]
  conteo?: readonly ConteoVigencia[]
}): ResultadoCuota {
  const { persona, tipo } = entrada
  const subtipoId = entrada.subtipoId ?? null
  const hoy = entrada.hoy ?? entrada.hasta
  const libresDeLaPersona = entrada.diasLibres.filter(
    dia => dia.executive_id === undefined || dia.executive_id === persona.executiveId
  )
  const mesDeEntrada = persona.startedAt ? mesDe(persona.startedAt) : null
  const conteoDelSubtipo = subtipoId && entrada.conteo ? entrada.conteo.filter(c => c.subtipo_id === subtipoId) : null

  const activoEn = (fecha: string) =>
    (persona.startedAt === null || persona.startedAt <= fecha) && (persona.leftAt === null || fecha <= persona.leftAt)

  /** Meta por día hábil completo, con perfil (y modo del subtipo) de ese día; sin factor. */
  const metaDelDia = (fecha: string, diasHabilesSemana: DiasHabilesSemana) => {
    const perfil = perfilVigente(entrada.personas, persona.executiveId, fecha)
    const aplica = perfil.includes(tipo)
    const meta = resolverMeta({
      metas: entrada.metas,
      fecha,
      executiveId: persona.executiveId,
      kamId: persona.kamId,
      tipo,
      subtipoId,
    })
    const modoOk = !conteoDelSubtipo || valorVigente(conteoDelSubtipo, fecha)?.modo === 'meta_propia'
    return { aplica, meta, valor: aplica && modoOk ? metaDiaria(meta, diasHabilesSemana) : 0 }
  }
  const factorDelDia = (fecha: string) =>
    mesDeEntrada !== null && mesDe(fecha) === mesDeEntrada ? Number(generalVigente(entrada.general, 'primer_mes_factor', fecha)) : 1

  const porDia: DiaCuota[] = []
  let cuota = 0
  let diasHabiles = 0
  let diasHabilesTranscurridos = 0
  let diasLibres = 0
  let diasPorAprobar = 0
  let aplicaEnPeriodo = false
  for (const fecha of rangoFechas(entrada.desde, entrada.hasta)) {
    if (!aplicaEnPeriodo && perfilVigente(entrada.personas, persona.executiveId, fecha).includes(tipo)) aplicaEnPeriodo = true
    const activo = activoEn(fecha)
    const diasHabilesSemana = generalVigente(entrada.general, 'dias_habiles_semana', fecha)
    const dia = resolverDiaHabil({ fecha, diasHabilesSemana, calendario: entrada.calendario, municipio: persona.municipio })
    const habil = activo ? dia.fraccion : 0
    const libre = Math.min(habil, fraccionLibre(libresDeLaPersona, fecha))
    const porAprobar = Math.min(habil - libre, fraccionPorAprobar(libresDeLaPersona, fecha))
    const metaDia = activo ? metaDelDia(fecha, diasHabilesSemana).valor : 0
    const factor = factorDelDia(fecha)
    const aporte = metaDia * Math.max(0, habil - libre) * factor
    porDia.push({ fecha, activo, habil, fuente: dia.fuente, nombreDia: dia.nombre, libre, porAprobar, metaDia, factor, aporte })
    cuota += aporte
    diasHabiles += habil
    if (fecha <= hoy) diasHabilesTranscurridos += habil
    diasLibres += libre
    diasPorAprobar += porAprobar
  }

  const hoyMeta = metaDelDia(hoy, generalVigente(entrada.general, 'dias_habiles_semana', hoy))
  return {
    cuota: redondear2(cuota),
    diasHabiles: redondear2(diasHabiles),
    diasHabilesTranscurridos: redondear2(diasHabilesTranscurridos),
    diasLibres: redondear2(diasLibres),
    diasPorAprobar: redondear2(diasPorAprobar),
    metaDiaHoy: activoEn(hoy) ? redondear2(hoyMeta.valor * factorDelDia(hoy)) : 0,
    origenMeta: hoyMeta.meta.origen,
    aplicaPerfil: hoyMeta.aplica,
    aplicaEnPeriodo,
    porDia,
  }
}

/** Ritmo del periodo: días hábiles transcurridos ÷ días hábiles (0..1; 0 si no hay días hábiles). */
export function ritmo(diasHabilesTranscurridos: number, diasHabiles: number): number {
  if (!(diasHabiles > 0)) return 0
  return Math.min(1, Math.max(0, diasHabilesTranscurridos / diasHabiles))
}

/** Subtipos que tienen meta propia algún día del periodo (los que salen en la cuota por subtipo). */
export function subtiposConMetaPropia(conteo: readonly ConteoVigencia[], desde: string, hasta: string): string[] {
  const periodo: Vigencia = { vigente_desde: desde, vigente_hasta: hasta }
  const ids: string[] = []
  for (const fila of conteo) {
    if (fila.modo === 'meta_propia' && seSuperponen(fila, periodo) && !ids.includes(fila.subtipo_id)) ids.push(fila.subtipo_id)
  }
  return ids
}

/** Resumen de una cuota para CuotaResponse (medica, institucional o un subtipo). */
export function resumenCuotaTipo(resultado: ResultadoCuota): CuotaTipo {
  return {
    cuota: resultado.cuota,
    meta_dia_hoy: resultado.metaDiaHoy,
    origen: resultado.origenMeta,
    aplica: resultado.aplicaEnPeriodo,
  }
}

// ---------------------------------------------------------------------------------------------
// 9. Conteo de visitas
// ---------------------------------------------------------------------------------------------

export interface ValorVisita {
  meta: 'medica' | 'institucional' | 'subtipo' | null
  subtipoId: string | null
  peso: number
}

/**
 * Cuánto vale una visita según config_conteo vigente en su fecha: médica → meta médica, peso 1; institucional
 * según el modo de su subtipo (suma_institucional → institucional con su peso; meta_propia → la del subtipo con
 * su peso; seguimiento o sin fila → no suma, peso 0).
 */
export function valorVisita(entrada: {
  conteo: readonly ConteoVigencia[]
  fecha: string
  tipo: TipoVisita
  subtipoId?: string | null
}): ValorVisita {
  if (entrada.tipo === 'medica') return { meta: 'medica', subtipoId: null, peso: 1 }
  const subtipoId = entrada.subtipoId ?? null
  if (!subtipoId) return { meta: null, subtipoId: null, peso: 0 }
  const fila = valorVigente(
    entrada.conteo.filter(c => c.subtipo_id === subtipoId),
    entrada.fecha
  )
  if (!fila || fila.modo === 'seguimiento') return { meta: null, subtipoId, peso: 0 }
  return { meta: fila.modo === 'suma_institucional' ? 'institucional' : 'subtipo', subtipoId, peso: Number(fila.peso) }
}

// ---------------------------------------------------------------------------------------------
// 10. Filas y respuestas de la API
// ---------------------------------------------------------------------------------------------

/** Columnas comunes de las 4 tablas de configuración (con los nombres que agrega la API). */
export interface ConfigBase {
  id: string
  vigente_desde: string
  vigente_hasta: string | null
  motivo: string | null
  set_by: string | null
  created_at: string
  anulado_at: string | null
  anulado_por: string | null
  anulado_motivo: string | null
  clave: string
  /** La fila que este valor cortó o reemplazó al registrarse y el fin que esa tenía (ver Vigencia). */
  anterior_id: string | null
  anterior_hasta: string | null
  set_by_nombre?: string | null
  anulado_por_nombre?: string | null
}

export type ConfigMeta = ConfigBase & MetaCampos
export type ConfigConteo = ConfigBase & ConteoCampos
export type ConfigGeneral = ConfigBase & { parametro: ParametroGeneral; valor: unknown }
export type ConfigPersona = ConfigBase & Omit<PersonaCampos, 'perfil'> & { perfil: TipoVisita[] }

/** Fila de calendario. */
export interface CalendarioDia {
  id: string
  fecha: string
  alcance: AlcanceCalendario
  municipality_id: string | null
  tipo: TipoDiaCalendario
  nombre: string
  origen: OrigenCalendario
  created_by: string | null
  created_at: string
  anulado_at: string | null
  anulado_por: string | null
  anulado_motivo: string | null
}

/** Fila de dias_libres. */
export interface DiaLibre {
  id: string
  executive_id: string
  fecha: string
  fraccion: number
  motivo: string
  nota: string | null
  estado: EstadoDiaLibre
  registrado_por: string | null
  registrado_at: string
  fuera_de_plazo: boolean
  justificacion: string | null
  revisado_por: string | null
  revisado_at: string | null
  motivo_revision: string | null
  created_at: string
  updated_at: string
}

/** Fila de subtipos_institucionales (migración 0800). */
export type Subtipo = SubtipoRow & { created_by?: string | null }

export type EstadoEjecutiva = 'active' | 'placeholder' | 'inactive'

/** GET /api/config-visitas → zonas */
export interface ZonaOpcion {
  id: string
  nombre: string
  /** Municipio de la ciudad base (municipioDeZona). */
  municipio: string | null
}

/** GET /api/config-visitas → ejecutivas */
export interface EjecutivaOpcion {
  id: string
  nombre: string
  kam_id: string | null
  /** Nombre de la zona base. */
  zona: string | null
  status: EstadoEjecutiva
}

/** GET /api/config-visitas: todas las filas (con cerradas y anuladas). */
export interface ConfigVisitasResponse {
  hoy: string
  metas: ConfigMeta[]
  conteo: ConfigConteo[]
  general: ConfigGeneral[]
  personas: ConfigPersona[]
  subtipos: Subtipo[]
  zonas: ZonaOpcion[]
  ejecutivas: EjecutivaOpcion[]
}

/** POST /api/config-visitas/vista-previa */
export interface VistaPreviaResponse {
  plan: PlanCambio
  meses_recalculados: string[]
}

/** POST /api/config-visitas/cambios (201) */
export interface CambioConfigResponse {
  id: string
  meses_recalculados: string[]
}

/** GET /api/calendario → dias */
export interface CalendarioDiaItem {
  id: string
  fecha: string
  alcance: AlcanceCalendario
  municipality_id: string | null
  /** Nombre del municipio (días de ciudad). */
  ciudad: string | null
  tipo: TipoDiaCalendario
  nombre: string
  origen: OrigenCalendario
  anulado_at: string | null
}

/** GET /api/calendario */
export interface CalendarioResponse {
  dias: CalendarioDiaItem[]
}

/** POST /api/calendario/festivos */
export interface CargarFestivosResponse {
  insertados: number
}

/** Un día libre en las listas (GET /api/dias-libres y GET /api/me/dias-libres). */
export interface DiaLibreItem {
  id: string
  executive_id: string
  /** Nombre del Ejecutivo Comercial. */
  ejecutiva: string
  /** Nombre de su zona base. */
  zona: string | null
  fecha: string
  fraccion: number
  motivo: string
  motivo_nombre: string
  nota: string | null
  estado: EstadoDiaLibre
  fuera_de_plazo: boolean
  justificacion: string | null
  registrado_por_nombre: string | null
  registrado_at: string
  revisado_por_nombre: string | null
  revisado_at: string | null
  motivo_revision: string | null
}

/** GET /api/dias-libres */
export interface DiasLibresResponse {
  items: DiaLibreItem[]
  /** Quien pide puede aprobar (daysoff:approve y su rol en `aprueban`, o admin). */
  puede_aprobar: boolean
  /**
   * Plazo de gracia y motivos vigentes HOY, para "Registrar por otra persona" (recursos humanos no lee
   * /api/config-visitas). La API vuelve a validar los dos al guardar.
   */
  plazo_horas: number
  motivos: MotivoDiaLibre[]
}

/** POST /api/dias-libres/revisar */
export interface RevisarDiasLibresResponse {
  actualizados: number
  omitidos: { id: string; razon: string }[]
}

/** GET /api/me/dias-libres */
export interface MisDiasLibresResponse {
  ejecutiva: { id: string; nombre: string }
  items: DiaLibreItem[]
  plazo_horas: number
  requiere_aprobacion: boolean
  motivos: MotivoDiaLibre[]
}

/** Cuota de un tipo o subtipo en CuotaResponse. */
export interface CuotaTipo {
  cuota: number
  meta_dia_hoy: number
  origen: OrigenMeta
  /**
   * El perfil incluye el tipo algún día del periodo pedido (con el perfil que regía cada día). Si es false, la
   * cuota de ese tipo es 0 y la interfaz dice que no está en su perfil ese mes. meta_dia_hoy y origen son de HOY.
   */
  aplica?: boolean
}

export interface CuotaSubtipo extends CuotaTipo {
  subtipo_id: string
  nombre: string
}

/** GET /api/me/cuota?mes= y GET /api/config-visitas/cuota?executive_id=&mes= */
export interface CuotaResponse {
  mes: string
  ejecutiva: { id: string; nombre: string }
  /** Zona base (executives.base_kam_id) o null. */
  zona: { id: string; nombre: string } | null
  /** Municipio de la zona (código DANE de 5 dígitos) o null. */
  municipio: string | null
  /** Nombre de ese municipio, si la API lo trae. */
  ciudad?: string | null
  /** Perfil vigente hoy. */
  perfil: TipoVisita[]
  medica: CuotaTipo
  institucional: CuotaTipo
  subtipos: CuotaSubtipo[]
  dias_habiles: number
  dias_habiles_transcurridos: number
  dias_libres: number
  dias_por_aprobar: number
  ritmo: number
}
