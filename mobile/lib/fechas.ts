/**
 * Fechas y horas en Bogotá, sin dependencias (ni de React Native ni de node:*). Colombia es UTC−5 todo el año
 * (sin horario de verano), así que "hoy en Bogotá" es la hora UTC menos 5 horas, igual que hoyBogota() en
 * web/lib/visits-rules.ts y fechaBogota() en web/lib/reporte-visitas.ts. Las fechas van como texto AAAA-MM-DD.
 */

const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS
/** Colombia: UTC−5 todo el año. */
export const DESFASE_BOGOTA_MS = 5 * HORA_MS

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const MES_RE = /^\d{4}-\d{2}$/

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** ¿Es una fecha AAAA-MM-DD que existe? */
export function esFechaIso(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !FECHA_RE.test(valor)) return false
  const ms = Date.parse(`${valor}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === valor
}

/** ¿Es un mes AAAA-MM válido? */
export function esMesIso(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !MES_RE.test(valor)) return false
  const mes = Number(valor.slice(5, 7))
  return mes >= 1 && mes <= 12
}

function aUtc(fecha: string): number {
  if (!esFechaIso(fecha)) throw new Error(`Fecha no válida: ${String(fecha)} (se espera AAAA-MM-DD)`)
  return Date.parse(`${fecha}T00:00:00Z`)
}

function desdeUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function msDe(instante: string | Date): number {
  const ms = instante instanceof Date ? instante.getTime() : Date.parse(instante)
  if (Number.isNaN(ms)) throw new Error(`Instante no válido: ${String(instante)}`)
  return ms
}

/** Fecha de hoy (AAAA-MM-DD) en Bogotá para un instante dado. */
export function hoyBogota(ahora: Date = new Date()): string {
  return desdeUtc(ahora.getTime() - DESFASE_BOGOTA_MS)
}

/** Fecha AAAA-MM-DD en Bogotá de un instante ISO (con zona) o Date. Lanza si no es válido. */
export function fechaBogota(instante: string | Date): string {
  return new Date(msDe(instante) - DESFASE_BOGOTA_MS).toISOString().slice(0, 10)
}

/** Hora HH:MM en Bogotá de un instante. */
export function horaBogota(instante: string | Date): string {
  return new Date(msDe(instante) - DESFASE_BOGOTA_MS).toISOString().slice(11, 16)
}

/** ¿El instante cae hoy en Bogotá (hoy = la fecha de `ahora` en Bogotá)? false si no es un instante válido. */
export function esHoyBogota(instante: string | Date, ahora: Date = new Date()): boolean {
  try {
    return fechaBogota(instante) === hoyBogota(ahora)
  } catch {
    return false
  }
}

/** Último instante del día en Bogotá (23:59:59.999): hasta ahí reintenta la cola sin señal. */
export function finDelDiaBogota(fecha: string): Date {
  if (!esFechaIso(fecha)) throw new Error(`Fecha no válida: ${String(fecha)}`)
  return new Date(Date.parse(`${fecha}T23:59:59.999-05:00`))
}

/** Suma n días (negativo resta) a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, n: number): string {
  return desdeUtc(aUtc(fecha) + n * DIA_MS)
}

/** Días entre dos fechas (hasta − desde); negativo si hasta es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS)
}

/** Mes AAAA-MM de una fecha o del instante actual en Bogotá. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

/** Mes anterior o siguiente (n = −1 o +1) de un mes AAAA-MM. */
export function sumarMeses(mes: string, n: number): string {
  if (!esMesIso(mes)) throw new Error(`Mes no válido: ${String(mes)} (se espera AAAA-MM)`)
  const anio = Number(mes.slice(0, 4))
  const indice = Number(mes.slice(5, 7)) - 1 + n
  const fecha = new Date(Date.UTC(anio, indice, 1))
  return `${fecha.getUTCFullYear()}-${dosDigitos(fecha.getUTCMonth() + 1)}`
}

/** Instante ISO con zona de Bogotá ("2026-10-13T14:35:20.000-05:00") para mandarlo al servidor. */
export function isoBogota(instante: Date = new Date()): string {
  const local = new Date(instante.getTime() - DESFASE_BOGOTA_MS).toISOString()
  return `${local.slice(0, 23)}-05:00`
}

/** "martes 13 de octubre" (con año si no es el actual en Bogotá: "martes 13 de octubre de 2025"). */
export function fechaLarga(fecha: string, ahora: Date = new Date()): string {
  const ms = aUtc(fecha)
  const d = new Date(ms)
  const base = `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
  return fecha.slice(0, 4) === hoyBogota(ahora).slice(0, 4) ? base : `${base} de ${d.getUTCFullYear()}`
}

/** "13 de octubre" (corto, sin día de la semana). */
export function fechaCorta(fecha: string): string {
  const d = new Date(aUtc(fecha))
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

/** "octubre de 2026" para un mes AAAA-MM. */
export function nombreMes(mes: string): string {
  if (!esMesIso(mes)) throw new Error(`Mes no válido: ${String(mes)}`)
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
}

/** "hoy", "mañana", "ayer" o la fecha corta, relativo a hoy en Bogotá. */
export function fechaRelativa(fecha: string, ahora: Date = new Date()): string {
  const hoy = hoyBogota(ahora)
  const diferencia = diasEntre(hoy, fecha)
  if (diferencia === 0) return 'hoy'
  if (diferencia === 1) return 'mañana'
  if (diferencia === -1) return 'ayer'
  return fechaCorta(fecha)
}

// ---------------------------------------------------------------------------------------------
// Plazo de los días libres (espejo de venceRegistroDiaLibre y textoLimiteRegistro de web/lib/visits-rules.ts)
// ---------------------------------------------------------------------------------------------

/**
 * Hasta cuándo se puede registrar un día libre: el inicio del día siguiente en Bogotá más el plazo de gracia.
 * Con 24 horas, el lunes se puede registrar hasta el martes a las 23:59.
 */
export function venceRegistroDiaLibre(fecha: string, plazoHoras: number): Date {
  return new Date(aUtc(sumarDias(fecha, 1)) + DESFASE_BOGOTA_MS + Math.max(0, plazoHoras) * HORA_MS)
}

/** Último minuto en que todavía se puede registrar, en hora de Colombia: "AAAA-MM-DD a las HH:MM". */
export function textoLimiteRegistro(venceAt: Date): string {
  const ultimoMinuto = new Date(venceAt.getTime() - 60 * 1000)
  return `${fechaBogota(ultimoMinuto)} a las ${horaBogota(ultimoMinuto)}`
}

/** Lo mismo en palabras: "miércoles 14 de octubre a las 23:59". */
export function textoLimiteLargo(venceAt: Date, ahora: Date = new Date()): string {
  const ultimoMinuto = new Date(venceAt.getTime() - 60 * 1000)
  return `${fechaLarga(fechaBogota(ultimoMinuto), ahora)} a las ${horaBogota(ultimoMinuto)}`
}

/** ¿Todavía se puede registrar ese día libre ahora (antes del vencimiento)? */
export function puedeRegistrarDiaLibre(fecha: string, plazoHoras: number, ahora: Date = new Date()): boolean {
  if (!esFechaIso(fecha)) return false
  return ahora.getTime() < venceRegistroDiaLibre(fecha, plazoHoras).getTime()
}
