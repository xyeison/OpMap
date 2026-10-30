// Utilidades de servidor de la F2 de visitas (configuración, calendario, días libres y cuota):
// /api/config-visitas/**, /api/calendario/**, /api/dias-libres/**, /api/me/dias-libres/** y /api/me/cuota. Desde F1a
// (migración 0850) también la persona de campo de /api/me/** (personaDeCampo y requirePersonaDeCampo).
// La carpeta empieza por "_" para que Next.js no la exponga como ruta. Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (sección "API"). Todo con supabaseAdmin (service_role).
//
// Aquí solo se LEEN las filas reales y se le pasan a la lógica pura de lib/visits-rules.ts (vigencias, plazo de
// gracia, día hábil, transiciones de un día libre, cuota): ninguna regla de negocio se repite en las rutas. Las
// escrituras de configuración pasan SIEMPRE por las funciones config_registrar y config_cerrar de la base.
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/auth-server'
import { hasPermission, type Permission } from '@/lib/permissions'
import { requirePermission, requireUser, type AuthResult } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import type { CambioConfig } from '@/lib/visits-config-schemas'
import { fetchAllRows, jsonError } from '@/app/api/kams/_lib/kam-shared'
import {
  MENSAJE_DIRECCION_NO_REPORTA,
  MENSAJE_SIN_LINEAS,
  appSoloLideres,
  lineasDeLaApp,
  lineasParaReportar,
  rolDePersona,
  type LineaCampo,
  type RolPersona,
} from '@/lib/persona-campo'
import {
  enTrozos,
  esViolacionUnica,
  leerPorIds,
  mensajeRegla,
  nombreMunicipio,
  nombresMunicipios,
  type ErrorBase,
} from '@/app/api/terceros/_lib/terceros-server'
import {
  ESTADOS_DIA_LIBRE_VIGENTES,
  GENERAL_POR_DEFECTO,
  MENSAJE_DIA_NO_HABIL,
  MENSAJE_SIN_EJECUTIVA,
  MENSAJE_VALOR_ANULADO,
  claveConfig,
  configPersonaVigente,
  cuotaPeriodo,
  estadoInicialDiaLibre,
  fraccionHabil,
  generalVigente,
  hoyBogota,
  limitesMes,
  municipioDeZona,
  puedeRegistrarDiaLibre,
  resumenCuotaTipo,
  ritmo,
  rolPuedeAprobar,
  subtiposConMetaPropia,
  type CalendarioDia,
  type ConfigConteo,
  type ConfigGeneral,
  type ConfigMeta,
  type ConfigPersona,
  type CuotaResponse,
  type CuotaSubtipo,
  type DiaCuota,
  type DiaLibre,
  type DiaLibreItem,
  type EstadoEjecutiva,
  type GeneralVigencia,
  type MotivoDiaLibre,
  type PersonaCuota,
  type TablaConfig,
} from '@/lib/visits-rules'

export { UUID_RE, idDeRuta } from '@/app/api/terceros/_lib/terceros-server'

// ---------------------------------------------------------------------------------------------
// Reloj y permisos
// ---------------------------------------------------------------------------------------------

/** Instante actual (un solo sitio: las pruebas fijan el reloj con un Date falso). */
export function ahora(): Date {
  return new Date()
}

/** Fecha de hoy (AAAA-MM-DD) en Bogotá. */
export function hoyActual(): string {
  return hoyBogota(ahora())
}

/** Exige sesión (401) y AL MENOS UNO de los permisos (403). */
export async function requireAlgunPermiso(request: Request, permisos: readonly Permission[]): Promise<AuthResult> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  if (!permisos.some(permiso => hasPermission(auth.user.role, permiso))) {
    return { ok: false, response: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }
  return auth
}

// ---------------------------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------------------------

/** Mensaje del 503 cuando la migración 0810 aún no está aplicada. */
export const MENSAJE_FALTA_MIGRACION =
  'La configuración de visitas, el calendario y los días libres aún no están disponibles: falta aplicar la migración 0810 en la base de datos'

function faltaMigracion(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as ErrorBase
  if (code && ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code)) return true
  return typeof message === 'string' && /Could not find the (table|function)|relation .* does not exist|function .* does not exist/i.test(message)
}

/** Registra el error y responde 500 (o 503 si falta la migración 0810). */
export function errorVisitas(contexto: string, error: unknown, mensaje = 'Error interno del servidor'): NextResponse {
  console.error(`Error en ${contexto}:`, error)
  if (faltaMigracion(error)) return jsonError(MENSAJE_FALTA_MIGRACION, 503)
  return jsonError(mensaje, 500)
}

/**
 * Traduce un error de PostgreSQL / PostgREST de una escritura a la respuesta de la API, o null si no es uno que la
 * API sepa explicar (la ruta lo trata como error interno):
 *   23P01 (rangos superpuestos) → 409 · 23505 (duplicado) → 409 · 23514 (regla o CHECK) → 400 con el mensaje de la
 *   base · 22023 (dato no válido de las funciones) → 400 · 23503 (llave foránea) → 400 · 22P02/22007/22008 → 400 ·
 *   P0002 (no existe o ya anulado) → 404 o 409 · falta la migración → 503.
 */
