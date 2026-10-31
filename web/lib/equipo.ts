/**
 * Equipo (Entrega 2 de docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): la lógica PURA de "dónde está
 * mi gente y cómo rinde", sin red ni base de datos. La usan /api/equipo/* (web/app/api/equipo/_lib/equipo-server.ts) y
 * las pruebas (scripts/equipo-check.ts).
 *
 * Reglas del dueño (2026-10-31):
 * - La dirección y el administrador ven a todas las personas de campo; cada líder se ve a sí misma y a los Ejecutivos
 *   Comerciales de sus líneas (A2: las líderes no se ven entre ellas). A quien lidera una línea y es Ejecutiva de otra
 *   (Paola), la líder de esa otra la ve SOLO como Ejecutiva (filas con executive_id).
 * - Dónde está cada persona sale de lo reportado y agendado, nunca del GPS en vivo (C5).
 * - Cumplimiento del plan: cada cadena de "otra fecha" cuenta UNA vez por su última cita.
 * - El reparto por línea: una visita que impulsó dos líneas cuenta en las dos.
 * - Las visitas de VMO no entran (eso lo filtra el servidor: solo source = 'app').
 */
import type { EstadoCita, EstadoVisible, MotivoCierre } from './agenda-ciclo'
import { estadoVisible } from './agenda-ciclo'
import { fechaBogota, type CasoUbicacion, type MarcaVisita, type Modalidad, type PapelEquipo } from './reporte-visitas'
import type { TipoVisita } from './visits-rules'

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

export type { PapelEquipo, CasoUbicacion }

/** Una persona de campo vista por Equipo (lo arma el servidor con users, executives, executive_lines y business_lines). */
export interface PersonaEquipo {
  userId: string
  nombre: string
  papel: PapelEquipo
  /** Su Ejecutivo Comercial activo (executives.id), o null (una líder sin él). */
  executiveId: string | null
  /** Zona base de ese Ejecutivo Comercial. */
  kamId: string | null
  zona: string | null
  /** Municipio (código DANE) de la Zona base: su calendario de ciudad. */
  municipio: string | null
  /** executive_lines de su Ejecutivo Comercial. */
  lineasEc: string[]
  /** Líneas activas que lidera. */
  lineasLider: string[]
  /** users.active y, con Ejecutivo Comercial, executives.status = 'active'. */
  activa: boolean
}

/** A quién ve una supervisora, y a quién solo como Ejecutiva Comercial. */
export interface AlcanceEquipo {
  personas: PersonaEquipo[]
  /** userIds que esta supervisora ve SOLO como Ejecutivo Comercial (filas con executive_id). */
  soloComoEjecutivo: Set<string>
}

/** Una visita de la app reducida a lo que Equipo necesita (nunca GPS, transcripción ni documento). */
export interface VisitaEquipo {
  id: string
  userId: string
  executiveId: string | null
  /** visit_date (Bogotá). */
  fecha: string
  checkedInAt: string
  tipo: TipoVisita
  modalidad: Modalidad
  efectiva: boolean
  motivoCodigo: string | null
  failureReason: string | null
  medicoId: string | null
  medicoNombre: string | null
  cuentaId: string | null
  cuentaNombre: string | null
  sedeId: string | null
  sedeNombre: string | null
  municipioId: string | null
  municipioNombre: string | null
  lineas: string[]
  agendaId: string | null
  agendada: boolean
  marcas: MarcaVisita[]
  /** El nombre que escribió la persona de un médico no listado, o null. */
  medicoNoListado: string | null
}

/** Una cita de la agenda reducida a lo que Equipo necesita. */
export interface CitaEquipo {
  id: string
  userId: string
  executiveId: string | null
  fecha: string
  hora: string | null
  createdAt: string
  tipo: TipoVisita
  estado: EstadoCita
  vieneDe: string | null
  visitaId: string | null
  motivoCodigo: MotivoCierre | null
  noRealizadaMotivo: string | null
  medicoId: string | null
  medicoNombre: string | null
  cuentaId: string | null
  cuentaNombre: string | null
  sedeId: string
  sedeNombre: string
  municipioId: string | null
  municipioNombre: string | null
}

