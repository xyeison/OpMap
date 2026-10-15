/**
 * Agenda con hora (spec 2026-10-15; decisiones del dueño 1 y 2: la cita lleva hora siempre y la agenda es un
 * calendario). Puro: sin react-native (lo prueban en Node scripts/checks/17-agenda.ts y 16-reportar.ts).
 *
 * Pedido para Agendar: quien abre Agendar (Mi agenda al tocar una franja, la visita confirmada con "Agendar esa
 * reunión", Visita con "Agendar la próxima reunión") pone la fecha y la hora en la URL (rutaAgendar) y el "con quién"
 * en memoria (fijarPedidoAgendar), nunca en la URL: en el navegador la URL queda en el historial. Agendar toma el
 * pedido una sola vez (tomarPedidoAgendar), como lib/retorno.ts.
 *
 * Franjas (decisión 3): medias horas de 07:00 a 18:30 en Agendar y en la línea del día de Mi agenda, más "Otra hora"
 * cada 15 minutos de 05:00 a 21:45. Sin duración (decisión 4): cada cita se dibuja como un bloque de
 * DURACION_VISUAL_MIN; dos citas cuyos bloques se pisan "chocan", y el choque solo se avisa (decisión 5).
 *
 * Hora obligatoria: validarCitaConHora y cuerpoCitaConHora envuelven validarCita y cuerpoCita de lib/propuesta.ts
 * (que siguen aceptando "sin hora" para no tocar sus pruebas); el servidor exige la hora con el mismo mensaje
 * (MENSAJE_HORA_OBLIGATORIA, web/lib/reporte-visitas.ts). Las citas viejas sin hora siguen válidas y se muestran al
 * final del día, en "Sin hora".
 */
import { esFechaIso, hoyBogota, horaBogota, sumarDias } from './fechas'
import type { MarcaDia } from './calendario'
import { cuerpoCita, horaDeCita, validarCita, ventanaCita, type FormularioCita } from './propuesta'
import { conQuienCita } from './reglas'
import type { CitaCreate, CitaItem, DiaLibreItem, ErrorVisita, TipoVisita } from './tipos'

// ---------------------------------------------------------------------------------------------
// Pedido para Agendar (en memoria, como lib/retorno.ts)
// ---------------------------------------------------------------------------------------------

export interface PedidoAgendar {
  tipo: TipoVisita
  medico_id?: string | null
  cuenta_id?: string | null
  subtipo_id?: string | null
  sede_id?: string | null
}

/**
 * Ruta de Agendar: '/agenda/nueva?fecha=AAAA-MM-DD&hora=HH:MM'. Solo la fecha y la hora, y solo si son válidas
 * ("9:30" queda en 09:30); lo que no vale se descarta. Nunca ids en la URL.
 */
export function rutaAgendar(p: { fecha?: string; hora?: string }): string {
  const partes: string[] = []
  if (p.fecha !== undefined && esFechaIso(p.fecha)) partes.push(`fecha=${p.fecha}`)
  const hora = typeof p.hora === 'string' ? horaDeCita(p.hora) : undefined
  if (typeof hora === 'string') partes.push(`hora=${hora}`)
  return partes.length > 0 ? `/agenda/nueva?${partes.join('&')}` : '/agenda/nueva'
}

let pedidoActual: PedidoAgendar | null = null

/** Deja en memoria con quién es la cita que se va a agendar (lo toma Agendar al abrir). */
export function fijarPedidoAgendar(p: PedidoAgendar): void {
  pedidoActual = { ...p }
}

/** El pedido pendiente (y lo olvida: se toma una sola vez). */
export function tomarPedidoAgendar(): PedidoAgendar | null {
  const pedido = pedidoActual
  pedidoActual = null
  return pedido
}

/** ¿Se puede agendar la próxima reunión en esa fecha? Solo de hoy a hoy + 30 (la ventana de Agendar). */
export function puedeAgendarProxima(fecha: string | null, hoy: string): boolean {
  if (!fecha || !esFechaIso(fecha) || !esFechaIso(hoy)) return false
  const ventana = ventanaCita(hoy)
  return fecha >= ventana.desde && fecha <= ventana.hasta
}

/** Mi agenda en ese día ('/agenda?fecha=AAAA-MM-DD'); sin fecha válida, '/agenda'. */
export function rutaMiAgenda(fecha?: string | null): string {
  return fecha && esFechaIso(fecha) ? `/agenda?fecha=${fecha}` : '/agenda'
}

let citaResaltada: { id: string; fecha: string } | null = null

/** Agendar deja aquí la cita recién agendada (en memoria): Mi agenda va a su día, la abre y la resalta. */
export function fijarCitaResaltada(cita: { id: string; fecha: string }): void {
  citaResaltada = { id: cita.id, fecha: cita.fecha }
}

