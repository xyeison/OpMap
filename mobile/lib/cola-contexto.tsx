/**
 * La cola sin señal conectada a la app (app sin señal, dueño 2026-10-30): una cola de visitas por usuario (otra persona
 * que entre en el mismo teléfono no envía visitas ajenas) y una cola de fotos (lib/cola-fotos.ts) que sube después de
 * cada visita enviada. Almacén: AsyncStorage y archivos en el teléfono; IndexedDB en el navegador (lib/almacen-idb.ts).
 *
 * Cuándo se intenta subir: al guardar (encolarYEnviar), al abrir la app, al volver a primer plano, al volver la señal
 * (lib/conexion.ts: entonces sin esperar la espera creciente), cada minuto mientras haya pendientes y la app esté
 * abierta, con "Subir ahora" (subirAhora: fuerza) y, en el navegador donde existe, con Background Sync (lib/pwa.ts:
 * el service worker sube la cola aunque la página esté cerrada). Un 401 detiene la cola sin tocarla: la sesión pide
 * entrar de nuevo y, con el mismo usuario, la cola sigue. Cerrar sesión nunca borra pendientes.
 *
 * Cada 201 de POST /api/me/visitas (nueva o repetida, al momento o desde la cola) invalida el contexto en memoria
 * (spec 2026-10-15, decisión 7): Hoy y Reportar vuelven a pedir lo hecho hoy.
 */
import { Directory, File, Paths } from 'expo-file-system'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'
import { almacenTexto, leerJson, guardarJson } from './almacen'
import { fotoGuardar, fotoLeer, fotoQuitar, fotosDe, type RegistroFoto } from './almacen-idb'
import * as api from './api'
import { ColaVisitas, claveCola, claveColaV1, resumen as resumenDe, type ElementoCola, type ResultadoProceso, type ResumenCola } from './cola'
import { nuevoRegistroFoto, podarFotos, procesarFotos, resumenFotos, type AlmacenFotos } from './cola-fotos'
import { useConexion } from './conexion'
import { invalidarContexto } from './contexto-memoria'
import { TIEMPO_COLA_MS } from './http'
import { registrarSync } from './pwa'
import { useSesion } from './sesion'
import type { FotoBorrador } from './propuesta'
import type { VisitaCreate } from './tipos'

const REINTENTO_MS = 60_000
const esWeb = Platform.OS === 'web'

export interface ValorCola {
  items: ElementoCola[]
  resumen: ResumenCola
  fotos: RegistroFoto[]
  resumenFotos: { pendientes: number; enviadas_hoy: number; no_enviadas: number }
  enviando: boolean
  /** Hay conexión según la red (la verdad final la da cada petición). */
  enLinea: boolean
  /**
   * Guarda la visita (nunca se pierde) y, si trae foto, la foto; luego intenta enviar ya. Lanza solo si no se pudo
   * guardar.
   */
  encolarYEnviar: (cuerpo: VisitaCreate, resumen: string, foto?: FotoBorrador | null) => Promise<{ elemento: ElementoCola; proceso: ResultadoProceso }>
  /** Intenta enviar lo que toca ahora (respeta la espera creciente). */
  reintentar: () => Promise<ResultadoProceso | null>
  /** "Subir ahora": intenta todo lo pendiente sin esperar. */
  subirAhora: () => Promise<ResultadoProceso | null>
  /** Descarta una visita de la cola (la persona leyó el aviso) y su foto. */
  quitar: (clientId: string) => Promise<void>
}

const ContextoCola = createContext<ValorCola | null>(null)

const enviarVisita = async (cuerpo: VisitaCreate) => {
  const respuesta = await api.crearVisita(cuerpo, TIEMPO_COLA_MS)
  // 201: lo hecho hoy cambió (o ya estaba): el contexto en memoria deja de servir.
  invalidarContexto('visita')
  return { visita_id: respuesta.visita.id, repetida: respuesta.repetida }
}

// ---------------------------------------------------------------------------------------------
// Almacén de fotos: IndexedDB (navegador) o archivos + índice en AsyncStorage (teléfono)
// ---------------------------------------------------------------------------------------------

const CLAVE_INDICE_FOTOS = 'opmap.fotos.v1'

function directorioFotos(): Directory {
  const dir = new Directory(Paths.document, 'fotos')
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  return dir
}

