/**
 * IndexedDB para la app en el navegador (/campo, app sin señal, dueño 2026-10-30): la cola de visitas, las fotos, el
 * perfil, el contexto guardado y el token viven aquí y no en localStorage (que un navegador puede vaciar antes y que el
 * service worker no puede leer). Base `opmap-campo`, con dos almacenes:
 *   - kv: texto por clave (las mismas claves que AsyncStorage usaba: opmap.cola.v2.<usuario>, opmap.perfil.v1,
 *     opmap.contexto.v1, opmap.token.v1). El service worker (public/sw-cola.js) lee la cola y el token de aquí para
 *     Background Sync.
 *   - fotos: una por visita (client_id): el JPEG comprimido (Blob) y su estado de subida.
 * Versionada con `upgrade(db, versionVieja)`: cada versión AGREGA (almacenes o índices); nunca se borra un almacén ni
 * la base entera (los reportes pendientes de la persona están ahí). La primera vez que una clave no está en IndexedDB
 * se busca en localStorage (lo que guardó la versión anterior de la app) y se copia; localStorage no se borra.
 * Solo se importa en la web (lib/almacen.ts lo elige por Platform.OS); en el teléfono siguen SecureStore y AsyncStorage.
 * Si IndexedDB falla (modo incógnito de Safari viejo, almacenamiento bloqueado), cada operación cae a localStorage: la
 * app sigue, y Hoy avisa que no use el modo incógnito (lib/pwa.ts).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export const NOMBRE_BD = 'opmap-campo'
/** Versión del esquema. Subirla = agregar en `actualizar` lo nuevo bajo `if (desde < N)`. Nunca borrar. */
export const VERSION_BD = 1
export const ALMACEN_KV = 'kv'
export const ALMACEN_FOTOS = 'fotos'

export type EstadoFoto = 'pendiente' | 'enviando' | 'enviada' | 'no_enviada'

/** Una foto de visita guardada en el navegador (el teléfono guarda el archivo aparte; ver lib/cola-fotos.ts). */
export interface RegistroFoto {
  client_id: string
  usuario_id: string
  /** El JPEG comprimido (web). En el teléfono va `uri` y el blob queda null. */
  blob: Blob | null
  uri: string | null
  bytes: number
  creado_at: string
  estado: EstadoFoto
  intentos: number
  ultimo_intento_at: string | null
  proximo_intento_at: string | null
  error: string | null
  enviada_at: string | null
}

interface EsquemaCampo extends DBSchema {
  kv: { key: string; value: { clave: string; valor: string; guardado_at: string } }
  fotos: { key: string; value: RegistroFoto; indexes: { usuario: string } }
}

/** Qué agrega cada versión (puro: lo prueban las pruebas con un IDB falso y lo usa `abrir`). */
export function actualizar(db: { createObjectStore: (nombre: string, opciones: { keyPath: string }) => { createIndex: (nombre: string, ruta: string) => unknown }; objectStoreNames: { contains: (nombre: string) => boolean } }, desde: number): void {
  if (desde < 1) {
    if (!db.objectStoreNames.contains(ALMACEN_KV)) db.createObjectStore(ALMACEN_KV, { keyPath: 'clave' })
    if (!db.objectStoreNames.contains(ALMACEN_FOTOS)) {
      const fotos = db.createObjectStore(ALMACEN_FOTOS, { keyPath: 'client_id' })
      fotos.createIndex('usuario', 'usuario_id')
    }
  }
  // Versiones futuras: `if (desde < 2) { … }` agregando; nunca deleteObjectStore ni deleteDB.
}

export function idbDisponible(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

let abierta: Promise<IDBPDatabase<EsquemaCampo>> | null = null

/** La base (una sola conexión por pestaña). Lanza si IndexedDB no está. */
export function abrir(): Promise<IDBPDatabase<EsquemaCampo>> {
  if (!abierta) {
    abierta = openDB<EsquemaCampo>(NOMBRE_BD, VERSION_BD, {
      upgrade(db, desde) {
        actualizar(db as unknown as Parameters<typeof actualizar>[0], desde)
      },
      // Otra pestaña con una versión nueva pide que esta cierre: se cierra y la próxima operación vuelve a abrir.
      blocking() {
        void abierta?.then(db => db.close())
        abierta = null
      },
      terminated() {
        abierta = null
      },
    }).catch(error => {
      abierta = null
      throw error
    })
  }
  return abierta
}

function localStorageSeguro(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null
  } catch {
    return null
  }
}

// --- kv ---------------------------------------------------------------------------------------------------------

/**
 * Lee una clave. Si no está en IndexedDB pero sí en localStorage (la versión anterior de la app), la copia a IndexedDB
 * y la devuelve (localStorage no se toca: nunca se borra lo que ya estaba).
 */
export async function kvLeer(clave: string): Promise<string | null> {
  try {
    const db = await abrir()
    const fila = await db.get(ALMACEN_KV, clave)
    if (fila) return fila.valor
    const viejo = localStorageSeguro()?.getItem(clave) ?? null
    if (viejo !== null) {
      await db.put(ALMACEN_KV, { clave, valor: viejo, guardado_at: new Date().toISOString() }).catch(() => undefined)
    }
    return viejo
  } catch {
    return localStorageSeguro()?.getItem(clave) ?? null
  }
}

export async function kvEscribir(clave: string, valor: string): Promise<void> {
  try {
    const db = await abrir()
    await db.put(ALMACEN_KV, { clave, valor, guardado_at: new Date().toISOString() })
  } catch {
    const ls = localStorageSeguro()
    if (!ls) throw new Error('El navegador no deja guardar datos (¿modo incógnito?)')
    ls.setItem(clave, valor)
  }
}

export async function kvBorrar(clave: string): Promise<void> {
  try {
    const db = await abrir()
    await db.delete(ALMACEN_KV, clave)
  } catch {
    // nada
  }
  try {
    localStorageSeguro()?.removeItem(clave)
  } catch {
    // nada
  }
}

// --- fotos --------------------------------------------------------------------------------------------------------

export async function fotoGuardar(registro: RegistroFoto): Promise<void> {
  const db = await abrir()
  await db.put(ALMACEN_FOTOS, registro)
}

export async function fotoLeer(clientId: string): Promise<RegistroFoto | null> {
  try {
    const db = await abrir()
    return (await db.get(ALMACEN_FOTOS, clientId)) ?? null
  } catch {
    return null
  }
}

export async function fotosDe(usuarioId: string): Promise<RegistroFoto[]> {
  try {
    const db = await abrir()
    return await db.getAllFromIndex(ALMACEN_FOTOS, 'usuario', usuarioId)
  } catch {
    return []
  }
}

export async function fotoQuitar(clientId: string): Promise<void> {
  try {
    const db = await abrir()
    await db.delete(ALMACEN_FOTOS, clientId)
  } catch {
    // nada
  }
}
