'use client'

import { useEffect, useState } from 'react'

// Lee una media query de forma síncrona (el mapa solo se monta en el cliente) y la sigue en vivo
const matches = (query: string): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches

export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setValue(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return value
}

// Pantalla de teléfono: hoja inferior, cabecera compacta, zoom pequeño
export const MOBILE_QUERY = '(max-width: 767px)'
// Dispositivo con cursor real: solo ahí hay tooltips al pasar el cursor
export const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

export const matchesMediaQuery = matches