export function respuestaErrorBase(error: ErrorBase | null | undefined, porDefecto: string): NextResponse | null {
  if (!error) return null
  if (faltaMigracion(error)) return jsonError(MENSAJE_FALTA_MIGRACION, 503)
  const texto = error.message ?? ''
  switch (error.code) {
    case '23P01':
      return jsonError(
        /violates|constraint/i.test(texto) || !texto ? 'El rango se superpone con otro valor de esa misma configuración' : texto,
        409
      )
    case '23505':
      return jsonError(mensajeRegla(error, 'Ya existe un registro igual'), 409)
    case '23514':
      return jsonError(mensajeRegla(error, porDefecto), 400)
    case '22023':
      return jsonError(texto || porDefecto, 400)
    case '23503':
      return jsonError('Un dato relacionado no existe (zona, Ejecutivo Comercial, subtipo o municipio)', 400)
    case '22P02':
    case '22007':
    case '22008':
      return jsonError(porDefecto, 400)
    case 'P0002':
      return jsonError(texto || 'No existe ese registro', texto === MENSAJE_VALOR_ANULADO ? 409 : 404)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------------------------
// Configuración (lecturas; las escrituras van por las RPC)
// ---------------------------------------------------------------------------------------------

const COLUMNAS_BASE =
  'id, vigente_desde, vigente_hasta, motivo, set_by, created_at, anulado_at, anulado_por, anulado_motivo, clave, anterior_id, anterior_hasta'

/** Columnas de cada tabla de configuración. */
export const COLUMNAS_CONFIG: Record<TablaConfig, string> = {
  config_metas: `${COLUMNAS_BASE}, scope, kam_id, executive_id, tipo, subtipo_id, periodo, cantidad`,
  config_conteo: `${COLUMNAS_BASE}, subtipo_id, modo, peso`,
  config_general: `${COLUMNAS_BASE}, parametro, valor`,
  config_personas: `${COLUMNAS_BASE}, executive_id, perfil, telefonica_habilitada, tope_telefonicas_dia, radio_m`,
}

interface FilasConfig {
  config_metas: ConfigMeta
  config_conteo: ConfigConteo
  config_general: ConfigGeneral
  config_personas: ConfigPersona
}

/** numeric llega como número desde PostgREST; por si acaso, se normaliza. */
function normalizarConfig<T extends TablaConfig>(tabla: T, fila: FilasConfig[T]): FilasConfig[T] {
  if (tabla === 'config_metas') {
    const meta = fila as ConfigMeta
    return { ...meta, cantidad: Number(meta.cantidad) } as FilasConfig[T]
  }
  if (tabla === 'config_conteo') {
    const conteo = fila as ConfigConteo
    return { ...conteo, peso: Number(conteo.peso) } as FilasConfig[T]
  }
  return fila
}

/**
 * Filas de una tabla de configuración (todas, con cerradas y anuladas, salvo `soloActivas`), opcionalmente de una
 * clave o de una persona. Pagina de 1.000 en 1.000.
 */
export async function leerConfig<T extends TablaConfig>(
  tabla: T,
  filtro: { soloActivas?: boolean; clave?: string; executiveId?: string } = {}
): Promise<FilasConfig[T][]> {
  const nombre: string = tabla
  const columnas: string = COLUMNAS_CONFIG[tabla]
  const filas = await fetchAllRows<unknown>((from, to) => {
    let consulta = supabaseAdmin.from(nombre).select(columnas)
    if (filtro.soloActivas) consulta = consulta.is('anulado_at', null)
    if (filtro.clave !== undefined) consulta = consulta.eq('clave', filtro.clave)
    if (filtro.executiveId !== undefined) consulta = consulta.eq('executive_id', filtro.executiveId)
    return consulta.order('clave').order('vigente_desde').order('id').range(from, to)
  })
  return filas.map(fila => normalizarConfig(tabla, fila as FilasConfig[T]))
}

/** Una fila de configuración por id (o null). */
export async function leerFilaConfig<T extends TablaConfig>(tabla: T, id: string): Promise<FilasConfig[T] | null> {
  const nombre: string = tabla
  const columnas: string = COLUMNAS_CONFIG[tabla]
  const { data, error } = await supabaseAdmin.from(nombre).select(columnas).eq('id', id).limit(1)
  if (error) throw error
  const fila = data && data.length > 0 ? (data[0] as unknown as FilasConfig[T]) : null
  return fila ? normalizarConfig(tabla, fila) : null
}

/** Parámetros generales activos (para generalVigente). */
export async function leerGeneral(): Promise<GeneralVigencia[]> {
  return leerConfig('config_general', { soloActivas: true })
}

/** Filas (activas y anuladas) de la clave a la que va un cambio: lo que mira planearCambio / config_registrar. */
export async function filasDeLaClave(cambio: CambioConfig) {
  return leerConfig(cambio.tabla, { clave: claveConfig(cambio.tabla, cambio.valores as Record<string, unknown>) })
}

async function existe(tabla: 'kams' | 'executives' | 'subtipos_institucionales', id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from(tabla).select('id').eq('id', id).limit(1)
  if (error) throw error
  return Boolean(data && data.length > 0)
}

/**
 * Que existan la zona, el Ejecutivo Comercial y el subtipo a los que apunta un cambio de configuración. Devuelve el
 * mensaje del 400 o null. (zod ya validó la forma de los valores.)
 */
export async function validarReferencias(cambio: CambioConfig): Promise<string | null> {
  if (cambio.tabla === 'config_metas') {
    const { kam_id, executive_id, subtipo_id } = cambio.valores
    if (kam_id && !(await existe('kams', kam_id))) return 'La zona elegida no existe'
    if (executive_id && !(await existe('executives', executive_id))) return 'El Ejecutivo Comercial elegido no existe'
    if (subtipo_id && !(await existe('subtipos_institucionales', subtipo_id))) return 'El subtipo elegido no existe'
  } else if (cambio.tabla === 'config_conteo') {
    if (!(await existe('subtipos_institucionales', cambio.valores.subtipo_id))) return 'El subtipo elegido no existe'
  } else if (cambio.tabla === 'config_personas') {
    if (!(await existe('executives', cambio.valores.executive_id))) return 'El Ejecutivo Comercial elegido no existe'
  }
  return null
}

/**
 * Nombre de cada motivo de día libre por su código: primero la lista vigente hoy, luego las listas anteriores o
 * futuras (un código que se quitó conserva su nombre) y por último la semilla.
 */
export function mapaMotivos(general: readonly GeneralVigencia[], hoy: string): Map<string, string> {
  const mapa = new Map<string, string>()
  const agregar = (lista: unknown) => {
    if (!Array.isArray(lista)) return
    for (const motivo of lista as Partial<MotivoDiaLibre>[]) {
      if (motivo && typeof motivo.codigo === 'string' && !mapa.has(motivo.codigo)) {
        mapa.set(motivo.codigo, typeof motivo.nombre === 'string' ? motivo.nombre : motivo.codigo)
      }
    }
  }
  agregar(generalVigente(general, 'motivos_dia_libre', hoy))
  general
    .filter(fila => fila.parametro === 'motivos_dia_libre' && !fila.anulado_at)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : a.vigente_desde > b.vigente_desde ? -1 : 0))
    .forEach(fila => agregar(fila.valor))
  agregar(GENERAL_POR_DEFECTO.motivos_dia_libre)
  return mapa
}

