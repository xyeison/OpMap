/**
 * La persona de campo en la app (F1b de actividades de campo, spec docs/specs/2026-10-15-actividades-de-campo.md: "La
 * app (una sola)", A1, C1, C9 y C12): quién entra a las pestañas, qué papel tiene (líder, Ejecutivo Comercial o los
 * dos, como Paola), si tiene cuota y días libres (solo con Ejecutivo Comercial, hasta F3), cómo se dice su papel en
 * Ajustes y qué ofrece Agendar según "como qué" agenda. PURO (sin React Native): lo prueba scripts/checks/21-persona.ts.
 *
 * La persona sale de GET /api/auth/me (MeResponse.persona; el login no la trae: la sesión la pide justo después) o del
 * contexto (ContextoResponse.persona). Sin el dato —un servidor sin la 0850, un perfil guardado antes de F1b o sin
 * señal— la app sigue como antes: entra y el servidor decide (nunca deja fuera a nadie por no saber).
 *
 * La app es de las líderes y de los Ejecutivos Comerciales (dueño, 2026-10-31; reemplaza la regla del 2026-10-30): el
 * servidor da la persona a quien tiene líneas, con sus dos papeles si los tiene (Paola). Quien el servidor deja fuera con su porqué (MeResponse.sin_persona, p. ej. un administrador sin líneas) ve el
 * aviso y no entra a las pestañas.
 *
 * Con un servidor que respondió /api/auth/me SIN la clave `persona` (sin F1a) la app no ofrece lo que ese servidor no
 * tiene: "No se hizo", Eliminar, "Agendar otra fecha" ni "¿Qué pasó con esto?", y cancela con solo `{ motivo }`
 * (servidorDeMe y conCicloDeVida).
 */
import type { ComoPersona, EjecutivaMovil, MedicoPublico, PersonaMovil, RolPersona, TipoVisita } from './tipos'

// ---------------------------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------------------------

/** Lo que ve la dirección comercial al entrar (A1: no agenda ni reporta; sigue a su equipo en la web). */
export const MENSAJE_DIRECCION_EN_LA_WEB = 'La dirección comercial sigue a su equipo en la web'
/** El mismo texto de web/lib/persona-campo.ts (MENSAJE_SIN_LINEAS): un usuario sin líneas no agenda ni reporta. */
export const MENSAJE_SIN_LINEAS = 'Tu usuario no tiene líneas para reportar'
/** Qué hacer sin líneas. */
export const AYUDA_SIN_LINEAS = 'Pide a quien administra OpMap que te asigne tu línea o tu Zona.'
/**
 * Para quién es la app (dueño, 2026-10-31, docs/decisiones/2026-10-31-ejecutivos-comerciales-vuelven-a-la-app.md): las
 * líderes y los Ejecutivos Comerciales. Va debajo del aviso de quien no entra a las pestañas.
 */
export const TEXTO_PARA_QUIEN_ES_LA_APP = 'La app es para las líderes de negocio y los Ejecutivos Comerciales: agendan y reportan en campo.'

/**
 * "Como qué" se agenda (C12), solo para quien tiene los dos papeles. "Ejecutivo Comercial" siempre así en la app
 * (terminología del dueño del 2026-10-29), aunque la persona sea Paola.
 */
export const ETIQUETA_COMO: Record<ComoPersona, string> = { ejecutivo: 'Como Ejecutivo Comercial', lider: 'Como líder' }

// ---------------------------------------------------------------------------------------------
// Quién entra
// ---------------------------------------------------------------------------------------------

/**
 * - 'direccion': la dirección comercial (rol commercial_director): no entra a las pestañas (A1).
 * - 'campo': persona de campo (líder, Ejecutivo Comercial o los dos, como Paola).
 * - 'fuera': el servidor confirmó que no hay persona y dijo por qué (MeResponse.sin_persona: sin líneas…): no entra a
 *   las pestañas y lo ve (avisoFuera).
 * - 'sin_lineas': el servidor confirmó que no tiene líneas, sin decir por qué (un servidor anterior): entra y Hoy lo dice.
 * - 'sin_saber': todavía no se sabe (login recién hecho, perfil de antes de F1b, sin señal, servidor sin la 0850).
 */
