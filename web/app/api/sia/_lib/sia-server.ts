/**
 * SIA Observa · lógica de las rutas /api/sia/* (solo servidor). Vercel NO habla con SIA (corta conexiones fuera de
 * Colombia): aquí solo se lee y escribe Supabase. Cada manejador recibe el cliente `db` y devuelve { status, body }, así
 * se prueba con el Supabase falso de scripts/sia-observa-api-check.ts; las rutas ponen la sesión y el permiso.
 *
 * Permisos: ver (contratos de SIA de una IPS, documentos y su enlace firmado, diferencias) = contracts:view; importar,
 * descartar en la bandeja, pedir "Actualizar desde SIA" = contracts:edit. Si la migración 0930 no está aplicada, todo
 * responde 503 con { disponible: false } y la UI no pinta nada.
 */
import type { SupabaseAdminClient } from '@/lib/supabase-admin'
import { esNitJuridico, normalizeNit } from '@/lib/secop'
import {
  SIA_ENLACE_DIAS,
  SIA_IMPORTAR_MESES,
  codigoNorm,
  diasEntre,
  diferenciasConSia,
  hoyBogota,
  precargaDesdeSecop,
  precargaDesdeSia,
  siaDeEnlace,
  type ContratoActual,
  type SecopLeido,
  type SiaContratoLeido,
} from '@/lib/sia-observa/normalizar'
import { diferenciasConIa, precargaDesdeExtraccion, type DatosExtraccion } from '@/lib/sia-observa/extraccion'
import { TIPOS_DOCUMENTO } from '@/lib/sia-observa/tipos'
import { SIA_BUCKET } from '@/lib/sia-observa/sync'

export interface Respuesta {
  status: number
  body: unknown
}

/** Segundos de vida del enlace firmado a un PDF del bucket (spec: 10 minutos). */
export const ENLACE_SEGUNDOS = 600
const ok = (body: unknown): Respuesta => ({ status: 200, body })
const fallo = (status: number, error: string): Respuesta => ({ status, body: { error } })
export const SIN_MIGRACION: Respuesta = { status: 503, body: { disponible: false, error: 'SIA Observa todavía no está instalado (migración 0930 sin aplicar)' } }

export class TablaFaltante extends Error {}

function revisar<T>(r: { data: T | null; error: { code?: string; message: string } | null }, contexto: string): T {
  if (r.error) {
    if (r.error.code === 'PGRST205' || r.error.code === '42P01' || r.error.code === '42703') throw new TablaFaltante(contexto)
    throw new Error(`${contexto}: ${r.error.message}`)
  }
  return r.data as T
}

/** Todas las filas (PostgREST corta en 1.000): páginas de 1.000 hasta que una venga incompleta. */
async function todas(pagina: (desde: number) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>, contexto: string): Promise<unknown[]> {
  const out: unknown[] = []
  for (let desde = 0; ; desde += 1000) {
    const filas = revisar((await pagina(desde)) as { data: unknown[] | null; error: { code?: string; message: string } | null }, contexto) ?? []
    out.push(...filas)
    if (filas.length < 1000) return out
  }
}

/** Envuelve un manejador: la migración sin aplicar es 503, no 500. */
export async function conMigracion(fn: () => Promise<Respuesta>): Promise<Respuesta> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof TablaFaltante) return SIN_MIGRACION
    throw error
  }
}

export const COLS_SIA =
  'id, sia_idc, nit_entidad, hospital_id, codigo, codigo_norm, objeto, fecha_firma, fecha_inicio, fecha_fin, fecha_fin_ampliada, valor_inicial, adiciones, liberaciones, ' +
  'valor_vigente, modalidad, nit_contratista, contratista, linea, lineas, ficha_url, secop_contrato_id, secop_cruce, estado_revision, motivo_descarte, hospital_contract_id, alcance, ficha_leida_at, refrescar_solicitado_at'
const COLS_SECOP = 'id, fuente, nit_entidad, hospital_id, numero_contrato, referencia, documento_proveedor, proveedor_nombre, es_persona, objeto, modalidad, valor, fecha_firma, fecha_inicio, fecha_fin, linea, lineas, url'

