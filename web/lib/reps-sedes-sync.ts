/**
 * Sedes del REPS → public.reps_sedes: mapeo de una fila (compartido) y carga automática mensual.
 *
 * - REPS_SEDES_COLUMNS, RepsSedeRow y mapRepsSedeRow salen TAL CUAL de scripts/reps-load-sedes.ts (Fase 3),
 *   que los sigue usando para cargar desde un CSV descargado (mismo comportamiento que antes).
 * - sincronizarRepsSedes (PR 7) es la carga del cron (GET /api/cron/reps_sedes) y de "Actualizar ahora":
 *   lee el mismo dataset de datos.gov.co (c36g-9fc2, cuyos nombres de campo son las columnas del CSV) por
 *   la API SoQL, filtrado a las clases que se cargan, en páginas de 5.000 ordenadas por código de
 *   habilitación, y hace upsert por codigo_habilitacion. Si el dataset no cambió (rowsUpdatedAt igual al
 *   de la última carga completa), no hace nada. Reanudable: el cursor guarda la página. Al terminar sin
 *   errores borra las sedes que ya no vienen (como --prune del script), solo si la carga trajo al menos el
 *   90 % de las sedes que había (protección ante una respuesta incompleta de la API).
 */
import type { SupabaseAdminClient } from './supabase-admin'
import { isLoadedRepsClass, normalizeName, parseRepsCutDate, REPS_CODE_RE } from './reps-match'
import type { CargaResultado } from './fuentes-runner'
import { BLOQUEO_MS, leerEstadoFuente } from './fuentes-estado'

export const REPS_SEDES_COLUMNS = [
  'codigoprestador', 'nombreprestador', 'codigohabilitacionsede', 'nombresede', 'tipoid',
  'numeroidentificacion', 'naturalezajuridica', 'ese', 'municipio_prestador', 'departamentoprestadordesc',
  'municipioprestadordesc', 'direccionprestador', 'email_prestador', 'telefonoprestador', 'municipiosede',
  'departamentodededesc', 'municipiosededesc', 'direcci_nsede', 'email_sede', 't_lefonosede',
  'claseprestador', 'fecha_corte_reps',
] as const

export type RepsSedeColumn = (typeof REPS_SEDES_COLUMNS)[number]

export interface RepsSedeRow {
  codigo_habilitacion: string
  codigo_prestador: string
  nombre_prestador: string
  nombre_sede: string
  tipo_id: string | null
  nit: string
  naturaleza: string | null
  ese: boolean
  municipio_prestador: string | null
  departamento_prestador: string | null
  municipio_prestador_nombre: string | null
  direccion_prestador: string | null
  email_prestador: string | null
  telefono_prestador: string | null
  municipio_sede: string
  departamento_sede: string | null
  municipio_sede_nombre: string | null
  direccion_sede: string | null
  email_sede: string | null
  telefono_sede: string | null
  clase_prestador: string
  fecha_corte: string | null
  imported_at: string
  nombre_busqueda: string
}

const text = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

