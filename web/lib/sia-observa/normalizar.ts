/**
 * SIA Observa (Auditoría General de la República) · lógica PURA: sin red, sin base de datos, sin node:*. La usan el
 * script local (scripts/sia-load.ts, lib/sia-observa/sync.ts), las rutas /api/sia/* y el formulario de contratos.
 * Pruebas: scripts/sia-observa-check.ts. Spec: docs/specs/2026-10-29-agente-sia-observa.md.
 *
 * Qué hay aquí:
 *   1. Lectura de los campos de Get_CTOs_Base (dinero "$65,504,160.00", fechas "yyyy/mm/dd", idc de "cto(n)",
 *      contratistas con espacios y varios por fila en consorcios) y el código normalizado (CD/26-1262 → CD261262).
 *   2. mapFilaSia: una fila → fila de sia_contratos, o el motivo por el que NO se guarda. Personas naturales: nada
 *      (ni nombre ni documento; en un consorcio mixto solo quedan las empresas). Línea: el clasificador de SECOP.
 *   3. Cruce con SECOP (elegirSecop): misma entidad + código; desempate por NIT del contratista y firma ±7 días.
 *   4. Enlace con hospital_contracts (idc del documents_link, o el número del contrato) y sus diferencias.
 *   5. Precarga del formulario /contracts/new/edit desde SIA o SECOP, y modelo de contratación.
 */
import { clasificarContrato, cleanText, esNitJuridico, normalizeNit, normalizeText, type SecopLinea, type SecopLineaProducto } from '../secop'

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

export const SIA_BASE_URL = 'https://siaobserva.auditoria.gov.co'
export const SIA_FUENTE = 'sia_observa'
/** Ficha pública del contrato (portal de invitado). */
export const SIA_FICHA_PATH = '/guess/cto_ficha_resumen_guess.aspx'
/** Ventana móvil del sync diario: 60 días hacia atrás, partida en meses. */
export const SIA_VENTANA_DIAS = 60
/** Desempate del cruce con SECOP: firma a ±7 días. */
export const SIA_CRUCE_DIAS = 7
/** Lo que se consulta para importar: los últimos 24 meses. */
export const SIA_IMPORTAR_MESES = 24

export function fichaUrl(idc: number): string {
  return `${SIA_BASE_URL}${SIA_FICHA_PATH}?idc=${idc}`
}

// ---------------------------------------------------------------------------------------------
// 1. Campos de Get_CTOs_Base
// ---------------------------------------------------------------------------------------------

/** Fila cruda de Get_CTOs_Base (aaData[i]): 24 campos, todos texto. */
export type SiaFilaRaw = Record<string, unknown>

/** Texto sin espacios de más; null si vacío. */
export function siaTexto(value: unknown, max = 4000): string | null {
  return cleanText(value, max)
}

/**
 * Pesos desde el texto de SIA: "$65,504,160.00" (coma de miles, punto decimal, como lo verificó el dueño). También
 * acepta "65.504.160,00" (formato colombiano) por si alguna entidad lo trae así, y números. null si no es dinero.
 */
export function siaDinero(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
  let text = String(value).replace(/[$\s]/g, '').replace(/COP/i, '')
  if (!text) return null
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(text) || /^-?\d+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, '')
  } else if (/^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.')
  } else {
    return null
  }
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n >= 1e16) return null
  return Math.round(n * 100) / 100
}

/** 'YYYY-MM-DD' desde "yyyy/mm/dd" (SIA), "yyyy-mm-dd" o "dd/mm/yyyy"; null si no es una fecha válida de 1990–2100. */
export function siaFecha(value: unknown): string | null {
  const text = String(value ?? '').trim()
  let y: string, m: string, d: string
  let match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(text)
  if (match) {
    ;[, y, m, d] = match
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)
    if (!match) return null
    ;[, d, m, y] = match
  }
  const year = Number(y)
  if (year < 1990 || year > 2100) return null
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null
  return iso
}

