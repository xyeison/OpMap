/**
 * Reglas puras de la PWA (app sin señal, dueño 2026-10-30), sin react-native, para probarlas en Node
 * (scripts/checks/22-sin-senal.ts). Lo que toca el navegador vive en lib/pwa.ts.
 */

/** La etiqueta de Background Sync que registra la app y atiende public/sw-cola.js. */
export const ETIQUETA_SYNC = 'opmap-cola'

/**
 * Señales de que el almacenamiento no es fiable (modo incógnito o datos bloqueados): IndexedDB no abre, o la cuota es
 * minúscula. Puro: recibe lo medido.
 */
export function almacenamientoDudoso(medido: { idbAbre: boolean; cuotaBytes: number | null }): boolean {
  if (!medido.idbAbre) return true
  // Safari en privado da cuotas de pocos MB; un navegador normal, cientos de MB o GB.
  return medido.cuotaBytes !== null && medido.cuotaBytes < 50 * 1024 * 1024
}
