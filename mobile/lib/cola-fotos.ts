/**
 * Cola de FOTOS de la app sin señal (dueño, 2026-10-30: "las fotos suben aparte, después del reporte, con sus propios
 * reintentos"). PURA: el almacén de los registros y de los bytes se inyecta (IndexedDB en el navegador con el Blob; en
 * el teléfono, el archivo JPEG en el directorio de documentos y el índice en AsyncStorage) y también la subida
 * (POST /api/me/visitas/foto, multipart { client_id, foto }).
 *
 * Reglas:
 * - Una foto por visita, por client_id. Se guarda ANTES de intentar subirla (nunca solo en memoria).
 * - Solo sube la foto de una visita que ya está ENVIADA (el servidor la enlaza por client_id; antes respondería 404).
 * - Estados: pendiente, enviando, enviada, no_enviada (rechazo de datos: formato o tamaño). Reintentable: sin red,
 *   tiempo agotado, 5xx, 404 (la visita aún no llegó o la ruta no está publicada), 429, con la misma espera creciente
 *   de la cola de visitas (esperaReintento).
 * - La subida es idempotente (el servidor reemplaza la foto de ese client_id): reintentar no duplica.
 * - Enviada → los bytes se borran del teléfono (quedan en el servidor); el registro se conserva ese día para la lista.
 */
import type { EstadoFoto, RegistroFoto } from './almacen-idb'
import { esReintentable, esperaReintento } from './cola'
import { aApiError } from './errores'
import { fechaBogota, hoyBogota } from './fechas'

export type { EstadoFoto, RegistroFoto }

export const ETIQUETA_ESTADO_FOTO: Record<EstadoFoto, string> = {
  pendiente: 'Foto pendiente',
  enviando: 'Subiendo foto…',
  enviada: 'Foto enviada',
  no_enviada: 'Foto con error',
}

/** Lo que la cola necesita del almacén de fotos. `datos`: el Blob (web) o la URI del archivo (teléfono). */
export interface AlmacenFotos {
  listar(usuarioId: string): Promise<RegistroFoto[]>
  guardar(registro: RegistroFoto): Promise<void>
  /** Los bytes de una foto (null si ya se borraron). */
  datos(registro: RegistroFoto): Promise<Blob | string | null>
  /** Borra los bytes (no el registro). */
  borrarDatos(registro: RegistroFoto): Promise<void>
  quitar(clientId: string): Promise<void>
}

export type SubirFoto = (clientId: string, datos: Blob | string) => Promise<{ repetida: boolean }>

export interface ResultadoFotos {
  fotos: RegistroFoto[]
  enviadas: string[]
  no_enviadas: string[]
  detenida: 'red' | 'sesion' | null
}

/** Un registro nuevo (pendiente). `bytes`: tamaño del JPEG comprimido. */
export function nuevoRegistroFoto(entrada: { client_id: string; usuario_id: string; blob?: Blob | null; uri?: string | null; bytes: number }, ahora: Date): RegistroFoto {
  return {
    client_id: entrada.client_id,
    usuario_id: entrada.usuario_id,
    blob: entrada.blob ?? null,
    uri: entrada.uri ?? null,
    bytes: entrada.bytes,
    creado_at: ahora.toISOString(),
    estado: 'pendiente',
    intentos: 0,
    ultimo_intento_at: null,
    proximo_intento_at: null,
    error: null,
    enviada_at: null,
  }
}

/** Las fotos que se intentan ahora: pendientes de visitas ya enviadas, cuya espera pasó (o todas, con `forzar`). */
export function fotosPorEnviar(fotos: readonly RegistroFoto[], visitasEnviadas: ReadonlySet<string>, ahora: Date, opciones: { forzar?: boolean } = {}): RegistroFoto[] {
  const ahoraMs = ahora.getTime()
  return fotos
    .filter(f => (f.estado === 'pendiente' || f.estado === 'enviando') && visitasEnviadas.has(f.client_id))
    .filter(f => opciones.forzar || !f.proximo_intento_at || Date.parse(f.proximo_intento_at) <= ahoraMs)
    .sort((a, b) => a.creado_at.localeCompare(b.creado_at))
}

