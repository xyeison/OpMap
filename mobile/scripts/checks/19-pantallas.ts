/**
 * Sección 19 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 5):
 * Hoy (debeRecargarHoy, citaDeAhora, cita tocable), Días libres, Números, Visita, Nueva sede,
 * Nuevo médico e Ingreso.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 19-pantallas
 */
import type { Probador } from './probador'

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('19. Resto de pantallas')
}