/** Nombre completo de cada usuario (para set_by_nombre, anulado_por_nombre, registrado_por_nombre...). */
export async function nombresUsuarios(ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const validos = Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)
  const filas = await leerPorIds<{ id: string; full_name: string | null; email: string | null }>(validos, (trozo, from, to) =>
    supabaseAdmin.from('users').select('id, full_name, email').in('id', trozo).order('id').range(from, to)
  )
  const nombres = new Map<string, string>()
  for (const fila of filas) nombres.set(fila.id, fila.full_name || fila.email || 'Usuario')
  return nombres
}

// ---------------------------------------------------------------------------------------------
// Personas (Ejecutivos Comerciales)
// ---------------------------------------------------------------------------------------------

/** Un Ejecutivo Comercial con lo que necesitan los días libres y la cuota. */
export interface PersonaVisitas {
  id: string
  nombre: string
  status: EstadoEjecutiva
  userId: string | null
  /** Zona base (executives.base_kam_id). */
  kamId: string | null
  /** Nombre de la zona base (sin "KAM"). */
  zona: string | null
  /** Municipio de la zona: left(kams.area_id, 5) (las celdas de Bogotá son 11001). */
  municipio: string | null
  startedAt: string | null
  leftAt: string | null
}

interface EjecutivaFila {
  id: string
  full_name: string
  status: EstadoEjecutiva
  user_id: string | null
  base_kam_id: string | null
  started_at: string | null
  left_at: string | null
}

const COLUMNAS_EJECUTIVA = 'id, full_name, status, user_id, base_kam_id, started_at, left_at'

/** Zonas (kams) por id: nombre visible y municipio de su ciudad base. */
export async function zonasPorId(ids: Iterable<string | null | undefined>): Promise<Map<string, { nombre: string; municipio: string | null }>> {
  const validos = Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)
  const filas = await leerPorIds<{ id: string; name: string | null; area_id: string | null }>(validos, (trozo, from, to) =>
    supabaseAdmin.from('kams').select('id, name, area_id').in('id', trozo).order('id').range(from, to)
  )
  const zonas = new Map<string, { nombre: string; municipio: string | null }>()
  for (const fila of filas) zonas.set(fila.id, { nombre: zoneDisplayName(fila.name) || 'Zona', municipio: municipioDeZona(fila.area_id) })
  return zonas
}

async function armarPersonas(filas: readonly EjecutivaFila[]): Promise<PersonaVisitas[]> {
  const zonas = await zonasPorId(filas.map(fila => fila.base_kam_id))
  return filas.map(fila => {
    const zona = fila.base_kam_id ? zonas.get(fila.base_kam_id) : undefined
    return {
      id: fila.id,
      nombre: fila.full_name,
      status: fila.status,
      userId: fila.user_id,
      kamId: fila.base_kam_id,
      zona: zona?.nombre ?? null,
      municipio: zona?.municipio ?? null,
      startedAt: fila.started_at,
      leftAt: fila.left_at,
    }
  })
}