/** El índice de fotos del teléfono (todas las personas): se filtra por usuario al listar. */
async function leerIndice(): Promise<RegistroFoto[]> {
  return (await leerJson<RegistroFoto[]>(CLAVE_INDICE_FOTOS)) ?? []
}

const almacenFotosTelefono: AlmacenFotos = {
  async listar(usuarioId) {
    return (await leerIndice()).filter(f => f.usuario_id === usuarioId)
  },
  async guardar(registro) {
    const indice = await leerIndice()
    const i = indice.findIndex(f => f.client_id === registro.client_id)
    const sinBlob = { ...registro, blob: null }
    if (i >= 0) indice[i] = sinBlob
    else indice.push(sinBlob)
    await guardarJson(CLAVE_INDICE_FOTOS, indice)
  },
  async datos(registro) {
    if (!registro.uri) return null
    const archivo = new File(registro.uri)
    return archivo.exists ? registro.uri : null
  },
  async borrarDatos(registro) {
    if (!registro.uri) return
    try {
      const archivo = new File(registro.uri)
      if (archivo.exists) archivo.delete()
    } catch {
      // nada
    }
  },
  async quitar(clientId) {
    const indice = await leerIndice()
    const registro = indice.find(f => f.client_id === clientId)
    if (registro) await almacenFotosTelefono.borrarDatos(registro)
    await guardarJson(CLAVE_INDICE_FOTOS, indice.filter(f => f.client_id !== clientId))
  },
}

const almacenFotosNavegador: AlmacenFotos = {
  listar: usuarioId => fotosDe(usuarioId),
  guardar: registro => fotoGuardar(registro),
  async datos(registro) {
    const guardado = await fotoLeer(registro.client_id)
    return guardado?.blob ?? null
  },
  async borrarDatos(registro) {
    const guardado = await fotoLeer(registro.client_id)
    if (guardado) await fotoGuardar({ ...guardado, blob: null })
  },
  quitar: clientId => fotoQuitar(clientId),
}

const almacenFotos: AlmacenFotos = esWeb ? almacenFotosNavegador : almacenFotosTelefono

/** Guarda la foto comprimida en el teléfono (copia al directorio de documentos) o en IndexedDB, como registro pendiente. */
async function guardarFotoPendiente(usuarioId: string, clientId: string, foto: FotoBorrador): Promise<void> {
  const ahora = new Date()
  if (esWeb) {
    if (!foto.blob) throw new Error('La foto no tiene datos')
    await almacenFotos.guardar(nuevoRegistroFoto({ client_id: clientId, usuario_id: usuarioId, blob: foto.blob, bytes: foto.bytes }, ahora))
    return
  }
  const destino = new File(directorioFotos(), `${clientId}.jpg`)
  if (destino.exists) destino.delete()
  new File(foto.uri).copy(destino)
  await almacenFotos.guardar(nuevoRegistroFoto({ client_id: clientId, usuario_id: usuarioId, uri: destino.uri, bytes: foto.bytes }, ahora))
}

const subirFoto = async (clientId: string, datos: Blob | string) => api.subirFoto(clientId, datos)

