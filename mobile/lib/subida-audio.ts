/**
 * El audio grabado como parte de FormData (campo `audio` de POST /api/me/voz/transcribir). Puro: sin React Native.
 *
 * En Expo SDK 57 el `fetch` del teléfono es el de Expo (expo/src/winter/fetch), que solo acepta en FormData texto,
 * Blob u objetos con `bytes()`. El `{ uri, name, type }` de React Native ya no sirve: da "Unsupported FormDataPart
 * implementation". Por eso la parte lleva nombre, tipo y un `bytes()` que lee el archivo al enviar.
 */

/** Tipo y nombre del archivo según la extensión de la grabación (m4a por defecto, como graba iOS y Android). */
export function tipoAudio(uri: string): { tipo: string; nombre: string } {
  const limpia = uri.split('?')[0].toLowerCase()
  if (limpia.endsWith('.webm')) return { tipo: 'audio/webm', nombre: 'dictado.webm' }
  if (limpia.endsWith('.mp4')) return { tipo: 'audio/mp4', nombre: 'dictado.mp4' }
  if (limpia.endsWith('.aac')) return { tipo: 'audio/aac', nombre: 'dictado.aac' }
  return { tipo: 'audio/m4a', nombre: 'dictado.m4a' }
}

export interface ParteAudio {
  name: string
  type: string
  bytes: () => Promise<Uint8Array>
}

/** Parte del audio para el FormData de Expo; `leerBytes` se llama solo al enviar (no al armar el formulario). */
export function parteAudio(uri: string, leerBytes: () => Promise<Uint8Array>): ParteAudio {
  const { tipo, nombre } = tipoAudio(uri)
  return { name: nombre, type: tipo, bytes: leerBytes }
}
