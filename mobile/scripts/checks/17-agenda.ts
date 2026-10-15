/**
 * Sección 17 de scripts/movil-check.ts (spec 2026-10-15-usabilidad-y-agenda-con-hora, paquete 3):
 * calendario del mes, franjas de media hora, hora obligatoria (validarCitaConHora,
 * cuerpoCitaConHora), textos de Agendar, pedido para Agendar y las pantallas de la agenda.
 *
 * Corren en Node, sin React Native ni red (las que revisan una pantalla leen su archivo). Este solo, desde mobile/:
 *   npx tsx scripts/checks/correr.ts 17-agenda
 */
import type { Probador } from './probador'

export async function pruebas(t: Probador): Promise<void> {
  t.seccion('17. Agenda con hora')
}
