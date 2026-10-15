// POST /api/me/voz/transcribir (visits:report + Ejecutivo Comercial enlazado) — multipart con el campo `audio`
// (m4a, mp4 o webm; hasta 25 MB y 3 minutos) y, opcional, `duracion_s`. Transcribe con OpenAI (gpt-4o-transcribe; si
// el modelo no está disponible, whisper-1), en español y con el vocabulario de VG (sus líneas y los subtipos
// vigentes). Responde { transcript, duracion_s, modelo }.
//   400 formato, campo que falta o duración que no se deja leer y no viene · 413 tamaño o duración · 429 demasiadas
//   transcripciones seguidas (LIMITES_VOZ, por persona) · 503 sin OPENAI_API_KEY · 502 si OpenAI falla (la app ofrece
//   el respaldo por toques).
// El tope de 3 minutos NO depende de lo que declare el cliente (OpenAI cobra por minuto): la duración se lee de la
// cabecera del archivo (m4a/mp4: mvhd; webm: Info › Duration o el último bloque). Si el archivo no deja leerla, vale
// la declarada (`duracion_s`); sin ninguna de las dos, 400.
// EL AUDIO NO SE GUARDA (decisión 11): se lee a memoria (request.formData()), se pasa en memoria al SDK y se desecha
// al terminar la petición; nunca se escribe en disco ni en un bucket, y ni el audio ni la transcripción salen en los
// logs. Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (decisión 11 y sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { audioMetaSchema } from '@/lib/reporte-visitas-schemas'
import {
  AUDIO_MARGEN_SEGUNDOS,
  AUDIO_MAX_BYTES,
  AUDIO_MAX_SEGUNDOS,
  MENSAJE_AUDIO_DURACION,
  MENSAJE_AUDIO_SIN_DURACION,
  MENSAJE_AUDIO_FORMATO,
  MENSAJE_AUDIO_TAMANO,
  MENSAJE_FALLO_TRANSCRIPCION,
  duracionAudioSegundos,
  esAudioPermitido,
  vocabularioVG,
  type TranscripcionResponse,
} from '@/lib/reporte-visitas'
import { hoyBogota } from '@/lib/visits-rules'
import { ahora, requireEjecutiva } from '../../../config-visitas/_lib/visitas-server'
import {
  esErrorDeProveedor,
  limiteVoz,
  lineasDeEjecutiva,
  respuestaSinLlave,
  resumenErrorVoz,
  subtiposVigentes,
  transcribirAudio,
} from '../../_lib/reporte-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Transcribir 3 minutos de audio puede tardar más que el tope por defecto de la función.
export const maxDuration = 60

/** Margen del multipart (cabeceras, límites y el campo duracion_s) sobre el tope del archivo. */
const MARGEN_MULTIPART = 256 * 1024

/** Nombre con extensión para OpenAI (detecta el formato por la extensión). */
function nombreDelAudio(tipo: string, nombre: string): string {
  const archivo = nombre.trim().toLowerCase()
  for (const extension of ['.m4a', '.mp4', '.webm', '.aac']) if (archivo.endsWith(extension)) return `dictado${extension}`
  const mime = tipo.split(';')[0].trim().toLowerCase()
  if (mime.includes('webm')) return 'dictado.webm'
  if (mime === 'video/mp4' || mime === 'audio/mp4') return 'dictado.mp4'
  if (mime === 'audio/aac') return 'dictado.aac'
  return 'dictado.m4a'
}

