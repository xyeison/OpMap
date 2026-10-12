/**
 * PR 7 · Carga de SECOP en secop_contratos (solo servidor y scripts). La usan scripts/secop-load.ts
 * (carga inicial, sin límite de tiempo) y el cron / "Actualizar ahora" (lib/fuentes-runner.ts, 50 s por
 * invocación). Mismo código en los dos casos.
 *
 * Fuentes: SECOP II (jbjy-vk9h), SECOP I con valor adjudicado por contratista (f789-7hwg) y SECOP Integrado
 * (rpmr-utcd, respaldo de SECOP I para antes de 2018). Una pasada por fuente; mismo código para las tres.
 *
 * Cómo funciona una PASADA (reanudable; el avance vive en fuentes_estado.cursor):
 *   1. Contexto: NIT de las IPS activas (función secop_nits_ips: IPS principal por NIT y si es entidad de
 *      compra pública: marca manual hospitals.compra_publica o, si es null, pública o mixta en el REPS),
 *      proveedores vigilados activos y la sal del hash de documentos (secop_ajustes).
 *   2. Tareas: grupos de NIT de entidades objetivo y de proveedores vigilados (40 por consulta; 30 entidades en
 *      SECOP I porque su prefiltro es más largo: lib/secop.ts).
 *   3. Por tarea, páginas SoQL ordenadas por :id. Pasada inicial: entidades con prefiltro de texto (y
 *      clase UNSPSC 4232 en SECOP II y SECOP I) + todos los contratos de los vigilados. Pasada incremental: lo
 *      mismo sin prefiltro (es poco) y solo desde la marca de agua − solape (SECOP II: ultima_actualizacion,
 *      3 días; SECOP I: ultima_actualizacion o fecha de firma, 30 días; Integrado: fecha de firma, 30 días).
 *   4. Cada fila se mapea (mapSecopRow), se decide si entra (decidirAlcance) y se hace upsert por
 *      (fuente, id_contrato) en lotes de 500. Tras cada página se guarda el cursor (y se renueva el bloqueo).
 *   5. Al terminar la última tarea: secop_marcar_atipicos() y el cursor queda listo para la próxima pasada.
 * Si se acaba el tiempo, la pasada queda "en curso" y la siguiente invocación sigue donde iba.
 *
 * Peticiones HTTP normales a datos.gov.co con un User-Agent que identifica al script; sin token (si existe
 * SOCRATA_APP_TOKEN se envía como X-App-Token, que sube el límite de peticiones). No llama a Google.
 */
import type { SupabaseAdminClient } from './supabase-admin'
import {
  SECOP_ETIQUETAS,
  SECOP_FUENTE_ESTADO,
  SECOP_SOLAPE_DIAS,
  SECOP_TAREA_TAMANO_POR_FUENTE,
  buildSecopTareas,
  buildSecopUrl,
  cerrarPasada,
  decidirAlcance,
  huellaTareas,
  iniciarPasada,
  mapSecopRow,
  nitsNuevos,
  parseSecopCursor,
  pasadaTerminada,
  registrarPagina,
  SECOP_MAX_AGOTADOS,
  watermarkDeFila,
  type SecopContratoRow,
  type SecopCursor,
  type SecopFuente,
  type SecopRaw,
} from './secop'
import { hashDocumento } from './secop-hash'
import { BLOQUEO_MS, leerEstadoFuente } from './fuentes-estado'

const USER_AGENT = 'OpMap-SECOP/1.0 (compras publicas; datos abiertos de datos.gov.co)'
const UPSERT_LOTE = 500
/** No se empieza una página si quedan menos de esto (la página puede tardar; Vercel corta a los 60 s). */
const MARGEN_PAGINA_MS = 15_000

export type FetchJson = (url: string, timeoutMs: number) => Promise<unknown>

/** GET JSON con reintentos ante 429/5xx/red; los demás 4xx no se reintentan. */
export const fetchJsonSocrata: FetchJson = async (url, timeoutMs) => {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  if (process.env.SOCRATA_APP_TOKEN) headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN
  const limite = Date.now() + timeoutMs
  let lastError: unknown = null
  for (let intento = 1; intento <= 3; intento++) {
    const restante = limite - Date.now()
    if (restante < 2000) break
    try {
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(restante) })
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300)
        const error = Object.assign(new Error(`datos.gov.co HTTP ${res.status}: ${body}`), { fatal: res.status >= 400 && res.status < 500 && res.status !== 429 })
        throw error
      }
      return await res.json()
    } catch (error) {
      lastError = error
      if ((error as { fatal?: boolean }).fatal) break
      await new Promise(resolve => setTimeout(resolve, 1500 * intento))
    }
  }
  const nombre = (lastError as { name?: string } | null)?.name
  if (nombre === 'TimeoutError' || nombre === 'AbortError') {
    // Se conserva el nombre: sincronizarSecop lo trata como "no cupo en el tiempo" y reintenta después
    throw Object.assign(new Error(`datos.gov.co no respondió en ${Math.round(timeoutMs / 1000)} s`), { name: 'TimeoutError' })
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'datos.gov.co no respondió'))
}

