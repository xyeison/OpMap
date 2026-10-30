'use client'

// El tema de cada persona en OpMap web (etapa 1 del diseño, dueño 2026-10-30): Claro, Oscuro o Automático, guardado en el
// navegador (opmap.tema.v1, la misma clave que usa la app de campo en este navegador). El script de <head>
// (SCRIPT_TEMA_INICIAL) ya lo puso antes de pintar; aquí se lee para el selector, se cambia sin recargar y se siguen el
// sistema (con Automático) y las otras pestañas (OpMap o la app). El almacenamiento bloqueado nunca rompe nada.
import { useCallback, useEffect, useState } from 'react'
import { CLAVE_TEMA, leerPreferencia, temaEfectivo, type PreferenciaTema, type Tema } from '@/lib/tema'

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)'

function guardada(): PreferenciaTema {
  try {
    return leerPreferencia(window.localStorage.getItem(CLAVE_TEMA))
  } catch {
    return 'auto'
  }
}

function sistemaOscuro(): boolean {
  try {
    return Boolean(window.matchMedia?.(CONSULTA_OSCURO).matches)
  } catch {
    return false
  }
}

function aplicar(tema: Tema) {
  document.documentElement.dataset.tema = tema
}

export function useTema(): { preferencia: PreferenciaTema; tema: Tema; elegir: (preferencia: PreferenciaTema) => void } {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('auto')
  const [tema, setTema] = useState<Tema>('claro')

  useEffect(() => {
    const sincronizar = () => {
      const elegida = guardada()
      const efectivo = temaEfectivo(elegida, sistemaOscuro())
      setPreferencia(elegida)
      setTema(efectivo)
      aplicar(efectivo)
    }
    sincronizar()
    let consulta: MediaQueryList | null = null
    try {
      consulta = window.matchMedia?.(CONSULTA_OSCURO) ?? null
    } catch {
      consulta = null
    }
    consulta?.addEventListener?.('change', sincronizar)
    // Otra pestaña (OpMap o la app de campo) cambió el tema; null = se vació el almacenamiento
    const alGuardar = (evento: StorageEvent) => {
      if (evento.key === null || evento.key === CLAVE_TEMA) sincronizar()
    }
    window.addEventListener('storage', alGuardar)
    return () => {
      consulta?.removeEventListener?.('change', sincronizar)
      window.removeEventListener('storage', alGuardar)
    }
  }, [])

  const elegir = useCallback((nueva: PreferenciaTema) => {
    const preferencia = leerPreferencia(nueva)
    try {
      window.localStorage.setItem(CLAVE_TEMA, preferencia)
    } catch {
      // modo privado: vale mientras la página esté abierta
    }
    const efectivo = temaEfectivo(preferencia, sistemaOscuro())
    setPreferencia(preferencia)
    setTema(efectivo)
    aplicar(efectivo)
  }, [])

  return { preferencia, tema, elegir }
}
