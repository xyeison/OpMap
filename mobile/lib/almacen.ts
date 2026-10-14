/**
 * Dónde guarda la app lo que necesita entre aperturas:
 * - El TOKEN de sesión: almacén seguro del teléfono (expo-secure-store: Keychain en iPhone, Keystore en
 *   Android). En el navegador (React Native Web, solo para verificar) va en localStorage.
 * - El PERFIL (usuario y Ejecutivo Comercial enlazado, sin secretos) y la COLA sin señal: AsyncStorage.
 * Nunca se guarda la contraseña ni el audio.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const CLAVE_TOKEN = 'opmap.token.v1'

const esWeb = Platform.OS === 'web'

function almacenWeb(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null
  } catch {
    return null
  }
}

/** Token guardado o null (si el almacén falla, como si no hubiera sesión). */
export async function leerToken(): Promise<string | null> {
  try {
    if (esWeb) return almacenWeb()?.getItem(CLAVE_TOKEN) ?? null
    return await SecureStore.getItemAsync(CLAVE_TOKEN)
  } catch {
    return null
  }
}

export async function guardarToken(token: string): Promise<void> {
  if (esWeb) {
    almacenWeb()?.setItem(CLAVE_TOKEN, token)
    return
  }
  await SecureStore.setItemAsync(CLAVE_TOKEN, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
}

export async function borrarToken(): Promise<void> {
  try {
    if (esWeb) {
      almacenWeb()?.removeItem(CLAVE_TOKEN)
      return
    }
    await SecureStore.deleteItemAsync(CLAVE_TOKEN)
  } catch {
    // Si no se puede borrar, la sesión igual se olvida en memoria.
  }
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