/** Personas por id (las que no existen no salen). */
export async function personasPorId(ids: Iterable<string | null | undefined>): Promise<Map<string, PersonaVisitas>> {
  const validos = Array.from(ids).filter((id): id is string => typeof id === 'string' && id.length > 0)
  const filas = await leerPorIds<EjecutivaFila>(validos, (trozo, from, to) =>
    supabaseAdmin.from('executives').select(COLUMNAS_EJECUTIVA).in('id', trozo).order('id').range(from, to)
  )
  const personas = await armarPersonas(filas)
  return new Map(personas.map(persona => [persona.id, persona]))
}

/** Un Ejecutivo Comercial por id, o null. */
export async function cargarPersona(executiveId: string): Promise<PersonaVisitas | null> {
  return (await personasPorId([executiveId])).get(executiveId) ?? null
}

/**
 * El Ejecutivo Comercial enlazado con el usuario (executives.user_id es único) que no está inactivo, o null. Quien
 * se dio de baja "ya no está" (decisión del dueño 2026-10-12): sus rutas /api/me/* responden como a un usuario sin
 * Ejecutivo Comercial enlazado.
 */
export async function personaDelUsuario(userId: string): Promise<PersonaVisitas | null> {
  const { data, error } = await supabaseAdmin
    .from('executives')
    .select(COLUMNAS_EJECUTIVA)
    .eq('user_id', userId)
    .neq('status', 'inactive')
    .order('full_name')
    .limit(5)
  if (error) throw error
  const filas = (data || []) as unknown as EjecutivaFila[]
  if (filas.length === 0) return null
  // Si por un dato viejo hubiera más de una, la activa primero.
  const elegida = filas.find(fila => fila.status === 'active') ?? filas[0]
  return (await armarPersonas([elegida]))[0]
}

export type EjecutivaResult =
  | { ok: true; user: SessionUser; persona: PersonaVisitas }
  | { ok: false; response: NextResponse }

/**
 * Rutas /api/me/*: exige visits:report (401/403) y que el usuario esté enlazado con un Ejecutivo Comercial
 * (403 "Tu usuario no está enlazado con un Ejecutivo Comercial").
 */
export async function requireEjecutiva(request: Request, contexto: string): Promise<EjecutivaResult> {
  const auth = await requirePermission(request, 'visits:report')
  if (!auth.ok) return auth
  try {
    const persona = await personaDelUsuario(auth.user.id)
    if (!persona) return { ok: false, response: jsonError(MENSAJE_SIN_EJECUTIVA, 403) }
    return { ok: true, user: auth.user, persona }
  } catch (error) {
    return { ok: false, response: errorVisitas(contexto, error, 'Error al cargar tu Ejecutivo Comercial') }
  }
}

// ---------------------------------------------------------------------------------------------
// Persona de campo (F1a, migración 0850): líderes y Ejecutivos Comerciales
// ---------------------------------------------------------------------------------------------

/**
 * La persona de campo (spec 2026-10-15, "Quién es quién"; espejo de persona_de_campo): quien agenda y reporta es el
 * USUARIO; el Ejecutivo Comercial es opcional (una líder no lo tiene; Paola tiene los dos papeles).
 */
export interface PersonaCampo {
  userId: string
  /** users.full_name. */
  nombre: string
  rol: RolPersona
  /** Su Ejecutivo Comercial ACTIVO, o null. */
  executiveId: string | null
  /** Ese Ejecutivo Comercial con su zona (para la cuota, el contexto y los días libres), o null. */
  ejecutiva: PersonaVisitas | null
  /** executive_lines de su Ejecutivo Comercial activo (ordenadas). */
  lineasEc: string[]
  /** Líneas activas que lidera (ordenadas). */
  lineasLider: string[]
  /** La unión (persona_lineas), ordenada. */
  lineas: string[]
}

export type PersonaCampoResult = { ok: true; persona: PersonaCampo } | { ok: false; error: string }

/**
 * Lee la persona de campo del usuario con las filas reales (su Ejecutivo Comercial activo y sus líneas, las líneas que
 * lidera) y la arma con lib/persona-campo.ts. La dirección comercial → MENSAJE_DIRECCION_NO_REPORTA (A1); sin líneas →
 * MENSAJE_SIN_LINEAS. Un Ejecutivo Comercial sin zona sí pasa aquí (como antes): el reporte lo rechaza después con
 * MENSAJE_SIN_ZONA (validarVisita y la base). Con la app solo para líderes (dueño, 2026-10-30: lineasDeLaApp), quien
 * solo es Ejecutivo Comercial → MENSAJE_EJECUTIVO_EN_VMO y Paola entra solo como líder, sin su Ejecutivo Comercial.
 */
