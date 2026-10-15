/**
 * Vibración corta (expo-haptics, incluido en Expo Go SDK 57): al empezar y terminar de grabar y con el 201 de una
 * visita. En el navegador no hace nada, y nunca lanza: si el teléfono no vibra (o lo tiene apagado), sigue igual.
 */
import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

function vibrar(accion: () => Promise<void>): void {
  if (Platform.OS === 'web') return
  try {
    void accion().catch(() => undefined)
  } catch {
    // sin vibración: la app sigue igual
  }
}

/** Toque suave (empezar o terminar de grabar). */
export function vibrarSuave(): void {
  vibrar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** Éxito (la visita quedó guardada). */
export function vibrarExito(): void {
  vibrar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

/** Aviso (algo no salió: revisa). */
export function vibrarAviso(): void {
  vibrar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
}
