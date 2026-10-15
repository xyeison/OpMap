/**
 * Calendario de la agenda (spec 2026-10-15, decisión 2 del dueño: "la agenda es un calendario"). Puro: sin
 * react-native (lo prueba scripts/checks/17-agenda.ts). Lo dibuja components/agenda/CalendarioMes.tsx en Agendar, Mi
 * agenda, Días libres y la próxima reunión de la visita.
 *
 * - El mes va en cuadrícula de semanas de LUNES a domingo (como el calendario colombiano), con los días del mes
 *   anterior y del siguiente que completan la primera y la última semana.
 * - Las fechas van como texto AAAA-MM-DD y los meses como AAAA-MM (lib/fechas.ts), sin zona: el día es el de Bogotá.
 * - rangoDeMes es la consulta de un mes a GET /api/me/agenda (como mucho 31 días, el tope del servidor).
 */
import { esMesIso, nombreMes, sumarDias, sumarMeses } from './fechas'
import type { EstadoDiaLibre } from './tipos'

export { mesDe } from './fechas'

/** Lo que se marca en un día del calendario. */
export interface MarcaDia {
  /** Citas de ese día (pendientes y hechas; sin las canceladas). */
  citas?: number
  /** Estado del día libre de ese día, si hay. */
  estadoLibre?: EstadoDiaLibre | null
  /** El día no se puede elegir (además de los que caen fuera de desde..hasta). */
  apagado?: boolean
}

/** Un día de la cuadrícula. */
export interface DiaCalendario {
  fecha: string
  /** Número del día (1 a 31). */
  numero: number
  /** Es del mes que se dibuja (los de relleno del mes anterior o siguiente, no). */
  delMes: boolean
  esHoy: boolean
  /** Se puede elegir: dentro de desde..hasta y no apagado. */
  elegible: boolean
}

export interface OpcionesCalendario {
  hoy: string
  desde?: string
  hasta?: string
  marcas?: Readonly<Record<string, MarcaDia>>
}

/** Letras de los días, de lunes a domingo. */
export const LETRAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/**
 * Separación entre los días de una semana del calendario (pt). Revisión 2026-10-15: con 4 y los márgenes de 20 del
 * estilo Uber, en un Android de 360 dp cada día quedaba de 42,3 pt de ancho (menos de los 44 que se tocan bien).
 */
export const SEPARACION_DIAS = 2

/** Ancho de cada día en una fila de 7 que mide `anchoFila`, con `separacion` entre los días. */
export function anchoDia(anchoFila: number, separacion: number = SEPARACION_DIAS): number {
  return (anchoFila - 6 * separacion) / 7
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

/** ¿Se puede elegir ese día? Dentro de desde..hasta (si se dan) y sin marca de apagado. */
export function esElegible(fecha: string, opciones: Pick<OpcionesCalendario, 'desde' | 'hasta' | 'marcas'>): boolean {
  if (opciones.desde !== undefined && fecha < opciones.desde) return false
  if (opciones.hasta !== undefined && fecha > opciones.hasta) return false
  return !opciones.marcas?.[fecha]?.apagado
}

/** Lunes de la semana de una fecha (semana de lunes a domingo). */
export function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}

