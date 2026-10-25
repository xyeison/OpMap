/**
 * Carga de los procesos de SECOP II sin contrato (fuente `secop_procesos`) en public.secop_procesos (solo servidor y
 * scripts). La usan scripts/secop-procesos-load.ts (carga inicial de 24 meses, sin límite de tiempo) y el cron diario /
 * "Actualizar ahora" (lib/fuentes-runner.ts, 50 s por invocación). Mismo código en los dos casos.
 * Spec: docs/specs/2026-10-25-secop-procesos-radar.md · reglas puras: lib/secop-procesos.ts.
 *
 * Una PASADA (reanudable; el avance vive en fuentes_estado.cursor de la fila 'secop_procesos'):
 *   1. Contexto (cargarContextoSecop, el mismo de los contratos): NIT de las IPS públicas objetivo (secop_nits_ips),
 *      IPS principal por NIT, proveedores vigilados activos y la sal del hash de documentos (secop_ajustes).
 *   2. Tareas: lotes de 50 NIT de entidades (PROCESOS_TAREA_TAMANO). Modo 'inicial' (la primera vez o forzado): todo lo
 *      publicado desde el primer día de hace 24 meses. Modo 'incremental': lo publicado en los últimos 120 días, más una
 *      tarea "de histórico" (24 meses) para los NIT que no estaban en la última pasada completa. p6dx-8zbt no tiene una
 *      marca de agua fiable (:updated_at se recarga entero cada día y la fecha de última publicación nunca se mueve), así
 *      que cada pasada RELEE la ventana y hace upsert: los cambios de estado de esos 120 días entran solos.
 *   3. Por tarea, páginas SoQL ordenadas por id_del_proceso (buildProcesosUrl, con el prefiltro ortopédico). Si la
 *      página viene llena, las filas de su ÚLTIMO proceso no se guardan todavía: el offset avanza solo hasta donde empieza
 *      ese proceso y la página siguiente lo relee entero. Así un proceso con lotes (una fila por lote) nunca queda partido
 *      entre dos páginas (el upsert reemplaza, no acumula).
 *   4. Cada fila se mapea (mapSecopProceso: estado, línea, proveedor que figura, descripción redactada, hospital_id,
 *      proveedor_vigilado_id, ultima_lectura), los lotes se juntan (agregarLotes) y se hace upsert por id_proceso en
 *      lotes de 500. Tras cada página se guarda el cursor y se renueva el bloqueo.
 * Si se acaba el tiempo, la pasada queda a medias y la siguiente invocación sigue donde iba.
 *
 * Dry-run: lee datos.gov.co y las tablas de contexto, mapea y cuenta, imprime 3 ejemplos sin nombres de personas y NO
 * escribe nada (ni secop_procesos ni fuentes_estado). Funciona aunque la migración 0890 no esté aplicada.
 *
 * No toca secop_contratos, secop_hechos ni secop_marcar_atipicos(): los procesos nunca suman como compras. Peticiones
 * HTTP normales a datos.gov.co con el User-Agent de OpMap (fetchJsonSocrata). No llama a Google.
 */
import type { SupabaseAdminClient } from './supabase-admin'
import { SECOP_MAX_AGOTADOS } from './secop'
import { cargarContextoSecop, fetchJsonSocrata, type FetchJson } from './secop-sync'
import { hashDocumento } from './secop-hash'
import { BLOQUEO_MS, leerEstadoFuente } from './fuentes-estado'
import {
  PROCESOS_TAREA_TAMANO,
  PROCESOS_UPSERT_CONFLICTO,
  SECOP_PROCESOS_FUENTE,
  SECOP_PROCESOS_NOMBRE,
  agregarLotes,
  buildProcesosTareas,
  buildProcesosUrl,
  desdeProcesos,
  mapSecopProceso,
  type ProcesoDescarte,
  type ProcesoRow,
  type ProcesosTarea,
} from './secop-procesos'
import type { SecopRaw } from './secop'

