/**
 * Actividades de campo · F1a (migración 0850): ciclo de vida de lo programado — lógica PURA (sin red ni base de
 * datos), espejo de agenda_crear, agenda_cancelar, agenda_cerrar, agenda_eliminar, agenda_otra_fecha y agenda_choque.
 * La usan la API (/api/me/agenda/**), las pruebas (scripts/agenda-ciclo-check.ts) y, en F1b, la app (que la copia).
 * Spec: docs/specs/2026-10-15-actividades-de-campo.md ("Ciclo de vida de lo programado", A4, A5, A7, A8, C6, C7, C8,
 * C10 y C13). Contrato de la API: sección "F4.2" de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md.
 *
 * Lo programado no se mueve de fecha (A7): se cierra con su resultado —hecha (reportando la visita), no se hizo (con
 * motivo, desde su día), cancelada (con motivo, de hoy en adelante)— o se elimina si se programó por error (pendiente y
 * de hoy en adelante; no cuenta en nada). Otra fecha = una cita NUEVA enlazada a la anterior (viene_de).
 */
import { etiquetaDe, valoresDe, type Opcion } from './terceros'
import { fechaHoraBogota, hoyBogota, redondear2 } from './visits-rules'

// ---------------------------------------------------------------------------------------------
// Estados y motivos
// ---------------------------------------------------------------------------------------------

