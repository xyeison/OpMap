// Fase 5 · Lecturas de Supabase para la API de compras públicas (solo servidor; "_lib" no es ruta).
// Esquema de database/migrations/2026-10-11_0710_secop.sql: secop_contratos (se lee SIEMPRE por la vista
// secop_contratos_unicos, que quita del Integrado los contratos que ya vienen de SECOP II),
// secop_proveedores_vigilados y fuentes_estado. Todo con service_role (lib/supabase-admin.ts). Este archivo
// es el ÚNICO que conoce los nombres de columnas: lib/compras-publicas.ts trabaja con hechos normalizados.
import { fetchAllRows } from '@/app/api/_lib/api-error'
import { supabaseAdmin, type SupabaseAdminClient } from '@/lib/supabase-admin'
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import {
  SIN_CLASIFICAR,
  dvNit,
  normalizeLinea,
  proveedorKey,
  repartirProcesosSecopI,
  type SecopActualizado,
  type SecopContrato,
  type SecopFact,
} from '@/lib/compras-publicas'

export { isMissingRelationError }

export const SECOP_MISSING_MESSAGE =
  'Faltan las tablas de SECOP (secop_contratos, secop_proveedores_vigilados, fuentes_estado): aplicar database/migrations/2026-10-11_0710_secop.sql'

/** Vista sin doble conteo (Integrado ∖ SECOP II). */
const CONTRATOS_VIEW = 'secop_contratos_unicos'

/** Columnas que usa la ficha (una entidad: pocas filas, con objeto y URL). */
const CONTRATO_COLUMNS =
  'id, fuente, origen, numero_contrato, nit_entidad, nombre_entidad, documento_proveedor, proveedor_hash, proveedor_nombre, es_persona, especialidad_medico, linea, objeto, descripcion, valor, fecha_firma, estado, modalidad, url, atipico'

/** Columnas mínimas para agregar (ranking, proveedor y lista vigilada). */
const HECHO_COLUMNS =
  'id, nit_entidad, nombre_entidad, documento_proveedor, proveedor_hash, proveedor_nombre, es_persona, especialidad_medico, linea, valor, fecha_firma, atipico'

type Row = Record<string, unknown>

const str = (value: unknown): string | null => (value === null || value === undefined || value === '' ? null : String(value))
const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}
const nit9 = (value: unknown): string | null => {
  const digits = str(value)?.replace(/\D/g, '') ?? ''
  if (digits.length === 9) return digits
  if (digits.length === 10) return digits.slice(0, 9)
  return null
}

function toFact(row: Row): SecopFact {
  const esPersona = Boolean(row.es_persona)
  // Empresas: documento_proveedor a 9 dígitos (la carga ya lo normaliza). Personas: sin documento (hash).
  const proveedorNit = esPersona ? null : nit9(row.documento_proveedor)
  const nombre = str(row.proveedor_nombre)
  const linea = normalizeLinea(str(row.linea))
  const especialidad = str(row.especialidad_medico)
  return {
    nit_entidad: nit9(row.nit_entidad) ?? String(row.nit_entidad ?? ''),
    nombre_entidad: str(row.nombre_entidad),
    proveedor_key: proveedorKey({ nit: proveedorNit, personaHash: str(row.proveedor_hash), nombre, esPersona }),
    proveedor_nit: proveedorNit,
    proveedor_nombre: nombre,
    es_persona: esPersona,
    // Servicio de especialistas (persona o empresa): tiene especialidad y ninguna línea de producto.
    es_servicio: especialidad !== null && (linea === null || linea === SIN_CLASIFICAR),
    atipico: row.atipico === true,
    especialidad,
    linea,
    fecha: str(row.fecha_firma)?.slice(0, 10) ?? null,
    valor: num(row.valor),
    contratos: 1,
  }
}

const ORIGEN_LABEL: Record<string, string> = { SECOPI: 'SECOP I', SECOPII: 'SECOP II' }

function toContrato(row: Row): SecopContrato {
  return {
    ...toFact(row),
    id: String(row.id),
    fuente: ORIGEN_LABEL[String(row.origen)] ?? str(row.fuente),
    objeto: str(row.objeto) ?? str(row.descripcion),
    estado: str(row.estado),
    modalidad: str(row.modalidad),
    url: str(row.url),
    origen: str(row.origen),
    numero_contrato: str(row.numero_contrato),
  }
}

function dbError(label: string, error: unknown): Error {
  const message = (error as { message?: string } | null)?.message ?? String(error)
  return Object.assign(new Error(`Error leyendo ${label}: ${message}`), { dbError: error })
}

/**
 * Todos los contratos (material y médicos) de una entidad por NIT de 9 dígitos, con el valor de los procesos
 * de SECOP I repetidos por contratista ya repartido (repartirProcesosSecopI, igual que secop_hechos()).
 */
