// El menú en acordeón (etapa 1 del diseño, dueño 2026-10-30: "un acordeón vertical de los títulos de los menús. Si le
// doy click, me salen los submenús"). Cada grupo de agruparMenu (Terceros, Empleados, Inteligencia de Mercado,
// Configuración) se abre y se cierra; las opciones sueltas van siempre a la vista. Puro: lo usan
// components/NavigationWithPermissions.tsx y scripts/menu-check.ts.
import { opcionActiva, type NavigationItem } from './permissions'

type Seccion = { grupo: string | null; items: readonly NavigationItem[] }

/**
 * La opción de la página abierta para el acordeón y la barra: la de opcionActiva o, en una subpágina (la ficha de una
 * IPS, /contracts/detectados…), la opción cuya ruta la contiene por tramos (la más larga; entre ADRES y Compras
 * públicas, la que no lleva pestaña). opcionActiva sigue marcando solo la opción exacta.
 */
export function opcionDeLaPagina(items: readonly NavigationItem[], pathname: string | null, search: string): string | null {
  const exacta = opcionActiva(items, pathname, search)
  if (exacta !== null || !pathname) return exacta
  const contiene = items
    .filter(item => pathname.startsWith(`${item.href.split('?')[0]}/`))
    .sort((a, b) => b.href.split('?')[0].length - a.href.split('?')[0].length || Number(a.href.includes('?')) - Number(b.href.includes('?')))
  return contiene[0]?.href ?? null
}

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