/** La cita por resaltar (y la olvida: se toma una sola vez). */
export function tomarCitaResaltada(): { id: string; fecha: string } | null {
  const cita = citaResaltada
  citaResaltada = null
  return cita
}

// ---------------------------------------------------------------------------------------------
// Franjas
// ---------------------------------------------------------------------------------------------

/**
 * Horario de la agenda (constante de la app; la base acepta 00:00–23:59): las franjas de Agendar y de la línea del día
 * van de `desde` a `hasta` cada `paso` minutos; la hora sugerida al abrir Agendar se busca desde `sugeridaDesde`.
 */
export const HORARIO_AGENDA = { desde: '07:00', hasta: '18:30', paso: 30, sugeridaDesde: '08:00' } as const

/** Cuánto ocupa una cita en la línea del día (solo para dibujar y avisar choques: no hay columna de duración). */
export const DURACION_VISUAL_MIN = 30

/** "Otra hora": de 05 a 21 y minutos 00, 15, 30 y 45 (de 05:00 a 21:45). */
export const OTRA_HORA = {
  horas: ['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'],
  minutos: ['00', '15', '30', '45'],
} as const

/** Las franjas de la mañana terminan antes de esta hora; desde ella, la tarde. */
export const INICIO_TARDE = '12:00'

/** Minutos desde la medianoche de una hora HH:MM. */
export function minutosDe(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
}

/** HH:MM de unos minutos desde la medianoche. */
export function horaDeMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** Franjas HH:MM de `desde` a `hasta` (incluida) cada `paso` minutos: por defecto, las 24 de 07:00 a 18:30. */
export function franjasHorario(desde: string = HORARIO_AGENDA.desde, hasta: string = HORARIO_AGENDA.hasta, paso: number = HORARIO_AGENDA.paso): string[] {
  const franjas: string[] = []
  for (let m = minutosDe(desde); m <= minutosDe(hasta); m += paso) franjas.push(horaDeMinutos(m))
  return franjas
}

/** La franja (de `paso` minutos) en que cae una hora: 09:45 → 09:30. */
export function franjaDe(hora: string, paso: number = HORARIO_AGENDA.paso): string {
  return horaDeMinutos(Math.floor(minutosDe(hora) / paso) * paso)
}

/** ¿Dos horas se pisan? (cada cita ocupa DURACION_VISUAL_MIN desde su hora: 09:30 y 09:45 sí; 09:30 y 10:00 no). */
export function sePisan(a: string, b: string): boolean {
  return Math.abs(minutosDe(a) - minutosDe(b)) < DURACION_VISUAL_MIN
}

type CitaConHora = Pick<CitaItem, 'hora' | 'estado'>

const vivas = <T extends Pick<CitaItem, 'estado'>>(citas: readonly T[]): T[] => citas.filter(c => c.estado !== 'cancelada')

