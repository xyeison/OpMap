/**
 * Regreso de las pantallas de creación a Reportar: "Crear médico completo" (medico/nuevo), "Crear sede aquí"
 * (sede/nueva) y "Nuevo contacto" (contacto/nuevo) avisan aquí lo que se creó (o eligió) y vuelven atrás; Reportar escucha y lo pone en la tarjeta que
 * lo pidió (por su clave). Vive en memoria mientras la app está abierta: no guarda nada (y nunca documentos).
 */
import type { Punto } from './geo'
import type { MedicoOpcion, SedeOpcion } from './propuesta'
import type { ContactoContexto, VisitaCreate } from './tipos'

export type Retorno =
  | { tipo: 'medico'; clave: string | null; medico: MedicoOpcion }
  | { tipo: 'sede'; clave: string | null; sede: SedeOpcion }
  // Nuevo contacto (2026-10-30): el creado, o el que ya estaba en la cuenta con ese teléfono o correo
  | { tipo: 'contacto'; clave: string | null; contacto: ContactoContexto }

type Oyente = (retorno: Retorno) => void

/**
 * La clave con que Agendar pide "Crear médico" (dueño, 2026-10-30: "debería dejarme crearlo si no lo encuentra"): el
 * mismo Nuevo médico de Reportar avisa con ella y Agendar lo elige. Reportar no tiene tarjeta con esa clave.
 */
export const CLAVE_RETORNO_AGENDAR = 'agendar'

const oyentes = new Set<Oyente>()
/** Lo último que llegó sin nadie escuchando (Reportar se volvió a montar): se entrega al suscribirse. */
let pendiente: Retorno | null = null

export function avisarRetorno(retorno: Retorno): void {
  if (oyentes.size === 0) {
    pendiente = retorno
    return
  }
  for (const oyente of oyentes) {
    try {
      oyente(retorno)
    } catch {
      // un oyente que falla no detiene a los demás
    }
  }
}

export function escucharRetorno(oyente: Oyente): () => void {
  oyentes.add(oyente)
  if (pendiente) {
    const entregar = pendiente
    pendiente = null
    oyente(entregar)
  }
  return () => {
    oyentes.delete(oyente)
  }
}

// ---------------------------------------------------------------------------------------------
// Pedido: lo que Reportar le pasa a la pantalla de creación (en memoria, nunca en la URL: en el navegador la URL
// queda en el historial). Sin pedido (se abrió directo) la pantalla funciona igual con el GPS y los buscadores.
// ---------------------------------------------------------------------------------------------

export interface PedidoCreacion {
  /** Tarjeta de Reportar que pidió crear (null: elegir la sede del paso 1). */
  clave: string | null
  /** Nombre que se dijo y no cruzó (Nuevo médico, Nuevo contacto). Nunca un documento. */
  nombre?: string | null
  /** Nuevo contacto: la cuenta de la tarjeta (y su sede, si ya se eligió). */
  cuenta?: { id: string; nombre: string } | null
  sede_id?: string | null
  /** Municipio por defecto (DANE de 5 dígitos): el de la zona de la persona. */
  municipio?: string | null
  /** Sedes cercanas del contexto (para elegir dónde atiende el médico, o la cuenta de la sede nueva). */
  sedes?: readonly SedeOpcion[]
  /** Ubicación del sitio, si ya se tomó (para mostrar: en Reportar puede ser aún la primera). */
  punto?: (Punto & { precision?: number | null }) | null
  /**
   * La ubicación que VALE (la final de Reportar, que puede no haber llegado al pedir): Nuevo médico la espera antes de
   * crear el consultorio con ella, nunca con `punto`.
   */
  puntoFinal?: Promise<(Punto & { precision?: number | null }) | null>
}

let pedidoActual: PedidoCreacion | null = null

export function fijarPedido(pedido: PedidoCreacion): void {
  pedidoActual = pedido
}

/** El pedido vigente (se conserva hasta el siguiente: la pantalla puede volver a montarse). */
export function leerPedido(): PedidoCreacion | null {
  return pedidoActual
}

// ---------------------------------------------------------------------------------------------
// Reportar de nuevo: Hoy le pasa a Reportar una visita de la cola que el servidor no aceptó (en memoria), para
// volver a armarla como tarjeta sin perder lo escrito. Reportar la toma una sola vez al recibir el foco.
// ---------------------------------------------------------------------------------------------

export interface ReintentoReporte {
  /** client_id de la visita en la cola (sale de la cola cuando Reportar ya armó la tarjeta). */
  client_id: string
  cuerpo: VisitaCreate
  /** Por qué no se aceptó (el mensaje del servidor). */
  error: string | null
}

let reintentoActual: ReintentoReporte | null = null

export function fijarReintento(reintento: ReintentoReporte): void {
  reintentoActual = reintento
}

/** El reintento pendiente (y lo olvida: se toma una sola vez). */
export function tomarReintento(): ReintentoReporte | null {
  const reintento = reintentoActual
  reintentoActual = null
  return reintento
}

// ---------------------------------------------------------------------------------------------
// Cita desde Hoy: al tocar una cita pendiente, Hoy deja aquí su id (en memoria) y lleva a Reportar; Reportar la toma
// una sola vez al recibir el foco y la elige, con las mismas reglas de "Reportar de nuevo" (pasoDelReporte): si hay
// una tarjeta abierta, una grabación o un envío en curso, no borra nada y queda pendiente.
// ---------------------------------------------------------------------------------------------

let citaParaReportar: string | null = null

export function fijarCitaParaReportar(citaId: string): void {
  citaParaReportar = citaId
}

/** La cita pendiente de elegir en Reportar (y la olvida: se toma una sola vez). */
export function tomarCitaParaReportar(): string | null {
  const cita = citaParaReportar
  citaParaReportar = null
  return cita
}
