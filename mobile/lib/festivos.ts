/**
 * Festivos de Colombia (Ley 51 de 1983) y el aviso de la próxima reunión (dueño, 2026-10-31: "si el lunes es festivo,
 * él debería advertir eso"; spec 2026-10-31-aviso-festivo-proxima-reunion). Puro: sin react-native (lo prueba
 * scripts/checks/17-agenda.ts).
 *
 * - festivosColombia: los mismos 18 por año, con los mismos nombres, que festivosColombia() de web/lib/visits-rules.ts
 *   y que la tabla calendario (calendario_festivos_colombia() de la migración 0810). Está en la app para avisar sin
 *   señal y con cualquier fecha: la que dictó, la de un atajo o la del calendario.
 * - avisoDiaNoLaborable: festivo o domingo. El sábado no avisa (hay reuniones con médicos el sábado). Avisa, no
 *   bloquea: la agenda deja agendar en festivo (0840, "la persona sabe si trabaja").
 */
import { esFechaIso, sumarDias } from './fechas'

export interface Festivo {
  fecha: string
  nombre: string
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')
// El año con 4 cifras, como toISOString: esFechaIso acepta 0001-0999 y la tarjeta no puede romper con ellos (revisor 2026-10-31).
const iso = (anio: number, mes: number, dia: number) => `${String(anio).padStart(4, '0')}-${dosDigitos(mes)}-${dosDigitos(dia)}`

/** 1 = lunes … 7 = domingo. */
function diaSemanaIso(fecha: string): number {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return dia === 0 ? 7 : dia
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

/** Los 18 festivos nacionales de un año, por fecha (y por nombre si dos caen el mismo día, como en 2038). */
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

/** El nombre del festivo de esa fecha (el primero si caen dos el mismo día); null si no es festivo o no es una fecha. */
export function festivoDe(fecha: string): string | null {
  if (!esFechaIso(fecha)) return null
  return festivosColombia(Number(fecha.slice(0, 4))).find(festivo => festivo.fecha === fecha)?.nombre ?? null
}

/** El aviso junto a la próxima reunión: festivo (con su nombre) o domingo; null otro día o si la fecha no vale. */
export function avisoDiaNoLaborable(fecha: string): string | null {
  const festivo = festivoDe(fecha)
  if (festivo) return `Es festivo (${festivo}): revisa la fecha.`
  return esFechaIso(fecha) && diaSemanaIso(fecha) === 7 ? 'Es domingo: revisa la fecha.' : null
}
