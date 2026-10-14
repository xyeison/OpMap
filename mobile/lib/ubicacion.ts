/**
 * Ubicación del teléfono (expo-location; en el navegador, la del navegador). Solo con la app abierta y solo al
 * consultar Hoy o al reportar: nunca en segundo plano. El punto y su precisión viajan a la API como referencia;
 * la distancia que vale la calcula el servidor contra la sede elegida (decisión 6 del contrato fase 8).
 */
import * as Location from 'expo-location'
import { isoBogota } from './fechas'

export interface Ubicacion {
  lat: number
  lng: number
  /** Precisión del GPS en metros (null si el teléfono no la da). */
  precision: number | null
  /** Instante en que se tomó (ISO con zona de Bogotá). */
  tomada_at: string
  /** Es la última posición conocida (no se pudo tomar una nueva a tiempo). */
  aproximada: boolean
}

export interface ResultadoUbicacion {
  ubicacion: Ubicacion | null
  error: string | null
}

export const MENSAJE_SIN_PERMISO_UBICACION =
  'La app no tiene permiso de ubicación. Actívalo en los ajustes del teléfono para ver las sedes cercanas y reportar presencial.'
export const MENSAJE_SIN_UBICACION = 'No se pudo tomar la ubicación. Sal a un lugar abierto o revisa que el GPS esté encendido.'

function aUbicacion(posicion: Location.LocationObject, aproximada: boolean): Ubicacion {
  const precision = posicion.coords.accuracy
  return {
    lat: Math.round(posicion.coords.latitude * 1e6) / 1e6,
    lng: Math.round(posicion.coords.longitude * 1e6) / 1e6,
    precision: precision !== null && precision !== undefined && Number.isFinite(precision) ? Math.round(precision) : null,
    tomada_at: isoBogota(new Date(posicion.timestamp || Date.now())),
    aproximada,
  }
}

function conTiempo<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(resolve => {
    const temporizador = setTimeout(() => resolve(null), ms)
    promesa.then(
      valor => {
        clearTimeout(temporizador)
        resolve(valor)
      },
      () => {
        clearTimeout(temporizador)
        resolve(null)
      }
    )
  })
}

/**
 * Pide permiso (si hace falta) y toma la ubicación con alta precisión. Si no llega a tiempo, usa la última
 * conocida de hace menos de 2 minutos (marcada `aproximada`). Nunca lanza.
 */
export async function pedirUbicacion(opciones: { timeoutMs?: number } = {}): Promise<ResultadoUbicacion> {
  const timeoutMs = opciones.timeoutMs ?? 10_000
  try {
    const permiso = await Location.getForegroundPermissionsAsync()
    const concedido = permiso.granted || (permiso.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted)
    if (!concedido) return { ubicacion: null, error: MENSAJE_SIN_PERMISO_UBICACION }

    const actual = await conTiempo(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), timeoutMs)
    if (actual) return { ubicacion: aUbicacion(actual, false), error: null }

    const ultima = await conTiempo(Location.getLastKnownPositionAsync({ maxAge: 120_000 }), 2_000)
    if (ultima) return { ubicacion: aUbicacion(ultima, true), error: null }
    return { ubicacion: null, error: MENSAJE_SIN_UBICACION }
  } catch {
    return { ubicacion: null, error: MENSAJE_SIN_UBICACION }
  }
}