export type EstadoPersona = 'campo' | 'direccion' | 'fuera' | 'sin_lineas' | 'sin_saber'

export function estadoPersona(o: {
  role: string | null | undefined
  persona: PersonaMovil | null | undefined
  sinPersona?: string | null
  sinConfirmar?: boolean
}): EstadoPersona {
  if (o.role === 'commercial_director') return 'direccion'
  if (o.persona) return 'campo'
  if (o.persona === null && !o.sinConfirmar) return o.sinPersona?.trim() ? 'fuera' : 'sin_lineas'
  return 'sin_saber'
}

/**
 * ¿Entra a las pestañas? Todos salvo la dirección comercial y quien el servidor dejó fuera con su porqué (sin saber,
 * entra: el servidor decide, como siempre).
 */
export function entraALasPestanas(estado: EstadoPersona): boolean {
  return estado !== 'direccion' && estado !== 'fuera'
}

/** El aviso de quien no entra a las pestañas: la dirección comercial (A1) o el porqué del servidor (sin_persona). */
export function avisoFuera(estado: EstadoPersona, sinPersona: string | null | undefined): { titulo: string; texto: string } {
  if (estado === 'direccion') return { titulo: MENSAJE_DIRECCION_EN_LA_WEB, texto: TEXTO_PARA_QUIEN_ES_LA_APP }
  return { titulo: sinPersona?.trim() || MENSAJE_SIN_LINEAS, texto: TEXTO_PARA_QUIEN_ES_LA_APP }
}

/**
 * La persona que trae GET /api/auth/me para el perfil: la del servidor si la manda (también null: sin líneas); si no la
 * manda (un servidor sin la 0850), la que ya se sabía.
 */
export function personaDeMe(respuesta: { persona?: PersonaMovil | null }, anterior: PersonaMovil | null | undefined): PersonaMovil | null | undefined {
  return respuesta.persona === undefined ? anterior : respuesta.persona
}

/**
 * Qué servidor respondió GET /api/auth/me: 'con_f1a' si trae la clave `persona` (también null: la dirección comercial o
 * sin líneas), 'sin_f1a' si respondió bien sin ella (un servidor anterior a la 0850). Se guarda en el perfil.
 */
export type ServidorDeCampo = 'con_f1a' | 'sin_f1a'

export function servidorDeMe(respuesta: { persona?: PersonaMovil | null }): ServidorDeCampo {
  return respuesta.persona === undefined ? 'sin_f1a' : 'con_f1a'
}

/**
 * ¿Se ofrece el ciclo de vida de la cita ("No se hizo", Eliminar, "Agendar otra fecha", "¿Qué pasó con esto?" y el
 * código del motivo al cancelar)? Sí, salvo que /api/auth/me haya dicho que el servidor no lo tiene ('sin_f1a': sus
 * rutas responderían 404). Si no se sabe (recién entró, sin señal, un perfil de antes), queda como está: decide el
 * servidor.
 */
