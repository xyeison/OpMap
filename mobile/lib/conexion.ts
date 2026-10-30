/**
 * ¿Hay conexión? Para el indicador "En línea" / "Sin conexión" y para reintentar la cola al volver la señal (app sin
 * señal, dueño 2026-10-30). Fuentes: expo-network (el teléfono y, donde lo da, el navegador) y, en la web,
 * navigator.onLine con los eventos online/offline. "Conectado" = la red dice que sí y no dice que internet no llega;
 * la verdad final la da cada petición (sin red falla con tipo 'red' y la cola espera).
 *
 * La regla `estaConectado` es pura y vive en lib/conexion-reglas.ts (la prueban las pruebas); aquí la suscripción.
 */
import * as Network from 'expo-network'
import { useEffect, useState } from 'react'

import { estaConectado, type EstadoRed } from './conexion-reglas'

export { estaConectado, type EstadoRed } from './conexion-reglas'

function navegador(): { onLine: boolean | null; escuchar: (f: () => void) => () => void } {
  const w = globalThis as unknown as { navigator?: { onLine?: boolean }; addEventListener?: (e: string, f: () => void) => void; removeEventListener?: (e: string, f: () => void) => void }
  const onLine = typeof w.navigator?.onLine === 'boolean' ? w.navigator.onLine : null
  const escuchar = (f: () => void) => {
    if (!w.addEventListener || !w.removeEventListener) return () => undefined
    w.addEventListener('online', f)
    w.addEventListener('offline', f)
    return () => {
      w.removeEventListener?.('online', f)
      w.removeEventListener?.('offline', f)
    }
  }
  return { onLine, escuchar }
}

/** Lectura puntual (sin suscripción). */
export async function hayConexion(): Promise<boolean> {
  const { onLine } = navegador()
  try {
    return estaConectado(await Network.getNetworkStateAsync(), onLine)
  } catch {
    return estaConectado(null, onLine)
  }
}

/**
 * Conexión en vivo. `alReconectar` se llama cuando pasa de sin conexión a con conexión (para subir la cola enseguida).
 */
export function useConexion(alReconectar?: () => void): boolean {
  const [conectado, setConectado] = useState(true)
  useEffect(() => {
    let vigente = true
    let ultimoRed: EstadoRed | null = null
    let anterior: boolean | null = null
    const aplicar = () => {
      const ahora = estaConectado(ultimoRed, navegador().onLine)
      if (!vigente) return
      setConectado(ahora)
      if (anterior === false && ahora) alReconectar?.()
      anterior = ahora
    }
    Network.getNetworkStateAsync().then(
      estado => {
        ultimoRed = estado
        aplicar()
      },
      () => aplicar()
    )
    let suscripcion: { remove: () => void } | null = null
    try {
      suscripcion = Network.addNetworkStateListener(estado => {
        ultimoRed = estado
        aplicar()
      })
    } catch {
      suscripcion = null
    }
    const quitarNavegador = navegador().escuchar(aplicar)
    return () => {
      vigente = false
      suscripcion?.remove()
      quitarNavegador()
    }
  }, [alReconectar])
  return conectado
}
