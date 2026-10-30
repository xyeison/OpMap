/**
 * Ciclo de vida de lo programado en la app (F1b de actividades de campo): ESPEJO de web/lib/agenda-ciclo.ts (estados,
 * motivos de cierre, transiciones y mensajes de las funciones de la 0850) más lo que solo la app necesita: qué acciones
 * ofrece cada cita, el cuerpo del motivo y los textos del detalle. PURO (sin React Native): lo prueba
 * scripts/checks/21-persona.ts, que lee los dos archivos y compara los estados, los motivos y los mensajes.
 * Spec: docs/specs/2026-10-15-actividades-de-campo.md ("Ciclo de vida de lo programado", A7, A8, C6, C7, C8, C10).
 *
 * Lo programado no se mueve de fecha (A7): se cierra con su resultado —hecha (reportando la visita), no se hizo (con
 * motivo, desde su día), cancelada (con motivo, de hoy en adelante)— o se elimina si se agendó por error (pendiente y de
 * hoy en adelante; no cuenta en nada). Otra fecha = una cita NUEVA enlazada a la anterior (viene_de). El servidor es la
 * última palabra: estas reglas solo deciden qué botones se muestran y avisan antes de enviar.
 */
import { fechaCortita } from './calendario'
import { horaBogota, hoyBogota } from './fechas'
import { conQuienCita } from './reglas'
import type { CitaItem, EstadoCita, EstadoVisible, MotivoCierre, MotivoElegible } from './tipos'

// ---------------------------------------------------------------------------------------------
// Estados y motivos (los mismos valores y etiquetas que web/lib/agenda-ciclo.ts)
// ---------------------------------------------------------------------------------------------

