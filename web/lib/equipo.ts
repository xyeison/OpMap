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
import { fechaBogota, type MarcaVisita, type Modalidad } from './reporte-visitas'
import type { TipoVisita } from './visits-rules'

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

export type PapelEquipo = 'lider' | 'ejecutivo' | 'lider_y_ejecutivo'

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

export interface CumplimientoPlan {
  programadas: number
  cumplidas: number
  ratio: number | null
}

/**
 * Cumplimiento del plan: cadenas cuya última cita tiene fecha ≤ hoy; cumplidas = última `hecha`. No se hizo, cancelada
 * y pendiente vencida cuentan en el denominador. Una cadena cuya última cita es futura aún no cuenta.
 */
export function cumplimientoDelPlan(citas: readonly CitaEquipo[], hoy: string): CumplimientoPlan {
  let programadas = 0
  let cumplidas = 0
  for (const cadena of cadenasDeCitas(citas)) {
    const ultima = cadena[cadena.length - 1]
    if (ultima.fecha > hoy) continue
    programadas++
    if (ultima.estado === 'hecha') cumplidas++
  }
  return { programadas, cumplidas, ratio: programadas === 0 ? null : cumplidas / programadas }
}

export { estadoVisible }
export type { EstadoVisible }
