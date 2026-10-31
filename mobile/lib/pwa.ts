/**
 * Lo que la app necesita del navegador para funcionar sin señal como app instalada (PWA en /campo, dueño 2026-10-30).
 * En el teléfono (Expo) nada de esto aplica y cada función responde "no aplica". Sin React.
 *
 * - Service worker: lo registra public/sw-registro.js (en el index.html) y deja en window.__campoSW lo que pasa; aquí
 *   se escucha "hay una versión nueva" (hayVersionNueva/alHaberVersionNueva) y se pide actualizar (aplicarVersionNueva:
 *   manda SKIP_WAITING al worker en espera y recarga cuando toma el control). La app solo actualiza cuando no hay una
 *   subida en curso (la cola decide), y los datos (IndexedDB) no se tocan: una versión nueva nunca pierde pendientes.
 * - Background Sync: registrarSync pide al service worker que suba la cola cuando vuelva la señal, aunque la página esté
 *   cerrada (Chrome en Android). Se detecta si existe (SyncManager), no se supone: en iPhone no está y la cola sube al
 *   abrir la app.
 * - Almacenamiento persistente: navigator.storage.persist() al entrar; si el navegador lo niega o no existe, Hoy avisa.
 * - Modo incógnito / almacenamiento no fiable: no se puede detectar con certeza; se avisa si persist() dice que no o si
 *   IndexedDB no abre. Y se detecta si la app corre instalada (display-mode: standalone) para ofrecer "Agregar a inicio".
 */
import { Platform } from 'react-native'
import { ETIQUETA_SYNC } from './pwa-reglas'

export { ETIQUETA_SYNC, almacenamientoDudoso } from './pwa-reglas'

type Ventana = {
  navigator?: {
    serviceWorker?: { ready: Promise<{ sync?: { register: (tag: string) => Promise<void> }; waiting: { postMessage: (m: unknown) => void } | null }>; controller: unknown; addEventListener: (e: string, f: () => void) => void }
    storage?: { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean>; estimate?: () => Promise<{ quota?: number; usage?: number }> }
    standalone?: boolean
  }
  matchMedia?: (consulta: string) => { matches: boolean }
  location?: { reload: () => void }
  __campoSW?: { versionNueva: boolean; oyentes: ((hay: boolean) => void)[] }
  SyncManager?: unknown
}

const esWeb = Platform.OS === 'web'
const ventana = (): Ventana | null => (esWeb && typeof globalThis !== 'undefined' ? (globalThis as unknown as Ventana) : null)

/** ¿La app corre en el navegador (donde aplican el service worker y la instalación)? */
export const esNavegador = (): boolean => esWeb

/** ¿Existe Background Sync aquí? Se mira, no se supone (en iPhone no existe). */
export function haySync(): boolean {
  const w = ventana()
  return !!w && 'SyncManager' in w && !!w.navigator?.serviceWorker
}

/** Pide al service worker que suba la cola cuando haya red (aunque la página se cierre). true si quedó registrado. */
export async function registrarSync(): Promise<boolean> {
  const w = ventana()
  if (!w || !haySync()) return false
  try {
    const registro = await w.navigator!.serviceWorker!.ready
    if (!registro.sync) return false
    await registro.sync.register(ETIQUETA_SYNC)
    return true
  } catch {
    return false
  }
}

/** Almacenamiento persistente: true si el navegador lo concede (o ya lo tenía); null si no aplica (teléfono). */
export async function pedirAlmacenamientoPersistente(): Promise<boolean | null> {
  const w = ventana()
  if (!w) return null
  const storage = w.navigator?.storage
  if (!storage?.persist) return false
  try {
    if (storage.persisted && (await storage.persisted())) return true
    return await storage.persist()
  } catch {
    return false
  }
}

/** Mide lo que almacenamientoDudoso necesita (en el teléfono: nada dudoso). */
export async function medirAlmacenamiento(abrirIdb: () => Promise<unknown>): Promise<{ idbAbre: boolean; cuotaBytes: number | null }> {
  const w = ventana()
  if (!w) return { idbAbre: true, cuotaBytes: null }
  let idbAbre = true
  try {
    await abrirIdb()
  } catch {
    idbAbre = false
  }
  let cuotaBytes: number | null = null
  try {
    const estimado = await w.navigator?.storage?.estimate?.()
    cuotaBytes = typeof estimado?.quota === 'number' ? estimado.quota : null
  } catch {
    cuotaBytes = null
  }
  return { idbAbre, cuotaBytes }
}

/** ¿Abierta desde el ícono de la pantalla de inicio (standalone)? null si no aplica (teléfono). */
export function correInstalada(): boolean | null {
  const w = ventana()
  if (!w) return null
  if (w.navigator?.standalone === true) return true
  try {
    return !!w.matchMedia?.('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

/** iPhone o iPad (Safari): la instalación es desde "Compartir"; no hay Background Sync. */
export function esIphone(): boolean {
  const ua = (globalThis as unknown as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? ''
  return /iPhone|iPad|iPod/i.test(ua)
}

/** ¿El registro del service worker avisó que hay una versión nueva esperando? */
export function hayVersionNueva(): boolean {
  return ventana()?.__campoSW?.versionNueva === true
}

/** Escucha "hay una versión nueva" (public/sw-registro.js lo anuncia). Devuelve cómo dejar de escuchar. */
export function alHaberVersionNueva(oyente: (hay: boolean) => void): () => void {
  const w = ventana()
  if (!w) return () => undefined
  w.__campoSW = w.__campoSW ?? { versionNueva: false, oyentes: [] }
  w.__campoSW.oyentes.push(oyente)
  if (w.__campoSW.versionNueva) oyente(true)
  return () => {
    const lista = w.__campoSW?.oyentes
    if (lista) lista.splice(lista.indexOf(oyente), 1)
  }
}

/** Activa la versión nueva (SKIP_WAITING) y recarga cuando toma el control. Quien llama ya revisó que no hay subida en curso. */
export async function aplicarVersionNueva(): Promise<void> {
  const w = ventana()
  if (!w?.navigator?.serviceWorker) return
  try {
    const registro = await w.navigator.serviceWorker.ready
    if (!registro.waiting) {
      w.location?.reload()
      return
    }
    w.navigator.serviceWorker.addEventListener('controllerchange', () => w.location?.reload())
    registro.waiting.postMessage({ type: 'SKIP_WAITING' })
  } catch {
    w.location?.reload()
  }
}
