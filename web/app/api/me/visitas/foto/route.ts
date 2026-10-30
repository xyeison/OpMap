// /api/me/visitas/foto (visits:report + persona de campo; 0940, app sin señal: la foto sube APARTE, después de la visita).
//   POST multipart { client_id, foto } — JPEG ≤ 2 MB (la app lo comprime a 1600 px, 70 %). Sube al bucket privado
//        visitas-fotos en <user_id>/<client_id>.jpg (upsert: la segunda vez reemplaza) y enlaza la visita con la RPC
//        visitas_foto (la única escritura de foto_path). Responde 200 { client_id, visita_id, foto: true, repetida }.
//        400 sin foto, PNG o más de 2 MB · 404 visita que no existe, ajena o anulada · 503 sin la 0940.
//   GET ?client_id= — enlace firmado (10 minutos) para ver la foto de una visita propia: { url, expira_en }. 404 sin foto.
// Idempotente por client_id: la cola de fotos del teléfono reintenta sin miedo (igual que la visita).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { FOTO_BUCKET, FOTO_ENLACE_SEGUNDOS, FOTO_MAX_BYTES, MENSAJE_FOTO_FORMATO, MENSAJE_FOTO_VISITA, esJpeg, revisarFoto, rutaFoto } from '@/lib/reporte-visitas'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePersonaDeCampo } from '../../../config-visitas/_lib/visitas-server'
import { MENSAJE_FALTA_MIGRACION_0940, errorReporte, faltaMigracion0940, visitaPorClientId } from '../../_lib/reporte-server'
import { medirRuta } from '../../_lib/tiempos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Margen del multipart (cabeceras y el campo client_id) sobre el tope del archivo. */
const MARGEN_MULTIPART = 64 * 1024

export async function POST(request: NextRequest) {
  return medirRuta('POST /api/me/visitas/foto', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'POST /api/me/visitas/foto'))
    if (!auth.ok) return auth.response
    const { user } = auth

    const declarado = Number(request.headers.get('content-length') ?? '0')
    if (declarado > FOTO_MAX_BYTES + MARGEN_MULTIPART) return jsonError(`La foto no puede superar ${FOTO_MAX_BYTES / (1024 * 1024)} MB`, 413)

    let formulario: FormData
    try {
      formulario = await t.fase('leer', () => request.formData())
    } catch {
      return jsonError('Manda la foto como multipart/form-data (campos client_id y foto)', 400)
    }
    const clientId = String(formulario.get('client_id') ?? '')
      .trim()
      .toLowerCase()
    if (!UUID_RE.test(clientId)) return jsonError('client_id no válido (uuid de la visita)', 400)
    const foto = formulario.get('foto')
    const archivo = foto instanceof Blob ? foto : null
    const problema = revisarFoto(archivo ? { type: archivo.type, size: archivo.size } : null)
    if (problema) return jsonError(problema, 400)

    try {
      const visita = await t.fase('visita', () => visitaPorClientId(clientId))
      if (!visita || visita.user_id !== user.id || visita.deleted_at !== null) return jsonError(MENSAJE_FOTO_VISITA, 404)

      const ruta = rutaFoto(user.id, clientId)
      const bytes = Buffer.from(await (archivo as Blob).arrayBuffer())
      if (!esJpeg(bytes)) return jsonError(MENSAJE_FOTO_FORMATO, 400)
      const subida = await t.fase('storage', () => supabaseAdmin.storage.from(FOTO_BUCKET).upload(ruta, bytes, { contentType: 'image/jpeg', upsert: true }))
      if (subida.error) {
        if (/bucket not found/i.test(subida.error.message)) return jsonError(MENSAJE_FALTA_MIGRACION_0940, 503)
        throw new Error(`storage: ${subida.error.message}`)
      }
      const { data, error } = await t.fase('rpc', () => supabaseAdmin.rpc('visitas_foto', { p_client: clientId, p_user: user.id, p_path: ruta }))
      if (error) {
        if (faltaMigracion0940(error) || /visitas_foto/.test(error.message ?? '')) return jsonError(MENSAJE_FALTA_MIGRACION_0940, 503)
        if (error.code === 'P0002') return jsonError(MENSAJE_FOTO_VISITA, 404)
        throw error
      }
      const registro = (data ?? {}) as { visita_id?: string; repetida?: boolean }
      return NextResponse.json({ client_id: clientId, visita_id: registro.visita_id ?? visita.id, foto: true, repetida: Boolean(registro.repetida) })
    } catch (error) {
      return errorReporte('POST /api/me/visitas/foto', error, 'Error al guardar la foto')
    }
  })
}

export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/visitas/foto', async t => {
    const auth = await t.fase('auth', () => requirePersonaDeCampo(request, 'GET /api/me/visitas/foto'))
    if (!auth.ok) return auth.response
    const clientId = (request.nextUrl.searchParams.get('client_id') ?? '').trim().toLowerCase()
    if (!UUID_RE.test(clientId)) return jsonError('client_id no válido (uuid de la visita)', 400)
    try {
      const visita = await t.fase('visita', () => visitaPorClientId(clientId))
      if (!visita || visita.user_id !== auth.user.id) return jsonError(MENSAJE_FOTO_VISITA, 404)
      if (!visita.foto_path) return jsonError('Esta visita no tiene foto', 404)
      const { data, error } = await t.fase('storage', () => supabaseAdmin.storage.from(FOTO_BUCKET).createSignedUrl(visita.foto_path as string, FOTO_ENLACE_SEGUNDOS))
      if (error || !data?.signedUrl) throw new Error(`storage: ${error?.message ?? 'sin enlace'}`)
      return NextResponse.json({ url: data.signedUrl, expira_en: FOTO_ENLACE_SEGUNDOS }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      return errorReporte('GET /api/me/visitas/foto', error, 'Error al leer la foto')
    }
  })
}