const porHora = <T extends Pick<CitaItem, 'hora' | 'id'>>(a: T, b: T) =>
  (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export interface FilaDelDia<T> {
  franja: string
  citas: T[]
}

/**
 * La línea del día: las franjas de media hora con sus citas (sin las canceladas), y aparte las viejas sin hora (van al
 * final del día). Una cita fuera del horario amplía la línea hasta su franja (06:30 la empieza a las 06:30; 19:00 la
 * termina a las 19:00), sin huecos.
 */
export function ocupacionDelDia<T extends Pick<CitaItem, 'id' | 'hora' | 'estado'>>(citas: readonly T[], paso: number = HORARIO_AGENDA.paso): { filas: FilaDelDia<T>[]; sinHora: T[] } {
  const enPie = vivas(citas)
  const conHora = enPie.filter(c => !!c.hora).sort(porHora)
  let desde = minutosDe(HORARIO_AGENDA.desde)
  let hasta = minutosDe(HORARIO_AGENDA.hasta)
  for (const cita of conHora) {
    const franja = minutosDe(franjaDe(cita.hora as string, paso))
    desde = Math.min(desde, franja)
    hasta = Math.max(hasta, franja)
  }
  const filas = franjasHorario(horaDeMinutos(desde), horaDeMinutos(hasta), paso).map(franja => ({
    franja,
    citas: conHora.filter(c => franjaDe(c.hora as string, paso) === franja),
  }))
  return { filas, sinHora: enPie.filter(c => !c.hora).sort(porHora) }
}

/** Las citas en pie de ese día que se pisan con esa hora (las sin hora y las canceladas no chocan). */
export function citasQueChocan<T extends CitaConHora>(hora: string, citasDelDia: readonly T[]): T[] {
  return vivas(citasDelDia).filter(c => !!c.hora && sePisan(c.hora, hora))
}

/** ¿La franja de esa fecha ya pasó? (un día anterior a hoy, o hoy a esa hora o antes, en Bogotá). */
export function franjaPasada(fecha: string, hora: string, ahora: Date = new Date()): boolean {
  const hoy = hoyBogota(ahora)
  if (fecha !== hoy) return fecha < hoy
  return minutosDe(hora) <= minutosDe(horaBogota(ahora))
}

/**
 * La hora que Agendar trae elegida si no se tocó una franja: la primera franja libre desde las 08:00 (hoy: la
 * siguiente media hora que aún no pasa) que no se pise con otra cita en pie. null si el día está lleno, si ya pasó el
 * horario (hoy después de las 18:30) o si la fecha ya pasó: la validación dice entonces "Elige la hora de la cita".
 */
export function siguienteFranjaLibre(fecha: string, citas: readonly Pick<CitaItem, 'fecha' | 'hora' | 'estado'>[], ahora: Date = new Date()): string | null {
  if (fecha < hoyBogota(ahora)) return null
  const delDia = citas.filter(c => c.fecha === fecha)
  return franjasHorario(HORARIO_AGENDA.sugeridaDesde).find(f => !franjaPasada(fecha, f, ahora) && citasQueChocan(f, delDia).length === 0) ?? null
}

/**
 * El primer día elegible de desde..hasta con una franja libre, y esa franja (la cita que Agendar trae puesta al abrir
 * sin fecha ni hora). null si ninguno.
 */
export function primeraFranjaLibre(
  desde: string,
  hasta: string,
  citas: readonly Pick<CitaItem, 'fecha' | 'hora' | 'estado'>[],
  marcas: Readonly<Record<string, MarcaDia>> = {},
  ahora: Date = new Date()
): { fecha: string; hora: string } | null {
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
    if (marcas[fecha]?.apagado) continue
    const hora = siguienteFranjaLibre(fecha, citas, ahora)
    if (hora) return { fecha, hora }
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Hora obligatoria (decisión 1 del dueño, 2026-10-15)
// ---------------------------------------------------------------------------------------------

/** El mismo texto de web/lib/reporte-visitas.ts (MENSAJE_HORA_OBLIGATORIA, que usa citaCreateSchema). */
export const MENSAJE_HORA_OBLIGATORIA = 'Elige la hora de la cita'

/**
 * validarCita (forma y ventana, los mismos mensajes del servidor) con la hora OBLIGATORIA: sin hora, el error va en
 * `hora` con MENSAJE_HORA_OBLIGATORIA, justo después de los de la fecha.
 */
export function validarCitaConHora(formulario: FormularioCita, hoy: string, perfil?: readonly TipoVisita[]): ErrorVisita[] {
  const errores = validarCita(formulario, hoy, perfil)
  if (horaDeCita(formulario.hora) !== null) return errores
  const despuesDeFecha = errores.filter(e => e.campo === 'fecha').length
  return [...errores.slice(0, despuesDeFecha), { campo: 'hora', mensaje: MENSAJE_HORA_OBLIGATORIA }, ...errores.slice(despuesDeFecha)]
}

/** Cuerpo de POST /api/me/agenda con la hora en HH:MM. Lanza sin hora (o si falta algo): validarlo antes. */
export function cuerpoCitaConHora(formulario: FormularioCita): CitaCreate & { hora: string } {
  const hora = horaDeCita(formulario.hora)
  if (typeof hora !== 'string') throw new Error(MENSAJE_HORA_OBLIGATORIA)
  const cuerpo = cuerpoCita({ ...formulario, hora })
  return { ...cuerpo, hora }
}

// ---------------------------------------------------------------------------------------------
// Textos de Agendar
// ---------------------------------------------------------------------------------------------

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

/** "jueves 16 oct". */
export function fechaBoton(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`
}

/** El botón del pie de Agendar: "Agendar · jueves 16 oct · 10:00" (sin hora aún: "Agendar · jueves 16 oct"). */
export function textoBotonAgendar(fecha: string, hora: string | null | undefined): string {
  if (!esFechaIso(fecha)) return 'Agendar'
  const limpia = hora ? horaDeCita(hora) : null
  return typeof limpia === 'string' ? `Agendar · ${fechaBoton(fecha)} · ${limpia}` : `Agendar · ${fechaBoton(fecha)}`
}

/** "Dra. Ana Gómez", "Dra. Ana Gómez y Clínica Norte · Compras", "A, B y C". */
function juntar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Aviso de choque (decisión 5: no bloquea): "A las 09:30 ya tienes cita con Dra. Ana Gómez. Puedes agendar igual."
 * null si la franja está libre (las canceladas y las sin hora no cuentan).
 */
export function avisoChoque(hora: string | null | undefined, citasDelDia: readonly Pick<CitaItem, 'id' | 'hora' | 'estado' | 'tipo' | 'medico' | 'cuenta' | 'subtipo'>[]): string | null {
  const limpia = hora ? horaDeCita(hora) : null
  if (typeof limpia !== 'string') return null
  const choques = citasQueChocan(limpia, citasDelDia).sort(porHora)
  if (choques.length === 0) return null
  const horas = Array.from(new Set(choques.map(c => (c.hora as string).slice(0, 5))))
  return `A las ${juntar(horas)} ya tienes cita con ${juntar(choques.map(conQuienCita))}. Puedes agendar igual.`
}

/**
 * Si la cita es para hoy: "Es para hoy: contará como visita no agendada." (solo cuentan como agendadas las citas creadas
 * antes del día de la visita). null otro día.
 */
export function avisoAgendadaHoy(fecha: string, hoy: string): string | null {
  return fecha === hoy ? 'Es para hoy: contará como visita no agendada.' : null
}

/** "Ese día ya tienes: 08:00 Dra. X · 10:30 Clínica Y" (en pie, por hora; las viejas sin hora al final). null si nada. */
export function textoCitasDelDia(citasDelDia: readonly Pick<CitaItem, 'id' | 'hora' | 'estado' | 'tipo' | 'medico' | 'cuenta' | 'subtipo'>[]): string | null {
  const enPie = vivas(citasDelDia).sort(porHora)
  if (enPie.length === 0) return null
  return `Ese día ya tienes: ${enPie.map(c => `${c.hora ? c.hora.slice(0, 5) : 'Sin hora'} ${conQuienCita(c)}`).join(' · ')}`
}

/**
 * Los médicos que ya tienen cita (en pie) ese día, con el texto del selector: "Cita a las 09:30" (o "Ya tiene cita ese
 * día" si es una vieja sin hora). La base no deja dos citas con el mismo médico el mismo día.
 */
export function medicosConCitaEseDia(citas: readonly Pick<CitaItem, 'fecha' | 'hora' | 'estado' | 'tipo' | 'medico'>[], fecha: string): Map<string, string> {
  const textos = new Map<string, string>()
  for (const cita of vivas(citas)) {
    if (cita.fecha !== fecha || cita.tipo !== 'medica' || !cita.medico) continue
    textos.set(cita.medico.id, cita.hora ? `Cita a las ${cita.hora.slice(0, 5)}` : 'Ya tiene cita ese día')
  }
  return textos
}

// ---------------------------------------------------------------------------------------------
// Marcas del calendario
// ---------------------------------------------------------------------------------------------

/**
 * ¿Ese día libre impide agendar? El de día completo que la cuota ya cuenta como libre: aprobado, o registrado cuando no
 * se exige aprobación (decisión 41 de la 0840). Medio día, por aprobar, rechazado o anulado no.
 */
export function bloqueaAgendar(dia: Pick<DiaLibreItem, 'estado' | 'fraccion'>, requiereAprobacion: boolean): boolean {
  if (Number(dia.fraccion) !== 1) return false
  return dia.estado === 'aprobado' || (dia.estado === 'registrado' && !requiereAprobacion)
}

/**
 * Las marcas de los días: cuántas citas en pie tiene cada uno y el estado de su día libre (sin los anulados ni los
 * rechazados, que ya no son libres). Con `apagarLibres` (Agendar), el día libre que impide agendar queda apagado.
 */
export function marcasDelMes(
  citas: readonly Pick<CitaItem, 'fecha' | 'estado'>[],
  diasLibres: readonly Pick<DiaLibreItem, 'fecha' | 'estado' | 'fraccion'>[] = [],
  opciones: { apagarLibres?: boolean; requiereAprobacion?: boolean } = {}
): Record<string, MarcaDia> {
  const marcas: Record<string, MarcaDia> = {}
  for (const cita of vivas(citas)) {
    const marca = (marcas[cita.fecha] ??= {})
    marca.citas = (marca.citas ?? 0) + 1
  }
  for (const dia of diasLibres) {
    if (dia.estado === 'anulado' || dia.estado === 'rechazado') continue
    const marca = (marcas[dia.fecha] ??= {})
    // Si hay dos el mismo día, se marca el aprobado (el que manda).
    if (!marca.estadoLibre || dia.estado === 'aprobado') marca.estadoLibre = dia.estado
    if (opciones.apagarLibres && bloqueaAgendar(dia, opciones.requiereAprobacion ?? true)) marca.apagado = true
  }
  return marcas
}

/** Dónde va la línea "Ahora" en la línea del día: antes de la primera franja que aún no empieza (filas.length: al final). */
export function filaDeAhora(franjas: readonly string[], horaAhora: string): number {
  const indice = franjas.findIndex(f => minutosDe(f) > minutosDe(horaAhora))
  return indice === -1 ? franjas.length : indice
}
