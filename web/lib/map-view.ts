// Reglas puras de la página /map (spec docs/specs/2026-10-14-mapa-vista-de-zonas-para-todos.md). Sin React ni red:
// las prueba scripts/mapa-zonas-api-check.ts.

export type MapPageMode = 'line' | 'zones'

/**
 * Vista del mapa a partir de la URL: "Ver por" de la leyenda. ?mode=zones (colores de kams.color) la abre todo el
 * que ve el mapa desde el 2026-10-14; si no, la vista por Ejecutivos Comerciales (por línea).
 * Sin modo Regiones: se quitó por pedido del dueño del 2026-10-14 (spec docs/specs/2026-10-14-quitar-regiones.md);
 * un ?viewMode=zones viejo en la URL no hace nada.
 */
export function resolveMapView(input: { mode: string | null }): { mapMode: MapPageMode } {
  return { mapMode: input.mode === 'zones' ? 'zones' : 'line' }
}

/**
 * Línea con la que se vuelve a "Ejecutivos Comerciales": la elegida si es de la persona; si no (se entró directo a la
 * vista de zonas), la primera de sus líneas. null si no tiene ninguna.
 */
export function lineForExecutivesView(selectedLineCode: string | null, lines: readonly { code: string }[]): string | null {
  if (selectedLineCode && lines.some(line => line.code === selectedLineCode)) return selectedLineCode
  return lines[0]?.code ?? null
}

/**
 * Datos que el mapa conserva mientras llega /api/map/data con otra clave (placeholderData de React Query).
 * De una línea a otra se conserva el mapa anterior, con su cobertura, como siempre. Pero si se pide una línea y lo
 * anterior no traía cobertura (vista de zonas abierta sin línea), no se conserva: el mapa seguiría con los colores de
 * zona y sin aviso mientras la leyenda ya marca "Ejecutivos Comerciales". Sin datos sale "Cargando mapa...".
 */
export function mapDataPlaceholder<T>(previous: T | undefined, requestedLineCode: string | null): T | undefined {
  if (previous === undefined || previous === null) return undefined
  if (requestedLineCode && !(previous as { coverage?: unknown }).coverage) return undefined
  return previous
}