/** Los 7 días (AAAA-MM-DD) de la semana de una fecha, de lunes a domingo. */
export function semanaDe(fecha: string): string[] {
  const lunes = lunesDe(fecha)
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

/** Primer y último día de un mes AAAA-MM: la consulta del mes (28 a 31 días, nunca más de 31). */
export function rangoDeMes(mes: string): { desde: string; hasta: string } {
  if (!esMesIso(mes)) throw new Error(`Mes no válido: ${String(mes)} (se espera AAAA-MM)`)
  const desde = `${mes}-01`
  return { desde, hasta: sumarDias(`${sumarMeses(mes, 1)}-01`, -1) }
}

export function mesSiguiente(mes: string): string {
  return sumarMeses(mes, 1)
}

export function mesAnterior(mes: string): string {
  return sumarMeses(mes, -1)
}

/** "Octubre de 2026". */
export function tituloMes(mes: string): string {
  const texto = nombreMes(mes)
  return texto[0].toUpperCase() + texto.slice(1)
}

/** "16 oct" (día y mes corto). */
export function fechaCortita(fecha: string): string {
  return `${Number(fecha.slice(8, 10))} ${MESES_CORTOS[Number(fecha.slice(5, 7)) - 1]}`
}

/** Título de una semana: "12 – 18 oct" o, si cruza de mes, "28 sep – 4 oct". */
export function tituloSemana(fecha: string): string {
  const dias = semanaDe(fecha)
  const primero = dias[0]
  const ultimo = dias[6]
  if (primero.slice(0, 7) === ultimo.slice(0, 7)) return `${Number(primero.slice(8, 10))} – ${fechaCortita(ultimo)}`
  return `${fechaCortita(primero)} – ${fechaCortita(ultimo)}`
}

/** Los meses (AAAA-MM, sin repetir y en orden) que toca un rango de fechas: los de una semana pueden ser dos. */
export function mesesDeRango(desde: string, hasta: string): string[] {
  const meses: string[] = []
  for (let mes = desde.slice(0, 7); mes <= hasta.slice(0, 7); mes = sumarMeses(mes, 1)) meses.push(mes)
  return meses
}

function dia(fecha: string, mes: string | null, opciones: OpcionesCalendario): DiaCalendario {
  return {
    fecha,
    numero: Number(fecha.slice(8, 10)),
    delMes: mes === null || fecha.slice(0, 7) === mes,
    esHoy: fecha === opciones.hoy,
    elegible: esElegible(fecha, opciones),
  }
}

/**
 * El mes AAAA-MM en semanas de lunes a domingo (4 a 6 semanas de 7 días), con los días de relleno del mes anterior y
 * del siguiente: octubre de 2026 va del lunes 28 de septiembre al domingo 1 de noviembre.
 */
export function cuadriculaMes(mes: string, opciones: OpcionesCalendario): DiaCalendario[][] {
  const { desde, hasta } = rangoDeMes(mes)
  const semanas: DiaCalendario[][] = []
  for (let lunes = lunesDe(desde); lunes <= hasta; lunes = sumarDias(lunes, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => dia(sumarDias(lunes, i), mes, opciones)))
  }
  return semanas
}

/**
 * Las semanas que se dibujan: sin las que caen enteras fuera de desde..hasta (en Agendar, de octubre solo se ven las
 * semanas desde la de hoy; así "¿A qué hora?" cabe en la primera pantalla). Sin desde ni hasta, todas.
 */
export function semanasVisibles(semanas: readonly DiaCalendario[][], opciones: Pick<OpcionesCalendario, 'desde' | 'hasta'>): DiaCalendario[][] {
  const dentro = (fecha: string) => (opciones.desde === undefined || fecha >= opciones.desde) && (opciones.hasta === undefined || fecha <= opciones.hasta)
  return semanas.filter(semana => semana.some(d => dentro(d.fecha)))
}

/** La semana (de lunes a domingo) de una fecha, como una fila de la cuadrícula (todos sus días cuentan como del mes). */
export function cuadriculaSemana(fecha: string, opciones: OpcionesCalendario): DiaCalendario[] {
  return semanaDe(fecha).map(f => dia(f, null, opciones))
}

/**
 * Lo que se lee en voz alta de un día: "jueves 16 de octubre, hoy, 2 citas, día libre aprobado". `nombreLargo` es la
 * fecha larga ya armada (lib/fechas.ts fechaLarga), para no depender del reloj aquí.
 */
export function etiquetaDia(nombreLargo: string, d: Pick<DiaCalendario, 'esHoy' | 'elegible'>, marca: MarcaDia | undefined, etiquetaLibre?: string | null): string {
  const partes = [nombreLargo]
  if (d.esHoy) partes.push('hoy')
  if (marca?.citas) partes.push(marca.citas === 1 ? '1 cita' : `${marca.citas} citas`)
  if (marca?.estadoLibre && etiquetaLibre) partes.push(`día libre ${etiquetaLibre.toLowerCase()}`)
  if (!d.elegible) partes.push('no se puede elegir')
  return partes.join(', ')
}