// ---------------------------------------------------------------------------------------------
// Quién ve a quién
// ---------------------------------------------------------------------------------------------

const VE_A_TODOS = new Set(['admin', 'commercial_director'])

/**
 * Las personas que ve quien pregunta. La dirección y el administrador: todas las activas. Una líder: ella misma (entera)
 * y los Ejecutivos Comerciales activos con alguna de sus líneas; a quien además lidera otra línea (Paola para la líder
 * de Sustitutos) la ve solo como Ejecutiva. Los demás roles: nadie. Las inactivas no salen (quien ya no está sí sale
 * en Rendimiento, pero eso lo decide `rendimiento` con las filas del periodo).
 */
export function personasVisibles(
  quien: { id: string; role: string },
  personas: readonly PersonaEquipo[],
  lineasQueLidera: readonly string[]
): AlcanceEquipo {
  const activas = personas.filter(p => p.activa)
  if (VE_A_TODOS.has(quien.role)) return { personas: [...activas], soloComoEjecutivo: new Set() }
  if (quien.role !== 'line_leader') return { personas: [], soloComoEjecutivo: new Set() }
  const soloComoEjecutivo = new Set<string>()
  const visibles = activas.filter(p => {
    if (p.userId === quien.id) return true
    const esDeMisLineas = p.executiveId !== null && p.lineasEc.some(linea => lineasQueLidera.includes(linea))
    if (!esDeMisLineas) return false
    if (p.lineasLider.length > 0) soloComoEjecutivo.add(p.userId)
    return true
  })
  return { personas: visibles, soloComoEjecutivo }
}

/** Deja, de quien se ve solo como Ejecutiva, únicamente las filas con executive_id; lo de las demás, tal cual. */
export function soloComoEjecutivo<T extends { userId: string; executiveId: string | null }>(filas: readonly T[], alcance: AlcanceEquipo): T[] {
  return filas.filter(f => !alcance.soloComoEjecutivo.has(f.userId) || f.executiveId !== null)
}

// ---------------------------------------------------------------------------------------------
// Anticipación, cadenas de "otra fecha" y cumplimiento del plan
// ---------------------------------------------------------------------------------------------

const DIA_MS = 24 * 60 * 60 * 1000
const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS)

/** Días entre la fecha de la cita y la fecha en Bogotá de su created_at (≥ 0; una "otra fecha" mide desde la suya). */
export function anticipacionDias(cita: Pick<CitaEquipo, 'fecha' | 'createdAt'>): number {
  return Math.max(0, diasEntre(fechaBogota(cita.createdAt), cita.fecha))
}

/** Cadenas de "otra fecha": cada cadena de la primera a la última cita (por viene_de). Orden: por la primera cita. */
export function cadenasDeCitas(citas: readonly CitaEquipo[]): CitaEquipo[][] {
  const porId = new Map(citas.map(c => [c.id, c]))
  const sucesoraDe = new Map<string, CitaEquipo>()
  for (const c of citas) if (c.vieneDe && porId.has(c.vieneDe)) sucesoraDe.set(c.vieneDe, c)
  const primeras = citas.filter(c => !c.vieneDe || !porId.has(c.vieneDe))
  const ordenadas = [...primeras].sort((a, b) => (a.fecha === b.fecha ? (a.hora ?? '').localeCompare(b.hora ?? '') || a.id.localeCompare(b.id) : a.fecha.localeCompare(b.fecha)))
  return ordenadas.map(primera => {
    const cadena = [primera]
    const vistas = new Set([primera.id])
    let actual: CitaEquipo | undefined = sucesoraDe.get(primera.id)
    while (actual && !vistas.has(actual.id)) {
      cadena.push(actual)
      vistas.add(actual.id)
      actual = sucesoraDe.get(actual.id)
    }
    return cadena
  })
}

/**
 * Cumplimiento del plan de un periodo: las cadenas que tocan el periodo (alguna cita en [desde, hasta]), cada una por su
 * última cita REAL aunque esa quede fuera del periodo (una cita del 28 movida al 3 del mes siguiente aún no cuenta;
 * cerrada después del periodo, cuenta con ese resultado). `citas` trae las del periodo más sus orígenes y sucesoras.
 */
