/**
 * Perfil de grabación del dictado (spec 2026-10-15, decisión 9 y "Para decidir" D7). Por defecto NO cambia: AAC mono a
 * 64 kbps y 44,1 kHz (3 minutos ≈ 1,5 MB). El perfil ligero (32 kbps, 22,05 kHz, mono AAC; la mitad de bytes con mala
 * señal) queda listo solo detrás de EXPO_PUBLIC_PERFIL_AUDIO=ligero, para la prueba A/B del dueño con el mismo dictado.
 * OpenAI cobra por minuto, no por bytes: el costo no cambia. Puro (sin expo-audio en tiempo de ejecución, solo su tipo):
 * lo prueba scripts/checks/18-tiempos.ts; lib/audio.ts lo aplica sobre RecordingPresets.HIGH_QUALITY.
 */
import type { RecordingOptions } from 'expo-audio'

export type PerfilAudio = 'normal' | 'ligero'

/** Valor de EXPO_PUBLIC_PERFIL_AUDIO → perfil. Solo "ligero" (sin importar mayúsculas ni espacios) cambia algo. */
export function perfilAudioDe(valor: string | null | undefined): PerfilAudio {
  return (valor ?? '').trim().toLowerCase() === 'ligero' ? 'ligero' : 'normal'
}

/** Lo que cada perfil fija: bits por segundo, frecuencia de muestreo y canales. */
export const AJUSTES_AUDIO: Readonly<Record<PerfilAudio, { bitRate: number; sampleRate: number; numberOfChannels: number }>> = {
  normal: { bitRate: 64_000, sampleRate: 44_100, numberOfChannels: 1 },
  ligero: { bitRate: 32_000, sampleRate: 22_050, numberOfChannels: 1 },
}

/**
 * Las opciones de grabación del perfil sobre la base (RecordingPresets.HIGH_QUALITY): m4a AAC mono con medidor de nivel;
 * en Android mpeg4 + aac; en el navegador, los mismos bits por segundo (el MediaRecorder no fija la frecuencia).
 */
export function opcionesGrabacion(perfil: PerfilAudio, base: RecordingOptions): RecordingOptions {
  const ajustes = AJUSTES_AUDIO[perfil]
  return {
    ...base,
    isMeteringEnabled: true,
    numberOfChannels: ajustes.numberOfChannels,
    sampleRate: ajustes.sampleRate,
    bitRate: ajustes.bitRate,
    android: { ...base.android, outputFormat: 'mpeg4', audioEncoder: 'aac' },
    ios: { ...base.ios },
    web: { bitsPerSecond: ajustes.bitRate },
  }
}
