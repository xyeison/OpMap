/**
 * Sesión de la app (decisión 1 del contrato fase 8): POST /api/auth/login con cliente 'movil' devuelve el token en
 * el cuerpo; se guarda en el almacén seguro (lib/almacen.ts) y viaja como portador. Al abrir (spec 2026-10-15,
 * arranqueDeSesion de lib/sesion-reglas.ts): con token vigente y el perfil guardado se entra YA y se confirma con
 * GET /api/auth/me en segundo plano (TIEMPO_ME_FONDO_MS, el de una petición normal); sin perfil guardado se pregunta
 * antes de entrar, esperando como mucho TIEMPO_ME_MS; sin señal se
 * sigue con el perfil guardado (para poder reportar y encolar). Nunca se entra sin token. Un 401 en cualquier
 * petición (también en esa confirmación) olvida el token y cierra la sesión. Cerrar sesión = olvidar el token, el
 * perfil y el contexto (guardado y en memoria) y avisar al servidor si hay señal. Nunca se guarda la contraseña.
 *
 * F1b (actividades de campo): el perfil guarda la persona de campo de GET /api/auth/me (papel y líneas con "como qué";
 * lib/persona.ts). El login no la trae: al entrar se pide /api/auth/me en segundo plano (completarPersona); sin señal se
 * sabrá al confirmar la próxima vez, y mientras tanto la app sigue como antes (el servidor decide). Con la respuesta se
 * guarda también si el servidor tiene F1a (`servidor`: /api/auth/me sin la clave `persona` = 'sin_f1a').
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { borrarClave, borrarToken, guardarJson, guardarToken, leerJson, leerToken } from './almacen'
import { olvidarContextoGuardado } from './contexto-guardado'
import { olvidarContextoEnMemoria } from './contexto-memoria'
import { MENSAJE_SESION_VENCIDA, aApiError } from './errores'
import { personaDeMe, servidorDeMe, type ServidorDeCampo } from './persona'
import { TIEMPO_ME_FONDO_MS, TIEMPO_ME_MS, arranqueDeSesion } from './sesion-reglas'
import { leerCargaToken, tokenVencido } from './token'
import type { EjecutivaMovil, PersonaMovil, UsuarioMovil } from './tipos'

const CLAVE_PERFIL = 'opmap.perfil.v1'

export interface Perfil {
  usuario: UsuarioMovil & { email?: string }
  ejecutiva: EjecutivaMovil | null
  /**
   * La persona de campo (0850): su papel y sus líneas; null si el servidor dice que no tiene líneas (o es la dirección
   * comercial). Sin el dato (undefined): aún no se sabe (recién entró, o un perfil guardado antes de F1b).
   */
  persona?: PersonaMovil | null
  /**
   * Qué servidor respondió la última vez GET /api/auth/me (servidorDeMe): 'sin_f1a' si no manda la persona (sin la
   * 0850: la app no ofrece "No se hizo", Eliminar, "Agendar otra fecha" ni "¿Qué pasó con esto?"). Sin el dato: no se
   * sabe y la app sigue como está.
   */
  servidor?: ServidorDeCampo
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
  /** Cambia al entrar y al olvidar: una confirmación que llega tarde (en segundo plano) no revive otra sesión. */
  const generacion = useRef(0)

  const olvidar = useCallback(async (motivo: string | null) => {
    generacion.current++
    olvidarContextoEnMemoria()
    await borrarToken()
    await borrarClave(CLAVE_PERFIL)
    await olvidarContextoGuardado()
    if (!montado.current) return
    setPerfil(null)
    setSinConfirmar(false)
    setAviso(motivo)
    setEstado('sin_sesion')
  }, [])

  /** `tiempoMs`: TIEMPO_ME_MS si la persona espera la respuesta; TIEMPO_ME_FONDO_MS en segundo plano. */
  const confirmar = useCallback(
    async (token: string, guardado: Perfil | null, tiempoMs: number) => {
      const desde = generacion.current
      // ¿Sigue siendo la misma sesión? (nadie salió ni entró mientras se esperaba la respuesta)
      const vigente = () => montado.current && generacion.current === desde
      try {
        const respuesta = await api.me(token, tiempoMs)
        if (generacion.current !== desde) return
        const nuevo: Perfil = {
          usuario: { id: respuesta.user.id, full_name: respuesta.user.full_name, role: respuesta.user.role, email: respuesta.user.email },
          ejecutiva: respuesta.ejecutiva,
          persona: personaDeMe(respuesta, guardado?.persona),
          servidor: servidorDeMe(respuesta),
          expira_at: guardado?.expira_at ?? expiraDelToken(token),
        }
        await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
        if (!vigente()) return
        setPerfil(nuevo)
        setSinConfirmar(false)
        setEstado('con_sesion')
      } catch (lanzado) {
        const error = aApiError(lanzado)
        if (generacion.current !== desde) return
        if (error.status === 401) {
          await olvidar(MENSAJE_SESION_VENCIDA)
          return
        }
        // Sin señal o servidor caído: se sigue con lo guardado (o con lo que dice el token).
        const respaldo = guardado ?? perfilDelToken(token)
        if (!vigente()) return
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
      if (token && tokenVencido(token)) {
        await olvidar(MENSAJE_SESION_VENCIDA)
        return
      }
      const guardado = token ? await leerJson<Perfil>(CLAVE_PERFIL) : null
      const arranque = arranqueDeSesion({ perfilGuardado: guardado, tokenVigente: token !== null, uidDelToken: leerCargaToken(token)?.uid })
      if (!montado.current) return
      if (arranque === 'sin_sesion' || !token) {
        setEstado('sin_sesion')
        return
      }
      if (arranque === 'entrar_y_confirmar' && guardado) {
        // Entra ya con lo guardado y confirma en segundo plano: un 401 cierra la sesión; sin señal queda "sin confirmar".
        setPerfil(guardado)
        setSinConfirmar(false)
        setEstado('con_sesion')
        void confirmar(token, guardado, TIEMPO_ME_FONDO_MS)
        return
      }
      // Sin perfil guardado (o de otro usuario): se pregunta antes de entrar, como siempre.
      await confirmar(token, null, TIEMPO_ME_MS)
    })()
    return () => {
      montado.current = false
    }
  }, [confirmar, olvidar])

  // 401 en cualquier petición → olvidar el token.
  useEffect(() => api.alVencerSesion(() => void olvidar(MENSAJE_SESION_VENCIDA)), [olvidar])

  /**
   * Justo después de entrar (F1b): el login no trae la persona de campo, así que se pide GET /api/auth/me en segundo
   * plano y se suma al perfil. Sin señal no pasa nada (no deja "sin confirmar": se acaba de entrar con el servidor); un
   * 401 cierra la sesión como siempre; si mientras tanto se salió o entró otra vez, no toca nada.
   */
  const completarPersona = useCallback(
    async (token: string, base: Perfil) => {
      const desde = generacion.current
      try {
        const respuesta = await api.me(token, TIEMPO_ME_FONDO_MS)
        if (!montado.current || generacion.current !== desde) return
        const nuevo: Perfil = { ...base, ejecutiva: respuesta.ejecutiva, persona: personaDeMe(respuesta, base.persona), servidor: servidorDeMe(respuesta) }
        await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
        if (!montado.current || generacion.current !== desde) return
        setPerfil(nuevo)
      } catch (lanzado) {
        if (generacion.current !== desde) return
        if (aApiError(lanzado).status === 401) await olvidar(MENSAJE_SESION_VENCIDA)
      }
    },
    [olvidar]
  )

  const entrar = useCallback(async (email: string, password: string) => {
    const respuesta = await api.login(email, password)
    generacion.current++
    olvidarContextoEnMemoria()
    await guardarToken(respuesta.token)
    const nuevo: Perfil = { usuario: { ...respuesta.usuario, email: email.trim().toLowerCase() }, ejecutiva: respuesta.ejecutiva, expira_at: respuesta.expira_at }
    await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
    setPerfil(nuevo)
    setSinConfirmar(false)
    setAviso(null)
    setEstado('con_sesion')
    void completarPersona(respuesta.token, nuevo)
  }, [completarPersona])

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
    // En segundo plano (Hoy lo pide sin tapar la pantalla).
    await confirmar(token, perfil, TIEMPO_ME_FONDO_MS)
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
