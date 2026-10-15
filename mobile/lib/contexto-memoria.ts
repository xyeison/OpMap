/**
 * El último contexto del reporte (POST /api/me/contexto) en MEMORIA mientras la app está abierta (spec 2026-10-15,
 * decisión 7): Hoy y Reportar no piden de nuevo antes de 60 s y entre 60 s y 3 min pintan y refrescan sin tapar;
 * Agendar y Visita reusan lo que no depende del punto (médicos, perfil, líneas, voz) hasta 10 min. Solo se reusa a
 * menos de DISTANCIA_RECARGA_M del punto con que se pidió. Se invalida con el 201 de una visita, al agendar o cancelar
 * una cita, al registrar o anular un día libre y al cerrar sesión. Puro: sin react-native ni almacén (el respaldo sin
 * señal sigue en lib/contexto-guardado.ts). La ubicación final de la visita y lo que decide el servidor no cambian.
 *
 * PROVISIONAL (Paso 0): contextoReciente devuelve siempre null, así que todas las pantallas piden como hoy. El
 * paquete 4 escribe la versión real con estas mismas firmas.
 */
import type { Punto } from './geo'
import type { ContextoResponse } from './tipos'

export interface ContextoEnMemoria {
  contexto: ContextoResponse
  /** Punto con que se pidió (null: se pidió sin punto). */
  punto: Punto | null
  /** Cuándo llegó (ms desde 1970). */
  recibidoEn: number
}

export type MotivoInvalidacion = 'visita' | 'cita' | 'dia_libre' | 'sesion'

/** Hoy y Reportar no piden de nuevo antes de esto. */
export const FRESCURA_SIN_PEDIR_MS = 60_000
/** Reportar pinta lo que hay y refresca sin tapar la pantalla hasta esto. */
export const FRESCURA_PINTAR_MS = 180_000
/** Agendar y Visita: médicos, perfil, líneas y voz (lo que no depende del punto). */
export const FRESCURA_DATOS_FIJOS_MS = 600_000

/** Lo último que llegó (la versión provisional lo guarda, pero contextoReciente todavía no lo entrega). */
let ultimo: ContextoEnMemoria | null = null
const oyentes = new Set<(motivo: MotivoInvalidacion) => void>()

/** Lo llama api.contexto con lo que acaba de llegar y el punto con que se pidió. */
export function recordarContexto(contexto: ContextoResponse, punto: Punto | null, ahora: number = Date.now()): void {
  ultimo = { contexto, punto, recibidoEn: ahora }
}

/**
 * El contexto en memoria si tiene menos de `maxEdadMs` y, si se pide `cercaDe`, está a menos de `maxDistanciaM` de ese
 * punto. Provisional: siempre null (todos piden como hoy).
 */
export function contextoReciente(_o: { maxEdadMs: number; cercaDe?: Punto | null; maxDistanciaM?: number; ahora?: number }): ContextoEnMemoria | null {
  return null
}

/** Borra el contexto en memoria y avisa a quien escuche (Hoy vuelve a pedir). */
export function invalidarContexto(motivo: MotivoInvalidacion): void {
  ultimo = null
  for (const oyente of oyentes) {
    try {
      oyente(motivo)
    } catch {
      // un oyente que falla no detiene a los demás
    }
  }
}

/** Escucha las invalidaciones; devuelve la función para dejar de escuchar. */
export function escucharInvalidacion(oyente: (motivo: MotivoInvalidacion) => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Al cerrar sesión: nada de la persona anterior queda en memoria. */
export function olvidarContextoEnMemoria(): void {
  ultimo = null
}