export async function loadContratosEntidad(nit: string, db: SupabaseAdminClient = supabaseAdmin): Promise<SecopContrato[]> {
  const { data, error } = await fetchAllRows<Row>((from, to) =>
    db.from(CONTRATOS_VIEW).select(CONTRATO_COLUMNS).eq('nit_entidad', nit).order('id').range(from, to)
  )
  if (error) throw dbError(CONTRATOS_VIEW, error)
  return repartirProcesosSecopI(data.map(toContrato))
}

/** Hecho agregado de secop_hechos() (migración 0720): claves cortas para que el jsonb pese poco. */
interface HechoRpc {
  e: string
  en: string | null
  d: string | null
  h: string | null
  pn: string | null
  p: boolean
  es: string | null
  l: string | null
  a: boolean
  /** Fuera de escala: cada contrato del grupo vale más de 50.000 M (0720 agrupa por esto). */
  x?: boolean
  f: string | null
  v: number | string | null
  n: number
}

function hechoRpcToFact(row: HechoRpc): SecopFact {
  const fact = toFact({
    nit_entidad: row.e,
    nombre_entidad: row.en,
    documento_proveedor: row.d,
    proveedor_hash: row.h,
    proveedor_nombre: row.pn,
    es_persona: row.p,
    especialidad_medico: row.es,
    linea: row.l,
    atipico: row.a,
    fecha_firma: row.f,
    valor: row.v,
  })
  return { ...fact, contratos: Number(row.n) || 1, fuera_escala: row.x === undefined ? undefined : row.x === true }
}

/**
 * Hechos de contratación para agregar: contratos firmados entre desde y hasta (YYYY-MM-DD, inclusive; null =
 * sin límite). nits = solo esas entidades (ámbito IPS); proveedorNits = solo esos proveedores (empresas).
 * Usa secop_hechos() (0720: agregado en la base, un solo jsonb); sin la función, lee contrato por contrato
 * desde la vista (listas largas en trozos de 150 por el largo de URL de PostgREST).
 */
