/**
 * La cola sin señal conectada a la app: una cola por usuario en AsyncStorage (otra persona que entre en el mismo
 * teléfono no envía visitas ajenas), reintento al volver a primer plano, al reconectar y cada minuto mientras haya
 * pendientes. La lógica (idempotencia por client_id, medianoche, qué se reintenta) está en lib/cola.ts.
 * Cada 201 de POST /api/me/visitas (nueva o repetida, al momento o desde la cola) invalida el contexto en memoria
 * (spec 2026-10-15, decisión 7): Hoy y Reportar vuelven a pedir lo hecho hoy.
 */
import * as Network from 'expo-network'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import * as api from './api'
import { almacenTexto } from './almacen'
import { ColaVisitas, resumen as resumenDe, type ElementoCola, type ResultadoProceso, type ResumenCola } from './cola'
import { invalidarContexto } from './contexto-memoria'
import { TIEMPO_COLA_MS } from './http'
import { useSesion } from './sesion'
import type { VisitaCreate } from './tipos'

const REINTENTO_MS = 60_000

export interface ValorCola {
  items: ElementoCola[]
  resumen: ResumenCola
  enviando: boolean
  /** Guarda la visita (nunca se pierde) y la intenta enviar ya. Lanza solo si no se pudo guardar. */
  encolarYEnviar: (cuerpo: VisitaCreate, resumen: string) => Promise<{ elemento: ElementoCola; proceso: ResultadoProceso }>
  /** Intenta enviar las pendientes ahora. */
  reintentar: () => Promise<ResultadoProceso | null>
  /** Descarta una visita de la cola (la persona leyó el aviso). */
  quitar: (clientId: string) => Promise<void>
}

const ContextoCola = createContext<ValorCola | null>(null)

const enviarVisita = async (cuerpo: VisitaCreate) => {
  const respuesta = await api.crearVisita(cuerpo, TIEMPO_COLA_MS)
  // 201: lo hecho hoy cambió (o ya estaba): el contexto en memoria deja de servir.
  invalidarContexto('visita')
  return { visita_id: respuesta.visita.id, repetida: respuesta.repetida }
}

export function ProveedorCola({ children }: { children: ReactNode }) {
  const { estado, perfil } = useSesion()
  const usuarioId = estado === 'con_sesion' ? (perfil?.usuario.id ?? null) : null
  const [items, setItems] = useState<ElementoCola[]>([])
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)

  const cola = useMemo(() => {
    if (!usuarioId) return null
    const clave = `opmap.cola.v1.${usuarioId}`
    return new ColaVisitas({ leer: () => almacenTexto.leer(clave), escribir: texto => almacenTexto.escribir(clave, texto) })
  }, [usuarioId])

  const reintentar = useCallback(async (): Promise<ResultadoProceso | null> => {
    if (!cola || enCurso.current) return null
    enCurso.current = true
    setEnviando(true)
    try {
      return await cola.procesar(enviarVisita)
    } catch {
      return null
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }, [cola])

  // Cargar la cola del usuario y escuchar sus cambios.
  useEffect(() => {
    if (!cola) {
      setItems([])
      return
    }
    const quitarOyente = cola.suscribir(setItems)
    cola
      .listar()
      .then(() => reintentar())
      .catch(() => undefined)
    return quitarOyente
  }, [cola, reintentar])

  // Volver a primer plano → reintentar.
  useEffect(() => {
    if (!cola) return
    const suscripcion = AppState.addEventListener('change', estadoApp => {
      if (estadoApp === 'active') void cola.listar().then(() => reintentar())
    })
    return () => suscripcion.remove()
  }, [cola, reintentar])

  // Volver la señal → reintentar.
  useEffect(() => {
    if (!cola) return
    let conectadoAntes: boolean | null = null
    let suscripcion: { remove: () => void } | null = null
    try {
      suscripcion = Network.addNetworkStateListener(estadoRed => {
        const conectado = !!estadoRed.isConnected && estadoRed.isInternetReachable !== false
        if (conectado && conectadoAntes === false) void reintentar()
        conectadoAntes = conectado
      })
    } catch {
      suscripcion = null // en algún navegador no hay eventos de red: queda el reintento por minuto
    }
    return () => suscripcion?.remove()
  }, [cola, reintentar])

  // Cada minuto, mientras haya pendientes y la app esté abierta.
  const hayPendientes = items.some(e => e.estado === 'pendiente' || e.estado === 'por_confirmar')
  useEffect(() => {
    if (!cola || !hayPendientes) return
    const temporizador = setInterval(() => {
      if (AppState.currentState === 'active') void reintentar()
    }, REINTENTO_MS)
    return () => clearInterval(temporizador)
  }, [cola, hayPendientes, reintentar])

  const encolarYEnviar = useCallback(
    async (cuerpo: VisitaCreate, texto: string) => {
      if (!cola) throw new Error('Entra de nuevo para reportar')
      enCurso.current = true
      setEnviando(true)
      try {
        return await cola.encolarYEnviar(cuerpo, texto, enviarVisita)
      } finally {
        enCurso.current = false
        setEnviando(false)
      }
    },
    [cola]
  )

  const quitar = useCallback(
    async (clientId: string) => {
      if (cola) await cola.quitar(clientId)
    },
    [cola]
  )

  const valor = useMemo<ValorCola>(
    () => ({ items, resumen: resumenDe(items, new Date()), enviando, encolarYEnviar, reintentar, quitar }),
    [items, enviando, encolarYEnviar, reintentar, quitar]
  )
  return <ContextoCola.Provider value={valor}>{children}</ContextoCola.Provider>
}

export function useCola(): ValorCola {
  const valor = useContext(ContextoCola)
  if (!valor) throw new Error('useCola necesita <ProveedorCola>')
  return valor
}
