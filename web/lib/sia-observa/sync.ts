/**
 * SIA Observa · carga en Supabase (solo scripts locales y servidor: usa node:crypto). La usa web/scripts/sia-load.ts en el
 * Mac del dueño (SIA corta conexiones fuera de Colombia). Spec: docs/specs/2026-10-29-agente-sia-observa.md, Fases 1 y 2.
 *
 * Tres pasos, cada uno reanudable:
 *   1. sincronizarContratos: por entidad (sia_entidades validadas de IPS públicas, primero las de más contratos de SECOP
 *      clasificados) y por ventana de un mes (60 días hacia atrás en el diario; desde --desde en el backfill): Get_CTOs_Base
 *      → mapFilaSia → upsert por sia_idc (nunca pisa estado_revision, motivo_descarte ni hospital_contract_id) → cruce con
 *      SECOP (elegirSecop) → enlace con hospital_contracts (idc del documents_link o el mismo código). El avance vive en
 *      fuentes_estado.cursor ('sia_observa'), una entidad a la vez.
 *   2. enlazarContratosConFicha: los hospital_contracts que ya traen la ficha de SIA (idc e ide): busca la fila por idc en
 *      las ventanas alrededor de start_date y la guarda aunque no clasifique (alcance 'enlazado'). Nada se sobrescribe en
 *      hospital_contracts salvo su nueva columna sia_contrato_id cuando está vacía; las diferencias se muestran para aprobar.
 *   3. procesarFichas: lee la ficha de los contratos con línea de IPS de OpMap (o con "Actualizar desde SIA" pedido), guarda
 *      la ficha sin personas y los documentos: los de tipo clave se copian al bucket privado contratos-sia; los demás se
 *      consultan una vez para saber su estado (PDF → solo_enlace; avisos → anonimizacion_pendiente o restringido).
 */
import { createHash } from 'node:crypto'
import type { SupabaseAdminClient } from '../supabase-admin'
import { CLASIFICACION_VERSION } from '../secop'
import { BLOQUEO_SCRIPT_MS, cerrarFuente, guardarCursor, leerEstadoFuente, tomarBloqueo } from '../fuentes-estado'
import type { SiaCliente } from './client'
import { TIPOS_CLAVE, clasificarRespuestaDocumento, fichaParaGuardar, parseFicha, type FichaDocumento } from './ficha'
import {
  SIA_FUENTE,
  SIA_VENTANA_DIAS,
  diasEntre,
  elegirSecop,
  emparejarConContratos,
  hoyBogota,
  idcDeFila,
  mapFilaSia,
  siaDeEnlace,
  sumarDias,
  ventanasMensuales,
  type ContratoParaEnlace,
  type SecopCandidato,
  type SiaContratoRow,
  type SiaParaEnlace,
  type SiaDescarte,
} from './normalizar'
import { analizarPdf } from './pdf'

export const SIA_BUCKET = 'contratos-sia'
const LOTE = 200

type Log = (mensaje: string) => void

export class SiaTablasFaltantes extends Error {
  constructor(detalle: string) {
    super(`Faltan las tablas de SIA (migración 2026-10-30_0920_sia_observa.sql sin aplicar): ${detalle}`)
    this.name = 'SiaTablasFaltantes'
  }
}

function falla(contexto: string, error: { message: string; code?: string } | null): never {
  if (error?.code === 'PGRST205' || error?.code === '42P01') throw new SiaTablasFaltantes(`${contexto}: ${error.message}`)
  throw new Error(`${contexto}: ${error?.message ?? 'error desconocido'}`)
}

// ---------------------------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------------------------

export interface SiaEntidad {
  guid: string
  nombre: string
  nit: string
  prioridad: number
}

export interface SiaContexto {
  /** NIT → IPS principal (secop_nits_ips, la misma regla que secop_contratos). */
  hospitalPorNit: Map<string, string>
  /** NIT de IPS activas que son entidad de compra pública. */
  publicas: Set<string>
  /** idc que ya están en hospital_contracts (documents_link). */
  idcEnlazados: Set<number>
}

