/**
 * Carga de los procesos de SECOP II sin contrato (fuente secop_procesos): pruebas SIN RED de lib/secop-procesos-sync.ts,
 * de la rama del ejecutor (lib/fuentes-runner.ts) y de la definición de la fuente automática (cron, catálogo de "Fuentes
 * de datos", vercel.json). Spec: docs/specs/2026-10-25-secop-procesos-radar.md ("Carga diaria automática").
 *
 * Cómo: un Supabase FALSO en memoria (PostgREST mínimo: select/eq/is/lt/in/order/range/limit, upsert con onConflict,
 * update; RPC sembradas; tabla no sembrada = PGRST205, como una migración sin aplicar) y un datos.gov.co FALSO que
 * reemplaza globalThis.fetch: entiende `nit_entidad in (…)`, `fecha_de_publicacion_del >= …`, `$order`, `$offset` y
 * `$limit` del $where real y responde con filas REALES de p6dx-8zbt (leídas el 2026-10-25). Cualquier otra URL falla.
 *
 * Cubre: tareas de 50 NIT y sus URLs (variantes de 9 y 10 dígitos, prefiltro, fecha, User-Agent de OpMap); upsert por
 * id_proceso en lotes de 500; lotes de un proceso juntos aunque la página se corte en medio; dry-run sin ninguna
 * escritura (ni fuentes_estado) y con la tabla sin crear; el cursor que retoma donde iba; la pasada incremental que relee
 * 120 días y actualiza en su sitio; NIT nuevos con su histórico; la tabla sin crear aborta antes de leer datos.gov.co;
 * consultas que no caben en la invocación; el ejecutor corre la carga propia (no la de MinSalud) y cierra la fila; la
 * fuente nueva va después de las tres de contratos y no entra en loadSecopActualizado.
 *
 * Fixtures: filas reales; todo nombre o documento de persona natural (pacientes, proveedores personas, funcionarios) se
 * reemplazó por uno inventado.
 *
 * Uso (desde web/): npx tsx scripts/secop-procesos-sync-check.ts      Código de salida 1 si alguna prueba falla.
 */
import fs from 'fs'
import path from 'path'
import {
  PROCESOS_UPSERT_LOTE,
  cerrarPasadaProcesos,
  cursorProcesosVacio,
  ejemploProceso,
  filasAConsumir,
  huellaProcesos,
  iniciarPasadaProcesos,
  mensajeProcesos,
  modoProcesos,
  parseProcesosCursor,
  registrarPaginaProcesos,
  sincronizarSecopProcesos,
  tareasProcesos,
  type ProcesosCursor,
} from '../lib/secop-procesos-sync'
import { SECOP_PROCESOS_FUENTE, SECOP_PROCESOS_NOMBRE, SECOP_PROCESOS_PROGRAMACION, type ProcesoRow } from '../lib/secop-procesos'
import { SECOP_PREFILTRO_RAICES, variantesNit, type SecopRaw } from '../lib/secop'
import { hashDocumento } from '../lib/secop-hash'
import { FUENTES, FUENTES_AUTOMATICAS, definicionFuente, esFuenteAutomatica, nextCronRun } from '../lib/fuentes-estado'
import type { SupabaseAdminClient } from '../lib/supabase-admin'

// Sin red ni base real: ninguna variable de entorno de Supabase o Socrata llega a estas pruebas
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SOCRATA_APP_TOKEN']) delete process.env[key]
process.env.GOOGLE_ROUTES_DISABLED = 'true'
const fetchProhibido = (async (input: unknown) => {
  throw new Error(`secop-procesos-sync-check: la red está prohibida (${String(input)})`)
}) as typeof fetch
globalThis.fetch = fetchProhibido

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

