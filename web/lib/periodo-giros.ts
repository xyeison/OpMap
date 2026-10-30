// Período del filtro de /inteligencia (giros ADRES): opciones del selector a partir de los meses con datos de la
// fuente (spec 2026-10-29-giros-variaciones). Reemplaza los <input type="month">, que cada navegador pinta distinto y
// en los que cambiar el año era difícil. Puro: sirve en cliente y servidor.
import { addMonths } from './adres-intelligence'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Meses con giros de la fuente ('YYYY-MM', inclusive). */
export interface MesesDisponibles {
  min: string
  max: string
}

export const PERIODO_PERSONALIZADO = 'personalizado'

/** 'YYYY-MM' → 'sep 2026'. */
export function mesCorto(ym: string): string {
  const m = Number(ym.slice(5, 7))
  return m >= 1 && m <= 12 ? `${MESES[m - 1]} ${ym.slice(0, 4)}` : ym
}

/** 'jul–sep 2026' si es el mismo año; 'oct 2025 – sep 2026' si no. */
export function rangoTexto(desde: string, hasta: string): string {
  if (desde === hasta) return mesCorto(desde)
  if (desde.slice(0, 4) === hasta.slice(0, 4)) return `${MESES[Number(desde.slice(5, 7)) - 1]}–${mesCorto(hasta)}`
  return `${mesCorto(desde)} – ${mesCorto(hasta)}`
}

const maxMes = (a: string, b: string) => (a > b ? a : b)
const minMes = (a: string, b: string) => (a < b ? a : b)

/** Años con algún mes de datos, del más reciente al más antiguo. */
export function aniosDisponibles(d: MesesDisponibles): number[] {
  const out: number[] = []
  for (let anio = Number(d.max.slice(0, 4)); anio >= Number(d.min.slice(0, 4)); anio--) out.push(anio)
  return out
}

/** Lleva un mes al rango con datos (el más cercano). */
export function ajustarAlDisponible(ym: string, d: MesesDisponibles): string {
  return minMes(maxMes(ym, d.min), d.max)
}

/**
 * Rango de una opción del selector: 'u3' | 'u6' | 'u12' (los últimos N meses con datos), 'todo', o un año ('2025').
 * null para 'personalizado' o un valor desconocido o un año sin datos.
 */
export function rangoDePeriodo(valor: string, d: MesesDisponibles): { desde: string; hasta: string } | null {
  const ultimos = /^u(3|6|12)$/.exec(valor)
  if (ultimos) return { desde: maxMes(d.min, addMonths(d.max, -(Number(ultimos[1]) - 1))), hasta: d.max }
  if (valor === 'todo') return { desde: d.min, hasta: d.max }
  if (/^\d{4}$/.test(valor)) {
    const desde = maxMes(d.min, `${valor}-01`)
    const hasta = minMes(d.max, `${valor}-12`)
    return desde <= hasta ? { desde, hasta } : null
  }
  return null
}

/** Opciones del selector "Período", con el rango que cubre cada una. */
export function opcionesPeriodo(d: MesesDisponibles): Array<{ valor: string; etiqueta: string }> {
  const conRango = (valor: string, nombre: string) => {
    const rango = rangoDePeriodo(valor, d)
    return { valor, etiqueta: rango ? `${nombre} (${rangoTexto(rango.desde, rango.hasta)})` : nombre }
  }
  return [
    conRango('u3', 'Últimos 3 meses'),
    conRango('u6', 'Últimos 6 meses'),
    conRango('u12', 'Últimos 12 meses'),
    conRango('todo', 'Todo lo cargado'),
    ...aniosDisponibles(d).map(anio => conRango(String(anio), `Año ${anio}`)),
    { valor: PERIODO_PERSONALIZADO, etiqueta: 'Personalizado…' },
  ]
}

/** La opción que corresponde a un rango (la primera que coincide), o 'personalizado'. */
export function periodoDeRango(desde: string, hasta: string, d: MesesDisponibles): string {
  for (const { valor } of opcionesPeriodo(d)) {
    const rango = rangoDePeriodo(valor, d)
    if (rango && rango.desde === desde && rango.hasta === hasta) return valor
  }
  return PERIODO_PERSONALIZADO
}

/** Los 12 meses de un año para la lista "Mes", con los que no tienen datos apagados. */
export function mesesDelAnio(anio: number, d: MesesDisponibles): Array<{ mes: string; etiqueta: string; habilitado: boolean }> {
  return MESES.map((nombre, index) => {
    const mes = `${anio}-${String(index + 1).padStart(2, '0')}`
    return { mes, etiqueta: nombre, habilitado: mes >= d.min && mes <= d.max }
  })
}