/** Filas por upsert (como secop_contratos). */
export const PROCESOS_UPSERT_LOTE = 500
/** No se empieza una página si quedan menos de esto (la página puede tardar; Vercel corta a los 60 s). */
const MARGEN_PAGINA_MS = 15_000
/** Tabla de la carga (migración 0890). */
const TABLA = 'secop_procesos'

export type ProcesosModo = 'inicial' | 'incremental'

/** Tarea de la pasada: un lote de NIT; `historico` = NIT nuevo en una incremental (lee los 24 meses). */
export interface ProcesosTareaSync extends ProcesosTarea {
  historico?: boolean
}

// ---------------------------------------------------------------------------------------------
// Cursor (puro: se prueba en scripts/secop-procesos-sync-check.ts)
// ---------------------------------------------------------------------------------------------

export interface ProcesosCursor {
  version: 1
  en_curso: boolean
  modo: ProcesosModo
  /** Fecha mínima de publicación de la pasada en curso ('YYYY-MM-DD'). */
  desde: string | null
  /** Fecha mínima de las tareas de histórico (NIT nuevos en una incremental): la de una carga inicial. */
  desde_historico: string | null
  paso: number
  offset: number
  inicio_pasada: string | null
  huella: string | null
  leidas: number
  guardadas: number
  descartadas: number
  ultima_pasada: { fin: string; modo: ProcesosModo; desde: string | null; leidas: number; guardadas: number } | null
  /** Fin de la última pasada INICIAL completa (ISO). */
  ultima_inicial: string | null
  /** NIT de entidades cubiertos por la última pasada completa (los nuevos traen su histórico). */
  nits_completos: string[] | null
  /** Invocaciones seguidas en que la página actual no cupo en el tiempo de la función (cron). */
  agotados: number
}

export function cursorProcesosVacio(): ProcesosCursor {
  return {
    version: 1,
    en_curso: false,
    modo: 'inicial',
    desde: null,
    desde_historico: null,
    paso: 0,
    offset: 0,
    inicio_pasada: null,
    huella: null,
    leidas: 0,
    guardadas: 0,
    descartadas: 0,
    ultima_pasada: null,
    ultima_inicial: null,
    nits_completos: null,
    agotados: 0,
  }
}

const fechaONull = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null)
const enteroO = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback)

/** Lee el cursor guardado en fuentes_estado.cursor (tolerante: lo que no reconoce vuelve al valor vacío). */
export function parseProcesosCursor(value: unknown): ProcesosCursor {
  const base = cursorProcesosVacio()
  if (!value || typeof value !== 'object') return base
  const v = value as Record<string, unknown>
  const u = v.ultima_pasada && typeof v.ultima_pasada === 'object' ? (v.ultima_pasada as Record<string, unknown>) : null
  const ultima: ProcesosCursor['ultima_pasada'] =
    u && typeof u.fin === 'string'
      ? { fin: u.fin, modo: u.modo === 'incremental' ? 'incremental' : 'inicial', desde: fechaONull(u.desde), leidas: enteroO(u.leidas, 0), guardadas: enteroO(u.guardadas, 0) }
      : null
  return {
    version: 1,
    en_curso: v.en_curso === true,
    modo: v.modo === 'incremental' ? 'incremental' : 'inicial',
    desde: fechaONull(v.desde),
    desde_historico: fechaONull(v.desde_historico),
    paso: enteroO(v.paso, 0),
    offset: enteroO(v.offset, 0),
    inicio_pasada: typeof v.inicio_pasada === 'string' ? v.inicio_pasada : null,
    huella: typeof v.huella === 'string' ? v.huella : null,
    leidas: enteroO(v.leidas, 0),
    guardadas: enteroO(v.guardadas, 0),
    descartadas: enteroO(v.descartadas, 0),
    ultima_pasada: ultima,
    ultima_inicial: typeof v.ultima_inicial === 'string' ? v.ultima_inicial : null,
    nits_completos: Array.isArray(v.nits_completos) ? v.nits_completos.filter((n): n is string => typeof n === 'string' && /^\d{9}$/.test(n)) : null,
    agotados: enteroO(v.agotados, 0),
  }
}

