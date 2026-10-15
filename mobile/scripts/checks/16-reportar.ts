/**
 * Sección 16 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 2):
 * modo resumen de la tarjeta, pie "Confirmar visita i de N", orden de médicos, buscador,
 * planCargaReportar, cita desde Hoy y marcas de tiempo.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 16-reportar
 */
import type { Probador } from './probador'

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('16. Reportar y tarjeta')
}
