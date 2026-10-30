/**
 * Actividades de campo · F1a (migración 0850): quién es quién — lógica PURA (sin red ni base de datos), espejo de
 * persona_lineas, persona_de_campo, ejecutivo_de_la_visita y medico_de_lineas. La usan la API (requirePersonaDeCampo,
 * /api/me/**, /api/auth/me), las pruebas (scripts/persona-campo-check.ts) y, en F4, /equipo.
 * Spec: docs/specs/2026-10-15-actividades-de-campo.md ("Quién es quién", A1, A2, C1, C9 y C12).
 *
 * Persona de campo: usuario activo que no es commercial_director (A1) con al menos una línea para reportar = las
 * executive_lines de su Ejecutivo Comercial ACTIVO ∪ las líneas activas que lidera (business_lines.leader_user_id).
 * Quien hace la visita o la cita es el USUARIO; el Ejecutivo Comercial es opcional (C1): el de una visita es el suyo
 * solo si alguna línea de la visita está en sus executive_lines; si no, la visita es "como líder" (sin zona).
 */
import type { Role } from './permissions'
import { MENSAJE_SIN_EJECUTIVA } from './visits-rules'

// ---------------------------------------------------------------------------------------------
// Mensajes (los mismos que lanzan las funciones de la 0850)
// ---------------------------------------------------------------------------------------------

/** 403 de /api/me/* y 23514 de la base para un usuario sin líneas (p. ej. un sales_manager sin Ejecutivo Comercial). */
export const MENSAJE_SIN_LINEAS = 'Tu usuario no tiene líneas para reportar'
/** 403 de /api/me/* y 23514 de la base para la dirección comercial (A1: no agenda ni reporta; vigila). */
export const MENSAJE_DIRECCION_NO_REPORTA = 'La dirección comercial no agenda ni reporta: sigue a tu equipo en Equipo'
/** Una línea de la visita que no es de la persona (el mismo texto que la 0830). */
export const MENSAJE_LINEA_AJENA = 'Alguna de las líneas no es tuya'
/** Como líder, un médico que no es de sus líneas (C9). */
export const MENSAJE_MEDICO_AJENO = 'Ese médico no es de tus líneas'
/** Ejecutivo Comercial activo sin zona base (el mismo texto que la 0830). */
export const MENSAJE_SIN_ZONA = 'Tu Ejecutivo Comercial no tiene zona base'
/** Agendar "como líder" sin liderar ninguna línea. */
export const MENSAJE_SIN_LINEAS_LIDER = 'No lideras ninguna línea: agenda como Ejecutivo Comercial'
/** La API mandó un Ejecutivo Comercial que no es el de la persona. */
export const MENSAJE_EJECUTIVA_AJENA = 'Ese Ejecutivo Comercial no es el tuyo'
/** Corregir las líneas de una visita de forma que cambie su papel (como líder ↔ como Ejecutivo Comercial). */
export const MENSAJE_CAMBIO_DE_PAPEL =
  'Para cambiar el papel de la visita (como líder o como Ejecutivo Comercial), anúlala y repórtala de nuevo'
/** Una visita que trae una cita del otro papel. */
export const MENSAJE_CITA_OTRO_PAPEL = 'Esa cita es de tu otro papel (como líder o como Ejecutivo Comercial)'
/** `como` que no es ni 'ejecutivo' ni 'lider' (22023). */
export const MENSAJE_COMO_NO_VALIDO = 'Como no válido: ejecutivo o lider'
/**
 * La app de campo es solo para las líderes (dueño, 2026-10-30): quien solo es Ejecutivo Comercial registra sus visitas
 * en VMO, que llegan al mapa con el importador de /visits. 403 de /api/me/* y `sin_persona` de /api/auth/me.
 */
export const MENSAJE_EJECUTIVO_EN_VMO = 'Las visitas de los Ejecutivos Comerciales se registran en VMO'

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

/** Papel de la persona de campo. */
export type RolPersona = 'ejecutivo' | 'lider' | 'lider_y_ejecutivo'
/** "Como qué" se agenda o se reporta (C12). */
export type ComoPersona = 'ejecutivo' | 'lider'
export const VALORES_COMO = ['ejecutivo', 'lider'] as const satisfies readonly ComoPersona[]