export function conCicloDeVida(servidor: ServidorDeCampo | null | undefined): boolean {
  return servidor !== 'sin_f1a'
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

/** ¿Elige "Como Ejecutivo Comercial" o "Como líder" al agendar? Solo quien tiene los dos papeles (C12). */
export function eligeComo(persona: Pick<PersonaMovil, 'rol'> | null | undefined): boolean {
  return persona?.rol === 'lider_y_ejecutivo'
}

/** "Como qué" agenda por defecto (C12): como Ejecutivo Comercial si lo tiene; si no, como líder. */
export function comoPorDefecto(persona: Pick<PersonaMovil, 'rol'> | null | undefined): ComoPersona {
  return persona?.rol === 'lider' ? 'lider' : 'ejecutivo'
}

/**
 * El papel con el que agenda: el que eligió (Paola) o, si no elige, el suyo por defecto (una líder sin Ejecutivo
 * Comercial, como líder). Sin la persona, como Ejecutivo Comercial (como antes de F1b: decide el servidor).
 */
export function papelDeAgenda(persona: Pick<PersonaMovil, 'rol'> | null | undefined, como: ComoPersona | null | undefined): ComoPersona {
  return como ?? comoPorDefecto(persona)
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

/**
 * El rótulo de la cuota en Mis números para quien tiene los dos papeles (Paola): "Como Ejecutivo Comercial · Sustitutos
 * óseos" (sus líneas de Ejecutivo Comercial): la cuota es solo de ese papel (C4: lo de líder no suma). null para los
 * demás (o sin la persona).
 */
export function rotuloCuota(persona: PersonaMovil | null | undefined): string | null {
  if (!persona || !eligeComo(persona)) return null
  const lineas = persona.lineas.filter(linea => linea.como === 'ejecutivo').map(linea => linea.nombre)
  return [ETIQUETA_COMO.ejecutivo, juntar(lineas)].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------------------------------------
// Agendar según "como qué"
// ---------------------------------------------------------------------------------------------

/** Las líneas con las que agenda o reporta "como" ese papel. */
export function lineasDelPapel(persona: Pick<PersonaMovil, 'lineas'> | null | undefined, como: ComoPersona): string[] {
  return (persona?.lineas ?? []).filter(linea => linea.como === como).map(linea => linea.id)
}

/**
 * ¿Agendar ofrece este médico con ese papel? (C9) Como líder —Paola que eligió "Como líder" o una líder sin Ejecutivo
 * Comercial—, solo si es de sus líneas de líder (si no, el servidor lo rechaza: "Ese médico no es de tus líneas"); como
 * Ejecutivo Comercial, sí. `lineas` null: no se saben (un resultado del buscador sin sus visitantes): sí, y decide el
 * servidor. Sin la persona, sí (como antes).
 */
export function medicoDelPapel(lineas: readonly string[] | null, persona: PersonaMovil | null | undefined, como: ComoPersona | null | undefined): boolean {
  if (!persona || papelDeAgenda(persona, como) !== 'lider' || lineas === null) return true
  const deLider = lineasDelPapel(persona, 'lider')
  return lineas.some(linea => deLider.includes(linea))
}

/**
 * Los médicos que Agendar ofrece según el papel (medicoDelPapel): de "mis médicos" (el servidor ya manda, para la
 * líder, todos los de sus líneas: C9 completo) y los traídos del buscador.
 */
export function medicosDelPapel<T extends { lineas: readonly string[] | null }>(medicos: readonly T[], persona: PersonaMovil | null | undefined, como: ComoPersona | null | undefined): T[] {
  return medicos.filter(medico => medicoDelPapel(medico.lineas, persona, como))
}

/**
 * Las líneas de un médico del buscador (POST /api/terceros/medicos/buscar): las de sus visitantes vigentes. null si no
 * se saben (la respuesta no trae los visitantes, o alguno vigente sin su línea). Ojo: C9 también cuenta al médico cuyo
 * visitante es un Ejecutivo Comercial con una línea de la líder aunque lo visite por otra; ese ya viene en "mis
 * médicos" (Agendar lo deja por ahí), y el buscador no trae las líneas de ese Ejecutivo Comercial.
 */
export function lineasDeBusqueda(medico: Pick<MedicoPublico, 'visitantes'>, hoy: string): string[] | null {
  if (!Array.isArray(medico.visitantes)) return null
  const vigentes = medico.visitantes.filter(visitante => !visitante.hasta || visitante.hasta >= hoy)
  if (vigentes.some(visitante => typeof visitante.line_id !== 'string')) return null
  return Array.from(new Set(vigentes.map(visitante => visitante.line_id as string)))
}

/**
 * Los tipos que se pueden agendar según "como qué": como líder rige la configuración general (médica e institucional,
 * "Quién es quién" de la spec); como Ejecutivo Comercial, su perfil (el del contexto).
 */
export function perfilDelPapel(perfil: readonly TipoVisita[], persona: PersonaMovil | null | undefined, como: ComoPersona | null): TipoVisita[] {
  if (eligeComo(persona) && como === 'lider') return ['medica', 'institucional']
  return [...perfil]
}