/**
 * Modo de la pasada que va a correr: la que está a medias sigue en su modo; si no, 'inicial' la primera vez (nunca hubo
 * una pasada completa) o si se fuerza, y 'incremental' en las demás.
 */
export function modoProcesos(cursor: ProcesosCursor, forzarInicial = false): ProcesosModo {
  if (forzarInicial) return 'inicial'
  if (cursor.en_curso) return cursor.modo
  return cursor.ultima_pasada ? 'incremental' : 'inicial'
}

/** NIT que no estaban en la última pasada completa (sin registro: ninguno, para no releer 24 meses de todos). */
export function nitsNuevosProcesos(entidades: readonly string[], completos: readonly string[] | null): string[] {
  if (!completos) return []
  const antes = new Set(completos)
  return Array.from(new Set(entidades)).filter(nit => !antes.has(nit)).sort()
}

/** Tareas de la pasada: lotes de 50 NIT; en incremental, además, lotes de histórico para los NIT nuevos. */
export function tareasProcesos(entidades: readonly string[], modo: ProcesosModo, completos: readonly string[] | null, tamano = PROCESOS_TAREA_TAMANO): ProcesosTareaSync[] {
  const tareas: ProcesosTareaSync[] = buildProcesosTareas(entidades, tamano)
  if (modo === 'incremental') {
    const nuevos = nitsNuevosProcesos(entidades, completos)
    for (const t of buildProcesosTareas(nuevos, tamano)) tareas.push({ ...t, historico: true })
  }
  return tareas
}

/** Huella corta de la lista de tareas: si cambia (entran o salen NIT), la pasada a medias vuelve a la tarea 0. */
export function huellaProcesos(tareas: readonly ProcesosTareaSync[]): string {
  const text = `${SECOP_PROCESOS_FUENTE}#${tareas.map(t => `${t.historico ? 'h' : ''}${t.nits.join(',')}`).join(';')}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}-${tareas.length}`
}

/**
 * Empieza (o retoma) una pasada. Si hay una a medias con la misma lista de tareas, sigue donde iba; si la lista cambió,
 * vuelve a la tarea 0 con las mismas fechas. Si no hay pasada a medias (o se fuerza la inicial), abre una nueva con
 * desde = desdeProcesos(modo, hoy) (inicial: primer día de hace 24 meses; incremental: hoy − 120 días).
 */
export function iniciarPasadaProcesos(cursor: ProcesosCursor, opts: { ahora: Date; huella: string; modo: ProcesosModo; forzarInicial?: boolean }): ProcesosCursor {
  if (cursor.en_curso && !opts.forzarInicial && cursor.modo === opts.modo && cursor.desde) {
    if (cursor.huella === opts.huella) return cursor
    return { ...cursor, paso: 0, offset: 0, huella: opts.huella }
  }
  const hoy = opts.ahora.toISOString().slice(0, 10)
  return {
    ...cursor,
    en_curso: true,
    modo: opts.modo,
    desde: desdeProcesos(opts.modo, hoy),
    desde_historico: desdeProcesos('inicial', hoy),
    paso: 0,
    offset: 0,
    inicio_pasada: opts.ahora.toISOString(),
    huella: opts.huella,
    leidas: 0,
    guardadas: 0,
    descartadas: 0,
    agotados: 0,
  }
}

/**
 * Cuántas filas de una página se procesan. Página incompleta: todas (es la última de la tarea). Página llena: hasta
 * antes de las filas de su último id_del_proceso, que la página siguiente relee enteras (un proceso con lotes no se
 * parte). Si la página entera es un solo proceso (solo con páginas diminutas), se procesa toda.
 */
export function filasAConsumir(raws: readonly SecopRaw[], limite: number): number {
  if (raws.length < limite || raws.length === 0) return raws.length
  const idDe = (raw: SecopRaw) => String(raw.id_del_proceso ?? '')
  const ultimo = idDe(raws[raws.length - 1])
  let k = raws.length
  while (k > 0 && idDe(raws[k - 1]) === ultimo) k--
  return k > 0 ? k : raws.length
}