export function cumplimientoDelPlanEnPeriodo(citas: readonly CitaEquipo[], desde: string, hasta: string, hoy: string): CumplimientoPlan {
  let programadas = 0
  let cumplidas = 0
  for (const cadena of cadenasDeCitas(citas)) {
    if (!cadena.some(c => c.fecha >= desde && c.fecha <= hasta)) continue
    const ultima = cadena[cadena.length - 1]
    if (ultima.fecha > hoy || (ultima.fecha === hoy && ultima.estado === 'pendiente')) continue
    programadas++
    if (ultima.estado === 'hecha') cumplidas++
  }
  return { programadas, cumplidas, ratio: programadas === 0 ? null : cumplidas / programadas }
}

export interface CumplimientoPlan {
  programadas: number
  cumplidas: number
  ratio: number | null
}

/**
 * Cumplimiento del plan: cadenas cuya última cita ya se decidió: de un día anterior, o de hoy y cerrada. cumplidas =
 * última `hecha`. No se hizo, cancelada y pendiente vencida (de un día anterior) cuentan en el denominador. Una cadena
 * cuya última cita es futura, o pendiente de hoy (aún se puede reportar), no cuenta todavía.
 */
export function cumplimientoDelPlan(citas: readonly CitaEquipo[], hoy: string): CumplimientoPlan {
  let programadas = 0
  let cumplidas = 0
  for (const cadena of cadenasDeCitas(citas)) {
    const ultima = cadena[cadena.length - 1]
    if (ultima.fecha > hoy || (ultima.fecha === hoy && ultima.estado === 'pendiente')) continue
    programadas++
    if (ultima.estado === 'hecha') cumplidas++
  }
  return { programadas, cumplidas, ratio: programadas === 0 ? null : cumplidas / programadas }
}

export { estadoVisible }
export type { EstadoVisible }

// ---------------------------------------------------------------------------------------------
// Dónde está cada persona y el rastro del día
// ---------------------------------------------------------------------------------------------

const HORA_MS = 60 * 60 * 1000
const DESFASE_BOGOTA_MS = 5 * HORA_MS

/** 'HH:MM' en Bogotá de un instante ISO. */
export function horaBogota(iso: string): string {
  return new Date(Date.parse(iso) - DESFASE_BOGOTA_MS).toISOString().slice(11, 16)
}
const minutosDe = (hora: string): number => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))
const ordenHora = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b))


export interface Ubicacion {
  caso: CasoUbicacion
  /** Reportado / Planeado; null en los demás. */
  fuente: 'reportado' | 'planeado' | null
  hora: string | null
  sedeNombre: string | null
  municipioNombre: string | null
  /** Minutos desde el reporte (casos reportado*, solo para el día de hoy); null si no aplica. */
  haceMin: number | null
  marcas: MarcaVisita[]
}

/** Pasadas estas horas desde la última presencial, "Último reporte hace N h". */
export const HORAS_ULTIMO_REPORTE = 3
/** La cita "de ahora": de 30 min antes a 60 min después de su hora (como citaDeAhora en la app). */
export const VENTANA_CITA_DE_AHORA = { antesMin: 30, despuesMin: 60 } as const

const SIN_NADA: Ubicacion = { caso: 'sin_nada', fuente: null, hora: null, sedeNombre: null, municipioNombre: null, haceMin: null, marcas: [] }

/**
 * Dónde está la persona ese día (spec, Equipo › Hoy), el primer caso que se cumple: día libre aprobado; festivo sin
 * nada reportado; la última visita PRESENCIAL reportada ese día (las telefónicas no ubican), con "hace N min" solo si
 * es hoy; una cita pendiente de ahora (solo hoy); nada.
 */