export async function POST(request: NextRequest) {
  const auth = await requireEjecutiva(request, 'POST /api/me/voz/transcribir')
  if (!auth.ok) return auth.response

  // Sin llave no se lee el audio: 503 con el mensaje del contrato (el respaldo por toques sigue funcionando).
  const sinLlave = respuestaSinLlave('openai')
  if (sinLlave) return sinLlave

  const largo = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(largo) && largo > AUDIO_MAX_BYTES + MARGEN_MULTIPART) return jsonError(MENSAJE_AUDIO_TAMANO, 413)
  const tipoPeticion = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!tipoPeticion.includes('multipart/form-data')) {
    return jsonError('Manda el audio como multipart/form-data en el campo "audio"', 400)
  }

  let formulario: FormData
  try {
    formulario = await request.formData()
  } catch {
    return jsonError('No se pudo leer el audio enviado', 400)
  }

  const audio = formulario.get('audio')
  if (!(audio instanceof Blob)) return jsonError('Falta el audio (campo "audio")', 400)
  const nombre = typeof (audio as File).name === 'string' ? (audio as File).name : ''
  if (!esAudioPermitido(audio.type, nombre)) return jsonError(MENSAJE_AUDIO_FORMATO, 400)
  if (audio.size === 0) return jsonError('El audio está vacío', 400)
  if (audio.size > AUDIO_MAX_BYTES) return jsonError(MENSAJE_AUDIO_TAMANO, 413)

  const duracionTexto = formulario.get('duracion_s')
  const meta = audioMetaSchema.safeParse({ duracion_s: typeof duracionTexto === 'string' ? duracionTexto : null })
  if (!meta.success) {
    const numero = Number(String(duracionTexto ?? '').replace(',', '.'))
    if (Number.isFinite(numero) && numero > AUDIO_MAX_SEGUNDOS) return jsonError(MENSAJE_AUDIO_DURACION, 413)
    return jsonError('Duración del audio no válida (segundos)', 400)
  }

  // La duración real, leída del archivo (en memoria; no se copia a disco). Manda sobre la declarada.
  const bytes = new Uint8Array(await audio.arrayBuffer())
  const leida = duracionAudioSegundos(bytes)
  if (leida !== null && leida > AUDIO_MAX_SEGUNDOS + AUDIO_MARGEN_SEGUNDOS) return jsonError(MENSAJE_AUDIO_DURACION, 413)
  if (leida === null && meta.data.duracion_s === null) return jsonError(MENSAJE_AUDIO_SIN_DURACION, 400)
  const duracion = leida !== null ? Math.min(AUDIO_MAX_SEGUNDOS, Math.round(leida)) : meta.data.duracion_s

  // Límite por persona: solo cuentan las llamadas que de verdad van a OpenAI.
  const limitado = limiteVoz('transcribir', auth.persona.id)
  if (limitado) return limitado

  // Vocabulario de VG: sus líneas y los subtipos vigentes. Es una ayuda: si la base falla, se transcribe sin ella.
  let prompt = vocabularioVG([], [])
  try {
    const [lineas, subtipos] = await Promise.all([lineasDeEjecutiva(auth.persona.id), subtiposVigentes(hoyBogota(ahora()))])
    prompt = vocabularioVG(lineas, subtipos)
  } catch {
    console.error('POST /api/me/voz/transcribir: no se pudo leer el vocabulario (líneas y subtipos); se transcribe sin él')
  }

  try {
    // Los mismos bytes (en memoria) con un nombre que lleve extensión; no se copian a disco.
    const archivo = new File([bytes], nombreDelAudio(audio.type, nombre), { type: audio.type || 'audio/m4a' })
    const { texto, modelo } = await transcribirAudio({ audio: archivo, prompt })
    const respuesta: TranscripcionResponse = { transcript: texto, duracion_s: duracion, modelo }
    return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Nunca el contenido: estado, tipo, parámetro, request_id y el mensaje de la API saneado (resumenErrorVoz).
    console.error(`POST /api/me/voz/transcribir: fallo al transcribir (${resumenErrorVoz(error, [nombre])})`)
    if (esErrorDeProveedor(error)) return jsonError(MENSAJE_FALLO_TRANSCRIPCION, 502)
    return jsonError('Error interno al transcribir el audio', 500)
  }
}
