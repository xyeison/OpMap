/**
 * Dónde guarda la app lo que necesita entre aperturas:
 * - El TOKEN de sesión: almacén seguro del teléfono (expo-secure-store: Keychain en iPhone, Keystore en
 *   Android). En el navegador (React Native Web, solo para verificar) va en localStorage.
 * - El PERFIL (usuario y Ejecutivo Comercial enlazado, sin secretos) y la COLA sin señal: AsyncStorage.
 * Nunca se guarda la contraseña ni el audio.
 * El token además vive en MEMORIA (MemoriaToken de lib/token.ts, spec 2026-10-15): el llavero se lee una sola vez por
 * apertura y no en cada petición; guardar y borrar actualizan las dos cosas y un 401 lo olvida al instante.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { MemoriaToken } from './token'

const CLAVE_TOKEN = 'opmap.token.v1'

const esWeb = Platform.OS === 'web'

function almacenWeb(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null
  } catch {
    return null
  }
}

/** El llavero del teléfono (o localStorage en el navegador). Solo lo usa la memoria de abajo. */
const llavero = {
  async leer(): Promise<string | null> {
    try {
      if (esWeb) return almacenWeb()?.getItem(CLAVE_TOKEN) ?? null
      return await SecureStore.getItemAsync(CLAVE_TOKEN)
    } catch {
      return null
    }
  },
  async guardar(token: string): Promise<void> {
    if (esWeb) {
      almacenWeb()?.setItem(CLAVE_TOKEN, token)
      return
    }
    await SecureStore.setItemAsync(CLAVE_TOKEN, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
  },
  async borrar(): Promise<void> {
    try {
      if (esWeb) {
        almacenWeb()?.removeItem(CLAVE_TOKEN)
        return
      }
      await SecureStore.deleteItemAsync(CLAVE_TOKEN)
    } catch {
      // Si no se puede borrar, la sesión igual se olvida en memoria.
    }
  },
}

const memoriaToken = new MemoriaToken(llavero)

/** Token de la sesión o null (si el almacén falla, como si no hubiera sesión). El llavero se lee una sola vez. */
export function leerToken(): Promise<string | null> {
  return memoriaToken.leer()
}

export function guardarToken(token: string): Promise<void> {
  return memoriaToken.guardar(token)
}

export function borrarToken(): Promise<void> {
  return memoriaToken.borrar()
}

/**
 * En el navegador: avisa cuando OTRA pestaña cambia el token (OpMap lo borra al entrar y al salir; otra pestaña de la app
 * lo guarda o lo borra), con el valor nuevo (null si lo borró) y el que esta pestaña tenía en memoria (undefined si aún no
 * lo había leído). El evento storage no llega a la pestaña que lo cambió. Lo de memoria se suelta antes de avisar: la
 * próxima lectura es la del navegador. En el teléfono no hace nada.
 */
export function alCambiarTokenEnOtraPestana(oyente: (cambio: { nuevo: string | null; anterior: string | null | undefined }) => void): () => void {
  const ventana = globalThis as { addEventListener?: (tipo: string, f: (e: { key: string | null; newValue: string | null }) => void) => void; removeEventListener?: (tipo: string, f: (e: { key: string | null; newValue: string | null }) => void) => void }
  if (!esWeb || typeof ventana.addEventListener !== 'function') return () => undefined
  const alCambiar = (evento: { key: string | null; newValue: string | null }) => {
    // key null: se vació todo el almacenamiento (localStorage.clear())
    if (evento.key !== null && evento.key !== CLAVE_TOKEN) return
    const anterior = memoriaToken.releer()
    oyente({ nuevo: evento.key === null ? null : evento.newValue, anterior })
  }
  ventana.addEventListener('storage', alCambiar)
  return () => ventana.removeEventListener?.('storage', alCambiar)
}

/** Un 401 con ese token: ninguna petición siguiente lo manda (la sesión lo borra luego del llavero). */
export function olvidarTokenPor401(token: string | null | undefined): void {
  memoriaToken.olvidarSiEs(token)
}

/** Lee un JSON de AsyncStorage (null si no hay o está dañado). */
export async function leerJson<T>(clave: string): Promise<T | null> {
  try {
    const texto = await AsyncStorage.getItem(clave)
    return texto ? (JSON.parse(texto) as T) : null
  } catch {
    return null
  }
}

export async function guardarJson(clave: string, valor: unknown): Promise<void> {
  await AsyncStorage.setItem(clave, JSON.stringify(valor))
}

export async function borrarClave(clave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(clave)
  } catch {
    // nada que hacer
  }
}

/** Texto crudo (la cola guarda su propio formato). */
export const almacenTexto = {
  leer: (clave: string) => AsyncStorage.getItem(clave),
  escribir: (clave: string, valor: string) => AsyncStorage.setItem(clave, valor),
}
