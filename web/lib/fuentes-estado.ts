/**
 * PR 7 · Estado de las fuentes de datos automáticas (tabla fuentes_estado, migración 0710).
 *
 * Una fila por fuente: último OK, último intento, estado (ok | error | corriendo), filas, mensaje, cursor
 * (avance de una pasada que no cupo en una invocación) y la próxima ejecución programada. La escriben el
 * cron de Vercel (GET /api/cron/<fuente>), el botón "Actualizar ahora" del panel (mismo código) y el job
 * de GitHub Actions de la ADRES (scripts/fuente-estado.ts). Solo service_role.
 *
 * Bloqueo: bloqueo_hasta evita que el cron y un clic corran la misma fuente a la vez (se toma con un
 * UPDATE condicional; caduca solo a los BLOQUEO_MS por si la función muere por tiempo).
 *
 * Las funciones de cron (parseCronExpression / nextCronRun) son puras y se prueban en secop-check.ts.
 */
import type { SupabaseAdminClient } from './supabase-admin'

export type FuenteId = 'secop_ii' | 'secop_integrado' | 'reps_sedes' | 'bdua' | 'minsalud_cifras' | 'adres_identifica'
export type FuenteAutomatica = Exclude<FuenteId, 'adres_identifica'>

export interface FuenteDefinicion {
  id: FuenteId
  nombre: string
  /** Expresión cron (UTC) — la misma que en web/vercel.json o .github/workflows/datos.yml. */
  programacion: string
  ejecutor: 'vercel_cron' | 'github_actions'
}

export const FUENTES: readonly FuenteDefinicion[] = [
  { id: 'secop_ii', nombre: 'SECOP II · Contratos', programacion: '0 6 * * *', ejecutor: 'vercel_cron' },
  { id: 'secop_integrado', nombre: 'SECOP Integrado (I + II)', programacion: '0 7 * * 1', ejecutor: 'vercel_cron' },
  { id: 'reps_sedes', nombre: 'REPS · Sedes', programacion: '0 8 2 * *', ejecutor: 'vercel_cron' },
  { id: 'bdua', nombre: 'BDUA · Afiliados por municipio', programacion: '0 8 4 * *', ejecutor: 'vercel_cron' },
  { id: 'minsalud_cifras', nombre: 'MinSalud · Cifras de aseguramiento', programacion: '0 8 5 * *', ejecutor: 'vercel_cron' },
  { id: 'adres_identifica', nombre: 'ADRES · Identifica tu Giro', programacion: '0 7 3 * *', ejecutor: 'github_actions' },
] as const

export const FUENTES_AUTOMATICAS: readonly FuenteAutomatica[] = ['secop_ii', 'secop_integrado', 'reps_sedes', 'bdua', 'minsalud_cifras'] as const

export function esFuenteAutomatica(value: string): value is FuenteAutomatica {
  return (FUENTES_AUTOMATICAS as readonly string[]).includes(value)
}

export function definicionFuente(id: FuenteId): FuenteDefinicion {
  return FUENTES.find(f => f.id === id) as FuenteDefinicion
}

/** Margen del bloqueo: Vercel corta la función a los 60 s. */
export const BLOQUEO_MS = 75_000
/** Bloqueo de una carga sin límite de tiempo (script): una página del Integrado puede tardar 2 minutos. */
export const BLOQUEO_SCRIPT_MS = 30 * 60_000

// ---------------------------------------------------------------------------------------------
// Cron (solo las formas que usamos: números o '*' en cada uno de los 5 campos)
// ---------------------------------------------------------------------------------------------

export interface CronExpr {
  minuto: number
  hora: number
  diaMes: number | null
  mes: number | null
  diaSemana: number | null
}

export function parseCronExpression(expr: string): CronExpr | null {
  const parts = String(expr ?? '').trim().split(/\s+/)
  if (parts.length !== 5) return null
  const field = (raw: string, min: number, max: number, allowStar: boolean): number | null | undefined => {
    if (raw === '*') return allowStar ? null : undefined
    if (!/^\d{1,2}$/.test(raw)) return undefined
    const n = Number(raw)
    return n >= min && n <= max ? n : undefined
  }
  const minuto = field(parts[0], 0, 59, false)
  const hora = field(parts[1], 0, 23, false)
  const diaMes = field(parts[2], 1, 31, true)
  const mes = field(parts[3], 1, 12, true)
  const diaSemana = field(parts[4], 0, 7, true)
  if (minuto === undefined || hora === undefined || diaMes === undefined || mes === undefined || diaSemana === undefined) return null
  if (minuto === null || hora === null) return null
  return { minuto, hora, diaMes, mes, diaSemana: diaSemana === 7 ? 0 : diaSemana }
}

/** Próxima ejecución (UTC) estrictamente después de `desde`; null si la expresión no se reconoce. */
export function nextCronRun(expr: string, desde: Date): Date | null {
  const cron = parseCronExpression(expr)
  if (!cron) return null
  const start = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate())
  for (let day = 0; day <= 400; day++) {
    const d = new Date(start + day * 86400000)
    if (cron.diaMes !== null && d.getUTCDate() !== cron.diaMes) continue
    if (cron.mes !== null && d.getUTCMonth() + 1 !== cron.mes) continue
    if (cron.diaSemana !== null && d.getUTCDay() !== cron.diaSemana) continue
    const run = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), cron.hora, cron.minuto))
    if (run.getTime() > desde.getTime()) return run
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------------------------