/** "2024/02/12 07:03:21 PM" (hora de Colombia) → ISO con -05:00. null si no se reconoce. */
export function siaFechaHora(value: unknown): string | null {
  const text = String(value ?? '').trim()
  const match = /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/.exec(text)
  if (!match) return null
  const fecha = siaFecha(`${match[1]}/${match[2]}/${match[3]}`)
  if (!fecha) return null
  let hora = Number(match[4])
  const ampm = match[7]?.toUpperCase()
  if (ampm === 'PM' && hora < 12) hora += 12
  if (ampm === 'AM' && hora === 12) hora = 0
  if (hora > 23) return null
  return `${fecha}T${String(hora).padStart(2, '0')}:${match[5]}:${match[6] ?? '00'}-05:00`
}

/** idc desde DT_RowId ("cto(12910254)") o desde el botón de detalle ("…?idc=12910254"). */
export function idcDeFila(raw: SiaFilaRaw): number | null {
  const fromRow = /\((\d{1,12})\)/.exec(String(raw.DT_RowId ?? ''))
  const fromBoton = /idc=(\d{1,12})/.exec(String(raw.cto_boton_detalle ?? ''))
  const text = fromRow?.[1] ?? fromBoton?.[1]
  if (!text) return null
  const n = Number(text)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Código normalizado: mayúsculas, sin espacios, "/", "-", "." ni "_" (CD/26-1262 y CD-26-1262 → CD261262). */
export function codigoNorm(value: unknown): string | null {
  const text = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s/\-._]+/g, '')
  return text ? text : null
}

