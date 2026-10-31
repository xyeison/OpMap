/**
 * Ubicación del teléfono (expo-location; en el navegador, la del navegador). Solo con la app abierta y solo al
 * consultar Hoy o al reportar: nunca en segundo plano. El punto y su precisión viajan a la API como referencia;
 * la distancia que vale la calcula el servidor contra la sede elegida (decisión 6 del contrato fase 8).
 * La lógica (tiempos, respaldo con la última conocida, los dos pasos de Reportar) está en lib/ubicacion-pasos.ts.
 */
import * as Location from 'expo-location'
import { Platform } from 'react-native'
import {
  MENSAJE_SIN_PERMISO_NAVEGADOR,
  TIEMPO_PRECISA_MS,
  motivoDeErrorDelNavegador,
  registroDeRapidas,
  ubicacionEnDosPasos,
  ubicacionFinal,
  type FuentesUbicacion,
  type Lectura,
  type ResultadoUbicacion,
  type UbicacionEnDosPasos,
} from './ubicacion-pasos'

export {
  MENSAJE_SIN_PERMISO_NAVEGADOR,
  MENSAJE_SIN_PERMISO_UBICACION,
  MENSAJE_SIN_UBICACION,
  type ResultadoUbicacion,
  type Ubicacion,
  type UbicacionEnDosPasos,
} from './ubicacion-pasos'

function aLectura(posicion: Location.LocationObject): Lectura {
  return { lat: posicion.coords.latitude, lng: posicion.coords.longitude, precision: posicion.coords.accuracy, timestamp: posicion.timestamp }
}

// --- Navegador (PWA en /campo, 2026-10-30) ---------------------------------------------------------------------------
// expo-location en la web pide el permiso con navigator.permissions.query('geolocation') y, si el estado es "prompt",
// con un getCurrentPosition SIN tiempo máximo: en Safari y Chrome de iPhone eso falla ("No se pudo tomar la ubicación")
// o se queda "Tomando tu ubicación…" para siempre. Aquí la web habla con navigator.geolocation directo: el permiso lo
// pide la primera lectura (como cualquier página), todo lleva tiempo máximo y la última lectura buena se recuerda.
type Geo = { getCurrentPosition: (ok: (p: GeolocationPosition) => void, error?: (e: GeolocationPositionError) => void, opciones?: PositionOptions) => void; watchPosition: (ok: (p: GeolocationPosition) => void, error?: (e: GeolocationPositionError) => void, opciones?: PositionOptions) => number; clearWatch: (id: number) => void }
const geolocalizacion = (): Geo | null => {
  if (Platform.OS !== 'web') return null
  const nav = (globalThis as unknown as { navigator?: { geolocation?: Geo } }).navigator
  return nav?.geolocation ?? null
}

function lecturaWeb(posicion: GeolocationPosition): Lectura {
  return { lat: posicion.coords.latitude, lng: posicion.coords.longitude, precision: posicion.coords.accuracy, timestamp: posicion.timestamp }
}

/** Fuentes para el navegador. `ultimaBuena` recuerda la última lectura (el navegador no da "última conocida"). */
function fuentesDelNavegador(geo: Geo): FuentesUbicacion {
  let ultimaBuena: Lectura | null = null
  const leer = (opciones: PositionOptions): Promise<Lectura> =>
    new Promise((resolve, reject) => {
      geo.getCurrentPosition(
        posicion => {
          ultimaBuena = lecturaWeb(posicion)
          resolve(ultimaBuena)
        },
        error => reject(error),
        opciones
      )
    })
  return {
    // Sin el permiso concedido de antemano no se puede saber (Safari no responde a permissions.query de forma fiable):
    // solo se corta si el navegador dice "denegado"; si no, la primera lectura muestra el aviso del navegador.
    permiso: async () => {
      try {
        const permisos = (globalThis as unknown as { navigator?: { permissions?: { query: (d: { name: string }) => Promise<{ state: string }> } } }).navigator?.permissions
        if (!permisos?.query) return true
        const estado = await permisos.query({ name: 'geolocation' })
        return estado.state !== 'denied'
      } catch {
        return true
      }
    },
    precisa: () => leer({ enableHighAccuracy: true, timeout: TIEMPO_PRECISA_MS, maximumAge: 0 }),
    rapida: () => leer({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }),
    ultima: async edadMaximaMs => {
      if (ultimaBuena && Date.now() - (ultimaBuena.timestamp ?? 0) <= edadMaximaMs) return ultimaBuena
      try {
        // Lo que el navegador tenga en caché; sin caché, falla enseguida (tiempo corto) y no se espera.
        return await leer({ enableHighAccuracy: false, timeout: 1_500, maximumAge: edadMaximaMs })
      } catch {
        return null
      }
    },
    observar: (alLeer, alFallar) => {
      let activa = true
      const id = geo.watchPosition(
        posicion => {
          if (!activa) return
          ultimaBuena = lecturaWeb(posicion)
          alLeer(ultimaBuena)
        },
        error => {
          if (activa) alFallar?.(error)
        },
        { enableHighAccuracy: true, timeout: TIEMPO_PRECISA_MS, maximumAge: 0 }
      )
      return () => {
        activa = false
        geo.clearWatch(id)
      }
    },
    // GeolocationPositionError: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT. Con 1 se corta en el acto y se
    // dice dónde se cambia el permiso (Safari recuerda "No permitir" y no vuelve a preguntar).
    motivoDeError: motivoDeErrorDelNavegador,
    mensajeSinPermiso: MENSAJE_SIN_PERMISO_NAVEGADOR,
    rapidasPropias: registroDeRapidas(),
  }
}

const fuentesDelTelefono: FuentesUbicacion = {
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

const geo = geolocalizacion()
const fuentes: FuentesUbicacion = geo ? fuentesDelNavegador(geo) : fuentesDelTelefono

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
