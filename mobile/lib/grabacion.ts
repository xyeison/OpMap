/**
 * Reglas puras de la grabación del dictado (sin React Native ni expo-audio): tope de 3 minutos (el mismo del
 * servidor, AUDIO_MAX_SEGUNDOS de web/lib/reporte-visitas.ts), reloj "m:ss" y nivel del micrófono para la barra.
 * Lo prueba scripts/movil-check.ts. El audio nunca se guarda: lib/audio.ts lo borra al recibir la transcripción.
 */

/** Tope de la grabación: 3 minutos (al llegar, la app para sola y envía). */
export const MAX_GRABACION_MS = 180_000
/** Grabaciones más cortas que esto no se envían (un toque sin querer). */
export const MIN_GRABACION_MS = 1_000
/** Desde aquí el reloj avisa que se acaba el tiempo. */
export const AVISO_FIN_GRABACION_MS = 150_000

/** "0:07", "1:05", "3:00" (nunca negativo). */
export function formatoDuracion(ms: number | null | undefined): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms as number) ? (ms as number) : 0) / 1000))
  const minutos = Math.floor(total / 60)
  const segundos = total % 60
  return `${minutos}:${String(segundos).padStart(2, '0')}`
}

/** Tiempo que queda de grabación, en ms (0 si ya se pasó). */
export function restanteGrabacion(ms: number): number {
  return Math.max(0, MAX_GRABACION_MS - Math.max(0, ms))
}

/** ¿Hay que parar ya (llegó a los 3 minutos)? */
export function debeParar(ms: number): boolean {
  return ms >= MAX_GRABACION_MS
}

/**
 * Nivel del micrófono 0..1 desde la medición de expo-audio (dBFS: −160 silencio, 0 máximo). Se toma la franja
 * útil de la voz (−50 a 0 dB) en línea recta; sin medición → 0.
 */
export function nivelDesdeMetering(db: number | null | undefined): number {
  if (db === null || db === undefined || !Number.isFinite(db)) return 0
  const piso = -50
  if (db <= piso) return 0
  if (db >= 0) return 1
  return Math.round(((db - piso) / -piso) * 100) / 100
}

/** Segundos enteros de una duración en ms (lo que se manda como duracion_s). */
export function segundosDe(ms: number): number {
  return Math.max(0, Math.round(ms / 1000))
}
