/**
 * Reglas puras de la foto de la visita (app sin señal, dueño 2026-10-30): tamaño al que se comprime y texto de bytes.
 * Sin expo ni react-native, para probarlas en Node (scripts/checks/22-sin-senal.ts). La cámara y la compresión viven en
 * lib/foto.ts.
 */
export const FOTO_LADO_MAX = 1600
export const FOTO_CALIDAD = 0.7
export const FOTO_MAX_BYTES = 2 * 1024 * 1024
export const MENSAJE_SIN_PERMISO_CAMARA = 'La app no tiene permiso de cámara. Actívalo en los ajustes del teléfono o elige la foto de la galería.'
export const MENSAJE_FOTO_GRANDE = 'La foto quedó muy pesada aun comprimida: toma otra con menos detalle.'

/** El lado mayor baja a FOTO_LADO_MAX (o menos) conservando la proporción; nunca se agranda. Puro. */
export function dimensionesComprimidas(ancho: number, alto: number, ladoMax: number = FOTO_LADO_MAX): { ancho: number; alto: number } {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return { ancho: 0, alto: 0 }
  const mayor = Math.max(ancho, alto)
  if (mayor <= ladoMax) return { ancho: Math.round(ancho), alto: Math.round(alto) }
  const factor = ladoMax / mayor
  return { ancho: Math.max(1, Math.round(ancho * factor)), alto: Math.max(1, Math.round(alto * factor)) }
}

/** "1,2 MB" o "840 KB". */
export function textoBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
