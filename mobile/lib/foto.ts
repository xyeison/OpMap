/**
 * La foto de la visita (app sin señal, dueño 2026-10-30): se toma con la cámara o se elige de la galería, se COMPRIME
 * en el teléfono (lado mayor 1600 px, JPEG al 70 %) y se guarda en la cola de fotos antes de subir. Nunca se sube el
 * original. Las reglas de tamaño (dimensionesComprimidas) son puras; la cámara y la compresión usan expo-image-picker,
 * expo-image-manipulator (teléfono) y canvas (navegador). Las reglas puras están en lib/foto-reglas.ts.
 */
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { Platform } from 'react-native'

import { FOTO_CALIDAD, FOTO_LADO_MAX, FOTO_MAX_BYTES, MENSAJE_FOTO_GRANDE, MENSAJE_SIN_PERMISO_CAMARA, dimensionesComprimidas } from './foto-reglas'

export { FOTO_CALIDAD, FOTO_LADO_MAX, FOTO_MAX_BYTES, MENSAJE_FOTO_GRANDE, MENSAJE_SIN_PERMISO_CAMARA, dimensionesComprimidas, textoBytes } from './foto-reglas'

export interface FotoComprimida {
  /** URI local (teléfono: archivo en caché; navegador: blob: URL para la vista previa). */
  uri: string
  ancho: number
  alto: number
  bytes: number
  /** Solo en el navegador: el JPEG listo para guardar en IndexedDB. */
  blob: Blob | null
}

export type OrigenFoto = 'camara' | 'galeria'

/** Abre la cámara o la galería y devuelve la imagen elegida (null si canceló). Lanza con el mensaje si no hay permiso. */
export async function elegirFoto(origen: OrigenFoto): Promise<{ uri: string; width: number; height: number } | null> {
  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync()
    if (!permiso.granted) throw new Error(MENSAJE_SIN_PERMISO_CAMARA)
  }
  const resultado =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: false, allowsEditing: false, allowsMultipleSelection: false })
  if (resultado.canceled || resultado.assets.length === 0) return null
  const asset = resultado.assets[0]
  return { uri: asset.uri, width: asset.width, height: asset.height }
}

/** Comprime a 1600 px y JPEG 70 %. En el navegador con canvas (y devuelve el Blob); en el teléfono con expo-image-manipulator. */
export async function comprimirFoto(imagen: { uri: string; width: number; height: number }): Promise<FotoComprimida> {
  const { ancho, alto } = dimensionesComprimidas(imagen.width, imagen.height)
  if (Platform.OS === 'web') return comprimirEnNavegador(imagen.uri, ancho, alto)
  const contexto = ImageManipulator.ImageManipulator.manipulate(imagen.uri)
  if (ancho > 0 && alto > 0 && (ancho !== imagen.width || alto !== imagen.height)) contexto.resize({ width: ancho, height: alto })
  const render = await contexto.renderAsync()
  const guardada = await render.saveAsync({ compress: FOTO_CALIDAD, format: ImageManipulator.SaveFormat.JPEG })
  render.release()
  const bytes = await tamanoDeUri(guardada.uri)
  if (bytes > FOTO_MAX_BYTES) throw new Error(MENSAJE_FOTO_GRANDE)
  return { uri: guardada.uri, ancho: guardada.width, alto: guardada.height, bytes, blob: null }
}

async function tamanoDeUri(uri: string): Promise<number> {
  try {
    const respuesta = await fetch(uri)
    const blob = await respuesta.blob()
    return blob.size
  } catch {
    return 0
  }
}

async function comprimirEnNavegador(uri: string, ancho: number, alto: number): Promise<FotoComprimida> {
  const doc = (globalThis as unknown as { document?: Document }).document
  if (!doc) throw new Error('Sin navegador')
  const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = doc.createElement('img')
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la foto'))
    img.src = uri
  })
  const dims = ancho > 0 && alto > 0 ? { ancho, alto } : dimensionesComprimidas(imagen.naturalWidth, imagen.naturalHeight)
  const lienzo = doc.createElement('canvas')
  lienzo.width = dims.ancho
  lienzo.height = dims.alto
  const ctx = lienzo.getContext('2d')
  if (!ctx) throw new Error('No se pudo comprimir la foto')
  ctx.drawImage(imagen, 0, 0, dims.ancho, dims.alto)
  const blob = await new Promise<Blob | null>(resolve => lienzo.toBlob(resolve, 'image/jpeg', FOTO_CALIDAD))
  if (!blob) throw new Error('No se pudo comprimir la foto')
  if (blob.size > FOTO_MAX_BYTES) throw new Error(MENSAJE_FOTO_GRANDE)
  const URLo = (globalThis as unknown as { URL: { createObjectURL: (b: Blob) => string } }).URL
  return { uri: URLo.createObjectURL(blob), ancho: dims.ancho, alto: dims.alto, bytes: blob.size, blob }
}
