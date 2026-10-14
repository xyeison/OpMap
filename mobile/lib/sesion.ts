/**
 * Sesión de la app (decisión 1 del contrato fase 8): POST /api/auth/login con cliente 'movil' devuelve el token en
 * el cuerpo; se guarda en el almacén seguro (lib/almacen.ts) y viaja como portador. Al abrir: si hay token se
 * pregunta GET /api/auth/me; sin señal se sigue con el perfil guardado (para poder reportar y encolar). Un 401
 * en cualquier petición olvida el token. Cerrar sesión = olvidar el token (y avisar al servidor si hay señal).
 * Nunca se guarda la contraseña.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { borrarClave, borrarToken, guardarJson, guardarToken, leerJson, leerToken } from './almacen'
import { olvidarContextoGuardado } from './contexto-guardado'
import { MENSAJE_SESION_VENCIDA, aApiError } from './errores'
import { leerCargaToken, tokenVencido } from './token'
import type { EjecutivaMovil, UsuarioMovil } from './tipos'

const CLAVE_PERFIL = 'opmap.perfil.v1'

export interface Perfil {
  usuario: UsuarioMovil & { email?: string }
  ejecutiva: EjecutivaMovil | null
  expira_at: string | null
}

export type EstadoSesion = 'cargando' | 'sin_sesion' | 'con_sesion'

export interface ValorSesion {
  estado: EstadoSesion
  perfil: Perfil | null
  /** Se abrió sin señal con el perfil guardado (no se pudo confirmar con el servidor). */
  sinConfirmar: boolean
  /** Por qué se cerró la sesión sola (token vencido o revocado). */
  aviso: string | null
  entrar: (email: string, password: string) => Promise<void>
  salir: () => Promise<void>
  /** Vuelve a preguntar /api/auth/me (al volver la señal). */
  refrescar: () => Promise<void>
}

const ContextoSesion = createContext<ValorSesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [sinConfirmar, setSinConfirmar] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)

  const olvidar = useCallback(async (motivo: string | null) => {
    await borrarToken()
    await borrarClave(CLAVE_PERFIL)
    await olvidarContextoGuardado()
    if (!montado.current) return
    setPerfil(null)
    setSinConfirmar(false)
    setAviso(motivo)
    setEstado('sin_sesion')
  }, [])

  const confirmar = useCallback(
    async (token: string, guardado: Perfil | null) => {
      try {
        const respuesta = await api.me(token)
        const nuevo: Perfil = {
          usuario: { id: respuesta.user.id, full_name: respuesta.user.full_name, role: respuesta.user.role, email: respuesta.user.email },
          ejecutiva: respuesta.ejecutiva,
          expira_at: guardado?.expira_at ?? expiraDelToken(token),
        }
        await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
        if (!montado.current) return
        setPerfil(nuevo)
        setSinConfirmar(false)
        setEstado('con_sesion')
      } catch (lanzado) {
        const error = aApiError(lanzado)
        if (error.status === 401) {
          await olvidar(MENSAJE_SESION_VENCIDA)
          return
        }
        // Sin señal o servidor caído: se sigue con lo guardado (o con lo que dice el token).
        const respaldo = guardado ?? perfilDelToken(token)
        if (!montado.current) return
        if (respaldo) {
          setPerfil(respaldo)
          setSinConfirmar(true)
          setEstado('con_sesion')
        } else {
          await olvidar(error.message)
        }
      }
    },
    [olvidar]
  )

  // Al abrir la app.
  useEffect(() => {
    montado.current = true
    ;(async () => {
      const token = await leerToken()
      if (!token) {
        setEstado('sin_sesion')
        return
      }
      if (tokenVencido(token)) {
        await olvidar(MENSAJE_SESION_VENCIDA)
        return
      }
      await confirmar(token, await leerJson<Perfil>(CLAVE_PERFIL))
    })()
    return () => {
      montado.current = false
    }
  }, [confirmar, olvidar])

  // 401 en cualquier petición → olvidar el token.
  useEffect(() => api.alVencerSesion(() => void olvidar(MENSAJE_SESION_VENCIDA)), [olvidar])

  const entrar = useCallback(async (email: string, password: string) => {
    const respuesta = await api.login(email, password)
    await guardarToken(respuesta.token)
    const nuevo: Perfil = { usuario: { ...respuesta.usuario, email: email.trim().toLowerCase() }, ejecutiva: respuesta.ejecutiva, expira_at: respuesta.expira_at }
    await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
    setPerfil(nuevo)
    setSinConfirmar(false)
    setAviso(null)
    setEstado('con_sesion')
  }, [])

  const salir = useCallback(async () => {
    await api.logout()
    await olvidar(null)
  }, [olvidar])

  const refrescar = useCallback(async () => {
    const token = await leerToken()
    if (!token) {
      await olvidar(null)
      return
    }
    await confirmar(token, perfil)
  }, [confirmar, olvidar, perfil])

  const valor = useMemo<ValorSesion>(
    () => ({ estado, perfil, sinConfirmar, aviso, entrar, salir, refrescar }),
    [estado, perfil, sinConfirmar, aviso, entrar, salir, refrescar]
  )
  return createElement(ContextoSesion.Provider, { value: valor }, children)
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion)
  if (!valor) throw new Error('useSesion necesita <ProveedorSesion>')
  return valor
}

function expiraDelToken(token: string): string | null {
  const carga = leerCargaToken(token)
  return carga?.exp ? new Date(carga.exp * 1000).toISOString() : null
}

/** Perfil mínimo desde el token (sin señal y sin perfil guardado): basta para la cola, que va por usuario. */
function perfilDelToken(token: string): Perfil | null {
  const carga = leerCargaToken(token)
  if (!carga) return null
  return { usuario: { id: carga.uid, full_name: '', role: '' }, ejecutiva: null, expira_at: expiraDelToken(token) }
}