export interface SecopContexto {
  /** NIT (9 dígitos) de las IPS activas que son entidad de compra pública (marca manual o REPS pública/mixta). */
  entidades: Set<string>
  /** NIT de cualquier IPS activa → su IPS principal (más camas). */
  hospitalPorNit: Map<string, string>
  /** NIT de los proveedores vigilados activos. */
  vigilados: Set<string>
  sal: string
}

export async function cargarContextoSecop(db: SupabaseAdminClient): Promise<SecopContexto> {
  const entidades = new Set<string>()
  const hospitalPorNit = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc('secop_nits_ips').range(from, from + 999)
    if (error) throw new Error(`secop_nits_ips (¿falta la migración 0710?): ${error.message}`)
    const rows = (data ?? []) as Array<{ nit: string; hospital_id: string; publica: boolean }>
    for (const row of rows) {
      if (!/^\d{9}$/.test(row.nit)) continue
      hospitalPorNit.set(row.nit, row.hospital_id)
      if (row.publica) entidades.add(row.nit)
    }
    if (rows.length < 1000) break
  }
  const vigilados = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('secop_proveedores_vigilados').select('nit').eq('activo', true).order('nit').range(from, from + 999)
    if (error) throw new Error(`secop_proveedores_vigilados: ${error.message}`)
    for (const row of data ?? []) vigilados.add(String((row as { nit: string }).nit))
    if (!data || data.length < 1000) break
  }
  const { data: ajustes, error: salError } = await db.from('secop_ajustes').select('sal_documentos').eq('id', 1).limit(1)
  if (salError) throw new Error(`secop_ajustes: ${salError.message}`)
  const sal = String((ajustes?.[0] as { sal_documentos?: string } | undefined)?.sal_documentos ?? '')
  if (sal.length < 32) throw new Error('secop_ajustes no tiene la sal de documentos (migración 0710)')
  return { entidades, hospitalPorNit, vigilados, sal }
}

export interface SecopSyncOptions {
  db: SupabaseAdminClient
  fuente: SecopFuente
  /** Momento (epoch ms) en que hay que parar; Infinity en el script. */
  deadline: number
  pageSize: number
  forzarInicial?: boolean
  /** Lee y clasifica, pero no escribe contratos ni cursor. */
  dryRun?: boolean
  maxPaginas?: number
  /** Renovación del bloqueo de fuentes_estado tras cada página (más largo en el script). */
  bloqueoMs?: number
  fetchJson?: FetchJson
  log?: (message: string) => void
}

export interface SecopSyncResult {
  fuente: SecopFuente
  terminado: boolean
  cursor: SecopCursor
  paginas: number
  leidas: number
  guardadas: number
  porAlcance: Record<'vigilado' | 'linea' | 'especialidad', number>
  descartadas: number
  errores: number
  ejemplosError: string[]
  atipicosMarcados: number | null
  /** La última consulta no cupo en el tiempo de la invocación (se reintenta en la siguiente). */
  agotado: boolean
  mensaje: string
}

const fmt = (n: number) => n.toLocaleString('es-CO')

export function mensajeSecop(r: Pick<SecopSyncResult, 'fuente' | 'terminado' | 'cursor' | 'leidas' | 'guardadas'>, totalTareas: number): string {
  const etiqueta = SECOP_ETIQUETAS[r.fuente]
  const tipo = r.cursor.modo === 'inicial' ? 'carga inicial' : `incremental desde ${r.cursor.desde}`
  if (r.terminado) {
    const p = r.cursor.ultima_pasada
    return `${etiqueta}: pasada ${tipo} completa (${fmt(p?.leidas ?? r.leidas)} leídas, ${fmt(p?.guardadas ?? r.guardadas)} guardadas). Próxima desde ${r.cursor.siguiente_desde ?? '—'}.`
  }
  return `${etiqueta}: ${tipo} en curso, tarea ${Math.min(r.cursor.paso + 1, totalTareas)} de ${totalTareas} (${fmt(r.cursor.leidas)} leídas, ${fmt(r.cursor.guardadas)} guardadas); sigue en la próxima ejecución.`
}

/**
 * Upsert por (fuente, id_contrato). Van TODAS las columnas de SecopContratoRow, incluidas valor_proceso y
 * valor_adiciones (migración 2026-10-12_0730; null en secop2 e integrado).
 */