async function lanza(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

// ---------------------------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------------------------

/** Los 141 NIT de las IPS públicas objetivo (select nit from secop_nits_ips() where publica; 2026-10-25). */
const NITS_PUBLICOS =
  '800000118,800006850,800014918,800030924,800037021,800058016,800084206,800084362,800099860,800123106,800130625,800152970,800154347,800179870,800191643,800204153,800218979,800231215,800231235,810000913,811016192,812003851,815000316,817001773,819001483,819002025,820003850,821003143,830040256,830067597,832001411,832001966,832010436,835000972,839000145,842000004,846000253,846000471,860009555,860015929,860020283,860024766,890202024,890303461,890399047,890480113,890501019,890501438,890680025,890680031,890700666,890701033,890701353,890701459,890701718,890706823,890706833,890801026,890801099,890801989,890802036,890807591,890904646,890905177,890906347,890907215,890907241,890980066,890980757,890981137,890981536,890981726,890982264,891079999,891080015,891180026,891180098,891180117,891180134,891180268,891200528,891200679,891200952,891411663,891500084,891501676,891580002,891780008,891780185,891800231,891800395,891800570,891800611,891855029,891855039,891855438,891900343,891900441,891901158,892000501,892115009,892115010,892120115,892280033,892300175,892300445,892399994,899999032,899999092,899999147,899999151,899999156,899999163,900006037,900042103,900066347,900067136,900067169,900091143,900136865,900177624,900190045,900196346,900196347,900750333,900958564,900959048,900959051,900971006,901108114,901139193,901361090,901361882,901362090,901362454,901362725,901363087,901440000,901536799,901541021,901700170'.split(',')
const NIT_PRIVADO = '860002184' // IPS activa pero no pública: no es entidad objetivo
const SAL = 'sal-de-prueba-secop-procesos-0123456789abcdef'
const HOSPITAL_CARIBE = '69d32913-2ac6-4a2a-9543-7e0c78191005'
const AHORA = new Date('2026-10-25T06:30:00.000Z')
const ahora = () => AHORA

const rpcNits = (nits: readonly string[]) => [
  ...nits.map((nit, i) => ({ nit, hospital_id: nit === '900042103' ? HOSPITAL_CARIBE : `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, publica: true })),
  { nit: NIT_PRIVADO, hospital_id: '00000000-0000-4000-8000-999999999999', publica: false },
]

// ---------------------------------------------------------------------------------------------
// Filas reales de p6dx-8zbt (2026-10-25; solo los campos que lee la carga)
// ---------------------------------------------------------------------------------------------

const regimen = { modalidad_de_contratacion: 'Contratación régimen especial', adjudicado: 'No', valor_total_adjudicacion: '0', nombre_del_adjudicador: 'No Adjudicado' }
const sinProveedor = { nombre_del_proveedor: 'No Definido', nit_del_proveedor_adjudicado: 'No Definido' }
const url = (notice: string) => ({ url: `https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=${notice}` })

/** HU del Caribe 000039-2026: VG MEDICAL SAS con NIT (empresa), publicado sin contrato. */
const huCaribe: SecopRaw = {
  ...regimen,
  entidad: 'BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE',
  nit_entidad: '900042103',
  id_del_proceso: 'CO1.REQ.10254526',
  referencia_del_proceso: '000039-2026',
  id_del_portafolio: 'CO1.BDOS.10084716',
  nombre_del_procedimiento: 'VG MEDICAL S.A.S',
  descripci_n_del_procedimiento:
    'SUMINISTRO DE MATERIAL MEDICO QUIRURGICO DE OSTEOSINTESIS ( ORTOPEDIA, MAXILOFACIAL, NEUROCIRUGIA) PARA LA ATENCION INTEGRAL EN SALUD DE LOS USUARIOS DE LA E.S.E. HOSPITAL UNIVERSITARIO DEL CARIBE ,DE ACUERDO AL ANEXO TECNICO No. 1 HUC- 2025 (MATERIALES DE OSTEOSINTESIS)',
  fecha_de_publicacion_del: '2026-03-10T00:00:00.000',
  precio_base: '1760000000',
  estado_del_procedimiento: 'Publicado',
  nombre_del_proveedor: 'VG MEDICAL SAS',
  nit_del_proveedor_adjudicado: '901080496',
  codigo_principal_de_categoria: 'V1.42132200',
  tipo_de_contrato: 'Prestación de servicios',
  urlproceso: url('CO1.NTC.10111634'),
}

const OBJETO_MONTERIA = 'SUMINISTRO MATERIAL DE OSTEOSINTESIS DE ORTOPEDIA, MAXILOFACIAL, OTORRINOLARINGOLOGIA Y NEUROCIRUGIA A LA E.S.E HOSPITAL SAN JERONIMO DE MONTERIA.'
const monteria = (id: string, ref: string, fecha: string, precio: string, notice: string, extra: SecopRaw = {}): SecopRaw => ({
  ...regimen,
  ...sinProveedor,
  entidad: 'ESE HOSPITAL SAN JERÓNIMO DE MONTERÍA',
  nit_entidad: '891079999',
  id_del_proceso: id,
  referencia_del_proceso: ref,
  nombre_del_procedimiento: OBJETO_MONTERIA.replace(/, /g, '; '),
  descripci_n_del_procedimiento: OBJETO_MONTERIA,
  fecha_de_publicacion_del: `${fecha}T00:00:00.000`,
  precio_base: precio,
  estado_del_procedimiento: 'Publicado',
  codigo_principal_de_categoria: 'V1.42242000',
  urlproceso: url(notice),
  ...extra,
})
/** Montería: los 3 de 2026, CTO-550-2025 (Evaluación), CTO-1121-2024 (título "KUDHA") y una póliza que no es de ortopedia. */
const monteria015 = monteria('CO1.REQ.9966287', 'CTO-015-2026', '2026-01-29', '720000000', 'CO1.NTC.9875292')
const monteria543 = monteria('CO1.REQ.10338748', 'CTO-543-2026', '2026-04-10', '1070000000', 'CO1.NTC.10196880')
const monteria1116 = monteria('CO1.REQ.10891263', 'CTO-1116-2026', '2026-08-20', '720000000', 'CO1.NTC.10746038')
const monteria550 = monteria('CO1.REQ.8070523', 'CTO-550-2025', '2025-04-03', '800000000', 'CO1.NTC.7948357', { estado_del_procedimiento: 'Evaluación' })
const monteriaKudha = monteria('CO1.REQ.7201473', 'CTO-1121-2024-KUDHA', '2024-11-20', '500000000', 'CO1.NTC.7081260', { nombre_del_procedimiento: 'KUDHA' })
const monteriaPoliza = monteria('CO1.REQ.10270247', 'OC-005-2026', '2026-03-16', '16950765', 'CO1.NTC.10128642', {
  nombre_del_procedimiento: 'COMPRA DE UNA POLIZA TODO RIESGO AUTO (CHASIS Y COMPLEMENTO) Y PÓLIZA DE SUSTRACCIÓN (DOTACIÓN AMBULANCIA) PARA LA AMBULANCIA CON PLACAS OQE268',
  descripci_n_del_procedimiento: 'COMPRA DE UNA POLIZA TODO RIESGO AUTO (CHASIS Y COMPLEMENTO) Y PÓLIZA DE SUSTRACCIÓN (DOTACIÓN AMBULANCIA) PARA LA AMBULANCIA CON PLACAS OQE268, DE PROPIEDAD DE LA E.S.E HOSPITAL SAN JERÓNIMO DE MONTERÍA',
  codigo_principal_de_categoria: 'V1.84131501',
})
/** Variante de Montería publicada ANTES de la ventana de 24 meses (inventada a partir de la real): no se lee. */
const monteriaVieja = monteria('CO1.REQ.6900001', 'CTO-900-2024', '2024-09-15', '400000000', 'CO1.NTC.6900001')

/** HUS DIR-111-2026: régimen especial "Seleccionado" sin adjudicación (su contrato sí está cargado; lo filtra la vista). */
const husSeleccionado: SecopRaw = {
  ...regimen,
  ...sinProveedor,
  entidad: 'E.S.E HOSPITAL UNIVERSITARIO DE SANTANDER',
  nit_entidad: '900006037',
  id_del_proceso: 'CO1.REQ.10091613',
  referencia_del_proceso: 'DIR-111-2026',
  id_del_portafolio: 'CO1.BDOS.9923396',
  nombre_del_procedimiento: 'SUMINISTRO',
  descripci_n_del_procedimiento:
    'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS, ACCESORIOS E INSUMOS EN SUS DIFERENTES CLASIFICACIONES, Y CANTIDADES PARA GARANTIZAR LA ATENCIÓN OPORTUNA Y ADECUADA A LOS PACIENTES QUE REQUIERAN PROCEDIMIENTOS QUIRÚRGICOS EN LOS DIFERENTES SERVICIOS DE INTERNAMIENTO DE LA ESE HOSPITAL UNIVERSITARIO DE SANTANDER',
  fecha_de_publicacion_del: '2026-01-31T00:00:00.000',
  precio_base: '1750000000',
  estado_del_procedimiento: 'Seleccionado',
  codigo_principal_de_categoria: 'V1.41104119',
  urlproceso: url('CO1.NTC.9947922'),
}

/** Hospital Central de la Policía, subasta con 5 lotes adjudicados a MEDTRONIC (vigilado): 5 filas del mismo proceso. */
const LOTES_HOCEN = ['1079312988', '64829562', '132530000', '53125000', '40910555']
const hocenBase: SecopRaw = {
  entidad: 'HOSPITAL CENTRAL DE LA POLICIA',
  nit_entidad: '830067597',
  id_del_proceso: 'CO1.REQ.10269619',
  referencia_del_proceso: 'PN HOCEN SA 003 2026 (Presentación de oferta)',
  id_del_portafolio: 'CO1.BDOS.9787269',
  nombre_del_procedimiento: 'SUMINISTRO DE NEUROESTIMULADORES CEREBRALES; MEDULARES Y BOMBA PARA INFUSIÓN INTRATECAL PARA EL SERVICIO DE NEUROCIRUGIA DEL HOSPITAL CENTRAL',
  descripci_n_del_procedimiento:
    'SUMINISTRO DE NEUROESTIMULADORES CEREBRALES, MEDULARES Y BOMBA PARA INFUSIÓN INTRATECAL PARA EL SERVICIO DE NEUROCIRUGIA DEL HOSPITAL CENTRAL CON DESTINO A LOS USUARIOS DEL SUBSISTEMA DE SALUD DE LA POLICÍA NACIONAL',
  fecha_de_publicacion_del: '2026-03-16T00:00:00.000',
  precio_base: '1370708105',
  modalidad_de_contratacion: 'Selección abreviada subasta inversa',
  estado_del_procedimiento: 'Seleccionado',
  adjudicado: 'Si',
  fecha_adjudicacion: '2026-04-09T00:00:00.000',
  nombre_del_adjudicador: 'FUNCIONARIO DE PRUEBA',
  nombre_del_proveedor: 'MEDTRONIC COLOMBIA S.A. **',
  nit_del_proveedor_adjudicado: '830025149',
  codigo_principal_de_categoria: 'V1.42296100',
  urlproceso: url('CO1.NTC.10127433'),
}
const hocenLotes: SecopRaw[] = LOTES_HOCEN.map(valor => ({ ...hocenBase, valor_total_adjudicacion: valor }))
const SUMA_HOCEN = 1_370_708_105

/** Yolombó MC-HT28052: "material médico quirúrgico" que solo clasifica por UNSPSC → no se guarda. */
const yolombo: SecopRaw = {
  ...regimen,
  ...sinProveedor,
  entidad: 'EMPRESA SOCIAL DEL ESTADO HOSPITAL SAN RAFAEL.*',
  nit_entidad: '890981536',
  id_del_proceso: 'CO1.REQ.10038898',
  referencia_del_proceso: 'MC-HT28052',
  nombre_del_procedimiento: 'MATERIAL MEDICO QUIRURGICO',
  descripci_n_del_procedimiento: 'SUMINISTRO MATERIAL MEDICO QUIRURGICO',
  fecha_de_publicacion_del: '2026-01-29T00:00:00.000',
  precio_base: '4947000',
  estado_del_procedimiento: 'Publicado',
  codigo_principal_de_categoria: 'V1.42321500',
  urlproceso: url('CO1.NTC.9890317'),
}

/** Hospital Luis Ablanque de la Plata CPS-097-2026: servicio de médicos especialistas → no se guarda. */
const servicioMedicos: SecopRaw = {
  ...regimen,
  ...sinProveedor,
  entidad: 'HOSPITAL MUNICIPAL LUIS ABLANQUE DE LA PLATA EMPRESA SOCIAL DEL ESTADO',
  nit_entidad: '835000972',
  id_del_proceso: 'CO1.REQ.10087125',
  referencia_del_proceso: 'CPS-097-2026',
  nombre_del_procedimiento: 'PRESTACION DE SERVICIOS DE MEDICINA ESPECIALIZADA EN ORTOPEDIA Y TRAUMATOLOGIA PARA LOS SERVICIOS ASISTENCIALES DEL HOSPITAL LUIS ABLANQUE DE LA PLATA',
  descripci_n_del_procedimiento: 'PRESTACION DE SERVICIOS DE MEDICINA ESPECIALIZADA EN ORTOPEDIA Y TRAUMATOLOGIA PARA LOS SERVICIOS ASISTENCIALES DEL HOSPITAL LUIS ABLANQUE DE LA PLATA',
  fecha_de_publicacion_del: '2026-02-13T00:00:00.000',
  precio_base: '385000000',
  estado_del_procedimiento: 'Publicado',
  codigo_principal_de_categoria: 'V1.85101604',
  urlproceso: url('CO1.NTC.10028230'),
}

/** Borrador con fecha (inventado sobre una fila de Montería): no se guarda (estado). */
const borrador = monteria('CO1.REQ.10900001', 'CTO-1200-2026', '2026-08-25', '700000000', 'CO1.NTC.10900001', { estado_del_procedimiento: 'Borrador' })

/** María Inmaculada 01268-2026: proveedor persona natural (documento, nombre y título inventados). */
const DOC_PERSONA = '11111111'
const NOMBRE_PERSONA = 'NOMBRE INVENTADO'
const personaNatural: SecopRaw = {
  ...regimen,
  entidad: 'HOSPITAL DEPARTAMENTAL MARIA INMACULADA ESE',
  nit_entidad: '891180098',
  id_del_proceso: 'CO1.REQ.10564574',
  referencia_del_proceso: '01268-2026',
  id_del_portafolio: 'CO1.BDOS.10383556',
  nombre_del_procedimiento: `${NOMBRE_PERSONA} / COMERCIALIZADORA DE PRUEBA`,
  descripci_n_del_procedimiento:
    'REALIZAR EL SUMINISTRO DE ROPA HOSPITALARIA (BATAS QUIRÚRGICAS, PIJAMAS PARA PACIENTES) Y ROPA QUIRÚRGICA (ENVOLVEDERA, CAMPO DE PIEL, FUNDA DE MAYO, SABANA ENVOLVEDERA, CAUCHO DE ORTOPEDIA) DEL HOSPITAL DEPARTAMENTAL MARÍA INMACULADA ESE Y SUS CENTROS DE SALUD ADSCRITOS.',
  fecha_de_publicacion_del: '2026-06-26T00:00:00.000',
  precio_base: '126438340',
  estado_del_procedimiento: 'Publicado',
  nombre_del_proveedor: 'XX',
  nit_del_proveedor_adjudicado: DOC_PERSONA,
  codigo_principal_de_categoria: 'V1.42131501',
  urlproceso: url('CO1.NTC.10420224'),
}

/** HUV ON-91062: plantilla real con paciente (nombre y cédula inventados) → descripción redactada. */
const PACIENTE = 'PEDRO PRUEBA INVENTADO'
const CEDULA_PACIENTE = '12.345.678'
const TEXTO_HUV = `ADQUISICION DE INSUMOS NECESARIOS PARA EL PACIENTE ${PACIENTE} IDENTIFICADO CON CEDULA DE CUIDADANIA ${CEDULA_PACIENTE} QUIEN REQUIERE PROCEDIMIENTO POR PARTE DE LA ESPECIALIDAD DE ORTOPEDIA`
const huvPaciente: SecopRaw = {
  ...regimen,
  ...sinProveedor,
  entidad: 'HUV - HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA E.S.E.',
  nit_entidad: '890303461',
  id_del_proceso: 'CO1.REQ.10102252',
  referencia_del_proceso: 'ON-91062',
  nombre_del_procedimiento: TEXTO_HUV,
  descripci_n_del_procedimiento: TEXTO_HUV,
  fecha_de_publicacion_del: '2026-02-02T00:00:00.000',
  precio_base: '34387950',
  estado_del_procedimiento: 'Publicado',
  codigo_principal_de_categoria: 'V1.42295134',
  urlproceso: url('CO1.NTC.9956962'),
}

const DATASET: SecopRaw[] = [
  huCaribe,
  monteria015,
  monteria543,
  monteria1116,
  monteria550,
  monteriaKudha,
  monteriaPoliza,
  monteriaVieja,
  husSeleccionado,
  ...hocenLotes,
  yolombo,
  servicioMedicos,
  borrador,
  personaNatural,
  huvPaciente,
]
/** Lo que una pasada inicial (desde 2024-10-01) debe dejar en la tabla, ordenado. */
const GUARDADOS_INICIAL = [
  'CO1.REQ.10091613', // HUS seleccionado
  'CO1.REQ.10102252', // HUV (redactado)
  'CO1.REQ.10254526', // HU del Caribe
  'CO1.REQ.10269619', // HOCEN (5 lotes → 1)
  'CO1.REQ.10338748', // Montería CTO-543-2026
  'CO1.REQ.10564574', // persona natural (solo hash)
  'CO1.REQ.10891263', // Montería CTO-1116-2026
  'CO1.REQ.7201473', // Montería CTO-1121-2024
  'CO1.REQ.8070523', // Montería CTO-550-2025 (evaluación)
  'CO1.REQ.9966287', // Montería CTO-015-2026
]

// ---------------------------------------------------------------------------------------------
// Supabase falso (PostgREST mínimo en memoria)
// ---------------------------------------------------------------------------------------------

type Fila = Record<string, unknown>
interface Escritura {
  op: 'upsert' | 'update' | 'insert' | 'delete'
  tabla: string
  filas: number
  onConflict?: string
}
const clonar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function fakeSupabase(semilla: { tablas: Record<string, Fila[]>; rpcs: Record<string, Fila[]> }, opciones: { soloLectura?: boolean } = {}) {
  const tablas = new Map<string, Fila[]>(Object.entries(semilla.tablas).map(([t, filas]) => [t, clonar(filas)]))
  const escrituras: Escritura[] = []
  const lecturas: string[] = []
  const faltante = (t: string) => ({ data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${t}' in the schema cache` } })

  function from(tabla: string) {
    let op: 'select' | Escritura['op'] = 'select'
    let payload: Fila[] | Fila = []
    let conflicto: { onConflict?: string; ignoreDuplicates?: boolean } = {}
    let devolver = false
    const filtros: Array<(r: Fila) => boolean> = []
    let orden: { col: string; asc: boolean } | null = null
    let rango: [number, number] | null = null
    let limite: number | null = null
    const ejecutar = () => {
      const filas = tablas.get(tabla)
      if (op === 'select') lecturas.push(tabla)
      if (!filas) {
        if (op !== 'select') escrituras.push({ op, tabla, filas: Array.isArray(payload) ? payload.length : 1 })
        return faltante(tabla)
      }
      if (op === 'select') {
        let out = filas.filter(r => filtros.every(f => f(r)))
        if (orden) {
          const { col, asc } = orden
          out = [...out].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (asc ? 1 : -1))
        }
        if (rango) out = out.slice(rango[0], rango[1] + 1)
        if (limite !== null) out = out.slice(0, limite)
        return { data: clonar(out), error: null }
      }
      const n = Array.isArray(payload) ? payload.length : 1
      escrituras.push({ op, tabla, filas: n, onConflict: conflicto.onConflict })
      if (opciones.soloLectura) return { data: null, error: { code: '42501', message: `escritura prohibida en esta prueba (${op} ${tabla})` } }
      if (op === 'upsert') {
        const claves = String(conflicto.onConflict ?? 'id').split(',')
        for (const row of payload as Fila[]) {
          const existente = filas.find(r => claves.every(k => r[k] === row[k]))
          if (existente && conflicto.ignoreDuplicates) continue
          if (existente) Object.assign(existente, clonar(row))
          else filas.push(clonar(row))
        }
        return { data: null, error: null }
      }
      if (op === 'update') {
        const afectadas = filas.filter(r => filtros.every(f => f(r)))
        for (const r of afectadas) Object.assign(r, clonar(payload as Fila))
        return { data: devolver ? clonar(afectadas) : null, error: null }
      }
      return { data: null, error: { code: '42501', message: `${op} no soportado en el Supabase falso` } }
    }
    const builder = {
      select(_cols?: string) {
        if (op !== 'select') devolver = true
        return builder
      },
      eq(col: string, value: unknown) {
        filtros.push(r => r[col] === value)
        return builder
      },
      is(col: string, value: unknown) {
        filtros.push(r => (r[col] ?? null) === value)
        return builder
      },
      lt(col: string, value: unknown) {
        filtros.push(r => r[col] !== null && r[col] !== undefined && String(r[col]) < String(value))
        return builder
      },
      in(col: string, values: unknown[]) {
        filtros.push(r => values.includes(r[col]))
        return builder
      },
      order(col: string, o?: { ascending?: boolean }) {
        orden = { col, asc: o?.ascending !== false }
        return builder
      },
      range(a: number, b: number) {
        rango = [a, b]
        return builder
      },
      limit(n: number) {
        limite = n
        return builder
      },
      upsert(rows: Fila[] | Fila, o?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        op = 'upsert'
        payload = Array.isArray(rows) ? rows : [rows]
        conflicto = o ?? {}
        return builder
      },
      update(patch: Fila) {
        op = 'update'
        payload = patch
        return builder
      },
      insert(rows: Fila[] | Fila) {
        op = 'insert'
        payload = Array.isArray(rows) ? rows : [rows]
        return builder
      },
      delete() {
        op = 'delete'
        return builder
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        return Promise.resolve().then(ejecutar).then(resolve, reject)
      },
    }
    return builder
  }
  function rpc(nombre: string) {
    let rango: [number, number] | null = null
    const builder = {
      range(a: number, b: number) {
        rango = [a, b]
        return builder
      },
      then<T>(resolve: (v: unknown) => T, reject?: (e: unknown) => T) {
        const filas = semilla.rpcs[nombre]
        const r = filas ? { data: clonar(rango ? filas.slice(rango[0], rango[1] + 1) : filas), error: null } : { data: null, error: { code: 'PGRST202', message: `function ${nombre} not found` } }
        return Promise.resolve(r).then(resolve, reject)
      },
    }
    return builder
  }
  return { db: { from, rpc } as unknown as SupabaseAdminClient, tablas, escrituras, lecturas }
}

