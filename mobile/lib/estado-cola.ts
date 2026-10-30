/**
 * Textos de la franja "En línea" / "Sin conexión" y del contador de pendientes (components/EstadoCola.tsx), puros para
 * probarlos en Node (scripts/checks/22-sin-senal.ts).
 */
import { plural } from './reglas'

/** "3 visitas pendientes por subir · 1 foto pendiente"; sin nada, "Todo subido". */
export function textoPendientes(visitas: number, fotos: number): string {
  if (visitas === 0 && fotos === 0) return 'Todo subido'
  const partes: string[] = []
  if (visitas > 0) partes.push(`${plural(visitas, 'visita pendiente', 'visitas pendientes')} por subir`)
  if (fotos > 0) partes.push(plural(fotos, 'foto pendiente', 'fotos pendientes'))
  return partes.join(' · ')
}

/** El texto del estado: "Sin conexión" manda; con la sesión vencida sin red se avisa que hay que entrar al volver la señal. */
export function textoEstadoConexion(enLinea: boolean): 'En línea' | 'Sin conexión' {
  return enLinea ? 'En línea' : 'Sin conexión'
}

export function detalleFranja(entrada: { enLinea: boolean; vencida: boolean; visitas: number; fotos: number }): string {
  const pendientes = textoPendientes(entrada.visitas, entrada.fotos)
  return entrada.vencida && !entrada.enLinea ? `${pendientes} · sesión vencida: entra al volver la señal` : pendientes
}
