// Empresas y papeles (capa 1): acceso a datos de la sesión. Las reglas puras están en lib/empresas-reglas.ts.
//
// La empresa activa es POR PERSONA (users.empresa_activa_id); el claim emp del token es solo una caché. Mientras el
// dueño no aplique la 0960 (previews de Vercel) las tablas no existen: cargarPapelesDeUsuario devuelve 'sin_tabla' y
// la sesión sigue con users.role como único papel.
import { getSupabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import { empresaActivaDe, papelMasAlto, type Empresa, type PapelActivo } from './empresas-reglas'
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
function faltaLa0960(error: ErrorPostgrest | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === '42703'
}

/**
 * Papeles activos de la persona en empresas activas, con sus Zonas, las empresas donde los tiene (por código) y su
 * empresa activa guardada. 'sin_tabla' si la 0960 no está aplicada. Lanza ante cualquier otro error de la base.
 */
export async function cargarPapelesDeUsuario(
  userId: string,
  db: SupabaseAdminClient = getSupabaseAdmin()
): Promise<PapelesDeUsuario | 'sin_tabla'> {
  const [papelesRes, usuarioRes] = await Promise.all([
    db.from('papeles').select('id, empresa_id, papel, line_id').eq('user_id', userId).eq('activo', true),
    db.from('users').select('empresa_activa_id').eq('id', userId).maybeSingle(),
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
  const cargado = await cargarPapelesDeUsuario(userId, db)
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

type FilaDeUsuario = { id: string; email: string; full_name: string; active: boolean; role: Role }

/**
 * La sesión a partir de una fila de users leída con select('*'): sin la columna users.empresa_activa_id la 0960 no está
 * aplicada y ni se piden los papeles (users.role es el único). La usan getUserFromRequest y el login. Copia solo los
 * campos de la sesión (nunca la contraseña). Lanza si la base falla al leer los papeles.
 */
export async function cargarSesionDeFila(fila: FilaDeUsuario, claimEmp: string | null): Promise<SessionUser> {
  const cargado = 'empresa_activa_id' in fila ? await cargarPapelesDeUsuario(fila.id) : 'sin_tabla'
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
