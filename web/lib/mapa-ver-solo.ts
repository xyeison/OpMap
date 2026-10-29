// "Ver solo" del mapa (dueño, 2026-10-29, docs/specs/2026-10-29-mapa-filtros-y-leyenda.md): un solo mecanismo para
// quedarse con una o varias personas (vista por línea) o Zonas (vista de zonas). Sin filtro (null) se ve todo; tocar a
// alguien deja solo a esa persona; tocar otra la suma; tocar una marcada la quita. Pruebas: scripts/mapa-filtros-check.ts.

/**
 * Filtro tras tocar `id` en la lista `todos` (en su orden). null = sin filtro. Si al quitar no queda nadie, o si quedan
 * todos marcados, vuelve a null (se ve todo). Los ids del filtro que ya no están en la lista (un enlace de otra línea)
 * se descartan.
 */
export function alternarVerSolo(actual: readonly string[] | null, id: string, todos: readonly string[]): string[] | null {
  if (!todos.includes(id)) return actual ? actual.filter(x => todos.includes(x)) : null
  const marcados = new Set((actual ?? []).filter(x => todos.includes(x)))
  if (actual === null || marcados.size === 0) return [id]
  if (marcados.has(id)) marcados.delete(id)
  else marcados.add(id)
  const siguiente = todos.filter(x => marcados.has(x))
  return siguiente.length === 0 || siguiente.length === todos.length ? null : siguiente
}