export async function personaDeCampo(user: Pick<SessionUser, 'id' | 'role' | 'active' | 'full_name'>): Promise<PersonaCampoResult> {
  if (user.role === 'commercial_director') return { ok: false, error: MENSAJE_DIRECCION_NO_REPORTA }
  const [ejecutivas, lideradas] = await Promise.all([
    fetchAllRows<EjecutivaFila>((from, to) =>
      supabaseAdmin.from('executives').select(COLUMNAS_EJECUTIVA).eq('user_id', user.id).eq('status', 'active').order('id').range(from, to)
    ),
    fetchAllRows<LineaCampo>((from, to) =>
      supabaseAdmin.from('business_lines').select('id, active, leader_user_id').eq('leader_user_id', user.id).order('id').range(from, to)
    ),
  ])
  const fila = ejecutivas[0] ?? null
  const lineasEjecutiva = fila
    ? (
        await fetchAllRows<{ line_id: string }>((from, to) =>
          supabaseAdmin.from('executive_lines').select('line_id').eq('executive_id', fila.id).order('line_id').range(from, to)
        )
      ).map(vinculo => vinculo.line_id)
    : []
  const soloLideres = appSoloLideres(process.env)
  const deLaApp = lineasDeLaApp(
    lineasParaReportar({
      usuario: { id: user.id, role: user.role, active: user.active },
      ejecutiva: fila ? { id: fila.id, status: fila.status, base_kam_id: fila.base_kam_id } : null,
      lineasEjecutiva,
      lineas: lideradas,
    }),
    soloLideres
  )
  if (!deLaApp.ok) return { ok: false, error: deLaApp.error }
  const { ec, lider, todas } = deLaApp
  const rol = rolDePersona(ec, lider)
  if (!rol) return { ok: false, error: MENSAJE_SIN_LINEAS }
  const ejecutiva = fila && !soloLideres ? (await armarPersonas([fila]))[0] : null
  return {
    ok: true,
    persona: {
      userId: user.id,
      nombre: user.full_name,
      rol,
      executiveId: ejecutiva?.id ?? null,
      ejecutiva,
      lineasEc: ec,
      lineasLider: lider,
      lineas: todas,
    },
  }
}

export type PersonaDeCampoResult =
  | { ok: true; user: SessionUser; persona: PersonaCampo }
  | { ok: false; response: NextResponse }

/**
 * Rutas /api/me/* de la persona de campo (F1a): sesión (401); la dirección comercial → 403
 * MENSAJE_DIRECCION_NO_REPORTA (A1: no agenda ni reporta, aunque lidere una línea); sin visits:report → 403; sin líneas
 * para reportar → 403 MENSAJE_SIN_LINEAS. Reemplaza a requireEjecutiva salvo en /api/me/dias-libres* y /api/me/cuota
 * (hasta F3, solo del Ejecutivo Comercial).
 */
export async function requirePersonaDeCampo(request: Request, contexto: string): Promise<PersonaDeCampoResult> {
  const auth = await requireUser(request)
  if (!auth.ok) return auth
  if (auth.user.role === 'commercial_director') return { ok: false, response: jsonError(MENSAJE_DIRECCION_NO_REPORTA, 403) }
  if (!hasPermission(auth.user.role, 'visits:report')) {
    return { ok: false, response: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }
  try {
    const resultado = await personaDeCampo(auth.user)
    if (!resultado.ok) return { ok: false, response: jsonError(resultado.error, 403) }
    return { ok: true, user: auth.user, persona: resultado.persona }
  } catch (error) {
    return { ok: false, response: errorVisitas(contexto, error, 'Error al cargar tu persona de campo') }
  }
}

/**
 * Ejecutivos Comerciales enlazados con el usuario (executives.user_id = él; normalmente uno o ninguno). Quien aprueba
 * no registra "por otra persona" ni revisa los días libres de estos (separación entre quien pide y quien aprueba).
 */
export async function ejecutivasDelUsuario(userId: string): Promise<Set<string>> {
  const filas = await fetchAllRows<{ id: string }>((from, to) =>
    supabaseAdmin.from('executives').select('id').eq('user_id', userId).order('id').range(from, to)
  )
  return new Set(filas.map(fila => fila.id))
}

/** Ejecutivos Comerciales de las líneas que lidera el usuario (business_lines.leader_user_id = él). */
export async function ejecutivasDeMisLineas(userId: string): Promise<Set<string>> {
  const lineas = await fetchAllRows<{ id: string }>((from, to) =>
    supabaseAdmin.from('business_lines').select('id').eq('leader_user_id', userId).order('id').range(from, to)
  )
  const vinculos = await leerPorIds<{ executive_id: string; line_id: string }>(
    lineas.map(linea => linea.id),
    (trozo, from, to) =>
      supabaseAdmin
        .from('executive_lines')
        .select('executive_id, line_id')
        .in('line_id', trozo)
        .order('executive_id')
        .order('line_id')
        .range(from, to)
  )
  return new Set(vinculos.map(vinculo => vinculo.executive_id))
}

// ---------------------------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------------------------

export const COLUMNAS_CALENDARIO =
  'id, fecha, alcance, municipality_id, tipo, nombre, origen, created_by, created_at, anulado_at, anulado_por, anulado_motivo'

const ORDEN_ALCANCE: Record<string, number> = { nacional: 0, empresa: 1, ciudad: 2 }

/** Orden de los días: por fecha, luego nacional, empresa, ciudad, y por nombre. */
export function compararDiasCalendario(a: CalendarioDia, b: CalendarioDia): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  const alcance = (ORDEN_ALCANCE[a.alcance] ?? 9) - (ORDEN_ALCANCE[b.alcance] ?? 9)
  if (alcance !== 0) return alcance
  return a.nombre.localeCompare(b.nombre, 'es')
}

