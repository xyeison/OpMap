/**
 * El audio del dictado en el teléfono: opciones de grabación (m4a AAC mono, liviano: 3 minutos ≈ 1,5 MB) y su
 * borrado. Regla del dueño: el audio NO se guarda; en el teléfono vive solo hasta que llega la transcripción (o
 * hasta que se cancela) y entonces se borra. En el navegador la grabación es un blob en memoria: se libera.
 */
import { File } from 'expo-file-system'
import { RecordingPresets, type RecordingOptions } from 'expo-audio'
import { Platform } from 'react-native'

export const OPCIONES_GRABACION: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
  sampleRate: 44100,
  bitRate: 64000,
  android: { ...RecordingPresets.HIGH_QUALITY.android, outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { ...RecordingPresets.HIGH_QUALITY.ios },
  web: { bitsPerSecond: 64000 },
}

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
