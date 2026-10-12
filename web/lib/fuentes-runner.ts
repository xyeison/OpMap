/**
 * PR 7 · Ejecutor ÚNICO de las cargas automáticas (solo servidor y scripts). Lo llaman:
 *   - el cron de Vercel: GET /api/cron/<fuente> (app/api/cron/[fuente]/route.ts), 50 s por invocación;
 *   - "Actualizar ahora" del panel Fuentes de datos (app/api/fuentes/_lib/runner.ts), mismo presupuesto;
 *   - scripts/secop-load.ts (carga inicial de SECOP, sin límite de tiempo).
 *
 * Por invocación: toma el bloqueo de la fuente en fuentes_estado (si otra invocación lo tiene, responde
 * "ocupada" sin hacer nada), corre la carga hasta terminar o hasta el presupuesto, y cierra la fila con
 * estado ok (terminó), corriendo (quedó una pasada a medias: la siguiente invocación sigue desde el cursor)
 * o error (con el mensaje; el cursor guardado se conserva para reintentar).
 */
import { getSupabaseAdmin, type SupabaseAdminClient } from './supabase-admin'
import { BLOQUEO_MS, BLOQUEO_SCRIPT_MS, FUENTES_AUTOMATICAS, cerrarFuente, leerEstadoFuente, tomarBloqueo, type FuenteAutomatica } from './fuentes-estado'
import { sincronizarSecop } from './secop-sync'
import type { SecopFuente } from './secop'

/** Presupuesto por invocación en Vercel (la función se corta a los 60 s; queda margen para cerrar). */
export const PRESUPUESTO_CRON_MS = 50_000

export interface ResultadoFuente {
  fuente: FuenteAutomatica
  /** false si hubo error o la fuente estaba ocupada. */
  ok: boolean
  /** true si la carga terminó (no queda nada pendiente para la próxima invocación). */
  terminado: boolean
  estado: 'ok' | 'error' | 'corriendo' | 'ocupada'
  filas: number | null
  mensaje: string
  duracionMs: number
}

export interface EjecucionOpciones {
  presupuestoMs: number
  origen: 'cron' | 'manual' | 'script'
  /** Solo SECOP: empezar una pasada inicial completa aunque haya marca de agua. */
  forzarInicial?: boolean
  /** Solo SECOP: filas por página SoQL. */
  pageSize?: number
  log?: (message: string) => void
  db?: SupabaseAdminClient
}

/** Lo que devuelve cada carga a este ejecutor. */
export interface CargaResultado {
  terminado: boolean
  filas: number | null
  mensaje: string
  cursor?: Record<string, unknown>
}

const SECOP_DE_FUENTE: Partial<Record<FuenteAutomatica, SecopFuente>> = { secop_ii: 'secop2', secop_i: 'secop1', secop_integrado: 'integrado' }

async function correrCarga(fuente: FuenteAutomatica, db: SupabaseAdminClient, deadline: number, opts: EjecucionOpciones): Promise<CargaResultado> {
  const secop = SECOP_DE_FUENTE[fuente]
  if (secop) {
    const r = await sincronizarSecop({
      db,
      fuente: secop,
      deadline,
      bloqueoMs: Number.isFinite(deadline) ? BLOQUEO_MS : BLOQUEO_SCRIPT_MS,
      pageSize: opts.pageSize ?? (opts.origen === 'script' ? 5000 : 2000),
      forzarInicial: opts.forzarInicial,
      log: opts.log,
    })
    const pasada = r.terminado ? r.cursor.ultima_pasada?.guardadas ?? r.guardadas : r.cursor.guardadas
    return { terminado: r.terminado, filas: pasada, mensaje: r.mensaje, cursor: r.cursor as unknown as Record<string, unknown> }
  }
  if (fuente === 'reps_sedes') {
    const { sincronizarRepsSedes } = await import('./reps-sedes-sync')
    return sincronizarRepsSedes({ db, deadline, log: opts.log })
  }
  if (fuente === 'bdua') {
    const { sincronizarBdua } = await import('./bdua-sync')
    return sincronizarBdua({ db, deadline, log: opts.log })
  }
  const { sincronizarCifras } = await import('./cifras-sync')
  return sincronizarCifras({ db, deadline, log: opts.log })
}

export async function ejecutarFuente(fuente: FuenteAutomatica, opts: EjecucionOpciones): Promise<ResultadoFuente> {
  const inicio = Date.now()
  const db = opts.db ?? getSupabaseAdmin()
  const bloqueoMs = Number.isFinite(opts.presupuestoMs) ? BLOQUEO_MS : BLOQUEO_SCRIPT_MS
  const tomado = await tomarBloqueo(db, fuente, new Date(), bloqueoMs)
  if (!tomado) {
    return { fuente, ok: false, terminado: false, estado: 'ocupada', filas: null, mensaje: 'Esta fuente ya se está actualizando (cron o "Actualizar ahora"); intenta en un minuto.', duracionMs: Date.now() - inicio }
  }
  try {
    const r = await correrCarga(fuente, db, inicio + opts.presupuestoMs, opts)
    const estado = r.terminado ? 'ok' : 'corriendo'
    await cerrarFuente(db, fuente, { estado, filas: r.filas, mensaje: r.mensaje, cursor: r.cursor })
    return { fuente, ok: true, terminado: r.terminado, estado, filas: r.filas, mensaje: r.mensaje, duracionMs: Date.now() - inicio }
  } catch (error) {
    const mensaje = `Error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1500)
    try {
      await cerrarFuente(db, fuente, { estado: 'error', filas: null, mensaje })
    } catch {
      // Si ni siquiera se puede escribir fuentes_estado, el bloqueo caduca solo (BLOQUEO_MS)
    }
    return { fuente, ok: false, terminado: false, estado: 'error', filas: null, mensaje, duracionMs: Date.now() - inicio }
  }
}

/**
 * Cron diario "continuar": sigue las pasadas que quedaron a medias (estado corriendo) en cualquier fuente,
 * una tras otra mientras quede presupuesto. Así una carga mensual que no cupo en 50 s no espera un mes.
 */
export async function continuarPendientes(opts: Omit<EjecucionOpciones, 'origen'>): Promise<ResultadoFuente[]> {
  const inicio = Date.now()
  const db = opts.db ?? getSupabaseAdmin()
  const resultados: ResultadoFuente[] = []
  for (const fuente of FUENTES_AUTOMATICAS) {
    const restante = opts.presupuestoMs - (Date.now() - inicio)
    if (restante < 20_000) break
    const estado = await leerEstadoFuente(db, fuente)
    if (estado?.estado !== 'corriendo') continue
    resultados.push(await ejecutarFuente(fuente, { ...opts, db, origen: 'cron', presupuestoMs: restante }))
  }
  return resultados
}