export async function loadHechos(
  params: { desde: string | null; hasta: string | null; nits?: string[] | null; proveedorNits?: string[] | null },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<SecopFact[]> {
  if (params.nits && params.nits.length === 0) return []
  if (params.proveedorNits && params.proveedorNits.length === 0) return []

  const { data: rpcData, error: rpcError } = await db.rpc('secop_hechos', {
    p_desde: params.desde,
    p_hasta: params.hasta,
    p_nits: params.nits ?? null,
    p_proveedores: params.proveedorNits ?? null,
  })
  if (!rpcError) return (Array.isArray(rpcData) ? (rpcData as HechoRpc[]) : []).map(hechoRpcToFact)
  if (!isMissingRelationError(rpcError)) throw dbError('secop_hechos', rpcError)

  const split = (list: string[] | null | undefined): Array<string[] | null> => {
    if (!list) return [null]
    const chunks: string[][] = []
    for (let i = 0; i < list.length; i += 150) chunks.push(list.slice(i, i + 150))
    return chunks
  }
  const out: SecopFact[] = []
  for (const entidades of split(params.nits)) {
    for (const proveedores of split(params.proveedorNits)) {
      const { data, error } = await fetchAllRows<Row>((from, to) => {
        let query = db.from(CONTRATOS_VIEW).select(HECHO_COLUMNS)
        if (entidades) query = query.in('nit_entidad', entidades)
        if (proveedores) query = query.in('documento_proveedor', proveedores)
        if (params.desde) query = query.gte('fecha_firma', params.desde)
        if (params.hasta) query = query.lte('fecha_firma', params.hasta)
        return query.order('id').range(from, to)
      })
      if (error) throw dbError(CONTRATOS_VIEW, error)
      for (const row of data) out.push(toFact(row))
    }
  }
  return out
}

export interface VigiladoRow {
  nit: string
  dv: string | null
  nombre: string | null
  ciudad: string | null
  origen: string | null
  compras_gcp_cop: number | null
  activo: boolean
  nota: string | null
  updated_at: string | null
}

const VIGILADO_COLUMNS = 'nit, dv, nombre, ciudad, origen, compras_gcp_cop, activo, nota, updated_at'

function toVigilado(row: Row): VigiladoRow {
  return {
    nit: String(row.nit),
    dv: str(row.dv),
    nombre: str(row.nombre),
    ciudad: str(row.ciudad),
    origen: str(row.origen),
    compras_gcp_cop: row.compras_gcp_cop === null || row.compras_gcp_cop === undefined ? null : num(row.compras_gcp_cop),
    activo: row.activo !== false,
    nota: str(row.nota),
    updated_at: str(row.updated_at),
  }
}

export async function loadVigilados(db: SupabaseAdminClient = supabaseAdmin): Promise<VigiladoRow[]> {
  const { data, error } = await fetchAllRows<Row>((from, to) =>
    db.from('secop_proveedores_vigilados').select(VIGILADO_COLUMNS).order('nit').range(from, to)
  )
  if (error) throw dbError('secop_proveedores_vigilados', error)
  return data.map(toVigilado)
}

/** NIT (9 dígitos) de los proveedores vigilados activos. */
export async function loadVigiladosActivos(db: SupabaseAdminClient = supabaseAdmin): Promise<Set<string>> {
  const rows = await loadVigilados(db)
  return new Set(rows.filter(row => row.activo).map(row => row.nit))
}

/** Upsert de un NIT vigilado (alta manual, reactivación o baja lógica). */
export async function upsertVigilado(
  input: { nit: string; nombre: string | null; activo: boolean; nota: string | null; userId: string },
  db: SupabaseAdminClient = supabaseAdmin
): Promise<VigiladoRow> {
  const { data: existing, error: readError } = await db.from('secop_proveedores_vigilados').select(VIGILADO_COLUMNS).eq('nit', input.nit).limit(1)
  if (readError) throw dbError('secop_proveedores_vigilados', readError)
  const current = (existing?.[0] as Row | undefined) ?? null
  const now = new Date().toISOString()
  const payload: Row = { nit: input.nit, activo: input.activo, updated_at: now }
  if (input.nombre !== null) payload.nombre = input.nombre
  if (input.nota !== null) payload.nota = input.nota
  if (!current) {
    payload.origen = 'manual'
    payload.dv = String(dvNit(input.nit))
  }
  const { data, error } = current
    ? await db.from('secop_proveedores_vigilados').update(payload).eq('nit', input.nit).select(VIGILADO_COLUMNS).limit(1)
    : await db.from('secop_proveedores_vigilados').insert(payload).select(VIGILADO_COLUMNS).limit(1)
  if (error) throw dbError('secop_proveedores_vigilados', error)
  return toVigilado((data?.[0] as Row | undefined) ?? payload)
}

export interface FuenteEstadoRow {
  fuente: string
  nombre: string | null
  programacion: string | null
  ejecutor: string | null
  ultimo_ok: string | null
  ultimo_intento: string | null
  estado: string | null
  filas: number | null
  mensaje: string | null
  siguiente_programado: string | null
}

export async function loadFuentesEstado(db: SupabaseAdminClient = supabaseAdmin): Promise<FuenteEstadoRow[]> {
  const { data, error } = await db
    .from('fuentes_estado')
    .select('fuente, nombre, programacion, ejecutor, ultimo_ok, ultimo_intento, estado, filas, mensaje, siguiente_programado')
    .order('fuente')
    .range(0, 999)
  if (error) throw dbError('fuentes_estado', error)
  return ((data || []) as Row[]).map(row => ({
    fuente: String(row.fuente),
    nombre: str(row.nombre),
    programacion: str(row.programacion),
    ejecutor: str(row.ejecutor),
    ultimo_ok: str(row.ultimo_ok),
    ultimo_intento: str(row.ultimo_intento),
    estado: str(row.estado),
    filas: row.filas === null || row.filas === undefined ? null : num(row.filas),
    mensaje: str(row.mensaje),
    siguiente_programado: str(row.siguiente_programado),
  }))
}

/** Último OK de las fuentes SECOP (para "actualizado el…"). Sin la tabla devuelve {}. */
export async function loadSecopActualizado(db: SupabaseAdminClient = supabaseAdmin): Promise<SecopActualizado> {
  try {
    const rows = await loadFuentesEstado(db)
    const out: SecopActualizado = {}
    for (const row of rows) if (row.fuente.toLowerCase().includes('secop')) out[row.fuente] = row.ultimo_ok
    return out
  } catch (error) {
    if (isMissingRelationError(error)) return {}
    throw error
  }
}

/**
 * Naturaleza del prestador en el REPS (reps_sedes.naturaleza) para un NIT de 9 dígitos: 'Pública' si
 * alguna sede es pública, si no 'Mixta', si no 'Privada'; null si el NIT no está en el REPS cargado.
 */
export async function naturalezaDeNit(nit: string, db: SupabaseAdminClient = supabaseAdmin): Promise<string | null> {
  const { data, error } = await db.from('reps_sedes').select('naturaleza').eq('nit', nit).range(0, 499)
  if (error) {
    if (isMissingRelationError(error)) return null
    throw dbError('reps_sedes', error)
  }
  const values = new Set(((data || []) as Row[]).map(row => (str(row.naturaleza) || '').trim()))
  if (values.size === 0) return null
  const has = (word: string) => Array.from(values).some(v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === word)
  if (has('publica')) return 'Pública'
  if (has('mixta')) return 'Mixta'
  return 'Privada'
}
