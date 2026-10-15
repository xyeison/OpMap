/**
 * Sección 18 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 4):
 * contexto en memoria (contextoReciente, invalidarContexto), rutaPatron, MemoriaToken,
 * arranqueDeSesion y perfil de audio.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 18-tiempos
 */
import type { Probador } from './probador'

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('18. Tiempos y caché')
}
