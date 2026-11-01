// Empresas y papeles (capa 1): reglas puras, sin acceso a datos.
//
// Cada persona tiene "papeles" por empresa; lo que puede hacer es la SUMA de sus papeles en la empresa activa.
// Aquí viven las reglas que no dependen de la base: papel más alto, permiso por suma, empresa activa, líder de línea
// (una nacional, o varias por Zonas sin solaparse) y el espejo en TypeScript de la semilla SQL de papeles.

import { getRoleTitle, hasPermission, type Permission, type Role } from './permissions'

export const EMPRESA_VG_ID = 'a0000000-0000-4000-8000-000000000001'
export const EMPRESA_MEDIX_ID = 'a0000000-0000-4000-8000-000000000002'

export interface Empresa {
  id: string
  codigo: string
  nombre: string
  nombre_corto: string
  activa: boolean
}

export interface PapelActivo {
  id: string
  empresa_id: string
  papel: Role
  line_id: string | null
  kam_ids: string[]
}

export interface PapelEntrada {
  papel: Role
  line_id?: string | null
  kam_ids?: string[]
}

/** De mayor a menor. Decide el papel "más alto" y el orden de los títulos. */
export const ORDEN_PAPELES: readonly Role[] = [
  'admin',
  'commercial_director',
  'line_leader',
  'sales_manager',
  'contract_manager',
  'data_manager',
  'hr',
  'viewer',
  'user',
]

export const MENSAJE_LIDER_NACIONAL_UNICO = 'Esa línea ya tiene líder nacional en esta empresa'
export const MENSAJE_LIDER_ZONAS_SOLAPADAS = 'Otra líder de esa línea ya tiene alguna de esas Zonas'
export const MENSAJE_LINEA_FUERA_DE_EMPRESA = 'Esa línea no está en esta empresa'
/** El mensaje del disparador asignaciones_coherentes de la 0960 cuando la persona no está en la empresa. */
export const MENSAJE_PERSONA_FUERA_DE_EMPRESA = 'Esa persona no está en esta empresa'

function posicion(papel: Role): number {
  const i = ORDEN_PAPELES.indexOf(papel)
  return i === -1 ? ORDEN_PAPELES.length : i
}

/** El papel de mayor rango; 'user' si no hay ninguno. */
export function papelMasAlto(papeles: readonly { papel: Role }[]): Role {
  let mejor: Role = 'user'
  let mejorPos = Number.POSITIVE_INFINITY
  for (const { papel } of papeles) {
    const pos = posicion(papel)
    if (pos < mejorPos) {
      mejor = papel
      mejorPos = pos
    }
  }
  return mejor
}

/** Suma de papeles: basta con que uno lo tenga (el admin lo puede todo, como en hasPermission). */
export function tienePermiso(papeles: readonly { papel: Role }[], permiso: Permission): boolean {
  return papeles.some(p => hasPermission(p.papel, permiso))
}

/**
 * Para las funciones puras que sirven al navegador (que solo conoce el papel más alto) y al servidor (que tiene todos
 * los papeles): con una lista de papeles suma; con un solo papel (o ninguno) decide como hasPermission.
 */
export function tienePermisoDe(quien: Role | undefined | readonly { papel: Role }[], permiso: Permission): boolean {
  return Array.isArray(quien) ? tienePermiso(quien, permiso) : hasPermission(quien as Role | undefined, permiso)
}

/**
 * La columna si está en la lista; si no, el claim si está; si no, la primera; null sin empresas. "La primera" es VG
 * Medical (la empresa de siempre) y, sin ella, la menor por código: ordenar solo por código dejaría a 'medix' antes
 * que 'vg'. No modifica la lista de entrada.
 */
export function empresaActivaDe(entrada: {
  empresaActivaId: string | null
  claimEmp: string | null
  empresas: readonly Empresa[]
}): Empresa | null {
  const { empresaActivaId, claimEmp, empresas } = entrada
  if (empresas.length === 0) return null
  const porId = (id: string | null) => (id ? empresas.find(e => e.id === id) ?? null : null)
  return (
    porId(empresaActivaId) ??
    porId(claimEmp) ??
    [...empresas].sort((a, b) => {
      if (a.id === EMPRESA_VG_ID) return b.id === EMPRESA_VG_ID ? 0 : -1
      if (b.id === EMPRESA_VG_ID) return 1
      return a.codigo.localeCompare(b.codigo)
    })[0]
  )
}

/**
 * Una línea tiene a lo sumo una líder nacional (sin Zonas) o varias por Zonas sin solaparse; no cabe una nacional junto
 * a una por Zonas. Las filas del mismo usuario no cuentan.
 */