export interface UsuarioCampo {
  id: string
  role: Role | string
  /** users.active (NULL cuenta como inactivo). */
  active: boolean | null
}

/** El Ejecutivo Comercial enlazado con el usuario (executives.user_id es único), si lo hay. */
export interface EjecutivaCampo {
  id: string
  status: 'active' | 'placeholder' | 'inactive' | string
  base_kam_id: string | null
}

/** Una línea de negocio con lo que mira la persona (activa y quién la lidera). */
export interface LineaCampo {
  id: string
  active: boolean
  leader_user_id: string | null
}

/** La persona de campo (espejo del jsonb de persona_de_campo). */
export interface PersonaCampoPura {
  userId: string
  rol: RolPersona
  /** Su Ejecutivo Comercial ACTIVO, o null. */
  executiveId: string | null
  /** La zona base de ese Ejecutivo Comercial, o null. */
  kamId: string | null
  /** executive_lines de su Ejecutivo Comercial activo, ordenadas. */
  lineasEc: string[]
  /** Líneas activas que lidera, ordenadas. */
  lineasLider: string[]
  /** La unión, ordenada (persona_lineas). */
  lineas: string[]
}

export type ResultadoPersona = { ok: true; persona: PersonaCampoPura } | { ok: false; error: string }

const ordenadas = (ids: Iterable<string>): string[] => Array.from(new Set(ids)).sort()

// ---------------------------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------------------------

/**
 * Espejo de persona_lineas: las líneas con las que la persona reporta y agenda. Vacías si el usuario está inactivo o es
 * commercial_director (A1). `lineasEjecutiva`: las executive_lines de SU Ejecutivo Comercial (solo cuentan si está
 * activo); `lineas`: las líneas de negocio (las que lidera, si están activas).
 */
export function lineasParaReportar(entrada: {
  usuario: UsuarioCampo
  ejecutiva: EjecutivaCampo | null
  lineasEjecutiva: readonly string[]
  lineas: readonly LineaCampo[]
}): { ec: string[]; lider: string[]; todas: string[] } {
  const { usuario } = entrada
  if (usuario.active !== true || usuario.role === 'commercial_director') return { ec: [], lider: [], todas: [] }
  const ec = entrada.ejecutiva && entrada.ejecutiva.status === 'active' ? ordenadas(entrada.lineasEjecutiva) : []
  const lider = ordenadas(entrada.lineas.filter(linea => linea.active && linea.leader_user_id === usuario.id).map(linea => linea.id))
  return { ec, lider, todas: ordenadas([...ec, ...lider]) }
}

/**
 * ¿La app de campo es solo para las líderes? Sí (dueño, 2026-10-30, docs/decisiones/2026-10-30-app-de-campo-solo-lideres.md):
 * los Ejecutivos Comerciales siguen en VMO. Con APP_CAMPO_EJECUTIVOS=true la vuelven a usar como antes (las pruebas de
 * F3 y F4, y el día en que la app reemplace a VMO). Recibe el entorno: este archivo también se importa en el navegador.
 */
export function appSoloLideres(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.APP_CAMPO_EJECUTIVOS?.trim().toLowerCase() !== 'true'
}

/**
 * Las líneas con las que la persona usa la app (sobre lo que da lineasParaReportar). Con la app solo para líderes,
 * quien solo tiene líneas de Ejecutivo Comercial → MENSAJE_EJECUTIVO_EN_VMO, y quien tiene los dos papeles (Paola)
 * entra solo como líder: sin su Ejecutivo Comercial, ni cuota, ni zona, ni "Como Ejecutivo Comercial". Sin ninguna
 * línea sigue como antes (rolDePersona da null). No toca persona_de_campo de la base: la API ya no le pide nada como
 * Ejecutivo Comercial (las citas van con como 'lider' y las visitas solo con líneas de líder).
 *
 * Una línea que lidera y que TAMBIÉN es de su Ejecutivo Comercial no cuenta como de líder: la base haría de Ejecutivo
 * Comercial la visita con esa línea (ejecutivo_de_la_visita), y eso va por VMO. Hoy no pasa (revisado el 2026-10-30).
 */
