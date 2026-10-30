// Cifras del seguimiento de las líderes en /lideres (dueño, 2026-10-29): por período y líder, por mes, tipo y ciudad,
// la agenda de tres semanas y la calidad del registro. Sirven igual para el histórico guardado (GET
// /api/lideres/historico) y para la vista previa de un Excel antes de guardarlo. Puro: pruebas en
// scripts/lideres-historico-check.ts.
import type { EstadoHistorico, TipoHistorico } from './lideres-historico'

export interface ActividadSeguimiento {
  fecha: string | null
  /** Nombre visible de la líder (el de OpMap, o el del Excel en la vista previa). */
  lider: string
  /** Nombre visible de la ciudad (el del DANE, o el texto del Excel). */
  ciudad: string
  /** Código DANE; null si no se reconoció (o en la vista previa, antes de guardar). */
  municipio_id: string | null
  tipo: TipoHistorico
  tipo_a_mano: boolean
  estado: EstadoHistorico
  contactos: number
  con_observacion: boolean
}

export type PeriodoSeguimiento = 'mes' | 'tres' | 'todo'

export const PERIODOS_SEGUIMIENTO: Array<{ valor: PeriodoSeguimiento; etiqueta: string }> = [
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'tres', etiqueta: 'Últimos 3 meses' },
  { valor: 'todo', etiqueta: 'Todo el registro' },
]

const inicioDeMes = (corte: string, atras: number) => {
  const [anio, mes] = corte.split('-').map(Number)
  return new Date(Date.UTC(anio, mes - 1 - atras, 1)).toISOString().slice(0, 10)
}

/** Desde qué fecha cuenta el período (hasta el corte). */
export function desdePeriodo(periodo: PeriodoSeguimiento, corte: string): string {
  if (periodo === 'mes') return inicioDeMes(corte, 0)
  if (periodo === 'tres') return inicioDeMes(corte, 2)
  return '0000-01-01'
}

const enPeriodo = (actividad: ActividadSeguimiento, desde: string, corte: string) => actividad.fecha !== null && actividad.fecha >= desde && actividad.fecha <= corte

export interface ResumenLider {
  lider: string
  realizadas: number
  canceladas: number
  canceladasSinObservacion: number
  sinCerrar: number
  /** Cerradas (realizadas o canceladas) entre todas las de fecha pasada del período; null sin ninguna. */
  pctCerradas: number | null
  ciudades: number
  contactos: number
  /** Planificadas después del corte (no dependen del período). */
  planificadas: number
  /** Fecha de la última realizada del período. */
  ultima: string | null
}

function resumir(lider: string, actividades: ActividadSeguimiento[], desde: string, corte: string): ResumenLider {
  const delPeriodo = actividades.filter(actividad => enPeriodo(actividad, desde, corte))
  const realizadas = delPeriodo.filter(actividad => actividad.estado === 'realizada')
  const canceladas = delPeriodo.filter(actividad => actividad.estado === 'cancelada')
  const sinCerrar = delPeriodo.filter(actividad => actividad.estado === 'sin_cerrar')
  const pasadas = realizadas.length + canceladas.length + sinCerrar.length
  return {
    lider,
    realizadas: realizadas.length,
    canceladas: canceladas.length,
    canceladasSinObservacion: canceladas.filter(actividad => !actividad.con_observacion).length,
    sinCerrar: sinCerrar.length,
    pctCerradas: pasadas ? (realizadas.length + canceladas.length) / pasadas : null,
    ciudades: new Set(realizadas.map(actividad => actividad.ciudad)).size,
    contactos: realizadas.reduce((suma, actividad) => suma + actividad.contactos, 0),
    planificadas: actividades.filter(actividad => actividad.estado === 'planificada').length,
    ultima: realizadas.map(actividad => actividad.fecha as string).sort().pop() ?? null,
  }
}

/** Una fila por líder (de más a menos realizadas) y el total de todas. */
export function resumenPorLider(actividades: ActividadSeguimiento[], periodo: PeriodoSeguimiento, corte: string): { lideres: ResumenLider[]; total: ResumenLider } {
  const desde = desdePeriodo(periodo, corte)
  const porLider = new Map<string, ActividadSeguimiento[]>()
  for (const actividad of actividades) porLider.set(actividad.lider, [...(porLider.get(actividad.lider) ?? []), actividad])
  const lideres = Array.from(porLider, ([lider, suyas]) => resumir(lider, suyas, desde, corte)).sort(
    (a, b) => b.realizadas - a.realizadas || a.lider.localeCompare(b.lider, 'es')
  )
  return { lideres, total: resumir('Todas', actividades, desde, corte) }
}

