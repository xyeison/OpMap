// Empresas y papeles (capa 1): acceso a datos de la sesión. Las reglas puras están en lib/empresas-reglas.ts.
//
// La empresa activa es POR PERSONA (users.empresa_activa_id); el claim emp del token es solo una caché. Mientras el
// dueño no aplique la 0960 (previews de Vercel) las tablas no existen: cargarPapelesDeUsuario devuelve 'sin_tabla' y
// la sesión sigue con users.role como único papel.
import { getSupabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import {
  EMPRESA_VG_ID,
  MENSAJE_LIDER_NACIONAL_UNICO,
  MENSAJE_LIDER_ZONAS_SOLAPADAS,
  MENSAJE_LINEA_FUERA_DE_EMPRESA,
  MENSAJE_PERSONA_FUERA_DE_EMPRESA,
  cacheLiderDe,
  cacheRolDe,
  empresaActivaDe,
  papelMasAlto,
  validarLiderDeLinea,
  type Empresa,
  type PapelActivo,
  type PapelEntrada,
} from './empresas-reglas'
import { firstIssueMessage, listaPapelesSchema } from './user-schemas'
import { recomputeAndSaveCoverage } from './coverage'
import type { Role } from './permissions'
import type { SessionUser } from './auth-server'
import type { EmpresaMovil } from './reporte-visitas'

export interface PapelesDeUsuario {
  empresas: Empresa[]
  papeles: PapelActivo[]
  empresaActivaId: string | null
}

const COLUMNAS_EMPRESA = 'id, codigo, nombre, nombre_corto, activa'

interface ErrorPostgrest {
  code?: string
  message: string
}

/** PostgREST: tabla inexistente (42P01) o fuera de la caché de esquema (PGRST205); columna inexistente (42703). */
export function faltaLa0960(error: ErrorPostgrest | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === '42703'
}

/**
 * Papeles activos de la persona en empresas activas, con sus Zonas, las empresas donde los tiene (por código) y su
 * empresa activa guardada. 'sin_tabla' si la 0960 no está aplicada. Lanza ante cualquier otro error de la base.
 */
export async function cargarPapelesDeUsuario(
  userId: string,
  opciones: { empresaActivaId?: string | null } = {},
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<PapelesDeUsuario | 'sin_tabla'> {
  // Quien ya leyó la fila de users (la sesión) pasa empresaActivaId y se ahorra la segunda lectura; undefined = no la sabe
  const conocida = opciones.empresaActivaId !== undefined
  const [papelesRes, usuarioRes] = await Promise.all([
    db.from('papeles').select('id, empresa_id, papel, line_id').eq('user_id', userId).eq('activo', true),
    conocida
      ? Promise.resolve({ data: { empresa_activa_id: opciones.empresaActivaId ?? null }, error: null })
      : db.from('users').select('empresa_activa_id').eq('id', userId).maybeSingle(),
  ])
  if (faltaLa0960(papelesRes.error) || faltaLa0960(usuarioRes.error)) return 'sin_tabla'
  if (papelesRes.error) throw new Error(`papeles: ${papelesRes.error.message}`)
  if (usuarioRes.error) throw new Error(`users.empresa_activa_id: ${usuarioRes.error.message}`)

  const empresaActivaId = ((usuarioRes.data as { empresa_activa_id?: string | null } | null)?.empresa_activa_id) ?? null
  const filas = (papelesRes.data || []) as { id: string; empresa_id: string; papel: Role; line_id: string | null }[]
  if (filas.length === 0) return { empresas: [], papeles: [], empresaActivaId }

  const idsEmpresa = Array.from(new Set(filas.map(f => f.empresa_id)))
  const [zonasRes, empresasRes] = await Promise.all([
    db.from('papel_zonas').select('papel_id, kam_id').in('papel_id', filas.map(f => f.id)),
    db.from('empresas').select(COLUMNAS_EMPRESA).in('id', idsEmpresa).eq('activa', true).order('codigo'),
  ])
  if (faltaLa0960(zonasRes.error) || faltaLa0960(empresasRes.error)) return 'sin_tabla'
  if (zonasRes.error) throw new Error(`papel_zonas: ${zonasRes.error.message}`)
  if (empresasRes.error) throw new Error(`empresas: ${empresasRes.error.message}`)

  const zonasDe = new Map<string, string[]>()
  for (const { papel_id, kam_id } of (zonasRes.data || []) as { papel_id: string; kam_id: string }[]) {
    zonasDe.set(papel_id, [...(zonasDe.get(papel_id) ?? []), kam_id])
  }
  const empresas = (empresasRes.data || []) as Empresa[]
  const activas = new Set(empresas.map(e => e.id))
  const papeles: PapelActivo[] = filas
    .filter(f => activas.has(f.empresa_id))
    .map(f => ({ id: f.id, empresa_id: f.empresa_id, papel: f.papel, line_id: f.line_id, kam_ids: zonasDe.get(f.id) ?? [] }))

  return { empresas, papeles, empresaActivaId }
}

/** Empresas activas, por código. Sin la 0960 (tabla inexistente), ninguna. Lanza ante cualquier otro error de la base. */
export async function listarEmpresas(db: SupabaseAdminClient = getSupabaseAdmin()): Promise<Empresa[]> {
  const { data, error } = await db.from('empresas').select(COLUMNAS_EMPRESA).eq('activa', true).order('codigo')
  if (faltaLa0960(error)) return []
  if (error) throw new Error(`empresas: ${error.message}`)
  return (data || []) as Empresa[]
}

/**
 * Guarda la empresa activa de la persona (users.empresa_activa_id) y la devuelve. 'sin_papel' si no tiene un papel
 * activo en esa empresa, si la empresa no existe o está inactiva, o si la 0960 no está aplicada; entonces no escribe.
 */
export async function cambiarEmpresaActiva(
  userId: string,
  empresaId: string,
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<Empresa | 'sin_papel'> {
  const cargado = await cargarPapelesDeUsuario(userId, {}, db)
  if (cargado === 'sin_tabla') return 'sin_papel'
  const empresa = cargado.empresas.find(e => e.id === empresaId)
  if (!empresa || !cargado.papeles.some(p => p.empresa_id === empresaId)) return 'sin_papel'

  const { error } = await db.from('users').update({ empresa_activa_id: empresaId }).eq('id', userId)
  if (error) throw new Error(`users.empresa_activa_id: ${error.message}`)
  return empresa
}

/**
 * La sesión a partir del usuario y sus papeles. Con datos: empresa activa (columna > claim > VG > menor código), los
 * papeles de esa empresa y su papel más alto como role ('user' sin papeles). Sin la 0960: users.role como único papel.
 */
export function sesionDesdePapeles(
  base: { id: string; email: string; full_name: string; active: boolean; role: Role },
  cargado: PapelesDeUsuario | 'sin_tabla',
  claimEmp: string | null
): SessionUser {
  const persona = { id: base.id, email: base.email, full_name: base.full_name, active: base.active }
  if (cargado === 'sin_tabla') {
    return {
      ...persona,
      role: base.role,
      empresa: null,
      empresas: [],
      papeles: [{ id: 'rol', empresa_id: '', papel: base.role, line_id: null, kam_ids: [] }],
    }
  }
  const empresa = empresaActivaDe({ empresaActivaId: cargado.empresaActivaId, claimEmp, empresas: cargado.empresas })
  const papeles = empresa ? cargado.papeles.filter(p => p.empresa_id === empresa.id) : []
  return { ...persona, role: papelMasAlto(papeles), empresa, empresas: cargado.empresas, papeles }
}

type FilaDeUsuario = { id: string; email: string; full_name: string; active: boolean; role: Role; empresa_activa_id?: string | null }

/**
 * La sesión a partir de una fila de users leída con select('*'): sin la columna users.empresa_activa_id la 0960 no está
 * aplicada y ni se piden los papeles (users.role es el único). La usan getUserFromRequest y el login. Copia solo los
 * campos de la sesión (nunca la contraseña). Lanza si la base falla al leer los papeles.
 */
export async function cargarSesionDeFila(fila: FilaDeUsuario, claimEmp: string | null): Promise<SessionUser> {
  const cargado =
    'empresa_activa_id' in fila ? await cargarPapelesDeUsuario(fila.id, { empresaActivaId: fila.empresa_activa_id ?? null }) : 'sin_tabla'
  return sesionDesdePapeles(fila, cargado, claimEmp)
}

/** La empresa como la ven la app y las respuestas de sesión: { id, codigo, nombre_corto }. */
export function empresaMovil(empresa: Empresa): EmpresaMovil {
  return { id: empresa.id, codigo: empresa.codigo, nombre_corto: empresa.nombre_corto }
}

/** Lo de empresas que llevan /api/auth/me y el login: la activa, las empresas donde tiene papel y sus papeles allí. */
export function empresasDeSesion(user: Pick<SessionUser, 'empresa' | 'empresas' | 'papeles'>): {
  empresa: EmpresaMovil | null
  empresas: EmpresaMovil[]
  papeles: PapelActivo[]
} {
  return { empresa: user.empresa ? empresaMovil(user.empresa) : null, empresas: user.empresas.map(empresaMovil), papeles: user.papeles }
}

// ---------------------------------------------------------------------------
// Papeles por empresa: escritura (PUT /api/users/[id]/papeles, POST /api/users y PUT /api/users/[id] con role)
// ---------------------------------------------------------------------------

export const MENSAJE_FALTA_0960 = 'Falta aplicar la migración 0960'

/** La 0960 no está aplicada (tabla o columna inexistente): las rutas que escriben papeles responden 503. */
export class Falta0960Error extends Error {
  constructor() {
    super(MENSAJE_FALTA_0960)
    this.name = 'Falta0960Error'
  }
}

/** Una regla de la base (disparadores de la 0960) rechazó la escritura: se responde con su mensaje. */
class ReglaDeLaBase extends Error {
  constructor(readonly status: 400 | 409, mensaje: string) {
    super(mensaje)
    this.name = 'ReglaDeLaBase'
  }
}

export interface AfectadosDeQuitarEjecutivo {
  /** Líneas que la persona pierde en Zonas: en VG, las de executive_lines y las de sus asignaciones de VG, sin repetir. */
  lineas: number
  asignaciones: number
  visitantes: number
}

export type ResultadoPapeles =
  // cobertura_recalculada solo cuando se borraron executive_lines (quitar sales_manager en VG): false si el recálculo falló
  | { ok: true; papeles: PapelActivo[]; afectados: AfectadosDeQuitarEjecutivo; cobertura_recalculada?: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string }

type PapelNormalizado = { papel: Role; line_id: string | null; kam_ids: string[] }
type FilaPapel = { id: string; user_id: string; empresa_id: string; papel: Role; line_id: string | null; activo: boolean }

const clave = (p: { papel: string; line_id: string | null }) => `${p.papel}|${p.line_id ?? ''}`

/** data de una respuesta de PostgREST; Falta0960Error sin la tabla; ReglaDeLaBase con un mensaje de la 0960. */
function datos<T>(res: { data: unknown; error: ErrorPostgrest | null }, que: string): T {
  if (faltaLa0960(res.error)) throw new Falta0960Error()
  if (res.error) {
    const mensaje = res.error.message || ''
    if (mensaje.includes(MENSAJE_LINEA_FUERA_DE_EMPRESA)) throw new ReglaDeLaBase(400, MENSAJE_LINEA_FUERA_DE_EMPRESA)
    for (const regla of [MENSAJE_LIDER_NACIONAL_UNICO, MENSAJE_LIDER_ZONAS_SOLAPADAS, MENSAJE_PERSONA_FUERA_DE_EMPRESA]) {
      if (mensaje.includes(regla)) throw new ReglaDeLaBase(409, regla)
    }
    throw new Error(`${que}: ${mensaje}`)
  }
  return res.data as T
}

/** Zonas (papel_zonas) de cada papel. */
async function zonasDePapeles(ids: string[], db: SupabaseAdminClient): Promise<Map<string, string[]>> {
  const zonas = new Map<string, string[]>()
  if (ids.length === 0) return zonas
  const filas = datos<{ papel_id: string; kam_id: string }[]>(
    await db.from('papel_zonas').select('papel_id, kam_id').in('papel_id', ids),
    'papel_zonas'
  )
  for (const { papel_id, kam_id } of filas || []) zonas.set(papel_id, [...(zonas.get(papel_id) ?? []), kam_id])
  return zonas
}

/** users.role (caché hasta la capa 4) = el papel más alto de la persona en VG; 'user' si no tiene ninguno. */
export async function escribirCacheDeUsuario(userId: string, db: SupabaseAdminClient = getSupabaseAdmin()): Promise<void> {
  const filas = datos<{ papel: Role }[]>(
    await db.from('papeles').select('papel').eq('user_id', userId).eq('empresa_id', EMPRESA_VG_ID).eq('activo', true),
    'papeles (caché del rol)'
  )
  datos(await db.from('users').update({ role: cacheRolDe(filas || []) }).eq('id', userId), 'users.role')
}

/** business_lines.leader_user_id (caché hasta la capa 4) = la líder nacional de la línea en VG; null si no hay. */
export async function escribirCacheDeLinea(lineId: string, db: SupabaseAdminClient = getSupabaseAdmin()): Promise<void> {
  const lideres = datos<{ id: string; user_id: string }[]>(
    await db
      .from('papeles')
      .select('id, user_id')
      .eq('line_id', lineId)
      .eq('empresa_id', EMPRESA_VG_ID)
      .eq('papel', 'line_leader')
      .eq('activo', true),
    'papeles (caché de la líder)'
  ) || []
  const zonas = await zonasDePapeles(lideres.map(l => l.id), db)
  const lider = cacheLiderDe(lideres.map(l => ({ user_id: l.user_id, kam_ids: zonas.get(l.id) ?? [] })))
  datos(await db.from('business_lines').update({ leader_user_id: lider }).eq('id', lineId), 'business_lines.leader_user_id')
}

/**
 * La persona del equipo comercial (o vacante) pertenece a la empresa: crea o reactiva su executive_empresas.
 * 'sin_tabla' sin la 0960 (no escribe nada). Lanza ante cualquier otro error de la base.
 */
export async function asegurarExecutiveEmpresa(
  executiveId: string,
  empresaId: string,
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<'ok' | 'sin_tabla'> {
  const { error } = await db
    .from('executive_empresas')
    .upsert({ executive_id: executiveId, empresa_id: empresaId, activo: true }, { onConflict: 'executive_id,empresa_id' })
  if (error?.code === '42P01' || error?.code === 'PGRST205') return 'sin_tabla'
  if (error) throw new Error(`executive_empresas: ${error.message}`)
  return 'ok'
}

/**
 * Qué se pierde al quitarle el papel sales_manager en una empresa a una persona (vía executives.user_id): cuántas
 * líneas pierde en Zonas, cuántas asignaciones de esa empresa se borran y cuántos visitantes vivos (hasta IS NULL) de
 * esas líneas terminan. En VG, entre la 0960 y la 0970, la verdad es executive_lines (las asignaciones son su espejo de
 * la semilla y las líneas dadas después solo están en executive_lines): las líneas son la unión de las dos, y borrar
 * sus executive_lines cierra (disparador de la 0820) los visitantes vivos de esas líneas. En otra empresa, las líneas
 * de sus asignaciones allí y los visitantes de esa empresa en ellas. Sin fila en executives: nada.
 */
export async function afectadosDeQuitarEjecutivo(
  userId: string,
  empresaId: string,
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<AfectadosDeQuitarEjecutivo & { executiveIds: string[] }> {
  const personas = datos<{ id: string }[]>(await db.from('executives').select('id').eq('user_id', userId), 'executives') || []
  const executiveIds = personas.map(p => p.id)
  if (executiveIds.length === 0) return { executiveIds, lineas: 0, asignaciones: 0, visitantes: 0 }

  const asignaciones = datos<{ id: string; line_id: string }[]>(
    await db.from('asignaciones').select('id, line_id').in('executive_id', executiveIds).eq('empresa_id', empresaId),
    'asignaciones'
  ) || []
  const lineas = new Set(asignaciones.map(a => a.line_id))
  if (empresaId === EMPRESA_VG_ID) {
    const enZonas = datos<{ line_id: string }[]>(
      await db.from('executive_lines').select('line_id').in('executive_id', executiveIds),
      'executive_lines'
    ) || []
    for (const { line_id } of enZonas) lineas.add(line_id)
  }
  let visitantes: { id: string }[] = []
  if (lineas.size > 0) {
    let consulta = db
      .from('medico_visitantes')
      .select('id')
      .in('executive_id', executiveIds)
      .in('line_id', Array.from(lineas))
      .is('hasta', null)
    if (empresaId !== EMPRESA_VG_ID) consulta = consulta.eq('empresa_id', empresaId)
    visitantes = datos<{ id: string }[]>(await consulta, 'medico_visitantes') || []
  }
  return { executiveIds, lineas: lineas.size, asignaciones: asignaciones.length, visitantes: visitantes.length }
}

/**
 * Valida una lista de papeles para una persona en una empresa sin escribir nada: la forma (400), que la empresa exista
 * (404), que cada línea de líder esté en la empresa y sus Zonas existan (400) y la regla de líder por línea contra las
 * OTRAS personas (409).
 * Devuelve la lista normalizada. POST /api/users la usa antes de crear al usuario.
 */
export async function validarPapeles(
  entrada: { userId: string; empresaId: string; papeles: PapelEntrada[] },
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<{ ok: true; papeles: PapelNormalizado[] } | { ok: false; status: 400 | 404 | 409; error: string }> {
  const forma = listaPapelesSchema.safeParse(entrada.papeles)
  if (!forma.success) return { ok: false, status: 400, error: firstIssueMessage(forma.error) }
  const papeles = forma.data

  const empresa = datos<{ id: string } | null>(
    await db.from('empresas').select('id').eq('id', entrada.empresaId).maybeSingle(),
    'empresas'
  )
  if (!empresa) return { ok: false, status: 404, error: 'Empresa no encontrada' }

  const lideres = papeles.filter(p => p.papel === 'line_leader' && p.line_id)
  const lineas = Array.from(new Set(lideres.map(p => p.line_id as string)))
  if (lineas.length === 0) return { ok: true, papeles }

  const zonasPedidas = Array.from(new Set(lideres.flatMap(p => p.kam_ids)))
  if (zonasPedidas.length > 0) {
    const existen = datos<{ id: string }[]>(await db.from('kams').select('id').in('id', zonasPedidas), 'kams') || []
    if (existen.length !== zonasPedidas.length) return { ok: false, status: 400, error: 'Alguna de las Zonas no existe' }
  }

  const enEmpresa = datos<{ line_id: string }[]>(
    await db.from('linea_empresas').select('line_id').eq('empresa_id', entrada.empresaId).in('line_id', lineas),
    'linea_empresas'
  ) || []
  const presentes = new Set(enEmpresa.map(l => l.line_id))
  if (lineas.some(l => !presentes.has(l))) return { ok: false, status: 400, error: MENSAJE_LINEA_FUERA_DE_EMPRESA }

  const otras = datos<{ id: string; user_id: string; line_id: string }[]>(
    await db
      .from('papeles')
      .select('id, user_id, line_id')
      .eq('empresa_id', entrada.empresaId)
      .eq('papel', 'line_leader')
      .eq('activo', true)
      .in('line_id', lineas)
      .neq('user_id', entrada.userId),
    'papeles (líderes de la línea)'
  ) || []
  const zonas = await zonasDePapeles(otras.map(o => o.id), db)
  for (const lider of lideres) {
    const existentes = otras.filter(o => o.line_id === lider.line_id).map(o => ({ user_id: o.user_id, kam_ids: zonas.get(o.id) ?? [] }))
    const regla = validarLiderDeLinea(existentes, { user_id: entrada.userId, kam_ids: lider.kam_ids })
    if (!regla.ok) return { ok: false, status: 409, error: regla.error }
  }
  return { ok: true, papeles }
}

/** Papeles activos de la persona en una empresa, con sus Zonas. */
async function papelesActivosEn(userId: string, empresaId: string, db: SupabaseAdminClient): Promise<PapelActivo[]> {
  const filas = datos<FilaPapel[]>(
    await db.from('papeles').select('id, user_id, empresa_id, papel, line_id, activo').eq('user_id', userId).eq('empresa_id', empresaId).eq('activo', true),
    'papeles'
  ) || []
  const zonas = await zonasDePapeles(filas.map(f => f.id), db)
  return filas.map(f => ({ id: f.id, empresa_id: f.empresa_id, papel: f.papel, line_id: f.line_id, kam_ids: zonas.get(f.id) ?? [] }))
}

/**
 * Reemplaza los papeles de una persona en UNA empresa por la lista dada (delta contra lo que tiene; nunca borra un
 * papel: lo desactiva, y lo reactiva si vuelve). Valida con validarPapeles (400/404/409). Quitar sales_manager borra las
 * asignaciones de la persona en esa empresa (y en VG sus executive_lines: la 0820 cierra sus visitantes) y la deja con
 * executive_empresas.activo = false; darlo crea o reactiva su executive_empresas. Al final escribe las cachés
 * users.role y leader_user_id de cada línea tocada. Con simular solo cuenta (afectados) y no escribe.
 *
 * Sin transacción (PostgREST): el orden de las escrituras respeta la regla diferida de la 0960 (papeles_lider_unico,
 * que mira cada petición al confirmar): una líder por Zonas entra INACTIVA, recibe sus Zonas y luego se activa; al
 * cambiar Zonas primero se añaden las nuevas y después se quitan las que sobran. Lanza Falta0960Error sin la 0960.
 */
export async function reemplazarPapeles(
  entrada: { userId: string; empresaId: string; papeles: PapelEntrada[]; creadoPor: string; simular?: boolean },
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<ResultadoPapeles> {
  const forma = listaPapelesSchema.safeParse(entrada.papeles)
  if (!forma.success) return { ok: false, status: 400, error: firstIssueMessage(forma.error) }

  const usuario = datos<{ id: string } | null>(await db.from('users').select('id').eq('id', entrada.userId).maybeSingle(), 'users')
  if (!usuario) return { ok: false, status: 404, error: 'Usuario no encontrado' }

  const validado = await validarPapeles(entrada, db)
  if (!validado.ok) return validado
  const nuevos = validado.papeles

  // Todo lo que la persona tiene o tuvo en esa empresa (el índice único de la 0960 cuenta también los inactivos)
  const filas = datos<FilaPapel[]>(
    await db.from('papeles').select('id, user_id, empresa_id, papel, line_id, activo').eq('user_id', entrada.userId).eq('empresa_id', entrada.empresaId),
    'papeles'
  ) || []
  const zonasActuales = await zonasDePapeles(filas.filter(f => f.papel === 'line_leader').map(f => f.id), db)
  const porClave = new Map(filas.map(f => [clave(f), f]))
  const clavesNuevas = new Set(nuevos.map(clave))

  const quitar = filas.filter(f => f.activo && !clavesNuevas.has(clave(f)))
  const reactivar: { fila: FilaPapel; nuevo: PapelNormalizado }[] = []
  const cambiarZonas: { fila: FilaPapel; nuevo: PapelNormalizado }[] = []
  const insertar: PapelNormalizado[] = []
  for (const nuevo of nuevos) {
    const fila = porClave.get(clave(nuevo))
    if (!fila) insertar.push(nuevo)
    else if (!fila.activo) reactivar.push({ fila, nuevo })
    else if (nuevo.papel === 'line_leader') {
      const antes = zonasActuales.get(fila.id) ?? []
      if (antes.length !== nuevo.kam_ids.length || antes.some(k => !nuevo.kam_ids.includes(k))) cambiarZonas.push({ fila, nuevo })
    }
  }

  const quitaEjecutivo = quitar.some(f => f.papel === 'sales_manager')
  const daEjecutivo = insertar.some(p => p.papel === 'sales_manager') || reactivar.some(r => r.nuevo.papel === 'sales_manager')
  const afectados = quitaEjecutivo
    ? await afectadosDeQuitarEjecutivo(entrada.userId, entrada.empresaId, db)
    : { executiveIds: [], lineas: 0, asignaciones: 0, visitantes: 0 }

  if (entrada.simular) {
    return {
      ok: true,
      papeles: await papelesActivosEn(entrada.userId, entrada.empresaId, db),
      afectados: { lineas: afectados.lineas, asignaciones: afectados.asignaciones, visitantes: afectados.visitantes },
    }
  }

  let lineasBorradas = false
  try {
    // 1. Desactivar lo que ya no lleva
    if (quitar.length > 0) {
      datos(await db.from('papeles').update({ activo: false }).in('id', quitar.map(f => f.id)), 'papeles (desactivar)')
    }
    // 2. Zonas de las líderes que se quedan: primero las nuevas y después las que sobran (nunca queda nacional a medias)
    for (const { fila, nuevo } of cambiarZonas) {
      const antes = zonasActuales.get(fila.id) ?? []
      const anadir = nuevo.kam_ids.filter(k => !antes.includes(k))
      const sobran = antes.filter(k => !nuevo.kam_ids.includes(k))
      if (anadir.length > 0) {
        datos(await db.from('papel_zonas').insert(anadir.map(kam_id => ({ papel_id: fila.id, kam_id }))), 'papel_zonas')
      }
      if (sobran.length > 0) {
        datos(await db.from('papel_zonas').delete().eq('papel_id', fila.id).in('kam_id', sobran), 'papel_zonas (quitar)')
      }
    }
    // 3. Reactivar: con la fila aún inactiva se le ponen sus Zonas; luego se activa
    for (const { fila, nuevo } of reactivar) {
      if ((zonasActuales.get(fila.id) ?? []).length > 0) {
        datos(await db.from('papel_zonas').delete().eq('papel_id', fila.id), 'papel_zonas (reactivar)')
      }
      if (nuevo.kam_ids.length > 0) {
        datos(await db.from('papel_zonas').insert(nuevo.kam_ids.map(kam_id => ({ papel_id: fila.id, kam_id }))), 'papel_zonas')
      }
      datos(await db.from('papeles').update({ activo: true }).eq('id', fila.id), 'papeles (reactivar)')
    }
    // 4. Insertar: los que no tienen Zonas, activos de una vez; una líder por Zonas, inactiva → Zonas → activa
    const fila = (p: PapelNormalizado, activo: boolean) => ({
      user_id: entrada.userId,
      empresa_id: entrada.empresaId,
      papel: p.papel,
      line_id: p.line_id,
      activo,
      created_by: entrada.creadoPor,
    })
    const directos = insertar.filter(p => p.kam_ids.length === 0)
    if (directos.length > 0) datos(await db.from('papeles').insert(directos.map(p => fila(p, true))), 'papeles (insertar)')
    for (const p of insertar.filter(x => x.kam_ids.length > 0)) {
      const [creado] = datos<{ id: string }[]>(await db.from('papeles').insert(fila(p, false)).select('id'), 'papeles (insertar)') || []
      if (!creado) throw new Error('papeles (insertar): sin fila devuelta')
      datos(await db.from('papel_zonas').insert(p.kam_ids.map(kam_id => ({ papel_id: creado.id, kam_id }))), 'papel_zonas')
      datos(await db.from('papeles').update({ activo: true }).eq('id', creado.id), 'papeles (activar)')
    }

    // 5. La persona del equipo comercial: quitar sales_manager borra sus asignaciones de la empresa; darlo la incluye
    if (quitaEjecutivo && afectados.executiveIds.length > 0) {
      const ids = afectados.executiveIds
      datos(await db.from('asignaciones').delete().in('executive_id', ids).eq('empresa_id', entrada.empresaId), 'asignaciones (borrar)')
      if (entrada.empresaId === EMPRESA_VG_ID) {
        // El disparador executive_lines_termina_visitantes de la 0820 cierra sus visitantes ('linea_quitada')
        const borradas = datos<{ line_id: string }[]>(
          await db.from('executive_lines').delete().in('executive_id', ids).select('line_id'),
          'executive_lines (borrar)'
        ) || []
        lineasBorradas = borradas.length > 0
      }
      datos(
        await db.from('executive_empresas').update({ activo: false }).in('executive_id', ids).eq('empresa_id', entrada.empresaId),
        'executive_empresas (desactivar)'
      )
    }
    if (daEjecutivo) {
      const personas = datos<{ id: string }[]>(await db.from('executives').select('id').eq('user_id', entrada.userId), 'executives') || []
      for (const persona of personas) await asegurarExecutiveEmpresa(persona.id, entrada.empresaId, db)
    }

    // 6. Cachés de la transición (hasta la capa 4)
    await escribirCacheDeUsuario(entrada.userId, db)
    const lineasTocadas = new Set<string>()
    for (const f of filas) if (f.papel === 'line_leader' && f.line_id) lineasTocadas.add(f.line_id)
    for (const p of nuevos) if (p.papel === 'line_leader' && p.line_id) lineasTocadas.add(p.line_id)
    for (const lineId of Array.from(lineasTocadas)) await escribirCacheDeLinea(lineId, db)
  } catch (error) {
    if (error instanceof ReglaDeLaBase) return { ok: false, status: error.status, error: error.message }
    throw error
  }

  // Quien pierde líneas "ya no está": se recalcula la cobertura como en PATCH /api/executives (recalcularCobertura,
  // global y sin Google Maps). Si falla, el cambio ya quedó guardado: se registra y se avisa con false.
  let cobertura_recalculada: boolean | undefined
  if (lineasBorradas) {
    try {
      await recomputeAndSaveCoverage(db)
      cobertura_recalculada = true
    } catch (error) {
      console.error('reemplazarPapeles: el cambio se guardó, pero falló el recálculo de la cobertura:', error)
      cobertura_recalculada = false
    }
  }

  return {
    ok: true,
    papeles: await papelesActivosEn(entrada.userId, entrada.empresaId, db),
    afectados: { lineas: afectados.lineas, asignaciones: afectados.asignaciones, visitantes: afectados.visitantes },
    ...(cobertura_recalculada === undefined ? {} : { cobertura_recalculada }),
  }
}

/**
 * true si quitarle a la persona su papel de administrador (en una empresa, o en todas con null: desactivarla) dejaría
 * OpMap sin ningún administrador activo. false si no es administradora allí. 'sin_tabla' sin la 0960.
 */
export async function dejaSinAdministradores(
  userId: string,
  empresaId: string | null,
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<boolean | 'sin_tabla'> {
  const res = await db.from('papeles').select('user_id, empresa_id').eq('papel', 'admin').eq('activo', true)
  if (faltaLa0960(res.error)) return 'sin_tabla'
  const admins = datos<{ user_id: string; empresa_id: string }[]>(res, 'papeles (administradores)') || []
  const enAlcance = (a: { user_id: string; empresa_id: string }) => a.user_id === userId && (empresaId === null || a.empresa_id === empresaId)
  if (!admins.some(enAlcance)) return false
  const otros = Array.from(new Set(admins.filter(a => !enAlcance(a)).map(a => a.user_id)))
  if (otros.length === 0) return true
  const activos = datos<{ id: string }[]>(await db.from('users').select('id').in('id', otros).eq('active', true), 'users') || []
  return activos.length === 0
}

/** Papeles activos de todas las personas (todas las empresas), por usuario. 'sin_tabla' sin la 0960. */
export async function papelesDeTodos(db: SupabaseAdminClient = getSupabaseAdmin()): Promise<Map<string, PapelActivo[]> | 'sin_tabla'> {
  const res = await db.from('papeles').select('id, user_id, empresa_id, papel, line_id').eq('activo', true).range(0, 9999)
  if (faltaLa0960(res.error)) return 'sin_tabla'
  const filas = datos<Omit<FilaPapel, 'activo'>[]>(res, 'papeles') || []
  // Todas las Zonas de una vez (tabla pequeña): sin una lista de ids enorme en la URL
  const zonasRes = await db.from('papel_zonas').select('papel_id, kam_id').range(0, 99999)
  if (faltaLa0960(zonasRes.error)) return 'sin_tabla'
  const zonas = new Map<string, string[]>()
  for (const { papel_id, kam_id } of datos<{ papel_id: string; kam_id: string }[]>(zonasRes, 'papel_zonas') || []) {
    zonas.set(papel_id, [...(zonas.get(papel_id) ?? []), kam_id])
  }
  const porUsuario = new Map<string, PapelActivo[]>()
  for (const f of filas) {
    const papel: PapelActivo = { id: f.id, empresa_id: f.empresa_id, papel: f.papel, line_id: f.line_id, kam_ids: zonas.get(f.id) ?? [] }
    porUsuario.set(f.user_id, [...(porUsuario.get(f.user_id) ?? []), papel])
  }
  return porUsuario
}
