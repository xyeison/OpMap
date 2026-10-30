/**
 * Reglas y textos puros de Hoy, Días libres, Números, Visita, Nueva sede, Nuevo médico e Ingreso (spec
 * 2026-10-15-usabilidad-y-agenda-con-hora, paquete 5). Sin React Native: los prueba scripts/checks/19-pantallas.ts
 * en Node.
 */
import { FRESCURA_SIN_PEDIR_MS } from './contexto-memoria'
import { hoyBogota, horaBogota, puedeRegistrarDiaLibre, sumarDias } from './fechas'
import { textoPrecision } from './geo'
import { conQuienCita, numeroTexto, pareceCorreo } from './reglas'
import type { CitaItem, DiaLibreItem, EstadoDiaLibre } from './tipos'

// ---------------------------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------------------------

/**
 * ¿Hoy vuelve a pedir al recibir el foco? Sí si nunca cargó, si hubo una invalidación (visita guardada, cita agendada o
 * cancelada, día libre, cierre de sesión) o se tiró para actualizar (`invalidado`), si pasaron FRESCURA_SIN_PEDIR_MS
 * (60 s) desde la última carga, si cambió el día en Bogotá o si el reloj del teléfono volvió atrás. Antes de 60 s, no.
 */
export function debeRecargarHoy(ultima: number | null, ahora: number, invalidado: boolean): boolean {
  if (invalidado || ultima === null || !Number.isFinite(ultima)) return true
  if (ahora < ultima) return true
  if (hoyBogota(new Date(ultima)) !== hoyBogota(new Date(ahora))) return true
  return ahora - ultima >= FRESCURA_SIN_PEDIR_MS
}

/** Ventana de la cita "de ahora": de 30 min antes a 60 min después de su hora. */
export const CITA_DE_AHORA_ANTES_MIN = 30
export const CITA_DE_AHORA_DESPUES_MIN = 60

type CitaHoy = Pick<CitaItem, 'id' | 'fecha' | 'hora' | 'estado' | 'tipo' | 'medico' | 'cuenta' | 'subtipo'>