export function dondeEsta(entrada: {
  fecha: string
  ahora: Date
  visitas: readonly VisitaEquipo[]
  citas: readonly CitaEquipo[]
  diaLibre: boolean
  festivo: boolean
}): Ubicacion {
  const { fecha, ahora } = entrada
  if (entrada.diaLibre) return { ...SIN_NADA, caso: 'dia_libre' }
  const delDia = entrada.visitas.filter(v => v.fecha === fecha)
  if (entrada.festivo && delDia.length === 0) return { ...SIN_NADA, caso: 'festivo' }
  const presenciales = delDia.filter(v => v.modalidad === 'presencial').sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt))
  const esHoy = fechaBogota(ahora) === fecha
  const ultima = presenciales[presenciales.length - 1]
  if (ultima) {
    const haceMin = esHoy ? Math.max(0, Math.round((ahora.getTime() - Date.parse(ultima.checkedInAt)) / 60000)) : null
    return {
      caso: haceMin !== null && haceMin > HORAS_ULTIMO_REPORTE * 60 ? 'reportado_hace_rato' : 'reportado',
      fuente: 'reportado',
      hora: horaBogota(ultima.checkedInAt),
      sedeNombre: ultima.sedeNombre,
      municipioNombre: ultima.municipioNombre,
      haceMin,
      marcas: [...ultima.marcas],
    }
  }
  if (esHoy) {
    const minutosAhora = minutosDe(horaBogota(ahora.toISOString()))
    const deAhora = entrada.citas
      .filter(c => c.fecha === fecha && c.estado === 'pendiente' && c.hora !== null)
      .filter(c => {
        const m = minutosDe(c.hora as string)
        // Como citaDeAhora en la app: la hora de la cita entre 30 min antes y 60 min después de ahora
        return m >= minutosAhora - VENTANA_CITA_DE_AHORA.antesMin && m <= minutosAhora + VENTANA_CITA_DE_AHORA.despuesMin
      })
      .sort((a, b) => ordenHora(a.hora, b.hora))[0]
    if (deAhora) return { caso: 'planeado', fuente: 'planeado', hora: deAhora.hora, sedeNombre: deAhora.sedeNombre, municipioNombre: deAhora.municipioNombre, haceMin: null, marcas: [] }
  }
  return SIN_NADA
}

export interface PasoRastro {
  hora: string | null
  tipo: TipoVisita
  modalidad: Modalidad | null
  /** El médico, la cuenta o el médico no listado. */
  conQuien: string | null
  sedeNombre: string | null
  municipioNombre: string | null
  /** De la cita (programada, atrasada, sin_cerrar, no_realizada, cancelada) o de la visita (hecha, no_efectiva). */
  estado: Exclude<EstadoVisible, 'eliminada'> | 'no_efectiva'
  /** Motivo de la no efectiva, del "no se hizo" o de la cancelación. */
  motivo: string | null
  /** Días de anticipación de la cita; null si la visita no tenía cita (no planeada). */
  anticipacionDias: number | null
  vieneDeFecha: string | null
  lineas: string[]
  marcas: MarcaVisita[]
  visitaId: string | null
  citaId: string | null
}

const conQuienDe = (x: { medicoNombre: string | null; cuentaNombre: string | null; medicoNoListado?: string | null }): string | null =>
  x.medicoNombre ?? x.cuentaNombre ?? x.medicoNoListado ?? null

/**
 * El rastro del día, por hora: cada cita de ese día (con su visita si la cumplió: una sola vez) y cada visita sin cita.
 * `citas` puede traer las de otros días (para "viene de la cita del …"); solo entran las del día. Sin hora al final.
 */
