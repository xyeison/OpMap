/**
 * SIA Observa · lectura de los documentos con Claude (Fase 3 de docs/specs/2026-10-29-agente-sia-observa.md). No habla con
 * SIA: lee los PDF del bucket privado contratos-sia. Necesita ANTHROPIC_API_KEY en web/.env.local (o una sesión de `ant auth
 * login`). CUESTA DINERO: cada contrato manda sus PDF (≈ 40 páginas en CD/26-1262); el lote nocturno (Batch API) cuesta la
 * mitad. --dry-run dice cuántos contratos y páginas irían sin llamar a la API.
 *
 * Qué contratos: los de sia_contratos con algún documento descargado de tipo contrato o estudio previo, sin lectura con la
 * versión de prompt vigente (VERSION_PROMPT), sin un lote en vuelo (ia_lote_id) y con menos de MAX_INTENTOS_IA intentos
 * (ia_intentos: cada intento cuesta; un rechazo o una respuesta sin la herramienta no se repite cada noche). Lo leído se sanea (sin cédulas ni nombres de personas), se compara con SIA
 * (discrepancias) y se guarda en contrato_extracciones. NADA pasa a hospital_contracts: eso lo aprueba una persona en la app.
 *
 * Uso (desde web/):
 *   npx tsx scripts/sia-extraer.ts --dry-run               → cuántos irían y cuántas páginas
 *   npx tsx scripts/sia-extraer.ts --directo --idc 12910254 → uno ya (con respaldo de modelo si hay rechazo)
 *   npx tsx scripts/sia-extraer.ts --lote [--max 20]        → crea un lote de la Batch API (anotado en sia_contratos.ia_lote_id)
 *   npx tsx scripts/sia-extraer.ts --recoger                → guarda los resultados de los lotes terminados
 */
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin, type SupabaseAdminClient } from '../lib/supabase-admin'
import {
  MODELO_EXTRACCION,
  ORDEN_TIPOS_IA,
  VERSION_PROMPT,
  construirSolicitud,
  elegirDocumentos,
  leerRespuesta,
  sanearExtraccion,
  validarContraSia,
  type DocumentoParaIA,
} from '../lib/sia-observa/extraccion'
import type { SiaContratoLeido } from '../lib/sia-observa/normalizar'
import { SIA_BUCKET } from '../lib/sia-observa/sync'
import type { TipoDocumento } from '../lib/sia-observa/tipos'
import { leerArgs, log } from './lib/sia-script'

/** Intentos por contrato (cada uno se paga); "Actualizar desde SIA" no los reinicia: se reinician a mano poniendo ia_intentos = 0. */
const MAX_INTENTOS_IA = 2
const COLS_CONTRATO = 'id, ia_intentos, sia_idc, nit_entidad, hospital_id, codigo, objeto, fecha_firma, fecha_inicio, fecha_fin, fecha_fin_ampliada, valor_inicial, adiciones, liberaciones, valor_vigente, modalidad, nit_contratista, contratista, linea, lineas, ficha_url, secop_contrato_id'

interface DocRow {
  id: string
  sia_contrato_id: string
  nombre_archivo: string
  tipo: TipoDocumento
  storage_path: string
  bytes: number
  paginas: number | null
}

async function pendientes(db: SupabaseAdminClient, opts: { idc?: number; max: number }) {
  let q = db.from('sia_contratos').select(COLS_CONTRATO).not('ficha_leida_at', 'is', null)
  if (opts.idc) q = q.eq('sia_idc', opts.idc)
  else q = q.is('ia_lote_id', null).lt('ia_intentos', MAX_INTENTOS_IA)
  const { data: contratos, error } = await q.order('fecha_firma', { ascending: false, nullsFirst: false }).limit(500)
  if (error) throw new Error(`sia_contratos: ${error.message}`)
  const out: Array<{ contrato: SiaContratoLeido; docs: DocRow[] }> = []
  for (const contrato of (contratos ?? []) as unknown as SiaContratoLeido[]) {
    if (out.length >= opts.max) break
    const { data: hechas } = await db.from('contrato_extracciones').select('id').eq('sia_contrato_id', contrato.id).eq('version_prompt', VERSION_PROMPT).limit(1)
    if ((hechas ?? []).length > 0 && !opts.idc) continue
    const { data: docs, error: e2 } = await db
      .from('contrato_documentos')
      .select('id, sia_contrato_id, nombre_archivo, tipo, storage_path, bytes, paginas')
      .eq('sia_contrato_id', contrato.id)
      .eq('estado', 'descargado')
    if (e2) throw new Error(`contrato_documentos: ${e2.message}`)
    const elegidos = elegirDocumentos(((docs ?? []) as DocRow[]).map(d => ({ ...d, bytes: Number(d.bytes ?? 0) })))
    if (!elegidos.some(d => d.tipo === 'contrato' || d.tipo === 'estudio_previo')) continue
    out.push({ contrato, docs: elegidos })
  }
  return out
}

async function cargarPdfs(db: SupabaseAdminClient, docs: DocRow[]): Promise<DocumentoParaIA[]> {
  const out: DocumentoParaIA[] = []
  for (const d of docs) {
    const { data, error } = await db.storage.from(SIA_BUCKET).download(d.storage_path)
    if (error || !data) throw new Error(`bucket ${d.storage_path}: ${error?.message ?? 'sin datos'}`)
    out.push({ id: d.id, nombre: d.nombre_archivo, tipo: d.tipo, paginas: d.paginas, base64: Buffer.from(await data.arrayBuffer()).toString('base64') })
  }
  return out.sort((a, b) => ORDEN_TIPOS_IA.indexOf(a.tipo) - ORDEN_TIPOS_IA.indexOf(b.tipo))
}