/** Registra una página: página llena → avanza el offset lo consumido; incompleta → siguiente tarea. */
export function registrarPaginaProcesos(cursor: ProcesosCursor, page: { filas: number; consumidas: number; limite: number; guardadas: number; descartadas: number }): ProcesosCursor {
  const completa = page.filas >= page.limite
  return {
    ...cursor,
    paso: completa ? cursor.paso : cursor.paso + 1,
    offset: completa ? cursor.offset + page.consumidas : 0,
    leidas: cursor.leidas + page.consumidas,
    guardadas: cursor.guardadas + page.guardadas,
    descartadas: cursor.descartadas + page.descartadas,
    agotados: 0,
  }
}

export function pasadaProcesosTerminada(cursor: ProcesosCursor, totalTareas: number): boolean {
  return cursor.paso >= totalTareas
}

/** Cierra la pasada: guarda el resumen, los NIT cubiertos (ordenados) y, si fue inicial, cuándo terminó. */
export function cerrarPasadaProcesos(cursor: ProcesosCursor, opts: { ahora: Date; nits: readonly string[] }): ProcesosCursor {
  const fin = opts.ahora.toISOString()
  return {
    ...cursor,
    en_curso: false,
    paso: 0,
    offset: 0,
    agotados: 0,
    nits_completos: Array.from(new Set(opts.nits)).sort(),
    ultima_inicial: cursor.modo === 'inicial' ? fin : cursor.ultima_inicial,
    ultima_pasada: { fin, modo: cursor.modo, desde: cursor.desde, leidas: cursor.leidas, guardadas: cursor.guardadas },
  }
}

// ---------------------------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------------------------

const fmt = (n: number) => n.toLocaleString('es-CO')

/** Mensaje de fuentes_estado (panel "Fuentes de datos"). */
export function mensajeProcesos(r: { terminado: boolean; cursor: ProcesosCursor; leidas: number; guardadas: number }, totalTareas: number): string {
  const tipo = r.cursor.modo === 'inicial' ? `carga inicial (publicados desde ${r.cursor.desde ?? '—'})` : `relectura de los últimos 120 días (desde ${r.cursor.desde ?? '—'})`
  if (r.terminado) {
    const p = r.cursor.ultima_pasada
    return `${SECOP_PROCESOS_NOMBRE}: ${tipo} completa (${fmt(p?.leidas ?? r.leidas)} filas leídas, ${fmt(p?.guardadas ?? r.guardadas)} procesos guardados).`
  }
  return `${SECOP_PROCESOS_NOMBRE}: ${tipo} a medias, tarea ${Math.min(r.cursor.paso + 1, totalTareas)} de ${totalTareas} (${fmt(r.cursor.leidas)} filas leídas, ${fmt(r.cursor.guardadas)} procesos guardados); sigue en la próxima ejecución.`
}

/**
 * Ejemplo de dry-run SIN datos de personas: id, referencia, entidad, estado, líneas, precio base, fecha y el proveedor
 * que figura solo si es una empresa (persona natural: solo "persona natural"; nunca nombre, documento ni hash). No lleva
 * la descripción ni el título del proceso.
 */
export function ejemploProceso(f: ProcesoRow): string {
  const proveedor =
    f.proveedor_origen !== null
      ? `${f.proveedor_nombre ?? 'empresa sin nombre'}${f.proveedor_nit ? ` (NIT ${f.proveedor_nit})` : ''}, ${f.proveedor_origen === 'nit' ? 'por NIT' : f.proveedor_origen === 'nombre' ? 'por nombre del proveedor' : 'según el título del proceso'}`
      : f.es_persona
        ? 'persona natural (sin nombre ni documento)'
        : 'Proveedor no publicado'
  const lineas = f.lineas.length > 1 ? ` (${f.lineas.join(', ')})` : ''
  return [
    f.id_proceso,
    `ref. ${f.referencia ?? '—'}`,
    `entidad ${f.nit_entidad}${f.hospital_id ? '' : ' (sin IPS)'}`,
    f.estado,
    `${f.linea}${lineas}`,
    `precio base ${f.precio_base === null ? '—' : fmt(f.precio_base)}`,
    `publicado el ${f.fecha_publicacion ?? '—'}`,
    `proveedor que figura: ${proveedor}`,
  ].join(' · ')
}

