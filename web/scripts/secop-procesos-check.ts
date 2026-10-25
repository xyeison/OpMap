/**
 * Procesos de SECOP II sin contrato (radar comercial): pruebas puras del mapeo y las reglas (sin red ni base de datos).
 * Spec: docs/specs/2026-10-25-secop-procesos-radar.md ("Criterios de aceptación · Mapeo y reglas").
 *
 * Cubre: la fila real CO1.REQ.10254526 del HU del Caribe (publicado, trauma + neurocirugía, precio base 1.760 M, fecha
 * 'YYYY-MM-DD', portafolio, noticeUID, VG MEDICAL SAS con NIT y origen 'nit', url del expediente); las tres de Montería
 * de 2026 (publicado, trauma, sin proveedor); los estados (Publicado, Evaluación, Seleccionado con y sin adjudicación,
 * Abierto, Cancelado, Suspendido; Borrador, En aprobación y Aprobado no se guardan); el proveedor que figura en orden
 * (NIT de empresa, nombre con marca jurídica, título con marca jurídica y sin verbo de objeto; cédula o nombre sin
 * marca → persona, solo hash); Yolombó solo por UNSPSC y servicios de médicos fuera; redacción de pacientes (y que no
 * toca "PACIENTES" genérico ni números de contrato o resolución); URL SoQL (NIT de 9 y 10 dígitos sin guion, prefiltro
 * en los dos campos de texto y UNSPSC V1.4232, fecha de publicación); lotes en una fila por id_proceso y el mismo
 * proceso leído dos veces en su sitio; el permiso secop:procesos; loadProcesosRadar y loadSecopActualizado (con un
 * cliente falso, sin red).
 *
 * Fixtures: filas REALES de p6dx-8zbt (datos.gov.co, leídas el 2026-10-25). Todo nombre o documento de persona natural
 * (funcionarios, pacientes, proveedores personas) se reemplazó por uno inventado.
 *
 * Uso (desde web/): npx tsx scripts/secop-procesos-check.ts      Código de salida 1 si alguna prueba falla.
 */
import {
  DATO_PERSONAL_OMITIDO,
  DOCUMENTO_OMITIDO,
  PROCESOS_TAREA_TAMANO,
  PROCESOS_UPSERT_CONFLICTO,
  PROCESO_ESTADOS,
  PROCESO_RADAR_COLUMNAS,
  SECOP_PROCESOS_DATASET,
  SECOP_PROCESOS_FUENTE,
  SECOP_PROCESOS_PROGRAMACION,
  agregarLotes,
  buildProcesosTareas,
  buildProcesosUrl,
  desdeProcesos,
  estadoDeProceso,
  mapSecopProceso,
  proveedorQueFigura,
  redactarDatosPersonales,
  type ProcesoMapContext,
  type ProcesoMapResult,
  type ProcesoRow,
} from '../lib/secop-procesos'
import { SECOP_PREFILTRO_RAICES, pasaPrefiltro, variantesNit, type SecopRaw } from '../lib/secop'
import { hashDocumento } from '../lib/secop-hash'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import type { SupabaseAdminClient } from '../lib/supabase-admin'

// Sin red: cualquier fetch falla (las lecturas de abajo usan un cliente falso que no hace fetch)
globalThis.fetch = (async () => {
  throw new Error('secop-procesos-check: la red está prohibida en estas pruebas')
}) as typeof fetch

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

// ---------------------------------------------------------------------------------------------
// Contexto y filas reales
// ---------------------------------------------------------------------------------------------

/** Los 141 NIT de las IPS públicas objetivo (select nit from secop_nits_ips() where publica; 2026-10-25). */
const NITS_PUBLICOS =
  '800000118,800006850,800014918,800030924,800037021,800058016,800084206,800084362,800099860,800123106,800130625,800152970,800154347,800179870,800191643,800204153,800218979,800231215,800231235,810000913,811016192,812003851,815000316,817001773,819001483,819002025,820003850,821003143,830040256,830067597,832001411,832001966,832010436,835000972,839000145,842000004,846000253,846000471,860009555,860015929,860020283,860024766,890202024,890303461,890399047,890480113,890501019,890501438,890680025,890680031,890700666,890701033,890701353,890701459,890701718,890706823,890706833,890801026,890801099,890801989,890802036,890807591,890904646,890905177,890906347,890907215,890907241,890980066,890980757,890981137,890981536,890981726,890982264,891079999,891080015,891180026,891180098,891180117,891180134,891180268,891200528,891200679,891200952,891411663,891500084,891501676,891580002,891780008,891780185,891800231,891800395,891800570,891800611,891855029,891855039,891855438,891900343,891900441,891901158,892000501,892115009,892115010,892120115,892280033,892300175,892300445,892399994,899999032,899999092,899999147,899999151,899999156,899999163,900006037,900042103,900066347,900067136,900067169,900091143,900136865,900177624,900190045,900196346,900196347,900750333,900958564,900959048,900959051,900971006,901108114,901139193,901361090,901361882,901362090,901362454,901362725,901363087,901440000,901536799,901541021,901700170'.split(',')

const SAL = 'sal-de-prueba-secop-procesos-0123456789abcdef'
const HOSPITAL_CARIBE = '69d32913-2ac6-4a2a-9543-7e0c78191005'
const ctx: ProcesoMapContext = {
  hashDocumento: digitos => hashDocumento(digitos, SAL),
  entidades: new Set(NITS_PUBLICOS),
  hospitalPorNit: new Map([['900042103', HOSPITAL_CARIBE]]),
  vigilados: new Set(['830025149', '900656724']),
  ahora: '2026-10-25T06:30:00.000Z',
}

const filaDe = (r: ProcesoMapResult): ProcesoRow | null => ('row' in r ? r.row : null)
const motivoDe = (r: ProcesoMapResult): string | null => ('descartado' in r ? r.descartado : null)

/** HU del Caribe, 000039-2026 (fila completa de p6dx-8zbt; ninguna persona natural). */
const huCaribe: SecopRaw = {
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
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10111634' },
  codigo_entidad: '719185811',
  estado_resumen: 'Presentación de oferta',
}

/** ESE San Jerónimo de Montería, procesos de osteosíntesis de 2026 (filas reales; sin proveedor en ningún campo). */
const monteriaBase: SecopRaw = {
  entidad: 'ESE HOSPITAL SAN JERÓNIMO DE MONTERÍA',
  nit_entidad: '891079999',
  departamento_entidad: 'Córdoba',
  ciudad_entidad: 'No Definido',
  ordenentidad: 'Territorial',
  codigo_pci: 'Centralizada',
  ppi: '703924308',
  fase: 'Presentación de oferta',
  modalidad_de_contratacion: 'Contratación régimen especial',
  justificaci_n_modalidad_de: 'Regla aplicable',
  unidad_de_duracion: 'Mes(es)',
  ciudad_de_la_unidad_de: 'No Aplica',
  nombre_de_la_unidad_de: 'CONTRATACION',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Publicado',
  id_estado_del_procedimiento: '50',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: 'No Definido',
  departamento_proveedor: 'No Definido',
  ciudad_proveedor: 'No Definido',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
  codigo_principal_de_categoria: 'V1.42242000',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Suministros',
  subtipo_de_contrato: 'No Definido',
  categorias_adicionales: 'No definido',
  codigo_entidad: '703924308',
  estado_resumen: 'Presentación de oferta',
}
const OBJETO_MONTERIA_TILDES =
  'SUMINISTRO MATERIAL DE OSTEOSINTESIS DE ORTOPEDIA, MAXILOFACIAL, OTORRINOLARINGOLOGÍA Y NEUROCIRUGÍA A LA E.S.E HOSPITAL SAN JERÓNIMO DE MONTERÍA.'
const TITULO_MONTERIA_TILDES =
  'SUMINISTRO MATERIAL DE OSTEOSINTESIS DE ORTOPEDIA; MAXILOFACIAL; OTORRINOLARINGOLOGÍA Y NEUROCIRUGÍA A LA E.S.E HOSPITAL SAN JERÓNIMO DE MONTERÍA.'