export function ProveedorCola({ children }: { children: ReactNode }) {
  const { estado, perfil } = useSesion()
  const usuarioId = estado === 'con_sesion' ? (perfil?.usuario.id ?? null) : null
  const [items, setItems] = useState<ElementoCola[]>([])
  const [fotos, setFotos] = useState<RegistroFoto[]>([])
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)

  const cola = useMemo(() => {
    if (!usuarioId) return null
    const clave = claveCola(usuarioId)
    const claveVieja = claveColaV1(usuarioId)
    return new ColaVisitas({ leer: () => almacenTexto.leer(clave), escribir: texto => almacenTexto.escribir(clave, texto) }, () => new Date(), { leer: () => almacenTexto.leer(claveVieja) })
  }, [usuarioId])

  /** Las fotos de la persona (poda las viejas) y las sube si su visita ya está enviada. */
  const procesarLasFotos = useCallback(
    async (visitas: readonly ElementoCola[], forzar: boolean): Promise<void> => {
      if (!usuarioId) return
      const ahora = new Date()
      const todas = await almacenFotos.listar(usuarioId)
      const { quedan, fuera } = podarFotos(todas, ahora)
      for (const f of fuera) await almacenFotos.quitar(f.client_id).catch(() => undefined)
      // Enviadas, y las fotos cuya visita ya no está en la cola (se envió otro día y se podó; una pendiente siempre está).
      const enCola = new Set(visitas.map(v => v.client_id))
      const enviadas = new Set([...visitas.filter(v => v.estado === 'enviada').map(v => v.client_id), ...quedan.filter(f => !enCola.has(f.client_id)).map(f => f.client_id)])
      const resultado = await procesarFotos({
        fotos: quedan,
        visitasEnviadas: enviadas,
        subir: subirFoto,
        datos: registro => almacenFotos.datos(registro),
        guardar: registro => almacenFotos.guardar(registro),
        borrarDatos: registro => almacenFotos.borrarDatos(registro),
        forzar,
      })
      setFotos(resultado.fotos)
    },
    [usuarioId]
  )

  const procesar = useCallback(
    async (forzar: boolean): Promise<ResultadoProceso | null> => {
      if (!cola || enCurso.current) return null
      enCurso.current = true
      setEnviando(true)
      try {
        const resultado = await cola.procesar(enviarVisita, { forzar })
        if (resultado.detenida !== 'sesion') await procesarLasFotos(resultado.cola, forzar).catch(() => undefined)
        return resultado
      } catch {
        return null
      } finally {
        enCurso.current = false
        setEnviando(false)
      }
    },
    [cola, procesarLasFotos]
  )
  const reintentar = useCallback(() => procesar(false), [procesar])
  const subirAhora = useCallback(() => procesar(true), [procesar])

  // Volver la señal → subir enseguida (sin esperar la espera creciente).
  const enLinea = useConexion(subirAhora)

  // Cargar la cola del usuario y escuchar sus cambios.
  useEffect(() => {
    if (!cola) {
      setItems([])
      setFotos([])
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

  // Cada minuto, mientras haya pendientes (visitas o fotos) y la app esté abierta.
  const hayPendientes = items.some(e => e.estado === 'pendiente' || e.estado === 'enviando') || fotos.some(f => f.estado === 'pendiente' || f.estado === 'enviando')
  useEffect(() => {
    if (!cola || !hayPendientes) return
    const temporizador = setInterval(() => {
      if (AppState.currentState === 'active') void reintentar()
    }, REINTENTO_MS)
    return () => clearInterval(temporizador)
  }, [cola, hayPendientes, reintentar])

  // Con pendientes en el navegador: pedir Background Sync (si existe) para que el service worker suba aunque se cierre.
  useEffect(() => {
    if (!esWeb || !hayPendientes) return
    void registrarSync()
  }, [hayPendientes])

  const encolarYEnviar = useCallback(
    async (cuerpo: VisitaCreate, texto: string, foto?: FotoBorrador | null) => {
      if (!cola || !usuarioId) throw new Error('Entra de nuevo para reportar')
      enCurso.current = true
      setEnviando(true)
      try {
        let conFoto = false
        if (foto) {
          // La foto se guarda ANTES de intentar nada (si falla, la visita sigue; se avisa).
          try {
            await guardarFotoPendiente(usuarioId, cuerpo.client_id, foto)
            conFoto = true
          } catch {
            conFoto = false
          }
        }
        const resultado = await cola.encolarYEnviar(cuerpo, texto, enviarVisita, conFoto)
        if (conFoto && resultado.proceso.detenida !== 'sesion') await procesarLasFotos(resultado.proceso.cola, true).catch(() => undefined)
        return resultado
      } finally {
        enCurso.current = false
        setEnviando(false)
      }
    },
    [cola, usuarioId, procesarLasFotos]
  )

  const quitar = useCallback(
    async (clientId: string) => {
      if (cola) await cola.quitar(clientId)
      await almacenFotos.quitar(clientId).catch(() => undefined)
      setFotos(prev => prev.filter(f => f.client_id !== clientId))
    },
    [cola]
  )

  const valor = useMemo<ValorCola>(
    () => ({
      items,
      resumen: resumenDe(items, new Date()),
      fotos,
      resumenFotos: resumenFotos(fotos, new Date()),
      enviando,
      enLinea,
      encolarYEnviar,
      reintentar,
      subirAhora,
      quitar,
    }),
    [items, fotos, enviando, enLinea, encolarYEnviar, reintentar, subirAhora, quitar]
  )
  return <ContextoCola.Provider value={valor}>{children}</ContextoCola.Provider>
}

export function useCola(): ValorCola {
  const valor = useContext(ContextoCola)
  if (!valor) throw new Error('useCola necesita <ProveedorCola>')
  return valor
}
