'use client'

import { useSyncExternalStore } from 'react'

// Título corto de la cabecera en /map ("OpMap · <línea>" en móvil). Lo fija la página del mapa
// y lo lee NavigationWithPermissions, sin contexto nuevo ni useSearchParams en el layout.
let currentTitle: string | null = null
const listeners = new Set<() => void>()

export function setMapHeaderTitle(title: string | null) {
  if (title === currentTitle) return
  currentTitle = title
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMapHeaderTitle(): string | null {
  return useSyncExternalStore(subscribe, () => currentTitle, () => null)
}