const monteria015: SecopRaw = {
  ...monteriaBase,
  id_del_proceso: 'CO1.REQ.9966287',
  referencia_del_proceso: 'CTO-015-2026',
  id_del_portafolio: 'CO1.BDOS.9797641',
  nombre_del_procedimiento: TITULO_MONTERIA_TILDES,
  descripci_n_del_procedimiento: OBJETO_MONTERIA_TILDES,
  fase: 'Fase de ofertas',
  estado_resumen: 'Fase de ofertas',
  fecha_de_publicacion_del: '2026-01-29T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-01-29T00:00:00.000',
  precio_base: '720000000',
  duracion: '3',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9875292' },
}
const monteria543: SecopRaw = {
  ...monteriaBase,
  id_del_proceso: 'CO1.REQ.10338748',
  referencia_del_proceso: 'CTO-543-2026',
  id_del_portafolio: 'CO1.BDOS.10165977',
  nombre_del_procedimiento: TITULO_MONTERIA_TILDES,
  descripci_n_del_procedimiento: OBJETO_MONTERIA_TILDES,
  fecha_de_publicacion_del: '2026-04-10T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-04-10T00:00:00.000',
  precio_base: '1070000000',
  duracion: '4',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10196880' },
}
const monteria1116: SecopRaw = {
  ...monteriaBase,
  id_del_proceso: 'CO1.REQ.10891263',
  referencia_del_proceso: 'CTO-1116-2026',
  id_del_portafolio: 'CO1.BDOS.10707638',
  nombre_del_procedimiento:
    'SUMINISTRO MATERIAL DE OSTEOSINTESIS DE ORTOPEDIA; MAXILOFACIAL; OTORRINOLARINGOLOGIA Y NEUROCIRUGIA A LA E.S.E HOSPITAL SAN JERONIMO DE MONTERIA.',
  descripci_n_del_procedimiento:
    'SUMINISTRO MATERIAL DE OSTEOSINTESIS DE ORTOPEDIA, MAXILOFACIAL, OTORRINOLARINGOLOGIA Y NEUROCIRUGIA A LA E.S.E HOSPITAL SAN JERONIMO DE MONTERIA.',
  fecha_de_publicacion_del: '2026-08-20T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-08-20T00:00:00.000',
  precio_base: '720000000',
  duracion: '3',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10746038' },
}

const DESCRIPCION_HUS =
  'SUMINISTRO DE MATERIAL DE OSTEOSÍNTESIS, ACCESORIOS E INSUMOS EN SUS DIFERENTES CLASIFICACIONES, Y CANTIDADES PARA GARANTIZAR LA ATENCIÓN OPORTUNA Y ADECUADA A LOS PACIENTES QUE REQUIERAN PROCEDIMIENTOS QUIRÚRGICOS EN LOS DIFERENTES SERVICIOS DE INTERNAMIENTO DE LA ESE HOSPITAL UNIVERSITARIO DE SANTANDER'
/** HUS, DIR-111-2026: régimen especial "Seleccionado" sin adjudicación (fila real; su contrato CO1.PCCNTR.9314318 sí está cargado). */
const husSeleccionado: SecopRaw = {
  entidad: 'E.S.E HOSPITAL UNIVERSITARIO DE SANTANDER',
  nit_entidad: '900006037',
  departamento_entidad: 'Santander',
  ciudad_entidad: 'Bucaramanga',
  id_del_proceso: 'CO1.REQ.10091613',
  referencia_del_proceso: 'DIR-111-2026',
  id_del_portafolio: 'CO1.BDOS.9923396',
  nombre_del_procedimiento: 'SUMINISTRO',
  descripci_n_del_procedimiento: DESCRIPCION_HUS,
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-01-31T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-01-31T00:00:00.000',
  precio_base: '1750000000',
  modalidad_de_contratacion: 'Contratación régimen especial',
  duracion: '90',
  unidad_de_duracion: 'día(s)',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Seleccionado',
  id_estado_del_procedimiento: '70',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: 'No Definido',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
  codigo_principal_de_categoria: 'V1.41104119',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Decreto 092 de 2017',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9947922' },
  estado_resumen: 'Presentación de oferta',
}
/** HUS, INV PUB - 08 - 2026: "con ofertas", Seleccionado y adjudicado = Si (fila real; el funcionario, inventado). */
const husAdjudicado: SecopRaw = {
  ...husSeleccionado,
  id_del_proceso: 'CO1.REQ.10418025',
  referencia_del_proceso: 'INV PUB - 08 - 2026',
  id_del_portafolio: 'CO1.BDOS.10242131',
  fecha_de_publicacion_del: '2026-05-08T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-05-08T00:00:00.000',
  precio_base: '4425000000',
  modalidad_de_contratacion: 'Contratación régimen especial (con ofertas)',
  duracion: '206',
  fecha_de_recepcion_de: '2026-05-13T00:00:00.000',
  adjudicado: 'Si',
  id_adjudicacion: 'CO1.AWD.2593860',
  codigoproveedor: '703094730',
  fecha_adjudicacion: '2026-05-20T00:00:00.000',
  valor_total_adjudicacion: '4425000000',
  nombre_del_adjudicador: 'FUNCIONARIO DE PRUEBA',
  nombre_del_proveedor: 'JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S',
  nit_del_proveedor_adjudicado: 'No Definido',
  codigo_principal_de_categoria: 'V1.42321500',
  estado_de_apertura_del_proceso: 'Cerrado',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10278711' },
  estado_resumen: 'Adjudicado',
}

/**
 * Hospital Departamental María Inmaculada, 01268-2026: el proveedor es una persona natural (documento de 8 dígitos).
 * Fila real con el documento, el nombre del proveedor, el código de SECOP y el título (que nombraba a la persona)
 * reemplazados por valores inventados.
 */
const DOC_PERSONA = '11111111'
const NOMBRE_PERSONA_TITULO = 'NOMBRE INVENTADO'
const personaNatural: SecopRaw = {
  entidad: 'HOSPITAL DEPARTAMENTAL MARIA INMACULADA ESE',
  nit_entidad: '891180098',
  departamento_entidad: 'Caquetá',
  ciudad_entidad: 'No Definido',
  id_del_proceso: 'CO1.REQ.10564574',
  referencia_del_proceso: '01268-2026',
  id_del_portafolio: 'CO1.BDOS.10383556',
  nombre_del_procedimiento: `${NOMBRE_PERSONA_TITULO} / COMERCIALIZADORA DE PRUEBA`,
  descripci_n_del_procedimiento:
    'REALIZAR EL SUMINISTRO DE ROPA HOSPITALARIA (BATAS QUIRÚRGICAS, PIJAMAS PARA PACIENTES) Y ROPA QUIRÚRGICA (ENVOLVEDERA, CAMPO DE PIEL, FUNDA DE MAYO, SABANA ENVOLVEDERA, CAUCHO DE ORTOPEDIA) DEL HOSPITAL DEPARTAMENTAL MARÍA INMACULADA ESE Y SUS CENTROS DE SALUD ADSCRITOS.',
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-06-26T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-06-26T00:00:00.000',
  precio_base: '126438340',
  modalidad_de_contratacion: 'Contratación régimen especial',
  duracion: '98',
  unidad_de_duracion: 'día(s)',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Publicado',
  id_estado_del_procedimiento: '50',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: '700000000',
  departamento_proveedor: 'Caquetá',
  ciudad_proveedor: 'Florencia',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'XX',
  nit_del_proveedor_adjudicado: DOC_PERSONA,
  codigo_principal_de_categoria: 'V1.42131501',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Decreto 092 de 2017',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10420224' },
  estado_resumen: 'Presentación de oferta',
}

/**
 * HUV, ON-91062: plantilla real "ADQUISICION DE INSUMOS … PARA EL PACIENTE <NOMBRE> IDENTIFICADO CON CEDULA DE
 * CIUDADANIA <NUM> QUIEN REQUIERE…" (con el error "CUIDADANIA" de la fuente). Nombre y número inventados.
 */
const PACIENTE = 'PEDRO PRUEBA INVENTADO'
const CEDULA_PACIENTE = '12.345.678'
const huvPaciente: SecopRaw = {
  entidad: 'HUV - HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA E.S.E.',
  nit_entidad: '890303461',
  departamento_entidad: 'Valle del Cauca',
  ciudad_entidad: 'Cali',
  id_del_proceso: 'CO1.REQ.10102252',
  referencia_del_proceso: 'ON-91062',
  id_del_portafolio: 'CO1.BDOS.9934729',
  nombre_del_procedimiento: `ADQUISICION DE INSUMOS NECESARIOS PARA EL PACIENTE ${PACIENTE} IDENTIFICADO CON CEDULA DE CUIDADANIA ${CEDULA_PACIENTE} QUIEN REQUIERE PROCEDIMIENTO POR PARTE DE LA ESPECIALIDAD DE ORTOPEDIA`,
  descripci_n_del_procedimiento: `ADQUISICION DE INSUMOS NECESARIOS PARA EL PACIENTE ${PACIENTE} IDENTIFICADO CON CEDULA DE CUIDADANIA ${CEDULA_PACIENTE} QUIEN REQUIERE PROCEDIMIENTO POR PARTE DE LA ESPECIALIDAD DE ORTOPEDIA`,
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-02-02T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-02-02T00:00:00.000',
  precio_base: '34387950',
  modalidad_de_contratacion: 'Contratación régimen especial',
  duracion: '30',
  unidad_de_duracion: 'día(s)',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Publicado',
  id_estado_del_procedimiento: '50',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: 'No Definido',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
  codigo_principal_de_categoria: 'V1.42295134',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Decreto 092 de 2017',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9956962' },
  estado_resumen: 'Presentación de oferta',
}

