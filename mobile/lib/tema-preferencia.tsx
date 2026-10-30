/**
 * La preferencia de tema (lib/tema.ts) guardada y para todas las pantallas (etapa 1 del diseño, dueño 2026-10-30).
 * - En el teléfono va en AsyncStorage y se lee al abrir: la raíz deja la portada mientras tanto (sin destello del otro
 *   tema).
 * - En el navegador (/campo, dentro de OpMap) va en la misma clave de localStorage que OpMap: se lee al instante y sigue
 *   a las otras pestañas (evento storage), así que elegirlo en OpMap o en la app vale para los dos.
 * Es el ÚNICO lugar que mira el modo del teléfono (useColorScheme): las pantallas usan useEsquema o useColores
 * (lib/ui.tsx). El almacenamiento bloqueado nunca rompe nada.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform, useColorScheme } from 'react-native'
import { CLAVE_TEMA, leerPreferencia, temaEfectivo, type PreferenciaTema, type Tema } from './tema'

const esWeb = Platform.OS === 'web'

interface ContextoTema {
  preferencia: PreferenciaTema
  /** El que se ve: el elegido, o con Automático el del teléfono. */
  tema: Tema
  elegir: (preferencia: PreferenciaTema) => void
  /** Ya se leyó lo guardado (en el navegador, desde el principio). */
  listo: boolean
}

const Contexto = createContext<ContextoTema | null>(null)

function almacenWeb(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null
  } catch {
    return null
  }
}

/** Lo guardado en el navegador ('auto' si no hay nada o el almacenamiento está bloqueado). */
function guardadaEnElNavegador(): PreferenciaTema {
  try {
    return leerPreferencia(almacenWeb()?.getItem(CLAVE_TEMA))
  } catch {
    return 'auto'
  }
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme()
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(() => (esWeb ? guardadaEnElNavegador() : 'auto'))
  const [listo, setListo] = useState(esWeb)

  useEffect(() => {
    if (esWeb) {
      if (typeof globalThis.addEventListener !== 'function') return
      // Otra pestaña (OpMap o la app) cambió el tema; key null = se vació el almacenamiento
      const alGuardar = (evento: StorageEvent) => {
        if (evento.key === null || evento.key === CLAVE_TEMA) setPreferencia(guardadaEnElNavegador())
      }
      globalThis.addEventListener('storage', alGuardar)
      return () => globalThis.removeEventListener('storage', alGuardar)
    }
    let vigente = true
    AsyncStorage.getItem(CLAVE_TEMA)
      .then(valor => {
        if (vigente) setPreferencia(leerPreferencia(valor))
      })
      .catch(() => undefined)
      .finally(() => {
        if (vigente) setListo(true)
      })
    return () => {
      vigente = false
    }
  }, [])

  const elegir = useCallback((nueva: PreferenciaTema) => {
    const valor = leerPreferencia(nueva)
    setPreferencia(valor)
    if (esWeb) {
      try {
        almacenWeb()?.setItem(CLAVE_TEMA, valor)
      } catch {
        // modo privado: vale mientras la app esté abierta
      }
      return
    }
    AsyncStorage.setItem(CLAVE_TEMA, valor).catch(() => undefined)
  }, [])

  const tema = temaEfectivo(preferencia, sistema === 'dark')
  const valor = useMemo(() => ({ preferencia, tema, elegir, listo }), [preferencia, tema, elegir, listo])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** La preferencia, el tema que se ve y cómo cambiarla. Fuera de <ProveedorTema>: Automático y sin guardar. */
export function useTemaApp(): ContextoTema {
  const sistema = useColorScheme()
  const contexto = useContext(Contexto)
  return contexto ?? { preferencia: 'auto', tema: temaEfectivo('auto', sistema === 'dark'), elegir: () => undefined, listo: true }
}

/** 'light' o 'dark', como useColorScheme() pero con el tema que eligió la persona. */
export function useEsquema(): 'light' | 'dark' {
  return useTemaApp().tema === 'oscuro' ? 'dark' : 'light'
}

/** La hora y la batería del color que contrasta con el tema elegido (no con el del teléfono). */
export function BarraDeEstado() {
  const esquema = useEsquema()
  return <StatusBar style={esquema === 'dark' ? 'light' : 'dark'} />
}
