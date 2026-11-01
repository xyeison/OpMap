/**
 * La empresa activa en la app de campo (capa 1 de empresas, docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md).
 * Ajustes muestra la sección "Empresa" según selectorDeEmpresa: nada sin empresa, solo el nombre con una, y con varias
 * una fila por empresa para cambiar (POST /api/auth/empresa: necesita señal, así que sin ella queda deshabilitado con el
 * aviso). La franja de estado (components/EstadoCola.tsx) muestra el nombre corto de la activa junto al botón "OpMap".
 * PURO: sin React Native (lo prueban scripts/checks/26-empresa-activa.ts en Node).
 */
import type { EmpresaMovil, PapelActivo } from './tipos'

export const MENSAJE_EMPRESA_SIN_SENAL = 'Sin señal no se puede cambiar de empresa'

export type SelectorDeEmpresa =
  | { modo: 'oculto' }
  | { modo: 'solo_nombre'; nombre: string }
  | { modo: 'selector'; opciones: EmpresaMovil[]; deshabilitado: boolean; aviso: string | null }

export function selectorDeEmpresa(entrada: { empresa: EmpresaMovil | null; empresas: EmpresaMovil[]; enLinea: boolean }): SelectorDeEmpresa {
  const { empresa, empresas, enLinea } = entrada
  if (!empresa) return { modo: 'oculto' }
  if (empresas.length < 2) return { modo: 'solo_nombre', nombre: empresa.nombre_corto }
  return { modo: 'selector', opciones: empresas, deshabilitado: !enLinea, aviso: enLinea ? null : MENSAJE_EMPRESA_SIN_SENAL }
}

/**
 * La empresa, las empresas y los papeles de un usuario guardado o recibido: un perfil guardado antes de la capa 1 (o un
 * servidor sin ella) no los trae, y se leen como empresa null y listas vacías (la app sigue como antes, sin la sección).
 */
export function empresasDelUsuario(
  usuario: { empresa?: EmpresaMovil | null; empresas?: EmpresaMovil[]; papeles?: PapelActivo[] } | null | undefined
): { empresa: EmpresaMovil | null; empresas: EmpresaMovil[]; papeles: PapelActivo[] } {
  return {
    empresa: usuario?.empresa ?? null,
    empresas: Array.isArray(usuario?.empresas) ? usuario.empresas : [],
    papeles: Array.isArray(usuario?.papeles) ? usuario.papeles : [],
  }
}
