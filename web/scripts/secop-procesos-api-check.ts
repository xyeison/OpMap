/**
 * Ficha de la IPS · procesos de SECOP II publicados sin contrato (radar comercial) · pruebas de
 * GET /api/secop/hospital/[id]/procesos (SIN RED, sin Supabase real, sin Google). Spec:
 * docs/specs/2026-10-25-secop-procesos-radar.md ("Lectura y pantallas"); decisión
 * docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md.
 *
 * Llama al handler real contra un Supabase FALSO de solo lectura en memoria (el de scripts/mapa-detalle-api-check.ts,
 * más VISTAS calculadas: secop_procesos_radar se arma desde secop_procesos y secop_contratos con la misma regla SQL de
 * la migración 0890). La tabla secop_procesos se siembra pasando filas REALES de p6dx-8zbt (datos.gov.co, 2026-10-25:
 * HU del Caribe 900042103 y HU de Santander 900006037) por mapSecopProceso, como haría la carga. Las filas de juguete
 * llevan id CO1.REQ.104000xx / 109990xx y personas INVENTADAS. Comprueba:
 *   - Quién: los roles con secop:procesos (admin, commercial_director, data_manager, line_leader, viewer y sales_manager)
 *     reciben 200; contract_manager, hr y user 403 sin leer más que su sesión; sin sesión 401.
 *   - HU del Caribe: el proceso CO1.REQ.10254526 con VG MEDICAL SAS (NIT 901080496, origen nit), 1.760 M de precio base,
 *     fecha 'YYYY-MM-DD'; orden fecha desc; empresas del título con origen 'titulo'; persona natural sin nombre; un
 *     título "PERSONA / EMPRESA SAS" deja solo la empresa y uno con cédula no deja a nadie; un cancelado, uno anterior a
 *     la ventana de 24 meses y un servicio de médicos fuera; total exacto; Vigilado con la lista activa. sales_manager
 *     recibe exactamente lo mismo que admin.
 *   - HU de Santander: los dos procesos "Seleccionado" con contrato cargado (por portafolio y por noticeUID en la url de
 *     un contrato del Integrado) no salen (vista); el de juguete sin contrato sí, aunque otra entidad tenga un contrato
 *     con su portafolio. La ruta lee la VISTA, nunca secop_procesos ni secop_contratos.
 *   - Vista ausente (migración 0890 sin aplicar) → 200 con total 0.
 *   - Entidad de compra pública con la regla de la ficha: IPS privada → total 0 sin leer la vista; marca manual "No" gana
 *     al REPS "Pública"; REPS "Privada" con un contrato histórico cargado → pública (existencia: select id, limit 1).
 *   - 400 con id no UUID; 404 si no existe o está inactiva; sin NIT válido → 200 total 0 sin leer la vista.
 *   - Privacidad y textos: la respuesta trae exactamente ventana/total/procesos y las claves de ProcesoDetalle; nunca
 *     la descripción, los documentos, los hashes ni los nombres de las personas de prueba (lista PROHIBIDOS: el título
 *     solo sale como empresa que figura, y ya sin la persona); ningún texto (respuesta, tarjeta) dice "KAM",
 *     "panel", "representante", "sin compras", "abierto", "en curso", "licitación" ni "adjudicado a".
 *   - Cache-Control no-store; ninguna escritura ni petición fuera del Supabase falso; nada importa google-distance.
 *
 * Uso (desde web/): npx tsx scripts/secop-procesos-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import { MAPA_DETALLE_TEXTOS, PROCESOS_FICHA_MAX, textoVentana } from '../lib/mapa-detalle'
import { addMonthsYm, ventanaMeses } from '../lib/compras-publicas'
import { PROCESO_RADAR_COLUMNAS, mapSecopProceso, type ProcesoMapContext, type ProcesoRow } from '../lib/secop-procesos'
import { hashDocumento } from '../lib/secop-hash'
import type { SecopRaw } from '../lib/secop'
import type { ProcesoDetalle, ProcesosDetalle } from '../lib/types/mapa-detalle'
import { hoyBogota } from '../app/api/secop/_lib/hoy'
import { GET as procesosGet } from '../app/api/secop/hospital/[id]/procesos/route'

for (const key of [
  'GOOGLE_MAPS_API_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'SESSION_SECRET',
]) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
const FAKE_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
process.env.SESSION_SECRET = 'secreto-de-prueba-secop-procesos-api-check-0123456789abcdefghijklm'

// Despachador único: sin manejador cualquier fetch falla; con él, solo responde el Supabase falso.
type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('secop-procesos-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch

// Los console.log / console.error de las rutas se recogen aquí para no ensuciar la salida.
const moduleLogs: string[] = []
const collect = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
}
console.error = collect
console.log = collect

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    const texto = detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail)
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 900)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 700)}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

// ---------------------------------------------------------------------------
// Supabase FALSO de solo lectura (con vistas calculadas)
// ---------------------------------------------------------------------------

type Fila = Record<string, unknown>
type Tablas = Record<string, Fila[]>
/** Vista: se calcula en cada lectura desde las tablas sembradas (como la vista real desde sus tablas). */
type Vistas = Record<string, (tablas: Tablas) => Fila[]>

interface FakeRequest {
  method: string
  table: string
  params: URLSearchParams
}

const POSTGREST_CONTROL_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])

function matchesFilters(row: Fila, params: URLSearchParams): boolean {
  for (const [key, raw] of Array.from(params.entries())) {
    if (POSTGREST_CONTROL_PARAMS.has(key)) continue
    const value = row[key] === null || row[key] === undefined ? 'null' : String(row[key])
    if (raw.startsWith('eq.')) {
      if (value !== raw.slice(3)) return false
    } else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const options = raw.slice(4, -1).split(',').map(option => option.replace(/^"|"$/g, ''))
      if (!options.includes(value)) return false
    } else if (/^(gte|lte|gt|lt)\./.test(raw)) {
      const [op, ...rest] = raw.split('.')
      const target = rest.join('.')
      if (value === 'null') return false
      if (op === 'gte' && !(value >= target)) return false
      if (op === 'lte' && !(value <= target)) return false
      if (op === 'gt' && !(value > target)) return false
      if (op === 'lt' && !(value < target)) return false
    } else {
      throw new Error(`Supabase falso: filtro no soportado ${key}=${raw}`)
    }
  }
  return true
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1 // NULLS LAST (ascendente)
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

function project(row: Fila, select: string | null): Fila {
  if (!select || select === '*') return { ...row }
  const out: Fila = {}
  for (const column of select.split(',').map(part => part.trim()).filter(Boolean)) out[column] = row[column] ?? null
  return out
}