/** Partes de un campo con varios valores (consorcios): "<br>", ";", "|", saltos de línea o " / " con espacios. */
export function separarLista(value: unknown): string[] {
  return String(value ?? '')
    .split(/<br\s*\/?>|[;|\n\r]+|\s+\/\s+/i)
    .map(part => part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export interface SiaContratista {
  /** NIT de 9 dígitos sin DV (solo empresas; null en personas). */
  nit: string | null
  nombre: string | null
  tipo: string | null
  esEmpresa: boolean
}

/**
 * Contratistas de la fila. Empresa = NIT de persona jurídica (9 dígitos que empieza por 8 o 9, la regla de SECOP:
 * esNitJuridico) y un tipo que no dice "natural". Todo lo demás es persona natural: nunca se devuelve su nombre ni su
 * documento (nit y nombre en null), solo que existe.
 */
export function leerContratistas(nitsRaw: unknown, nombresRaw: unknown, tiposRaw: unknown): SiaContratista[] {
  const nits = separarLista(nitsRaw)
  const nombres = separarLista(nombresRaw)
  const tipos = separarLista(tiposRaw)
  const total = Math.max(nits.length, nombres.length)
  // Listas desalineadas (p. ej. NIT separados y nombres en un solo texto): emparejar por posición podría pegarle el nombre de
  // una persona a la empresa. Entonces solo se confía en el NIT y no se guarda ningún nombre.
  const alineados = nits.length === nombres.length
  const tiposAlineados = tipos.length === total
  const out: SiaContratista[] = []
  for (let i = 0; i < total; i++) {
    const tipo = tiposAlineados ? tipos[i] : null
    const nit = normalizeNit(nits[i] ?? null)
    const tipoNatural = /natural/.test(normalizeText(tipo))
    const esEmpresa = !tipoNatural && esNitJuridico(nit)
    out.push(esEmpresa ? { nit, nombre: alineados ? siaTexto(nombres[i] ?? null, 300) : null, tipo: siaTexto(tipo, 80), esEmpresa } : { nit: null, nombre: null, tipo: null, esEmpresa: false })
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// 2. Fila → sia_contratos
// ---------------------------------------------------------------------------------------------

/** 'linea' = el objeto clasifica en una línea; 'enlazado' = ya está en hospital_contracts (se guarda aunque no clasifique). */
export type SiaAlcance = 'linea' | 'enlazado'

/** Fila lista para sia_contratos (sin id ni columnas de revisión, que la carga nunca pisa). */
export interface SiaContratoRow {
  sia_idc: number
  entidad_guid: string
  nit_entidad: string
  nombre_entidad: string | null
  hospital_id: string | null
  anio: number | null
  codigo: string | null
  codigo_norm: string | null
  objeto: string | null
  fecha_firma: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  fecha_fin_ampliada: string | null
  dias: number | null
  valor_inicial: number | null
  adiciones: number | null
  liberaciones: number | null
  valor_vigente: number | null
  modalidad: string | null
  tipologia: string | null
  tipo_contrato: string | null
  nit_contratista: string
  contratista: string | null
  tipo_contratista: string | null
  /** Solo empresas (consorcios: todas las empresas de la fila). */
  contratistas: Array<{ nit: string; nombre: string | null }>
  linea: SecopLinea
  lineas: SecopLineaProducto[]
  clasificacion_version: string
  alcance: SiaAlcance
  estado_sia: string | null
  fecha_creacion_sia: string | null
  ficha_url: string
  raw: Record<string, unknown>
}

export interface SiaMapContexto {
  entidadGuid: string
  /** NIT de 9 dígitos → IPS principal de OpMap (misma regla que secop_contratos: función secop_nits_ips). */
  hospitalPorNit?: ReadonlyMap<string, string>
  /** idc que se guardan aunque no clasifiquen (ya están en hospital_contracts). */
  idcEnlazados?: ReadonlySet<number>
  clasificacionVersion: string
}

export type SiaDescarte = 'persona' | 'sin_linea' | 'sin_contratista' | 'error'
export type SiaMapResultado = { row: SiaContratoRow } | { descarte: SiaDescarte; detalle?: string }

/** Campos de la fila que pueden traer datos de personas: se reescriben con solo las empresas antes de guardar `raw`. */
const CAMPOS_CONTRATISTA = ['cto_nit_contratistas', 'cto_contratistas', 'cto_tipo_contratistas'] as const

export function mapFilaSia(raw: SiaFilaRaw, ctx: SiaMapContexto): SiaMapResultado {
  const idc = idcDeFila(raw)
  if (idc === null) return { descarte: 'error', detalle: `sin idc (DT_RowId=${String(raw.DT_RowId)})` }
  const nitEntidad = normalizeNit(raw.entidad_nit)
  if (!nitEntidad) return { descarte: 'error', detalle: `NIT de entidad ilegible (${String(raw.entidad_nit)})` }

  const contratistas = leerContratistas(raw.cto_nit_contratistas, raw.cto_contratistas, raw.cto_tipo_contratistas)
  if (contratistas.length === 0) return { descarte: 'sin_contratista' }
  const empresas = contratistas.filter(c => c.esEmpresa) as Array<SiaContratista & { nit: string }>
  // Personas naturales: nada se guarda (ni la fila ni un hash: el dueño no quiere datos de médicos de SIA)
  if (empresas.length === 0) return { descarte: 'persona' }

  const objeto = siaTexto(raw.cto_objeto)
  const enlazado = ctx.idcEnlazados?.has(idc) ?? false
  const clasificacion = clasificarContrato(objeto, null)
  if (clasificacion.linea === 'no_clasificado' && !enlazado) return { descarte: 'sin_linea' }

  const anio = Number(String(raw.cto_anio ?? '').trim())
  const dias = Number(String(raw.cto_dias_termino ?? '').replace(/[^\d]/g, ''))
  const codigo = siaTexto(raw.cto_code, 200)
  const limpio: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'cto_boton_detalle') continue
    limpio[key] = typeof value === 'string' ? value.trim() : value
  }
  limpio.cto_nit_contratistas = empresas.map(e => e.nit).join('; ')
  limpio.cto_contratistas = empresas.map(e => e.nombre ?? '').join('; ')
  limpio.cto_tipo_contratistas = empresas.map(e => e.tipo ?? '').join('; ')
  if (empresas.length < contratistas.length) limpio.personas_omitidas = contratistas.length - empresas.length
  for (const campo of CAMPOS_CONTRATISTA) if (!(campo in limpio)) limpio[campo] = ''

  return {
    row: {
      sia_idc: idc,
      entidad_guid: ctx.entidadGuid,
      nit_entidad: nitEntidad,
      nombre_entidad: siaTexto(raw.entidad_razon_social, 300),
      hospital_id: ctx.hospitalPorNit?.get(nitEntidad) ?? null,
      anio: Number.isInteger(anio) && anio >= 1990 && anio <= 2100 ? anio : null,
      codigo,
      codigo_norm: codigoNorm(codigo),
      objeto,
      fecha_firma: siaFecha(raw.cto_fecha_firma),
      fecha_inicio: siaFecha(raw.cto_fecha_inicio),
      fecha_fin: siaFecha(raw.cto_fecha_termino),
      fecha_fin_ampliada: siaFecha(raw.cto_fecha_ampliada),
      dias: Number.isInteger(dias) && dias > 0 && dias < 40000 ? dias : null,
      valor_inicial: siaDinero(raw.cto_valor),
      adiciones: siaDinero(raw.cto_adiciones),
      liberaciones: siaDinero(raw.cto_liberaciones),
      valor_vigente: siaDinero(raw.cto_valor_vigente),
      modalidad: siaTexto(raw.cto_proc, 200),
      tipologia: siaTexto(raw.cto_tipol, 200),
      tipo_contrato: siaTexto(raw.cto_tipologia_tipo, 200),
      nit_contratista: empresas[0].nit,
      contratista: empresas.map(e => e.nombre).filter(Boolean).join(' · ') || null,
      tipo_contratista: empresas[0].tipo,
      contratistas: empresas.map(e => ({ nit: e.nit, nombre: e.nombre })),
      linea: clasificacion.linea,
      lineas: clasificacion.lineas,
      clasificacion_version: ctx.clasificacionVersion,
      alcance: clasificacion.linea === 'no_clasificado' ? 'enlazado' : 'linea',
      estado_sia: siaTexto(raw.cto_estado, 80),
      fecha_creacion_sia: siaFechaHora(raw.cto_fecha_creacion),
      ficha_url: fichaUrl(idc),
      raw: limpio,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Ventanas de consulta
// ---------------------------------------------------------------------------------------------

export interface SiaVentana {
  desde: string
  hasta: string
}

/** Ventanas de un mes calendario (la primera y la última recortadas al rango), en orden. Fechas 'YYYY-MM-DD'. */
export function ventanasMensuales(desde: string, hasta: string): SiaVentana[] {
  if (!siaFecha(desde) || !siaFecha(hasta) || desde > hasta) return []
  const out: SiaVentana[] = []
  let cursor = desde
  while (cursor <= hasta) {
    const [y, m] = cursor.split('-').map(Number)
    const finMes = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const fin = finMes < hasta ? finMes : hasta
    out.push({ desde: cursor, hasta: fin })
    cursor = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
  }
  return out
}

/** 'YYYY-MM-DD' → 'YYYY/MM/DD' (formato del datepicker de SIA). */
export function fechaParaSia(iso: string): string {
  return iso.replace(/-/g, '/')
}

export function sumarDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10)
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Fecha de hoy en Bogotá (UTC − 5). */
export function hoyBogota(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------------------------
// 3. Cruce con SECOP
// ---------------------------------------------------------------------------------------------

/** Lo que se lee de secop_contratos para cruzar (misma entidad). */
export interface SecopCandidato {
  id: string
  fuente: string
  numero_contrato: string | null
  referencia: string | null
  proceso: string | null
  documento_proveedor: string | null
  fecha_firma: string | null
  valor: number | null
}

export type SiaCruceVia = 'codigo' | 'contratista_fecha'

export interface SiaCruce {
  secopId: string
  via: SiaCruceVia
  valorSecop: number | null
}

const ORDEN_FUENTE: Record<string, number> = { secop2: 0, secop1: 1, integrado: 2 }

function cercaDeFirma(a: string | null, b: string | null, dias = SIA_CRUCE_DIAS): boolean {
  return Boolean(a && b && Math.abs(diasEntre(a, b)) <= dias)
}

/** Con un solo contrato que casa por código basta el mismo contratista o una firma a ±60 días (los códigos tipo "061" se repiten cada año). */
export const SIA_CRUCE_CODIGO_DIAS = 60

/** Identidad del contrato en SECOP (el mismo contrato llega por secop2 y por el Integrado). */
function claveSecop(c: SecopCandidato): string {
  return c.numero_contrato ?? c.referencia ?? c.id
}

/** El mejor: el del mismo contratista (en SECOP I la constancia se repite por contratista), luego por fuente (secop2 > secop1 >
 * integrado) y luego la firma más cercana. */
function mejor(candidatos: SecopCandidato[], firma: string | null, nitContratista: string): SecopCandidato {
  return [...candidatos].sort((a, b) => {
    const ca = a.documento_proveedor === nitContratista ? 0 : 1
    const cb = b.documento_proveedor === nitContratista ? 0 : 1
    if (ca !== cb) return ca - cb
    const fa = ORDEN_FUENTE[a.fuente] ?? 9
    const fb = ORDEN_FUENTE[b.fuente] ?? 9
    if (fa !== fb) return fa - fb
    const da = a.fecha_firma && firma ? Math.abs(diasEntre(a.fecha_firma, firma)) : 9999
    const dbb = b.fecha_firma && firma ? Math.abs(diasEntre(b.fecha_firma, firma)) : 9999
    return da - dbb
  })[0]
}

/**
 * Contrato de SECOP que corresponde al de SIA, entre los de la MISMA entidad. Regla (spec, Fase 1.6):
 *   1. Código: codigo_norm igual al de la referencia, el número o el proceso de SECOP (en SECOP II el código de la
 *      entidad, "CD/26-1262", va en `referencia`). Un solo contrato que casa debe además ser del mismo contratista o
 *      firmado a ±60 días (los códigos cortos se repiten cada año). Si casan varios, desempata el NIT del contratista y
 *      la firma a ±7 días; si aun así quedan varios, no hay cruce (mejor nada que uno equivocado).
 *   2. Sin código que case: mismo NIT de contratista + firma a ±7 días + mismo valor inicial (±1 %), y un solo
 *      contrato que cumpla.
 * Entre filas del mismo contrato (secop2 e Integrado) se prefiere secop2.
 */
export function elegirSecop(
  sia: Pick<SiaContratoRow, 'codigo_norm' | 'nit_contratista' | 'fecha_firma' | 'valor_inicial'>,
  candidatos: readonly SecopCandidato[]
): SiaCruce | null {
  const agrupar = (lista: SecopCandidato[]) => {
    const grupos = new Map<string, SecopCandidato[]>()
    for (const c of lista) grupos.set(claveSecop(c), [...(grupos.get(claveSecop(c)) ?? []), c])
    return Array.from(grupos.values())
  }
  if (sia.codigo_norm) {
    const porCodigo = candidatos.filter(c => [c.referencia, c.numero_contrato, c.proceso].some(v => codigoNorm(v) === sia.codigo_norm))
    let grupos = agrupar(porCodigo)
    if (grupos.length > 1) {
      grupos = grupos.filter(g => g.some(c => c.documento_proveedor === sia.nit_contratista && cercaDeFirma(c.fecha_firma, sia.fecha_firma)))
    } else if (grupos.length === 1) {
      grupos = grupos.filter(g => g.some(c => c.documento_proveedor === sia.nit_contratista || cercaDeFirma(c.fecha_firma, sia.fecha_firma, SIA_CRUCE_CODIGO_DIAS)))
    }
    if (grupos.length === 1) {
      const elegido = mejor(grupos[0], sia.fecha_firma, sia.nit_contratista)
      return { secopId: elegido.id, via: 'codigo', valorSecop: elegido.valor }
    }
    if (grupos.length > 1) return null
  }
  const porContratista = candidatos.filter(
    c =>
      c.documento_proveedor === sia.nit_contratista &&
      cercaDeFirma(c.fecha_firma, sia.fecha_firma) &&
      c.valor !== null &&
      sia.valor_inicial !== null &&
      Math.abs(c.valor - sia.valor_inicial) <= Math.max(1, sia.valor_inicial * 0.01)
  )
  const grupos = agrupar(porContratista)
  if (grupos.length !== 1) return null
  const elegido = mejor(grupos[0], sia.fecha_firma, sia.nit_contratista)
  return { secopId: elegido.id, via: 'contratista_fecha', valorSecop: elegido.valor }
}

// ---------------------------------------------------------------------------------------------
// 4. hospital_contracts: enlace y diferencias
// ---------------------------------------------------------------------------------------------

/** idc e ide (GUID de la entidad) del PRIMER enlace a la ficha de SIA dentro de documents_link (puede traer más enlaces). */
export function siaDeEnlace(link: unknown): { idc: number; ide: string | null } | null {
  const text = String(link ?? '')
  const match = /siaobserva\.auditoria\.gov\.co\/guess\/cto_ficha_resumen_guess\.aspx\?([^\s;,"'<>]+)/i.exec(text)
  if (!match) return null
  const params = new URLSearchParams(match[1])
  const idc = Number(params.get('idc'))
  if (!Number.isSafeInteger(idc) || idc <= 0) return null
  const ide = (params.get('ide') ?? '').toLowerCase()
  return { idc, ide: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ide) ? ide : null }
}

/** Lo que el enlace con hospital_contracts necesita de cada lado. */
export interface SiaParaEnlace {
  id: string
  sia_idc: number
  codigo_norm: string | null
  fecha_inicio: string | null
  fecha_firma: string | null
}
export interface ContratoParaEnlace {
  id: string
  contract_number: string | null
  documents_link: string | null
  start_date: string | null
  sia_contrato_id: string | null
}

/** Por número, el inicio del contrato guardado y el de SIA no pueden distar más de esto (los números se repiten entre años). */
export const SIA_ENLACE_DIAS = 180

/**
 * Parejas SIA ↔ Contratos de las IPS del mismo NIT. Primero el idc del documents_link (lo puso una persona). Después el
 * número, solo si es inequívoco: un único contrato guardado con ese número (sin enlace a otra ficha de SIA ni otro contrato
 * de SIA ya enlazado), un único contrato de SIA con ese número y el inicio a ±180 días. Un contrato guardado nunca queda
 * con dos contratos de SIA.
 */
export function emparejarConContratos(sias: readonly SiaParaEnlace[], hcs: readonly ContratoParaEnlace[]): Array<{ siaId: string; hcId: string; via: 'enlace' | 'codigo' }> {
  const out: Array<{ siaId: string; hcId: string; via: 'enlace' | 'codigo' }> = []
  const usados = new Set<string>()
  const libre = (hc: ContratoParaEnlace, siaId: string) => !usados.has(hc.id) && (hc.sia_contrato_id === null || hc.sia_contrato_id === siaId)
  const pendientes: SiaParaEnlace[] = []
  for (const sia of sias) {
    const hc = hcs.find(h => siaDeEnlace(h.documents_link)?.idc === Number(sia.sia_idc) && libre(h, sia.id))
    if (hc) {
      usados.add(hc.id)
      out.push({ siaId: sia.id, hcId: hc.id, via: 'enlace' })
    } else pendientes.push(sia)
  }
  for (const sia of pendientes) {
    if (!sia.codigo_norm || sias.filter(x => x.codigo_norm === sia.codigo_norm).length !== 1) continue
    const candidatos = hcs.filter(h => codigoNorm(h.contract_number) === sia.codigo_norm && !siaDeEnlace(h.documents_link) && libre(h, sia.id))
    if (candidatos.length !== 1) continue
    const inicioSia = sia.fecha_inicio ?? sia.fecha_firma
    const hc = candidatos[0]
    if (!inicioSia || !hc.start_date || Math.abs(diasEntre(hc.start_date, inicioSia)) > SIA_ENLACE_DIAS) continue
    usados.add(hc.id)
    out.push({ siaId: sia.id, hcId: hc.id, via: 'codigo' })
  }
  return out
}

export type ModeloContratacion = 'contratacion_directa' | 'licitacion' | 'invitacion_privada' | 'subasta_inversa'

/** Modelo del formulario desde la modalidad de SIA o SECOP: subasta → subasta_inversa; licitación; invitación; si no, directa. */
export function modeloContratacion(modalidad: unknown): ModeloContratacion {
  const texto = normalizeText(modalidad)
  if (/\bsubasta/.test(texto)) return 'subasta_inversa'
  if (/\blicitacion/.test(texto)) return 'licitacion'
  if (/\binvitacion/.test(texto)) return 'invitacion_privada'
  return 'contratacion_directa'
}

/** Meses del plazo (redondeados) entre inicio y fin; null si falta alguna fecha. */
export function mesesEntre(inicio: string | null, fin: string | null): number | null {
  if (!inicio || !fin || fin < inicio) return null
  return Math.max(1, Math.round((diasEntre(inicio, fin) + 1) / 30.44))
}

/** Lo que el formulario de contratos recibe al importar (mismas columnas de hospital_contracts). */
export interface PrecargaContrato {
  hospital_id: string | null
  contract_number: string
  current_provider: string
  contract_value: number
  contract_type: 'evento'
  contracting_model: ModeloContratacion
  start_date: string | null
  end_date: string | null
  duration_months: number | null
  description: string
  documents_link: string
  sia_contrato_id: string | null
  secop_contrato_id: string | null
  lineas: string[]
  /** Para mostrar al lado del valor (no se guarda): el valor de SECOP cuando difiere del vigente de SIA. */
  valor_secop: number | null
  /** NIT del proveedor (para casarlo con `proveedores` en el formulario). */
  proveedor_nit: string | null
}

/** Fila de sia_contratos tal como la leen las rutas (con id). */
export type SiaContratoLeido = Pick<
  SiaContratoRow,
  | 'sia_idc'
  | 'nit_entidad'
  | 'hospital_id'
  | 'codigo'
  | 'objeto'
  | 'fecha_firma'
  | 'fecha_inicio'
  | 'fecha_fin'
  | 'fecha_fin_ampliada'
  | 'valor_inicial'
  | 'adiciones'
  | 'liberaciones'
  | 'valor_vigente'
  | 'modalidad'
  | 'nit_contratista'
  | 'contratista'
  | 'linea'
  | 'lineas'
  | 'ficha_url'
> & { id: string; secop_contrato_id: string | null }

/**
 * Precarga desde SIA (spec, Fase 2.5): número y proveedor; valor = vigente de SIA (inicial si no hay vigente) y el de
 * SECOP al lado si difiere; inicio = acta de inicio (fecha_inicio de SIA) o la firma; fin = fin ampliada o fin; modelo
 * por la modalidad; tipo evento; descripción = objeto; link de documentos = ficha de SIA.
 */
export function precargaDesdeSia(sia: SiaContratoLeido, opts: { valorSecop?: number | null } = {}): PrecargaContrato {
  const valor = sia.valor_vigente ?? sia.valor_inicial ?? 0
  const inicio = sia.fecha_inicio ?? sia.fecha_firma
  const fin = sia.fecha_fin_ampliada ?? sia.fecha_fin
  const valorSecop = opts.valorSecop ?? null
  return {
    hospital_id: sia.hospital_id,
    contract_number: sia.codigo ?? String(sia.sia_idc),
    current_provider: sia.contratista ?? '',
    contract_value: valor,
    contract_type: 'evento',
    contracting_model: modeloContratacion(sia.modalidad),
    start_date: inicio,
    end_date: fin,
    duration_months: mesesEntre(inicio, fin),
    description: sia.objeto ?? '',
    documents_link: sia.ficha_url,
    sia_contrato_id: sia.id,
    secop_contrato_id: sia.secop_contrato_id,
    lineas: sia.lineas ?? [],
    valor_secop: valorSecop !== null && Math.abs(valorSecop - valor) >= 1 ? valorSecop : null,
    proveedor_nit: sia.nit_contratista,
  }
}

/** Fila de secop_contratos que lee el importador. */
export interface SecopLeido {
  id: string
  hospital_id: string | null
  numero_contrato: string | null
  referencia: string | null
  documento_proveedor: string | null
  proveedor_nombre: string | null
  es_persona: boolean
  objeto: string | null
  modalidad: string | null
  valor: number | null
  fecha_firma: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  linea: string
  lineas: string[] | null
  url: string | null
}

/** Precarga desde SECOP (cuando el contrato no está en SIA): mismo criterio; el link de documentos es el de SECOP. */
export function precargaDesdeSecop(secop: SecopLeido): PrecargaContrato {
  const inicio = secop.fecha_inicio ?? secop.fecha_firma
  return {
    hospital_id: secop.hospital_id,
    contract_number: secop.referencia ?? secop.numero_contrato ?? '',
    current_provider: secop.es_persona ? '' : secop.proveedor_nombre ?? '',
    contract_value: secop.valor ?? 0,
    contract_type: 'evento',
    contracting_model: modeloContratacion(secop.modalidad),
    start_date: inicio,
    end_date: secop.fecha_fin,
    duration_months: mesesEntre(inicio, secop.fecha_fin),
    description: secop.objeto ?? '',
    documents_link: secop.url ?? '',
    sia_contrato_id: null,
    secop_contrato_id: secop.id,
    lineas: (secop.lineas ?? []).length > 0 ? (secop.lineas as string[]) : secop.linea !== 'no_clasificado' ? [secop.linea] : [],
    valor_secop: null,
    proveedor_nit: secop.es_persona ? null : secop.documento_proveedor,
  }
}

/** Columnas de hospital_contracts que se comparan con SIA y con la lectura de la IA. */
export interface ContratoActual {
  contract_number: string | null
  contract_value: number | null
  start_date: string | null
  end_date: string | null
  contracting_model: string | null
  documents_link: string | null
  requires_liquidez?: boolean | null
  min_liquidez?: number | null
  requires_endeudamiento?: boolean | null
  max_endeudamiento?: number | null
  requires_capital_trabajo?: boolean | null
  min_capital_trabajo?: number | null
  custom_requirements?: string | null
}

export interface Diferencia {
  campo: keyof ContratoActual
  etiqueta: string
  actual: string | number | boolean | null
  propuesto: string | number | boolean | null
  fuente: 'sia' | 'ia'
  /** Columnas de hospital_contracts que se escriben si la persona la aprueba (PUT /api/contracts/[id]). */
  cambios: Record<string, string | number | boolean>
}

/**
 * Diferencias entre un contrato guardado y lo que dice SIA (valor vigente, fechas, número, modelo, enlace a la ficha).
 * NADA se aplica solo: la persona aprueba cada una (spec, Fase 3.5). Un campo vacío en SIA no propone nada.
 */
export function diferenciasConSia(actual: ContratoActual, sia: SiaContratoLeido): Diferencia[] {
  const out: Diferencia[] = []
  const valorSia = sia.valor_vigente ?? sia.valor_inicial
  if (valorSia !== null && (actual.contract_value === null || Math.abs(Number(actual.contract_value) - valorSia) >= 1)) {
    out.push({ campo: 'contract_value', etiqueta: 'Valor (vigente en SIA)', actual: actual.contract_value, propuesto: valorSia, fuente: 'sia', cambios: { contract_value: valorSia } })
  }
  const inicio = sia.fecha_inicio ?? sia.fecha_firma
  if (inicio && actual.start_date !== inicio) out.push({ campo: 'start_date', etiqueta: 'Fecha de inicio', actual: actual.start_date, propuesto: inicio, fuente: 'sia', cambios: { start_date: inicio } })
  const fin = sia.fecha_fin_ampliada ?? sia.fecha_fin
  if (fin && actual.end_date !== fin) out.push({ campo: 'end_date', etiqueta: 'Fecha de finalización', actual: actual.end_date, propuesto: fin, fuente: 'sia', cambios: { end_date: fin } })
  if (sia.codigo && codigoNorm(actual.contract_number) !== codigoNorm(sia.codigo)) {
    out.push({ campo: 'contract_number', etiqueta: 'Número de contrato', actual: actual.contract_number, propuesto: sia.codigo, fuente: 'sia', cambios: { contract_number: sia.codigo } })
  }
  if (sia.modalidad) {
    const modelo = modeloContratacion(sia.modalidad)
    if (actual.contracting_model !== modelo) out.push({ campo: 'contracting_model', etiqueta: `Modelo de contratación (SIA: ${sia.modalidad})`, actual: actual.contracting_model, propuesto: modelo, fuente: 'sia', cambios: { contracting_model: modelo } })
  }
  if (!siaDeEnlace(actual.documents_link)) {
    const propuesto = actual.documents_link ? `${sia.ficha_url} ; ${actual.documents_link}` : sia.ficha_url
    out.push({ campo: 'documents_link', etiqueta: 'Link de documentos (ficha de SIA)', actual: actual.documents_link, propuesto, fuente: 'sia', cambios: { documents_link: propuesto } })
  }
  return out
}
