/**
 * Agenda con hora (spec 2026-10-15). Puro: sin react-native (lo prueban en Node scripts/checks/17-agenda.ts y
 * 16-reportar.ts).
 *
 * Pedido para Agendar: quien abre Agendar (Mi agenda al tocar una franja, la visita confirmada con "Agendar esa
 * reunión", Visita con "Agendar la próxima reunión") pone la fecha y la hora en la URL (rutaAgendar) y el "con quién"
 * en memoria (fijarPedidoAgendar), nunca en la URL: en el navegador la URL queda en el historial. Agendar toma el
 * pedido una sola vez (tomarPedidoAgendar), como lib/retorno.ts.
 *
 * El paquete 3 añade aquí las franjas, la validación con hora obligatoria y los textos de Agendar.
 */
import { esFechaIso } from './fechas'
import { horaDeCita, ventanaCita } from './propuesta'
import type { TipoVisita } from './tipos'

export interface PedidoAgendar {
  tipo: TipoVisita
  medico_id?: string | null
  cuenta_id?: string | null
  subtipo_id?: string | null
  sede_id?: string | null
}

/**
 * Ruta de Agendar: '/agenda/nueva?fecha=AAAA-MM-DD&hora=HH:MM'. Solo la fecha y la hora, y solo si son válidas
 * ("9:30" queda en 09:30); lo que no vale se descarta. Nunca ids en la URL.
 */
export function rutaAgendar(p: { fecha?: string; hora?: string }): string {
  const partes: string[] = []
  if (p.fecha !== undefined && esFechaIso(p.fecha)) partes.push(`fecha=${p.fecha}`)
  const hora = typeof p.hora === 'string' ? horaDeCita(p.hora) : undefined
  if (typeof hora === 'string') partes.push(`hora=${hora}`)
  return partes.length > 0 ? `/agenda/nueva?${partes.join('&')}` : '/agenda/nueva'
}

let pedidoActual: PedidoAgendar | null = null

/** Deja en memoria con quién es la cita que se va a agendar (lo toma Agendar al abrir). */
export function fijarPedidoAgendar(p: PedidoAgendar): void {
  pedidoActual = { ...p }
}

/** El pedido pendiente (y lo olvida: se toma una sola vez). */
export function tomarPedidoAgendar(): PedidoAgendar | null {
  const pedido = pedidoActual
  pedidoActual = null
  return pedido
}

/** ¿Se puede agendar la próxima reunión en esa fecha? Solo de hoy a hoy + 30 (la ventana de Agendar). */
export function puedeAgendarProxima(fecha: string | null, hoy: string): boolean {
  if (!fecha || !esFechaIso(fecha) || !esFechaIso(hoy)) return false
  const ventana = ventanaCita(hoy)
  return fecha >= ventana.desde && fecha <= ventana.hasta
}