/** ESE Hospital San Rafael de Yolombó, MC-HT28052: orden de "material médico quirúrgico" que solo clasifica por UNSPSC. */
const yolombo: SecopRaw = {
  entidad: 'EMPRESA SOCIAL DEL ESTADO HOSPITAL SAN RAFAEL.*',
  nit_entidad: '890981536',
  departamento_entidad: 'Antioquia',
  ciudad_entidad: 'Yolombó',
  id_del_proceso: 'CO1.REQ.10038898',
  referencia_del_proceso: 'MC-HT28052',
  id_del_portafolio: 'CO1.BDOS.9870943',
  nombre_del_procedimiento: 'MATERIAL MEDICO QUIRURGICO',
  descripci_n_del_procedimiento: 'SUMINISTRO MATERIAL MEDICO QUIRURGICO',
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-01-29T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-01-29T00:00:00.000',
  precio_base: '4947000',
  modalidad_de_contratacion: 'Contratación régimen especial',
  duracion: '120',
  unidad_de_duracion: 'día(s)',
  numero_de_lotes: '0',
  estado_del_procedimiento: 'Publicado',
  id_estado_del_procedimiento: '50',
  adjudicado: 'No',
  id_adjudicacion: 'No Adjudicado',
  codigoproveedor: 'No Definido',
  valor_total_adjudicacion: '0',
  nombre_del_adjudicador: 'No Adjudicado',
  nombre_del_proveedor: 'No Definido',
  nit_del_proveedor_adjudicado: 'No Definido',
  codigo_principal_de_categoria: 'V1.42321500',
  estado_de_apertura_del_proceso: 'Abierto',
  tipo_de_contrato: 'Suministros',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9890317' },
  estado_resumen: 'Presentación de oferta',
}

/**
 * Hospital Central de la Policía, PN HOCEN SA 003 2026: subasta inversa con 5 lotes adjudicados = 5 filas del mismo
 * id_del_proceso con su valor de lote (filas reales; el funcionario que adjudicó, inventado).
 */