export function lineasDeLaApp(
  lineas: { ec: string[]; lider: string[]; todas: string[] },
  soloLideres: boolean
): { ok: true; ec: string[]; lider: string[]; todas: string[] } | { ok: false; error: string } {
  if (!soloLideres) return { ok: true, ...lineas }
  const lider = lineas.lider.filter(linea => !lineas.ec.includes(linea))
  if (lider.length === 0 && lineas.ec.length > 0) return { ok: false, error: MENSAJE_EJECUTIVO_EN_VMO }
  return { ok: true, ec: [], lider, todas: [...lider] }
}

/**
 * "Como qué" pide la API a la base al agendar (agenda_crear y agenda_otra_fecha). Con la app solo para líderes, siempre
 * como líder (sin `como`, la base agendaría como Ejecutivo Comercial a quien tiene los dos papeles), y 'ejecutivo' →
 * MENSAJE_EJECUTIVO_EN_VMO. Si no, el que llegó, o null: decide la base (C12).
 */
export function comoDeLaApp(
  como: ComoPersona | null | undefined,
  soloLideres: boolean
): { ok: true; como: ComoPersona | null } | { ok: false; error: string } {
  if (!soloLideres) return { ok: true, como: como ?? null }
  if (como === 'ejecutivo') return { ok: false, error: MENSAJE_EJECUTIVO_EN_VMO }
  return { ok: true, como: 'lider' }
}

/** Papel de la persona según sus líneas: null si no tiene ninguna. */
export function rolDePersona(lineasEc: readonly string[], lineasLider: readonly string[]): RolPersona | null {
  if (lineasEc.length === 0 && lineasLider.length === 0) return null
  if (lineasLider.length === 0) return 'ejecutivo'
  if (lineasEc.length === 0) return 'lider'
  return 'lider_y_ejecutivo'
}

/**
 * Espejo de persona_de_campo: la dirección comercial → MENSAJE_DIRECCION_NO_REPORTA (aunque lidere una línea); sin
 * líneas (o inactivo) → MENSAJE_SIN_LINEAS; Ejecutivo Comercial activo sin zona → MENSAJE_SIN_ZONA.
 */
export function personaDeCampo(entrada: {
  usuario: UsuarioCampo
  ejecutiva: EjecutivaCampo | null
  lineasEjecutiva: readonly string[]
  lineas: readonly LineaCampo[]
}): ResultadoPersona {
  if (entrada.usuario.role === 'commercial_director') return { ok: false, error: MENSAJE_DIRECCION_NO_REPORTA }
  const { ec, lider, todas } = lineasParaReportar(entrada)
  const rol = rolDePersona(ec, lider)
  if (!rol) return { ok: false, error: MENSAJE_SIN_LINEAS }
  const activa = entrada.ejecutiva && entrada.ejecutiva.status === 'active' ? entrada.ejecutiva : null
  if (activa && !activa.base_kam_id) return { ok: false, error: MENSAJE_SIN_ZONA }
  return {
    ok: true,
    persona: {
      userId: entrada.usuario.id,
      rol,
      executiveId: activa?.id ?? null,
      kamId: activa?.base_kam_id ?? null,
      lineasEc: ec,
      lineasLider: lider,
      lineas: todas,
    },
  }
}

/**
 * Espejo de ejecutivo_de_la_visita: el Ejecutivo Comercial de la persona si alguna línea de la visita está en sus
 * executive_lines; si no, null (la visita es "como líder"). Paola: una de trauma (líder) → null; una de sustitutos
 * (Ejecutiva) → el suyo; una con las dos → el suyo.
 */
export function ejecutivoDeLaVisita(persona: Pick<PersonaCampoPura, 'executiveId' | 'lineasEc'>, lineas: readonly string[]): string | null {
  if (!persona.executiveId) return null
  return lineas.some(linea => persona.lineasEc.includes(linea)) ? persona.executiveId : null
}

/**
 * ¿La visita suma a la cuota de la persona? (C4, A13) Con Ejecutivo Comercial, solo sus visitas como Ejecutivo
 * Comercial: lo que hace como líder (executive_id NULL) no suma. Sin Ejecutivo Comercial (una líder) no hay cuota y sus
 * visitas cuentan como hechas. La misma regla para hoy.hechas (contexto), Mis números y cuenta_para (GET y POST
 * /api/me/visitas), para que la API no se contradiga.
 */