type SiaFila = SiaContratoLeido & { codigo_norm: string | null; secop_cruce: string | null; estado_revision: string; motivo_descarte: string | null; hospital_contract_id: string | null; alcance: string; ficha_leida_at: string | null; refrescar_solicitado_at: string | null }
type SecopFila = SecopLeido & { fuente: string; nit_entidad: string }

function restarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1 - meses, Math.min(d, 28)))
  return fecha.toISOString().slice(0, 10)
}

const ORDEN_FUENTE: Record<string, number> = { secop2: 0, secop1: 1, integrado: 2 }
/** Una fila por contrato de SECOP (el mismo llega por secop2 y por el Integrado): se queda la de secop2. */
function unicosSecop(filas: SecopFila[]): SecopFila[] {
  const porClave = new Map<string, SecopFila>()
  for (const f of filas) {
    const clave = `${f.nit_entidad}|${f.numero_contrato ?? f.referencia ?? f.id}`
    const previo = porClave.get(clave)
    if (!previo || (ORDEN_FUENTE[f.fuente] ?? 9) < (ORDEN_FUENTE[previo.fuente] ?? 9)) porClave.set(clave, f)
  }
  return Array.from(porClave.values())
}

async function hospital(db: SupabaseAdminClient, id: string) {
  const data = revisar(await db.from('hospitals').select('id, name, nit, municipality_name').eq('id', id).maybeSingle(), 'hospitals')
  return data as { id: string; name: string; nit: string | null; municipality_name: string | null } | null
}

async function valoresSecop(db: SupabaseAdminClient, ids: string[]): Promise<Map<string, { id: string; valor: number | null; fuente: string; url: string | null }>> {
  if (ids.length === 0) return new Map()
  const data = revisar(await db.from('secop_contratos').select('id, valor, fuente, url').in('id', ids), 'secop_contratos') as Array<{ id: string; valor: number | null; fuente: string; url: string | null }>
  return new Map(data.map(s => [s.id, s]))
}

// ---------------------------------------------------------------------------------------------
// Contratos SIA de una IPS (ficha de la IPS)
// ---------------------------------------------------------------------------------------------

export async function contratosDeHospital(db: SupabaseAdminClient, hospitalId: string): Promise<Respuesta> {
  const h = await hospital(db, hospitalId)
  if (!h) return fallo(404, 'IPS no encontrada')
  if (!h.nit) return ok({ disponible: true, hospital: h, contratos: [] })
  const filas = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('nit_entidad', h.nit).order('fecha_firma', { ascending: false }).limit(200), 'sia_contratos') as unknown as SiaFila[]
  const secop = await valoresSecop(db, filas.map(f => f.secop_contrato_id).filter((x): x is string => Boolean(x)))
  return ok({
    disponible: true,
    hospital: h,
    contratos: filas.map(f => ({ ...f, secop: f.secop_contrato_id ? secop.get(f.secop_contrato_id) ?? null : null })),
  })
}

// ---------------------------------------------------------------------------------------------
// Importar: lista de una IPS y precarga del formulario
// ---------------------------------------------------------------------------------------------

export interface Importable {
  origen: 'sia' | 'secop'
  id: string
  codigo: string | null
  fecha_firma: string | null
  contratista: string | null
  valor: number | null
  linea: string
  objeto: string | null
  /** El de SIA cruza con este contrato de SECOP. */
  secop_id: string | null
}

async function idsSecopTomados(db: SupabaseAdminClient, nit: string): Promise<Set<string>> {
  const deSia = revisar(await db.from('sia_contratos').select('secop_contrato_id').eq('nit_entidad', nit).not('secop_contrato_id', 'is', null), 'sia_contratos') as Array<{ secop_contrato_id: string }>
  const descartes = (await todas(i => db.from('secop_descartes_bandeja').select('secop_contrato_id').order('secop_contrato_id').range(i, i + 999), 'secop_descartes_bandeja')) as Array<{ secop_contrato_id: string }>
  const enContratos = (await todas(i => db.from('hospital_contracts').select('secop_contrato_id').not('secop_contrato_id', 'is', null).order('id').range(i, i + 999), 'hospital_contracts')) as Array<{ secop_contrato_id: string }>
  return new Set([...deSia, ...descartes, ...enContratos].map(x => x.secop_contrato_id))
}