export function resumenFotos(fotos: readonly RegistroFoto[], ahora: Date): { pendientes: number; enviadas_hoy: number; no_enviadas: number } {
  const hoy = hoyBogota(ahora)
  return {
    pendientes: fotos.filter(f => f.estado === 'pendiente' || f.estado === 'enviando').length,
    enviadas_hoy: fotos.filter(f => f.estado === 'enviada' && f.enviada_at && fechaBogota(f.enviada_at) === hoy).length,
    no_enviadas: fotos.filter(f => f.estado === 'no_enviada').length,
  }
}

/** Limpieza: registros enviados de días anteriores y no enviados de más de 7 días. Pendientes, nunca. */
export function podarFotos(fotos: readonly RegistroFoto[], ahora: Date): { quedan: RegistroFoto[]; fuera: RegistroFoto[] } {
  const hoy = hoyBogota(ahora)
  const limiteMs = ahora.getTime() - 7 * 24 * 60 * 60 * 1000
  const quedan: RegistroFoto[] = []
  const fuera: RegistroFoto[] = []
  for (const f of fotos) {
    const fueraDeDia = f.estado === 'enviada' ? !(f.enviada_at && fechaBogota(f.enviada_at) === hoy) : f.estado === 'no_enviada' ? Date.parse(f.creado_at) < limiteMs : false
    ;(fueraDeDia ? fuera : quedan).push(f)
  }
  return { quedan, fuera }
}

/**
 * Sube las fotos que tocan, una por una. `guardar` persiste cada cambio de estado (enviando, enviada, fallo). Se
 * detiene al primer error reintentable o con 401, como la cola de visitas.
 */
export async function procesarFotos(entrada: {
  fotos: readonly RegistroFoto[]
  visitasEnviadas: ReadonlySet<string>
  subir: SubirFoto
  datos: (registro: RegistroFoto) => Promise<Blob | string | null>
  guardar: (registro: RegistroFoto) => Promise<void>
  borrarDatos: (registro: RegistroFoto) => Promise<void>
  reloj?: () => Date
  forzar?: boolean
}): Promise<ResultadoFotos> {
  const reloj = entrada.reloj ?? (() => new Date())
  const fotos = entrada.fotos.map(f => (f.estado === 'enviando' ? { ...f, estado: 'pendiente' as const } : f))
  const enviadas: string[] = []
  const no_enviadas: string[] = []
  const actualizar = async (nuevo: RegistroFoto) => {
    const i = fotos.findIndex(f => f.client_id === nuevo.client_id)
    if (i >= 0) fotos[i] = nuevo
    await entrada.guardar(nuevo).catch(() => undefined)
  }
  for (const foto of fotosPorEnviar(fotos, entrada.visitasEnviadas, reloj(), { forzar: entrada.forzar })) {
    const bytes = await entrada.datos(foto).catch(() => null)
    if (!bytes) {
      // Los bytes ya no están (el navegador los borró): no se puede subir; queda con error visible.
      await actualizar({ ...foto, estado: 'no_enviada', error: 'La foto ya no está en el teléfono', ultimo_intento_at: reloj().toISOString() })
      no_enviadas.push(foto.client_id)
      continue
    }
    await actualizar({ ...foto, estado: 'enviando' })
    try {
      await entrada.subir(foto.client_id, bytes)
      const ahora = reloj()
      await actualizar({ ...foto, estado: 'enviada', enviada_at: ahora.toISOString(), ultimo_intento_at: ahora.toISOString(), proximo_intento_at: null, intentos: foto.intentos + 1, error: null, blob: null, uri: null })
      await entrada.borrarDatos(foto).catch(() => undefined)
      enviadas.push(foto.client_id)
    } catch (lanzado) {
      const error = aApiError(lanzado)
      const reintentable = esReintentable(error) || error.status === 401
      const intentos = foto.intentos + 1
      const ahora = reloj()
      await actualizar({
        ...foto,
        estado: reintentable ? 'pendiente' : 'no_enviada',
        intentos,
        ultimo_intento_at: ahora.toISOString(),
        proximo_intento_at: reintentable && error.status !== 401 ? new Date(ahora.getTime() + esperaReintento(intentos)).toISOString() : null,
        error: error.message,
      })
      if (error.status === 401) return { fotos, enviadas, no_enviadas, detenida: 'sesion' }
      if (esReintentable(error)) return { fotos, enviadas, no_enviadas, detenida: 'red' }
      no_enviadas.push(foto.client_id)
    }
  }
  return { fotos, enviadas, no_enviadas, detenida: null }
}