export function visitaSumaALaCuota(persona: Pick<PersonaCampoPura, 'executiveId'>, visita: { executive_id: string | null }): boolean {
  return !persona.executiveId || visita.executive_id === persona.executiveId
}

/**
 * Espejo de "como qué" de agenda_crear (C12): sin `como`, como Ejecutivo Comercial si lo tiene y si no como líder; como
 * Ejecutivo Comercial exige tenerlo (MENSAJE_SIN_EJECUTIVA); como líder exige liderar alguna línea. La cita lleva el
 * executive_id solo como Ejecutivo Comercial.
 */
export function ejecutivoDeLaCita(
  persona: Pick<PersonaCampoPura, 'executiveId' | 'lineasLider'>,
  como?: ComoPersona | null
): { ok: true; como: ComoPersona; executiveId: string | null } | { ok: false; error: string } {
  const elegido: ComoPersona = como ?? (persona.executiveId ? 'ejecutivo' : 'lider')
  if (elegido === 'ejecutivo') {
    if (!persona.executiveId) return { ok: false, error: MENSAJE_SIN_EJECUTIVA }
    return { ok: true, como: 'ejecutivo', executiveId: persona.executiveId }
  }
  if (persona.lineasLider.length === 0) return { ok: false, error: MENSAJE_SIN_LINEAS_LIDER }
  return { ok: true, como: 'lider', executiveId: null }
}

/** Una asignación de visitante (medico_visitantes). */
export interface VisitanteMedico {
  medico_id: string
  executive_id: string
  line_id: string
  desde: string
  hasta: string | null
}

/** ¿Rige esa asignación en la fecha? */
export const visitanteVigenteEn = (fila: Pick<VisitanteMedico, 'desde' | 'hasta'>, fecha: string): boolean =>
  fila.desde <= fecha && (fila.hasta === null || fila.hasta >= fecha)

/** Una fila de medico_lineas (0950): el médico es de esa línea desde `desde` porque lo creó su líder (2026-10-30). */
export interface LineaPropiaMedico {
  medico_id: string
  line_id: string
  desde: string
}

/**
 * Las líneas de las que un médico "es" en una fecha (C9): la línea de cada visitante vigente y, si ese visitante es un
 * Ejecutivo Comercial activo, también todas sus líneas. `lineasDeEjecutivasActivas`: executive_lines de los Ejecutivos
 * Comerciales ACTIVOS (los demás no están). `propias` (0950): las de medico_lineas, desde su fecha: el médico que creó
 * una líder es de sus líneas aunque aún no tenga visitante.
 */
export function lineasDelMedico(
  medicoId: string,
  visitantes: readonly VisitanteMedico[],
  lineasDeEjecutivasActivas: ReadonlyMap<string, readonly string[]>,
  fecha: string,
  propias: readonly LineaPropiaMedico[] = []
): Set<string> {
  const lineas = new Set<string>()
  for (const fila of visitantes) {
    if (fila.medico_id !== medicoId || !visitanteVigenteEn(fila, fecha)) continue
    lineas.add(fila.line_id)
    for (const linea of lineasDeEjecutivasActivas.get(fila.executive_id) ?? []) lineas.add(linea)
  }
  for (const fila of propias) if (fila.medico_id === medicoId && fila.desde <= fecha) lineas.add(fila.line_id)
  return lineas
}

/**
 * Espejo de medico_de_lineas (C9): el médico tiene un visitante vigente en alguna línea de `lineas`, o su visitante
 * vigente es un Ejecutivo Comercial activo con alguna de ellas, o (0950) lo creó la líder de una de ellas
 * (`propias`, desde su fecha). Visitante vencido, de otra línea y de otro Ejecutivo Comercial: no.
 */
export function medicoDeLineas(
  medicoId: string,
  lineas: readonly string[],
  visitantes: readonly VisitanteMedico[],
  lineasDeEjecutivasActivas: ReadonlyMap<string, readonly string[]>,
  fecha: string,
  propias: readonly LineaPropiaMedico[] = []
): boolean {
  const delMedico = lineasDelMedico(medicoId, visitantes, lineasDeEjecutivasActivas, fecha, propias)
  return lineas.some(linea => delMedico.has(linea))
}