/** Hasta 3 ejemplos variados: empresa por NIT, empresa por nombre o título, persona o sin proveedor; luego el resto. */
function elegirEjemplos(filas: readonly ProcesoRow[], n = 3): ProcesoRow[] {
  const grupos: Array<(f: ProcesoRow) => boolean> = [
    f => f.proveedor_origen === 'nit',
    f => f.proveedor_origen === 'nombre' || f.proveedor_origen === 'titulo',
    f => f.proveedor_origen === null,
  ]
  const elegidos: ProcesoRow[] = []
  for (const grupo of grupos) {
    const f = filas.find(x => grupo(x) && !elegidos.includes(x))
    if (f && elegidos.length < n) elegidos.push(f)
  }
  for (const f of filas) if (elegidos.length < n && !elegidos.includes(f)) elegidos.push(f)
  return elegidos
}

// ---------------------------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------------------------

/** La tabla existe (migración 0890): si no, se aborta ANTES de pedir nada a datos.gov.co. */
async function comprobarTabla(db: SupabaseAdminClient): Promise<void> {
  const { error } = await db.from(TABLA).select('id_proceso').limit(1)
  if (error) throw new Error(`${TABLA} (¿falta la migración 2026-10-25_0890_secop_procesos.sql?): ${error.message}`)
}

/** Upsert por id_proceso en lotes de 500 (las filas ya vienen agregadas: un id_proceso una sola vez). */
async function upsertProcesos(db: SupabaseAdminClient, rows: readonly ProcesoRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += PROCESOS_UPSERT_LOTE) {
    const lote = rows.slice(i, i + PROCESOS_UPSERT_LOTE)
    const { error } = await db.from(TABLA).upsert(lote, { onConflict: PROCESOS_UPSERT_CONFLICTO })
    if (error) throw new Error(`${TABLA} (upsert): ${error.message}`)
  }
}

// ---------------------------------------------------------------------------------------------
// Una invocación
// ---------------------------------------------------------------------------------------------

export interface ProcesosSyncOptions {
  db: SupabaseAdminClient
  /** Momento (epoch ms) en que hay que parar; Infinity en el script. */
  deadline: number
  pageSize: number
  forzarInicial?: boolean
  /** Lee, mapea y cuenta, pero no escribe nada (ni secop_procesos ni fuentes_estado). */
  dryRun?: boolean
  maxPaginas?: number
  /** Solo con dryRun: limita las entidades a estos NIT de 9 dígitos (para revisar una IPS concreta). */
  soloNits?: readonly string[]
  /** Renovación del bloqueo de fuentes_estado tras cada página (más largo en el script). */
  bloqueoMs?: number
  fetchJson?: FetchJson
  ahora?: () => Date
  log?: (message: string) => void
}

export interface ProcesosSyncResult {
  terminado: boolean
  cursor: ProcesosCursor
  tareas: number
  paginas: number
  /** Filas de p6dx-8zbt procesadas (las retenidas por el corte de página se cuentan una sola vez). */
  leidas: number
  /** Filas que pasaron el mapeo (una por lote). */
  mapeadas: number
  /** Procesos guardados (o que se guardarían en dry-run), ya con los lotes juntos. */
  guardadas: number
  descartadas: number
  porMotivo: Record<ProcesoDescarte, number>
  /** Ejemplos de dry-run (sin nombres de personas). */
  ejemplos: string[]
  /** La última consulta no cupo en el tiempo de la invocación (se reintenta en la siguiente). */
  agotado: boolean
  mensaje: string
}

const motivosVacios = (): Record<ProcesoDescarte, number> => ({ sin_id: 0, nit_entidad: 0, entidad_no_objetivo: 0, estado: 0, servicio: 0, unspsc: 0, no_clasificado: 0 })