/** Estado de una cita (visitas_agenda.estado). Una cita no se borra ni se mueve: se cierra o se elimina por error. */
export const ESTADOS_CITA = [
  { valor: 'pendiente', etiqueta: 'Programada' },
  { valor: 'hecha', etiqueta: 'Hecha' },
  { valor: 'no_realizada', etiqueta: 'No se hizo' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
  { valor: 'eliminada', etiqueta: 'Eliminada' },
] as const satisfies readonly Opcion[]
export type EstadoCita = (typeof ESTADOS_CITA)[number]['valor']
export const VALORES_ESTADO_CITA = valoresDe<EstadoCita>(ESTADOS_CITA)
export const etiquetaEstadoCita = (valor: string | null | undefined) => etiquetaDe(ESTADOS_CITA, valor)

/**
 * Motivos de cierre (C10), los mismos para cancelar y para "no se hizo". 'salida' solo lo pone el sistema cuando la
 * persona sale de la empresa (A16): no se elige.
 */
export const MOTIVOS_CIERRE = [
  { valor: 'cliente', etiqueta: 'El médico o el cliente no pudo', elegible: true },
  { valor: 'prioridad', etiqueta: 'Otra prioridad de la empresa', elegible: true },
  { valor: 'falta_tiempo', etiqueta: 'No alcanzó el tiempo', elegible: true },
  { valor: 'fuerza_mayor', etiqueta: 'Salud, clima o vía', elegible: true },
  { valor: 'otro', etiqueta: 'Otro', elegible: true },
  { valor: 'salida', etiqueta: 'Salió de la empresa', elegible: false },
] as const
export type MotivoCierre = (typeof MOTIVOS_CIERRE)[number]['valor']
/** Los que la persona puede elegir (sin 'salida'). */
export type MotivoElegible = Exclude<MotivoCierre, 'salida'>
export const VALORES_MOTIVO_CIERRE = MOTIVOS_CIERRE.map(m => m.valor) as [MotivoCierre, ...MotivoCierre[]]
export const VALORES_MOTIVO_ELEGIBLE = MOTIVOS_CIERRE.filter(m => m.elegible).map(m => m.valor) as [MotivoElegible, ...MotivoElegible[]]
export const etiquetaMotivoCierre = (valor: string | null | undefined): string =>
  (valor && MOTIVOS_CIERRE.find(m => m.valor === valor)?.etiqueta) || (valor ?? '')

/** Texto del motivo: con 'otro', de 3 a 300 caracteres; con los demás, opcional y hasta 300. */
export const MIN_MOTIVO_OTRO = 3
export const MAX_MOTIVO_CIERRE = 300

/** Media hora que ocupa cada cita con hora: dos que se cruzan en ella chocan (decisión del dueño 2026-10-15). */
export const MINUTOS_CITA = 30

// ---------------------------------------------------------------------------------------------
// Mensajes (los mismos que lanzan las funciones de la 0850)
// ---------------------------------------------------------------------------------------------

export const MENSAJE_HORA_PASADA = 'Esa hora ya pasó'
export const MENSAJE_CITA_CERRADA = 'Esa cita ya está cerrada'
export const MENSAJE_CITA_NO_LLEGA = 'Esa cita todavía no llega: cancélala'
export const MENSAJE_SOLO_PENDIENTE_SE_ELIMINA = 'Solo se elimina una cita pendiente'
export const MENSAJE_ELIMINAR_PASADA = 'Solo se eliminan las citas de hoy en adelante: ciérrala con "No se hizo"'
export const MENSAJE_CITA_SIGUE_PROGRAMADA = 'Esa cita sigue programada: ciérrala o cancélala antes'
export const MENSAJE_CITA_YA_TIENE_OTRA_FECHA = 'Esa cita ya tiene otra fecha'
export const MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA = 'Esa cita ya se hizo (visita efectiva): agenda una cita nueva'
export const MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA = 'Esa cita se canceló por la salida de la persona: no tiene otra fecha'
export const MENSAJE_OTRA_FECHA_DISTINTA = 'La otra fecha debe ser con el mismo médico o la misma cuenta y subtipo'
export const MENSAJE_MOTIVO_NO_VALIDO = 'Elige el motivo: cliente, prioridad, falta_tiempo, fuerza_mayor u otro'
export const MENSAJE_MOTIVO_SALIDA = 'El motivo "salida" lo pone el sistema'
export const MENSAJE_MOTIVO_LARGO = `El motivo no puede superar ${MAX_MOTIVO_CIERRE} caracteres`
/** Cancelar con 'otro' (o sin código) y sin texto suficiente (agenda_cancelar). */
export const MENSAJE_MOTIVO_CANCELAR = 'Escribe el motivo de la cancelación'
/** Cerrar con 'otro' y sin texto suficiente (agenda_cerrar). */
export const MENSAJE_MOTIVO_CERRAR = 'Escribe por qué no se hizo'
/** La API (zod), cuando cancelar no trae ni código ni texto (A8). */
export const MENSAJE_CANCELAR_SIN_MOTIVO = 'Elige o escribe el motivo de la cancelación'
/** Texto que deja la salida (A16): users.active a false, o la baja del Ejecutivo Comercial sin más líneas. */
export const TEXTO_SALIDA = 'Salió de la empresa'
/** Texto que deja la baja del Ejecutivo Comercial de quien sigue como líder (solo sus citas como Ejecutivo Comercial). */
export const TEXTO_DEJO_DE_SER_EJECUTIVO = 'Dejó de ser Ejecutivo Comercial'

/** Choque de media hora (23P01 → 409 con el error en `hora`): "A las 09:30 ya tienes cita con …: elige otra hora". */
export function mensajeChoque(hora: string, conQuien: string): string {
  return `A las ${hora} ya tienes cita con ${conQuien}: elige otra hora`
}

// ---------------------------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------------------------

/** Minutos desde la medianoche de una hora HH:MM (o HH:MM:SS); NaN si no es una hora. */
export function minutosDeHora(hora: string): number {
  const m = /^(\d{2}):(\d{2})/.exec(hora.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN
}

/** Una cita con lo que mira el choque. */
export interface CitaParaChoque {
  id: string
  fecha: string
  /** HH:MM o HH:MM:SS; null = sin hora (citas viejas): nunca choca. */
  hora: string | null
  estado: EstadoCita
}

/**
 * Espejo de agenda_choque: la primera cita (por hora y por id) de ese día, pendiente o hecha, con hora, a menos de
 * MINUTOS_CITA de `hora` (sin contar `excluir`), o null. Las sin hora, las que no se hicieron, las canceladas y las
 * eliminadas no chocan. 09:00 y 09:15 chocan; 09:00 y 09:30 no.
 */
export function agendaChoca<T extends CitaParaChoque>(
  entrada: { fecha: string; hora: string | null },
  citas: readonly T[],
  excluir: string | null = null
): T | null {
  if (!entrada.hora) return null
  const minutos = minutosDeHora(entrada.hora)
  if (Number.isNaN(minutos)) return null
  const choques = citas
    .filter(
      cita =>
        cita.id !== excluir &&
        cita.fecha === entrada.fecha &&
        (cita.estado === 'pendiente' || cita.estado === 'hecha') &&
        typeof cita.hora === 'string' &&
        Math.abs(minutosDeHora(cita.hora) - minutos) < MINUTOS_CITA
    )
    .sort((a, b) => minutosDeHora(a.hora as string) - minutosDeHora(b.hora as string) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return choques[0] ?? null
}

/**
 * Espejo de la ventana de agenda_crear (A4, C13): no en el pasado; de hoy, no a una hora que ya pasó (minuto a minuto,
 * en Bogotá). Sin tope hacia adelante. null = la fecha y la hora sirven. (El día libre lo mira mensajeFechaCita.)
 */
export function mensajeHoraCita(fecha: string, hora: string, ahora: Date): string | null {
  const { fecha: hoy, hora: horaAhora } = fechaHoraBogota(ahora)
  if (fecha !== hoy) return null
  return minutosDeHora(hora) < minutosDeHora(horaAhora) ? MENSAJE_HORA_PASADA : null
}

/** La persona la puede cancelar: pendiente y de hoy en adelante (C7; espejo de agenda_cancelar). */
export function citaCancelable(cita: { estado: EstadoCita; fecha: string }, hoy: string): boolean {
  return cita.estado === 'pendiente' && cita.fecha >= hoy
}

/** "No se hizo": pendiente y de su día o anterior (C7; espejo de agenda_cerrar). El mismo día valen las dos. */
export function citaCerrable(cita: { estado: EstadoCita; fecha: string }, hoy: string): boolean {
  return cita.estado === 'pendiente' && cita.fecha <= hoy
}

/** Eliminar por error: pendiente y de hoy en adelante (C8; espejo de agenda_eliminar). */
export function citaEliminable(cita: { estado: EstadoCita; fecha: string }, hoy: string): boolean {
  return cita.estado === 'pendiente' && cita.fecha >= hoy
}

/** Mensaje de agenda_cancelar para esa cita (propia), o null si se puede cancelar. */
export function revisarCancelar(cita: { estado: EstadoCita; fecha: string }, hoy: string): string | null {
  if (cita.estado === 'cancelada') return 'Esa cita ya está cancelada'
  if (cita.estado === 'hecha') return 'Esa cita ya tiene su visita: no se cancela'
  if (cita.estado === 'no_realizada') return MENSAJE_CITA_CERRADA
  if (cita.estado === 'eliminada') return 'Esa cita no existe'
  if (cita.fecha < hoy) return 'Solo se cancelan las citas de hoy en adelante'
  return null
}

/** Mensaje de agenda_cerrar para esa cita (propia), o null si se puede marcar "no se hizo". */
export function revisarCerrar(cita: { estado: EstadoCita; fecha: string }, hoy: string): string | null {
  if (cita.estado === 'eliminada') return 'Esa cita no existe'
  if (cita.estado !== 'pendiente') return MENSAJE_CITA_CERRADA
  if (cita.fecha > hoy) return MENSAJE_CITA_NO_LLEGA
  return null
}

/** Mensaje de agenda_eliminar para esa cita (propia), o null si se puede eliminar por error. */
export function revisarEliminar(cita: { estado: EstadoCita; fecha: string }, hoy: string): string | null {
  if (cita.estado === 'eliminada') return 'Esa cita no existe'
  if (cita.estado !== 'pendiente') return MENSAJE_SOLO_PENDIENTE_SE_ELIMINA
  if (cita.fecha < hoy) return MENSAJE_ELIMINAR_PASADA
  return null
}

/**
 * Motivo de un cierre (C10): código de la lista sin 'salida' (sin código = 'otro'); con 'otro', texto de 3 a 300; con los
 * demás, texto opcional hasta 300. Devuelve el mensaje de la base o null.
 */
export function revisarMotivo(codigo: string | null | undefined, texto: string | null | undefined, uso: 'cancelar' | 'cerrar'): string | null {
  const elegido = codigo && codigo.trim() ? codigo.trim() : uso === 'cancelar' ? 'otro' : null
  if (!elegido || !(VALORES_MOTIVO_CIERRE as readonly string[]).includes(elegido)) return MENSAJE_MOTIVO_NO_VALIDO
  if (elegido === 'salida') return MENSAJE_MOTIVO_SALIDA
  const limpio = (texto ?? '').trim()
  if (limpio.length > MAX_MOTIVO_CIERRE) return MENSAJE_MOTIVO_LARGO
  if (elegido === 'otro' && limpio.length < MIN_MOTIVO_OTRO) return uso === 'cancelar' ? MENSAJE_MOTIVO_CANCELAR : MENSAJE_MOTIVO_CERRAR
  return null
}

/** Una cita como posible origen de "otra fecha". */
export interface OrigenOtraFecha {
  estado: EstadoCita
  motivo_codigo: MotivoCierre | null
  /** Si está hecha: ¿su visita fue efectiva? (null si no está hecha o no se sabe). */
  visita_efectiva?: boolean | null
  /** ¿Ya tiene una sucesora no eliminada? */
  tiene_sucesora: boolean
}

/**
 * Espejo de las reglas de "otra fecha" (A7) de agenda_crear con viene_de: la anterior debe estar cerrada —no_realizada,
 * cancelada (no por salida) o hecha con una visita no efectiva— y sin otra sucesora. Devuelve el mensaje o null (sirve).
 */
export function origenParaOtraFecha(cita: OrigenOtraFecha): string | null {
  if (cita.estado === 'eliminada') return 'Esa cita no existe'
  if (cita.estado === 'pendiente') return MENSAJE_CITA_SIGUE_PROGRAMADA
  if (cita.estado === 'cancelada' && cita.motivo_codigo === 'salida') return MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA
  if (cita.estado === 'hecha' && cita.visita_efectiva !== false) return MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA
  if (cita.tiene_sucesora) return MENSAJE_CITA_YA_TIENE_OTRA_FECHA
  return null
}

// ---------------------------------------------------------------------------------------------
// Lo que se muestra: estado visible (C6) y el indicador de Mis números
// ---------------------------------------------------------------------------------------------

/** Cómo se muestra una cita (C6): lo pendiente pasado no se cierra solo; lo calcula la lectura. */
export type EstadoVisible = 'programada' | 'atrasada' | 'sin_cerrar' | 'hecha' | 'no_realizada' | 'cancelada' | 'eliminada'

/**
 * Estado visible (C6): una pendiente de hoy pasada su hora queda "atrasada" y una de un día anterior "sin cerrar"; las
 * demás pendientes, "programada". Las cerradas, con su estado.
 */
export function estadoVisible(cita: { estado: EstadoCita; fecha: string; hora: string | null }, ahora: Date): EstadoVisible {
  if (cita.estado !== 'pendiente') return cita.estado
  const { fecha: hoy, hora } = fechaHoraBogota(ahora)
  if (cita.fecha < hoy) return 'sin_cerrar'
  if (cita.fecha === hoy && cita.hora && minutosDeHora(cita.hora) < minutosDeHora(hora)) return 'atrasada'
  return 'programada'
}

/** Indicador de la agenda en Mis números (decisión 8 de F4.1; 0850: "no se hizo" aparte y sin las eliminadas). */
export interface NumerosAgenda {
  /** Visitas efectivas del mes (no anuladas). */
  efectivas: number
  /** De ellas, las agendadas (vinculadas a una cita creada antes del día de la visita). */
  efectivas_agendadas: number
  /** efectivas_agendadas ÷ efectivas; null si no hay efectivas. */
  porcentaje_agendadas: number | null
  /** Citas del mes de días ya pasados o de hoy, sin las canceladas ni las eliminadas (las que no se hicieron, sí). */
  citas_hasta_hoy: number
  /** De ellas, las hechas (con su visita, efectiva o no). */
  citas_hechas: number
  /** De ellas, las que no se hicieron (0850). */
  citas_no_realizadas: number
  /** citas_hechas ÷ citas_hasta_hoy; null si no hay citas. */
  cumplimiento: number | null
}

/**
 * Cuentas de la agenda del mes: porcentaje de efectivas agendadas (agendadas ÷ efectivas) y cumplimiento de la agenda
 * (citas hechas ÷ citas de días ya pasados o de hoy, sin canceladas ni eliminadas: lo eliminado por error no cuenta en
 * nada, A7). `visitas`: las del mes sin anuladas; la no efectiva cumple su cita pero no suma a las efectivas.
 */
export function cuentasAgenda(entrada: {
  visitas: readonly { efectiva: boolean; agendada: boolean }[]
  citas: readonly { fecha: string; estado: EstadoCita }[]
  hoy: string
}): NumerosAgenda {
  const efectivas = entrada.visitas.filter(visita => visita.efectiva)
  const efectivas_agendadas = efectivas.filter(visita => visita.agendada).length
  const hastaHoy = entrada.citas.filter(cita => cita.estado !== 'cancelada' && cita.estado !== 'eliminada' && cita.fecha <= entrada.hoy)
  const citas_hechas = hastaHoy.filter(cita => cita.estado === 'hecha').length
  return {
    efectivas: efectivas.length,
    efectivas_agendadas,
    porcentaje_agendadas: efectivas.length > 0 ? redondear2(efectivas_agendadas / efectivas.length) : null,
    citas_hasta_hoy: hastaHoy.length,
    citas_hechas,
    citas_no_realizadas: hastaHoy.filter(cita => cita.estado === 'no_realizada').length,
    cumplimiento: hastaHoy.length > 0 ? redondear2(citas_hechas / hastaHoy.length) : null,
  }
}

/** Hoy en Bogotá (re-exportado para quien solo importa este archivo). */
export { hoyBogota }