/** Minutos desde la medianoche de "HH:MM" (o "HH:MM:SS"); null si no es una hora. */
function minutosDe(hora: string | null | undefined): number | null {
  if (!hora) return null
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora.trim())
  if (!partes) return null
  const h = Number(partes[1])
  const m = Number(partes[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Minutos que faltan para la cita (negativo: ya pasó su hora), en Bogotá; null si no es de hoy o no tiene hora. */
function minutosHasta(cita: Pick<CitaItem, 'fecha' | 'hora'>, ahora: Date): number | null {
  const deCita = minutosDe(cita.hora)
  if (deCita === null || cita.fecha !== hoyBogota(ahora)) return null
  const deAhora = minutosDe(horaBogota(ahora))
  return deAhora === null ? null : deCita - deAhora
}

/**
 * La cita "de ahora": la pendiente de hoy con hora entre 30 min antes y 60 min después de este momento. Si hay varias,
 * la de hora más temprana (la que ya debería estar pasando); sin hora, hechas y canceladas no cuentan.
 */
export function citaDeAhora<T extends CitaHoy>(citas: readonly T[], ahora: Date): T | null {
  let elegida: { cita: T; minutos: number } | null = null
  for (const cita of citas) {
    if (cita.estado !== 'pendiente') continue
    const minutos = minutosHasta(cita, ahora)
    if (minutos === null || minutos < -CITA_DE_AHORA_ANTES_MIN || minutos > CITA_DE_AHORA_DESPUES_MIN) continue
    if (!elegida || minutos < elegida.minutos || (minutos === elegida.minutos && conQuienCita(cita).localeCompare(conQuienCita(elegida.cita), 'es') < 0)) {
      elegida = { cita, minutos }
    }
  }
  return elegida?.cita ?? null
}

/** "Siguiente: 10:30 · Dra. Gómez (en 25 min)", "(ahora)" o "(hace 10 min)". */
export function textoSiguienteCita(cita: CitaHoy, ahora: Date): string {
  const minutos = minutosHasta(cita, ahora)
  const hora = cita.hora ? cita.hora.slice(0, 5) : 'Sin hora'
  const cuando = minutos === null ? '' : minutos > 0 ? ` (en ${minutos} min)` : minutos === 0 ? ' (ahora)' : ` (hace ${-minutos} min)`
  return `Siguiente: ${hora} · ${conQuienCita(cita)}${cuando}`
}

/** ¿Pendiente de hoy y ya pasó su hora? (lleva "Atrasada"). Sin hora, hechas y canceladas, no. */
export function citaAtrasada(cita: Pick<CitaItem, 'fecha' | 'hora' | 'estado'>, ahora: Date): boolean {
  if (cita.estado !== 'pendiente') return false
  const minutos = minutosHasta(cita, ahora)
  return minutos !== null && minutos < 0
}

/** Cuántas citas de "¿Qué pasó con esto?" se ven antes de "Ver todas" (con 19 sin cerrar, Hoy no debe ser una lista). */
export const MAX_POR_CERRAR_VISIBLES = 4

/**
 * "¿Qué pasó con esto?" de Hoy (F1b; C6 de la spec de actividades de campo): lo programado que no se cerró solo y espera
 * su resultado. Las pendientes de días anteriores ("Sin cerrar") y las de hoy cuya hora ya pasó ("Atrasada"), salvo la
 * cita "de ahora" (`deAhora`: de 30 min antes a 60 min después de su hora), que sigue en "Siguiente" para reportarla:
 * así ninguna cita sale dos veces en Hoy. Orden: hoy primero, después de la más reciente a la más vieja; cada día por
 * hora (las sin hora al final). Las hechas, canceladas, que no se hicieron y de mañana no entran.
 */
export function porCerrar<T extends Pick<CitaItem, 'id' | 'fecha' | 'hora' | 'estado'>>(citas: readonly T[], ahora: Date, deAhora: string | null = null): T[] {
  const hoy = hoyBogota(ahora)
  const vistas = new Set<string>()
  return citas
    .filter(cita => {
      if (cita.estado !== 'pendiente' || cita.id === deAhora || vistas.has(cita.id)) return false
      vistas.add(cita.id)
      return cita.fecha < hoy || citaAtrasada(cita, ahora)
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** "Ubicación tomada · ±12 m" (y "(aproximada)" si es la aproximada); sin precisión, "Ubicación tomada". */
export function textoUbicacionTomada(precision: number | null | undefined, aproximada = false): string {
  const texto = textoPrecision(precision)
  return `Ubicación tomada${texto ? ` · ${texto}` : ''}${aproximada ? ' (aproximada)' : ''}`
}

// ---------------------------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------------------------

const NOMBRES_TIPO = {
  medica: { singular: 'visita médica', plural: 'visitas médicas' },
  institucional: { singular: 'visita institucional', plural: 'visitas institucionales' },
} as const

/**
 * Los días hábiles que quedan DESPUÉS de hoy sin los días libres que vienen (revisión 2026-10-15): el
 * dias_habiles_por_delante del servidor. Un servidor anterior no lo manda: entonces, sin días libres en el mes, son
 * dias_habiles − dias_habiles_transcurridos (exacto); con días libres no se sabe cuáles vienen → null (no se muestra
 * "Te faltan …" con una cifra que cuenta los días libres como días para visitar).
 */
export function diasPorDelante(cuota: { dias_habiles: number; dias_habiles_transcurridos: number; dias_libres: number; dias_habiles_por_delante?: number | null }): number | null {
  if (typeof cuota.dias_habiles_por_delante === 'number' && Number.isFinite(cuota.dias_habiles_por_delante)) return cuota.dias_habiles_por_delante
  if (cuota.dias_libres !== 0) return null
  const quedan = cuota.dias_habiles - cuota.dias_habiles_transcurridos
  return Number.isFinite(quedan) ? Math.round(quedan * 100) / 100 : null
}

/**
 * "Te faltan 62 visitas médicas: 7 por día en los 10 días hábiles que quedan". Lo que falta es la cuota menos lo hecho
 * (hacia arriba) y se reparte en los días hábiles que quedan después de hoy SIN los días libres (diasPorDelante),
 * también hacia arriba. null si no se puede calcular (números no válidos, sin cuota, sin días por delante) o si ya no
 * falta nada. No dice "por día hábil" a secas: esa frase es la de la meta de hoy, justo debajo.
 */
export function faltanVisitas(
  cuota: number | null | undefined,
  hechas: number | null | undefined,
  porDelante: number | null | undefined,
  tipo: keyof typeof NOMBRES_TIPO = 'medica'
): string | null {
  const numeros = [cuota, hechas, porDelante]
  if (!numeros.every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const [c, h, d] = numeros as number[]
  if (c <= 0 || h < 0) return null
  const faltan = Math.ceil(Math.round((c - h) * 100) / 100)
  const quedan = Math.round(d * 100) / 100
  if (faltan <= 0 || quedan <= 0) return null
  const porDia = Math.ceil(faltan / quedan)
  const nombre = NOMBRES_TIPO[tipo]
  const dias = quedan === 1 ? 'el día hábil que queda' : `los ${numeroTexto(quedan)} días hábiles que quedan`
  return `${faltan === 1 ? 'Te falta' : 'Te faltan'} ${numeroTexto(faltan)} ${faltan === 1 ? nombre.singular : nombre.plural}: ${numeroTexto(porDia)} por día en ${dias}`
}

// ---------------------------------------------------------------------------------------------
// Días libres
// ---------------------------------------------------------------------------------------------

/** Lo que el calendario pinta en un día (cabe en MarcaDia de components/agenda/CalendarioMes). */
export interface MarcaDiaLibre {
  estadoLibre: EstadoDiaLibre
}

/**
 * Estados que el calendario marca, con su prioridad si un día tiene varios registros. Anulado y rechazado no son días
 * libres: no se marcan (siguen en la lista de abajo con su insignia).
 */
const PRIORIDAD_ESTADO: Partial<Record<EstadoDiaLibre, number>> = { aprobado: 3, registrado: 2, por_aprobar: 1 }

/** Los días libres vigentes por fecha para el calendario (aprobado, registrado o por aprobar), cada día con el que manda. */
export function marcasDiasLibres(items: readonly Pick<DiaLibreItem, 'fecha' | 'estado'>[]): Record<string, MarcaDiaLibre> {
  const marcas: Record<string, MarcaDiaLibre> = {}
  for (const item of items) {
    const prioridad = PRIORIDAD_ESTADO[item.estado]
    if (prioridad === undefined) continue
    const actual = marcas[item.fecha]
    if (!actual || prioridad > (PRIORIDAD_ESTADO[actual.estadoLibre] ?? 0)) marcas[item.fecha] = { estadoLibre: item.estado }
  }
  return marcas
}

/**
 * Las marcas de Días libres con las citas en pie de cada día (revisión 2026-10-15: así se ve que el día que se va a pedir
 * libre tiene citas). Las canceladas y las que no se hicieron no cuentan.
 */
export function marcasConCitas(
  libres: Readonly<Record<string, MarcaDiaLibre>>,
  citas: readonly Pick<CitaItem, 'fecha' | 'estado'>[]
): Record<string, { estadoLibre?: EstadoDiaLibre; citas?: number }> {
  const marcas: Record<string, { estadoLibre?: EstadoDiaLibre; citas?: number }> = {}
  for (const [fecha, marca] of Object.entries(libres)) marcas[fecha] = { ...marca }
  for (const cita of citas) {
    if (cita.estado !== 'pendiente' && cita.estado !== 'hecha') continue
    const marca = (marcas[cita.fecha] ??= {})
    marca.citas = (marca.citas ?? 0) + 1
  }
  return marcas
}

/**
 * Si el día que se va a pedir libre tiene citas pendientes: "Ese día tienes 2 citas pendientes (09:30 Dra. X · 10:00
 * Clínica Y): cancélalas o agéndalas otro día en Mi agenda." (como mucho 3 nombradas, "y N más"). null si no tiene.
 */
export function avisoCitasEnDiaLibre(fecha: string, citas: readonly Pick<CitaItem, 'id' | 'fecha' | 'hora' | 'estado' | 'tipo' | 'medico' | 'cuenta' | 'subtipo'>[]): string | null {
  const delDia = citas
    .filter(c => c.fecha === fecha && c.estado === 'pendiente')
    .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || (a.id < b.id ? -1 : 1))
  if (delDia.length === 0) return null
  // Como mucho 3 nombradas (y "y N más"): con un día lleno, el aviso no debe ser un párrafo.
  const nombradas = delDia.slice(0, 3).map(c => `${c.hora ? c.hora.slice(0, 5) : 'sin hora'} ${conQuienCita(c)}`).join(' · ')
  const lista = delDia.length > 3 ? `${nombradas} y ${delDia.length - 3} más` : nombradas
  return delDia.length === 1
    ? `Ese día tienes 1 cita pendiente (${lista}): cancélala o agéndala otro día en Mi agenda.`
    : `Ese día tienes ${delDia.length} citas pendientes (${lista}): cancélalas o agéndalas otro día en Mi agenda.`
}

/** El primer día que todavía se puede registrar con ese plazo (hoy si ya no se puede ninguno anterior). */
export function primerDiaRegistrable(hoy: string, plazoHoras: number, ahora: Date = new Date()): string {
  let fecha = hoy
  for (let i = 1; i <= 31; i++) {
    const anterior = sumarDias(hoy, -i)
    if (!puedeRegistrarDiaLibre(anterior, plazoHoras, ahora)) break
    fecha = anterior
  }
  return fecha
}

// ---------------------------------------------------------------------------------------------
// Nuevo médico e Ingreso
// ---------------------------------------------------------------------------------------------

export type CampoMedico = 'documento' | 'nombre' | 'ciudad' | 'especialidad' | 'sedes'

/**
 * Los errores de Nuevo médico, cada uno junto a su campo (todos a la vez). Al verificar: documento, nombre y ciudad;
 * al crear, además, especialidad y sedes. Mismos textos que antes.
 */
export function erroresNuevoMedico(
  datos: { errorDocumento: string | null; nombre: string; municipio: string | null; especialidades: number; sedes: number },
  paso: 'verificar' | 'crear'
): Partial<Record<CampoMedico, string>> {
  const errores: Partial<Record<CampoMedico, string>> = {}
  if (datos.errorDocumento) errores.documento = datos.errorDocumento
  if (datos.nombre.trim().length < 3) errores.nombre = 'Escribe el nombre completo del médico'
  if (!datos.municipio) errores.ciudad = 'Elige la ciudad del médico'
  if (paso === 'crear') {
    if (datos.especialidades === 0) errores.especialidad = 'Elige al menos una especialidad'
    if (datos.sedes === 0) errores.sedes = 'Elige al menos una sede donde atiende'
  }
  return errores
}

/** Lo que le falta a "Entrar", campo por campo (null: está bien). */
export function faltaParaEntrar(correo: string, contrasena: string): { correo: string | null; contrasena: string | null } {
  const limpio = correo.trim()
  return {
    correo: !limpio ? 'Escribe tu correo' : pareceCorreo(limpio) ? null : 'Revisa el correo: va como nombre@empresa.com',
    contrasena: contrasena.length === 0 ? 'Escribe tu contraseña' : null,
  }
}