export function rastroDelDia(entrada: { fecha: string; ahora: Date; visitas: readonly VisitaEquipo[]; citas: readonly CitaEquipo[] }): PasoRastro[] {
  const porId = new Map(entrada.citas.map(c => [c.id, c]))
  const visitasPorId = new Map(entrada.visitas.map(v => [v.id, v]))
  const pasos: PasoRastro[] = []
  const visitasUsadas = new Set<string>()
  for (const c of entrada.citas) {
    if (c.fecha !== entrada.fecha || c.estado === 'eliminada') continue
    const v = c.visitaId ? visitasPorId.get(c.visitaId) : undefined
    if (v) visitasUsadas.add(v.id)
    const origen = c.vieneDe ? porId.get(c.vieneDe) : undefined
    const estado = (v ? (v.efectiva ? 'hecha' : 'no_efectiva') : estadoVisible(c, entrada.ahora)) as PasoRastro['estado']
    pasos.push({
      hora: c.hora ?? (v ? horaBogota(v.checkedInAt) : null),
      tipo: c.tipo,
      modalidad: v?.modalidad ?? null,
      conQuien: conQuienDe(v ?? c),
      sedeNombre: v?.sedeNombre ?? c.sedeNombre,
      municipioNombre: v?.municipioNombre ?? c.municipioNombre,
      estado,
      motivo: v ? (v.efectiva ? null : (v.motivoCodigo ?? v.failureReason)) : c.motivoCodigo,
      anticipacionDias: anticipacionDias(c),
      vieneDeFecha: origen?.fecha ?? null,
      lineas: v ? [...v.lineas] : [],
      marcas: v ? [...v.marcas] : [],
      visitaId: v?.id ?? null,
      citaId: c.id,
    })
  }
  for (const v of entrada.visitas) {
    if (v.fecha !== entrada.fecha || visitasUsadas.has(v.id)) continue
    pasos.push({
      hora: horaBogota(v.checkedInAt),
      tipo: v.tipo,
      modalidad: v.modalidad,
      conQuien: conQuienDe(v),
      sedeNombre: v.sedeNombre,
      municipioNombre: v.municipioNombre,
      estado: v.efectiva ? 'hecha' : 'no_efectiva',
      motivo: v.efectiva ? null : (v.motivoCodigo ?? v.failureReason),
      anticipacionDias: null,
      vieneDeFecha: null,
      lineas: [...v.lineas],
      marcas: [...v.marcas],
      visitaId: v.id,
      citaId: null,
    })
  }
  return pasos.sort((a, b) => ordenHora(a.hora, b.hora))
}

/** "Cartagena 2 · Bogotá 6 · Sin reporte ni plan 3": personas por municipio de su ubicación; sin nada, aparte. */
export function resumenPorCiudad(ubicaciones: readonly Ubicacion[]): { ciudades: Array<{ nombre: string; personas: number }>; sinNada: number } {
  const porCiudad = new Map<string, number>()
  let sinNada = 0
  for (const u of ubicaciones) {
    if (u.caso === 'sin_nada') sinNada++
    else if (u.municipioNombre && (u.caso === 'reportado' || u.caso === 'reportado_hace_rato' || u.caso === 'planeado')) {
      porCiudad.set(u.municipioNombre, (porCiudad.get(u.municipioNombre) ?? 0) + 1)
    }
  }
  const ciudades = [...porCiudad.entries()].map(([nombre, personas]) => ({ nombre, personas })).sort((a, b) => b.personas - a.personas || a.nombre.localeCompare(b.nombre, 'es'))
  return { ciudades, sinNada }
}

// ---------------------------------------------------------------------------------------------
// Rendimiento del periodo
// ---------------------------------------------------------------------------------------------

/** Una cita planeada "con tiempo": 7 días o más de anticipación (A5). */
export const DIAS_CON_TIEMPO = 7

/** ¿El periodo es exactamente un mes calendario (del 1 al último día)? Solo entonces se muestra la cuota. */
export function esMesCompleto(desde: string, hasta: string): boolean {
  if (desde.slice(0, 7) !== hasta.slice(0, 7) || desde.slice(8) !== '01') return false
  const [anio, mes] = desde.split('-').map(Number)
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return Number(hasta.slice(8)) === ultimo
}

export interface Cifras {
  hechas: number
  efectivas: number
  noEfectivas: number
  noEfectivasPorMotivo: Record<string, number>
  noSeHizo: number
  noSeHizoPorMotivo: Record<string, number>
  canceladas: number
  canceladasPorMotivo: Record<string, number>
  sinCerrar: number
  programadas: number
  telefonicas: number
  cumplimientoPlan: CumplimientoPlan
  anticipacion: { medianaDias: number | null; pctConTiempo: number | null; pctMismoDia: number | null; noPlaneadas: number }
  medicosDistintos: number
  ciudadesDistintas: number
  porLinea: { lineas: Array<{ lineId: string; hechas: number }>; sumaSuperaHechas: boolean }
}

