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