async function guardar(db: SupabaseAdminClient, contrato: SiaContratoLeido, documentoIds: string[], message: Parameters<typeof leerRespuesta>[0], modelo: string, loteId: string | null) {
  const r = leerRespuesta(message)
  if ('error' in r) {
    log(`  ${contrato.codigo} (idc ${contrato.sia_idc}): ${r.error}`)
    await db.from('sia_contratos').update({ ia_lote_id: null, ia_ultimo_error: r.error }).eq('id', contrato.id)
    return false
  }
  const datos = sanearExtraccion(r.datos)
  const discrepancias = validarContraSia(datos, contrato)
  const { error } = await db.from('contrato_extracciones').insert({
    sia_contrato_id: contrato.id,
    documento_ids: documentoIds,
    modelo,
    version_prompt: VERSION_PROMPT,
    lote_id: loteId,
    datos,
    items: datos.items,
    discrepancias,
    uso: r.uso,
  })
  if (error) throw new Error(`contrato_extracciones: ${error.message}`)
  await db.from('sia_contratos').update({ ia_lote_id: null, ia_ultimo_error: null }).eq('id', contrato.id)
  log(`  ${contrato.codigo} (idc ${contrato.sia_idc}): guardada · ${discrepancias.length} discrepancias con SIA · faltan ${datos.faltantes.length} campos`)
  return true
}

async function main() {
  const args = leerArgs(process.argv.slice(2), ['idc', 'max'], ['dry-run', 'directo', 'lote', 'recoger'])
  const db = getSupabaseAdmin()
  const max = typeof args.max === 'string' ? Number(args.max) : 20
  const idc = typeof args.idc === 'string' ? Number(args.idc) : undefined

  if (args.recoger) {
    const client = new Anthropic()
    const { data: enVuelo, error } = await db.from('sia_contratos').select('ia_lote_id').not('ia_lote_id', 'is', null)
    if (error) throw new Error(`sia_contratos: ${error.message}`)
    const lotes = Array.from(new Set((enVuelo ?? []).map(x => (x as { ia_lote_id: string }).ia_lote_id)))
    for (const loteId of lotes) {
      const batch = await client.messages.batches.retrieve(loteId)
      if (batch.processing_status !== 'ended') {
        log(`Lote ${loteId}: ${batch.processing_status}`)
        continue
      }
      for await (const resultado of await client.messages.batches.results(loteId)) {
        const { data } = await db.from('sia_contratos').select(COLS_CONTRATO).eq('id', resultado.custom_id).maybeSingle()
        if (!data) continue
        const contrato = data as unknown as SiaContratoLeido
        if (resultado.result.type !== 'succeeded') {
          log(`  ${contrato.codigo}: ${resultado.result.type}`)
          await db.from('sia_contratos').update({ ia_lote_id: null, ia_ultimo_error: `lote: ${resultado.result.type}` }).eq('id', contrato.id)
          continue
        }
        const { data: docs } = await db.from('contrato_documentos').select('id').eq('sia_contrato_id', contrato.id).eq('estado', 'descargado')
        await guardar(db, contrato, (docs ?? []).map(d => (d as { id: string }).id), resultado.result.message, resultado.result.message.model, loteId)
      }
      // Lo que el lote no devolvió (expirado o cancelado sin resultado) queda libre para el próximo
      await db.from('sia_contratos').update({ ia_lote_id: null }).eq('ia_lote_id', loteId)
    }
    return
  }

  const lista = await pendientes(db, { idc, max })
  const paginas = lista.reduce((s, x) => s + x.docs.reduce((t, d) => t + (d.paginas ?? 0), 0), 0)
  log(`${lista.length} contratos con documentos para leer · ${paginas} páginas en total · modelo ${MODELO_EXTRACCION} · ${VERSION_PROMPT}`)
  if (args['dry-run'] || lista.length === 0) return

  const client = new Anthropic()
  if (args.directo) {
    for (const { contrato, docs } of lista) {
      const params = construirSolicitud({ contrato, documentos: await cargarPdfs(db, docs) })
      await db.from('sia_contratos').update({ ia_intentos: ((contrato as { ia_intentos?: number }).ia_intentos ?? 0) + 1 }).eq('id', contrato.id)
      // Directo: con respaldo de servidor si el modelo rechaza (no existe en la Batch API)
      const message = await client.beta.messages
        .stream({ ...(params as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming), betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        .finalMessage()
      await guardar(db, contrato, docs.map(d => d.id), message, message.model, null)
    }
    return
  }
  if (args.lote) {
    const requests: Anthropic.Messages.Batches.BatchCreateParams.Request[] = []
    for (const { contrato, docs } of lista) {
      requests.push({ custom_id: contrato.id, params: construirSolicitud({ contrato, documentos: await cargarPdfs(db, docs) }) })
    }
    const batch = await client.messages.batches.create({ requests })
    for (const { contrato } of lista) {
      await db.from('sia_contratos').update({ ia_lote_id: batch.id, ia_intentos: ((contrato as { ia_intentos?: number }).ia_intentos ?? 0) + 1 }).eq('id', contrato.id)
    }
    log(`Lote ${batch.id} creado con ${requests.length} contratos; --recoger guarda los resultados cuando termine (suele tardar menos de 1 h)`)
    return
  }
  log('Elige --directo, --lote o --recoger (o --dry-run).')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