const filaFuente = (cursor: unknown = {}) => ({ fuente: SECOP_PROCESOS_FUENTE, nombre: SECOP_PROCESOS_NOMBRE, programacion: '30 6 * * *', ejecutor: 'vercel_cron', estado: null, ultimo_ok: null, ultimo_intento: null, filas: null, mensaje: null, cursor, siguiente_programado: null, bloqueo_hasta: null })

function semillaBase(opts: { nits?: readonly string[]; conTabla?: boolean; cursor?: unknown; sinFilaFuente?: boolean } = {}) {
  const tablas: Record<string, Fila[]> = {
    fuentes_estado: opts.sinFilaFuente ? [] : [filaFuente(opts.cursor ?? {})],
    secop_proveedores_vigilados: [
      { nit: '830025149', activo: true },
      { nit: '900656724', activo: true },
    ],
    secop_ajustes: [{ id: 1, sal_documentos: SAL }],
  }
  if (opts.conTabla !== false) tablas.secop_procesos = []
  return { tablas, rpcs: { secop_nits_ips: rpcNits(opts.nits ?? NITS_PUBLICOS) } }
}

// ---------------------------------------------------------------------------------------------
// datos.gov.co falso (reemplaza globalThis.fetch mientras dura una prueba)
// ---------------------------------------------------------------------------------------------