/**
 * Días del calendario entre dos fechas. Con `municipio`: los nacionales, los de empresa y los de esa ciudad (sin
 * municipio: todos, de todas las ciudades). `conAnulados` solo para calendar:manage.
 */
export async function leerCalendario(
  desde: string,
  hasta: string,
  opciones: { municipio?: string | null; todasLasCiudades?: boolean; conAnulados?: boolean } = {}
): Promise<CalendarioDia[]> {
  const base = () => {
    const q = supabaseAdmin.from('calendario').select(COLUMNAS_CALENDARIO).gte('fecha', desde).lte('fecha', hasta)
    return opciones.conAnulados ? q : q.is('anulado_at', null)
  }
  const consulta = (filtro: (q: ReturnType<typeof base>) => ReturnType<typeof base>) =>
    fetchAllRows<CalendarioDia>((from, to) => filtro(base()).order('fecha').order('id').range(from, to))
  let filas: CalendarioDia[]
  if (opciones.todasLasCiudades) {
    filas = await consulta(q => q)
  } else {
    const [generales, ciudad] = await Promise.all([
      consulta(q => q.in('alcance', ['nacional', 'empresa'])),
      opciones.municipio
        ? consulta(q => q.eq('alcance', 'ciudad').eq('municipality_id', opciones.municipio as string))
        : Promise.resolve([] as CalendarioDia[]),
    ])
    filas = [...generales, ...ciudad]
  }
  return filas.sort(compararDiasCalendario)
}

/** ¿Estaba activa la persona ese día? (started_at <= d y, si salió, d <= left_at) */
export function activaEn(persona: Pick<PersonaVisitas, 'startedAt' | 'leftAt'>, fecha: string): boolean {
  return (persona.startedAt === null || persona.startedAt <= fecha) && (persona.leftAt === null || fecha <= persona.leftAt)
}

/**
 * Fracción hábil de un día para una persona: su calendario (nacional + empresa + su ciudad) y los días hábiles de
 * la semana vigentes ese día (fraccionHabil). 0 si ese día no estaba activa.
 */
export async function fraccionHabilDe(persona: PersonaVisitas, fecha: string, general: readonly GeneralVigencia[]): Promise<number> {
  if (!activaEn(persona, fecha)) return 0
  const calendario = await leerCalendario(fecha, fecha, { municipio: persona.municipio })
  return fraccionHabil({
    fecha,
    diasHabilesSemana: generalVigente(general, 'dias_habiles_semana', fecha),
    calendario,
    municipio: persona.municipio,
  })
}

// ---------------------------------------------------------------------------------------------
// Días libres
// ---------------------------------------------------------------------------------------------

export const COLUMNAS_DIA_LIBRE =
  'id, executive_id, fecha, fraccion, motivo, nota, estado, registrado_por, registrado_at, fuera_de_plazo, justificacion, revisado_por, revisado_at, motivo_revision, created_at, updated_at'

/** Filas de dias_libres → elementos de la lista (nombre de la ejecutiva, zona, motivo y quién registró o revisó). */
export async function armarDiasLibres(
  filas: readonly DiaLibre[],
  general: readonly GeneralVigencia[],
  hoy: string,
  personasConocidas?: Map<string, PersonaVisitas>
): Promise<DiaLibreItem[]> {
  const faltan = filas.map(fila => fila.executive_id).filter(id => !personasConocidas?.has(id))
  const [personas, usuarios] = await Promise.all([
    faltan.length > 0 ? personasPorId(faltan) : Promise.resolve(new Map<string, PersonaVisitas>()),
    nombresUsuarios(filas.flatMap(fila => [fila.registrado_por, fila.revisado_por])),
  ])
  personasConocidas?.forEach((persona, id) => personas.set(id, persona))
  const motivos = mapaMotivos(general, hoy)
  return filas.map(fila => {
    const persona = personas.get(fila.executive_id)
    return {
      id: fila.id,
      executive_id: fila.executive_id,
      ejecutiva: persona?.nombre ?? 'Ejecutivo Comercial',
      zona: persona?.zona ?? null,
      fecha: fila.fecha,
      fraccion: Number(fila.fraccion),
      motivo: fila.motivo,
      motivo_nombre: motivos.get(fila.motivo) ?? fila.motivo,
      nota: fila.nota,
      estado: fila.estado,
      fuera_de_plazo: Boolean(fila.fuera_de_plazo),
      justificacion: fila.justificacion,
      registrado_por_nombre: fila.registrado_por ? usuarios.get(fila.registrado_por) ?? null : null,
      registrado_at: fila.registrado_at,
      revisado_por_nombre: fila.revisado_por ? usuarios.get(fila.revisado_por) ?? null : null,
      revisado_at: fila.revisado_at,
      motivo_revision: fila.motivo_revision,
    }
  })
}

/** Un día libre vigente (registrado, por aprobar o aprobado) de esa persona en esa fecha, o null. */
async function diaLibreVigente(executiveId: string, fecha: string): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('dias_libres')
    .select('id')
    .eq('executive_id', executiveId)
    .eq('fecha', fecha)
    .in('estado', [...ESTADOS_DIA_LIBRE_VIGENTES])
    .limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as { id: string }) : null
}

