/**
 * El audio del dictado en el teléfono: opciones de grabación (m4a AAC mono, liviano: 3 minutos ≈ 1,5 MB) y su
 * borrado. Regla del dueño: el audio NO se guarda; en el teléfono vive solo hasta que llega la transcripción (o
 * hasta que se cancela) y entonces se borra. En el navegador la grabación es un blob en memoria: se libera.
 * Perfil (spec 2026-10-15, decisión 9): por defecto 64 kbps y 44,1 kHz, como siempre; con
 * EXPO_PUBLIC_PERFIL_AUDIO=ligero, 32 kbps y 22,05 kHz (lib/audio-perfil.ts), solo para la prueba A/B del dueño (D7).
 */
import { File } from 'expo-file-system'
import { RecordingPresets, type RecordingOptions } from 'expo-audio'
import { Platform } from 'react-native'
import { opcionesGrabacion, perfilAudioDe } from './audio-perfil'

/** El perfil de esta compilación (Expo pone el valor de EXPO_PUBLIC_PERFIL_AUDIO al compilar). */
export const PERFIL_AUDIO = perfilAudioDe(process.env.EXPO_PUBLIC_PERFIL_AUDIO)

export const OPCIONES_GRABACION: RecordingOptions = opcionesGrabacion(PERFIL_AUDIO, RecordingPresets.HIGH_QUALITY)

/** Borra la grabación del teléfono (o libera el blob en el navegador). Nunca lanza. */
export function borrarAudio(uri: string | null | undefined): void {
  if (!uri) return
  try {
    if (Platform.OS === 'web') {
      if (uri.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(uri)
      return
    }
    const archivo = new File(uri)
    if (archivo.exists) archivo.delete()
  } catch {
    // Si no se pudo borrar, el sistema limpia la carpeta temporal; nunca se sube a otro lado.
  }
}