interface Peticion {
  url: URL
  where: string
  nits: string[]
  desde: string
  offset: number
  limit: number
  userAgent: string | null
}

function instalarSocrata(dataset: () => readonly SecopRaw[]): Peticion[] {
  const peticiones: Peticion[] = []
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const u = new URL(String(input))
    if (u.origin !== 'https://www.datos.gov.co' || u.pathname !== '/resource/p6dx-8zbt.json') throw new Error(`red prohibida: ${u.toString().slice(0, 120)}`)
    const where = u.searchParams.get('$where') ?? ''
    const nits = (/nit_entidad in \(([^)]*)\)/.exec(where)?.[1] ?? '').split(',').map(v => v.replace(/'/g, '').trim()).filter(Boolean)
    const desde = /fecha_de_publicacion_del >= '([^']+)'/.exec(where)?.[1] ?? ''
    const offset = Number(u.searchParams.get('$offset') ?? 0)
    const limit = Number(u.searchParams.get('$limit') ?? 1000)
    peticiones.push({ url: u, where, nits, desde, offset, limit, userAgent: new Headers(init?.headers).get('user-agent') })
    const elegidas = dataset()
      .filter(r => nits.includes(String(r.nit_entidad)) && typeof r.fecha_de_publicacion_del === 'string' && r.fecha_de_publicacion_del >= desde)
      .sort((a, b) => (String(a.id_del_proceso) < String(b.id_del_proceso) ? -1 : String(a.id_del_proceso) > String(b.id_del_proceso) ? 1 : 0))
    return new Response(JSON.stringify(elegidas.slice(offset, offset + limit)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return peticiones
}

const filasDe = (tablas: Map<string, Fila[]>) => (tablas.get('secop_procesos') ?? []) as unknown as ProcesoRow[]
const idsDe = (tablas: Map<string, Fila[]>) => filasDe(tablas).map(r => r.id_proceso).sort()
const cursorGuardado = (tablas: Map<string, Fila[]>) => parseProcesosCursor(tablas.get('fuentes_estado')?.find(r => r.fuente === SECOP_PROCESOS_FUENTE)?.cursor)
/** Lo que haría cerrarFuente (ejecutor) al terminar la invocación: guarda el cursor final. */
const cerrarComoElEjecutor = (tablas: Map<string, Fila[]>, cursor: ProcesosCursor) => {
  const fila = tablas.get('fuentes_estado')?.find(r => r.fuente === SECOP_PROCESOS_FUENTE)
  if (fila) fila.cursor = clonar(cursor)
}

// =============================================================================================
// 1. Cursor y tareas (puro)
// =============================================================================================
console.log('\n1. Cursor y tareas (puro)')
{
  const vacio = cursorProcesosVacio()
  eq('cursor ilegible o vacío → cursor vacío', [parseProcesosCursor('basura'), parseProcesosCursor(null), parseProcesosCursor({})], [vacio, vacio, vacio])
  eq('primera vez → inicial; con una pasada completa → incremental; forzada → inicial', [
    modoProcesos(vacio),
    modoProcesos({ ...vacio, ultima_pasada: { fin: 'x', modo: 'inicial', desde: '2024-10-01', leidas: 1, guardadas: 1 } }),
    modoProcesos({ ...vacio, ultima_pasada: { fin: 'x', modo: 'inicial', desde: '2024-10-01', leidas: 1, guardadas: 1 } }, true),
  ], ['inicial', 'incremental', 'inicial'])
  eq('una pasada a medias sigue en su modo', modoProcesos({ ...vacio, en_curso: true, modo: 'incremental', desde: '2026-06-27' }), 'incremental')

  const tareas = tareasProcesos([...NITS_PUBLICOS, '900042103'], 'inicial', null)
  eq('141 NIT → tareas de 50, 50 y 41, ordenadas y sin repetidos', tareas.map(t => [t.nits.length, Boolean(t.historico)]), [[50, false], [50, false], [41, false]])
  eq('incremental sin NIT nuevos: las mismas 3 tareas', tareasProcesos(NITS_PUBLICOS, 'incremental', NITS_PUBLICOS).length, 3)
  const conNuevos = tareasProcesos(NITS_PUBLICOS, 'incremental', NITS_PUBLICOS.filter(n => n !== '900042103' && n !== '891079999'))
  eq('incremental con 2 NIT nuevos: + 1 tarea de histórico con esos 2', conNuevos.map(t => [t.nits.length, Boolean(t.historico)]).slice(3), [[2, true]])
  eq('…y sus NIT', conNuevos[3]?.nits, ['891079999', '900042103'])
  check('la huella distingue la tarea de histórico y cambia si cambia la lista', huellaProcesos(conNuevos) !== huellaProcesos(conNuevos.slice(0, 3)) && huellaProcesos(tareas) !== huellaProcesos(tareasProcesos(NITS_PUBLICOS.slice(1), 'inicial', null)))
  eq('la huella es estable', huellaProcesos(tareasProcesos(NITS_PUBLICOS, 'inicial', null)), huellaProcesos(tareas))

  const c0 = iniciarPasadaProcesos(vacio, { ahora: AHORA, huella: 'H1', modo: 'inicial' })
  eq('pasada inicial: desde el primer día de hace 24 meses, tarea 0', [c0.en_curso, c0.modo, c0.desde, c0.desde_historico, c0.paso, c0.offset, c0.inicio_pasada], [true, 'inicial', '2024-10-01', '2024-10-01', 0, 0, AHORA.toISOString()])
  const c1 = registrarPaginaProcesos(c0, { filas: 5000, consumidas: 4998, limite: 5000, guardadas: 30, descartadas: 10 })
  eq('página llena: misma tarea, offset += lo consumido (las 2 filas del último proceso se releen)', [c1.paso, c1.offset, c1.leidas, c1.guardadas, c1.descartadas], [0, 4998, 4998, 30, 10])
  const c2 = registrarPaginaProcesos({ ...c1, agotados: 2 }, { filas: 120, consumidas: 120, limite: 5000, guardadas: 3, descartadas: 1 })
  eq('página incompleta: siguiente tarea desde el offset 0; una página leída reinicia los agotados', [c2.paso, c2.offset, c2.leidas, c2.agotados], [1, 0, 5118, 0])
  eq('retoma: a medias con la misma huella → igual', iniciarPasadaProcesos(c2, { ahora: new Date('2026-10-26T06:30:00Z'), huella: 'H1', modo: 'inicial' }), c2)
  const c3 = iniciarPasadaProcesos(c2, { ahora: new Date('2026-10-26T06:30:00Z'), huella: 'H2', modo: 'inicial' })
  eq('la lista de tareas cambió → tarea 0, offset 0, con las MISMAS fechas', [c3.paso, c3.offset, c3.desde, c3.huella, c3.leidas], [0, 0, '2024-10-01', 'H2', 5118])
  eq('el cursor sobrevive al JSON (fuentes_estado.cursor es jsonb)', parseProcesosCursor(JSON.parse(JSON.stringify(c2))), c2)

  const cerrado = cerrarPasadaProcesos(c2, { ahora: AHORA, nits: ['900042103', '891079999', '900042103'] })
  eq('al cerrar: fuera de curso, resumen, NIT cubiertos ordenados y fin de la inicial', [cerrado.en_curso, cerrado.paso, cerrado.nits_completos, cerrado.ultima_inicial, cerrado.ultima_pasada], [
    false,
    0,
    ['891079999', '900042103'],
    AHORA.toISOString(),
    { fin: AHORA.toISOString(), modo: 'inicial', desde: '2024-10-01', leidas: 5118, guardadas: 33 },
  ])
  const inc = iniciarPasadaProcesos(cerrado, { ahora: AHORA, huella: 'H3', modo: modoProcesos(cerrado) })
  eq('la siguiente es incremental: relee 120 días (hoy − 120) y el histórico de NIT nuevos va 24 meses atrás', [inc.modo, inc.desde, inc.desde_historico, inc.leidas], ['incremental', '2026-06-27', '2024-10-01', 0])
  const forzada = iniciarPasadaProcesos({ ...inc, paso: 2, offset: 100 }, { ahora: AHORA, huella: 'H3', modo: 'inicial', forzarInicial: true })
  eq('--inicial a mitad de una incremental: empieza una inicial desde la tarea 0', [forzada.modo, forzada.desde, forzada.paso, forzada.offset], ['inicial', '2024-10-01', 0, 0])
  eq('cerrar una incremental conserva la fecha de la última inicial', cerrarPasadaProcesos(inc, { ahora: new Date('2026-10-26T06:30:00Z'), nits: [] }).ultima_inicial, AHORA.toISOString())
}
{
  const fila = (id: string) => ({ id_del_proceso: id })
  eq('página incompleta → se procesan todas las filas', filasAConsumir([fila('A'), fila('B')], 5), 2)
  eq('página llena que termina con 3 lotes de un proceso → esos 3 se releen en la siguiente', filasAConsumir([fila('A'), fila('B'), fila('C'), fila('C'), fila('C')], 5), 2)
  eq('página llena que termina con un proceso de una fila → se relee esa fila', filasAConsumir([fila('A'), fila('B'), fila('C')], 3), 2)
  eq('página llena de un solo proceso → se procesa entera (no se puede avanzar sin partirlo)', filasAConsumir([fila('A'), fila('A'), fila('A')], 3), 3)
  eq('página vacía → 0', filasAConsumir([], 5), 0)
}

// =============================================================================================
// 2..n: la carga con Supabase y datos.gov.co falsos
// =============================================================================================

async function pruebasCarga() {
  // -------------------------------------------------------------------------------------------
  console.log('\n2. Pasada inicial: tareas, URLs, upsert por id_proceso, lotes, descartes')
  {
    const peticiones = instalarSocrata(() => DATASET)
    const { db, tablas, escrituras } = fakeSupabase(semillaBase())
    const r = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, ahora })
    const grupos = tareasProcesos(NITS_PUBLICOS, 'inicial', null)
    eq('3 peticiones: una por tarea de 50 NIT (el NIT privado no entra)', peticiones.length, 3)
    eq('cada petición pide los NIT de su tarea en 9 dígitos y 10 con DV, sin guion', peticiones.map(p => p.nits), grupos.map(t => t.nits.flatMap(n => variantesNit(n)).filter(v => /^\d+$/.test(v))))
    check('ninguna petición pide el NIT privado', peticiones.every(p => !p.nits.includes(NIT_PRIVADO)))
    eq('todas desde el 2024-10-01 (24 meses), página 5.000, offset 0, orden por id_del_proceso', peticiones.map(p => [p.desde, p.limit, p.offset, p.url.searchParams.get('$order')]), grupos.map(() => ['2024-10-01T00:00:00.000', 5000, 0, 'id_del_proceso']))
    check('con el prefiltro ortopédico en los dos campos de texto y la UNSPSC V1.4232', peticiones.every(p => SECOP_PREFILTRO_RAICES.every(raiz => p.where.includes(`upper(nombre_del_procedimiento) like '%${raiz}%'`) && p.where.includes(`upper(descripci_n_del_procedimiento) like '%${raiz}%'`)) && p.where.includes("codigo_principal_de_categoria like 'V1.4232%'")))
    check('con el User-Agent de OpMap (fetchJsonSocrata)', peticiones.every(p => (p.userAgent ?? '').startsWith('OpMap-SECOP/')), peticiones.map(p => p.userAgent))
    check('cada URL mide menos de 9,5 KB', peticiones.every(p => p.url.toString().length < 9500), peticiones.map(p => p.url.toString().length))

    eq('quedan en la tabla los 10 procesos esperados (la vieja de 2024-09 ni se leyó)', idsDe(tablas), GUARDADOS_INICIAL)
    eq('leídas 18 (5 lotes de HOCEN), mapeadas 14, procesos 10, descartadas 4', [r.leidas, r.mapeadas, r.guardadas, r.descartadas], [18, 14, 10, 4])
    eq('descartes por motivo: Yolombó por UNSPSC, servicio de médicos, borrador y la póliza sin línea', r.porMotivo, { sin_id: 0, nit_entidad: 0, entidad_no_objetivo: 0, estado: 1, servicio: 1, unspsc: 1, no_clasificado: 1 })
    const upserts = escrituras.filter(e => e.op === 'upsert' && e.tabla === 'secop_procesos')
    check('upsert en secop_procesos por id_proceso (onConflict)', upserts.length > 0 && upserts.every(e => e.onConflict === 'id_proceso'), upserts)
    check('nunca escribe en secop_contratos ni llama a secop_marcar_atipicos', escrituras.every(e => e.tabla === 'secop_procesos' || e.tabla === 'fuentes_estado'), escrituras)

    const porId = new Map(filasDe(tablas).map(f => [f.id_proceso, f]))
    const hocen = porId.get('CO1.REQ.10269619')
    eq('HOCEN: 5 lotes → 1 fila con la suma adjudicada, vigilado y adjudicado', hocen && [hocen.valor_adjudicado, hocen.estado, hocen.proveedor_nit, hocen.proveedor_vigilado_id, hocen.linea], [SUMA_HOCEN, 'adjudicado', '830025149', '830025149', 'neurocirugia'])
    const caribe = porId.get('CO1.REQ.10254526')
    eq('HU del Caribe: publicado, trauma, VG MEDICAL SAS por NIT, IPS resuelta, precio base y fecha', caribe && [caribe.estado, caribe.linea, caribe.proveedor_nombre, caribe.proveedor_nit, caribe.proveedor_origen, caribe.hospital_id, caribe.precio_base, caribe.fecha_publicacion, caribe.portafolio, caribe.notice_uid], [
      'publicado',
      'trauma',
      'VG MEDICAL SAS',
      '901080496',
      'nit',
      HOSPITAL_CARIBE,
      1_760_000_000,
      '2026-03-10',
      'CO1.BDOS.10084716',
      'CO1.NTC.10111634',
    ])
    eq('ultima_lectura = momento de la lectura', caribe?.ultima_lectura, AHORA.toISOString())
    eq('Montería CTO-550-2025: evaluación, sin proveedor', porId.get('CO1.REQ.8070523') && [porId.get('CO1.REQ.8070523')?.estado, porId.get('CO1.REQ.8070523')?.proveedor_origen, porId.get('CO1.REQ.8070523')?.es_persona], ['evaluacion', null, false])
    const persona = porId.get('CO1.REQ.10564574')
    check('persona natural: es_persona y solo el hash (sin NIT, nombre ni origen)', persona !== undefined && persona.es_persona && persona.proveedor_hash === hashDocumento(DOC_PERSONA, SAL) && persona.proveedor_nit === null && persona.proveedor_nombre === null && persona.proveedor_origen === null, persona)
    const tabla = JSON.stringify(filasDe(tablas))
    check('ninguna fila guarda el documento o el nombre de la persona, ni el del paciente', !tabla.includes(DOC_PERSONA) && !tabla.includes(NOMBRE_PERSONA) && !tabla.includes('"XX"') && !tabla.includes('PEDRO') && !tabla.includes(CEDULA_PACIENTE))
    check('ninguna fila guarda el título del proceso (nombre_del_procedimiento) ni el funcionario', !tabla.includes('nombre_del_procedimiento') && !tabla.includes('FUNCIONARIO DE PRUEBA') && !tabla.includes('NEUROESTIMULADORES CEREBRALES; MEDULARES'))
    check('HUV: descripción guardada con "[dato personal omitido]"', porId.get('CO1.REQ.10102252')?.descripcion?.includes('[dato personal omitido]') === true)
    check('ninguna fila tiene columnas de compra (valor, fecha_firma)', filasDe(tablas).every(f => !('valor' in f) && !('fecha_firma' in f)))

    eq('la pasada terminó y el cursor queda cerrado con su resumen', [r.terminado, r.cursor.en_curso, r.cursor.ultima_pasada?.modo, r.cursor.ultima_pasada?.guardadas, r.cursor.nits_completos?.length], [true, false, 'inicial', 10, 141])
    const guardado = cursorGuardado(tablas)
    eq('tras cada página guarda el cursor en fuentes_estado (estado corriendo, bloqueo renovado)', [guardado.en_curso, guardado.paso, tablas.get('fuentes_estado')?.[0]?.estado, typeof tablas.get('fuentes_estado')?.[0]?.bloqueo_hasta], [true, 3, 'corriendo', 'string'])
    check('mensaje final en español y sin palabras prohibidas', /carga inicial .* completa \(18 filas leídas, 10 procesos guardados\)/.test(r.mensaje), r.mensaje)

    // ---------------------------------------------------------------------------------------
    console.log('\n3. Segunda pasada: incremental (relee 120 días) y actualiza en su sitio')
    cerrarComoElEjecutor(tablas, r.cursor)
    const cambiado = DATASET.map(raw => (raw.id_del_proceso === 'CO1.REQ.10891263' ? { ...raw, estado_del_procedimiento: 'Cancelado' } : raw))
    const peticiones2 = instalarSocrata(() => cambiado)
    const r2 = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, ahora })
    eq('incremental: 3 peticiones desde hoy − 120 días (2026-06-27)', peticiones2.map(p => p.desde), ['2026-06-27T00:00:00.000', '2026-06-27T00:00:00.000', '2026-06-27T00:00:00.000'])
    eq('solo relee lo publicado en la ventana (CTO-1116-2026 y el borrador, que no se guarda)', [r2.leidas, r2.guardadas], [2, 1])
    eq('la tabla sigue con los mismos 10 procesos (upsert en su sitio, sin duplicados)', idsDe(tablas), GUARDADOS_INICIAL)
    const m1116 = filasDe(tablas).find(f => f.id_proceso === 'CO1.REQ.10891263')
    eq('el proceso que SECOP canceló queda cancelado (la vista del radar ya no lo muestra)', m1116?.estado, 'cancelado')
    eq('lo publicado antes de la ventana no se toca', filasDe(tablas).find(f => f.id_proceso === 'CO1.REQ.10254526')?.estado, 'publicado')
    eq('la incremental cierra con su modo', [r2.terminado, r2.cursor.ultima_pasada?.modo, r2.cursor.ultima_inicial], [true, 'incremental', AHORA.toISOString()])
    check('mensaje de la incremental', r2.mensaje.includes('relectura de los últimos 120 días (desde 2026-06-27) completa'), r2.mensaje)

    console.log('\n4. NIT nuevo: su histórico de 24 meses entra en la incremental')
    cerrarComoElEjecutor(tablas, { ...r2.cursor, nits_completos: NITS_PUBLICOS.filter(n => n !== '900042103') })
    const peticiones3 = instalarSocrata(() => DATASET)
    const r3 = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, ahora })
    const variantes = (nits: readonly string[]) => nits.flatMap(n => variantesNit(n)).filter(v => /^\d+$/.test(v))
    eq(
      '4 tareas: las 3 de 120 días (todos los NIT) y una de histórico (24 meses) con el NIT nuevo',
      peticiones3.map(p => [p.desde, p.nits]),
      [...tareasProcesos(NITS_PUBLICOS, 'inicial', null).map(t => ['2026-06-27T00:00:00.000', variantes(t.nits)]), ['2024-10-01T00:00:00.000', variantes(['900042103'])]]
    )
    eq('al cerrar, el NIT queda entre los cubiertos', [r3.terminado, r3.cursor.nits_completos?.includes('900042103')], [true, true])
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n5. Cursor que retoma y lotes partidos por el corte de página')
  {
    // Un solo NIT (HOCEN) con 2 procesos antes, los 5 lotes y 1 después. Página de 6 filas:
    //   p1 (offset 0): A B L1 L2 L3 L4 → llena: procesa A B; los lotes se releen → offset 2
    //   p2 (offset 2): L1 L2 L3 L4 L5 C → llena: procesa los 5 lotes; C se relee → offset 7
    //   p3 (offset 7): C → incompleta: procesa C y termina la tarea
    const otro = (id: string, ref: string) => ({ ...hocenBase, id_del_proceso: id, referencia_del_proceso: ref, adjudicado: 'No', valor_total_adjudicacion: '0', estado_del_procedimiento: 'Publicado', modalidad_de_contratacion: 'Contratación régimen especial', fecha_adjudicacion: undefined })
    const datos = [otro('CO1.REQ.10000001', 'A'), otro('CO1.REQ.10000002', 'B'), ...hocenLotes, otro('CO1.REQ.10300000', 'C')]
    const peticiones = instalarSocrata(() => datos)
    const { db, tablas } = fakeSupabase(semillaBase({ nits: ['830067597'] }))
    const corridas: Array<Awaited<ReturnType<typeof sincronizarSecopProcesos>>> = []
    for (let i = 0; i < 4; i++) {
      const r = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 6, maxPaginas: 1, ahora })
      corridas.push(r)
      if (r.terminado) {
        cerrarComoElEjecutor(tablas, r.cursor)
        break
      }
    }
    eq('3 invocaciones de una página: offsets 0, 2 y 7 (cada una retoma el cursor guardado)', peticiones.map(p => p.offset), [0, 2, 7])
    eq('las dos primeras quedan a medias; la tercera termina', corridas.map(r => r.terminado), [false, false, true])
    eq('cursor guardado tras la primera: tarea 0, offset 2, a medias', [corridas[0].cursor.en_curso, corridas[0].cursor.paso, corridas[0].cursor.offset], [true, 0, 2])
    eq('4 procesos en la tabla', idsDe(tablas), ['CO1.REQ.10000001', 'CO1.REQ.10000002', 'CO1.REQ.10269619', 'CO1.REQ.10300000'])
    eq('HOCEN con la suma de LOS 5 lotes (no quedó partido entre páginas)', filasDe(tablas).find(f => f.id_proceso === 'CO1.REQ.10269619')?.valor_adjudicado, SUMA_HOCEN)
    eq('leídas sin contar dos veces las filas releídas', corridas.reduce((a, r) => a + r.leidas, 0), 8)
    check('mensaje a medias: tarea y "sigue en la próxima ejecución"', corridas[0].mensaje.includes('a medias, tarea 1 de 1') && corridas[0].mensaje.includes('sigue en la próxima ejecución'), corridas[0].mensaje)
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n6. Upsert en lotes de 500')
  {
    const muchos = Array.from({ length: 1200 }, (_, i) => monteria(`CO1.REQ.${20000000 + i}`, `CTO-${i}-2026`, '2026-05-01', '100000000', `CO1.NTC.${20000000 + i}`))
    instalarSocrata(() => muchos)
    const { db, tablas, escrituras } = fakeSupabase(semillaBase({ nits: ['891079999'] }))
    const r = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, ahora })
    eq(`PROCESOS_UPSERT_LOTE = 500`, PROCESOS_UPSERT_LOTE, 500)
    eq('1.200 procesos → upserts de 500, 500 y 200 (onConflict id_proceso)', escrituras.filter(e => e.op === 'upsert').map(e => [e.filas, e.onConflict]), [[500, 'id_proceso'], [500, 'id_proceso'], [200, 'id_proceso']])
    eq('1.200 filas en la tabla', [r.guardadas, filasDe(tablas).length], [1200, 1200])
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n7. Dry-run: no escribe nada (ni fuentes_estado) y funciona sin la tabla')
  {
    const peticiones = instalarSocrata(() => DATASET)
    const semilla = semillaBase({ conTabla: false, cursor: { en_curso: false } })
    const { db, tablas, escrituras, lecturas } = fakeSupabase(semilla, { soloLectura: true })
    const antes = JSON.stringify(tablas.get('fuentes_estado'))
    const logs: string[] = []
    const r = await sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, maxPaginas: 1, dryRun: true, soloNits: ['900042103', '891079999', '891180098', '999999999'], ahora, log: m => logs.push(m) })
    eq('ninguna escritura (ni secop_procesos, ni fuentes_estado, ni otra)', escrituras, [])
    eq('fuentes_estado queda igual', JSON.stringify(tablas.get('fuentes_estado')), antes)
    check('sin la tabla secop_procesos (0890 sin aplicar) igual funciona: ni la consulta', !lecturas.includes('secop_procesos'), lecturas)
    eq('una sola petición, solo con los NIT pedidos que son objetivo', [peticiones.length, peticiones[0]?.nits], [1, ['891079999', '891180098', '900042103'].flatMap(n => variantesNit(n)).filter(v => /^\d+$/.test(v))])
    eq('lee, mapea y cuenta lo que guardaría', [r.leidas, r.mapeadas, r.guardadas, r.porMotivo.no_clasificado, r.porMotivo.estado], [9, 7, 7, 1, 1])
    eq('3 ejemplos', r.ejemplos.length, 3)
    const texto = r.ejemplos.join('\n')
    check('ejemplo de empresa por NIT: VG MEDICAL SAS con su NIT', texto.includes('CO1.REQ.10254526') && texto.includes('VG MEDICAL SAS (NIT 901080496), por NIT') && texto.includes('precio base 1.760.000.000'), r.ejemplos)
    check('ejemplo sin proveedor: "Proveedor no publicado"', texto.includes('Proveedor no publicado'), r.ejemplos)
    check('los ejemplos no traen nombre, documento ni hash de personas, ni la descripción', !texto.includes(DOC_PERSONA) && !texto.includes(NOMBRE_PERSONA) && !texto.includes(hashDocumento(DOC_PERSONA, SAL)) && !texto.includes('SUMINISTRO'), r.ejemplos)
    check('se avisa del NIT pedido que no es entidad objetivo', logs.some(l => l.includes('999999999') && l.includes('no son entidades objetivo')), logs)
    check('el log dice DRY-RUN', logs.some(l => l.includes('DRY-RUN')))
    const persona = ejemploProceso(personaFila())
    check('ejemplo de persona natural: "persona natural (sin nombre ni documento)", sin el hash', persona.includes('persona natural (sin nombre ni documento)') && !persona.includes(hashDocumento(DOC_PERSONA, SAL)), persona)
    eq('soloNits sin dry-run → error (no cambia la pasada guardada)', (await lanza(() => sincronizarSecopProcesos({ db, deadline: Infinity, pageSize: 10, soloNits: ['900042103'], ahora })))?.includes('dry-run'), true)
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n8. Sin la migración 0890 (y sin dry-run): para antes de leer datos.gov.co')
  {
    const peticiones = instalarSocrata(() => DATASET)
    const { db, escrituras } = fakeSupabase(semillaBase({ conTabla: false }))
    const error = await lanza(() => sincronizarSecopProcesos({ db, deadline: Number.POSITIVE_INFINITY, pageSize: 5000, ahora }))
    check('error claro que nombra la migración 0890', error !== null && error.includes('0890'), error)
    eq('ninguna petición a datos.gov.co ni escritura', [peticiones.length, escrituras.length], [0, 0])
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n9. Consulta que no cabe en la invocación (cron de 50 s)')
  {
    globalThis.fetch = fetchProhibido
    const timeout = async () => {
      throw Object.assign(new Error('datos.gov.co no respondió en 45 s'), { name: 'TimeoutError' })
    }
    const { db, tablas } = fakeSupabase(semillaBase())
    const r = await sincronizarSecopProcesos({ db, deadline: Date.now() + 50_000, pageSize: 2000, fetchJson: timeout, ahora })
    eq('no lanza: queda a medias con agotados = 1 y sin escribir procesos', [r.terminado, r.agotado, r.cursor.agotados, filasDe(tablas).length], [false, true, 1, 0])
    check('el mensaje lo dice', r.mensaje.includes('no cupo en el tiempo'), r.mensaje)
    const { db: db2 } = fakeSupabase(semillaBase({ cursor: { ...r.cursor, agotados: 2 } }))
    const error = await lanza(() => sincronizarSecopProcesos({ db: db2, deadline: Date.now() + 50_000, pageSize: 2000, fetchJson: timeout, ahora }))
    check('a la tercera vez seguida: error que pide correr el script', error !== null && error.includes('scripts/secop-procesos-load.ts'), error)
    const { db: db3 } = fakeSupabase(semillaBase())
    const r3 = await sincronizarSecopProcesos({ db: db3, deadline: Date.now() + 10_000, pageSize: 2000, fetchJson: timeout, ahora })
    eq('con menos de 15 s no empieza ninguna página', [r3.paginas, r3.agotado, r3.terminado], [0, false, false])
  }

  // -------------------------------------------------------------------------------------------
  console.log('\n10. Ejecutor (cron y "Actualizar ahora"): rama propia, bloqueo y cierre')
  {
    // El ejecutor no deja inyectar el reloj: las fechas se ponen en "hoy" (la vieja, en el 2000) para que la prueba no
    // dependa del día en que corre
    const hoyReal = new Date().toISOString().slice(0, 10)
    const deHoy = DATASET.map(raw => ({ ...raw, fecha_de_publicacion_del: raw === monteriaVieja ? '2000-01-01T00:00:00.000' : `${hoyReal}T00:00:00.000` }))
    const peticiones = instalarSocrata(() => deHoy)
    const { db, tablas } = fakeSupabase(semillaBase({ sinFilaFuente: true }))
    const { ejecutarFuente } = await import('../lib/fuentes-runner')
    const r = await ejecutarFuente('secop_procesos', { db, presupuestoMs: Number.POSITIVE_INFINITY, origen: 'script' })
    eq('corre la carga de procesos y termina ok', [r.ok, r.estado, r.terminado, r.filas], [true, 'ok', true, 10])
    check('solo pidió p6dx-8zbt (no cayó en la carga de MinSalud ni en la de contratos)', peticiones.length === 3 && peticiones.every(p => p.url.pathname === '/resource/p6dx-8zbt.json'))
    const fila = tablas.get('fuentes_estado')?.find(f => f.fuente === SECOP_PROCESOS_FUENTE)
    eq('crea la fila de fuentes_estado si no existe y la cierra: ok, filas, sin bloqueo, próxima 06:30 UTC', fila && [fila.nombre, fila.programacion, fila.estado, fila.filas, fila.bloqueo_hasta, typeof fila.ultimo_ok, fila.siguiente_programado], [
      SECOP_PROCESOS_NOMBRE,
      '30 6 * * *',
      'ok',
      10,
      null,
      'string',
      nextCronRun('30 6 * * *', new Date(String(fila?.ultimo_ok)))?.toISOString(),
    ])
    eq('el cursor guardado queda cerrado (la próxima es incremental)', [cursorGuardado(tablas).en_curso, modoProcesos(cursorGuardado(tablas))], [false, 'incremental'])
    eq('10 procesos en la tabla', idsDe(tablas), GUARDADOS_INICIAL)
  }
  {
    instalarSocrata(() => DATASET)
    const { db, tablas } = fakeSupabase(semillaBase({ conTabla: false }))
    const { ejecutarFuente } = await import('../lib/fuentes-runner')
    const r = await ejecutarFuente('secop_procesos', { db, presupuestoMs: 50_000, origen: 'cron' })
    const fila = tablas.get('fuentes_estado')?.[0]
    check('sin la migración el ejecutor no lanza: cierra la fila con error y el motivo', !r.ok && r.estado === 'error' && fila?.estado === 'error' && String(fila?.mensaje).includes('0890') && fila?.bloqueo_hasta === null, { r, fila })
  }
  globalThis.fetch = fetchProhibido

  // -------------------------------------------------------------------------------------------
  console.log('\n11. "SECOP actualizado el…" de compras no mira la fuente de procesos')
  {
    const { loadSecopActualizado } = await import('../app/api/secop/_lib/secop-server')
    const { db } = fakeSupabase({ tablas: { fuentes_estado: FUENTES.map(f => ({ ...filaFuente(), fuente: f.id, nombre: f.nombre, ultimo_ok: '2026-10-25T06:00:00Z' })) }, rpcs: {} })
    eq('loadSecopActualizado: solo secop_ii, secop_i y secop_integrado', Object.keys(await loadSecopActualizado(db)).sort(), ['secop_i', 'secop_ii', 'secop_integrado'])
  }
}

