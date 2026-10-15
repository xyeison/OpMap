/**
 * El último contexto del reporte (POST /api/me/contexto) en MEMORIA mientras la app está abierta (spec 2026-10-15,
 * decisión 7): Hoy y Reportar no piden de nuevo antes de 60 s y entre 60 s y 3 min pintan y refrescan sin tapar;
 * Agendar y Visita reusan lo que no depende del punto (médicos, perfil, líneas, voz) hasta 10 min. Solo se reusa a
 * menos de DISTANCIA_RECARGA_M del punto con que se pidió. Se invalida con el 201 de una visita, al agendar o cancelar
 * una cita, al registrar o anular un día libre y al cerrar sesión. Puro: sin react-native ni almacén (el respaldo sin
 * señal sigue en lib/contexto-guardado.ts). La ubicación final de la visita y lo que decide el servidor no cambian.
 * Lo prueba scripts/checks/18-tiempos.ts.
 */
import { esPunto, haversineM, type Punto } from './geo'
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
/**
 * Por defecto, el contexto se reusa solo a menos de esto del punto con que se pidió: la misma DISTANCIA_RECARGA_M de
 * lib/ubicacion-pasos.ts (no se importa para no crear un ciclo; la prueba 18 compara las dos).
 */
export const DISTANCIA_REUSO_M = 100

/** Lo último que llegó (uno solo: el de la última petición). */
let ultimo: ContextoEnMemoria | null = null
const oyentes = new Set<(motivo: MotivoInvalidacion) => void>()
/** Sube con cada invalidación y al olvidar: un contexto pedido ANTES no se guarda (traería lo de antes). */
let version = 0

/**
 * Versión de la memoria: api.contexto la toma al pedir y solo recuerda la respuesta si no cambió mientras tanto (una
 * visita, una cita o un día libre que llegó durante la petición deja esa respuesta vieja fuera de la memoria).
 */
export function versionContexto(): number {
  return version
}

/** Lo llama api.contexto con lo que acaba de llegar y el punto con que se pidió. */
export function recordarContexto(contexto: ContextoResponse, punto: Punto | null, ahora: number = Date.now()): void {
  const valido = punto && esPunto(punto.lat, punto.lng) ? { lat: punto.lat, lng: punto.lng } : null
  ultimo = { contexto, punto: valido, recibidoEn: ahora }
}

/**
 * El contexto en memoria si tiene menos de `maxEdadMs` y, si se pide `cercaDe`, está a menos de `maxDistanciaM`
 * (por defecto DISTANCIA_REUSO_M, 100 m) de ese punto. Con `cercaDe` y sin punto guardado → null; `cercaDe: null` (se
 * pide cercanía pero no hay ubicación) → null: no se puede saber si es el mismo sitio. Sin `cercaDe` no mira el punto
 * (Agendar y Visita: lo que no depende de dónde está). Una entrada "del futuro" (reloj cambiado) no sirve.
 */
export function contextoReciente(o: { maxEdadMs: number; cercaDe?: Punto | null; maxDistanciaM?: number; ahora?: number }): ContextoEnMemoria | null {
  const entrada = ultimo
  if (!entrada) return null
  const edad = (o.ahora ?? Date.now()) - entrada.recibidoEn
  if (!Number.isFinite(edad) || edad < 0 || edad >= o.maxEdadMs) return null
  if (o.cercaDe === undefined) return entrada
  if (!o.cercaDe || !esPunto(o.cercaDe.lat, o.cercaDe.lng) || !entrada.punto) return null
  return haversineM(entrada.punto, o.cercaDe) < (o.maxDistanciaM ?? DISTANCIA_REUSO_M) ? entrada : null
}

/** Borra el contexto en memoria y avisa a quien escuche (Hoy vuelve a pedir). */
export function invalidarContexto(motivo: MotivoInvalidacion): void {
  ultimo = null
  version++
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
  version++
}