export interface FuenteEstado {
  fuente: string
  ultimo_ok: string | null
  ultimo_intento: string | null
  estado: 'ok' | 'error' | 'corriendo' | null
  filas: number | null
  mensaje: string | null
  cursor: Record<string, unknown>
  siguiente_programado: string | null
  bloqueo_hasta: string | null
}

const ESTADO_COLUMNS = 'fuente, ultimo_ok, ultimo_intento, estado, filas, mensaje, cursor, siguiente_programado, bloqueo_hasta'

export async function leerEstadoFuente(db: SupabaseAdminClient, fuente: FuenteId): Promise<FuenteEstado | null> {
  const { data, error } = await db.from('fuentes_estado').select(ESTADO_COLUMNS).eq('fuente', fuente).limit(1)
  if (error) throw new Error(`fuentes_estado (${fuente}): ${error.message}`)
  const row = (data?.[0] ?? null) as (FuenteEstado & { cursor: unknown }) | null
  if (!row) return null
  return { ...row, cursor: row.cursor && typeof row.cursor === 'object' ? (row.cursor as Record<string, unknown>) : {} }
}

/**
 * Toma el bloqueo de la fuente (UPDATE condicional: solo si no hay bloqueo vigente). Crea la fila si no
 * existe. Devuelve false si otra invocación la tiene.
 */
export async function tomarBloqueo(db: SupabaseAdminClient, fuente: FuenteId, ahora = new Date(), duracionMs = BLOQUEO_MS): Promise<boolean> {
  const def = definicionFuente(fuente)
  const { error: insertError } = await db
    .from('fuentes_estado')
    .upsert({ fuente, nombre: def.nombre, programacion: def.programacion, ejecutor: def.ejecutor }, { onConflict: 'fuente', ignoreDuplicates: true })
  if (insertError) throw new Error(`fuentes_estado (${fuente}): ${insertError.message}`)
  const nowIso = ahora.toISOString()
  const patch = { bloqueo_hasta: new Date(ahora.getTime() + duracionMs).toISOString(), ultimo_intento: nowIso, updated_at: nowIso }
  // Dos UPDATE condicionales (sin bloqueo / bloqueo vencido): PostgREST no acepta .or() en un PATCH
  // ("column fuentes_estado.bloqueo_hasta does not exist", comprobado el 2026-10-11).
  for (const condicion of ['libre', 'vencido'] as const) {
    const query = db.from('fuentes_estado').update(patch).eq('fuente', fuente)
    const { data, error } = await (condicion === 'libre' ? query.is('bloqueo_hasta', null) : query.lt('bloqueo_hasta', nowIso)).select('fuente')
    if (error) throw new Error(`fuentes_estado (${fuente}): ${error.message}`)
    if ((data?.length ?? 0) > 0) return true
  }
  return false
}

/** Guarda el avance a mitad de una invocación (sin soltar el bloqueo). */
export async function guardarCursor(db: SupabaseAdminClient, fuente: FuenteId, cursor: Record<string, unknown>, mensaje?: string): Promise<void> {
  const patch: Record<string, unknown> = { cursor, updated_at: new Date().toISOString() }
  if (mensaje !== undefined) patch.mensaje = mensaje.slice(0, 2000)
  const { error } = await db.from('fuentes_estado').update(patch).eq('fuente', fuente)
  if (error) throw new Error(`fuentes_estado (${fuente}): ${error.message}`)
}

export interface CierreFuente {
  estado: 'ok' | 'error' | 'corriendo'
  filas: number | null
  mensaje: string
  cursor?: Record<string, unknown>
}

/** Cierra la invocación: estado, filas, mensaje, cursor, próxima ejecución; suelta el bloqueo. */
export async function cerrarFuente(db: SupabaseAdminClient, fuente: FuenteId, cierre: CierreFuente, ahora = new Date()): Promise<void> {
  const def = definicionFuente(fuente)
  const patch: Record<string, unknown> = {
    estado: cierre.estado,
    mensaje: cierre.mensaje.slice(0, 2000),
    siguiente_programado: nextCronRun(def.programacion, ahora)?.toISOString() ?? null,
    bloqueo_hasta: null,
    updated_at: ahora.toISOString(),
  }
  // filas null = la invocación no cargó nada nuevo ("sin cambios" o error): se conservan las de la última carga
  if (cierre.filas !== null) patch.filas = Math.max(0, Math.round(cierre.filas))
  if (cierre.cursor !== undefined) patch.cursor = cierre.cursor
  if (cierre.estado === 'ok') patch.ultimo_ok = ahora.toISOString()
  const { error } = await db.from('fuentes_estado').update(patch).eq('fuente', fuente)
  if (error) throw new Error(`fuentes_estado (${fuente}): ${error.message}`)
}
