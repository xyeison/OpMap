// El menú en acordeón (etapa 1 del diseño, dueño 2026-10-30: "un acordeón vertical de los títulos de los menús. Si le
// doy click, me salen los submenús"). Cada grupo de agruparMenu (Terceros, Empleados, Inteligencia de Mercado,
// Configuración) se abre y se cierra; las opciones sueltas van siempre a la vista. Puro: lo usan
// components/NavigationWithPermissions.tsx y scripts/menu-check.ts.
import type { NavigationItem } from './permissions'

type Seccion = { grupo: string | null; items: readonly NavigationItem[] }

/** Los grupos abiertos al entrar: el que tiene la opción de la página abierta (el href de opcionActiva), o ninguno. */
export function gruposAbiertosAlEntrar(secciones: readonly Seccion[], activa: string | null): string[] {
  if (activa === null) return []
  const grupo = secciones.find(seccion => seccion.grupo !== null && seccion.items.some(item => item.href === activa))?.grupo
  return grupo ? [grupo] : []
}

/** Abre el grupo si estaba cerrado y lo cierra si estaba abierto; los demás quedan como estaban. */
export function alternarGrupo(abiertos: readonly string[], grupo: string): string[] {
  return abiertos.includes(grupo) ? abiertos.filter(abierto => abierto !== grupo) : [...abiertos, grupo]
}