/**
 * Registra un día libre (la propia ejecutiva, o quien aprueba por otra persona). Reglas, en orden:
 *   1. el motivo está en motivos_dia_libre vigente hoy (400);
 *   2. el plazo de gracia vigente HOY (puedeRegistrarDiaLibre): fuera de plazo, la ejecutiva recibe 400 con la fecha
 *      límite; quien aprueba puede registrarlo con justificación (queda fuera_de_plazo) o recibe 400;
 *   3. el día es hábil en el calendario de esa persona (400);
 *   4. no hay otro día libre vigente esa fecha (409).
 * Estado: la ejecutiva → según aprobacion_dias_libres.requiere ('por_aprobar' o 'registrado'); quien aprueba → 'aprobado'
 * con revisado_por = él (decisión 3 del contrato). Devuelve 201 { dia }.
 */
export async function registrarDiaLibre(entrada: {
  user: SessionUser
  persona: PersonaVisitas
  datos: { fecha: string; fraccion: number; motivo: string; nota: string | null; justificacion?: string | null }
  porOtra: boolean
  contexto: string
}): Promise<NextResponse> {
  const { user, persona, datos, porOtra, contexto } = entrada
  try {
    const instante = ahora()
    const hoy = hoyBogota(instante)
    const general = await leerGeneral()

    const motivos = generalVigente(general, 'motivos_dia_libre', hoy)
    if (!motivos.some(motivo => motivo.codigo === datos.motivo)) {
      return jsonError('Ese motivo de día libre no está en la lista vigente', 400)
    }

    const plazo = puedeRegistrarDiaLibre({
      fecha: datos.fecha,
      ahora: instante,
      plazoHoras: generalVigente(general, 'plazo_gracia_horas', hoy),
    })
    let fueraDePlazo = false
    if (!plazo.ok) {
      const tarde = plazo.venceAt !== null && instante.getTime() >= plazo.venceAt.getTime()
      if (!porOtra || !tarde) return jsonError(plazo.error ?? 'No se puede registrar ese día libre', 400)
      if (!datos.justificacion) {
        return jsonError(`${plazo.error}. Para registrarlo fuera de plazo escribe una justificación`, 400)
      }
      fueraDePlazo = true
    }

    if ((await fraccionHabilDe(persona, datos.fecha, general)) <= 0) {
      return jsonError(porOtra ? `Ese día no es hábil en el calendario de ${persona.nombre}` : MENSAJE_DIA_NO_HABIL, 400)
    }

    const repetido = porOtra
      ? `${persona.nombre} ya tiene un día libre registrado el ${datos.fecha}`
      : `Ya tienes un día libre registrado el ${datos.fecha}`
    if (await diaLibreVigente(persona.id, datos.fecha)) return jsonError(repetido, 409)

    const momento = instante.toISOString()
    const estado = porOtra ? 'aprobado' : estadoInicialDiaLibre(generalVigente(general, 'aprobacion_dias_libres', hoy).requiere)
    const { data, error } = await supabaseAdmin
      .from('dias_libres')
      .insert({
        executive_id: persona.id,
        fecha: datos.fecha,
        fraccion: datos.fraccion,
        motivo: datos.motivo,
        nota: datos.nota,
        estado,
        registrado_por: user.id,
        registrado_at: momento,
        fuera_de_plazo: fueraDePlazo,
        justificacion: datos.justificacion ?? null,
        revisado_por: estado === 'aprobado' ? user.id : null,
        revisado_at: estado === 'aprobado' ? momento : null,
      })
      .select(COLUMNAS_DIA_LIBRE)
    if (error) {
      if (esViolacionUnica(error)) return jsonError(repetido, 409)
      const traducido = respuestaErrorBase(error, 'Los datos del día libre no son válidos')
      if (traducido) return traducido
      throw error
    }
    const fila = (data || [])[0] as unknown as DiaLibre | undefined
    if (!fila) throw new Error('La base no devolvió el día libre registrado')
    const [dia] = await armarDiasLibres([fila], general, hoy, new Map([[persona.id, persona]]))
    return NextResponse.json({ dia }, { status: 201 })
  } catch (error) {
    return errorVisitas(contexto, error, 'Error al registrar el día libre')
  }
}

/** ¿Puede este usuario aprobar con la configuración vigente hoy? (daysoff:approve y rol en `aprueban`, o admin) */
export function puedeAprobarHoy(user: Pick<SessionUser, 'role'>, general: readonly GeneralVigencia[], hoy: string): boolean {
  if (!hasPermission(user.role, 'daysoff:approve')) return false
  return rolPuedeAprobar(user.role, generalVigente(general, 'aprobacion_dias_libres', hoy))
}

export const MENSAJE_ROL_NO_APRUEBA =
  'Tu rol no está entre quienes aprueban días libres (Configuración → General → Aprobación de días libres)'

// ---------------------------------------------------------------------------------------------
// Cuota del periodo
// ---------------------------------------------------------------------------------------------

