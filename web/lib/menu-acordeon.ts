// La opción de la página abierta, para nombrarla en la barra de arriba (etapa 1 del diseño, 2026-10-30). El acordeón
// que vivía aquí (gruposAbiertosAlEntrar, alternarGrupo) se fue con el menú hamburguesa el 2026-10-31 (dueño: "quita en
// dos"; los módulos están en /inicio). Puro: lo usan components/NavigationWithPermissions.tsx y scripts/menu-check.ts.
import { opcionActiva, type NavigationItem } from './permissions'

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