export async function cargarContextoSia(db: SupabaseAdminClient): Promise<SiaContexto> {
  const hospitalPorNit = new Map<string, string>()
  const publicas = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.rpc('secop_nits_ips').range(from, from + 999)
    if (error) falla('secop_nits_ips', error)
    const rows = (data ?? []) as Array<{ nit: string; hospital_id: string; publica: boolean }>
    for (const row of rows) {
      if (!/^\d{9}$/.test(row.nit)) continue
      hospitalPorNit.set(row.nit, row.hospital_id)
      if (row.publica) publicas.add(row.nit)
    }
    if (rows.length < 1000) break
  }
  const idcEnlazados = new Set<number>()
  const { data: hcs, error } = await db.from('hospital_contracts').select('documents_link').ilike('documents_link', '%siaobserva%')
  if (error) falla('hospital_contracts', error)
  for (const hc of hcs ?? []) {
    const enlace = siaDeEnlace((hc as { documents_link: string | null }).documents_link)
    if (enlace) idcEnlazados.add(enlace.idc)
  }
  return { hospitalPorNit, publicas, idcEnlazados }
}

export async function entidadesASincronizar(db: SupabaseAdminClient, ctx: SiaContexto, soloGuid?: string): Promise<SiaEntidad[]> {
  let query = db.from('sia_entidades').select('guid, nombre, nit, prioridad').not('nit', 'is', null).not('validado_at', 'is', null)
  if (soloGuid) query = query.eq('guid', soloGuid)
  const { data, error } = await query.order('prioridad', { ascending: false }).order('nombre')
  if (error) falla('sia_entidades', error)
  return ((data ?? []) as SiaEntidad[]).filter(e => soloGuid || ctx.publicas.has(e.nit))
}

// ---------------------------------------------------------------------------------------------
// 1. Contratos
// ---------------------------------------------------------------------------------------------

export interface ConteoEntidad {
  filas: number
  guardadas: number
  descartes: Record<SiaDescarte, number>
  cruces: number
  enlaces: number
}

export function conteoVacio(): ConteoEntidad {
  return { filas: 0, guardadas: 0, descartes: { persona: 0, sin_linea: 0, sin_contratista: 0, error: 0 }, cruces: 0, enlaces: 0 }
}

/** Lee las ventanas de una entidad, guarda lo que entra y cruza con SECOP y hospital_contracts. */
export async function sincronizarEntidad(
  db: SupabaseAdminClient,
  cliente: SiaCliente,
  entidad: SiaEntidad,
  ventanas: Array<{ desde: string; hasta: string }>,
  ctx: SiaContexto,
  opts: { dryRun?: boolean; log?: Log; buscarIdc?: number } = {}
): Promise<ConteoEntidad & { encontrado: boolean }> {
  const log = opts.log ?? (() => {})
  const conteo = conteoVacio()
  const rows = new Map<number, SiaContratoRow>()
  let encontrado = false
  for (const ventana of ventanas) {
    const { total, filas } = await cliente.getContratosEntidad(entidad.guid, ventana.desde, ventana.hasta)
    // El cliente ya quitó las filas de personas naturales (ni la caché las guarda): solo se cuentan
    conteo.filas += total ?? filas.length
    conteo.descartes.persona += Math.max(0, (total ?? filas.length) - filas.length)
    for (const raw of filas) {
      const r = mapFilaSia(raw, { entidadGuid: entidad.guid, hospitalPorNit: ctx.hospitalPorNit, idcEnlazados: ctx.idcEnlazados, clasificacionVersion: CLASIFICACION_VERSION })
      if ('descarte' in r) {
        conteo.descartes[r.descarte]++
        if (r.descarte === 'error') log(`  ${entidad.nombre}: fila ilegible (${r.detalle})`)
        continue
      }
      rows.set(r.row.sia_idc, r.row)
      if (opts.buscarIdc === r.row.sia_idc) encontrado = true
    }
    if (opts.buscarIdc !== undefined && encontrado) break
  }
  conteo.guardadas = rows.size
  if (opts.dryRun || rows.size === 0) return { ...conteo, encontrado }

  const lista = Array.from(rows.values())
  for (let i = 0; i < lista.length; i += LOTE) {
    const { error } = await db.from('sia_contratos').upsert(lista.slice(i, i + LOTE), { onConflict: 'sia_idc' })
    if (error) falla('sia_contratos (upsert)', error)
  }
  const cruce = await cruzarConSecop(db, entidad.nit, lista)
  conteo.cruces = cruce
  conteo.enlaces = await enlazarHospitalContracts(db, entidad.nit, lista.map(r => r.sia_idc))
  return { ...conteo, encontrado }
}