/** La cuota del mes con el detalle día a día y la configuración que se leyó para calcularla. */
export interface CuotaDetallada {
  cuota: CuotaResponse
  /** Día a día (cuotaPeriodo.porDia) de la cuota médica y de la institucional. */
  porDia: { medica: DiaCuota[]; institucional: DiaCuota[] }
  /** Filas activas leídas (las mismas que usó la cuota): quien las necesite no vuelve a leerlas. */
  general: GeneralVigencia[]
  personas: ConfigPersona[]
  conteo: ConfigConteo[]
}

/**
 * Cuota de un mes para una persona con las filas reales: metas, configuración de la persona, parámetros generales,
 * conteo (subtipos con meta propia), calendario de ese mes (nacional + empresa + su ciudad) y sus días libres. Todo
 * el cálculo es cuotaPeriodo (lógica pura); aquí solo se arma la respuesta.
 */
export async function calcularCuota(persona: PersonaVisitas, mes: string, hoy: string): Promise<CuotaResponse> {
  return (await calcularCuotaDetallada(persona, mes, hoy)).cuota
}

/**
 * calcularCuota con el detalle día a día (meta de hoy, días hábiles sin visitas) y la configuración leída. La usan
 * /api/me/cuota, /api/me/contexto (meta del día) y /api/me/numeros (cumplimiento del mes): un solo cálculo.
 */
export async function calcularCuotaDetallada(persona: PersonaVisitas, mes: string, hoy: string): Promise<CuotaDetallada> {
  const { desde, hasta } = limitesMes(mes)
  const [metas, personas, general, conteo, calendario, diasLibres, ciudad] = await Promise.all([
    leerConfig('config_metas', { soloActivas: true }),
    leerConfig('config_personas', { soloActivas: true, executiveId: persona.id }),
    leerGeneral(),
    leerConfig('config_conteo', { soloActivas: true }),
    leerCalendario(desde, hasta, { municipio: persona.municipio }),
    fetchAllRows<DiaLibre>((from, to) =>
      supabaseAdmin
        .from('dias_libres')
        .select(COLUMNAS_DIA_LIBRE)
        .eq('executive_id', persona.id)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .in('estado', [...ESTADOS_DIA_LIBRE_VIGENTES])
        .order('fecha')
        .order('id')
        .range(from, to)
    ),
    persona.municipio ? nombreMunicipio(persona.municipio) : Promise.resolve(null),
  ])

  const personaCuota: PersonaCuota = {
    executiveId: persona.id,
    kamId: persona.kamId,
    municipio: persona.municipio,
    startedAt: persona.startedAt,
    leftAt: persona.leftAt,
  }
  const libres = diasLibres.map(dia => ({ ...dia, fraccion: Number(dia.fraccion) }))
  const base = { desde, hasta, hoy, persona: personaCuota, metas, personas, general, calendario, diasLibres: libres }
  const medica = cuotaPeriodo({ ...base, tipo: 'medica' })
  const institucional = cuotaPeriodo({ ...base, tipo: 'institucional' })

  const idsSubtipos = subtiposConMetaPropia(conteo, desde, hasta)
  const nombresSubtipos = new Map<string, string>()
  if (idsSubtipos.length > 0) {
    const filas = await leerPorIds<{ id: string; nombre: string }>(idsSubtipos, (trozo, from, to) =>
      supabaseAdmin.from('subtipos_institucionales').select('id, nombre').in('id', trozo).order('id').range(from, to)
    )
    for (const fila of filas) nombresSubtipos.set(fila.id, fila.nombre)
  }
  const subtipos: CuotaSubtipo[] = idsSubtipos.map(subtipoId => ({
    subtipo_id: subtipoId,
    nombre: nombresSubtipos.get(subtipoId) ?? 'Subtipo',
    ...resumenCuotaTipo(cuotaPeriodo({ ...base, tipo: 'institucional', subtipoId, conteo })),
  }))

  const cuota: CuotaResponse = {
    mes,
    ejecutiva: { id: persona.id, nombre: persona.nombre },
    zona: persona.kamId ? { id: persona.kamId, nombre: persona.zona ?? 'Zona' } : null,
    municipio: persona.municipio,
    ciudad,
    perfil: configPersonaVigente(personas, general, persona.id, hoy).perfil,
    medica: resumenCuotaTipo(medica),
    institucional: resumenCuotaTipo(institucional),
    subtipos,
    dias_habiles: medica.diasHabiles,
    dias_habiles_transcurridos: medica.diasHabilesTranscurridos,
    dias_habiles_por_delante: medica.diasHabilesPorDelante,
    dias_libres: medica.diasLibres,
    dias_por_aprobar: medica.diasPorAprobar,
    ritmo: ritmo(medica.diasHabilesTranscurridos, medica.diasHabiles),
  }
  return { cuota, porDia: { medica: medica.porDia, institucional: institucional.porDia }, general, personas, conteo }
}

// ---------------------------------------------------------------------------------------------
// Varios
// ---------------------------------------------------------------------------------------------

/** Lista de ids en trozos para .in('id', trozo) en escrituras (URL corta). */
export const trozosDeIds = (ids: readonly string[]) => enTrozos(ids, 100)

/** Nombres de municipios (re-exportado para las rutas del calendario). */
export { nombreMunicipio, nombresMunicipios }