/** Estado de una cita (visitas_agenda.estado). */
export const ESTADOS_CITA = [
  { valor: 'pendiente', etiqueta: 'Programada' },
  { valor: 'hecha', etiqueta: 'Hecha' },
  { valor: 'no_realizada', etiqueta: 'No se hizo' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
  { valor: 'eliminada', etiqueta: 'Eliminada' },
] as const satisfies readonly { valor: EstadoCita; etiqueta: string }[]

/** Motivos de cierre (C10), los mismos para cancelar y para "no se hizo". 'salida' lo pone el sistema (A16). */
export const MOTIVOS_CIERRE = [
  { valor: 'cliente', etiqueta: 'El médico o el cliente no pudo', elegible: true },
  { valor: 'prioridad', etiqueta: 'Otra prioridad de la empresa', elegible: true },
  { valor: 'falta_tiempo', etiqueta: 'No alcanzó el tiempo', elegible: true },
  { valor: 'fuerza_mayor', etiqueta: 'Salud, clima o vía', elegible: true },
  { valor: 'otro', etiqueta: 'Otro', elegible: true },
  { valor: 'salida', etiqueta: 'Salió de la empresa', elegible: false },
] as const satisfies readonly { valor: MotivoCierre; etiqueta: string; elegible: boolean }[]

/** Los motivos que la persona elige (sin 'salida'), en su orden. */
export const MOTIVOS_ELEGIBLES = MOTIVOS_CIERRE.filter(m => m.elegible) as readonly { valor: MotivoElegible; etiqueta: string; elegible: true }[]

export const etiquetaMotivoCierre = (valor: string | null | undefined): string =>
  (valor && MOTIVOS_CIERRE.find(m => m.valor === valor)?.etiqueta) || (valor ?? '')

/** Texto del motivo: con 'otro', de 3 a 300 caracteres; con los demás, opcional y hasta 300. */
export const MIN_MOTIVO_OTRO = 3
export const MAX_MOTIVO_CIERRE = 300

/** Media hora que ocupa cada cita con hora: dos que se cruzan en ella chocan (decisión del dueño 2026-10-15). */
export const MINUTOS_CITA = 30

// ---------------------------------------------------------------------------------------------
// Mensajes (los mismos que lanzan las funciones de la 0850 y la API)
// ---------------------------------------------------------------------------------------------

export const MENSAJE_CITA_CERRADA = 'Esa cita ya está cerrada'
export const MENSAJE_CITA_NO_LLEGA = 'Esa cita todavía no llega: cancélala'
export const MENSAJE_SOLO_PENDIENTE_SE_ELIMINA = 'Solo se elimina una cita pendiente'
export const MENSAJE_ELIMINAR_PASADA = 'Solo se eliminan las citas de hoy en adelante: ciérrala con "No se hizo"'
export const MENSAJE_CITA_SIGUE_PROGRAMADA = 'Esa cita sigue programada: ciérrala o cancélala antes'
export const MENSAJE_CITA_YA_TIENE_OTRA_FECHA = 'Esa cita ya tiene otra fecha'
export const MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA = 'Esa cita ya se hizo (visita efectiva): agenda una cita nueva'
export const MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA = 'Esa cita se canceló por la salida de la persona: no tiene otra fecha'
export const MENSAJE_MOTIVO_NO_VALIDO = 'Elige el motivo: cliente, prioridad, falta_tiempo, fuerza_mayor u otro'
export const MENSAJE_MOTIVO_SALIDA = 'El motivo "salida" lo pone el sistema'
export const MENSAJE_MOTIVO_LARGO = `El motivo no puede superar ${MAX_MOTIVO_CIERRE} caracteres`
/** Cancelar con 'otro' y sin texto suficiente (agenda_cancelar). */
export const MENSAJE_MOTIVO_CANCELAR = 'Escribe el motivo de la cancelación'
/** Cerrar con 'otro' y sin texto suficiente (agenda_cerrar). */
export const MENSAJE_MOTIVO_CERRAR = 'Escribe por qué no se hizo'
/** La API, cuando cancelar no trae ni código ni texto (A8). */
export const MENSAJE_CANCELAR_SIN_MOTIVO = 'Elige o escribe el motivo de la cancelación'
/** Texto que deja la salida (A16). */
export const TEXTO_SALIDA = 'Salió de la empresa'

/** Choque de media hora (409 con el error en `hora`): "A las 09:30 ya tienes cita con …: elige otra hora". */
export function mensajeChoque(hora: string, conQuien: string): string {
  return `A las ${hora} ya tienes cita con ${conQuien}: elige otra hora`
}

// ---------------------------------------------------------------------------------------------
// Reglas (espejo de agenda_choque, agenda_cancelar, agenda_cerrar, agenda_eliminar y agenda_otra_fecha)
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
export function agendaChoca<T extends CitaParaChoque>(entrada: { fecha: string; hora: string | null }, citas: readonly T[], excluir: string | null = null): T | null {
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
 * Motivo de un cierre (C10): código de la lista sin 'salida' (sin código, al cancelar = 'otro'); con 'otro', texto de
 * 3 a 300; con los demás, texto opcional hasta 300. Devuelve el mensaje de la base o null.
 */
export function revisarMotivo(codigo: string | null | undefined, texto: string | null | undefined, uso: 'cancelar' | 'cerrar'): string | null {
  const elegido = codigo && codigo.trim() ? codigo.trim() : uso === 'cancelar' ? 'otro' : null
  if (!elegido || !MOTIVOS_CIERRE.some(m => m.valor === elegido)) return MENSAJE_MOTIVO_NO_VALIDO
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
 * Espejo de las reglas de "otra fecha" (A7): la anterior debe estar cerrada —no_realizada, cancelada (no por salida) o
 * hecha con una visita no efectiva— y sin otra sucesora. Devuelve el mensaje o null (sirve).
 */
export function origenParaOtraFecha(cita: OrigenOtraFecha): string | null {
  if (cita.estado === 'eliminada') return 'Esa cita no existe'
  if (cita.estado === 'pendiente') return MENSAJE_CITA_SIGUE_PROGRAMADA
  if (cita.estado === 'cancelada' && cita.motivo_codigo === 'salida') return MENSAJE_CITA_SALIDA_SIN_OTRA_FECHA
  if (cita.estado === 'hecha' && cita.visita_efectiva !== false) return MENSAJE_CITA_EFECTIVA_SIN_OTRA_FECHA
  if (cita.tiene_sucesora) return MENSAJE_CITA_YA_TIENE_OTRA_FECHA
  return null
}

/**
 * Estado visible (C6): una pendiente de hoy pasada su hora queda "atrasada" y una de un día anterior "sin cerrar"; las
 * demás pendientes, "programada". Las cerradas, con su estado. La app lo calcula con su reloj (el `estado_visible` del
 * servidor es el del momento en que respondió).
 */
export function estadoVisible(cita: { estado: EstadoCita; fecha: string; hora: string | null }, ahora: Date): EstadoVisible {
  if (cita.estado !== 'pendiente') return cita.estado
  const hoy = hoyBogota(ahora)
  if (cita.fecha < hoy) return 'sin_cerrar'
  if (cita.fecha === hoy && cita.hora && minutosDeHora(cita.hora) < minutosDeHora(horaBogota(ahora))) return 'atrasada'
  return 'programada'
}

// ---------------------------------------------------------------------------------------------
// Lo que la app ofrece y dice (solo de la app)
// ---------------------------------------------------------------------------------------------

/** Las acciones que el detalle de una cita (o "¿Qué pasó con esto?" en Hoy) ofrece. Nunca "Mover" ni "Reprogramar". */
export interface AccionesCita {
  /** Reportar la visita: pendiente de hoy (una visita solo se reporta el mismo día). */
  reportar: boolean
  /** "No se hizo" (con motivo): pendiente de su día o anterior. */
  noSeHizo: boolean
  /** Cancelar (con motivo, A8): pendiente de hoy en adelante. */
  cancelar: boolean
  /** "Agendar otra fecha": cerrada sin sucesora (origenParaOtraFecha). */
  otraFecha: boolean
  /** "Eliminar: lo agendé por error": pendiente de hoy en adelante (C8). */
  eliminar: boolean
}

/**
 * Qué se puede hacer con una cita propia hoy. `visitaEfectiva`: si la cita está hecha, si su visita fue efectiva (null
 * o sin el dato: no se sabe, y entonces no se ofrece otra fecha: el servidor la rechazaría si fue efectiva).
 */
export function accionesDeCita(
  cita: Pick<CitaItem, 'estado' | 'fecha' | 'motivo_codigo' | 'sucesora_id'>,
  hoy: string,
  visitaEfectiva: boolean | null = null
): AccionesCita {
  return {
    reportar: cita.estado === 'pendiente' && cita.fecha === hoy,
    noSeHizo: citaCerrable(cita, hoy),
    cancelar: citaCancelable(cita, hoy),
    otraFecha:
      origenParaOtraFecha({ estado: cita.estado, motivo_codigo: cita.motivo_codigo ?? null, visita_efectiva: visitaEfectiva, tiene_sucesora: !!cita.sucesora_id }) === null,
    eliminar: citaEliminable(cita, hoy),
  }
}

/** El cuerpo de cancelar o de "no se hizo": el código elegido y el texto limpio (hasta 300), o null si no escribió. */
export function cuerpoMotivo(codigo: MotivoElegible, texto: string | null | undefined): { motivo_codigo: MotivoElegible; motivo: string | null } {
  const limpio = (texto ?? '').trim().replace(/\s+/g, ' ')
  return { motivo_codigo: codigo, motivo: limpio ? limpio.slice(0, MAX_MOTIVO_CIERRE) : null }
}

/**
 * "Viene de la cita del 12 oct · No se hizo" (la de una hecha dice "No efectiva": solo una visita no efectiva admite otra
 * fecha). Sin la fecha (un servidor anterior), "Viene de otra cita". null si no viene de otra.
 */
export function textoVieneDe(cita: Pick<CitaItem, 'viene_de' | 'viene_de_fecha' | 'viene_de_estado'>): string | null {
  if (!cita.viene_de) return null
  const fecha = cita.viene_de_fecha ?? null
  if (!fecha) return 'Viene de otra cita'
  const estado = cita.viene_de_estado ?? null
  const como = estado === 'hecha' ? 'No efectiva' : estado ? etiquetaDeEstado(estado) : null
  return `Viene de la cita del ${fechaCortita(fecha)}${como ? ` · ${como}` : ''}`
}

/** Lo que dice Agendar al pedir otra fecha: "Otra fecha de la cita del 12 oct · No se hizo" (la hecha: "No efectiva"). */
export function textoOtraFechaDe(cita: Pick<CitaItem, 'fecha' | 'estado'>): string {
  const como = cita.estado === 'hecha' ? 'No efectiva' : etiquetaDeEstado(cita.estado)
  return `Otra fecha de la cita del ${fechaCortita(cita.fecha)} · ${como}`
}

/** Etiqueta de un estado (la de ESTADOS_CITA). */
export function etiquetaDeEstado(estado: EstadoCita): string {
  return ESTADOS_CITA.find(e => e.valor === estado)?.etiqueta ?? estado
}

/**
 * El motivo de una cita cerrada: "El médico o el cliente no pudo", o en la que no se hizo también su texto ("Otro" no
 * se dice si hay texto: "Se fue a cirugía"). La cancelada solo trae el código (la API no devuelve su texto). null si no
 * está cerrada o no tiene motivo.
 */
export function textoMotivoDeCierre(cita: Pick<CitaItem, 'estado' | 'motivo_codigo' | 'no_realizada_motivo'>): string | null {
  if (cita.estado !== 'no_realizada' && cita.estado !== 'cancelada') return null
  const texto = cita.estado === 'no_realizada' ? cita.no_realizada_motivo?.trim() || null : null
  const etiqueta = cita.motivo_codigo && !(cita.motivo_codigo === 'otro' && texto) ? etiquetaMotivoCierre(cita.motivo_codigo) : null
  const partes = [etiqueta, texto].filter((p): p is string => !!p)
  return partes.length > 0 ? partes.join(' · ') : null
}

/** Lo que se dice al cerrar, cancelar o eliminar (junto al día en Mi agenda, o en Hoy). */
export function mensajeTrasCerrar(accion: 'no_se_hizo' | 'cancelar' | 'eliminar', cita: Pick<CitaItem, 'tipo' | 'medico' | 'cuenta' | 'subtipo'>): string {
  const con = conQuienCita(cita)
  if (accion === 'no_se_hizo') return `Anotado: la cita con ${con} no se hizo. Si hace falta, agenda otra fecha.`
  if (accion === 'cancelar') return `Cancelaste la cita con ${con}. Queda en tu agenda como cancelada.`
  return `Eliminaste la cita con ${con}: ya no sale en tu agenda ni cuenta en tus números.`
}