/** Contratos de SIA y de SECOP del NIT de la IPS en los últimos 24 meses que aún no están en Contratos; primero los de las líneas. */
export async function importablesDeHospital(db: SupabaseAdminClient, hospitalId: string, hoy = hoyBogota()): Promise<Respuesta> {
  const h = await hospital(db, hospitalId)
  if (!h) return fallo(404, 'IPS no encontrada')
  if (!h.nit) return ok({ hospital: h, contratos: [] })
  const desde = restarMeses(hoy, SIA_IMPORTAR_MESES)
  const sia = (revisar(await db.from('sia_contratos').select(COLS_SIA).eq('nit_entidad', h.nit).gte('fecha_firma', desde).is('hospital_contract_id', null).limit(500), 'sia_contratos') as unknown as SiaFila[]).filter(
    f => f.estado_revision !== 'descartado'
  )
  const tomados = await idsSecopTomados(db, h.nit)
  const secop = unicosSecop(
    revisar(await db.from('secop_contratos').select(COLS_SECOP).eq('nit_entidad', h.nit).eq('es_persona', false).gte('fecha_firma', desde).limit(2000), 'secop_contratos') as unknown as SecopFila[]
  ).filter(s => !tomados.has(s.id))
  // Un contrato de SECOP cruzado con el de SIA del mismo código no se repite aunque el cruce sea por otra fila (Integrado)
  const codigosSia = new Set(sia.map(f => f.codigo_norm).filter(Boolean))
  const lista: Importable[] = [
    ...sia.map(f => ({ origen: 'sia' as const, id: f.id, codigo: f.codigo, fecha_firma: f.fecha_firma, contratista: f.contratista, valor: f.valor_vigente ?? f.valor_inicial, linea: f.linea, objeto: f.objeto, secop_id: f.secop_contrato_id })),
    ...secop
      .filter(s => !codigosSia.has(codigoNorm(s.referencia)) && !codigosSia.has(codigoNorm(s.numero_contrato)))
      .map(s => ({ origen: 'secop' as const, id: s.id, codigo: s.referencia ?? s.numero_contrato, fecha_firma: s.fecha_firma, contratista: s.proveedor_nombre, valor: s.valor, linea: s.linea, objeto: s.objeto, secop_id: s.id })),
  ]
  lista.sort((a, b) => Number(a.linea === 'no_clasificado') - Number(b.linea === 'no_clasificado') || String(b.fecha_firma ?? '').localeCompare(String(a.fecha_firma ?? '')))
  return ok({ hospital: h, contratos: lista.slice(0, 100) })
}

async function ultimaExtraccion(db: SupabaseAdminClient, siaId: string) {
  const data = revisar(
    await db.from('contrato_extracciones').select('id, modelo, version_prompt, datos, discrepancias, created_at').eq('sia_contrato_id', siaId).order('created_at', { ascending: false }).limit(1),
    'contrato_extracciones'
  ) as Array<{ id: string; modelo: string; version_prompt: string; datos: DatosExtraccion; discrepancias: unknown; created_at: string }>
  return data[0] ?? null
}

/** proveedores.id con el mismo NIT (el campo nit de proveedores puede traer DV o puntos). */
async function proveedorPorNit(db: SupabaseAdminClient, nit: string | null): Promise<{ id: string; nombre: string } | null> {
  if (!nit || !esNitJuridico(nit)) return null
  const data = revisar(await db.from('proveedores').select('id, nit, nombre'), 'proveedores') as Array<{ id: string; nit: string | null; nombre: string }>
  const p = data.find(x => normalizeNit(x.nit) === nit)
  return p ? { id: p.id, nombre: p.nombre } : null
}

function resumenExtraccion(e: Awaited<ReturnType<typeof ultimaExtraccion>>) {
  if (!e) return null
  return { id: e.id, modelo: e.modelo, fecha: e.created_at, discrepancias: e.discrepancias, faltantes: e.datos.faltantes ?? [], fuentes: e.datos.fuentes ?? [], mercado: e.datos.mercado ?? null, contrato: e.datos.contrato ?? null }
}