/** Una invocación: sigue (o empieza) la pasada hasta terminar, hasta el deadline o hasta maxPaginas. */
export async function sincronizarSecopProcesos(opts: ProcesosSyncOptions): Promise<ProcesosSyncResult> {
  const { db } = opts
  const fetchJson = opts.fetchJson ?? fetchJsonSocrata
  const log = opts.log ?? (() => {})
  const ahora = opts.ahora ?? (() => new Date())
  if (opts.soloNits && !opts.dryRun) throw new Error('soloNits solo se permite en dry-run (cambiaría la lista de tareas de la pasada guardada)')

  const ctx = await cargarContextoSecop(db)
  let entidades = Array.from(ctx.entidades).sort()
  if (opts.soloNits) {
    const pedidos = new Set(opts.soloNits)
    entidades = entidades.filter(nit => pedidos.has(nit))
    const fuera = Array.from(pedidos).filter(nit => !ctx.entidades.has(nit))
    if (fuera.length) log(`  aviso: ${fuera.join(', ')} no son entidades objetivo (secop_nits_ips().publica): se ignoran`)
  }
  if (!opts.dryRun) await comprobarTabla(db)
  const estado = await leerEstadoFuente(db, SECOP_PROCESOS_FUENTE)
  const guardado = parseProcesosCursor(estado?.cursor)
  // Primera vez que se registra la lista con una pasada ya hecha: se toma la actual (no se relee el histórico de todos)
  const completos = guardado.nits_completos ?? (guardado.ultima_pasada ? entidades : null)
  const modo = modoProcesos(guardado, opts.forzarInicial)
  const tareas = tareasProcesos(entidades, modo, completos)
  let cursor = iniciarPasadaProcesos({ ...guardado, nits_completos: completos }, { ahora: ahora(), huella: huellaProcesos(tareas), modo, forzarInicial: opts.forzarInicial })
  const historicas = tareas.filter(t => t.historico).length
  log(
    `${SECOP_PROCESOS_FUENTE}: ${entidades.length} entidades objetivo, ${tareas.length} tarea${tareas.length === 1 ? '' : 's'}${historicas ? ` (${historicas} de histórico para NIT nuevos)` : ''} · ` +
      `${cursor.modo} desde ${cursor.desde} · tarea ${cursor.paso + 1}, offset ${cursor.offset}${opts.dryRun ? ' · DRY-RUN (no escribe)' : ''}`
  )

  const result: ProcesosSyncResult = {
    terminado: false,
    cursor,
    tareas: tareas.length,
    paginas: 0,
    leidas: 0,
    mapeadas: 0,
    guardadas: 0,
    descartadas: 0,
    porMotivo: motivosVacios(),
    ejemplos: [],
    agotado: false,
    mensaje: '',
  }
  const hash = (digitos: string) => hashDocumento(digitos, ctx.sal)
  let ultimaPaginaMs = 0

  while (!pasadaProcesosTerminada(cursor, tareas.length)) {
    const restante = opts.deadline - Date.now()
    // No se empieza una página que, a juzgar por la anterior, no cabe en lo que queda (evita una consulta perdida)
    if (restante < Math.max(MARGEN_PAGINA_MS, ultimaPaginaMs * 1.2 + 5000)) break
    if (opts.maxPaginas !== undefined && result.paginas >= opts.maxPaginas) break
    const tarea = tareas[cursor.paso]
    const desde = (tarea.historico ? cursor.desde_historico : cursor.desde) ?? desdeProcesos('inicial', ahora().toISOString().slice(0, 10))
    const url = buildProcesosUrl(tarea, { desde, offset: cursor.offset, limit: opts.pageSize })
    const t0 = Date.now()
    let data: unknown
    try {
      data = await fetchJson(url, Math.min(Number.isFinite(opts.deadline) ? 180_000 : 600_000, restante - 5000))
    } catch (error) {
      const nombre = (error as { name?: string } | null)?.name
      if (!Number.isFinite(opts.deadline) || (nombre !== 'TimeoutError' && nombre !== 'AbortError')) throw error
      // La consulta no cupo en el tiempo de la función: se reintenta en la próxima invocación desde el mismo punto
      cursor = { ...cursor, agotados: cursor.agotados + 1 }
      result.agotado = true
      log(`  la consulta tardó más que el tiempo disponible (${cursor.agotados} vez/veces seguidas)`)
      if (cursor.agotados >= SECOP_MAX_AGOTADOS) {
        throw new Error(
          `${SECOP_PROCESOS_FUENTE}: la tarea ${cursor.paso + 1} de ${tareas.length}${tarea.historico ? ' (histórico)' : ''} no cabe en una invocación de 50 s ` +
            `${cursor.agotados} veces seguidas; correr una vez "npx tsx scripts/secop-procesos-load.ts" desde web/`
        )
      }
      break
    }
    if (!Array.isArray(data)) throw new Error(`datos.gov.co devolvió algo que no es una lista (${JSON.stringify(data).slice(0, 200)})`)
    const raws = data as SecopRaw[]
    const consumidas = filasAConsumir(raws, opts.pageSize)
    if (raws.length >= opts.pageSize && consumidas === raws.length) log('  aviso: la página entera es un solo proceso; sube --page-size si sus lotes no caben en una página')

    const lectura = ahora().toISOString()
    const mapeadas: ProcesoRow[] = []
    let descartadas = 0
    for (const raw of raws.slice(0, consumidas)) {
      const r = mapSecopProceso(raw, { hashDocumento: hash, entidades: ctx.entidades, hospitalPorNit: ctx.hospitalPorNit, vigilados: ctx.vigilados, ahora: lectura })
      if ('descartado' in r) {
        result.porMotivo[r.descartado]++
        descartadas++
        continue
      }
      mapeadas.push(r.row)
    }
    const filas = agregarLotes(mapeadas)
    if (opts.dryRun && result.ejemplos.length < 3 && filas.length > 0) {
      for (const f of elegirEjemplos(filas, 3 - result.ejemplos.length)) {
        const ejemplo = ejemploProceso(f)
        result.ejemplos.push(ejemplo)
        log(`    ejemplo: ${ejemplo}`)
      }
    }
    if (!opts.dryRun && filas.length > 0) await upsertProcesos(db, filas)

    cursor = registrarPaginaProcesos(cursor, { filas: raws.length, consumidas, limite: opts.pageSize, guardadas: filas.length, descartadas })
    result.paginas++
    result.leidas += consumidas
    result.mapeadas += mapeadas.length
    result.guardadas += filas.length
    result.descartadas += descartadas
    ultimaPaginaMs = Date.now() - t0
    log(
      `  ${tarea.historico ? 'histórico, ' : ''}${tarea.nits.length} NIT · ${fmt(raws.length)} filas (${fmt(consumidas)} procesadas) → ${fmt(mapeadas.length)} mapeadas, ` +
        `${fmt(filas.length)} procesos · ${(ultimaPaginaMs / 1000).toFixed(1)} s · tarea ${Math.min(cursor.paso + 1, tareas.length)}/${tareas.length}, offset ${cursor.offset}`
    )
    if (!opts.dryRun) {
      const { error } = await db
        .from('fuentes_estado')
        .update({
          cursor,
          estado: 'corriendo',
          mensaje: mensajeProcesos({ terminado: false, cursor, leidas: result.leidas, guardadas: result.guardadas }, tareas.length),
          bloqueo_hasta: new Date(Date.now() + (opts.bloqueoMs ?? BLOQUEO_MS)).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('fuente', SECOP_PROCESOS_FUENTE)
      if (error) throw new Error(`fuentes_estado (${SECOP_PROCESOS_FUENTE}): ${error.message}`)
    }
  }

  if (pasadaProcesosTerminada(cursor, tareas.length)) {
    cursor = cerrarPasadaProcesos(cursor, { ahora: ahora(), nits: entidades })
    result.terminado = true
  }
  result.cursor = cursor
  result.mensaje =
    mensajeProcesos({ terminado: result.terminado, cursor, leidas: result.leidas, guardadas: result.guardadas }, tareas.length) +
    (result.agotado ? ' La última consulta de datos.gov.co no cupo en el tiempo de esta ejecución; se reintenta en la próxima.' : '')
  return result
}