/** Realizadas por mes (hasta el corte), por líder. */
export function realizadasPorMes(actividades: ActividadSeguimiento[], corte: string): Array<{ mes: string; porLider: Record<string, number>; total: number }> {
  const meses = new Map<string, Record<string, number>>()
  for (const actividad of actividades) {
    if (actividad.estado !== 'realizada' || !actividad.fecha || actividad.fecha > corte) continue
    const mes = actividad.fecha.slice(0, 7)
    const fila = meses.get(mes) ?? {}
    fila[actividad.lider] = (fila[actividad.lider] ?? 0) + 1
    meses.set(mes, fila)
  }
  return Array.from(meses, ([mes, porLider]) => ({ mes, porLider, total: Object.values(porLider).reduce((a, b) => a + b, 0) })).sort((a, b) =>
    a.mes.localeCompare(b.mes)
  )
}

/** Realizadas del período por una clave (tipo o ciudad), de mayor a menor. */
function contarRealizadas<K extends string>(
  actividades: ActividadSeguimiento[],
  periodo: PeriodoSeguimiento,
  corte: string,
  clave: (actividad: ActividadSeguimiento) => K
): Array<{ clave: K; n: number }> {
  const desde = desdePeriodo(periodo, corte)
  const cuenta = new Map<K, number>()
  for (const actividad of actividades) {
    if (actividad.estado !== 'realizada' || !enPeriodo(actividad, desde, corte)) continue
    cuenta.set(clave(actividad), (cuenta.get(clave(actividad)) ?? 0) + 1)
  }
  return Array.from(cuenta, ([k, n]) => ({ clave: k, n })).sort((a, b) => b.n - a.n || String(a.clave).localeCompare(String(b.clave), 'es'))
}

export const realizadasPorTipo = (actividades: ActividadSeguimiento[], periodo: PeriodoSeguimiento, corte: string) =>
  contarRealizadas(actividades, periodo, corte, actividad => actividad.tipo)

export const realizadasPorCiudad = (actividades: ActividadSeguimiento[], periodo: PeriodoSeguimiento, corte: string, tope = 10) =>
  contarRealizadas(actividades, periodo, corte, actividad => actividad.ciudad).slice(0, tope)

/** Los 21 días alrededor del corte (7 antes, el corte y 13 después) y lo de cada líder en cada día. */
export function agendaTresSemanas(actividades: ActividadSeguimiento[], corte: string): { dias: string[]; lideres: string[]; celdas: Map<string, ActividadSeguimiento[]> } {
  const dias: string[] = []
  for (let i = -7; i <= 13; i++) {
    const dia = new Date(`${corte}T12:00:00Z`)
    dia.setUTCDate(dia.getUTCDate() + i)
    dias.push(dia.toISOString().slice(0, 10))
  }
  const enRango = new Set(dias)
  const celdas = new Map<string, ActividadSeguimiento[]>()
  for (const actividad of actividades) {
    if (!actividad.fecha || !enRango.has(actividad.fecha)) continue
    const clave = `${actividad.lider}|${actividad.fecha}`
    celdas.set(clave, [...(celdas.get(clave) ?? []), actividad])
  }
  const lideres = Array.from(new Set(actividades.map(actividad => actividad.lider))).sort((a, b) => a.localeCompare(b, 'es'))
  return { dias, lideres, celdas }
}

export interface CalidadRegistro {
  sinCerrar: number
  canceladasSinObservacion: number
  realizadasSinContactos: number
  fechasIlegibles: number
  tiposAMano: number
  /** Ciudades distintas que no se reconocieron como municipio de Colombia (con el histórico guardado). */
  ciudadesSinCodigo: number
}

/** Lo que el Excel deja escribir mal, en todo el registro. */
export function calidadRegistro(actividades: ActividadSeguimiento[], conCodigos: boolean): CalidadRegistro {
  return {
    sinCerrar: actividades.filter(actividad => actividad.estado === 'sin_cerrar').length,
    canceladasSinObservacion: actividades.filter(actividad => actividad.estado === 'cancelada' && !actividad.con_observacion).length,
    realizadasSinContactos: actividades.filter(actividad => actividad.estado === 'realizada' && actividad.contactos === 0).length,
    fechasIlegibles: actividades.filter(actividad => !actividad.fecha).length,
    tiposAMano: actividades.filter(actividad => actividad.tipo_a_mano).length,
    ciudadesSinCodigo: conCodigos ? new Set(actividades.filter(actividad => !actividad.municipio_id).map(actividad => actividad.ciudad)).size : 0,
  }
}