/** Precarga del formulario desde un contrato de SIA o de SECOP (si el de SECOP cruza con uno de SIA, manda SIA). */
export async function precargaFormulario(db: SupabaseAdminClient, q: { siaId?: string | null; secopId?: string | null }): Promise<Respuesta> {
  let sia: SiaFila | null = null
  if (q.siaId) sia = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('id', q.siaId).maybeSingle(), 'sia_contratos') as SiaFila | null
  else if (q.secopId) {
    const cruzados = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('secop_contrato_id', q.secopId).limit(1), 'sia_contratos') as unknown as SiaFila[]
    sia = cruzados[0] ?? null
  }
  if (sia) {
    const valorSecop = sia.secop_contrato_id ? (await valoresSecop(db, [sia.secop_contrato_id])).get(sia.secop_contrato_id)?.valor ?? null : null
    const precarga = precargaDesdeSia(sia, { valorSecop })
    const extraccion = await ultimaExtraccion(db, sia.id)
    const indicadores = extraccion ? precargaDesdeExtraccion(extraccion.datos, sia.valor_inicial ?? sia.valor_vigente) : null
    return ok({ origen: 'sia', precarga, indicadores, extraccion: resumenExtraccion(extraccion), proveedor: await proveedorPorNit(db, sia.nit_contratista) })
  }
  if (!q.secopId) return fallo(400, 'Falta sia_id o secop_id')
  const secop = revisar(await db.from('secop_contratos').select(COLS_SECOP).eq('id', q.secopId).maybeSingle(), 'secop_contratos') as SecopFila | null
  if (!secop) return fallo(404, 'Contrato no encontrado')
  const precarga = precargaDesdeSecop(secop)
  return ok({ origen: 'secop', precarga, indicadores: null, extraccion: null, proveedor: await proveedorPorNit(db, precarga.proveedor_nit) })
}

/** Tras crear un contrato importado: el de SIA queda enlazado e "importado" (solo si nadie lo había enlazado). */
export async function marcarImportado(db: SupabaseAdminClient, siaId: string, hospitalContractId: string, usuarioId: string | null): Promise<void> {
  revisar(
    await db
      .from('sia_contratos')
      .update({ hospital_contract_id: hospitalContractId, estado_revision: 'importado', revisado_por: usuarioId, revisado_at: new Date().toISOString() })
      .eq('id', siaId)
      .is('hospital_contract_id', null),
    'sia_contratos'
  )
}

// ---------------------------------------------------------------------------------------------
// Un contrato de Contratos: su SIA, documentos, lectura de la IA y diferencias
// ---------------------------------------------------------------------------------------------

const COLS_HC = 'id, hospital_id, contract_number, contract_value, start_date, end_date, contracting_model, documents_link, sia_contrato_id, requires_liquidez, min_liquidez, requires_endeudamiento, max_endeudamiento, requires_capital_trabajo, min_capital_trabajo, custom_requirements'

async function siaDeContrato(db: SupabaseAdminClient, hc: ContratoActual & { id: string; hospital_id: string; sia_contrato_id: string | null }): Promise<SiaFila | null> {
  if (hc.sia_contrato_id) {
    const r = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('id', hc.sia_contrato_id).maybeSingle(), 'sia_contratos') as SiaFila | null
    if (r) return r
  }
  const enlace = siaDeEnlace(hc.documents_link)
  if (enlace) {
    const r = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('sia_idc', enlace.idc).maybeSingle(), 'sia_contratos') as SiaFila | null
    if (r) return r
  }
  const h = await hospital(db, hc.hospital_id)
  const norm = codigoNorm(hc.contract_number)
  if (!h?.nit || !norm) return null
  const porCodigo = revisar(await db.from('sia_contratos').select(COLS_SIA).eq('nit_entidad', h.nit).eq('codigo_norm', norm).limit(2), 'sia_contratos') as unknown as SiaFila[]
  // Por número solo si es inequívoco y del mismo periodo (los números se repiten entre años): misma regla que el enlace de la carga
  if (porCodigo.length !== 1) return null
  const inicio = porCodigo[0].fecha_inicio ?? porCodigo[0].fecha_firma
  const hcInicio = (hc as { start_date?: string | null }).start_date ?? null
  return inicio && hcInicio && Math.abs(diasEntre(hcInicio, inicio)) <= SIA_ENLACE_DIAS ? porCodigo[0] : null
}