function fakeSupabase(tablas: Tablas, vistas: Vistas = {}) {
  const requests: FakeRequest[] = []
  const external: string[] = []
  const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

  const handler: FetchHandler = async (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href)
    if (url.origin !== FAKE_SUPABASE_URL) {
      external.push(url.origin)
      throw new Error(`secop-procesos-api-check: intento de red a ${url.origin}`)
    }
    const method = (init?.method || 'GET').toUpperCase()
    const table = url.pathname.replace('/rest/v1/', '')
    requests.push({ method, table, params: url.searchParams })

    if (table.startsWith('rpc/')) return json({ code: 'PGRST202', message: `Could not find the function public.${table.slice(4)}`, details: null, hint: null }, 404)
    // Solo lectura: cualquier escritura es un error de la prueba (y queda en requests).
    if (method !== 'GET') return json({ code: '42501', message: `Supabase falso: escritura no permitida (${method} ${table})`, details: null, hint: null }, 403)
    const fuente = table in vistas ? vistas[table](tablas) : table in tablas ? tablas[table] : null
    if (!fuente) return json({ code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache`, details: null, hint: null }, 404)

    let rows = fuente.filter(row => matchesFilters(row, url.searchParams))
    const order = url.searchParams.get('order')
    if (order) {
      const keys = order.split(',').map(part => {
        const [column, direction] = part.split('.')
        return { column, desc: direction === 'desc' }
      })
      rows = [...rows].sort((a, b) => {
        for (const key of keys) {
          const result = compareValues(a[key.column], b[key.column])
          if (result !== 0) return key.desc ? -result : result
        }
        return 0
      })
    }
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = url.searchParams.get('limit')
    rows = rows.slice(offset, limit === null ? undefined : offset + Number(limit))
    return json(rows.map(row => project(row, url.searchParams.get('select'))))
  }

  const writes = () => requests.filter(request => request.method !== 'GET' && !request.table.startsWith('rpc/'))
  return { handler, requests, external, writes }
}
type Fake = ReturnType<typeof fakeSupabase>

/**
 * public.secop_procesos_radar (migración 0890) en JavaScript: estados del radar y NOT EXISTS un contrato de la MISMA
 * entidad con proceso = portafolio, o cuya url lleve el noticeUID con borde ('…noticeUID&…' o al final). En SQL
 * `c.proceso = p.portafolio` con un NULL no casa: aquí tampoco.
 */
const ESTADOS_VISTA = new Set(['publicado', 'evaluacion', 'abierto', 'seleccionado'])
function vistaRadar(tablas: Tablas): Fila[] {
  const contratos = tablas.secop_contratos ?? []
  return (tablas.secop_procesos ?? []).filter(p => {
    if (!ESTADOS_VISTA.has(String(p.estado))) return false
    return !contratos.some(c => {
      if (c.nit_entidad !== p.nit_entidad) return false
      if (c.proceso != null && p.portafolio != null && c.proceso === p.portafolio) return true
      const notice = p.notice_uid == null ? null : String(p.notice_uid)
      const url = c.url == null ? '' : String(c.url)
      return notice !== null && (url.includes(`${notice}&`) || url.endsWith(notice))
    })
  })
}

// ---------------------------------------------------------------------------
// Fechas: las filas reales son del 2026-10-25; se desplazan los meses que hayan pasado para que la ventana de 24 meses
// (que termina hoy, hoyBogota()) las vea igual cuando la prueba corra más adelante. Hoy (2026-10) el desplazamiento es 0.
// ---------------------------------------------------------------------------

const HOY = hoyBogota()
const MES_DE_LAS_FILAS = '2026-10'
const mesIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7))
const DESPLAZAMIENTO = mesIndex(HOY.slice(0, 7)) - mesIndex(MES_DE_LAS_FILAS)
/** Mueve una fecha 'YYYY-MM-DD…' DESPLAZAMIENTO meses (todos los días de las filas son ≤ 28: nunca se sale del mes). */
const desplazar = (fecha: string) => `${addMonthsYm(fecha.slice(0, 7), DESPLAZAMIENTO)}${fecha.slice(7)}`
const V24 = ventanaMeses(HOY, 24)
/** El día anterior al primero de la ventana de 24 meses: siempre fuera. */
const ANTES = (() => {
  const d = new Date(`${V24.desde}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
})()

// ---------------------------------------------------------------------------
// Filas de p6dx-8zbt
// ---------------------------------------------------------------------------

const NIT_CARIBE = '900042103'
const NIT_HUS = '900006037'
const NIT_PRIVADA = '900000004'
const NIT_MARCADA_NO = '900000005'
const NIT_HISTORICO = '900000010'
const VG = '901080496'
const OSTEOEQUIPOS = '900467933'

const urlNotice = (notice: string) => ({ url: `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${notice}` })

/** HU del Caribe, 000039-2026: la fila COMPLETA de p6dx-8zbt (raw/hu-caribe.json; ninguna persona natural). */
const CARIBE_VG_2026: SecopRaw = {
  entidad: 'BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE',
  nit_entidad: '900042103',
  departamento_entidad: 'Bolívar',
  ciudad_entidad: 'Cartagena',
  ordenentidad: 'Territorial',
  codigo_pci: 'Centralizada',
  id_del_proceso: 'CO1.REQ.10254526',
  referencia_del_proceso: '000039-2026',
  ppi: '719185811',
  id_del_portafolio: 'CO1.BDOS.10084716',
  nombre_del_procedimiento: 'VG MEDICAL S.A.S',
  descripci_n_del_procedimiento:
    'SUMINISTRO DE MATERIAL MEDICO QUIRURGICO DE OSTEOSINTESIS ( ORTOPEDIA, MAXILOFACIAL, NEUROCIRUGIA) PARA LA ATENCION INTEGRAL EN SALUD DE LOS USUARIOS DE LA E.S.E. HOSPITAL UNIVERSITARIO DEL CARIBE ,DE ACUERDO AL ANEXO TECNICO No. 1 HUC- 2025 (MATERIALES DE OSTEOSINTESIS)',
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-03-10T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-03-10T00:00:00.000',
  fecha_de_publicacion_fase_3: '2026-03-10T00:00:00.000',
  precio_base: '1760000000',
  modalidad_de_contratacion: 'Contratación régimen especial',
  justificaci_n_modalidad_de: 'Regla aplicable',
  duracion: '4',
  unidad_de_duracion: 'Mes(es)',
  ciudad_de_la_unidad_de: 'Cartagena',
  nombre_de_la_unidad_de: 'OFICINA ASESORA JURIDICA',
  proveedores_invitados: '0',
  proveedores_con_invitacion: '0',
  visualizaciones_del: '0',
  proveedores_que_manifestaron: '0',
  respuestas_al_procedimiento: '0',
  respuestas_externas: '0',
  conteo_de_respuestas_a_ofertas: '0',
  proveedores_unicos_con: '0',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Publicado',
  id_estado_del_procedimiento: '50',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: '717176622',
  departamento_proveedor: 'Atlántico',
  ciudad_proveedor: 'Barranquilla',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'VG MEDICAL SAS',
  nit_del_proveedor_adjudicado: '901080496',
  codigo_principal_de_categoria: 'V1.42132200',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Prestación de servicios',
  subtipo_de_contrato: 'No Definido',
  categorias_adicionales: 'No definido',
  urlproceso: urlNotice('CO1.NTC.10111634'),
  codigo_entidad: '719185811',
  estado_resumen: 'Presentación de oferta',
}

/** Campos de régimen especial que se repiten en las filas del HU del Caribe (iguales en la fuente). */
const CARIBE: SecopRaw = {
  entidad: 'BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE',
  nit_entidad: '900042103',
  modalidad_de_contratacion: 'Contratación régimen especial',
  estado_del_procedimiento: 'Publicado',
  adjudicado: 'No',
  valor_total_adjudicacion: '0',
  tipo_de_contrato: 'Suministros',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
}
const OSTEO_DESC = 'SUMINISTRO DE INSUMOS Y DISPOSITIVOS MEDICOS EN MATERIAL MEDICO QUIRURGICO DE OSTEOSINTESIS ESPECIALIZADOS PARA CIRUGIAS DE ALTA COMPLEJIDAD'
const VG_DESC = (anexo: string) =>
  `SUMINISTRO DE MATERIAL MEDICO QUIRURGICO DE OSTEOSINTESIS ( ORTOPEDIA, MAXILOFACIAL, NEUROCIRUGIA) PARA LA ATENCION INTEGRAL EN SALUD DE LOS USUARIOS DE LA E.S.E. HOSPITAL UNIVERSITARIO DEL CARIBE ,DE ACUERDO AL ANEXO TECNICO ${anexo} (MATERIALES DE OSTEOSINTESIS)`

/** Filas reales del HU del Caribe (p6dx-8zbt, 2026-10-25), con los campos que usa mapSecopProceso. */
const CARIBE_REALES: SecopRaw[] = [
  CARIBE_VG_2026,
  { ...CARIBE, id_del_proceso: 'CO1.REQ.10459316', referencia_del_proceso: '000129-2026', id_del_portafolio: 'CO1.BDOS.10281565', nombre_del_procedimiento: 'OSTEOEQUIPOS S.A.S.', descripci_n_del_procedimiento: OSTEO_DESC, fecha_de_publicacion_del: '2026-05-21T00:00:00.000', precio_base: '400000000', nombre_del_proveedor: 'OSTEOEQUIPOS SAS', nit_del_proveedor_adjudicado: '900467933', codigo_principal_de_categoria: 'V1.42242300', urlproceso: urlNotice('CO1.NTC.10316129') },
  { ...CARIBE, id_del_proceso: 'CO1.REQ.10238192', referencia_del_proceso: '000043-2026', id_del_portafolio: 'CO1.BDOS.10068969', nombre_del_procedimiento: 'OSTEOEQUIPOS S.A.S.', descripci_n_del_procedimiento: OSTEO_DESC, fecha_de_publicacion_del: '2026-03-05T00:00:00.000', precio_base: '320000000', nombre_del_proveedor: 'OSTEOEQUIPOS SAS', nit_del_proveedor_adjudicado: '900467933', codigo_principal_de_categoria: 'V1.42241800', urlproceso: urlNotice('CO1.NTC.10095099') },
  { ...CARIBE, id_del_proceso: 'CO1.REQ.9405198', referencia_del_proceso: '000302-2025', id_del_portafolio: 'CO1.BDOS.9237371', nombre_del_procedimiento: 'MEDIINSUMOS S.A.S.', descripci_n_del_procedimiento: 'SUMINISTRO DE INSUMO Y DISPOSITIVOS MEDICO-QUIRURGICOS, PARA COMPLEMENTAR LOS PROCEDIMIENTOS QUIRURGICO DE LA CIRUGIAS DE ORTOPEDIA Y OTRAS ESPECIALIDADES, COMO EL PLAN ALTERNO AL SUMINISTRO DE OSTEOSINTESIS', fecha_de_publicacion_del: '2025-12-09T00:00:00.000', precio_base: '200000000', tipo_de_contrato: 'Otro', codigo_principal_de_categoria: 'V1.42132100', urlproceso: urlNotice('CO1.NTC.9266012') },
  { ...CARIBE, id_del_proceso: 'CO1.REQ.9121313', referencia_del_proceso: '000518-2025', id_del_portafolio: 'CO1.BDOS.8958148', nombre_del_procedimiento: 'VG MEDICAL S.A.S', descripci_n_del_procedimiento: VG_DESC('No. 1 HUC- 2025'), fecha_de_publicacion_del: '2025-10-21T00:00:00.000', precio_base: '1320000000', codigo_principal_de_categoria: 'V1.42131600', urlproceso: urlNotice('CO1.NTC.8983625') },
  { ...CARIBE, id_del_proceso: 'CO1.REQ.8981567', referencia_del_proceso: '000293-2025', id_del_portafolio: 'CO1.BDOS.8821617', nombre_del_procedimiento: 'VG MEDICAL S.A.S', descripci_n_del_procedimiento: VG_DESC('No. 1 HUC- 2024'), fecha_de_publicacion_del: '2025-09-26T00:00:00.000', precio_base: '1260000000', codigo_principal_de_categoria: 'V1.42142500', urlproceso: urlNotice('CO1.NTC.8846892') },
  // Empresa en el título que no es proveedora de osteosíntesis (copiada de otro proceso): sale con "según el título"
  { ...CARIBE, id_del_proceso: 'CO1.REQ.8966905', referencia_del_proceso: '000044-2023', id_del_portafolio: 'CO1.BDOS.6097545', nombre_del_procedimiento: 'ESTATAL DE SEGURIDAD LIMITADA', descripci_n_del_procedimiento: VG_DESC('No. 1 HUC-2023'), fecha_de_publicacion_del: '2025-09-24T00:00:00.000', precio_base: '100000000', codigo_principal_de_categoria: 'V1.42241700', urlproceso: urlNotice('CO1.NTC.8832946') },
  { ...CARIBE, id_del_proceso: 'CO1.REQ.7848230', referencia_del_proceso: '000037-2025', id_del_portafolio: 'CO1.BDOS.7530517', nombre_del_procedimiento: 'TECNITRAUMA S.A.S.', descripci_n_del_procedimiento: 'SUMINISTRAR LOS DISPOSITIVOS MEDICOS E INSUMOS PARA EL DESARROLLO DE LOS PROCEDIMIENTOS QUIRURGICOS DE CIRUGIA DE ARTROSCOPIAS, PARA LA E.S.E. HOSPITAL UNIVERSITARIO DEL CARIBE, DE CONFORMIDAD CON EL ANEXO TECNICO 01- HUC-2023', fecha_de_publicacion_del: '2025-02-26T00:00:00.000', precio_base: '210000000', nombre_del_proveedor: 'TECNITRAUMA S.A.', codigo_principal_de_categoria: 'V1.42321500', urlproceso: urlNotice('CO1.NTC.7725573') },
  // Servicios de especialistas (motivo 'servicio'): la carga no lo guarda
  { ...CARIBE, id_del_proceso: 'CO1.REQ.10232028', referencia_del_proceso: '000004-2026', id_del_portafolio: 'CO1.BDOS.10062941', nombre_del_procedimiento: 'GREMIO DE SALUD INTEGRAL -GSI  ASOBOCOT', descripci_n_del_procedimiento: 'PRESTAR LOS SERVICIOS ESPECIALIZADOS DE FORMA INTEGRAL EN ORTOPEDIA CON LA SUBDIRETRIZ DE LOS SERVICIOS DE NEUROCIRUGIA , FISIATRIA Y CIRUGIA PLASTICA', fecha_de_publicacion_del: '2026-03-03T00:00:00.000', precio_base: '2536000000', tipo_de_contrato: 'Prestación de servicios', nombre_del_proveedor: 'GREMIO DE SALUD INTEGRAL', nit_del_proveedor_adjudicado: '900561102', codigo_principal_de_categoria: 'V1.85121600', urlproceso: urlNotice('CO1.NTC.10089205') },
]

/** Persona natural INVENTADA (como proveedor y como paciente) en una fila de juguete del HU del Caribe. */
const PERSONA_PROVEEDOR = 'CARLOS ANDRES MEJIA TORO'
const PERSONA_DOC = '1045678901'
const PACIENTE = 'LUISA FERNANDA OSPINA'
const PACIENTE_DOC = '1.143.456.789'
/** Persona natural INVENTADA en el título del proceso, sin documento del proveedor (revisión 2026-10-25). */
const PERSONA_TITULO = 'NOMBRE INVENTADO APELLIDOPRUEBA'
const PERSONA_TITULO_DOC = '7654321'
const CARIBE_JUGUETE: SecopRaw[] = [
  {
    ...CARIBE,
    id_del_proceso: 'CO1.REQ.10400001',
    referencia_del_proceso: 'PRUEBA-PERSONA',
    id_del_portafolio: 'CO1.BDOS.10400001',
    nombre_del_procedimiento: PERSONA_PROVEEDOR,
    descripci_n_del_procedimiento: `ADQUISICION DE MATERIAL DE OSTEOSINTESIS PARA EL PACIENTE ${PACIENTE} IDENTIFICADO CON CEDULA ${PACIENTE_DOC} QUIEN REQUIERE PROCEDIMIENTO QUIRURGICO DE ORTOPEDIA`,
    fecha_de_publicacion_del: '2026-04-15T00:00:00.000',
    precio_base: '150000000',
    nombre_del_proveedor: PERSONA_PROVEEDOR,
    nit_del_proveedor_adjudicado: PERSONA_DOC,
    urlproceso: urlNotice('CO1.NTC.10400001'),
  },
  // Cancelado: se guarda (estado 'cancelado') pero la vista no lo deja pasar
  { ...CARIBE_REALES[2], id_del_proceso: 'CO1.REQ.10400002', referencia_del_proceso: 'PRUEBA-CANCELADO', id_del_portafolio: 'CO1.BDOS.10400002', estado_del_procedimiento: 'Cancelado', fecha_de_publicacion_del: '2026-04-01T00:00:00.000', urlproceso: urlNotice('CO1.NTC.10400002') },
  // Seleccionado SIN contrato cargado: sí entra al radar
  { ...CARIBE_REALES[1], id_del_proceso: 'CO1.REQ.10400004', referencia_del_proceso: 'PRUEBA-SELECCIONADO', id_del_portafolio: 'CO1.BDOS.10400004', estado_del_procedimiento: 'Seleccionado', fecha_de_publicacion_del: '2026-05-02T00:00:00.000', urlproceso: urlNotice('CO1.NTC.10400004') },
  // Título "PERSONA / EMPRESA SAS" sin documento del proveedor: figura solo la empresa, nunca la persona
  { ...CARIBE, id_del_proceso: 'CO1.REQ.10400005', referencia_del_proceso: 'PRUEBA-TITULO-PERSONA', id_del_portafolio: 'CO1.BDOS.10400005', nombre_del_procedimiento: `${PERSONA_TITULO} / COMERCIALIZADORA DE PRUEBA SAS`, descripci_n_del_procedimiento: OSTEO_DESC, fecha_de_publicacion_del: '2026-02-12T00:00:00.000', precio_base: '60000000', codigo_principal_de_categoria: 'V1.42242300', urlproceso: urlNotice('CO1.NTC.10400005') },
  // Título con el nombre y la cédula de una persona y una EPS "SA": no figura nadie
  { ...CARIBE, id_del_proceso: 'CO1.REQ.10400006', referencia_del_proceso: 'PRUEBA-TITULO-CEDULA', id_del_portafolio: 'CO1.BDOS.10400006', nombre_del_procedimiento: `${PERSONA_TITULO} CC ${PERSONA_TITULO_DOC} EPS DE PRUEBA SA`, descripci_n_del_procedimiento: OSTEO_DESC, fecha_de_publicacion_del: '2026-02-10T00:00:00.000', precio_base: '50000000', codigo_principal_de_categoria: 'V1.42242300', urlproceso: urlNotice('CO1.NTC.10400006') },
]
/** Publicado el día anterior a la ventana de 24 meses (no se desplaza: ANTES ya sale de hoy). */
const CARIBE_ANTES: SecopRaw = { ...CARIBE_REALES[7], id_del_proceso: 'CO1.REQ.10400003', referencia_del_proceso: 'PRUEBA-ANTES', id_del_portafolio: 'CO1.BDOS.10400003', fecha_de_publicacion_del: `${ANTES}T00:00:00.000`, urlproceso: urlNotice('CO1.NTC.10400003') }

const HUS: SecopRaw = {
  entidad: 'E.S.E HOSPITAL UNIVERSITARIO DE SANTANDER',
  nit_entidad: '900006037',
  modalidad_de_contratacion: 'Contratación régimen especial',
  adjudicado: 'No',
  valor_total_adjudicacion: '0',
  tipo_de_contrato: 'Decreto 092 de 2017',
  nombre_del_procedimiento: 'SUMINISTRO',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
}
/** HU de Santander: dos "Seleccionado" reales que YA tienen contrato cargado (2026-10-25) y uno de juguete sin contrato. */
const HUS_FILAS: SecopRaw[] = [
  { ...HUS, id_del_proceso: 'CO1.REQ.10091613', referencia_del_proceso: 'DIR-111-2026', id_del_portafolio: 'CO1.BDOS.9923396', estado_del_procedimiento: 'Seleccionado', descripci_n_del_procedimiento: 'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS, ACCESORIOS E INSUMOS EN SUS DIFERENTES CLASIFICACIONES, Y CANTIDADES PARA GARANTIZAR LA ATENCIÓN OPORTUNA Y ADECUADA A LOS PACIENTES QUE REQUIERAN PROCEDIMIENTOS QUIRÚRGICOS EN LOS DIFERENTES SERVICIOS DE INTERNAMIENTO DE LA ESE HOSPITAL UNIVERSITARIO DE SANTANDER', fecha_de_publicacion_del: '2026-01-31T00:00:00.000', precio_base: '1750000000', codigo_principal_de_categoria: 'V1.41104119', urlproceso: urlNotice('CO1.NTC.9947922') },
  { ...HUS, id_del_proceso: 'CO1.REQ.11015246', referencia_del_proceso: 'DIR-502-2026', id_del_portafolio: 'CO1.BDOS.10830018', estado_del_procedimiento: 'Seleccionado', descripci_n_del_procedimiento: 'SUMINISTRO DE INSUMOS Y COMPONENTES PARA LA ELABORACION DE ORTESIS Y PRÓTESIS EN LA ESE HOSPITAL UNIVERSITARIO DE SANTANDER', fecha_de_publicacion_del: '2026-09-09T00:00:00.000', precio_base: '60000000', codigo_principal_de_categoria: 'V1.42241509', urlproceso: urlNotice('CO1.NTC.10869355') },
  { ...HUS, id_del_proceso: 'CO1.REQ.10999001', referencia_del_proceso: 'PRUEBA-HUS', id_del_portafolio: 'CO1.BDOS.10999001', estado_del_procedimiento: 'Publicado', descripci_n_del_procedimiento: 'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS PARA LA ESE HOSPITAL UNIVERSITARIO DE SANTANDER', fecha_de_publicacion_del: '2026-06-10T00:00:00.000', precio_base: '90000000', codigo_principal_de_categoria: 'V1.42241509', urlproceso: urlNotice('CO1.NTC.10999001') },
]

/** Una fila de juguete por cada NIT de prueba (privada, marcada "No" e histórica), con la misma forma de las del HUS. */
const juguete = (nit: string, n: number): SecopRaw => ({
  ...HUS_FILAS[2],
  entidad: `ENTIDAD DE PRUEBA ${nit}`,
  nit_entidad: nit,
  id_del_proceso: `CO1.REQ.1099900${n}`,
  referencia_del_proceso: `PRUEBA-${n}`,
  id_del_portafolio: `CO1.BDOS.1099900${n}`,
  urlproceso: urlNotice(`CO1.NTC.1099900${n}`),
})

const SAL = 'sal-de-prueba-secop-procesos-api-0123456789abcdef'
const ctx: ProcesoMapContext = {
  hashDocumento: digitos => hashDocumento(digitos, SAL),
  entidades: new Set([NIT_CARIBE, NIT_HUS, NIT_PRIVADA, NIT_MARCADA_NO, NIT_HISTORICO]),
  vigilados: new Set([OSTEOEQUIPOS]),
  ahora: '2026-10-25T06:30:00.000Z',
}

/** Pasa las filas por mapSecopProceso (como la carga) y devuelve las guardadas y los motivos de las que no. */
function cargar(raws: SecopRaw[], desplazarFechas = true): { rows: ProcesoRow[]; descartes: Record<string, string> } {
  const rows: ProcesoRow[] = []
  const descartes: Record<string, string> = {}
  for (const raw of raws) {
    const fecha = typeof raw.fecha_de_publicacion_del === 'string' ? raw.fecha_de_publicacion_del : null
    const movida = fecha && desplazarFechas ? { ...raw, fecha_de_publicacion_del: desplazar(fecha) } : raw
    const result = mapSecopProceso(movida, ctx)
    if ('row' in result) rows.push(result.row)
    else descartes[String(raw.id_del_proceso)] = result.descartado
  }
  return { rows, descartes }
}

const cargaCaribe = cargar([...CARIBE_REALES, ...CARIBE_JUGUETE])
const cargaAntes = cargar([CARIBE_ANTES], false)
const cargaHus = cargar(HUS_FILAS)
const cargaOtras = cargar([juguete(NIT_PRIVADA, 2), juguete(NIT_MARCADA_NO, 3), juguete(NIT_HISTORICO, 4)])
const SECOP_PROCESOS: ProcesoRow[] = [...cargaCaribe.rows, ...cargaAntes.rows, ...cargaHus.rows, ...cargaOtras.rows]

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const ROLES = Object.keys(rolePermissions) as Role[]
const usuarioDeRol = (role: Role) => `50000000-0000-4000-8000-${String(ROLES.indexOf(role) + 1).padStart(12, '0')}`
const ADMIN = usuarioDeRol('admin')
const EJECUTIVO = usuarioDeRol('sales_manager')

const IPS_CARIBE = '69d32913-2ac6-4a2a-9543-7e0c78191005'
const IPS_HUS = '40000000-0000-4000-8000-0000000005a1'
const IPS_PRIVADA = '40000000-0000-4000-8000-000000000d01'
const IPS_MARCADA_NO = '40000000-0000-4000-8000-000000000e01'
const IPS_HISTORICO = '40000000-0000-4000-8000-000000000c01'
const IPS_INACTIVA = '40000000-0000-4000-8000-000000000099'
const IPS_SIN_NIT = '40000000-0000-4000-8000-000000000ab1'
const NADIE = '40000000-0000-4000-8000-0000000000ff'

function usuario(id: string, role: string): Fila {
  return { id, email: `${role}-${id.slice(-4)}@prueba.test`, full_name: `Rol ${role}`, role, active: true, password: `hash-${id}` }
}

function sede(id: string, code: string, name: string, extra: Fila = {}): Fila {
  return { id, code, name, beds: 100, compra_publica: null, active: true, ...extra }
}

function datos(conVista: boolean): { tablas: Tablas; vistas: Vistas } {
  const tablas: Tablas = {
    users: ROLES.map(role => usuario(usuarioDeRol(role), role)),
    hospitals: [
      sede(IPS_CARIBE, '900042103-0', 'ESE Hospital Universitario del Caribe'),
      sede(IPS_HUS, '900006037-8', 'ESE Hospital Universitario de Santander'),
      sede(IPS_PRIVADA, '900000004-5', 'Clínica privada de prueba'),
      sede(IPS_MARCADA_NO, '900000005-7', 'Hospital marcado No', { compra_publica: false }),
      sede(IPS_HISTORICO, '900000010-6', 'Hospital con contratos históricos'),
      sede(IPS_INACTIVA, '900042103-1', 'Sede cerrada del Caribe', { active: false }),
      sede(IPS_SIN_NIT, 'SIN-NIT-01', 'Puesto de salud sin NIT', { compra_publica: true }),
    ],
    reps_sedes: [
      { nit: NIT_CARIBE, naturaleza: 'Pública' },
      { nit: NIT_HUS, naturaleza: 'Pública' },
      { nit: NIT_PRIVADA, naturaleza: 'Privada' },
      { nit: NIT_MARCADA_NO, naturaleza: 'Pública' },
      { nit: NIT_HISTORICO, naturaleza: 'Privada' },
    ],
    // Vista sin doble conteo (0730): la ruta solo pregunta si existe algún contrato del NIT (criterio 3)
    secop_contratos_unicos: [{ id: 'c-2019-h', nit_entidad: NIT_HISTORICO, fecha_firma: '2019-03-05', valor: 999 }],
    // Tabla de contratos que usa la vista del radar (0890)
    secop_contratos: [
      // HUS: contrato de SECOP II con proceso = portafolio de CO1.REQ.10091613
      { id: 'c-hus-1', fuente: 'secop2', nit_entidad: NIT_HUS, proceso: 'CO1.BDOS.9923396', numero_contrato: 'CO1.PCCNTR.9314318', url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9947922&isFromPublicArea=True&isModal=False' },
      // HUS: contrato del Integrado (origen SECOPII) SIN proceso, que casa solo por el noticeUID de CO1.REQ.11015246
      { id: 'c-hus-2', fuente: 'integrado', nit_entidad: NIT_HUS, proceso: null, numero_contrato: 'CO1.PCCNTR.9926272', url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10869355&isFromPublicArea=True&isModal=False' },
      // Otra entidad con el portafolio del proceso de juguete del HUS: no lo saca (la vista exige la misma entidad)
      { id: 'c-otra', fuente: 'secop2', nit_entidad: '900000099', proceso: 'CO1.BDOS.10999001', numero_contrato: 'CO1.PCCNTR.1', url: null },
      // Un noticeUID que EMPIEZA igual que el del proceso de juguete no lo saca (borde: CO1.NTC.109990011 ≠ CO1.NTC.10999001)
      { id: 'c-borde', fuente: 'secop2', nit_entidad: NIT_HUS, proceso: 'CO1.BDOS.1', numero_contrato: 'CO1.PCCNTR.2', url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.109990011&isFromPublicArea=True' },
    ],
    secop_proveedores_vigilados: [
      { nit: OSTEOEQUIPOS, dv: '1', nombre: 'OSTEOEQUIPOS SAS', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: true, nota: null, updated_at: null },
      { nit: '900656724', dv: '1', nombre: 'PRECIMEC', ciudad: null, origen: 'manual', compras_gcp_cop: null, activo: false, nota: 'baja', updated_at: null },
    ],
  }
  if (conVista) tablas.secop_procesos = SECOP_PROCESOS.map(row => ({ id: `p-${row.id_proceso}`, imported_at: '2026-10-25T06:30:00.000Z', ...row }))
  return { tablas, vistas: conVista ? { secop_procesos_radar: vistaRadar } : {} }
}

const conVista = datos(true)
const fake = fakeSupabase(conVista.tablas, conVista.vistas)
const sinVista = datos(false)
const fakeSinVista = fakeSupabase(sinVista.tablas, sinVista.vistas)

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

function headersDe(userId: string | null): Record<string, string> {
  if (!userId) return {}
  return { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(userId, passwordVersion(`hash-${userId}`)))}` }
}

interface Respuesta<T = any> {
  status: number
  body: T
  text: string
  cacheControl: string | null
  requests: FakeRequest[]
}

async function procesos(f: Fake, userId: string | null, id: string): Promise<Respuesta<ProcesosDetalle>> {
  fetchHandler = f.handler
  const antes = f.requests.length
  const response = await procesosGet(new NextRequest(`http://localhost:3000/api/secop/hospital/${id}/procesos`, { method: 'GET', headers: headersDe(userId) }), { params: { id } })
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, text, cacheControl: response.headers.get('cache-control'), requests: f.requests.slice(antes) }
}

const tablasLeidas = (requests: FakeRequest[]) => Array.from(new Set(requests.map(request => request.table)))
const ids = (body: ProcesosDetalle | null) => (body?.procesos ?? []).map(p => p.id)
const VENTANA = { desde: V24.desde, hasta: HOY, texto: textoVentana(V24.desde, 'hoy') }

const textos: string[] = []
const PROHIBIDOS = [
  'descripcion',
  'proveedor_hash',
  'portafolio',
  'notice_uid',
  'valor_adjudicado',
  hashDocumento(PERSONA_DOC, SAL),
  PERSONA_PROVEEDOR,
  'MEJIA',
  PACIENTE,
  'OSPINA',
  PERSONA_DOC,
  PACIENTE_DOC,
  PACIENTE_DOC.replace(/\./g, ''),
  PERSONA_TITULO,
  'APELLIDOPRUEBA',
  PERSONA_TITULO_DOC,
  'ANEXO TECNICO',
  'OSTEOSINTESIS',
  'GREMIO',
  'PRUEBA-CANCELADO',
  'PRUEBA-ANTES',
]
const TERMINOS = [
  [/\bKAM\b/, 'KAM'],
  [/\bpanel\b/i, 'panel'],
  [/representante/i, 'representante'],
  [/sin compras/i, 'sin compras'],
  [/\babiert[oa]s?\b/i, 'abierto'],
  [/en curso/i, 'en curso'],
  [/licitaci[oó]n/i, 'licitación'],
  [/adjudicad[oa]s? a\b/i, 'adjudicado a'],
  [/\bgan[oó]\b/i, 'ganó'],
] as const

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

async function main() {
  print('\nFixtures: filas reales de p6dx-8zbt pasadas por mapSecopProceso (como la carga)')
  {
    eq('HU del Caribe: el servicio de médicos (GREMIO) no se guarda', cargaCaribe.descartes, { 'CO1.REQ.10232028': 'servicio' })
    eq('HU del Caribe: 13 filas guardadas (8 reales + persona, cancelado, seleccionado y dos títulos con persona de juguete)', cargaCaribe.rows.length, 13)
    const persona = cargaCaribe.rows.find(row => row.id_proceso === 'CO1.REQ.10400001')
    eq('la persona de juguete se guarda como persona: sin nombre ni NIT, solo el hash', [persona?.es_persona, persona?.proveedor_nombre, persona?.proveedor_nit, persona?.proveedor_hash === hashDocumento(PERSONA_DOC, SAL)], [true, null, null, true])
    check('la descripción guardada ya va sin el nombre ni el documento del paciente', Boolean(persona?.descripcion) && !persona!.descripcion!.includes('OSPINA') && !persona!.descripcion!.includes(PACIENTE_DOC), persona?.descripcion)
    eq('HU de Santander: las 3 filas se guardan (2 seleccionadas con contrato y 1 de juguete)', [cargaHus.rows.length, Object.keys(cargaHus.descartes)], [3, []])
    eq('la fila anterior a la ventana y las de los NIT de prueba se guardan', [cargaAntes.rows.length, cargaOtras.rows.length], [1, 3])
  }

  print('\nQuién: secop:procesos (roles con intelligence:view y los Ejecutivos Comerciales)')
  {
    const con = ROLES.filter(role => hasPermission(role, 'secop:procesos')).sort()
    eq('secop:procesos: admin, commercial_director, data_manager, line_leader, sales_manager, viewer', con, ['admin', 'commercial_director', 'data_manager', 'line_leader', 'sales_manager', 'viewer'])
    const estados: Record<string, number> = {}
    const leenDeMas: string[] = []
    for (const role of ROLES) {
      const r = await procesos(fake, usuarioDeRol(role), IPS_CARIBE)
      estados[role] = r.status
      textos.push(r.text)
      if (r.status === 403 && !r.requests.every(request => request.table === 'users')) leenDeMas.push(`${role}: ${tablasLeidas(r.requests).join(',')}`)
    }
    eq('200 con secop:procesos; 403 sin él', estados, Object.fromEntries(ROLES.map(role => [role, hasPermission(role, 'secop:procesos') ? 200 : 403])))
    eq('un 403 no lee ninguna tabla más que la sesión (users)', leenDeMas, [])
    const anon = await procesos(fake, null, IPS_CARIBE)
    eq('sin sesión: 401 sin leer tablas de SECOP', [anon.status, anon.requests.filter(request => request.table !== 'users').length], [401, 0])
  }

  print('\nHU del Caribe (900042103): el proceso de VG MEDICAL SAS y los demás del radar, 24 meses')
  const admin = await procesos(fake, ADMIN, IPS_CARIBE)
  textos.push(admin.text)
  {
    eq('200 y Cache-Control no-store', [admin.status, admin.cacheControl], [200, 'no-store'])
    eq('la respuesta trae exactamente ventana, total y procesos (ninguna suma de precio base)', Object.keys(admin.body ?? {}).sort(), ['procesos', 'total', 'ventana'])
    eq('ventana de la ficha: 24 meses hasta hoy en Bogotá, por fecha de publicación', admin.body.ventana, VENTANA)
    eq(
      'orden: fecha de publicación desc; fuera el cancelado, el anterior a la ventana y el servicio',
      ids(admin.body),
      ['CO1.REQ.10459316', 'CO1.REQ.10400004', 'CO1.REQ.10400001', 'CO1.REQ.10254526', 'CO1.REQ.10238192', 'CO1.REQ.10400005', 'CO1.REQ.10400006', 'CO1.REQ.9405198', 'CO1.REQ.9121313', 'CO1.REQ.8981567', 'CO1.REQ.8966905', 'CO1.REQ.7848230']
    )
    eq('total = todos los procesos del radar en la ventana (12)', admin.body.total, 12)
    const vg = admin.body.procesos.find(p => p.id === 'CO1.REQ.10254526')
    eq('VG MEDICAL SAS figura con NIT 901080496 (origen nit), sin marca de vigilado', vg?.proveedor, { nombre: 'VG MEDICAL SAS', nit: VG, origen: 'nit', vigilado: false })
    eq('precio base 1.760 M, fecha "YYYY-MM-DD" sin hora, referencia, estado, línea trauma y neurocirugía, url del expediente', [vg?.precioBase, vg?.fechaPublicacion, vg?.referencia, vg?.estado, vg?.linea, vg?.lineas, vg?.url, vg?.proveedorPersona, vg?.nitEntidad], [
      1_760_000_000,
      desplazar('2026-03-10'),
      '000039-2026',
      'publicado',
      'trauma',
      ['trauma', 'neurocirugia'],
      'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10111634',
      false,
      NIT_CARIBE,
    ])
    const porId = new Map(admin.body.procesos.map(p => [p.id, p]))
    eq('OSTEOEQUIPOS (NIT en la fuente) sale "Vigilado" con la lista activa', porId.get('CO1.REQ.10459316')?.proveedor, { nombre: 'OSTEOEQUIPOS SAS', nit: OSTEOEQUIPOS, origen: 'nit', vigilado: true })
    eq('VG MEDICAL de 2025 solo figura en el título: origen titulo, sin NIT', porId.get('CO1.REQ.9121313')?.proveedor, { nombre: 'VG MEDICAL S.A.S', nit: null, origen: 'titulo', vigilado: false })
    eq('la empresa del título que no es del objeto también sale "según el título" (el comercial pregunta)', porId.get('CO1.REQ.8966905')?.proveedor?.origen, 'titulo')
    eq('TECNITRAUMA S.A. por nombre del proveedor (origen nombre), línea deportiva', [porId.get('CO1.REQ.7848230')?.proveedor, porId.get('CO1.REQ.7848230')?.linea], [{ nombre: 'TECNITRAUMA S.A.', nit: null, origen: 'nombre', vigilado: false }, 'deportiva'])
    eq('persona natural: proveedor null y proveedorPersona true (sin nombre ni documento)', [porId.get('CO1.REQ.10400001')?.proveedor, porId.get('CO1.REQ.10400001')?.proveedorPersona], [null, true])
    eq('título "PERSONA / EMPRESA SAS": figura solo la empresa (origen titulo), sin la persona', porId.get('CO1.REQ.10400005')?.proveedor, { nombre: 'COMERCIALIZADORA DE PRUEBA SAS', nit: null, origen: 'titulo', vigilado: false })
    eq('título con nombre y cédula de una persona: proveedor no publicado (ni empresa ni persona)', [porId.get('CO1.REQ.10400006')?.proveedor, porId.get('CO1.REQ.10400006')?.proveedorPersona], [null, false])
    eq('seleccionado sin contrato cargado sí entra (estado seleccionado)', porId.get('CO1.REQ.10400004')?.estado, 'seleccionado')
    eq('precio base de cada proceso tal cual (nunca sumado)', admin.body.procesos.map(p => p.precioBase), [400_000_000, 400_000_000, 150_000_000, 1_760_000_000, 320_000_000, 60_000_000, 50_000_000, 200_000_000, 1_320_000_000, 1_260_000_000, 100_000_000, 210_000_000])
    const formaProceso: Array<keyof ProcesoDetalle> = ['id', 'referencia', 'entidad', 'nitEntidad', 'precioBase', 'fechaPublicacion', 'lineas', 'linea', 'estado', 'proveedor', 'proveedorPersona', 'url']
    check('cada proceso trae exactamente las claves de ProcesoDetalle', admin.body.procesos.every(p => JSON.stringify(Object.keys(p).sort()) === JSON.stringify([...formaProceso].sort())), admin.body.procesos.map(p => Object.keys(p)))
    const lectura = admin.requests.filter(request => request.table === 'secop_procesos_radar')
    eq(
      'una lectura de la VISTA: solo el NIT de la IPS, la ventana y las columnas del radar (sin descripción ni hash)',
      lectura.map(request => [request.params.get('nit_entidad'), request.params.get('fecha_publicacion'), request.params.getAll('fecha_publicacion'), request.params.get('select')]),
      [[`in.(${NIT_CARIBE})`, `gte.${V24.desde}`, [`gte.${V24.desde}`, `lte.${HOY}`], PROCESO_RADAR_COLUMNAS.replace(/\s/g, '')]]
    )
    check('nunca lee la tabla secop_procesos ni secop_contratos (la exclusión es de la vista)', !admin.requests.some(request => request.table === 'secop_procesos' || request.table === 'secop_contratos'), tablasLeidas(admin.requests))
    check('nunca lee el histórico de contratos (loadContratosEntidad): el REPS ya decide', !admin.requests.some(request => request.table === 'secop_contratos_unicos'), tablasLeidas(admin.requests))
    const ejecutivo = await procesos(fake, EJECUTIVO, IPS_CARIBE)
    eq('sales_manager (Ejecutivo Comercial): 200 y exactamente la misma respuesta que admin', [ejecutivo.status, ejecutivo.text], [200, admin.text])
  }

  print('\nHU de Santander (900006037): procesos con contrato cargado de la misma entidad (vista)')
  {
    const r = await procesos(fake, ADMIN, IPS_HUS)
    textos.push(r.text)
    eq('los dos "Seleccionado" con contrato (por portafolio y por noticeUID en la url del Integrado) no salen; el de juguete sí', [r.status, ids(r.body), r.body?.total], [200, ['CO1.REQ.10999001'], 1])
    eq('el de juguete: proveedor no publicado (ni empresa ni persona), precio base 90 M', [r.body?.procesos[0]?.proveedor, r.body?.procesos[0]?.proveedorPersona, r.body?.procesos[0]?.precioBase], [null, false, 90_000_000])
    check('la vista calculada sí tiene los dos procesos en la tabla (los saca el NOT EXISTS, no la carga)', SECOP_PROCESOS.filter(row => row.nit_entidad === NIT_HUS).length === 3)
  }

  print('\nVista ausente (migración 0890 sin aplicar)')
  {
    const r = await procesos(fakeSinVista, ADMIN, IPS_CARIBE)
    textos.push(r.text)
    eq('200 con total 0 y la misma ventana; Cache-Control no-store', [r.status, r.body, r.cacheControl], [200, { ventana: VENTANA, total: 0, procesos: [] }, 'no-store'])
    const e = await procesos(fakeSinVista, EJECUTIVO, IPS_CARIBE)
    eq('también para un Ejecutivo Comercial', [e.status, e.body?.total], [200, 0])
  }

  print('\nEntidad de compra pública (misma regla que la ficha: marca manual → REPS → contratos cargados)')
  {
    const privada = await procesos(fake, ADMIN, IPS_PRIVADA)
    textos.push(privada.text)
    eq('IPS privada (REPS Privada, sin marca, sin contratos): 200 total 0', [privada.status, privada.body], [200, { ventana: VENTANA, total: 0, procesos: [] }])
    check('IPS privada: no se leen los procesos', !privada.requests.some(request => request.table === 'secop_procesos_radar'), tablasLeidas(privada.requests))
    eq(
      'IPS privada: el criterio 3 se pregunta por existencia (select id, limit 1, su NIT)',
      privada.requests.filter(request => request.table === 'secop_contratos_unicos').map(request => [request.params.get('nit_entidad'), request.params.get('select'), request.params.get('limit')]),
      [[`eq.${NIT_PRIVADA}`, 'id', '1']]
    )
    const marcadaNo = await procesos(fake, ADMIN, IPS_MARCADA_NO)
    eq('marca manual "No" gana al REPS "Pública": total 0', [marcadaNo.status, marcadaNo.body?.total], [200, 0])
    eq('marca manual: no lee el REPS, los contratos ni los procesos', tablasLeidas(marcadaNo.requests).filter(table => table !== 'users' && table !== 'hospitals'), [])
    const historico = await procesos(fake, ADMIN, IPS_HISTORICO)
    eq('REPS "Privada" sin marca y con un contrato histórico cargado: pública (origen contratos) y muestra su proceso', [historico.status, ids(historico.body)], [200, ['CO1.REQ.10999004']])
  }

  print('\nIPS inexistente, inactiva, id no válido y sin NIT')
  {
    const inactiva = await procesos(fake, ADMIN, IPS_INACTIVA)
    const nadie = await procesos(fake, ADMIN, NADIE)
    const malo = await procesos(fake, ADMIN, 'no-es-un-uuid')
    eq('404 inactiva, 404 inexistente, 400 id no UUID', [inactiva.status, nadie.status, malo.status], [404, 404, 400])
    check('404 y 400 sin leer procesos', ![...inactiva.requests, ...nadie.requests, ...malo.requests].some(request => request.table === 'secop_procesos_radar'))
    const sinNit = await procesos(fake, ADMIN, IPS_SIN_NIT)
    eq('sin NIT válido (aunque esté marcada "Sí"): 200 total 0 sin leer nada de SECOP', [sinNit.status, sinNit.body?.total, tablasLeidas(sinNit.requests)], [200, 0, ['users', 'hospitals']])
  }

  print('\nPrivacidad y textos')
  {
    const todo = textos.join('\n')
    const fugas = PROHIBIDOS.filter(texto => todo.includes(texto))
    eq('ninguna respuesta trae la descripción, los documentos, los hashes ni los nombres de las personas de prueba (proveedor, paciente y título), ni lo descartado', fugas, [])
    const enRespuestas = TERMINOS.filter(([re]) => re.test(todo)).map(([, nombre]) => nombre)
    eq('ninguna respuesta dice KAM, panel, representante, sin compras, abierto, en curso, licitación, adjudicado a ni ganó', enRespuestas, [])

    const WEB = path.join(__dirname, '..')
    const tarjeta = readFileSync(path.join(WEB, 'components/HospitalProcesosCard.tsx'), 'utf8')
    // Sin comentarios: lo que queda es código y texto visible
    const visible = tarjeta.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const enTarjeta = TERMINOS.filter(([re]) => re.test(visible)).map(([, nombre]) => nombre)
    eq('la tarjeta no dice KAM, panel, representante, sin compras, abierto, en curso, licitación, adjudicado a ni ganó', enTarjeta, [])
    const usaTextos = ['tituloProcesos', 'notaProcesos', 'proveedorNoPublicado', 'proveedorTitulo', 'proveedorPersona', 'verProceso'].filter(clave => !visible.includes(`T.${clave}`))
    eq('la tarjeta usa los textos de MAPA_DETALLE_TEXTOS (título, nota fija, proveedor, "Ver proceso")', usaTextos, [])
    check('textos de la sección sin palabras prohibidas', !TERMINOS.some(([re]) => re.test([MAPA_DETALLE_TEXTOS.tituloProcesos, MAPA_DETALLE_TEXTOS.notaProcesos, MAPA_DETALLE_TEXTOS.proveedorNoPublicado, MAPA_DETALLE_TEXTOS.proveedorTitulo, MAPA_DETALLE_TEXTOS.proveedorPersona, MAPA_DETALLE_TEXTOS.verProceso].join('\n'))))
    check('la tarjeta pide la ruta de procesos y muestra 5 filas antes de "Ver los N"', visible.includes('/procesos`') && visible.includes('PROCESOS_FICHA_VISIBLES') && visible.includes('Ver los ${data.procesos.length}'))
    check('la tarjeta nunca suma precios base (sin reduce) y abre el expediente aparte', !/\.reduce\(/.test(visible) && visible.includes('rel="noopener noreferrer"') && visible.includes('target="_blank"'))
    check('la tarjeta se esconde sin permiso secop:procesos y con total 0', visible.includes("can('secop:procesos')") && visible.includes('data.total === 0'))
    const pagina = readFileSync(path.join(WEB, 'app/hospitals/[id]/page.tsx'), 'utf8')
    check('la ficha de la IPS monta la tarjeta junto a la de contratación pública', /<HospitalSecopCard hospitalId=\{hospitalId\} \/>[\s\S]{0,300}<HospitalProcesosCard hospitalId=\{hospitalId\} \/>/.test(pagina))
    eq('topes de la ficha: 50 procesos en la respuesta', PROCESOS_FICHA_MAX, 50)
  }

  print('\nGenerales')
  {
    check('ninguna escritura en la base', fake.writes().length === 0 && fakeSinVista.writes().length === 0, [fake.writes(), fakeSinVista.writes()])
    check('ninguna petición salió del Supabase falso', fake.external.length === 0 && fakeSinVista.external.length === 0, [fake.external, fakeSinVista.external])
    const WEB = path.join(__dirname, '..')
    const ruta = readFileSync(path.join(WEB, 'app/api/secop/hospital/[id]/procesos/route.ts'), 'utf8')
    check('la ruta no importa lib/google-distance ni lee el histórico con loadContratosEntidad', !/google-distance|loadContratosEntidad\(/.test(ruta))
    check("la ruta lleva dynamic = 'force-dynamic', requirePermission('secop:procesos') y Cache-Control no-store", ruta.includes("export const dynamic = 'force-dynamic'") && ruta.includes("requirePermission(request, 'secop:procesos')") && ruta.includes("'Cache-Control': 'no-store'"))
  }

  print(`\n${passed} pruebas pasaron, ${failed} fallaron`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`FALLA inesperada: ${error instanceof Error ? error.stack : String(error)}`)
  if (moduleLogs.length > 0) print(`últimos mensajes: ${moduleLogs.slice(-5).join(' | ')}`)
  process.exit(1)
})