export interface CuotaResumen {
  medica: { cuota: number; hechas: number; cumplimiento: number | null }
  institucional: { cuota: number; hechas: number; cumplimiento: number | null }
}

export interface FilaRendimiento extends Cifras {
  persona: PersonaEquipo
  /** Tuvo filas en el periodo y hoy está inactiva o traspasada. */
  yaNoEsta: boolean
  diasHabilesSinVisitas: number | null
  /** Solo con Ejecutivo Comercial y periodo de un mes completo (lo calcula el servidor). */
  cuota: CuotaResumen | null
}

const sumar = (mapa: Record<string, number>, clave: string | null | undefined, porDefecto = 'sin_motivo') => {
  const k = clave ?? porDefecto
  mapa[k] = (mapa[k] ?? 0) + 1
}
const mediana = (valores: readonly number[]): number | null => {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 === 1 ? v[m] : (v[m - 1] + v[m]) / 2
}
const porcentaje = (parte: number, total: number): number | null => (total === 0 ? null : Math.round((parte / total) * 100))

/** Las cifras de un conjunto de visitas y citas (de una persona o de todo el equipo). */
function cifrasDe(visitas: readonly VisitaEquipo[], citas: readonly CitaEquipo[], cumplimiento: { plan: CumplimientoPlan; ahora: Date }): Cifras {
  const noEfectivasPorMotivo: Record<string, number> = {}
  const noSeHizoPorMotivo: Record<string, number> = {}
  const canceladasPorMotivo: Record<string, number> = {}
  let efectivas = 0
  let telefonicas = 0
  const medicos = new Set<string>()
  const ciudades = new Set<string>()
  const porLinea = new Map<string, number>()
  for (const v of visitas) {
    if (v.efectiva) efectivas++
    else sumar(noEfectivasPorMotivo, v.motivoCodigo ?? v.failureReason)
    if (v.modalidad === 'telefonica') telefonicas++
    if (v.efectiva && v.medicoId) medicos.add(v.medicoId)
    if (v.modalidad === 'presencial' && v.municipioId) ciudades.add(v.municipioId)
    for (const linea of v.lineas) porLinea.set(linea, (porLinea.get(linea) ?? 0) + 1)
  }
  let noSeHizo = 0
  let canceladas = 0
  let sinCerrar = 0
  let programadas = 0
  const anticipaciones: number[] = []
  for (const c of citas) {
    if (c.estado === 'eliminada') continue
    anticipaciones.push(anticipacionDias(c))
    // (el estado visible de una pendiente se decide con `ahora`, que llega en cumplimiento.ahora)
    if (c.estado === 'no_realizada') {
      noSeHizo++
      sumar(noSeHizoPorMotivo, c.motivoCodigo)
    } else if (c.estado === 'cancelada') {
      canceladas++
      sumar(canceladasPorMotivo, c.motivoCodigo)
    } else if (c.estado === 'pendiente') {
      if (estadoVisible(c, cumplimiento.ahora) === 'programada') programadas++
      else sinCerrar++
    }
  }
  const noPlaneadas = visitas.filter(v => !v.agendaId).length
  const lineas = [...porLinea.entries()].map(([lineId, hechas]) => ({ lineId, hechas })).sort((a, b) => b.hechas - a.hechas || a.lineId.localeCompare(b.lineId))
  const sumaLineas = lineas.reduce((s, l) => s + l.hechas, 0)
  return {
    hechas: visitas.length,
    efectivas,
    noEfectivas: visitas.length - efectivas,
    noEfectivasPorMotivo,
    noSeHizo,
    noSeHizoPorMotivo,
    canceladas,
    canceladasPorMotivo,
    sinCerrar,
    programadas,
    telefonicas,
    cumplimientoPlan: cumplimiento.plan,
    anticipacion: {
      // Lo reportado sin cita es "no planeado": entra en los porcentajes y no en la mediana (spec)
      medianaDias: mediana(anticipaciones),
      pctConTiempo: porcentaje(anticipaciones.filter(d => d >= DIAS_CON_TIEMPO).length, anticipaciones.length + noPlaneadas),
      pctMismoDia: porcentaje(anticipaciones.filter(d => d === 0).length, anticipaciones.length + noPlaneadas),
      noPlaneadas,
    },
    medicosDistintos: medicos.size,
    ciudadesDistintas: ciudades.size,
    porLinea: { lineas, sumaSuperaHechas: sumaLineas > visitas.length },
  }
}

