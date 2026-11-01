// Helpers puros de la página /users (sin React, sin red), para que page.tsx solo arme la pantalla y estas reglas se
// puedan probar aparte (scripts/empresas-check.ts).
//
// Antes de la 0960 (GET /api/empresas responde []) la página vuelve al selector de un solo rol: crear con role y
// cambiarlo con PUT /api/users/[id] { role }, que el servidor ya acepta. Con empresas, papeles por empresa.
import type { Role } from '@/lib/permissions'

export interface PapelNuevo {
  empresa_id: string
  papel: Role
  line_id?: string
  kam_ids?: string[]
}

export type PapelesNuevos = { ok: true; papeles: PapelNuevo[] } | { ok: false; error: string }

/** Selector de un solo rol: cuando ya se sabe que no hay empresas (sin la migración 0960). Mientras carga, no. */
export function usaRolUnico(empresas: readonly unknown[], empresasCargadas: boolean): boolean {
  return empresasCargadas && empresas.length === 0
}

/** El cuerpo de POST /api/users: con un solo rol, role; con empresas, los papeles (o el motivo por el que faltan). */
export function cuerpoDeNuevoUsuario(
  datos: { email: string; password: string; full_name: string },
  modo: { rolUnico: true; role: Role } | { rolUnico: false; papeles: PapelesNuevos }
): { ok: true; cuerpo: Record<string, unknown> } | { ok: false; error: string } {
  if (modo.rolUnico) return { ok: true, cuerpo: { ...datos, role: modo.role } }
  if (!modo.papeles.ok) return { ok: false, error: modo.papeles.error }
  return { ok: true, cuerpo: { ...datos, papeles: modo.papeles.papeles } }
}