/** Fila mínima de persona natural para el ejemplo de dry-run. */
function personaFila(): ProcesoRow {
  return {
    id_proceso: 'CO1.REQ.10564574',
    portafolio: null,
    notice_uid: null,
    referencia: '01268-2026',
    nit_entidad: '891180098',
    nombre_entidad: null,
    hospital_id: null,
    modalidad: null,
    tipo_contrato: null,
    estado_secop: 'Publicado',
    estado: 'publicado',
    adjudicado: false,
    precio_base: 126438340,
    valor_adjudicado: null,
    fecha_publicacion: '2026-06-26',
    fecha_adjudicacion: null,
    proveedor_nit: null,
    proveedor_nombre: null,
    proveedor_origen: null,
    proveedor_hash: hashDocumento(DOC_PERSONA, SAL),
    es_persona: true,
    proveedor_vigilado_id: null,
    descripcion: 'REALIZAR EL SUMINISTRO DE ROPA HOSPITALARIA',
    linea: 'otros_implantes',
    lineas: ['otros_implantes'],
    motivo: 'generico',
    clasificacion_version: 'v2',
    categoria_unspsc: null,
    url: null,
    ultima_lectura: null,
  }
}

// =============================================================================================
// 12. Definición de la fuente automática (cron, catálogo, vercel.json, migración)
// =============================================================================================
async function pruebasDefinicion() {
  console.log('\n12. Fuente automática: definición, cron, catálogo y vercel.json')
  const ids = FUENTES.map(f => f.id)
  eq('las tres primeras siguen siendo las de contratos (secop-check) y secop_procesos va justo después', [ids.slice(0, 3), ids.indexOf('secop_procesos')], [['secop_ii', 'secop_i', 'secop_integrado'], 3])
  const def = definicionFuente('secop_procesos')
  eq('secop_procesos: nombre, cron 06:30 UTC diario y Vercel Cron (los mismos de lib/secop-procesos.ts)', [def.nombre, def.programacion, def.ejecutor], [SECOP_PROCESOS_NOMBRE, SECOP_PROCESOS_PROGRAMACION, 'vercel_cron'])
  check('es automática: el cron /api/cron/secop_procesos y "Actualizar ahora" la aceptan', esFuenteAutomatica('secop_procesos') && FUENTES_AUTOMATICAS.includes('secop_procesos'))
  eq('próxima ejecución: mañana 06:30 UTC', nextCronRun(def.programacion, new Date('2026-10-25T07:00:00Z'))?.toISOString(), '2026-10-26T06:30:00.000Z')

  const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }>; functions: Record<string, { maxDuration?: number }> }
  eq('vercel.json: cron /api/cron/secop_procesos a las 30 6 * * *', vercel.crons.filter(c => c.path === '/api/cron/secop_procesos'), [{ path: '/api/cron/secop_procesos', schedule: '30 6 * * *' }])
  check('cada fuente de Vercel Cron tiene su cron con la misma programación', FUENTES.filter(f => f.ejecutor === 'vercel_cron').every(f => vercel.crons.some(c => c.path === `/api/cron/${f.id}` && c.schedule === f.programacion)))
  eq('la ruta del cron puede durar 60 s', vercel.functions['app/api/cron/[fuente]/route.ts']?.maxDuration, 60)

  const migracion = fs.readFileSync(path.resolve(__dirname, '..', '..', 'database', 'migrations', '2026-10-25_0890_secop_procesos.sql'), 'utf8')
  check('la fila que siembra la 0890 coincide con la definición', migracion.includes(`('${SECOP_PROCESOS_FUENTE}', '${SECOP_PROCESOS_NOMBRE}', '${SECOP_PROCESOS_PROGRAMACION}', 'vercel_cron')`))

  const { FUENTES_CATALOGO } = await import('../app/api/fuentes/_lib/catalogo')
  const item = FUENTES_CATALOGO.find(f => f.fuente === 'secop_procesos')
  eq('"Fuentes de datos": aparece, diaria, ligera, con "Actualizar ahora"', item && [item.nombre, item.frecuencia, item.tipo, item.manual], [SECOP_PROCESOS_NOMBRE, 'Diaria', 'ligera', true])
  check('su "cómo" nombra el cron, la ventana de 120 días y el script de la carga inicial', item !== undefined && item.como.includes('/api/cron/secop_procesos') && item.como.includes('120 días') && item.como.includes('scripts/secop-procesos-load.ts'), item?.como)

  const vacio = cursorProcesosVacio()
  const textos = [
    item?.como ?? '',
    item?.nombre ?? '',
    mensajeProcesos({ terminado: false, cursor: { ...vacio, en_curso: true, desde: '2024-10-01' }, leidas: 1, guardadas: 1 }, 3),
    mensajeProcesos({ terminado: true, cursor: { ...vacio, modo: 'incremental', desde: '2026-06-27' }, leidas: 1, guardadas: 1 }, 3),
    ejemploProceso(personaFila()),
  ].join('\n')
  const prohibidas = /\b(abiert[oa]s?|en curso|licitaci[oó]n|adjudicado a|sin compras|kam|panel|representante)\b/i
  check('textos visibles de la fuente sin "abierto", "en curso", "licitación", "adjudicado a", "sin compras", "KAM", "panel" ni "representante"', !prohibidas.test(textos), textos.match(prohibidas))
}

pruebasCarga()
  .then(pruebasDefinicion)
  .catch(error => {
    failed++
    console.log(`  FALLA las pruebas lanzaron: ${error instanceof Error ? error.stack : String(error)}`)
  })
  .finally(() => {
    globalThis.fetch = fetchProhibido
    console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
    process.exit(failed > 0 ? 1 : 0)
  })