const ordenFilas = (a: FilaRendimiento, b: FilaRendimiento): number => {
  const ra = a.cumplimientoPlan.ratio
  const rb = b.cumplimientoPlan.ratio
  if (ra !== rb) {
    if (ra === null) return 1
    if (rb === null) return -1
    return ra - rb
  }
  return a.persona.nombre.localeCompare(b.persona.nombre, 'es')
}

/**
 * Rendimiento del periodo: una fila por persona visible (con ceros si no tuvo nada) y por quien ya no está pero tuvo
 * filas en el periodo (`yaNoEsta`); las tarjetas del equipo suman las filas de todas, con médicos y ciudades DISTINTOS
 * (no la suma). Quien se ve solo como Ejecutiva aporta solo sus filas con executive_id. Las filas de fuera del periodo
 * no cuentan. Orden: cumplimiento del plan ascendente (null al final), luego nombre.
 */
export function rendimiento(entrada: {
  personas: readonly PersonaEquipo[]
  alcance: AlcanceEquipo
  visitas: readonly VisitaEquipo[]
  citas: readonly CitaEquipo[]
  desde: string
  hasta: string
  hoy: string
  ahora: Date
  diasHabilesSinVisitas: ReadonlyMap<string, number | null>
  cuotas: ReadonlyMap<string, CuotaResumen | null>
}): { equipo: Cifras; porPersona: FilaRendimiento[] } {
  const enPeriodo = (fecha: string) => fecha >= entrada.desde && fecha <= entrada.hasta
  const visitas = soloComoEjecutivo(entrada.visitas.filter(v => enPeriodo(v.fecha)), entrada.alcance)
  // `entrada.citas` puede traer orígenes y sucesoras de fuera del periodo: cuentan solo para el cumplimiento del plan
  const citasTodas = soloComoEjecutivo(entrada.citas.filter(c => c.estado !== 'eliminada'), entrada.alcance)
  const citas = citasTodas.filter(c => enPeriodo(c.fecha))
  const conFilas = new Set([...visitas.map(v => v.userId), ...citas.map(c => c.userId)])
  const cumplimientoDe = (filtro: (c: CitaEquipo) => boolean) => ({ plan: cumplimientoDelPlanEnPeriodo(citasTodas.filter(filtro), entrada.desde, entrada.hasta, entrada.hoy), ahora: entrada.ahora })
  const visibles = new Set(entrada.alcance.personas.map(p => p.userId))
  const incluidas = entrada.personas.filter(p => visibles.has(p.userId) || (!p.activa && conFilas.has(p.userId)))
  const porPersona = incluidas
    .map(persona => {
      const suyas = visitas.filter(v => v.userId === persona.userId)
      const citasSuyas = citas.filter(c => c.userId === persona.userId)
      return {
        ...cifrasDe(suyas, citasSuyas, cumplimientoDe(c => c.userId === persona.userId)),
        persona,
        yaNoEsta: !persona.activa && conFilas.has(persona.userId),
        diasHabilesSinVisitas: entrada.diasHabilesSinVisitas.get(persona.userId) ?? null,
        cuota: entrada.cuotas.get(persona.userId) ?? null,
      }
    })
    .sort(ordenFilas)
  const ids = new Set(incluidas.map(p => p.userId))
  const equipo = cifrasDe(visitas.filter(v => ids.has(v.userId)), citas.filter(c => ids.has(c.userId)), cumplimientoDe(c => ids.has(c.userId)))
  return { equipo, porPersona }
}
