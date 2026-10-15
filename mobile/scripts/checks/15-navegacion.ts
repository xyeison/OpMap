/**
 * Sección 15 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 1):
 * barra de pestañas con íconos (PESTANAS), contraste de bordeControl, Pantalla con teclado y
 * pie, alturas de toque y haptica.ts.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 15-navegacion
 */
import type { Probador } from './probador'

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('15. Navegación y kit visual')
}
