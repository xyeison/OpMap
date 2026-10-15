/**
 * Marcas de tiempo del reporte en el teléfono (spec 2026-10-15, "Medición"): en desarrollo se escriben en la terminal
 * de Metro como `[tiempos-app]`, para decidir la tanda 2 con cifras. Solo nombres de marca y números: nunca lo que se
 * dijo, ids ni coordenadas.
 *
 * PROVISIONAL (Paso 0): marcar no hace nada. El paquete 4 escribe la versión real con esta misma firma.
 */

export type MarcaReporte =
  | 'lista_pintada'
  | 'toque_hablar'
  | 'grabando'
  | 'fin_grabacion'
  | 'transcripcion'
  | 'propuesta'
  | 'primer_toque_tarjeta'
  | 'toque_confirmar'
  | 'visita_guardada'

/** Deja una marca (con números opcionales, p. ej. { bytes: 120000 }). Provisional: no hace nada. */
export function marcar(_marca: MarcaReporte, _datos?: Record<string, number>): void {
  // provisional: sin registro
}