export async function siaDeHospitalContract(db: SupabaseAdminClient, hcId: string): Promise<Respuesta> {
  const hc = revisar(await db.from('hospital_contracts').select(COLS_HC).eq('id', hcId).maybeSingle(), 'hospital_contracts') as (ContratoActual & { id: string; hospital_id: string; sia_contrato_id: string | null }) | null
  if (!hc) return fallo(404, 'Contrato no encontrado')
  const sia = await siaDeContrato(db, hc)
  if (!sia) return ok({ disponible: true, sia: null, documentos: [], extraccion: null, diferencias: [] })
  const documentos = revisar(
    await db.from('contrato_documentos').select('id, nombre_archivo, tipo, estado, fuente_url, fecha_cargue_sia, paginas, tiene_texto, bytes, descargado_at').eq('sia_contrato_id', sia.id),
    'contrato_documentos'
  ) as Array<{ tipo: string; nombre_archivo: string }>
  documentos.sort((a, b) => TIPOS_DOCUMENTO.indexOf(a.tipo as never) - TIPOS_DOCUMENTO.indexOf(b.tipo as never) || a.nombre_archivo.localeCompare(b.nombre_archivo))
  const extraccion = await ultimaExtraccion(db, sia.id)
  const diferencias = [
    ...diferenciasConSia(hc, sia),
    ...(extraccion ? diferenciasConIa(hc, precargaDesdeExtraccion(extraccion.datos, sia.valor_inicial ?? sia.valor_vigente)) : []),
  ]
  const refrescoPendiente = Boolean(sia.refrescar_solicitado_at && (!sia.ficha_leida_at || sia.refrescar_solicitado_at > sia.ficha_leida_at))
  return ok({ disponible: true, sia, documentos, extraccion: resumenExtraccion(extraccion), diferencias, refresco_pendiente: refrescoPendiente })
}

/** "Actualizar desde SIA": Vercel no llega a SIA; la próxima corrida del Mac relee la ficha y los documentos. */
export async function pedirActualizacion(db: SupabaseAdminClient, hcId: string): Promise<Respuesta> {
  const hc = revisar(await db.from('hospital_contracts').select(COLS_HC).eq('id', hcId).maybeSingle(), 'hospital_contracts') as (ContratoActual & { id: string; hospital_id: string; sia_contrato_id: string | null }) | null
  if (!hc) return fallo(404, 'Contrato no encontrado')
  const sia = await siaDeContrato(db, hc)
  if (!sia) return fallo(404, 'Este contrato no está enlazado con SIA Observa')
  revisar(await db.from('sia_contratos').update({ refrescar_solicitado_at: new Date().toISOString() }).eq('id', sia.id), 'sia_contratos')
  if (!hc.sia_contrato_id) revisar(await db.from('hospital_contracts').update({ sia_contrato_id: sia.id }).eq('id', hc.id).is('sia_contrato_id', null), 'hospital_contracts')
  return ok({
    ok: true,
    mensaje:
      'Pedido: la próxima carga nocturna de SIA (02:00, en el equipo del dueño) vuelve a leer este contrato en SIA (valores, adiciones, ' +
      'liberaciones y fechas), su ficha y sus documentos. Mañana las diferencias aparecen aquí para aprobar; nada cambia solo.',
  })
}

export async function enlaceDocumento(db: SupabaseAdminClient, docId: string): Promise<Respuesta> {
  const doc = revisar(await db.from('contrato_documentos').select('id, estado, storage_path, nombre_archivo').eq('id', docId).maybeSingle(), 'contrato_documentos') as { estado: string; storage_path: string | null; nombre_archivo: string } | null
  if (!doc) return fallo(404, 'Documento no encontrado')
  if (doc.estado !== 'descargado' || !doc.storage_path) return fallo(409, 'Este documento no tiene copia en OpMap: ábrelo en SIA')
  const { data, error } = await db.storage.from(SIA_BUCKET).createSignedUrl(doc.storage_path, ENLACE_SEGUNDOS, { download: doc.nombre_archivo })
  if (error || !data?.signedUrl) throw new Error(`storage: ${error?.message ?? 'sin enlace'}`)
  return ok({ url: data.signedUrl, expira_en: ENLACE_SEGUNDOS })
}