export function validarLiderDeLinea(
  existentes: readonly { user_id: string; kam_ids: string[] }[],
  nuevo: { user_id: string; kam_ids: string[] }
): { ok: true } | { ok: false; error: string } {
  const otras = existentes.filter(e => e.user_id !== nuevo.user_id)
  if (nuevo.kam_ids.length === 0) {
    return otras.length > 0 ? { ok: false, error: MENSAJE_LIDER_NACIONAL_UNICO } : { ok: true }
  }
  if (otras.some(e => e.kam_ids.length === 0)) return { ok: false, error: MENSAJE_LIDER_NACIONAL_UNICO }
  const zonasNuevas = new Set(nuevo.kam_ids)
  if (otras.some(e => e.kam_ids.some(k => zonasNuevas.has(k)))) {
    return { ok: false, error: MENSAJE_LIDER_ZONAS_SOLAPADAS }
  }
  return { ok: true }
}

/** Valor para la columna de respaldo users.role: el papel más alto en VG ('user' sin ninguno). */
export function cacheRolDe(papelesEnVG: readonly { papel: Role }[]): Role {
  return papelMasAlto(papelesEnVG)
}

/** Valor para la columna de respaldo de la línea (leader_user_id): la líder nacional; null si no hay o solo hay por Zonas. */
export function cacheLiderDe(lideresEnVG: readonly { user_id: string; kam_ids: string[] }[]): string | null {
  return lideresEnVG.find(l => l.kam_ids.length === 0)?.user_id ?? null
}

/**
 * Espejo en TypeScript de la semilla SQL de papeles. Por cada usuario activo con role distinto de 'line_leader', una
 * fila en VG, y otra en Medix si es admin o director comercial; por cada línea con líder activo, una fila line_leader
 * en VG con esa línea. Un líder de negocio activo que no lidera ninguna línea es un error (no se puede sembrar).
 */
export function papelesDeSemilla(
  usuarios: readonly { id: string; role: Role; active: boolean }[],
  lineas: readonly { id: string; leader_user_id: string | null }[]
):
  | { ok: true; filas: { user_id: string; empresa_id: string; papel: Role; line_id: string | null }[] }
  | { ok: false; error: string } {
  const activos = usuarios.filter(u => u.active)
  const filas: { user_id: string; empresa_id: string; papel: Role; line_id: string | null }[] = []

  for (const u of activos) {
    if (u.role === 'line_leader') continue
    filas.push({ user_id: u.id, empresa_id: EMPRESA_VG_ID, papel: u.role, line_id: null })
    if (u.role === 'admin' || u.role === 'commercial_director') {
      filas.push({ user_id: u.id, empresa_id: EMPRESA_MEDIX_ID, papel: u.role, line_id: null })
    }
  }

  const idsActivos = new Set(activos.map(u => u.id))
  const lideresDeLinea = new Set<string>()
  for (const l of lineas) {
    if (!l.leader_user_id || !idsActivos.has(l.leader_user_id)) continue
    lideresDeLinea.add(l.leader_user_id)
    filas.push({ user_id: l.leader_user_id, empresa_id: EMPRESA_VG_ID, papel: 'line_leader', line_id: l.id })
  }

  const sinLinea = activos.filter(u => u.role === 'line_leader' && !lideresDeLinea.has(u.id)).length
  if (sinLinea > 0) return { ok: false, error: `Hay ${sinLinea} líderes de negocio activos sin línea` }

  return { ok: true, filas }
}

/** Títulos de los papeles, de mayor a menor, sin repetir, unidos con ' · '. */
export function tituloDePapeles(papeles: readonly { papel: Role }[]): string {
  const unicos = Array.from(new Set(papeles.map(p => p.papel)))
  unicos.sort((a, b) => posicion(a) - posicion(b))
  return unicos.map(getRoleTitle).join(' · ')
}

/**
 * El texto con el que /users pide confirmar que se quita Ejecutivo Comercial en una empresa (PUT …/papeles?simular=1),
 * o null si no se pierde nada (no se pide confirmación). En VG las líneas son las de Zonas (executive_lines).
 */
export function confirmacionDeQuitarEjecutivo(afectados: { lineas?: number; visitantes?: number } | null | undefined): string | null {
  const lineas = afectados?.lineas ?? 0
  const visitantes = afectados?.visitantes ?? 0
  if (lineas === 0 && visitantes === 0) return null
  return `Se pierden ${lineas} líneas en Zonas y terminan ${visitantes} visitantes`
}