const hocenBase: SecopRaw = {
  entidad: 'HOSPITAL CENTRAL DE LA POLICIA',
  nit_entidad: '830067597',
  departamento_entidad: 'Distrito Capital de Bogotá',
  ciudad_entidad: 'Bogotá',
  id_del_proceso: 'CO1.REQ.10269619',
  referencia_del_proceso: 'PN HOCEN SA 003 2026 (Presentación de oferta)',
  id_del_portafolio: 'CO1.BDOS.9787269',
  nombre_del_procedimiento:
    'SUMINISTRO DE NEUROESTIMULADORES CEREBRALES; MEDULARES Y BOMBA PARA INFUSIÓN INTRATECAL PARA EL SERVICIO DE NEUROCIRUGIA DEL HOSPITAL CENTRAL CON DESTINO A LOS USUARIOS DEL SUBSISTEMA DE SALUD DE LA P',
  descripci_n_del_procedimiento:
    'SUMINISTRO DE NEUROESTIMULADORES CEREBRALES, MEDULARES Y BOMBA PARA INFUSIÓN INTRATECAL PARA EL SERVICIO DE NEUROCIRUGIA DEL HOSPITAL CENTRAL CON DESTINO A LOS USUARIOS DEL SUBSISTEMA DE SALUD DE LA POLICÍA NACIONAL',
  fase: 'Presentación de oferta',
  fecha_de_publicacion_del: '2026-03-16T00:00:00.000',
  fecha_de_ultima_publicaci: '2026-03-16T00:00:00.000',
  precio_base: '1370708105',
  modalidad_de_contratacion: 'Selección abreviada subasta inversa',
  duracion: '90',
  unidad_de_duracion: 'día(s)',
  fecha_de_recepcion_de: '2026-03-24T00:00:00.000',
  numero_de_lotes: '5',
  estado_del_procedimiento: 'Seleccionado',
  id_estado_del_procedimiento: '70',
  adjudicado: 'Si',
  id_adjudicacion: 'CO1.AWD.2548738',
  codigoproveedor: '701968125',
  fecha_adjudicacion: '2026-04-09T00:00:00.000',
  nombre_del_adjudicador: 'FUNCIONARIO DE PRUEBA',
  nombre_del_proveedor: 'MEDTRONIC COLOMBIA S.A. **',
  nit_del_proveedor_adjudicado: '830025149',
  codigo_principal_de_categoria: 'V1.42296100',
  estado_de_apertura_del_proceso: 'Cerrado',
  tipo_de_contrato: 'Suministros',
  urlproceso: { url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10127433' },
  estado_resumen: 'Adjudicado',
}
const LOTES_HOCEN = ['1079312988', '64829562', '132530000', '53125000', '40910555']
const hocenLotes: SecopRaw[] = LOTES_HOCEN.map(valor => ({ ...hocenBase, valor_total_adjudicacion: valor }))

// ---------------------------------------------------------------------------------------------
// 1. La fila real del HU del Caribe
// ---------------------------------------------------------------------------------------------
console.log('\n1. HU del Caribe, CO1.REQ.10254526 (000039-2026)')
const caribe = filaDe(mapSecopProceso(huCaribe, ctx))
check('se guarda', caribe !== null, mapSecopProceso(huCaribe, ctx))
if (caribe) {
  eq('estado publicado, línea trauma y lineas con neurocirugía', [caribe.estado, caribe.linea, caribe.lineas.includes('neurocirugia'), caribe.lineas], ['publicado', 'trauma', true, ['trauma', 'neurocirugia']])
  eq('precio base 1.760.000.000 y fecha_publicacion "2026-03-10" (texto, sin hora)', [caribe.precio_base, caribe.fecha_publicacion], [1_760_000_000, '2026-03-10'])
  eq('portafolio y noticeUID', [caribe.portafolio, caribe.notice_uid], ['CO1.BDOS.10084716', 'CO1.NTC.10111634'])
  eq('proveedor VG MEDICAL SAS con NIT 901080496, origen nit, empresa', [caribe.proveedor_nombre, caribe.proveedor_nit, caribe.proveedor_origen, caribe.es_persona, caribe.proveedor_hash], [
    'VG MEDICAL SAS',
    '901080496',
    'nit',
    false,
    null,
  ])
  eq('url = expediente', caribe.url, 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10111634')
  eq('entidad, IPS de OpMap, referencia, modalidad, estado de SECOP, sin adjudicación', [caribe.nit_entidad, caribe.hospital_id, caribe.referencia, caribe.modalidad, caribe.estado_secop, caribe.adjudicado, caribe.valor_adjudicado, caribe.fecha_adjudicacion], [
    '900042103',
    HOSPITAL_CARIBE,
    '000039-2026',
    'Contratación régimen especial',
    'Publicado',
    false,
    null,
    null,
  ])
  check('VG MEDICAL no es vigilado (es la empresa propia)', caribe.proveedor_vigilado_id === null)
  check('la descripción se guarda (sin pacientes no cambia)', caribe.descripcion === String(huCaribe.descripci_n_del_procedimiento))
  eq('clasificación y lectura', [caribe.motivo, caribe.clasificacion_version, caribe.categoria_unspsc, caribe.ultima_lectura], ['multiple', 'v2', 'V1.42132200', '2026-10-25T06:30:00.000Z'])
  const claves = Object.keys(caribe)
  check('sin columnas de compra (valor, fecha_firma) ni el título del proceso', !claves.includes('valor') && !claves.includes('fecha_firma') && !claves.includes('nombre') && !claves.includes('titulo'))
  check('el título "VG MEDICAL S.A.S" no se guarda (solo el nombre del proveedor)', !JSON.stringify(caribe).includes('VG MEDICAL S.A.S'))
}

// ---------------------------------------------------------------------------------------------
// 2. Montería 2026
// ---------------------------------------------------------------------------------------------
console.log('\n2. ESE San Jerónimo de Montería 2026 (CTO-015, CTO-543, CTO-1116)')
for (const raw of [monteria015, monteria543, monteria1116]) {
  const row = filaDe(mapSecopProceso(raw, ctx))
  eq(`${String(raw.referencia_del_proceso)}: publicado, trauma, sin proveedor`, row && [row.estado, row.linea, row.proveedor_nit, row.proveedor_nombre, row.proveedor_origen, row.es_persona, row.proveedor_hash], [
    'publicado',
    'trauma',
    null,
    null,
    null,
    false,
    null,
  ])
}
eq('precios base y fechas', [monteria015, monteria543, monteria1116].map(raw => {
  const row = filaDe(mapSecopProceso(raw, ctx))
  return row && [row.precio_base, row.fecha_publicacion, row.notice_uid]
}), [
  [720_000_000, '2026-01-29', 'CO1.NTC.9875292'],
  [1_070_000_000, '2026-04-10', 'CO1.NTC.10196880'],
  [720_000_000, '2026-08-20', 'CO1.NTC.10746038'],
])
check('el título con "E.S.E" no se toma como proveedor: lleva verbo de objeto (SUMINISTRO)', proveedorQueFigura(monteria015).tipo === 'ninguno')

// ---------------------------------------------------------------------------------------------
// 3. Estados
// ---------------------------------------------------------------------------------------------
console.log('\n3. Estados')
eq('Publicado / Evaluación / Abierto', [estadoDeProceso('Publicado', 'No'), estadoDeProceso('Evaluación', 'No'), estadoDeProceso('Abierto', 'No')], ['publicado', 'evaluacion', 'abierto'])
eq('Seleccionado → seleccionado; con adjudicado = Si → adjudicado', [estadoDeProceso('Seleccionado', 'No'), estadoDeProceso('Seleccionado', 'Si'), estadoDeProceso('Seleccionado', 'Sí')], ['seleccionado', 'adjudicado', 'adjudicado'])
eq('Cancelado y Suspendido → cancelado', [estadoDeProceso('Cancelado', 'No'), estadoDeProceso('Suspendido', 'No')], ['cancelado', 'cancelado'])
eq('Borrador, En aprobación y Aprobado no se guardan (null)', [estadoDeProceso('Borrador', 'No'), estadoDeProceso('En aprobación', 'No'), estadoDeProceso('Aprobado', 'No')], [null, null, null])
eq('estado vacío o desconocido no se guarda', [estadoDeProceso(undefined, undefined), estadoDeProceso('Estado raro', 'No')], [null, null])
check('los estados guardados son los del CHECK de la 0890', PROCESO_ESTADOS.join(',') === 'publicado,evaluacion,abierto,seleccionado,adjudicado,cancelado')
const hus = filaDe(mapSecopProceso(husSeleccionado, ctx))
eq('HUS DIR-111-2026 (real): Seleccionado sin adjudicación → seleccionado, trauma, sin proveedor', hus && [hus.estado, hus.linea, hus.adjudicado, hus.portafolio, hus.proveedor_origen], ['seleccionado', 'trauma', false, 'CO1.BDOS.9923396', null])
const husAdj = filaDe(mapSecopProceso(husAdjudicado, ctx))
eq('HUS INV PUB 08 (real, con ofertas): Seleccionado + adjudicado = Si → adjudicado, con valor y fecha de adjudicación', husAdj && [husAdj.estado, husAdj.adjudicado, husAdj.valor_adjudicado, husAdj.fecha_adjudicacion], ['adjudicado', true, 4_425_000_000, '2026-05-20'])
check('el funcionario que adjudicó no se guarda en ninguna columna', !JSON.stringify(husAdj).includes('FUNCIONARIO DE PRUEBA'))
eq('Borrador → descartado por estado', motivoDe(mapSecopProceso({ ...huCaribe, estado_del_procedimiento: 'Borrador' }, ctx)), 'estado')
{
  // Socrata omite las claves nulas: sin fecha de publicación (como HUS DIR-331-2026, CO1.REQ.10368358) se guarda con null
  const sinFecha: SecopRaw = { ...husSeleccionado, id_del_proceso: 'CO1.REQ.10368358', referencia_del_proceso: 'DIR-331-2026', id_del_portafolio: 'CO1.BDOS.10194542', precio_base: '550000000' }
  delete sinFecha.fecha_de_publicacion_del
  delete sinFecha.fecha_de_ultima_publicaci
  const row = filaDe(mapSecopProceso(sinFecha, ctx))
  eq('fila sin fecha_de_publicacion_del (clave omitida): se guarda con fecha null', row && [row.fecha_publicacion, row.precio_base], [null, 550_000_000])
}

// ---------------------------------------------------------------------------------------------
// 4. Proveedor que figura
// ---------------------------------------------------------------------------------------------
console.log('\n4. Proveedor que figura')
const hashPersona = hashDocumento(DOC_PERSONA, SAL)
eq('(a) NIT de empresa con DV (10 dígitos) → 9 dígitos, origen nit', proveedorQueFigura({ nit_del_proveedor_adjudicado: '8110178715', nombre_del_proveedor: 'INDUSTRIAS MEDICAS SAMPEDRO.' }), {
  tipo: 'empresa',
  nit: '811017871',
  nombre: 'INDUSTRIAS MEDICAS SAMPEDRO.',
  origen: 'nit',
})
eq('(a) con NIT de empresa el nombre se guarda aunque no diga SAS', proveedorQueFigura({ nit_del_proveedor_adjudicado: '901080496', nombre_del_proveedor: 'TRAUMASUR' }), { tipo: 'empresa', nit: '901080496', nombre: 'TRAUMASUR', origen: 'nit' })
eq('(b) sin NIT, nombre del proveedor con marca jurídica → empresa sin NIT, origen nombre (HUS INV PUB 08)', proveedorQueFigura(husAdjudicado), {
  tipo: 'empresa',
  nit: null,
  nombre: 'JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S',
  origen: 'nombre',
})
eq('(b) marcas: UNION TEMPORAL, LTDA, S.A., E.U.', ['UNION TEMPORAL OSTEO 2026', 'IMPLANTECH LTDA', 'BIOART S.A.', 'PROMED QUIRURGICOS E.U.'].map(n => proveedorQueFigura({ nombre_del_proveedor: n }).tipo), ['empresa', 'empresa', 'empresa', 'empresa'])
eq('(c) título con marca jurídica y sin verbo de objeto → empresa, origen titulo (HU del Caribe 2025)', proveedorQueFigura({ ...huCaribe, nit_del_proveedor_adjudicado: 'No Definido', nombre_del_proveedor: 'No Definido' }), {
  tipo: 'empresa',
  nit: null,
  nombre: 'VG MEDICAL S.A.S',
  origen: 'titulo',
})
eq('(c) título con verbo de objeto, rótulo de trámite o igual a la descripción → no es proveedor', [
  proveedorQueFigura({ nombre_del_procedimiento: 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS ESE HOSPITAL' }).tipo,
  proveedorQueFigura({ nombre_del_procedimiento: 'CONVOCATORIA PÚBLICA ABREVIADA 002 DEL 2026' }).tipo,
  proveedorQueFigura({ nombre_del_procedimiento: 'MEDICAL SAS', descripci_n_del_procedimiento: 'MEDICAL S.A.S' }).tipo,
  proveedorQueFigura({ nombre_del_procedimiento: 'ORTOPEDIA' }).tipo,
], ['ninguno', 'ninguno', 'ninguno', 'ninguno'])
eq('(a) gana a (b) y (c); (b) gana a (c)', [
  proveedorQueFigura({ nit_del_proveedor_adjudicado: '900303413', nombre_del_proveedor: 'OSTEOCOL SAS', nombre_del_procedimiento: 'OTRA EMPRESA SAS' }),
  proveedorQueFigura({ nombre_del_proveedor: 'OSTEOCOL SAS', nombre_del_procedimiento: 'OTRA EMPRESA SAS' }),
], [
  { tipo: 'empresa', nit: '900303413', nombre: 'OSTEOCOL SAS', origen: 'nit' },
  { tipo: 'empresa', nit: null, nombre: 'OSTEOCOL SAS', origen: 'nombre' },
])
eq('cédula → persona con solo el hash de los dígitos (aunque el nombre diga SAS)', [
  proveedorQueFigura(personaNatural, d => hashDocumento(d, SAL)),
  proveedorQueFigura({ nit_del_proveedor_adjudicado: '22222222', nombre_del_proveedor: 'NEUROSERVIS SAS' }, d => hashDocumento(d, SAL)),
], [
  { tipo: 'persona', hash: hashPersona },
  { tipo: 'persona', hash: hashDocumento('22222222', SAL) },
])
eq('nombre del proveedor sin marca jurídica y sin documento → persona sin hash (nunca se guarda el nombre)', proveedorQueFigura({ nombre_del_proveedor: 'NOMBRE APELLIDO APELLIDO', nit_del_proveedor_adjudicado: 'No Definido' }), { tipo: 'persona', hash: null })
eq('título que parece persona (sin marca) → ninguno: no se toma ni se guarda', proveedorQueFigura({ nombre_del_procedimiento: 'NOMBRE APELLIDO APELLIDO' }), { tipo: 'ninguno' })
eq('"No Definido" en todo → ninguno', proveedorQueFigura(monteria1116), { tipo: 'ninguno' })

// Revisión 2026-10-25: el título (y el nombre del proveedor) nunca deja pasar un nombre de persona, un documento ni la
// propia entidad compradora. Nombres y números inventados.
const SIN_PROVEEDOR = { nit_del_proveedor_adjudicado: 'No Definido', nombre_del_proveedor: 'No Definido' }
eq('(c) "PERSONA / EMPRESA SAS" sin documento: solo el tramo con marca, nunca el nombre de la persona', proveedorQueFigura({ nombre_del_procedimiento: 'NOMBRE INVENTADO APELLIDO / COMERCIALIZADORA XYZ SAS' }), {
  tipo: 'empresa',
  nit: null,
  nombre: 'COMERCIALIZADORA XYZ SAS',
  origen: 'titulo',
})
eq('(c) título con cédula, número de documento, "SEÑORA" o "PACIENTE" → ninguno (ni el nombre ni el documento)', [
  proveedorQueFigura({ nombre_del_procedimiento: 'NOMBRE INVENTADO APELLIDO CC 1234567 EPS DE PRUEBA SA' }),
  proveedorQueFigura({ nombre_del_procedimiento: 'NOMBRE INVENTADO 1.234.567 EPS DE PRUEBA SA' }),
  proveedorQueFigura({ nombre_del_procedimiento: 'NOMBRE INVENTADO 12345678 DISTRIBUIDORA SAS' }),
  proveedorQueFigura({ nombre_del_procedimiento: 'SEÑORA NOMBRE INVENTADO SAS' }),
  proveedorQueFigura({ nombre_del_procedimiento: 'PACIENTE NOMBRE INVENTADO SAS' }),
].map(p => p.tipo), ['ninguno', 'ninguno', 'ninguno', 'ninguno', 'ninguno'])
eq('(b) nombre del proveedor con cédula → persona sin hash; "PERSONA / EMPRESA SAS" → solo la empresa', [
  proveedorQueFigura({ nombre_del_proveedor: 'NOMBRE INVENTADO CC 1234567 DISTRIBUIDORA SAS', nit_del_proveedor_adjudicado: 'No Definido' }),
  proveedorQueFigura({ nombre_del_proveedor: 'NOMBRE INVENTADO APELLIDO / DISTRIBUIDORA DE PRUEBA SAS', nit_del_proveedor_adjudicado: 'No Definido' }),
], [
  { tipo: 'persona', hash: null },
  { tipo: 'empresa', nit: null, nombre: 'DISTRIBUIDORA DE PRUEBA SAS', origen: 'nombre' },
])
eq('tramos reales: se quita el tramo sin marca; con marca en todos queda entero; un código con guiones o "376/2025" no parte', [
  'TRAUMASUR - TIENDA DE LA SALUD S.A.S',
  'NORTESANTANDEREANA DE ORTOPEDIA Y TRAUMATOLOGIA S.A. - NORTRAUMA S.A.',
  'OAJ-2025-0348-ORTOVAGRAN SAS',
  'PN UPRE VALLE SA SI 376/2025 OSTEOSINTESIS',
].map(t => {
  const p = proveedorQueFigura({ nombre_del_procedimiento: t })
  return p.tipo === 'empresa' ? p.nombre : p.tipo
}), ['TIENDA DE LA SALUD S.A.S', 'NORTESANTANDEREANA DE ORTOPEDIA Y TRAUMATOLOGIA S.A. - NORTRAUMA S.A.', 'OAJ-2025-0348-ORTOVAGRAN SAS', 'PN UPRE VALLE SA SI 376/2025 OSTEOSINTESIS'])
{
  const conPersona = filaDe(mapSecopProceso({ ...personaNatural, ...SIN_PROVEEDOR, nombre_del_procedimiento: `${NOMBRE_PERSONA_TITULO} APELLIDO / COMERCIALIZADORA DE PRUEBA SAS` }, ctx))
  check(
    'fila real con "PERSONA / EMPRESA SAS" en el título: guarda solo la empresa (origen titulo) y ningún rastro de la persona',
    conPersona !== null && conPersona.proveedor_nombre === 'COMERCIALIZADORA DE PRUEBA SAS' && conPersona.proveedor_origen === 'titulo' && !conPersona.es_persona && !JSON.stringify(conPersona).includes(NOMBRE_PERSONA_TITULO) && !JSON.stringify(conPersona).includes('APELLIDO'),
    conPersona
  )
  const conCedula = filaDe(mapSecopProceso({ ...personaNatural, ...SIN_PROVEEDOR, nombre_del_procedimiento: `${NOMBRE_PERSONA_TITULO} CC 1234567 EPS DE PRUEBA SA` }, ctx))
  check(
    'fila real con cédula en el título: sin proveedor y sin el nombre ni el documento',
    conCedula !== null && conCedula.proveedor_nombre === null && conCedula.proveedor_origen === null && !JSON.stringify(conCedula).includes('1234567') && !JSON.stringify(conCedula).includes(NOMBRE_PERSONA_TITULO),
    conCedula
  )
}
eq('(c) el título que es la propia entidad (HU del Caribe, Montería) no es el proveedor', [
  proveedorQueFigura({ ...huCaribe, ...SIN_PROVEEDOR, nombre_del_procedimiento: 'HOSPITAL UNIVERSITARIO DEL CARIBE E.S.E.' }),
  proveedorQueFigura({ ...monteria015, nombre_del_procedimiento: 'E.S.E. HOSPITAL SAN JERONIMO DE MONTERIA' }),
], [{ tipo: 'ninguno' }, { tipo: 'ninguno' }])
eq('(c) solo E.S.E. o IPS → ninguno; IPS con SAS sí es empresa; el nombre de la entidad con otra marca (FUNDACION) → ninguno', [
  proveedorQueFigura({ nombre_del_procedimiento: 'CLINICA DE PRUEBA IPS' }).tipo,
  proveedorQueFigura({ nombre_del_procedimiento: 'TORAUMAX IPS SAS', entidad: 'E.S.E HOSPITAL SANDIEGO DE CERETE' }).tipo,
  proveedorQueFigura({ nombre_del_procedimiento: 'FUNDACION HOSPITAL SAN JOSE', entidad: 'FUNDACION HOSPITAL SAN JOSE DE BUGA' }).tipo,
], ['ninguno', 'empresa', 'ninguno'])
{
  const caribeEntidad = filaDe(mapSecopProceso({ ...huCaribe, ...SIN_PROVEEDOR, nombre_del_procedimiento: 'HOSPITAL UNIVERSITARIO DEL CARIBE E.S.E.' }, ctx))
  eq('fila del HU del Caribe con su propio nombre en el título: se guarda sin proveedor (no "según el título")', caribeEntidad && [caribeEntidad.linea, caribeEntidad.proveedor_nombre, caribeEntidad.proveedor_origen, caribeEntidad.es_persona], ['trauma', null, null, false])
}
{
  const row = filaDe(mapSecopProceso(personaNatural, ctx))
  check('persona natural (real, documento inventado): se guarda con es_persona y solo el hash', row !== null && row.es_persona && row.proveedor_hash === hashPersona && row.proveedor_nit === null && row.proveedor_nombre === null && row.proveedor_origen === null, row)
  const json = JSON.stringify(row)
  check('la fila no contiene el documento, el nombre del proveedor ni el título con el nombre', !json.includes(DOC_PERSONA) && !json.includes('"XX"') && !json.includes(NOMBRE_PERSONA_TITULO))
  check('el hash no contiene el documento', !hashPersona.includes(DOC_PERSONA) && /^[0-9a-f]{64}$/.test(hashPersona))
  check('"PIJAMAS PARA PACIENTES" (genérico) no se redacta', row?.descripcion?.includes('PIJAMAS PARA PACIENTES') === true)
  const sinHash = filaDe(mapSecopProceso({ ...monteria015, nombre_del_proveedor: 'NOMBRE APELLIDO APELLIDO' }, ctx))
  check('nombre sin marca jurídica en una fila real (Montería): es_persona, sin hash ni nombre', sinHash !== null && sinHash.es_persona && sinHash.proveedor_hash === null && sinHash.proveedor_nombre === null && !JSON.stringify(sinHash).includes('NOMBRE APELLIDO'))
}
{
  const vigilado = filaDe(mapSecopProceso(hocenBase, ctx))
  eq('proveedor vigilado por NIT (MEDTRONIC 830025149 en la lista): proveedor_vigilado_id', vigilado?.proveedor_vigilado_id, '830025149')
}

// ---------------------------------------------------------------------------------------------
// 5. Alcance: Yolombó solo por UNSPSC, servicios, entidades y líneas
// ---------------------------------------------------------------------------------------------
console.log('\n5. Alcance')
eq('Yolombó (real): solo clasifica por UNSPSC 4232 sin texto ortopédico → no se guarda (unspsc)', motivoDe(mapSecopProceso(yolombo, ctx)), 'unspsc')
{
  const conTexto = filaDe(mapSecopProceso({ ...yolombo, descripci_n_del_procedimiento: 'SUMINISTRO DE TORNILLOS Y PLACAS', nombre_del_procedimiento: 'MATERIAL' }, ctx))
  eq('motivo unspsc CON texto que pasa el prefiltro (tornillos, placas) → sí se guarda', conTexto && [conTexto.motivo, conTexto.linea], ['unspsc', 'otros_implantes'])
}
eq('servicios de médicos (motivo servicio) → no se guardan', motivoDe(mapSecopProceso({ ...monteria015, descripci_n_del_procedimiento: 'PRESTACION DE SERVICIOS PROFESIONALES COMO MEDICO ESPECIALISTA EN ORTOPEDIA Y TRAUMATOLOGIA', nombre_del_procedimiento: 'MEDICO ORTOPEDISTA' }, ctx)), 'servicio')
eq('sin línea (raciones alimenticias) → no_clasificado', motivoDe(mapSecopProceso({ ...monteria015, descripci_n_del_procedimiento: 'SUMINISTRO DE RACIONES ALIMENTICIAS', nombre_del_procedimiento: 'ALIMENTACION', codigo_principal_de_categoria: 'V1.50192100' }, ctx)), 'no_clasificado')
eq('NIT de entidad fuera de las IPS públicas objetivo → entidad_no_objetivo', motivoDe(mapSecopProceso({ ...huCaribe, nit_entidad: '900000001' }, ctx)), 'entidad_no_objetivo')
eq('NIT de entidad con DV (10 dígitos) se normaliza a 9 y entra', filaDe(mapSecopProceso({ ...huCaribe, nit_entidad: '9000421030' }, ctx))?.nit_entidad, '900042103')
eq('NIT de entidad ilegible → nit_entidad; id que no es CO1.REQ → sin_id', [motivoDe(mapSecopProceso({ ...huCaribe, nit_entidad: 'No Definido' }, ctx)), motivoDe(mapSecopProceso({ ...huCaribe, id_del_proceso: 'CO1.BDOS.10084716' }, ctx)), motivoDe(mapSecopProceso({ ...huCaribe, id_del_proceso: undefined }, ctx))], ['nit_entidad', 'sin_id', 'sin_id'])
{
  const login = filaDe(mapSecopProceso({ ...huCaribe, urlproceso: { url: 'https://community.secop.gov.co/STS/Users/Login/Index?SkinName=CCE' } }, ctx))
  eq('url de la página de ingreso de SECOP → null (y sin noticeUID)', login && [login.url, login.notice_uid], [null, null])
}
{
  // Todo lo que se guarda pasa el prefiltro SoQL (texto o UNSPSC 4232): el prefiltro es un superconjunto
  const guardadas = [huCaribe, monteria015, monteria543, monteria1116, husSeleccionado, husAdjudicado, personaNatural, huvPaciente, hocenBase]
  const fuera = guardadas.filter(raw => !(pasaPrefiltro(raw.nombre_del_procedimiento, raw.descripci_n_del_procedimiento) || String(raw.codigo_principal_de_categoria ?? '').startsWith('V1.4232')))
  eq('todas las filas guardadas pasan el prefiltro de la consulta', fuera.map(raw => raw.id_del_proceso), [])
}

// ---------------------------------------------------------------------------------------------
// 6. Datos personales en la descripción
// ---------------------------------------------------------------------------------------------
console.log('\n6. Redacción de pacientes')
{
  const row = filaDe(mapSecopProceso(huvPaciente, ctx))
  eq('HUV (plantilla real, nombre y cédula inventados): se guarda redactada', row?.descripcion, `ADQUISICION DE INSUMOS NECESARIOS PARA EL PACIENTE ${DATO_PERSONAL_OMITIDO} QUIEN REQUIERE PROCEDIMIENTO POR PARTE DE LA ESPECIALIDAD DE ORTOPEDIA`)
  const json = JSON.stringify(row)
  check('la fila no contiene el nombre ni la cédula del paciente (ni en el título)', !json.includes('PEDRO') && !json.includes('INVENTADO') && !json.includes(CEDULA_PACIENTE) && !json.includes('12345678'))
  eq('HUV: la clasificación no cambia por la redacción (otros_implantes, genérico)', row && [row.linea, row.motivo], ['otros_implantes', 'generico'])
}
const casos: Array<[string, string, string]> = [
  [
    'PARA EL PACIENTE <NOMBRE> IDENTIFICADO CON CEDULA <NUM> QUIEN REQUIERE…',
    'ADQUISICION DE INSUMOS PARA EL PACIENTE JUAN PRUEBA PEREZ IDENTIFICADO CON CEDULA DE CIUDADANIA 1.234.567 QUIEN REQUIERE PROCEDIMIENTO QUIRURGICO',
    `ADQUISICION DE INSUMOS PARA EL PACIENTE ${DATO_PERSONAL_OMITIDO} QUIEN REQUIERE PROCEDIMIENTO QUIRURGICO`,
  ],
  [
    'menor con tarjeta de identidad y punto tras el número',
    'ADQUISICION DE INSUMOS PARA LA PACIENTE ANA PRUEBA ROJAS IDENTIFICADA CON TARJETA DE IDENTIDAD 1.023.456.789. QUIEN REQUIERE PROCEDIMIENTO',
    `ADQUISICION DE INSUMOS PARA LA PACIENTE ${DATO_PERSONAL_OMITIDO}. QUIEN REQUIERE PROCEDIMIENTO`,
  ],
  [
    'nombre seguido de CC al final del texto',
    'SERVICIO CIRUGIA-MOS PACIENTE LUIS PRUEBA DIAZ CC 1023456789',
    `SERVICIO CIRUGIA-MOS PACIENTE ${DATO_PERSONAL_OMITIDO}`,
  ],
  [
    'sin nombre, solo "IDENTIFICADO CON CC NO." y el número',
    'ADQUISION DE UN IMPLANTE DE CRANEO PARA EL PACIENTE IDENTIFICADO CON CC NO. 1023456789 A CARGO DEL SERVICIO DE NEUROCIRUGIA',
    `ADQUISION DE UN IMPLANTE DE CRANEO PARA EL PACIENTE ${DATO_PERSONAL_OMITIDO} A CARGO DEL SERVICIO DE NEUROCIRUGIA`,
  ],
  [
    'con tildes y "C.C." abreviada',
    'Adquisición de insumos para la paciente María Prueba Gómez identificada con C.C. 12.345.678, quien requiere cirugía',
    `Adquisición de insumos para la paciente ${DATO_PERSONAL_OMITIDO}, quien requiere cirugía`,
  ],
  [
    'lista de pacientes ("PACIENTES" con identificación)',
    'ADQUISICION DE IMPLANTE CRANEOPLASTIA PEEK PARA LOS PACIENTES JUAN PRUEBA IDENTIFICADO CON CEDULA DE CUIDADANIA 1.234.567, PEDRO PRUEBA IDENTIFICADO CON CEDULA DE CIUDADANIA 7.654.321 QUIENES REQUIEREN PROCEDIMIENTOS',
    `ADQUISICION DE IMPLANTE CRANEOPLASTIA PEEK PARA LOS PACIENTES ${DATO_PERSONAL_OMITIDO} QUIENES REQUIEREN PROCEDIMIENTOS`,
  ],
  [
    'parte de un proceso judicial ("DEMANDANTE <NOMBRE>"); el radicado se queda',
    'EMITIR DICTAMEN PERICIAL DE ORTOPEDIA DEL PROCESO BAJO EL RADICADO 12345678901 DEMANDANTE JUAN PRUEBA PEREZ, SOLICITADO POR EL ABOGADO EXTERNO',
    `EMITIR DICTAMEN PERICIAL DE ORTOPEDIA DEL PROCESO BAJO EL RADICADO 12345678901 DEMANDANTE ${DATO_PERSONAL_OMITIDO}, SOLICITADO POR EL ABOGADO EXTERNO`,
  ],
  [
    'documento tras CC fuera de la cláusula de un paciente',
    'SUMINISTRO DE MATERIAL SEGUN SOLICITUD DEL USUARIO CON C.C. 1.234.567 DEL SERVICIO DE ORTOPEDIA',
    `SUMINISTRO DE MATERIAL SEGUN SOLICITUD DEL USUARIO CON C.C. ${DOCUMENTO_OMITIDO} DEL SERVICIO DE ORTOPEDIA`,
  ],
]
for (const [nombre, entrada, esperado] of casos) eq(`redacta: ${nombre}`, redactarDatosPersonales(entrada), esperado)
const intactos: Array<[string, string]> = [
  ['"PACIENTES" genérico', 'SUMINISTRO DE MATERIAL DE OSTEOSINTESIS PARA LOS PACIENTES QUE REQUIERAN PROCEDIMIENTOS QUIRÚRGICOS'],
  ['"el paciente oncológico" y un código de producto', 'ELABORACIÓN DE PRÓTESIS FACIALES EN LA REHABILITACIÓN INTEGRAL DEL PACIENTE ONCOLÓGICO CÓDIGO: H123456789012.'],
  ['"seguridad del paciente y humanización"', 'PROGRAMA DE LA CALIDAD, SEGURIDAD DEL PACIENTE Y HUMANIZACIÓN DE LOS SERVICIOS DE SALUD'],
  ['números de contrato y resolución', 'ADICION AL CONTRATO No. 123456789 DE 2026 SEGUN RESOLUCION 0012345 PARA SUMINISTRO DE OSTEOSINTESIS'],
  ['contrato interadministrativo de 11 dígitos', 'CONTRATO INTERADMINISTRATIVO 20261234567 PARA MATERIAL DE OSTEOSINTESIS'],
  ['texto sin datos personales (HU del Caribe)', String(huCaribe.descripci_n_del_procedimiento)],
]
for (const [nombre, texto] of intactos) eq(`no toca: ${nombre}`, redactarDatosPersonales(texto), texto.replace(/\s{2,}/g, ' ').trim())
eq('null → null', redactarDatosPersonales(null), null)

// ---------------------------------------------------------------------------------------------
// 7. URL SoQL y tareas
// ---------------------------------------------------------------------------------------------
console.log('\n7. URL SoQL')
{
  const url = new URL(buildProcesosUrl({ nits: ['900042103', '891079999'] }, { desde: '2024-10-01', offset: 5000, limit: 5000 }))
  const where = url.searchParams.get('$where') ?? ''
  eq('dataset p6dx-8zbt en datos.gov.co', `${url.origin}${url.pathname}`, `https://www.datos.gov.co/resource/${SECOP_PROCESOS_DATASET}.json`)
  const [n1, n1dv] = variantesNit('900042103')
  const [n2, n2dv] = variantesNit('891079999')
  check('nit_entidad in (9 dígitos y 10 con DV, sin guion)', where.includes(`nit_entidad in ('${n1}','${n1dv}','${n2}','${n2dv}')`) && n1dv.length === 10 && !/\d-\d/.test(where.split(' AND ')[0]), where.slice(0, 120))
  check('prefiltro sobre nombre_del_procedimiento y descripci_n_del_procedimiento', SECOP_PREFILTRO_RAICES.every(raiz => where.includes(`upper(nombre_del_procedimiento) like '%${raiz}%'`) && where.includes(`upper(descripci_n_del_procedimiento) like '%${raiz}%'`)))
  check("y codigo_principal_de_categoria like 'V1.4232%'", where.includes("codigo_principal_de_categoria like 'V1.4232%'"))
  check("fecha_de_publicacion_del >= desde", where.includes("fecha_de_publicacion_del >= '2024-10-01T00:00:00.000'"))
  eq('orden por id_del_proceso, límite y desplazamiento', [url.searchParams.get('$order'), url.searchParams.get('$limit'), url.searchParams.get('$offset')], ['id_del_proceso', '5000', '5000'])
  let lanzo = false
  try {
    buildProcesosUrl({ nits: ['900042103'] }, { desde: '2024-10', offset: 0, limit: 10 })
  } catch {
    lanzo = true
  }
  check('desde mal formado → error (no una consulta sin fecha)', lanzo)
}
{
  const tareas = buildProcesosTareas([...NITS_PUBLICOS, '900042103'])
  eq(`141 NIT en tareas de ${PROCESOS_TAREA_TAMANO} (sin repetidos)`, tareas.map(t => t.nits.length), [50, 50, 41])
  const largos = tareas.map(t => buildProcesosUrl(t, { desde: '2024-10-01', offset: 100000, limit: 50000 }).length)
  check(`la URL de cada tarea mide menos de 9,5 KB (${largos.join(', ')} B)`, largos.every(l => l < 9500), largos)
}
eq('desde: inicial = primer día de hace 24 meses; incremental = hoy − 120 días', [desdeProcesos('inicial', '2026-10-25'), desdeProcesos('incremental', '2026-10-25'), desdeProcesos('inicial', '2026-01-15')], ['2024-10-01', '2026-06-27', '2024-01-01'])
eq('fuente y cron', [SECOP_PROCESOS_FUENTE, SECOP_PROCESOS_PROGRAMACION], ['secop_procesos', '30 6 * * *'])

// ---------------------------------------------------------------------------------------------
// 8. Lotes y upsert
// ---------------------------------------------------------------------------------------------
console.log('\n8. Lotes y upsert')
{
  const filas = hocenLotes.map(raw => filaDe(mapSecopProceso(raw, ctx))).filter((r): r is ProcesoRow => r !== null)
  eq('HOCEN (real): 5 filas mapeadas, una por lote', filas.length, 5)
  const unidas = agregarLotes(filas)
  eq('quedan en una sola fila por id_proceso', unidas.map(r => r.id_proceso), ['CO1.REQ.10269619'])
  const r = unidas[0]
  eq('valor adjudicado = suma de los lotes (= precio base 1.370.708.105), adjudicado, mismo proveedor', [r.valor_adjudicado, r.precio_base, r.estado, r.adjudicado, r.proveedor_nit, r.proveedor_nombre, r.linea], [
    1_370_708_105,
    1_370_708_105,
    'adjudicado',
    true,
    '830025149',
    'MEDTRONIC COLOMBIA S.A. **',
    'neurocirugia',
  ])
  const otros = agregarLotes([...filas, filaDe(mapSecopProceso(huCaribe, ctx)) as ProcesoRow])
  eq('procesos distintos no se juntan; el orden es el de la primera aparición', otros.map(x => x.id_proceso), ['CO1.REQ.10269619', 'CO1.REQ.10254526'])
  // Lotes con proveedores distintos: el del lote de mayor valor
  const loteA = filaDe(mapSecopProceso({ ...hocenBase, valor_total_adjudicacion: '100', nit_del_proveedor_adjudicado: '900303413', nombre_del_proveedor: 'OSTEOCOL SAS' }, ctx)) as ProcesoRow
  const loteB = filaDe(mapSecopProceso({ ...hocenBase, valor_total_adjudicacion: '900', nit_del_proveedor_adjudicado: '830025149' }, ctx)) as ProcesoRow
  const mezcla = agregarLotes([loteA, loteB])[0]
  eq('lotes con proveedores distintos: suma y el proveedor del lote de mayor valor', [mezcla.valor_adjudicado, mezcla.proveedor_nit, mezcla.proveedor_vigilado_id], [1000, '830025149', '830025149'])
}
{
  // El mismo proceso leído dos veces se actualiza en su sitio: la fila no depende de la lectura y la llave es id_proceso
  const primera = agregarLotes([filaDe(mapSecopProceso(huCaribe, ctx)) as ProcesoRow])
  const segunda = agregarLotes([filaDe(mapSecopProceso({ ...huCaribe, estado_del_procedimiento: 'Evaluación' }, ctx)) as ProcesoRow])
  eq('llave del upsert = id_proceso (UNIQUE de la 0890)', PROCESOS_UPSERT_CONFLICTO, 'id_proceso')
  const tabla = new Map<string, ProcesoRow>()
  for (const row of [...primera, ...segunda]) tabla.set(row[PROCESOS_UPSERT_CONFLICTO], row)
  eq('dos lecturas del mismo proceso → una fila, con el estado de la última', [tabla.size, tabla.get('CO1.REQ.10254526')?.estado], [1, 'evaluacion'])
  eq('leer dos veces lo mismo da la misma fila (idempotente)', agregarLotes([filaDe(mapSecopProceso(huCaribe, ctx)) as ProcesoRow]), primera)
}

// ---------------------------------------------------------------------------------------------
// 9. Permiso secop:procesos
// ---------------------------------------------------------------------------------------------
console.log('\n9. Permiso secop:procesos')
{
  const roles = Object.keys(rolePermissions) as Role[]
  eq('lo tienen admin, commercial_director, data_manager, line_leader, sales_manager y viewer', roles.filter(rol => hasPermission(rol, 'secop:procesos')).sort(), [
    'admin',
    'commercial_director',
    'data_manager',
    'line_leader',
    'sales_manager',
    'viewer',
  ])
  check('admin lo tiene en su lista explícita', rolePermissions.admin.includes('secop:procesos'))
  check('todo rol con intelligence:view tiene secop:procesos', roles.filter(rol => hasPermission(rol, 'intelligence:view')).every(rol => hasPermission(rol, 'secop:procesos')))
  check('sales_manager sigue sin intelligence:view (ni compras ni /inteligencia)', !hasPermission('sales_manager', 'intelligence:view'))
  check('contract_manager, user y hr no lo tienen; sin rol tampoco', !hasPermission('contract_manager', 'secop:procesos') && !hasPermission('user', 'secop:procesos') && !hasPermission('hr', 'secop:procesos') && !hasPermission(undefined, 'secop:procesos'))
}

// ---------------------------------------------------------------------------------------------
// 10. Lecturas del servidor con un cliente falso (sin red)
// ---------------------------------------------------------------------------------------------
console.log('\n10. loadProcesosRadar y loadSecopActualizado (cliente falso)')

interface Llamada {
  tabla: string
  select: string | null
  in: Array<[string, unknown[]]>
  gte: Array<[string, unknown]>
  lte: Array<[string, unknown]>
  order: string[]
  range: Array<[number, number]>
}
type Respuesta = { data: unknown[] | null; error: unknown }

/** Cliente mínimo con la forma de supabase-js (from → select → filtros → range, awaitable). */
function clienteFalso(responder: (llamada: Llamada) => Respuesta) {
  const llamadas: Llamada[] = []
  const db = {
    from(tabla: string) {
      const llamada: Llamada = { tabla, select: null, in: [], gte: [], lte: [], order: [], range: [] }
      llamadas.push(llamada)
      const builder = {
        select(cols: string) {
          llamada.select = cols
          return builder
        },
        in(col: string, values: unknown[]) {
          llamada.in.push([col, values])
          return builder
        },
        gte(col: string, value: unknown) {
          llamada.gte.push([col, value])
          return builder
        },
        lte(col: string, value: unknown) {
          llamada.lte.push([col, value])
          return builder
        },
        order(col: string) {
          llamada.order.push(col)
          return builder
        },
        range(from: number, to: number) {
          llamada.range.push([from, to])
          return builder
        },
        then<T>(resolve: (value: Respuesta) => T, reject?: (reason: unknown) => T) {
          try {
            return Promise.resolve(resolve(responder(llamada)))
          } catch (error) {
            return reject ? Promise.resolve(reject(error)) : Promise.reject(error)
          }
        },
      }
      return builder
    },
  }
  return { db: db as unknown as SupabaseAdminClient, llamadas }
}

async function pruebasServidor() {
  const { loadProcesosRadar, loadSecopActualizado } = await import('../app/api/secop/_lib/secop-server')
  const filaVista = {
    id_proceso: 'CO1.REQ.10254526',
    referencia: '000039-2026',
    nit_entidad: '900042103',
    nombre_entidad: 'BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE',
    precio_base: '1760000000.00',
    fecha_publicacion: '2026-03-10',
    linea: 'trauma',
    lineas: ['trauma', 'neurocirugia'],
    estado: 'publicado',
    proveedor_nit: '901080496',
    proveedor_nombre: 'VG MEDICAL SAS',
    proveedor_origen: 'nit',
    proveedor_vigilado_id: null,
    es_persona: false,
    url: 'https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.10111634',
  }
  {
    const { db, llamadas } = clienteFalso(() => ({ data: [filaVista], error: null }))
    const filas = await loadProcesosRadar({ nits: ['900042103', '891079999'], desde: '2025-11-01', hasta: '2026-10-25' }, db)
    const l = llamadas[0]
    eq('lee la vista secop_procesos_radar (una sola consulta)', [llamadas.length, l?.tabla], [1, 'secop_procesos_radar'])
    eq('filtra por nit_entidad in (nits) y fecha_publicacion entre desde y hasta', [l?.in, l?.gte, l?.lte], [[['nit_entidad', ['900042103', '891079999']]], [['fecha_publicacion', '2025-11-01']], [['fecha_publicacion', '2026-10-25']]])
    eq('ordena por fecha de publicación (desc) y pide las columnas del radar', [l?.order[0], l?.select], ['fecha_publicacion', PROCESO_RADAR_COLUMNAS])
    check('no pide descripción, hash, documento ni título', !/descripcion|proveedor_hash|documento|nombre_del_procedimiento|titulo/.test(l?.select ?? ''))
    eq('convierte la fila (precio numérico, fecha YYYY-MM-DD)', filas.map(f => [f.id_proceso, f.precio_base, f.fecha_publicacion, f.proveedor_origen, f.es_persona]), [['CO1.REQ.10254526', 1_760_000_000, '2026-03-10', 'nit', false]])
  }
  {
    const { db, llamadas } = clienteFalso(() => ({ data: [], error: null }))
    eq('sin NIT → [] sin leer nada', [await loadProcesosRadar({ nits: [], desde: '2025-11-01', hasta: '2026-10-25' }, db), llamadas.length], [[], 0])
  }
  {
    const { db } = clienteFalso(() => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.secop_procesos_radar' in the schema cache" } }))
    eq('sin la vista (0890 sin aplicar) → [] (las rutas responden 200 con procesos: null)', await loadProcesosRadar({ nits: ['900042103'], desde: '2025-11-01', hasta: '2026-10-25' }, db), [])
  }
  {
    const { db } = clienteFalso(() => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }))
    let lanzo = false
    try {
      await loadProcesosRadar({ nits: ['900042103'], desde: '2025-11-01', hasta: '2026-10-25' }, db)
    } catch {
      lanzo = true
    }
    check('otro error de la base sí se lanza (no se esconde como "sin procesos")', lanzo)
  }
  {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ ...filaVista, id_proceso: `CO1.REQ.${10000000 + i}`, fecha_publicacion: `2026-0${1 + (i % 9)}-15` }))
    const { db } = clienteFalso(() => ({ data: muchas, error: null }))
    const filas = await loadProcesosRadar({ nits: ['900042103'], desde: '2025-11-01', hasta: '2026-10-25', limite: 20 }, db)
    eq('con límite: corta a 20, las más recientes primero', [filas.length, filas[0]?.fecha_publicacion], [20, '2026-09-15'])
  }
  {
    const { db } = clienteFalso(() => ({
      data: [
        { fuente: 'secop_ii', nombre: 'SECOP II · Contratos', ultimo_ok: '2026-10-25T06:00:00Z' },
        { fuente: 'secop_i', nombre: 'SECOP I · Contratos', ultimo_ok: '2026-10-20T07:00:00Z' },
        { fuente: 'secop_integrado', nombre: 'SECOP Integrado (I + II)', ultimo_ok: '2026-10-19T07:00:00Z' },
        { fuente: 'secop_procesos', nombre: 'SECOP II · Procesos sin contrato', ultimo_ok: '2026-10-25T06:30:00Z' },
        { fuente: 'reps_sedes', nombre: 'REPS · Sedes', ultimo_ok: '2026-10-02T08:00:00Z' },
      ],
      error: null,
    }))
    eq('loadSecopActualizado ("SECOP actualizado el…" de compras) solo mira las 3 fuentes de contratos', await loadSecopActualizado(db), {
      secop_ii: '2026-10-25T06:00:00Z',
      secop_i: '2026-10-20T07:00:00Z',
      secop_integrado: '2026-10-19T07:00:00Z',
    })
  }
}

pruebasServidor()
  .catch(error => {
    failed++
    console.log(`  FALLA las pruebas del servidor lanzaron: ${error instanceof Error ? error.stack : String(error)}`)
  })
  .finally(() => {
    console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
    process.exit(failed > 0 ? 1 : 0)
  })
