/**
 * La persona de campo en la app (F1b de actividades de campo, spec docs/specs/2026-10-15-actividades-de-campo.md: "La
 * app (una sola)", A1, C1, C9 y C12): quién entra a las pestañas, qué papel tiene (líder, Ejecutivo Comercial o los
 * dos, como Paola), si tiene cuota y días libres (solo con Ejecutivo Comercial, hasta F3), cómo se dice su papel en
 * Ajustes y qué ofrece Agendar según "como qué" agenda. PURO (sin React Native): lo prueba scripts/checks/21-persona.ts.
 *
 * La persona sale de GET /api/auth/me (MeResponse.persona; el login no la trae: la sesión la pide justo después) o del
 * contexto (ContextoResponse.persona). Sin el dato —un servidor sin la 0850, un perfil guardado antes de F1b o sin
 * señal— la app sigue como antes: entra y el servidor decide (nunca deja fuera a nadie por no saber).
 */
import type { ComoPersona, EjecutivaMovil, PersonaMovil, RolPersona, TipoVisita } from './tipos'

// ---------------------------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------------------------

/** Lo que ve la dirección comercial al entrar (A1: no agenda ni reporta; sigue a su equipo en la web). */
export const MENSAJE_DIRECCION_EN_LA_WEB = 'La dirección comercial sigue a su equipo en la web (Equipo)'
/** El mismo texto de web/lib/persona-campo.ts (MENSAJE_SIN_LINEAS): un usuario sin líneas no agenda ni reporta. */
export const MENSAJE_SIN_LINEAS = 'Tu usuario no tiene líneas para reportar'
/** Qué hacer sin líneas. */
export const AYUDA_SIN_LINEAS = 'Pide a quien administra OpMap que te asigne una línea o que enlace tu usuario con un Ejecutivo Comercial.'

/** "Como qué" se agenda (C12), solo para quien tiene los dos papeles. */
export const ETIQUETA_COMO: Record<ComoPersona, string> = { ejecutivo: 'Como Ejecutiva Comercial', lider: 'Como líder' }

// ---------------------------------------------------------------------------------------------
// Quién entra
// ---------------------------------------------------------------------------------------------

/**
 * - 'direccion': la dirección comercial (rol commercial_director): no entra a las pestañas (A1).
 * - 'campo': persona de campo (líder, Ejecutivo Comercial o los dos).
 * - 'sin_lineas': el servidor confirmó que no tiene líneas (persona null con la sesión confirmada).
 * - 'sin_saber': todavía no se sabe (login recién hecho, perfil de antes de F1b, sin señal, servidor sin la 0850).
 */
export type EstadoPersona = 'campo' | 'direccion' | 'sin_lineas' | 'sin_saber'

export function estadoPersona(o: { role: string | null | undefined; persona: PersonaMovil | null | undefined; sinConfirmar?: boolean }): EstadoPersona {
  if (o.role === 'commercial_director') return 'direccion'
  if (o.persona) return 'campo'
  if (o.persona === null && !o.sinConfirmar) return 'sin_lineas'
  return 'sin_saber'
}

/** ¿Entra a las pestañas? Todos salvo la dirección comercial (los demás: el servidor decide, como siempre). */
export function entraALasPestanas(estado: EstadoPersona): boolean {
  return estado !== 'direccion'
}

/**
 * La persona que trae GET /api/auth/me para el perfil: la del servidor si la manda (también null: sin líneas); si no la
 * manda (un servidor sin la 0850), la que ya se sabía.
 */
export function personaDeMe(respuesta: { persona?: PersonaMovil | null }, anterior: PersonaMovil | null | undefined): PersonaMovil | null | undefined {
  return respuesta.persona === undefined ? anterior : respuesta.persona
}

// ---------------------------------------------------------------------------------------------
// Papel: cuota, días libres, Ajustes
// ---------------------------------------------------------------------------------------------

type ConPersona = { persona?: Pick<PersonaMovil, 'rol'> | null; ejecutiva?: EjecutivaMovil | null }

/**
 * ¿Tiene Ejecutivo Comercial? Lo dice su papel (todo menos 'lider'); sin la persona, si el usuario está enlazado con un
 * Ejecutivo Comercial (como antes de F1b).
 */
