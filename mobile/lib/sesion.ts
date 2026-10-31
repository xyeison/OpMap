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
import { Platform } from 'react-native'
import * as api from './api'
import { alCambiarTokenEnOtraPestana, borrarClave, borrarToken, guardarJson, guardarToken, leerJson, leerToken } from './almacen'
import { olvidarContextoGuardado } from './contexto-guardado'
import { olvidarContextoEnMemoria } from './contexto-memoria'
import { MENSAJE_SESION_OTRA_PESTANA, MENSAJE_SESION_VENCIDA, aApiError } from './errores'
import { personaDeMe, servidorDeMe, type ServidorDeCampo } from './persona'
import {
  CLAVE_SALIDA_PENDIENTE,
  TIEMPO_ME_FONDO_MS,
  TIEMPO_ME_MS,
  arranqueDeSesion,
  cambioDeTokenEnOtraPestana,
  dejarSalidaPendiente,
  probarSesionDeLaWeb,
  reintentarSalida,
} from './sesion-reglas'
import { leerCargaToken, tokenVencido } from './token'
import type { EjecutivaMovil, LoginMovilResponse, PersonaMovil, UsuarioMovil } from './tipos'

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
   * Sin persona, por qué (MeResponse.sin_persona, p. ej. "Tu usuario no tiene líneas para reportar"): con él la app no
   * entra a las pestañas y lo muestra (estadoPersona).
   * null o sin el dato: no se sabe.
   */
  sinPersona?: string | null
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
  /**
   * El token ya venció pero la app abrió sin señal con el perfil guardado (app sin señal, dueño 2026-10-30: "si la
   * sesión vence sin internet, que pueda seguir reportando"): se puede reportar a la cola; al volver la señal el servidor
   * responde 401, la app pide entrar de nuevo y la cola (que es por usuario y no se borra) sigue.
   */
  vencida: boolean
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
  const [vencida, setVencida] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const montado = useRef(true)
  /** Cambia al entrar y al olvidar: una confirmación que llega tarde (en segundo plano) no revive otra sesión. */
  const generacion = useRef(0)

  /**
   * Olvida el token. Con `conservar` (la sesión venció o la revocaron: un 401) el perfil y el contexto guardados se
   * QUEDAN: al volver a entrar la misma persona sigue reportando sin señal con lo que tenía, y la cola (por usuario,
   * en el almacén) nunca se toca. Solo "Cerrar sesión" (salir) borra el perfil y el contexto.
   */
  const olvidar = useCallback(async (motivo: string | null, opciones: { conservar?: boolean } = {}) => {
    generacion.current++
    olvidarContextoEnMemoria()
    await borrarToken()
    if (!opciones.conservar) {
      await borrarClave(CLAVE_PERFIL)
      await olvidarContextoGuardado()
    }
    if (!montado.current) return
    setPerfil(null)
    setSinConfirmar(false)
    setVencida(false)
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
          sinPersona: respuesta.sin_persona ?? null,
          servidor: servidorDeMe(respuesta),
          expira_at: guardado?.expira_at ?? expiraDelToken(token),
        }
        await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
        if (!vigente()) return
        setPerfil(nuevo)
        setSinConfirmar(false)
        setVencida(false)
        setEstado('con_sesion')
      } catch (lanzado) {
        const error = aApiError(lanzado)
        if (generacion.current !== desde) return
        if (error.status === 401) {
          await olvidar(MENSAJE_SESION_VENCIDA, { conservar: true })
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

  /**
   * Un solo ingreso con la web de OpMap (2026-10-30, docs/specs/2026-10-30-agendamiento-lider-un-ingreso.md): la app en el
   * navegador sin token vigente pide el de la sesión de la web (POST /api/auth/sesion-app, con la cookie): quien entró por
   * "Agendamiento" no vuelve a escribir su contraseña. true si entró; sin sesión en la web, false y sigue como siempre.
   */
  const entrarConLaWeb = useCallback(async (): Promise<boolean> => {
    let respuesta: LoginMovilResponse
    try {
      respuesta = await api.sesionDeLaWeb()
    } catch {
      return false
    }
    generacion.current++
    olvidarContextoEnMemoria()
    try {
      // Lo guardado de la sesión anterior (quizá de otra persona: su contexto del día) no se hereda
      await olvidarContextoGuardado()
      await guardarToken(respuesta.token)
    } catch {
      // Sin dónde guardar el token (almacenamiento lleno o bloqueado): sigue como sin la sesión de la web
      return false
    }
    const nuevo: Perfil = { usuario: { ...respuesta.usuario }, ejecutiva: respuesta.ejecutiva, expira_at: respuesta.expira_at }
    await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
    if (!montado.current) return true
    setPerfil(nuevo)
    setSinConfirmar(false)
    setAviso(null)
    setEstado('con_sesion')
    // Como después de entrar: la persona de campo (y el correo) llegan con GET /api/auth/me en segundo plano
    void confirmar(respuesta.token, nuevo, TIEMPO_ME_FONDO_MS)
    return true
  }, [confirmar])

  /** Al abrir la app (y, en el navegador, cuando otra pestaña cambia el token). */
  const abrir = useCallback(async () => {
    const esWeb = Platform.OS === 'web'
    const token = await leerToken()
    const yaVencido = token !== null && tokenVencido(token)
    const tokenVigente = token !== null && !yaVencido
    // En el navegador: si se cerró sesión sin señal, la cookie de la web pudo quedar viva (CLAVE_SALIDA_PENDIENTE). Se
    // vuelve a avisar al servidor y, mientras la marca siga, la app no entra sola con esa cookie.
    const salidaPendiente = esWeb && (await leerJson<boolean>(CLAVE_SALIDA_PENDIENTE)) === true
    if (reintentarSalida({ salidaPendiente, tokenVigente })) {
      if (await api.logout()) await borrarClave(CLAVE_SALIDA_PENDIENTE)
    }
    // En el navegador, sin token vigente: primero la sesión de la web (un solo ingreso)
    if (probarSesionDeLaWeb({ esWeb, tokenVigente, salidaPendiente })) {
      if (await entrarConLaWeb()) return
    }
    const guardado = token ? await leerJson<Perfil>(CLAVE_PERFIL) : null
    // Token vencido: con señal el servidor responderá 401 y se vuelve al ingreso (conservando el perfil); SIN señal se
    // entra con el perfil guardado para seguir reportando a la cola (arranqueDeSesion con vencido: 'entrar_vencida').
    const arranque = arranqueDeSesion({ perfilGuardado: guardado, tokenVigente: token !== null && !yaVencido, uidDelToken: leerCargaToken(token)?.uid, tokenVencido: yaVencido })
    if (!montado.current) return
    if (arranque === 'sin_sesion' || !token) {
      if (yaVencido) await olvidar(MENSAJE_SESION_VENCIDA, { conservar: true })
      else setEstado('sin_sesion')
      return
    }
    if ((arranque === 'entrar_y_confirmar' || arranque === 'entrar_vencida') && guardado) {
      // Entra ya con lo guardado y confirma en segundo plano: un 401 cierra la sesión; sin señal queda "sin confirmar".
      setPerfil(guardado)
      setSinConfirmar(arranque === 'entrar_vencida')
      setVencida(arranque === 'entrar_vencida')
      setEstado('con_sesion')
      void confirmar(token, guardado, TIEMPO_ME_FONDO_MS)
      return
    }
    // Sin perfil guardado (o de otro usuario): se pregunta antes de entrar, como siempre.
    await confirmar(token, null, TIEMPO_ME_MS)
  }, [confirmar, olvidar, entrarConLaWeb])

  // Al abrir la app.
  useEffect(() => {
    montado.current = true
    void abrir()
    return () => {
      montado.current = false
    }
  }, [abrir])

  // En el navegador, otra pestaña cambió el token (en OpMap se entró o se salió, u otra pestaña de la app): esta pestaña
  // lo sigue (revisión 2026-10-30). Sin token se cierra aquí también (la cola se queda); con otro, se abre con ese.
  useEffect(
    () =>
      alCambiarTokenEnOtraPestana(({ nuevo, anterior }) => {
        const cambio = cambioDeTokenEnOtraPestana({ nuevo, anterior })
        if (cambio === 'cerrar') {
          void olvidar(MENSAJE_SESION_OTRA_PESTANA)
        } else if (cambio === 'abrir') {
          generacion.current++
          olvidarContextoEnMemoria()
          setPerfil(null)
          setSinConfirmar(false)
          setAviso(null)
          setEstado('cargando')
          void abrir()
        }
      }),
    [abrir, olvidar]
  )

  // 401 en cualquier petición → olvidar el token (el perfil, el contexto y la cola se quedan para volver a entrar).
  useEffect(() => api.alVencerSesion(() => void olvidar(MENSAJE_SESION_VENCIDA, { conservar: true })), [olvidar])

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
        const nuevo: Perfil = {
          ...base,
          ejecutiva: respuesta.ejecutiva,
          persona: personaDeMe(respuesta, base.persona),
          sinPersona: respuesta.sin_persona ?? null,
          servidor: servidorDeMe(respuesta),
        }
        await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
        if (!montado.current || generacion.current !== desde) return
        setPerfil(nuevo)
      } catch (lanzado) {
        if (generacion.current !== desde) return
        if (aApiError(lanzado).status === 401) await olvidar(MENSAJE_SESION_VENCIDA, { conservar: true })
      }
    },
    [olvidar]
  )

  const entrar = useCallback(async (email: string, password: string) => {
    const respuesta = await api.login(email, password)
    generacion.current++
    olvidarContextoEnMemoria()
    await guardarToken(respuesta.token)
    // Un ingreso nuevo: la salida pendiente de antes ya no cuenta (en el navegador la cookie es la de este ingreso)
    await borrarClave(CLAVE_SALIDA_PENDIENTE)
    const nuevo: Perfil = { usuario: { ...respuesta.usuario, email: email.trim().toLowerCase() }, ejecutiva: respuesta.ejecutiva, expira_at: respuesta.expira_at }
    await guardarJson(CLAVE_PERFIL, nuevo).catch(() => undefined)
    setPerfil(nuevo)
    setSinConfirmar(false)
    setVencida(false)
    setAviso(null)
    setEstado('con_sesion')
    void completarPersona(respuesta.token, nuevo)
  }, [completarPersona])

  const salir = useCallback(async () => {
    const avisado = await api.logout()
    // En el navegador, si el servidor no se enteró, la cookie de la web pudo quedar viva: con la marca la app no entra
    // sola con ella al volver a abrir (y al abrir vuelve a avisar)
    if (dejarSalidaPendiente({ esWeb: Platform.OS === 'web', avisado })) await guardarJson(CLAVE_SALIDA_PENDIENTE, true).catch(() => undefined)
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
    () => ({ estado, perfil, sinConfirmar, vencida, aviso, entrar, salir, refrescar }),
    [estado, perfil, sinConfirmar, vencida, aviso, entrar, salir, refrescar]
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
