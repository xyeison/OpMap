/**
 * Buscar al escribir (spec 2026-10-15, paquete 2). Puro: sin react-native (lo prueba scripts/checks/16-reportar.ts).
 *
 * - El Buscador (components/reporte/Buscador.tsx) busca en el servidor sin botón: espera ESPERA_BUSQUEDA_MS desde la
 *   última letra y solo con MIN_LETRAS_BUSQUEDA letras o más (sin contar espacios); cada búsqueda nueva cancela la
 *   anterior (AbortController) y lo que llega de una vieja no se pinta.
 * - Un solo buscador de médicos: el filtro del Selector busca entre los suyos y, si no hay coincidencias, ofrece
 *   "Buscar en OpMap" con el MISMO texto (ofertaBuscarFuera).
 */

/** Espera desde la última letra antes de buscar en el servidor. */
export const ESPERA_BUSQUEDA_MS = 400
/** Letras mínimas (sin contar espacios) para buscar al escribir. */
export const MIN_LETRAS_BUSQUEDA = 3
/** Letras mínimas para buscar con la tecla "Buscar" del teclado (lo que el servidor acepta). */
export const MIN_LETRAS_BUSQUEDA_MANUAL = 2

/** ¿Ya se busca solo mientras escribe? Tres letras o más, sin contar espacios. */
export function debeBuscarAlEscribir(texto: string | null | undefined): boolean {
  return (texto ?? '').replace(/\s+/g, '').length >= MIN_LETRAS_BUSQUEDA
}

/** Sin tildes y en minúsculas, para buscar. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Las opciones que contienen TODAS las palabras del filtro (en el título o el detalle), sin importar tildes. */
export function filtrarOpciones<T extends { titulo: string; detalle?: string | null }>(opciones: readonly T[], filtro: string): T[] {
  const palabras = normalizarBusqueda(filtro).split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return [...opciones]
  return opciones.filter(opcion => {
    const texto = normalizarBusqueda(`${opcion.titulo} ${opcion.detalle ?? ''}`)
    return palabras.every(palabra => texto.includes(palabra))
  })
}

/**
 * Lo que ofrece el filtro de un selector que también busca fuera de la lista (p. ej. en OpMap), con el mismo texto:
 * nada si no se ha escrito; destacado si ninguna opción propia coincide; si alguna coincide, como texto ("¿No es
 * ninguno?").
 */
export function ofertaBuscarFuera(filtro: string, coincidencias: number, donde = 'OpMap'): { texto: string; destacada: boolean } | null {
  const texto = filtro.trim()
  if (!texto) return null
  return { texto: `Buscar "${texto}" en ${donde}`, destacada: coincidencias === 0 }
}