/** secop_contrato_id de cada contrato (misma entidad, código; desempate por contratista y firma). Devuelve los cruces. */
export async function cruzarConSecop(db: SupabaseAdminClient, nit: string, rows: SiaContratoRow[]): Promise<number> {
  const firmas = rows.map(r => r.fecha_firma).filter((f): f is string => Boolean(f)).sort()
  if (firmas.length === 0) return 0
  const { data, error } = await db
    .from('secop_contratos')
    .select('id, fuente, numero_contrato, referencia, proceso, documento_proveedor, fecha_firma, valor')
    .eq('nit_entidad', nit)
    .gte('fecha_firma', sumarDias(firmas[0], -30))
    .lte('fecha_firma', sumarDias(firmas[firmas.length - 1], 30))
    .limit(5000)
  if (error) falla('secop_contratos', error)
  const candidatos = (data ?? []) as SecopCandidato[]
  const { data: actuales, error: e2 } = await db.from('sia_contratos').select('id, sia_idc, secop_contrato_id, secop_cruce').in('sia_idc', rows.map(r => r.sia_idc))
  if (e2) falla('sia_contratos', e2)
  const porIdc = new Map((actuales ?? []).map(a => [Number((a as { sia_idc: number }).sia_idc), a as { id: string; secop_contrato_id: string | null; secop_cruce: string | null }]))
  let cruces = 0
  for (const row of rows) {
    const elegido = elegirSecop(row, candidatos)
    const actual = porIdc.get(row.sia_idc)
    if (!actual) continue
    if (elegido) cruces++
    const id = elegido?.secopId ?? null
    const via = elegido?.via ?? null
    if (actual.secop_contrato_id === id && actual.secop_cruce === via) continue
    const { error: e3 } = await db.from('sia_contratos').update({ secop_contrato_id: id, secop_cruce: via }).eq('id', actual.id)
    if (e3) falla('sia_contratos (cruce)', e3)
  }
  return cruces
}

/**
 * Enlaza con hospital_contracts de las IPS del mismo NIT (emparejarConContratos: idc del documents_link, o número inequívoco
 * con inicio a ±180 días). Escribe solo lo vacío: hospital_contracts.sia_contrato_id; sia_contratos.hospital_contract_id y
 * estado 'importado'.
 */
export async function enlazarHospitalContracts(db: SupabaseAdminClient, nit: string, idcs: number[]): Promise<number> {
  if (idcs.length === 0) return 0
  const { data: hospitales, error } = await db.from('hospitals').select('id').eq('nit', nit)
  if (error) falla('hospitals', error)
  const ids = (hospitales ?? []).map(h => (h as { id: string }).id)
  if (ids.length === 0) return 0
  const { data: hcs, error: e2 } = await db.from('hospital_contracts').select('id, contract_number, documents_link, start_date, sia_contrato_id').in('hospital_id', ids)
  if (e2) falla('hospital_contracts', e2)
  const { data: sias, error: e3 } = await db.from('sia_contratos').select('id, sia_idc, codigo_norm, fecha_inicio, fecha_firma, hospital_contract_id, estado_revision').in('sia_idc', idcs)
  if (e3) falla('sia_contratos', e3)
  const filas = (sias ?? []) as Array<SiaParaEnlace & { hospital_contract_id: string | null; estado_revision: string | null }>
  const contratos = (hcs ?? []) as ContratoParaEnlace[]
  const parejas = emparejarConContratos(filas, contratos)
  for (const { siaId, hcId } of parejas) {
    const sia = filas.find(f => f.id === siaId) as (typeof filas)[number]
    const hc = contratos.find(h => h.id === hcId) as ContratoParaEnlace
    if (!sia.hospital_contract_id) {
      const patch: Record<string, unknown> = { hospital_contract_id: hc.id }
      if ((sia.estado_revision ?? 'nuevo') === 'nuevo') patch.estado_revision = 'importado'
      const { error: e4 } = await db.from('sia_contratos').update(patch).eq('id', sia.id)
      if (e4) falla('sia_contratos (enlace)', e4)
    }
    if (!hc.sia_contrato_id) {
      const { error: e5 } = await db.from('hospital_contracts').update({ sia_contrato_id: sia.id }).eq('id', hc.id).is('sia_contrato_id', null)
      if (e5) falla('hospital_contracts (enlace)', e5)
    }
  }
  return parejas.length
}

