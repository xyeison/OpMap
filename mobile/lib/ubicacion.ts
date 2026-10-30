/**
 * Ubicación del teléfono (expo-location; en el navegador, la del navegador). Solo con la app abierta y solo al
 * consultar Hoy o al reportar: nunca en segundo plano. El punto y su precisión viajan a la API como referencia;
 * la distancia que vale la calcula el servidor contra la sede elegida (decisión 6 del contrato fase 8).
 * La lógica (tiempos, respaldo con la última conocida, los dos pasos de Reportar) está en lib/ubicacion-pasos.ts.
 */
import * as Location from 'expo-location'
import { registroDeRapidas, ubicacionEnDosPasos, ubicacionFinal, type FuentesUbicacion, type Lectura, type ResultadoUbicacion, type UbicacionEnDosPasos } from './ubicacion-pasos'

export {
  MENSAJE_SIN_PERMISO_UBICACION,
  MENSAJE_SIN_UBICACION,
  type ResultadoUbicacion,
  type Ubicacion,
  type UbicacionEnDosPasos,
} from './ubicacion-pasos'

function aLectura(posicion: Location.LocationObject): Lectura {
  return { lat: posicion.coords.latitude, lng: posicion.coords.longitude, precision: posicion.coords.accuracy, timestamp: posicion.timestamp }
}

const fuentes: FuentesUbicacion = {
  permiso: async () => {
    const permiso = await Location.getForegroundPermissionsAsync()
    return permiso.granted || (permiso.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted)
  },
  precisa: async () => aLectura(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })),
  rapida: async () => aLectura(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })),
  ultima: async edadMaximaMs => {
    const posicion = await Location.getLastKnownPositionAsync({ maxAge: edadMaximaMs })
    return posicion ? aLectura(posicion) : null
  },
  // En vivo, solo mientras dura la final (hasta 20 s, app sin señal 2026-10-30): la app se queda con la más precisa.
  // Nunca en segundo plano: se deja de observar al terminar o al salir de la pantalla.
  observar: alLeer => {
    let activa = true
    let suscripcion: Location.LocationSubscription | null = null
    Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, posicion => {
      if (activa) alLeer(aLectura(posicion))
    }).then(
      s => {
        if (activa) suscripcion = s
        else s.remove()
      },
      () => undefined
    )
    return () => {
      activa = false
      suscripcion?.remove()
    }
  },
  // Uno solo para toda la app: Hoy y Reportar toman lecturas rápidas; la final y Nueva sede no las usan de respaldo.
  rapidasPropias: registroDeRapidas(),
}

/**
 * Pide permiso (si hace falta) y toma la ubicación con alta precisión. Si no llega a tiempo, usa la última
 * conocida de hace menos de 2 minutos (marcada `aproximada`). Nunca lanza.
 */
export function pedirUbicacion(opciones: { timeoutMs?: number } = {}): Promise<ResultadoUbicacion> {
  return ubicacionFinal(fuentes, opciones)
}

/**
 * Reportar: una primera ubicación para mostrar ya la lista y la final (la de pedirUbicacion) para la visita. Ver
 * lib/ubicacion-pasos.ts.
 */
export function pedirUbicacionEnDosPasos(opciones: { timeoutMs?: number } = {}): UbicacionEnDosPasos {
  return ubicacionEnDosPasos(fuentes, opciones)
}