// ---------------------------------------------------------------------------------------------
// Bandeja /contracts/detectados
// ---------------------------------------------------------------------------------------------

export interface FiltrosDetectados {
  linea?: string | null
  kamId?: string | null
  desde?: string | null
  hasta?: string | null
}

export interface Detectado extends Importable {
  hospital_id: string | null
  hospital: string | null
  municipio: string | null
  zona: string | null
  ficha_url: string | null
}

export async function detectados(db: SupabaseAdminClient, f: FiltrosDetectados, hoy = hoyBogota()): Promise<Respuesta> {
  const desde = f.desde ?? restarMeses(hoy, SIA_IMPORTAR_MESES)
  let hospitalesZona: Set<string> | null = null
  if (f.kamId) {
    const asig = revisar(await db.from('assignments').select('hospital_id').eq('kam_id', f.kamId), 'assignments') as Array<{ hospital_id: string }>
    hospitalesZona = new Set(asig.map(a => a.hospital_id))
  }
  let qs = db.from('sia_contratos').select(COLS_SIA).eq('estado_revision', 'nuevo').is('hospital_contract_id', null).eq('alcance', 'linea').not('hospital_id', 'is', null).gte('fecha_firma', desde)
  if (f.hasta) qs = qs.lte('fecha_firma', f.hasta)
  if (f.linea) qs = qs.eq('linea', f.linea)
  const sia = (revisar(await qs.order('fecha_firma', { ascending: false }).limit(1000), 'sia_contratos') as unknown as SiaFila[]).filter(x => !hospitalesZona || hospitalesZona.has(x.hospital_id as string))

  const todosSia = (await todas(i => db.from('sia_contratos').select('secop_contrato_id, nit_entidad, codigo_norm').order('id').range(i, i + 999), 'sia_contratos')) as Array<{ secop_contrato_id: string | null; nit_entidad: string; codigo_norm: string | null }>
  const descartes = (await todas(i => db.from('secop_descartes_bandeja').select('secop_contrato_id').order('secop_contrato_id').range(i, i + 999), 'secop_descartes_bandeja')) as Array<{ secop_contrato_id: string }>
  const enContratos = (await todas(i => db.from('hospital_contracts').select('secop_contrato_id').not('secop_contrato_id', 'is', null).order('id').range(i, i + 999), 'hospital_contracts')) as Array<{ secop_contrato_id: string }>
  const tomados = new Set([...todosSia.map(x => x.secop_contrato_id), ...descartes.map(x => x.secop_contrato_id), ...enContratos.map(x => x.secop_contrato_id)].filter(Boolean) as string[])
  const codigosSia = new Set(todosSia.filter(x => x.codigo_norm).map(x => `${x.nit_entidad}|${x.codigo_norm}`))
  let qsec = db.from('secop_contratos').select(COLS_SECOP).neq('linea', 'no_clasificado').eq('es_persona', false).not('hospital_id', 'is', null).gte('fecha_firma', desde)
  if (f.hasta) qsec = qsec.lte('fecha_firma', f.hasta)
  if (f.linea) qsec = qsec.eq('linea', f.linea)
  const secop = unicosSecop(revisar(await qsec.order('fecha_firma', { ascending: false }).limit(3000), 'secop_contratos') as unknown as SecopFila[]).filter(
    s =>
      !tomados.has(s.id) &&
      !codigosSia.has(`${s.nit_entidad}|${codigoNorm(s.referencia)}`) &&
      !codigosSia.has(`${s.nit_entidad}|${codigoNorm(s.numero_contrato)}`) &&
      (!hospitalesZona || hospitalesZona.has(s.hospital_id as string))
  )
  // Contratos que ya están en Contratos con el mismo número en la misma IPS: no son "detectados"
  const hcs = (await todas(i => db.from('hospital_contracts').select('hospital_id, contract_number').order('id').range(i, i + 999), 'hospital_contracts')) as Array<{ hospital_id: string; contract_number: string | null }>
  const yaEnContratos = new Set(hcs.map(h => `${h.hospital_id}|${codigoNorm(h.contract_number)}`))

  const ids = Array.from(new Set([...sia.map(x => x.hospital_id), ...secop.map(x => x.hospital_id)].filter(Boolean) as string[]))
  const hospitales = new Map<string, { name: string; municipality_name: string | null }>()
  const zonas = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200)
    const hs = revisar(await db.from('hospitals').select('id, name, municipality_name').in('id', parte), 'hospitals') as Array<{ id: string; name: string; municipality_name: string | null }>
    for (const h of hs) hospitales.set(h.id, h)
    const asig = revisar(await db.from('assignments').select('hospital_id, kam_id').in('hospital_id', parte), 'assignments') as Array<{ hospital_id: string; kam_id: string }>
    const kamIds = Array.from(new Set(asig.map(a => a.kam_id)))
    const kams = kamIds.length ? (revisar(await db.from('kams').select('id, name').in('id', kamIds), 'kams') as Array<{ id: string; name: string }>) : []
    const nombreKam = new Map(kams.map(k => [k.id, k.name]))
    for (const a of asig) if (nombreKam.has(a.kam_id)) zonas.set(a.hospital_id, nombreKam.get(a.kam_id) as string)
  }
  const extra = (hospitalId: string | null) => ({
    hospital_id: hospitalId,
    hospital: hospitalId ? hospitales.get(hospitalId)?.name ?? null : null,
    municipio: hospitalId ? hospitales.get(hospitalId)?.municipality_name ?? null : null,
    zona: hospitalId ? zonas.get(hospitalId) ?? null : null,
  })
  const lista: Detectado[] = [
    ...sia
      .filter(x => !yaEnContratos.has(`${x.hospital_id}|${x.codigo_norm}`))
      .map(x => ({ origen: 'sia' as const, id: x.id, codigo: x.codigo, fecha_firma: x.fecha_firma, contratista: x.contratista, valor: x.valor_vigente ?? x.valor_inicial, linea: x.linea, objeto: x.objeto, secop_id: x.secop_contrato_id, ficha_url: x.ficha_url, ...extra(x.hospital_id) })),
    ...secop
      .filter(s => !yaEnContratos.has(`${s.hospital_id}|${codigoNorm(s.referencia)}`) && !yaEnContratos.has(`${s.hospital_id}|${codigoNorm(s.numero_contrato)}`))
      .map(s => ({ origen: 'secop' as const, id: s.id, codigo: s.referencia ?? s.numero_contrato, fecha_firma: s.fecha_firma, contratista: s.proveedor_nombre, valor: s.valor, linea: s.linea, objeto: s.objeto, secop_id: s.id, ficha_url: s.url, ...extra(s.hospital_id) })),
  ]
  lista.sort((a, b) => String(b.fecha_firma ?? '').localeCompare(String(a.fecha_firma ?? '')))
  return ok({ disponible: true, total: lista.length, contratos: lista.slice(0, 300), desde })
}

export async function descartarDetectado(db: SupabaseAdminClient, q: { siaId?: string | null; secopId?: string | null; motivo: string }, usuarioId: string | null): Promise<Respuesta> {
  const motivo = String(q.motivo ?? '').trim()
  if (motivo.length < 3) return fallo(400, 'Escribe el motivo del descarte')
  if (q.siaId) {
    const r = revisar(
      await db.from('sia_contratos').update({ estado_revision: 'descartado', motivo_descarte: motivo.slice(0, 500), revisado_por: usuarioId, revisado_at: new Date().toISOString() }).eq('id', q.siaId).is('hospital_contract_id', null).select('id'),
      'sia_contratos'
    ) as unknown[]
    return r.length > 0 ? ok({ ok: true }) : fallo(404, 'Contrato no encontrado o ya importado')
  }
  if (q.secopId) {
    revisar(await db.from('secop_descartes_bandeja').upsert({ secop_contrato_id: q.secopId, motivo: motivo.slice(0, 500), descartado_por: usuarioId, descartado_at: new Date().toISOString() }, { onConflict: 'secop_contrato_id' }), 'secop_descartes_bandeja')
    return ok({ ok: true })
  }
  return fallo(400, 'Falta sia_id o secop_id')
}