// ---------------------------------------------------------------------------------------------
// Pasada con cursor (fuentes_estado 'sia_observa')
// ---------------------------------------------------------------------------------------------

export interface SiaCursor {
  pasada: { inicio: string; desde: string; hasta: string; entidades: string[]; indice: number; guardadas: number; personas: number; sin_linea: number; cruces: number; enlaces: number; errores?: string[] } | null
  ultima_pasada?: { fin: string; desde: string; hasta: string; entidades: number; guardadas: number; personas: number; sin_linea: number; cruces: number; enlaces: number }
  /** Otras claves que alguien guarde en el cursor: se conservan tal cual. */
  [otra: string]: unknown
}

export function parseSiaCursor(value: unknown): SiaCursor {
  const c = (value && typeof value === 'object' ? value : {}) as Partial<SiaCursor>
  const p = c.pasada
  const ok = p && typeof p === 'object' && Array.isArray(p.entidades) && typeof p.indice === 'number' && typeof p.desde === 'string' && typeof p.hasta === 'string'
  return { ...c, pasada: ok ? (p as NonNullable<SiaCursor['pasada']>) : null, ultima_pasada: c.ultima_pasada }
}

export interface SincronizarOpciones {
  db: SupabaseAdminClient
  cliente: SiaCliente
  log?: Log
  /** 'YYYY-MM-DD': backfill desde esa fecha (por defecto, la ventana móvil de 60 días). */
  desde?: string
  hoy?: string
  soloGuid?: string
  maxEntidades?: number
  dryRun?: boolean
  /** Empezar una pasada nueva aunque haya una a medias. */
  reiniciar?: boolean
}

export interface ResultadoSync {
  terminado: boolean
  entidades: number
  guardadas: number
  mensaje: string
}

async function renovarBloqueo(db: SupabaseAdminClient) {
  const { error } = await db
    .from('fuentes_estado')
    .update({ bloqueo_hasta: new Date(Date.now() + BLOQUEO_SCRIPT_MS).toISOString() })
    .eq('fuente', SIA_FUENTE)
  if (error) falla('fuentes_estado', error)
}

export function mensajePasada(p: { entidades: number; guardadas: number; personas: number; sin_linea: number; cruces: number; enlaces: number }, terminado: boolean): string {
  return (
    `${terminado ? 'Pasada completa' : 'Pasada a medias'}: ${p.entidades} entidades, ${p.guardadas} contratos de empresas con línea guardados ` +
    `(${p.personas} de personas naturales y ${p.sin_linea} sin línea, descartados sin guardar), ${p.cruces} cruzan con SECOP, ${p.enlaces} enlazados con Contratos.`
  )
}