async function upsertContratos(db: SupabaseAdminClient, rows: SecopContratoRow[], importedAt: string): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_LOTE) {
    const lote = rows.slice(i, i + UPSERT_LOTE).map(row => ({ ...row, imported_at: importedAt }))
    const { error } = await db.from('secop_contratos').upsert(lote, { onConflict: 'fuente,id_contrato' })
    if (error) throw new Error(`secop_contratos (upsert): ${error.message}`)
  }
}

/** Una invocación: sigue (o empieza) la pasada de una fuente hasta terminar o hasta el deadline. */
export async function sincronizarSecop(opts: SecopSyncOptions): Promise<SecopSyncResult> {
  const { db, fuente } = opts
  const fetchJson = opts.fetchJson ?? fetchJsonSocrata
  const log = opts.log ?? (() => {})
  const fuenteEstado = SECOP_FUENTE_ESTADO[fuente]
  const ahora = () => new Date()

  const ctx = await cargarContextoSecop(db)
  const entidades = Array.from(ctx.entidades).sort()
  const vigilados = Array.from(ctx.vigilados).sort()
  const estado = await leerEstadoFuente(db, fuenteEstado)
  const guardado = parseSecopCursor(estado?.cursor)
  // Entidades o proveedores que no estaban en la última pasada completa: su histórico entra en esta pasada.
  // Si es la primera vez que se registra la lista (cursor de antes de este cambio), se toma la actual.
  const completos = guardado.nits_completos ?? (guardado.ultima_pasada ? { entidades, proveedores: vigilados } : null)
  const tareasPara = (incremental: boolean) =>
    buildSecopTareas(entidades, vigilados, SECOP_TAREA_TAMANO_POR_FUENTE[fuente], incremental && completos ? { entidades: nitsNuevos(entidades, completos.entidades), proveedores: nitsNuevos(vigilados, completos.proveedores) } : null)
  const incrementalPrevisto = guardado.en_curso ? guardado.modo === 'incremental' : !opts.forzarInicial && Boolean(guardado.siguiente_desde)
  let tareas = tareasPara(incrementalPrevisto)
  let cursor = iniciarPasada({ ...guardado, nits_completos: completos }, { ahora: ahora(), huella: huellaTareas(fuente, tareas), forzarInicial: opts.forzarInicial })
  if ((cursor.modo === 'incremental') !== incrementalPrevisto) {
    tareas = tareasPara(cursor.modo === 'incremental')
    cursor = { ...cursor, huella: huellaTareas(fuente, tareas) }
  }
  log(
    `${fuente}: ${ctx.entidades.size} entidades objetivo, ${ctx.vigilados.size} proveedores vigilados, ${tareas.length} tareas` +
      `${tareas.some(t => t.historico) ? ` (${tareas.filter(t => t.historico).length} de histórico para NIT nuevos)` : ''} · ` +
      `${cursor.modo}${cursor.desde ? ` desde ${cursor.desde}` : ''} · tarea ${cursor.paso + 1}, offset ${cursor.offset}`
  )

  const mapCtx = { hashDocumento: (d: string) => hashDocumento(d, ctx.sal), hospitalPorNit: ctx.hospitalPorNit, vigilados: ctx.vigilados }
  const result: SecopSyncResult = {
    fuente,
    terminado: false,
    cursor,
    paginas: 0,
    leidas: 0,
    guardadas: 0,
    porAlcance: { vigilado: 0, linea: 0, especialidad: 0 },
    descartadas: 0,
    errores: 0,
    ejemplosError: [],
    atipicosMarcados: null,
    agotado: false,
    mensaje: '',
  }

  while (!pasadaTerminada(cursor, tareas.length)) {
    const restante = opts.deadline - Date.now()
    if (restante < MARGEN_PAGINA_MS) break
    if (opts.maxPaginas !== undefined && result.paginas >= opts.maxPaginas) break
    const tarea = tareas[cursor.paso]
    const url = buildSecopUrl(fuente, tarea, { modo: cursor.modo, desde: cursor.desde, offset: cursor.offset, limit: opts.pageSize })
    const t0 = Date.now()
    let data: unknown
    try {
      // En el script (sin límite) una consulta con prefiltro del Integrado puede tardar varios minutos
      data = await fetchJson(url, Math.min(Number.isFinite(opts.deadline) ? 180_000 : 600_000, restante - 5000))
    } catch (error) {
      const nombre = (error as { name?: string } | null)?.name
      if (!Number.isFinite(opts.deadline) || (nombre !== 'TimeoutError' && nombre !== 'AbortError')) throw error
      // La consulta no cupo en el tiempo de la función: se reintenta en la próxima invocación desde el mismo punto
      cursor = { ...cursor, agotados: cursor.agotados + 1 }
      result.agotado = true
      log(`  ${tarea.tipo}: la consulta tardó más que el tiempo disponible (${cursor.agotados} vez/veces seguidas)`)
      if (cursor.agotados >= SECOP_MAX_AGOTADOS) {
        throw new Error(
          `${fuente}: la tarea ${cursor.paso + 1} de ${tareas.length} (${tarea.tipo}${tarea.historico ? ', histórico' : ''}) no cabe en una invocación de 50 s ` +
            `${cursor.agotados} veces seguidas; correr una vez "npx tsx scripts/secop-load.ts --fuente ${fuente}" desde web/`
        )
      }
      break
    }
    if (!Array.isArray(data)) throw new Error(`datos.gov.co devolvió algo que no es una lista (${JSON.stringify(data).slice(0, 200)})`)
    const raws = data as SecopRaw[]

    const porId = new Map<string, SecopContratoRow>()
    let maxVisto: string | null = null
    for (const raw of raws) {
      const wm = watermarkDeFila(fuente, raw)
      if (wm && (!maxVisto || wm > maxVisto)) maxVisto = wm
      const mapped = mapSecopRow(fuente, raw, mapCtx)
      if ('error' in mapped) {
        result.errores++
        if (result.ejemplosError.length < 5) result.ejemplosError.push(mapped.error)
        continue
      }
      const alcance = decidirAlcance(mapped.row, ctx.entidades)
      if (!alcance) {
        result.descartadas++
        continue
      }
      result.porAlcance[alcance]++
      porId.set(mapped.row.id_contrato, mapped.row)
    }
    const filas = Array.from(porId.values())
    if (opts.dryRun && result.paginas === 0 && filas.length > 0) {
      // Solo dry-run: muestra de lo que se guardaría. En secop1 se ve el valor ADJUDICADO al contratista frente
      // al del proceso (se prefieren filas donde difieren); nunca el nombre ni el documento de una persona.
      const distintos = fuente === 'secop1' ? filas.filter(f => f.valor !== null && f.valor_proceso !== null && f.valor !== f.valor_proceso) : []
      for (const f of (distintos.length > 0 ? distintos : filas).slice(0, 3)) {
        const quien = f.es_persona ? 'persona natural (hash)' : `NIT ${f.documento_proveedor ?? '—'}`
        const valores =
          fuente === 'secop1'
            ? `adjudicado ${f.valor === null ? '—' : fmt(f.valor)} · proceso ${f.valor_proceso === null ? '—' : fmt(f.valor_proceso)}`
            : `valor ${f.valor === null ? '—' : fmt(f.valor)}`
        log(`    ejemplo: ${f.numero_contrato ?? f.id_contrato} · entidad ${f.nit_entidad} · ${quien} · ${valores} · ${f.linea}${f.especialidad_medico ? ` · ${f.especialidad_medico}` : ''}`)
      }
    }
    if (!opts.dryRun && filas.length > 0) await upsertContratos(db, filas, new Date().toISOString())

    cursor = registrarPagina(cursor, { filas: raws.length, limite: opts.pageSize, guardadas: filas.length, maxVisto, ahora: ahora() })
    result.paginas++
    result.leidas += raws.length
    result.guardadas += filas.length
    log(
      `  ${tarea.tipo} (${tarea.nits.length} NIT) · ${fmt(raws.length)} filas → ${fmt(filas.length)} guardadas · ${((Date.now() - t0) / 1000).toFixed(1)} s · ` +
        `tarea ${Math.min(cursor.paso + 1, tareas.length)}/${tareas.length}, offset ${cursor.offset}`
    )
    if (!opts.dryRun) {
      const { error } = await db
        .from('fuentes_estado')
        .update({
          cursor,
          estado: 'corriendo',
          mensaje: mensajeSecop({ ...result, cursor }, tareas.length),
          bloqueo_hasta: new Date(Date.now() + (opts.bloqueoMs ?? BLOQUEO_MS)).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('fuente', fuenteEstado)
      if (error) throw new Error(`fuentes_estado (${fuenteEstado}): ${error.message}`)
    }
  }

  if (pasadaTerminada(cursor, tareas.length)) {
    if (!opts.dryRun) {
      const { data, error } = await db.rpc('secop_marcar_atipicos')
      if (error) throw new Error(`secop_marcar_atipicos: ${error.message}`)
      result.atipicosMarcados = typeof data === 'number' ? data : null
    }
    cursor = cerrarPasada(cursor, { ahora: ahora(), solapeDias: SECOP_SOLAPE_DIAS[fuente], nits: { entidades, proveedores: vigilados } })
    result.terminado = true
  }
  result.cursor = cursor
  result.mensaje = mensajeSecop(result, tareas.length) + (result.agotado ? ' La última consulta de datos.gov.co no cupo en el tiempo de esta ejecución; se reintenta en la próxima.' : '')
  return result
}