export function mapRepsSedeRow(get: (column: RepsSedeColumn) => string, importedAt: string): { row?: RepsSedeRow; error?: string } {
  const codigo = get('codigohabilitacionsede').trim()
  const prestador = get('codigoprestador').trim()
  const municipio = get('municipiosede').trim()
  const nit = get('numeroidentificacion').trim()
  if (!REPS_CODE_RE.test(codigo)) return { error: `código de habilitación inválido "${codigo}"` }
  if (!/^\d{10}$/.test(prestador)) return { error: `código de prestador inválido "${prestador}" (${codigo})` }
  if (!/^\d{5}$/.test(municipio)) return { error: `municipio de sede inválido "${municipio}" (${codigo})` }
  if (!nit) return { error: `sin número de identificación (${codigo})` }
  return {
    row: {
      codigo_habilitacion: codigo,
      codigo_prestador: prestador,
      nombre_prestador: get('nombreprestador').trim(),
      nombre_sede: get('nombresede').trim() || get('nombreprestador').trim(),
      tipo_id: text(get('tipoid')),
      nit,
      naturaleza: text(get('naturalezajuridica')),
      ese: get('ese').trim().toUpperCase() === 'SI',
      municipio_prestador: text(get('municipio_prestador')),
      departamento_prestador: text(get('departamentoprestadordesc')),
      municipio_prestador_nombre: text(get('municipioprestadordesc')),
      direccion_prestador: text(get('direccionprestador')),
      email_prestador: text(get('email_prestador')),
      telefono_prestador: text(get('telefonoprestador')),
      municipio_sede: municipio,
      departamento_sede: text(get('departamentodededesc')),
      municipio_sede_nombre: text(get('municipiosededesc')),
      direccion_sede: text(get('direcci_nsede')),
      email_sede: text(get('email_sede')),
      telefono_sede: text(get('t_lefonosede')),
      clase_prestador: get('claseprestador').trim(),
      fecha_corte: parseRepsCutDate(get('fecha_corte_reps')),
      imported_at: importedAt,
      // Para el buscador de la ficha: sede + prestador sin tildes ni signos
      nombre_busqueda: normalizeName(`${get('nombresede')} ${get('nombreprestador')}`),
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Carga automática (cron / "Actualizar ahora")
// ---------------------------------------------------------------------------------------------

const BASE = 'https://www.datos.gov.co'
const DATASET = 'c36g-9fc2'
const USER_AGENT = 'OpMap-REPS/1.0 (sedes del REPS; datos abiertos de datos.gov.co)'
/** Clases que se cargan (mismas que isLoadedRepsClass): el filtro va en la consulta para no bajar 54.657 profesionales. */
const CLASES = [
  'Instituciones Prestadoras de Servicios de Salud - IPS',
  'Objeto Social Diferente a la Prestación de Servicios de Salud',
  'Transporte Especial de Pacientes',
]
const PAGINA = 5000
const MARGEN_MS = 15_000

interface RepsCursor {
  rows_updated_at: number | null
  en_curso: boolean
  pasada_rows_updated_at: number | null
  offset: number
  inicio: string | null
  escritas: number
  errores: number
}

function parseCursor(value: unknown): RepsCursor {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  return {
    rows_updated_at: num(v.rows_updated_at),
    en_curso: v.en_curso === true,
    pasada_rows_updated_at: num(v.pasada_rows_updated_at),
    offset: num(v.offset) ?? 0,
    inicio: typeof v.inicio === 'string' ? v.inicio : null,
    escritas: num(v.escritas) ?? 0,
    errores: num(v.errores) ?? 0,
  }
}

async function getJson<T>(url: string, timeoutMs: number): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`datos.gov.co HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export function buildRepsSedesUrl(offset: number, limit = PAGINA, base = BASE): string {
  const params = new URLSearchParams({
    $where: `claseprestador in (${CLASES.map(c => `'${c}'`).join(',')})`,
    $order: 'codigohabilitacionsede',
    $limit: String(limit),
    $offset: String(offset),
  })
  return `${base}/resource/${DATASET}.json?${params.toString()}`
}

export async function sincronizarRepsSedes(opts: { db: SupabaseAdminClient; deadline: number; log?: (m: string) => void }): Promise<CargaResultado> {
  const { db } = opts
  const log = opts.log ?? (() => {})
  const estado = await leerEstadoFuente(db, 'reps_sedes')
  let cursor = parseCursor(estado?.cursor)
  const restante = () => opts.deadline - Date.now()

  const meta = await getJson<{ rowsUpdatedAt?: number }>(`${BASE}/api/views/${DATASET}.json`, Math.min(30_000, restante()))
  const rowsUpdatedAt = meta.rowsUpdatedAt ?? null
  if (!rowsUpdatedAt) throw new Error('La metadata del REPS (c36g-9fc2) no trae rowsUpdatedAt')
  const fechaDataset = new Date(rowsUpdatedAt * 1000).toISOString().slice(0, 10)

  if (!cursor.en_curso) {
    let yaCargado = cursor.rows_updated_at === rowsUpdatedAt
    if (!yaCargado && cursor.rows_updated_at === null) {
      // Primera vez: la carga manual (Fase 3) no dejó cursor. Si la base ya está tan al día como el dataset, no se repite.
      const { data: ultima, error } = await db.from('reps_sedes').select('imported_at').order('imported_at', { ascending: false }).limit(1)
      if (error) throw new Error(`reps_sedes: ${error.message}`)
      const importedAt = (ultima?.[0] as { imported_at?: string } | undefined)?.imported_at
      yaCargado = Boolean(importedAt && Date.parse(importedAt) >= rowsUpdatedAt * 1000)
    }
    if (yaCargado) {
      return { terminado: true, filas: null, mensaje: `Sin cambios: el REPS de datos.gov.co no se ha actualizado desde el ${fechaDataset}.`, cursor: { ...cursor, rows_updated_at: rowsUpdatedAt } as unknown as Record<string, unknown> }
    }
    cursor = { ...cursor, en_curso: true, pasada_rows_updated_at: rowsUpdatedAt, offset: 0, inicio: new Date().toISOString(), escritas: 0, errores: 0 }
  }
  const importedAt = cursor.inicio ?? new Date().toISOString()

  while (restante() > MARGEN_MS) {
    const page = await getJson<Record<string, string>[]>(buildRepsSedesUrl(cursor.offset), Math.min(60_000, restante() - 5000))
    const filas: RepsSedeRow[] = []
    for (const raw of page) {
      const clase = String(raw.claseprestador ?? '').trim()
      if (!isLoadedRepsClass(clase)) continue
      const mapped = mapRepsSedeRow(column => (raw[column] === undefined || raw[column] === null ? '' : String(raw[column])), importedAt)
      if (mapped.error || !mapped.row) cursor.errores++
      else filas.push(mapped.row)
    }
    const unicas = Array.from(new Map(filas.map(f => [f.codigo_habilitacion, f])).values())
    for (let i = 0; i < unicas.length; i += 1000) {
      const { error } = await db.from('reps_sedes').upsert(unicas.slice(i, i + 1000), { onConflict: 'codigo_habilitacion' })
      if (error) throw new Error(`reps_sedes (upsert): ${error.message}`)
    }
    cursor.escritas += unicas.length
    cursor.offset += page.length
    log(`reps_sedes: página con ${page.length} filas → ${unicas.length} sedes (offset ${cursor.offset})`)
    const terminado = page.length < PAGINA
    if (terminado) {
      cursor.en_curso = false
      break
    }
    const { error } = await db
      .from('fuentes_estado')
      .update({ cursor, estado: 'corriendo', mensaje: `REPS: ${cursor.escritas.toLocaleString('es-CO')} sedes cargadas; sigue en la próxima ejecución.`, bloqueo_hasta: new Date(Date.now() + BLOQUEO_MS).toISOString() })
      .eq('fuente', 'reps_sedes')
    if (error) throw new Error(`fuentes_estado (reps_sedes): ${error.message}`)
  }

  if (cursor.en_curso) {
    return { terminado: false, filas: cursor.escritas, mensaje: `REPS: ${cursor.escritas.toLocaleString('es-CO')} sedes cargadas del corte del ${fechaDataset}; sigue en la próxima ejecución.`, cursor: cursor as unknown as Record<string, unknown> }
  }

  // Poda (como --prune): solo si la carga trajo al menos el 90 % de las sedes que había y sin filas inválidas.
  const { count: total, error: countError } = await db.from('reps_sedes').select('codigo_habilitacion', { count: 'exact', head: true })
  if (countError) throw new Error(`reps_sedes: ${countError.message}`)
  const { count: viejas, error: staleError } = await db.from('reps_sedes').select('codigo_habilitacion', { count: 'exact', head: true }).lt('imported_at', importedAt)
  if (staleError) throw new Error(`reps_sedes: ${staleError.message}`)
  let podadas = 0
  let nota = ''
  if ((viejas ?? 0) > 0) {
    if (cursor.errores === 0 && cursor.escritas >= 0.9 * (total ?? 0)) {
      const { error } = await db.from('reps_sedes').delete().lt('imported_at', importedAt)
      if (error) throw new Error(`reps_sedes (poda): ${error.message}`)
      podadas = viejas ?? 0
    } else {
      nota = ` No se borraron ${viejas} sedes que ya no vienen (filas inválidas o carga incompleta): revisar con scripts/reps-load-sedes.ts.`
    }
  }
  const fin = { ...cursor, rows_updated_at: cursor.pasada_rows_updated_at, en_curso: false }
  return {
    terminado: true,
    filas: cursor.escritas,
    mensaje: `REPS del ${fechaDataset}: ${cursor.escritas.toLocaleString('es-CO')} sedes (upsert), ${podadas} borradas por no venir ya, ${cursor.errores} filas inválidas.${nota} Después conviene correr scripts/reps-match.ts.`,
    cursor: fin as unknown as Record<string, unknown>,
  }
}