export function tieneEjecutivo(o: ConPersona): boolean {
  if (o.persona) return o.persona.rol !== 'lider'
  return !!o.ejecutiva
}

/** Días libres (y su entrada en Mi agenda y Ajustes): solo con Ejecutivo Comercial hasta F3 (spec, "Días libres"). */
export const muestraDiasLibres = tieneEjecutivo

/** ¿Tiene cuota de visitas? (C4: solo el Ejecutivo Comercial; una líder no, y su "Meta de hoy" no se muestra). */
export const tieneCuota = tieneEjecutivo

/** ¿Elige "Como Ejecutiva Comercial" o "Como líder" al agendar? Solo quien tiene los dos papeles (C12). */
export function eligeComo(persona: Pick<PersonaMovil, 'rol'> | null | undefined): boolean {
  return persona?.rol === 'lider_y_ejecutivo'
}

/** "Como qué" agenda por defecto (C12): como Ejecutivo Comercial si lo tiene; si no, como líder. */
export function comoPorDefecto(persona: Pick<PersonaMovil, 'rol'> | null | undefined): ComoPersona {
  return persona?.rol === 'lider' ? 'lider' : 'ejecutivo'
}

/** "A, B y C". */
function juntar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Su papel en Ajustes: "Líder · Trauma" y "Ejecutivo Comercial · Sustitutos óseos · Bucaramanga" (con la zona si la
 * tiene), según el caso; Paola, los dos. Vacío sin la persona.
 */
export function papelesDePersona(persona: PersonaMovil | null | undefined, zona: string | null | undefined): string[] {
  if (!persona) return []
  const de = (como: ComoPersona) => persona.lineas.filter(linea => linea.como === como).map(linea => linea.nombre)
  const papeles: string[] = []
  const lider = de('lider')
  const ejecutivo = de('ejecutivo')
  if (lider.length > 0) papeles.push(`Líder · ${juntar(lider)}`)
  if (ejecutivo.length > 0) papeles.push(['Ejecutivo Comercial', juntar(ejecutivo), zona?.trim() || null].filter(Boolean).join(' · '))
  return papeles
}

/** El papel en una palabra para el título de Ajustes ("Líder", "Ejecutivo Comercial", "Líder y Ejecutivo Comercial"). */
export const TITULO_ROL_PERSONA: Record<RolPersona, string> = {
  ejecutivo: 'Ejecutivo Comercial',
  lider: 'Líder',
  lider_y_ejecutivo: 'Líder y Ejecutivo Comercial',
}

// ---------------------------------------------------------------------------------------------
// Agendar según "como qué"
// ---------------------------------------------------------------------------------------------

/** Las líneas con las que agenda o reporta "como" ese papel. */
export function lineasDelPapel(persona: Pick<PersonaMovil, 'lineas'> | null | undefined, como: ComoPersona): string[] {
  return (persona?.lineas ?? []).filter(linea => linea.como === como).map(linea => linea.id)
}

/**
 * Los médicos que Agendar ofrece de "mis médicos" según "como qué" (C9): como líder, solo los de sus líneas de líder
 * (otro lo rechazaría el servidor: "Ese médico no es de tus líneas"); como Ejecutivo Comercial, todos, como hoy. Solo
 * filtra a quien tiene los dos papeles: a los demás el servidor ya les manda solo los suyos.
 */
export function medicosDelPapel<T extends { lineas: readonly string[] }>(medicos: readonly T[], persona: PersonaMovil | null | undefined, como: ComoPersona | null): T[] {
  if (!eligeComo(persona) || como !== 'lider') return [...medicos]
  const deLider = new Set(lineasDelPapel(persona, 'lider'))
  return medicos.filter(medico => medico.lineas.some(linea => deLider.has(linea)))
}

/**
 * Los tipos que se pueden agendar según "como qué": como líder rige la configuración general (médica e institucional,
 * "Quién es quién" de la spec); como Ejecutivo Comercial, su perfil (el del contexto).
 */
export function perfilDelPapel(perfil: readonly TipoVisita[], persona: PersonaMovil | null | undefined, como: ComoPersona | null): TipoVisita[] {
  if (eligeComo(persona) && como === 'lider') return ['medica', 'institucional']
  return [...perfil]
}