/** Paso 1 con bloqueo y cursor. Sin límite de tiempo (script local); guarda el avance tras cada entidad. */
export async function sincronizarContratos(opts: SincronizarOpciones): Promise<ResultadoSync> {
  const { db, cliente } = opts
  const log = opts.log ?? (() => {})
  const hoy = opts.hoy ?? hoyBogota()
  const ctx = await cargarContextoSia(db)
  const entidades = await entidadesASincronizar(db, ctx, opts.soloGuid)
  if (opts.dryRun) {
    let guardadas = 0
    for (const entidad of entidades.slice(0, opts.maxEntidades ?? entidades.length)) {
      const r = await sincronizarEntidad(db, cliente, entidad, ventanasMensuales(opts.desde ?? sumarDias(hoy, -SIA_VENTANA_DIAS), hoy), ctx, { dryRun: true, log })
      guardadas += r.guardadas
      log(`  ${entidad.nombre}: ${r.filas} filas → ${r.guardadas} entrarían (${r.descartes.persona} personas, ${r.descartes.sin_linea} sin línea)`)
    }
    return { terminado: true, entidades: entidades.length, guardadas, mensaje: `Simulación: ${guardadas} contratos entrarían` }
  }

  const tomado = await tomarBloqueo(db, SIA_FUENTE, new Date(), BLOQUEO_SCRIPT_MS)
  if (!tomado) return { terminado: false, entidades: 0, guardadas: 0, mensaje: 'Otra corrida de SIA tiene el bloqueo (fuentes_estado.bloqueo_hasta): intenta más tarde.' }
  try {
    const estado = await leerEstadoFuente(db, SIA_FUENTE)
    let cursor = parseSiaCursor(estado?.cursor)
    const desde = opts.desde ?? sumarDias(hoy, -SIA_VENTANA_DIAS)
    if (!cursor.pasada || opts.reiniciar || cursor.pasada.desde !== desde) {
      cursor = { ...cursor, pasada: { inicio: new Date().toISOString(), desde, hasta: hoy, entidades: entidades.map(e => e.guid), indice: 0, guardadas: 0, personas: 0, sin_linea: 0, cruces: 0, enlaces: 0 } }
    }
    const pasada = cursor.pasada as NonNullable<SiaCursor['pasada']>
    const porGuid = new Map(entidades.map(e => [e.guid, e]))
    const ventanas = ventanasMensuales(pasada.desde, pasada.hasta)
    let hechas = 0
    while (pasada.indice < pasada.entidades.length && (opts.maxEntidades === undefined || hechas < opts.maxEntidades)) {
      const entidad = porGuid.get(pasada.entidades[pasada.indice])
      if (entidad) {
        try {
          const r = await sincronizarEntidad(db, cliente, entidad, ventanas, ctx, { log })
          pasada.guardadas += r.guardadas
          pasada.personas += r.descartes.persona
          pasada.sin_linea += r.descartes.sin_linea
          pasada.cruces += r.cruces
          pasada.enlaces += r.enlaces
          log(`  ${entidad.nombre} (${entidad.nit}): ${r.filas} filas · ${r.guardadas} guardadas · ${r.cruces} con SECOP · ${r.enlaces} enlazadas`)
        } catch (error) {
          // Una entidad que falla (portal caído para ella, respuesta enorme) no frena a las demás; la migración sin aplicar sí aborta
          if (error instanceof SiaTablasFaltantes) throw error
          const detalle = error instanceof Error ? error.message : String(error)
          pasada.errores = [...(pasada.errores ?? []), `${entidad.nombre}: ${detalle}`.slice(0, 200)].slice(-20)
          log(`  ${entidad.nombre} (${entidad.nit}): ERROR ${detalle}`)
        }
      }
      pasada.indice++
      hechas++
      await guardarCursor(db, SIA_FUENTE, cursor as unknown as Record<string, unknown>, mensajePasada({ ...pasada, entidades: pasada.indice }, false))
      await renovarBloqueo(db)
    }
    const terminado = pasada.indice >= pasada.entidades.length
    const resumen = { entidades: pasada.indice, guardadas: pasada.guardadas, personas: pasada.personas, sin_linea: pasada.sin_linea, cruces: pasada.cruces, enlaces: pasada.enlaces }
    const errores = pasada.errores ?? []
    const mensaje = mensajePasada(resumen, terminado) + (errores.length > 0 ? ` ${errores.length} entidades con error (se reintentan mañana): ${errores.slice(0, 5).join(' | ')}` : '')
    const nuevo: SiaCursor = terminado ? { ...cursor, pasada: null, ultima_pasada: { fin: new Date().toISOString(), desde: pasada.desde, hasta: pasada.hasta, ...resumen } } : cursor
    await cerrarFuente(db, SIA_FUENTE, { estado: terminado ? 'ok' : 'corriendo', filas: pasada.guardadas, mensaje, cursor: nuevo as unknown as Record<string, unknown> })
    return { terminado, entidades: pasada.indice, guardadas: pasada.guardadas, mensaje }
  } catch (error) {
    const mensaje = `Error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 1500)
    await cerrarFuente(db, SIA_FUENTE, { estado: 'error', filas: null, mensaje }).catch(() => {})
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// 2. hospital_contracts que ya traen la ficha (backfill de los 53)
// ---------------------------------------------------------------------------------------------

/** Meses a revisar alrededor de start_date, del más cercano al más lejano (6 meses antes, 1 después). */
export function ventanasAlrededor(inicio: string, hoy: string): Array<{ desde: string; hasta: string }> {
  const desde = sumarDias(inicio, -186)
  const hasta = sumarDias(inicio, 31) < hoy ? sumarDias(inicio, 31) : hoy
  return ventanasMensuales(desde, hasta).sort((a, b) => Math.abs(diasEntre(a.desde, inicio)) - Math.abs(diasEntre(b.desde, inicio)))
}

export async function enlazarContratosConFicha(opts: { db: SupabaseAdminClient; cliente: SiaCliente; log?: Log; hoy?: string; dryRun?: boolean }): Promise<{ revisados: number; encontrados: number; faltan: string[] }> {
  const { db, cliente } = opts
  const log = opts.log ?? (() => {})
  const hoy = opts.hoy ?? hoyBogota()
  const ctx = await cargarContextoSia(db)
  const { data, error } = await db
    .from('hospital_contracts')
    .select('id, contract_number, start_date, documents_link, hospital_id, hospitals(name, nit)')
    .ilike('documents_link', '%siaobserva%')
  if (error) falla('hospital_contracts', error)
  const faltan: string[] = []
  let encontrados = 0
  const lista = (data ?? []) as unknown as Array<{ id: string; contract_number: string | null; start_date: string; documents_link: string; hospitals: { name: string; nit: string | null } | null }>
  for (const hc of lista) {
    const enlace = siaDeEnlace(hc.documents_link)
    const nit = hc.hospitals?.nit ?? null
    if (!enlace || !enlace.ide || !nit) {
      faltan.push(`${hc.contract_number ?? hc.id}: enlace sin ide o IPS sin NIT`)
      continue
    }
    const { data: ya } = await db.from('sia_contratos').select('id').eq('sia_idc', enlace.idc).limit(1)
    if ((ya ?? []).length > 0) {
      encontrados++
      if (!opts.dryRun) await enlazarHospitalContracts(db, nit, [enlace.idc])
      continue
    }
    if (!opts.dryRun) {
      const { error: e2 } = await db
        .from('sia_entidades')
        .upsert({ guid: enlace.ide, nombre: hc.hospitals?.name ?? 'Entidad de SIA', nit, hospital_id: ctx.hospitalPorNit.get(nit) ?? null, origen: 'contratos' }, { onConflict: 'guid', ignoreDuplicates: true })
      if (e2) falla('sia_entidades', e2)
    }
    const entidad: SiaEntidad = { guid: enlace.ide, nombre: hc.hospitals?.name ?? '', nit, prioridad: 0 }
    const r = await sincronizarEntidad(db, cliente, entidad, ventanasAlrededor(hc.start_date, hoy), ctx, { log, buscarIdc: enlace.idc, dryRun: opts.dryRun })
    if (r.encontrado) {
      encontrados++
      log(`  ${hc.contract_number} (idc ${enlace.idc}): encontrado`)
    } else {
      faltan.push(`${hc.contract_number ?? hc.id} (idc ${enlace.idc}): no apareció en Get_CTOs_Base de ${hc.start_date} −6/+1 meses (¿persona natural o fecha muy distinta?)`)
    }
  }
  return { revisados: lista.length, encontrados, faltan }
}

// ---------------------------------------------------------------------------------------------
// 3. Fichas y documentos
// ---------------------------------------------------------------------------------------------

export interface ResultadoFichas {
  fichas: number
  documentos: number
  descargados: number
  porEstado: Record<string, number>
  errores: number
}

interface ContratoParaFicha {
  id: string
  sia_idc: number
  nit_entidad: string
  entidad_guid: string
  fecha_firma: string | null
  ficha_url: string
  ficha_leida_at: string | null
  refrescar_solicitado_at: string | null
  ficha_intentos: number | null
}

/** Lecturas fallidas de una ficha antes de dejarla (hasta que alguien pida "Actualizar desde SIA"). */
export const MAX_INTENTOS_FICHA = 3

export async function contratosParaFicha(db: SupabaseAdminClient, limite: number): Promise<ContratoParaFicha[]> {
  const cols = 'id, sia_idc, nit_entidad, entidad_guid, fecha_firma, ficha_url, ficha_leida_at, refrescar_solicitado_at, ficha_intentos'
  const { data: pedidos, error } = await db.from('sia_contratos').select(cols).not('refrescar_solicitado_at', 'is', null).limit(500)
  if (error) falla('sia_contratos', error)
  const refrescar = ((pedidos ?? []) as ContratoParaFicha[]).filter(c => !c.ficha_leida_at || (c.refrescar_solicitado_at as string) > c.ficha_leida_at)
  const { data: nuevos, error: e2 } = await db
    .from('sia_contratos')
    .select(cols)
    .is('ficha_leida_at', null)
    .not('hospital_id', 'is', null)
    .lt('ficha_intentos', MAX_INTENTOS_FICHA)
    .order('fecha_firma', { ascending: false, nullsFirst: false })
    .limit(limite)
  if (e2) falla('sia_contratos', e2)
  const vistos = new Set<string>()
  return [...refrescar, ...((nuevos ?? []) as ContratoParaFicha[])].filter(c => !vistos.has(c.id) && Boolean(vistos.add(c.id))).slice(0, Math.max(limite, refrescar.length))
}

export function rutaStorage(nitEntidad: string, idc: number, sha256: string): string {
  return `${nitEntidad}/${idc}/${sha256}.pdf`
}

/** Un documento: lo consulta, y si es de tipo clave y PDF lo copia al bucket. Devuelve la fila para contrato_documentos. */
async function procesarDocumento(db: SupabaseAdminClient, cliente: SiaCliente, contrato: ContratoParaFicha, doc: FichaDocumento) {
  const base = {
    sia_contrato_id: contrato.id,
    nombre_archivo: doc.nombre,
    tipo: doc.tipo,
    ianx: doc.ianx,
    ianxa: doc.ianxa,
    fuente_url: doc.url,
    fecha_cargue_sia: doc.fechaCargue,
    revisado_at: new Date().toISOString(),
  }
  let descarga
  try {
    descarga = await cliente.descargarDocumento(doc.url, { referer: contrato.ficha_url })
  } catch (error) {
    return { ...base, estado: 'error', error: (error instanceof Error ? error.message : String(error)).slice(0, 500), storage_path: null, sha256: null }
  }
  const r = clasificarRespuestaDocumento(descarga.status, descarga.contentType, descarga.bytes)
  if (r.estado !== 'pdf') return { ...base, estado: r.estado, error: r.estado === 'error' ? r.detalle : null, storage_path: null, sha256: null, bytes: null }
  const sha256 = createHash('sha256').update(descarga.bytes).digest('hex')
  const info = await analizarPdf(descarga.bytes)
  const comun = { ...base, error: null, sha256, bytes: descarga.bytes.length, paginas: info.paginas, tiene_texto: info.tieneTexto }
  if (!TIPOS_CLAVE.includes(doc.tipo)) return { ...comun, estado: 'solo_enlace', storage_path: null, sha256: null }
  const ruta = rutaStorage(contrato.nit_entidad, contrato.sia_idc, sha256)
  const { error } = await db.storage.from(SIA_BUCKET).upload(ruta, Buffer.from(descarga.bytes), { contentType: 'application/pdf', upsert: true })
  if (error) return { ...comun, estado: 'error', error: `bucket: ${error.message}`.slice(0, 500), storage_path: null, sha256: null }
  return { ...comun, estado: 'descargado', storage_path: ruta, descargado_at: new Date().toISOString() }
}

/**
 * "Actualizar desde SIA": vuelve a pedir a Get_CTOs_Base el mes de la firma del contrato para traer valores, adiciones,
 * liberaciones y fechas nuevos (la ventana diaria solo cubre 60 días). Se guarda aunque ya no clasifique (alcance enlazado).
 */
async function releerFila(db: SupabaseAdminClient, cliente: SiaCliente, contrato: ContratoParaFicha, ctx: SiaContexto): Promise<boolean> {
  if (!contrato.fecha_firma) return false
  const [y, m] = contrato.fecha_firma.split('-').map(Number)
  const desde = `${contrato.fecha_firma.slice(0, 7)}-01`
  const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const hasta = finMes < hoyBogota() ? finMes : hoyBogota()
  const { filas } = await cliente.getContratosEntidad(contrato.entidad_guid, desde, hasta)
  const raw = filas.find(f => idcDeFila(f) === Number(contrato.sia_idc))
  if (!raw) return false
  const r = mapFilaSia(raw, { entidadGuid: contrato.entidad_guid, hospitalPorNit: ctx.hospitalPorNit, idcEnlazados: new Set([Number(contrato.sia_idc)]), clasificacionVersion: CLASIFICACION_VERSION })
  if (!('row' in r)) return false
  const { error } = await db.from('sia_contratos').upsert(r.row, { onConflict: 'sia_idc' })
  if (error) falla('sia_contratos (relectura)', error)
  return true
}

export async function procesarFichas(opts: { db: SupabaseAdminClient; cliente: SiaCliente; limite: number; log?: Log }): Promise<ResultadoFichas> {
  const { db, cliente } = opts
  const log = opts.log ?? (() => {})
  const contratos = await contratosParaFicha(db, opts.limite)
  const res: ResultadoFichas = { fichas: 0, documentos: 0, descargados: 0, porEstado: {}, errores: 0 }
  let ctx: SiaContexto | null = null
  for (const contrato of contratos) {
    const refresco = Boolean(contrato.refrescar_solicitado_at && (!contrato.ficha_leida_at || contrato.refrescar_solicitado_at > contrato.ficha_leida_at))
    try {
      if (refresco) {
        ctx = ctx ?? (await cargarContextoSia(db))
        const releida = await releerFila(db, cliente, contrato, ctx)
        log(`  ${contrato.sia_idc}: valores ${releida ? 'releídos de Get_CTOs_Base' : 'no encontrados en el mes de la firma (quedan los anteriores)'}`)
      }
      const html = await cliente.getFicha(contrato.sia_idc)
      const ficha = parseFicha(html)
      const { data: existentes, error } = await db.from('contrato_documentos').select('ianx, ianxa, estado').eq('sia_contrato_id', contrato.id)
      if (error) falla('contrato_documentos', error)
      const previo = new Map(((existentes ?? []) as Array<{ ianx: number; ianxa: number; estado: string }>).map(d => [`${d.ianx}:${d.ianxa}`, d.estado]))
      for (const doc of ficha.documentos) {
        const estadoPrevio = previo.get(`${doc.ianx}:${doc.ianxa}`)
        // Ya resuelto: no se vuelve a pedir (descargado, solo enlace o restringido). La anonimización se reintenta solo si piden actualizar.
        if (estadoPrevio && estadoPrevio !== 'error' && !(refresco && estadoPrevio === 'anonimizacion_pendiente')) continue
        const fila = await procesarDocumento(db, cliente, contrato, doc)
        const { error: e2 } = await db.from('contrato_documentos').upsert(fila, { onConflict: 'sia_contrato_id,ianx,ianxa' })
        if (e2) falla('contrato_documentos (upsert)', e2)
        res.documentos++
        res.porEstado[fila.estado] = (res.porEstado[fila.estado] ?? 0) + 1
        if (fila.estado === 'descargado') res.descargados++
      }
      const { error: e3 } = await db
        .from('sia_contratos')
        .update({ ficha: fichaParaGuardar(ficha), ficha_leida_at: new Date().toISOString(), ficha_intentos: 0, ficha_error: null })
        .eq('id', contrato.id)
      if (e3) falla('sia_contratos (ficha)', e3)
      res.fichas++
      log(`  ficha ${contrato.sia_idc}: ${ficha.documentos.length} documentos, ${ficha.novedades.length} novedades`)
    } catch (error) {
      // Una ficha que falla no frena a las demás; tras MAX_INTENTOS_FICHA se deja (hasta que alguien pida actualizar)
      if (error instanceof SiaTablasFaltantes) throw error
      const detalle = (error instanceof Error ? error.message : String(error)).slice(0, 500)
      res.errores++
      log(`  ficha ${contrato.sia_idc}: ERROR ${detalle}`)
      const patch: Record<string, unknown> = { ficha_intentos: (contrato.ficha_intentos ?? 0) + 1, ficha_error: detalle }
      // Un refresco que falla no se repite cada noche: queda "leída" con el error a la vista
      if (refresco) patch.ficha_leida_at = new Date().toISOString()
      await db.from('sia_contratos').update(patch).eq('id', contrato.id)
    }
  }
  return res
}
