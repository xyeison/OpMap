/**
 * Procesos de SECOP II sin contrato como radar comercial: lógica PURA (sin red, sin base de datos, sin node:*).
 * Spec: docs/specs/2026-10-25-secop-procesos-radar.md · decisión: docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md.
 * Pruebas: scripts/secop-procesos-check.ts (filas reales de datos.gov.co, sin red).
 *
 * Fuente: "SECOP II - Procesos de Contratación" (p6dx-8zbt). 83 de las 141 IPS públicas de OpMap publican sus compras
 * solo como procesos de "Contratación régimen especial" y nunca crean el contrato electrónico (lo único que cargan
 * secop_ii, secop_i y secop_integrado). Estos procesos van en una tabla APARTE (public.secop_procesos, migración 0890)
 * que no tiene columnas `valor` ni `fecha_firma`: nunca suman a las compras, al ranking, a /inteligencia ni a
 * secop_hechos. El precio base se muestra por proceso y nunca se suma.
 *
 * Qué hay aquí:
 *   1. estadoDeProceso: estado del procedimiento → estado de la tabla (o null = no se guarda).
 *   2. proveedorQueFigura: la empresa que figura en el proceso (NIT, nombre del proveedor o título), una persona natural
 *      (solo el hash de su documento) o ninguno. En régimen especial `adjudicado = 'No'` siempre: es el proveedor que
 *      FIGURA, nunca "el adjudicado".
 *   3. redactarDatosPersonales: nombre y documento de pacientes fuera de la descripción antes de guardarla.
 *   4. mapSecopProceso: fila cruda → ProcesoRow (o el motivo por el que no se guarda); agregarLotes por id_proceso.
 *   5. buildProcesosUrl: URL SoQL de una página de una tarea (lote de NIT de entidades).
 *
 * Trampas de la fuente (notas de investigación del 2026-10-25):
 *   - Socrata OMITE las claves nulas: todo se lee con cleanText / toIsoDate / toMoney, que toleran undefined.
 *   - nit_entidad es texto, con 9 dígitos o 10 con DV (nunca con guion). Los números llegan como texto.
 *   - urlproceso llega como objeto { url }, no como texto (cleanText lo lee). 3 filas traen la página de ingreso de SECOP.
 *   - nombre_del_procedimiento (el "título") a veces es el nombre del proveedor, a veces una persona natural: NUNCA se
 *     guarda ni se muestra tal cual; solo sirve para clasificar (si no es un nombre) y para el caso (c) del proveedor.
 *   - Las filas no son únicas por id_del_proceso en procesos con lotes adjudicados (una fila por lote, cada una con su
 *     valor y su proveedor): agregarLotes las junta en una sola fila.
 */
import {
  CLASIFICACION_VERSION,
  SECOP_BASE_URL,
  SECOP_PREFILTRO_RAICES,
  SECOP_UNSPSC_ORTOPEDIA_PREFIJOS,
  cleanText,
  clasificarContrato,
  digitosDocumento,
  esDocumentoPersona,
  esNitJuridico,
  normalizeNit,
  normalizeText,
  pasaPrefiltro,
  restarDias,
  toIsoDate,
  toMoney,
  variantesNit,
  type Clasificacion,
  type SecopLineaProducto,
  type SecopRaw,
} from './secop'

// ---------------------------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------------------------

export const SECOP_PROCESOS_DATASET = 'p6dx-8zbt'
/** Clave en fuentes_estado y en /api/cron/<clave> (fila sembrada por la migración 0890). */
export const SECOP_PROCESOS_FUENTE = 'secop_procesos'
export const SECOP_PROCESOS_NOMBRE = 'SECOP II · Procesos sin contrato'
/** Cron UTC (la misma expresión que la fila de fuentes_estado y vercel.json). */
export const SECOP_PROCESOS_PROGRAMACION = '30 6 * * *'
/** NIT por tarea: con 2 variantes por NIT y el prefiltro la URL queda por debajo de 9,5 KB (secop-procesos-check). */
export const PROCESOS_TAREA_TAMANO = 50
/** Carga inicial: 24 meses (la ventana de la ficha). Incremental: se releen 120 días y se hace upsert. */
export const PROCESOS_MESES_INICIAL = 24
export const PROCESOS_DIAS_INCREMENTAL = 120
/** Llave del upsert: el mismo proceso leído dos veces se actualiza en su sitio. */
export const PROCESOS_UPSERT_CONFLICTO = 'id_proceso'

/** Estados guardados (CHECK secop_procesos_estado_check de la 0890). */
export const PROCESO_ESTADOS = ['publicado', 'evaluacion', 'abierto', 'seleccionado', 'adjudicado', 'cancelado'] as const
export type ProcesoEstado = (typeof PROCESO_ESTADOS)[number]
/** Estados que entran al radar si no hay contrato cargado (vista secop_procesos_radar). */
export const PROCESO_ESTADOS_RADAR: readonly ProcesoEstado[] = ['publicado', 'evaluacion', 'abierto', 'seleccionado']

/** De dónde sale el proveedor que figura: NIT de empresa, nombre del proveedor con marca jurídica o título del proceso. */
export type ProveedorOrigen = 'nit' | 'nombre' | 'titulo'

/** Texto que reemplaza el nombre (y documento) de un paciente. */
export const DATO_PERSONAL_OMITIDO = '[dato personal omitido]'
/** Texto que reemplaza un número de documento de identidad. */
export const DOCUMENTO_OMITIDO = '[documento omitido]'

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

/**
 * Fila de public.secop_procesos (sin id ni imported_at, que pone la base). Fechas en 'YYYY-MM-DD'. Sin `valor` ni
 * `fecha_firma` a propósito: un proceso no es una compra.
 */
export interface ProcesoRow {
  /** id_del_proceso (CO1.REQ.n): llave del upsert. */
  id_proceso: string
  /** id_del_portafolio (CO1.BDOS.n) = secop_contratos.proceso de SECOP II: si está, ya hay contrato cargado. */
  portafolio: string | null
  /** noticeUID (CO1.NTC.n) de urlproceso = el de secop_contratos.url (SECOP II e Integrado origen SECOPII). */
  notice_uid: string | null
  referencia: string | null
  nit_entidad: string
  nombre_entidad: string | null
  hospital_id: string | null
  modalidad: string | null
  tipo_contrato: string | null
  /** estado_del_procedimiento tal cual lo publica SECOP ('Publicado', 'Evaluación', 'Seleccionado'…). */
  estado_secop: string | null
  estado: ProcesoEstado
  adjudicado: boolean
  /** Precio base de la convocatoria: se muestra por proceso y NUNCA se suma. */
  precio_base: number | null
  /** Suma de los lotes adjudicados; null si no hay adjudicación (régimen especial sin ofertas: siempre null). */
  valor_adjudicado: number | null
  fecha_publicacion: string | null
  fecha_adjudicacion: string | null
  /** Empresa: NIT de 9 dígitos (si la fuente lo trae). Persona: siempre null. */
  proveedor_nit: string | null
  /** Empresa: nombre. Persona: siempre null (CHECK de la tabla). */
  proveedor_nombre: string | null
  proveedor_origen: ProveedorOrigen | null
  /** Persona natural con documento: sha256(sal : dígitos). Nunca el documento. */
  proveedor_hash: string | null
  es_persona: boolean
  proveedor_vigilado_id: string | null
  /** descripci_n_del_procedimiento con los datos de pacientes redactados (redactarDatosPersonales). */
  descripcion: string | null
  linea: SecopLineaProducto
  lineas: SecopLineaProducto[]
  motivo: Clasificacion['motivo']
  clasificacion_version: string
  categoria_unspsc: string | null
  url: string | null
  /** Cuándo se leyó por última vez (lo pone la carga; imported_at queda con la primera vez). */
  ultima_lectura: string | null
}

/**
 * Lo que leen las tarjetas del mapa y la ficha de la vista secop_procesos_radar (loadProcesosRadar). Sin descripcion,
 * proveedor_hash ni nada que identifique a una persona natural: la respuesta solo dice "persona natural".
 */
export type ProcesoRadarFila = Pick<
  ProcesoRow,
  | 'id_proceso'
  | 'referencia'
  | 'nit_entidad'
  | 'nombre_entidad'
  | 'precio_base'
  | 'fecha_publicacion'
  | 'linea'
  | 'lineas'
  | 'estado'
  | 'proveedor_nit'
  | 'proveedor_nombre'
  | 'proveedor_origen'
  | 'proveedor_vigilado_id'
  | 'es_persona'
  | 'url'
>

/** Columnas de ProcesoRadarFila, en el orden del select de PostgREST. */
export const PROCESO_RADAR_COLUMNAS =
  'id_proceso, referencia, nit_entidad, nombre_entidad, precio_base, fecha_publicacion, linea, lineas, estado, proveedor_nit, proveedor_nombre, proveedor_origen, proveedor_vigilado_id, es_persona, url'

export interface ProcesoMapContext {
  /** sha256 con la sal del proyecto de los dígitos del documento de una persona natural (lib/secop-hash.ts). */
  hashDocumento: (digitos: string) => string
  /** NIT (9 dígitos) de las IPS públicas objetivo (secop_nits_ips().publica): lo demás no se guarda. */
  entidades: ReadonlySet<string>
  /** NIT de 9 dígitos → IPS principal de OpMap con ese NIT. */
  hospitalPorNit?: ReadonlyMap<string, string>
  /** NIT (9 dígitos) de los proveedores vigilados activos. */
  vigilados?: ReadonlySet<string>
  /** Marca de tiempo de la lectura (ISO) para ultima_lectura; null si no se pasa. */
  ahora?: string | null
}

/** Por qué una fila no se guarda. */
export type ProcesoDescarte =
  | 'sin_id'
  | 'nit_entidad'
  | 'entidad_no_objetivo'
  | 'estado'
  | 'servicio'
  | 'unspsc'
  | 'no_clasificado'

export type ProcesoMapResult = { row: ProcesoRow } | { descartado: ProcesoDescarte; detalle?: string }

export type ProveedorQueFigura =
  | { tipo: 'empresa'; nit: string | null; nombre: string | null; origen: ProveedorOrigen }
  | { tipo: 'persona'; hash: string | null }
  | { tipo: 'ninguno' }

// ---------------------------------------------------------------------------------------------
// 1. Estado
// ---------------------------------------------------------------------------------------------

/** 'Si' / 'Sí' / 'si' / true → true. */
export function esSi(value: unknown): boolean {
  if (value === true) return true
  const text = normalizeText(value)
  return text === 'si' || text === 'true' || text === '1'
}

/**
 * Estado del procedimiento → estado guardado. null = no se guarda: "Borrador", "En aprobación" y "Aprobado" aún no se
 * publicaron, y un estado desconocido no se adivina. En régimen especial "Publicado" no es una licitación con
 * recepción de ofertas: es un proceso publicado cuya entidad no registró el contrato electrónico.
 *   Publicado → publicado · Evaluación → evaluacion · Abierto → abierto
 *   Seleccionado → seleccionado, o adjudicado si adjudicado = 'Si' · Adjudicado → adjudicado
 *   Cancelado, Suspendido, Desierto → cancelado
 */
export function estadoDeProceso(estadoDelProcedimiento: unknown, adjudicado: unknown): ProcesoEstado | null {
  const estado = normalizeText(estadoDelProcedimiento)
  switch (estado) {
    case 'publicado':
      return 'publicado'
    case 'evaluacion':
      return 'evaluacion'
    case 'abierto':
      return 'abierto'
    case 'seleccionado':
      return esSi(adjudicado) ? 'adjudicado' : 'seleccionado'
    case 'adjudicado':
      return 'adjudicado'
    case 'cancelado':
    case 'suspendido':
    case 'desierto':
      return 'cancelado'
    default:
      // 'borrador', 'en aprobacion', 'aprobado' y cualquier otro: no se guarda
      return null
  }
}

// ---------------------------------------------------------------------------------------------
// 2. Proveedor que figura
// ---------------------------------------------------------------------------------------------

/**
 * Marca de persona jurídica sobre texto normalizado (minúsculas, sin tildes, puntuación → espacio): "VG MEDICAL S.A.S"
 * → "vg medical s a s". Sin esta marca, un nombre (sin NIT de empresa) nunca se guarda: puede ser una persona natural.
 */
const RE_MARCA_JURIDICA =
  /\b(s a s|sas|s a|sa|ltda|limitada|s c a|sca|s en c|e u|eu|sociedad|corporacion|fundacion|asociacion|cooperativa|union temporal|consorcio|bic|zomac|ips|e s e|ese|sindicato|cia|compania|inc)\b/
/**
 * Verbo u objeto de contratación en el título: si el título lo trae, es la descripción del objeto (aunque nombre a una
 * empresa o a la propia E.S.E.), no el proveedor. También rótulos de trámite ("CONVOCATORIA", "ANUNCIO", "N/A").
 */
const RE_TITULO_OBJETO =
  /\b(suministr[a-z]*|prestacion|prestar|contrat[a-z]*|compra[a-z]*|compraventa|adquisicion|adquirir|servicios?|mantenimiento|arrendamiento|alquiler|comodato|apoyo|proceso|invitacion|convocatoria|anuncio|material(es)?|insumos?|dispositivos?|atencion|objeto|dotacion|realizar|ejecutar|dispensacion|orden de|seguros?|para (el|la|los|las)|de acuerdo)\b/
/** Un título de más de 10 palabras es una descripción, no un nombre de empresa. */
const TITULO_MAX_PALABRAS = 10

/** ¿El texto lleva una marca de persona jurídica (SAS, S.A., LTDA, UNION TEMPORAL, E.S.E…)? */
export function tieneMarcaJuridica(texto: unknown): boolean {
  const norm = normalizeText(texto)
  return norm !== '' && RE_MARCA_JURIDICA.test(norm)
}

/**
 * ¿El título del proceso tiene forma de nombre de empresa? Marca jurídica, sin verbo de objeto, corto. Solo decide si el
 * título entra a la clasificación (un nombre no es el objeto); para MOSTRARLO como proveedor está empresaDelTitulo.
 */
function tituloEsEmpresa(titulo: string | null, descripcion: string | null): boolean {
  if (!titulo) return false
  const norm = normalizeText(titulo)
  // Igual a la descripción (sin contar espacios ni puntuación: "S.A.S" = "SAS") → es el objeto, no un nombre
  if (!norm || norm.replace(/ /g, '') === normalizeText(descripcion).replace(/ /g, '')) return false
  if (norm.split(' ').length > TITULO_MAX_PALABRAS) return false
  if (RE_TITULO_OBJETO.test(norm)) return false
  return RE_MARCA_JURIDICA.test(norm)
}

const RE_MARCA_JURIDICA_TODAS = new RegExp(RE_MARCA_JURIDICA.source, 'g')
/** Marcas que llevan las propias entidades compradoras: solas no hacen de un título el nombre de un proveedor. */
const MARCAS_DE_ENTIDAD = new Set(['ese', 'e s e', 'ips'])
/**
 * Separadores de tramos de un nombre: "/" (no entre dígitos: "376/2025" es un número), "|" o un guion entre espacios
 * ("NOMBRE APELLIDO / COMERCIALIZADORA SAS").
 */
const RE_SEPARADOR_TRAMOS = /(?<!\d)\s*\/\s*(?!\d)|\s*\|\s*|\s+[-–—]\s+/
/** Palabras que no distinguen un nombre de otro (para comparar un título con el nombre de la entidad). */
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en'])

/** Palabras que distinguen un nombre (texto normalizado): sin marcas jurídicas ni palabras vacías. */
function palabrasDistintivas(norm: string): string[] {
  return norm.replace(RE_MARCA_JURIDICA_TODAS, ' ').split(' ').filter(p => p !== '' && !PALABRAS_VACIAS.has(p))
}

/**
 * Nombre de empresa que se puede guardar y mostrar, o null. Privacidad primero:
 *   - nunca un texto con un dato personal (tieneDatoPersonal: paciente, señor(a), demandante…, CC/TI/cédula, un número
 *     de 6 o más dígitos o algo que redactarDatosPersonales quitaría);
 *   - con tramos ("NOMBRE APELLIDO / COMERCIALIZADORA XYZ SAS"), solo los tramos con marca jurídica: un tramo sin marca
 *     puede ser una persona natural (a veces se pierde parte del nombre: "TRAUMASUR - TIENDA DE LA SALUD S.A.S" queda
 *     "TIENDA DE LA SALUD S.A.S");
 *   - nunca solo marcas ("S.A.S").
 */
function nombreDeEmpresa(texto: string): string | null {
  if (tieneDatoPersonal(texto)) return null
  const tramos = texto.split(RE_SEPARADOR_TRAMOS).map(t => t.trim()).filter(Boolean)
  const conMarca = tramos.filter(t => tieneMarcaJuridica(t))
  if (conMarca.length === 0) return null
  const nombre = conMarca.length === tramos.length ? texto : conMarca.join(' / ')
  return palabrasDistintivas(normalizeText(nombre)).length > 0 ? nombre : null
}

/**
 * ¿El nombre (texto normalizado) es el de la entidad compradora? Igual sin espacios, o todas sus palabras distintivas
 * (al menos 2) están en el nombre de la entidad, o al revés: "HOSPITAL UNIVERSITARIO DEL CARIBE E.S.E." frente a
 * "BOLIVAR - ESE HOSPITAL UNIVERSITARIO DEL CARIBE".
 */
function esLaEntidad(norm: string, entidad: string | null): boolean {
  const normEntidad = normalizeText(entidad)
  if (!normEntidad) return false
  if (norm.replace(/ /g, '') === normEntidad.replace(/ /g, '')) return true
  const propias = palabrasDistintivas(norm)
  const deEntidad = palabrasDistintivas(normEntidad)
  const enEntidad = new Set(deEntidad)
  const enPropias = new Set(propias)
  return (propias.length >= 2 && propias.every(p => enEntidad.has(p))) || (deEntidad.length >= 2 && deEntidad.every(p => enPropias.has(p)))
}

/**
 * Empresa que figura en el TÍTULO del proceso (caso (c)), o null. Además de tener forma de empresa (tituloEsEmpresa) y
 * de pasar nombreDeEmpresa (sin datos personales, solo los tramos con marca), no puede ser la propia entidad
 * compradora: ni su nombre ni un nombre cuya única marca sea E.S.E. o IPS ("E.S.E. HOSPITAL SAN JERONIMO DE MONTERIA").
 */
function empresaDelTitulo(titulo: string | null, descripcion: string | null, entidad: string | null): string | null {
  if (!titulo || !tituloEsEmpresa(titulo, descripcion)) return null
  const nombre = nombreDeEmpresa(titulo)
  if (!nombre) return null
  const norm = normalizeText(nombre)
  const marcas = norm.match(RE_MARCA_JURIDICA_TODAS) ?? []
  if (marcas.every(m => MARCAS_DE_ENTIDAD.has(m))) return null
  return esLaEntidad(norm, entidad) ? null : nombre
}

/**
 * Proveedor que FIGURA en el proceso, en este orden (spec, "Proveedor que figura"):
 *   (a) nit_del_proveedor_adjudicado con NIT de empresa (9 dígitos que empiezan por 8 o 9, con o sin DV) → empresa con
 *       ese NIT y el nombre_del_proveedor que traiga (con NIT jurídico el nombre es de la empresa aunque no diga SAS),
 *       origen 'nit'.
 *   Un documento que no es NIT de empresa (cédula, o un "NIT" de 8 dígitos) → persona natural: solo el hash de los
 *   dígitos, nunca el documento ni el nombre (aunque el nombre diga SAS: el documento manda).
 *   (b) Sin documento: nombre_del_proveedor con marca jurídica → empresa sin NIT, origen 'nombre'.
 *   (c) nombre_del_procedimiento con marca jurídica, sin verbo de objeto y distinto de la descripción → empresa sin NIT,
 *       origen 'titulo' (se muestra "según el título del proceso": a veces es otra empresa). Nunca la propia entidad
 *       (su nombre, o un título cuya única marca es E.S.E. o IPS).
 *   En (b) y (c) el nombre pasa por nombreDeEmpresa: con un dato personal (cédula, número de documento, "PACIENTE"…)
 *   no se guarda, y de "NOMBRE APELLIDO / EMPRESA SAS" solo queda el tramo con marca jurídica.
 *   Un nombre_del_proveedor sin marca jurídica o con un dato personal (y sin (c)) → persona natural sin hash: nunca se
 *   guarda como nombre.
 *   Si no hay nada ("No Definido" en todo) → ninguno.
 * `hash` es la función de lib/secop-hash.ts con la sal ya aplicada; sin ella, la persona va sin hash.
 */
export function proveedorQueFigura(raw: SecopRaw, hash?: (digitos: string) => string): ProveedorQueFigura {
  const documento = cleanText(raw.nit_del_proveedor_adjudicado ?? null, 80)
  const nombreProveedor = cleanText(raw.nombre_del_proveedor ?? null, 300)
  const titulo = cleanText(raw.nombre_del_procedimiento ?? null, 1000)
  const descripcion = cleanText(raw.descripci_n_del_procedimiento ?? null)

  const nit = documento ? normalizeNit(documento) : null
  if (nit && esNitJuridico(nit)) return { tipo: 'empresa', nit, nombre: nombreProveedor, origen: 'nit' }
  if (documento && esDocumentoPersona(null, documento)) {
    const digitos = digitosDocumento(documento)
    return { tipo: 'persona', hash: digitos && hash ? hash(digitos) : null }
  }
  const empresaNombre = nombreProveedor && tieneMarcaJuridica(nombreProveedor) ? nombreDeEmpresa(nombreProveedor) : null
  if (empresaNombre) return { tipo: 'empresa', nit: null, nombre: empresaNombre, origen: 'nombre' }
  const empresaTitulo = empresaDelTitulo(titulo, descripcion, cleanText(raw.entidad ?? null, 300))
  if (empresaTitulo) return { tipo: 'empresa', nit: null, nombre: empresaTitulo, origen: 'titulo' }
  if (nombreProveedor) return { tipo: 'persona', hash: null }
  return { tipo: 'ninguno' }
}

// ---------------------------------------------------------------------------------------------
// 3. Datos personales en la descripción
// ---------------------------------------------------------------------------------------------

/**
 * Palabras que, justo después de "PACIENTE", indican que no viene un nombre ("el paciente oncológico", "paciente que
 * requiere", "paciente y su familia"). Si no viene un nombre ni un documento, la cláusula no se toca.
 */
const GENERICOS_TRAS_PACIENTE = new Set([
  'que', 'quien', 'quienes', 'cuyo', 'cuya', 'con', 'en', 'y', 'o', 'u', 'de', 'del', 'la', 'el', 'los', 'las', 'lo', 'le', 'por', 'para',
  'a', 'al', 'se', 'su', 'sus', 'sea', 'es', 'esta', 'ser', 'como', 'segun', 'sin', 'mediante', 'durante', 'debe', 'requiere', 'requieran',
  'oncologico', 'oncologica', 'cronico', 'cronica', 'critico', 'critica', 'pediatrico', 'pediatrica', 'adulto', 'adulta', 'neonato',
  'neonatal', 'mayor', 'menor', 'gestante', 'politraumatizado', 'politraumatizada', 'quirurgico', 'quirurgica', 'hospitalizado',
  'hospitalizada', 'ambulatorio', 'ambulatoria', 'atendido', 'atendida', 'afiliado', 'afiliada', 'usuario', 'usuaria', 'ingresado',
  'ingresada', 'sometido', 'sometida', 'victima', 'trasladado', 'remitido', 'remitida', 'tratante', 'interno', 'externo', 'renal',
  'diabetico', 'diabetica', 'institucionalizado', 'particular', 'soat', 'eps', 'objeto', 'beneficiario', 'beneficiaria',
  'amputado', 'amputada', 'lesionado', 'lesionada', 'operado', 'operada', 'intervenido', 'intervenida', 'fallecido', 'fallecida',
  'discapacitado', 'discapacitada', 'descentralizado', 'domiciliario', 'domiciliaria', 'trasplantado', 'quemado', 'quemada',
  'solicitado', 'solicitada', 'externo', 'abogado', 'apoderado',
])

/** Palabras de identificación: si la cláusula del paciente las trae, se redacta aunque no haya nombre. */
const RE_IDENTIFICACION =
  /\b(identificad[oa]s?|c\s?c|cedula|ciudadania|cuidadania|tarjeta de identidad|t\s?i|registro civil|r\s?c|nuip|pasaporte|documento omitido)\b/
/** Número de documento: con puntos (1.234.567) o de 6 a 11 dígitos seguidos (no dentro de un código más largo). */
const RE_NUMERO_DOCUMENTO = /(^|[^\d.,a-z])(\d{1,3}(?:\.\d{3}){1,3}|\d{6,11})(?![\d])/
/** Candidatos a fin de la cláusula del paciente (sobre texto plegado): palabras, signos y puntos. */
const RE_FIN_CLAUSULA = /\s+(?:quien(?:es)?|a cargo|con diagnostico|que|por|requieren?|en el servicio|del servicio|lo requiere)\b|[,;()]|\.(?=\s|$)/g

/**
 * Dónde termina la cláusula que sigue a "PACIENTE" (texto plegado): en "QUIEN", "A CARGO", "CON DIAGNÓSTICO", "QUE",
 * "POR", una coma, un punto y coma, un paréntesis o un punto seguido de espacio que cierra una palabra o un número. Los
 * puntos de las abreviaturas de documento ("C.C.", "T.I.", "No.", "Nro.") no la terminan.
 */
function finDeClausula(resto: string): number {
  RE_FIN_CLAUSULA.lastIndex = 0
  for (let m = RE_FIN_CLAUSULA.exec(resto); m; m = RE_FIN_CLAUSULA.exec(resto)) {
    if (m[0] === '.') {
      const previo = resto.slice(Math.max(0, m.index - 4), m.index)
      const cierraPalabraONumero = /(\d|\]|[a-z]{3})$/.test(previo) && !/(^|[^a-z])(nro|no)$/.test(previo)
      if (!cierraPalabraONumero) continue
    }
    return m.index
  }
  return resto.length
}

/**
 * Palabras tras las cuales SECOP escribe el nombre de una persona natural (texto plegado): el paciente, y las partes de
 * un proceso judicial ("dictamen pericial … demandante <NOMBRE>") o un "señor(a) <NOMBRE>". En plural solo cuentan si
 * traen una identificación ("PACIENTES" a secas es genérico).
 */
const RE_PERSONA_NOMBRADA = /\b(pacientes?|demandantes?|demandad[oa]s?|accionantes?|accionad[oa]s?|convocantes?|senor(?:a|es|as)?)\b/g

/** ¿El tramo (texto plegado) trae una identificación o un número de documento? */
function tieneIdentificacion(tramo: string): boolean {
  return RE_IDENTIFICACION.test(normalizeText(tramo)) || RE_NUMERO_DOCUMENTO.test(tramo)
}

/** RE_PERSONA_NOMBRADA sin /g (test sin lastIndex). */
const RE_PERSONA_NOMBRADA_UNA = new RegExp(RE_PERSONA_NOMBRADA.source)

/**
 * ¿Un nombre (de proveedor o el título) trae un dato personal? Una persona nombrada (paciente, señor(a), demandante…),
 * una identificación (CC, TI, cédula, pasaporte…), un número de 6 o más dígitos (con o sin puntos de miles) o algo que
 * redactarDatosPersonales quitaría. Si lo trae, el nombre no se guarda ni se muestra.
 */
export function tieneDatoPersonal(texto: string | null): boolean {
  if (!texto) return false
  const norm = normalizeText(texto)
  if (RE_PERSONA_NOMBRADA_UNA.test(norm) || RE_IDENTIFICACION.test(norm)) return true
  if (/\d{6,}/.test(texto.replace(/(\d)[.,](?=\d)/g, '$1'))) return true
  return redactarDatosPersonales(texto) !== texto.replace(/\s+/g, ' ').trim()
}

/** Texto en minúsculas y sin tildes, con el MISMO largo que el original (para cortar el original por posiciones). */
function plegar(texto: string): string {
  let out = ''
  for (const ch of texto) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // 'ñ' → 'n'; si la descomposición cambiara el largo (no pasa con el español), se deja el carácter tal cual
    out += base.length === ch.length ? base.toLowerCase() : ch.toLowerCase()
  }
  return out
}

/**
 * Etiqueta de documento de identidad seguida del número: "C.C. 1.234.567", "CEDULA DE CIUDADANIA No. 12345678",
 * "TARJETA DE IDENTIDAD 1.023.456.789", "TI 1023456789". Un número sin esta etiqueta (contrato, resolución) no se toca.
 */
const RE_DOCUMENTO_ETIQUETADO =
  /\b(c\.?\s?c\.?|c[eé]dula(?:\s+de\s+(?:ciudadan[ií]a|cuidadan[ií]a|extranjer[ií]a))?|t\.?\s?i\.?|tarjeta\s+de\s+identidad|registro\s+civil|r\.?\s?c\.?|nuip|pasaporte|documento\s+de\s+identidad)(\s*(?:n[o°º]\.?|nro\.?|n[uú]mero|#)?\s*[:\-]?\s*)(\d{1,3}(?:\.\d{3}){1,3}|\d{6,11})(?!\d)/gi

/**
 * Quita de un texto de SECOP el nombre y el documento de un paciente antes de guardarlo o mostrarlo:
 *   - Cualquier documento tras CC / TI / CÉDULA / TARJETA DE IDENTIDAD / REGISTRO CIVIL / PASAPORTE →
 *     "[documento omitido]".
 *   - "PARA EL PACIENTE <NOMBRE> IDENTIFICADO CON CEDULA <NUM> QUIEN REQUIERE…" → "PARA EL PACIENTE [dato personal
 *     omitido] QUIEN REQUIERE…": desde "PACIENTE" hasta el fin de la cláusula (QUIEN, A CARGO, coma, punto…), cuando
 *     detrás viene un nombre (una palabra que no es genérica) o una identificación o un número de documento. Igual con
 *     "PACIENTES" seguido de una lista con identificación, y con las partes de un proceso judicial o un "señor(a)"
 *     ("… DEMANDANTE <NOMBRE> SOLICITADO POR …").
 * No toca "PACIENTES" (plural genérico), "el paciente oncológico", ni números de contrato, de resolución o de radicado
 * (no van tras una etiqueta de documento de identidad ni dentro de la cláusula de un paciente). null → null.
 */
export function redactarDatosPersonales(texto: string | null): string | null {
  if (texto === null || texto === undefined) return null
  // 1. Documentos etiquetados en cualquier parte del texto
  let out = String(texto).replace(RE_DOCUMENTO_ETIQUETADO, (_m, etiqueta: string, separador: string) => `${etiqueta}${separador}${DOCUMENTO_OMITIDO}`)

  // 2. Cláusula de la persona nombrada (paciente, demandante, señor…) con nombre, identificación o número
  let desde = 0
  for (;;) {
    const plegado = plegar(out)
    const re = RE_PERSONA_NOMBRADA
    re.lastIndex = desde
    const match = re.exec(plegado)
    if (!match) break
    const plural = match[0].endsWith('s')
    const inicio = match.index + match[0].length
    const resto = plegado.slice(inicio)
    let largo = finDeClausula(resto)
    const clausula = resto.slice(0, largo)
    const palabras = normalizeText(clausula).split(' ').filter(Boolean)
    // "PACIENTES" (plural) es genérico salvo que traiga una identificación: entonces es una lista de pacientes
    const conNombre = !plural && palabras.length > 0 && !GENERICOS_TRAS_PACIENTE.has(palabras[0]) && !/^\d/.test(palabras[0])
    const conDocumento = tieneIdentificacion(clausula)
    if (palabras.length > 0 && (conNombre || conDocumento)) {
      // Lista separada por comas ("…PACIENTES A IDENTIFICADO CON CC 1, B IDENTIFICADO CON CC 2 QUIEN…"): se extiende
      // mientras el siguiente tramo también traiga una identificación
      while (conDocumento && resto[largo] === ',') {
        const siguiente = resto.slice(largo + 1)
        const tramo = finDeClausula(siguiente)
        if (!tieneIdentificacion(siguiente.slice(0, tramo))) break
        largo += 1 + tramo
      }
      const antes = out.slice(0, inicio)
      const despues = out.slice(inicio + largo)
      const reemplazo = ` ${DATO_PERSONAL_OMITIDO}${despues === '' || /^[\s,;().]/.test(despues) ? '' : ' '}`
      out = `${antes}${reemplazo}${despues}`
      desde = antes.length + reemplazo.length
    } else {
      desde = inicio
    }
  }

  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

// ---------------------------------------------------------------------------------------------
// 4. Mapeo
// ---------------------------------------------------------------------------------------------

const RE_NOTICE = /noticeUID=(CO1\.NTC\.\d+)/i
/** Página de ingreso de SECOP (3 filas la traen en lugar del expediente): no es un enlace útil. */
const RE_URL_LOGIN = /\/STS\/Users\/Login/i

/** URL del expediente (http/https y sin la página de ingreso) o null. */
export function urlDelProceso(urlproceso: unknown): string | null {
  const url = cleanText(urlproceso ?? null, 1000)
  if (!url || !/^https?:\/\/[^\s"'<>]+$/i.test(url) || RE_URL_LOGIN.test(url)) return null
  return url
}

/** noticeUID (CO1.NTC.n) de la URL del expediente; null si no lo trae. */
export function noticeUidDe(url: string | null): string | null {
  return url ? RE_NOTICE.exec(url)?.[1] ?? null : null
}

/**
 * Fila cruda de p6dx-8zbt → ProcesoRow, o el motivo por el que no se guarda (en este orden):
 *   sin id_del_proceso CO1.REQ.n → 'sin_id' · NIT de entidad ilegible → 'nit_entidad' · NIT fuera de ctx.entidades →
 *   'entidad_no_objetivo' · estado no guardable (Borrador, En aprobación, Aprobado…) → 'estado' · servicio de médicos o
 *   personal (motivo 'servicio') → 'servicio' · solo clasifica por la categoría UNSPSC sin texto ortopédico (motivo
 *   'unspsc' y el texto no pasa el prefiltro; ruido de Yolombó) → 'unspsc' · sin línea → 'no_clasificado'.
 * Clasifica con clasificarContrato(descripción, título, UNSPSC); el título solo entra si no es el nombre del proveedor
 * (ni el nombre_del_proveedor ni una empresa con marca jurídica y sin verbo de objeto). La descripción se guarda
 * redactada; el título nunca se guarda.
 */
export function mapSecopProceso(raw: SecopRaw, ctx: ProcesoMapContext): ProcesoMapResult {
  const idProceso = cleanText(raw.id_del_proceso ?? null, 60)
  // CHECK secop_procesos_id_proceso_check: siempre CO1.REQ.n (lo es en el 100 % de las filas de 24 meses)
  if (!idProceso || !/^CO1\.REQ\.\d+$/.test(idProceso)) return { descartado: 'sin_id', detalle: idProceso ?? '' }
  const nitEntidad = normalizeNit(raw.nit_entidad ?? null)
  if (!nitEntidad) return { descartado: 'nit_entidad', detalle: String(raw.nit_entidad ?? '') }
  if (!ctx.entidades.has(nitEntidad)) return { descartado: 'entidad_no_objetivo', detalle: nitEntidad }

  const estadoSecop = cleanText(raw.estado_del_procedimiento ?? null, 80)
  const estado = estadoDeProceso(estadoSecop, raw.adjudicado ?? null)
  if (!estado) return { descartado: 'estado', detalle: estadoSecop ?? '' }

  const descripcionCruda = cleanText(raw.descripci_n_del_procedimiento ?? null)
  const titulo = cleanText(raw.nombre_del_procedimiento ?? null, 1000)
  const nombreProveedor = cleanText(raw.nombre_del_proveedor ?? null, 300)
  // El título entra a la clasificación salvo que sea el nombre de una empresa (caso (c)) o el del proveedor
  const tituloEsNombre =
    titulo !== null && (tituloEsEmpresa(titulo, descripcionCruda) || (nombreProveedor !== null && normalizeText(titulo) === normalizeText(nombreProveedor)))
  const unspsc = cleanText(raw.codigo_principal_de_categoria ?? null, 40)
  const clasificacion = clasificarContrato(descripcionCruda, tituloEsNombre ? null : titulo, unspsc)
  if (clasificacion.motivo === 'servicio') return { descartado: 'servicio' }
  if (clasificacion.motivo === 'unspsc' && !pasaPrefiltro(descripcionCruda, tituloEsNombre ? null : titulo)) return { descartado: 'unspsc' }
  if (clasificacion.linea === 'no_clasificado') return { descartado: 'no_clasificado', detalle: clasificacion.motivo }

  const proveedor = proveedorQueFigura(raw, ctx.hashDocumento)
  const empresa = proveedor.tipo === 'empresa' ? proveedor : null
  const adjudicado = esSi(raw.adjudicado ?? null)
  const valorAdjudicado = adjudicado ? toMoney(raw.valor_total_adjudicacion ?? null) : null
  const url = urlDelProceso(raw.urlproceso)

  return {
    row: {
      id_proceso: idProceso,
      portafolio: cleanText(raw.id_del_portafolio ?? null, 60),
      notice_uid: noticeUidDe(url ?? cleanText(raw.urlproceso ?? null, 1000)),
      referencia: cleanText(raw.referencia_del_proceso ?? null, 300),
      nit_entidad: nitEntidad,
      nombre_entidad: cleanText(raw.entidad ?? null, 300),
      hospital_id: ctx.hospitalPorNit?.get(nitEntidad) ?? null,
      modalidad: cleanText(raw.modalidad_de_contratacion ?? null, 200),
      tipo_contrato: cleanText(raw.tipo_de_contrato ?? null, 120),
      estado_secop: estadoSecop,
      estado,
      adjudicado,
      precio_base: toMoney(raw.precio_base ?? null),
      valor_adjudicado: valorAdjudicado !== null && valorAdjudicado > 0 ? valorAdjudicado : null,
      fecha_publicacion: toIsoDate(raw.fecha_de_publicacion_del ?? null),
      fecha_adjudicacion: toIsoDate(raw.fecha_adjudicacion ?? null),
      proveedor_nit: empresa?.nit ?? null,
      proveedor_nombre: empresa?.nombre ?? null,
      proveedor_origen: empresa?.origen ?? null,
      proveedor_hash: proveedor.tipo === 'persona' ? proveedor.hash : null,
      es_persona: proveedor.tipo === 'persona',
      proveedor_vigilado_id: empresa?.nit && ctx.vigilados?.has(empresa.nit) ? empresa.nit : null,
      descripcion: redactarDatosPersonales(descripcionCruda),
      linea: clasificacion.linea as SecopLineaProducto,
      lineas: clasificacion.lineas,
      motivo: clasificacion.motivo,
      clasificacion_version: CLASIFICACION_VERSION,
      categoria_unspsc: unspsc,
      url,
      ultima_lectura: ctx.ahora ?? null,
    },
  }
}

const clave = (row: ProcesoRow) => row.proveedor_nit ?? (row.proveedor_hash ? `h:${row.proveedor_hash}` : row.proveedor_nombre ? `n:${normalizeText(row.proveedor_nombre)}` : row.es_persona ? 'persona' : '')

/**
 * Una fila por id_proceso (procesos con lotes: una fila de p6dx-8zbt por lote). Se queda con la primera fila y:
 * valor_adjudicado = suma de los lotes (null si ninguno); adjudicado = alguno; fecha_adjudicacion = la mayor; lineas =
 * unión (la principal primero); proveedor = el de todos los lotes si coincide, si no el del lote de mayor valor.
 * Las filas deben ser UNA lectura de la pasada (todas las páginas): el upsert por id_proceso reemplaza, no acumula, así
 * que si un proceso queda partido entre dos páginas hay que juntar las dos antes de llamar aquí.
 */
export function agregarLotes(rows: readonly ProcesoRow[]): ProcesoRow[] {
  const grupos = new Map<string, ProcesoRow[]>()
  for (const row of rows) {
    const list = grupos.get(row.id_proceso)
    if (list) list.push(row)
    else grupos.set(row.id_proceso, [row])
  }
  const out: ProcesoRow[] = []
  grupos.forEach(lotes => {
    if (lotes.length === 1) {
      out.push(lotes[0])
      return
    }
    const base = lotes[0]
    const valores = lotes.map(l => l.valor_adjudicado).filter((v): v is number => v !== null)
    const lineas: SecopLineaProducto[] = []
    for (const lote of lotes) for (const linea of lote.lineas) if (!lineas.includes(linea)) lineas.push(linea)
    const fechas = lotes.map(l => l.fecha_adjudicacion).filter((f): f is string => f !== null).sort()
    const mismoProveedor = lotes.every(l => clave(l) === clave(base))
    const principal = mismoProveedor ? base : lotes.reduce((a, b) => ((b.valor_adjudicado ?? 0) > (a.valor_adjudicado ?? 0) ? b : a))
    out.push({
      ...base,
      adjudicado: lotes.some(l => l.adjudicado),
      valor_adjudicado: valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      fecha_adjudicacion: fechas.length ? fechas[fechas.length - 1] : null,
      lineas,
      proveedor_nit: principal.proveedor_nit,
      proveedor_nombre: principal.proveedor_nombre,
      proveedor_origen: principal.proveedor_origen,
      proveedor_hash: principal.proveedor_hash,
      es_persona: principal.es_persona,
      proveedor_vigilado_id: principal.proveedor_vigilado_id,
    })
  })
  return out
}

// ---------------------------------------------------------------------------------------------
// 5. Tareas y URLs SoQL
// ---------------------------------------------------------------------------------------------

export interface ProcesosTarea {
  /** NIT de 9 dígitos de las entidades objetivo. */
  nits: string[]
}

/** Lotes de PROCESOS_TAREA_TAMANO NIT (ordenados, sin repetidos). */
export function buildProcesosTareas(entidades: readonly string[], tamano = PROCESOS_TAREA_TAMANO): ProcesosTarea[] {
  const nits = Array.from(new Set(entidades)).sort()
  const tareas: ProcesosTarea[] = []
  for (let i = 0; i < nits.length; i += tamano) tareas.push({ nits: nits.slice(i, i + tamano) })
  return tareas
}

/**
 * Desde qué fecha se lee ('YYYY-MM-DD'): inicial = primer día del mes de hace PROCESOS_MESES_INICIAL meses (cubre la
 * ventana de 24 meses de la ficha, que empieza el primer día de hace 23); incremental = hoy − PROCESOS_DIAS_INCREMENTAL.
 */
export function desdeProcesos(modo: 'inicial' | 'incremental', hoy: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) throw new Error(`desdeProcesos: hoy debe ser 'YYYY-MM-DD' (llegó ${JSON.stringify(hoy)})`)
  if (modo === 'incremental') return restarDias(hoy, PROCESOS_DIAS_INCREMENTAL)
  const [y, m] = hoy.split('-').map(Number)
  const total = y * 12 + (m - 1) - PROCESOS_MESES_INICIAL
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

/** Campos de texto del prefiltro (los que clasifica mapSecopProceso). */
export const PROCESOS_PREFILTRO_CAMPOS: readonly string[] = ['nombre_del_procedimiento', 'descripci_n_del_procedimiento']

const sq = (value: string) => `'${value.replace(/'/g, "''")}'`

/** Prefiltro ortopédico: raíces de SECOP_PREFILTRO_RAICES en los dos campos de texto o UNSPSC 4232 (V1.4232…). */
export function prefiltroProcesosSoql(): string {
  const partes = PROCESOS_PREFILTRO_CAMPOS.flatMap(campo => SECOP_PREFILTRO_RAICES.map(raiz => `upper(${campo}) like ${sq(`%${raiz}%`)}`))
  for (const prefijo of SECOP_UNSPSC_ORTOPEDIA_PREFIJOS) partes.push(`codigo_principal_de_categoria like ${sq(`V1.${prefijo}%`)}`)
  return partes.join(' OR ')
}

export interface ProcesosUrlOptions {
  /** Fecha mínima de publicación, 'YYYY-MM-DD'. */
  desde: string
  offset: number
  limit: number
  base?: string
}

/**
 * URL SoQL de una página de una tarea: nit_entidad in (9 dígitos y 10 con DV, sin guion: nunca aparece), prefiltro
 * ortopédico y fecha_de_publicacion_del >= desde; orden por id_del_proceso (las filas de un mismo proceso con lotes
 * quedan juntas). Los procesos sin fecha de publicación (Borrador, Aprobado…) quedan fuera a propósito.
 */
export function buildProcesosUrl(tarea: ProcesosTarea, opciones: ProcesosUrlOptions): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opciones.desde)) throw new Error(`buildProcesosUrl: desde debe ser 'YYYY-MM-DD' (llegó ${JSON.stringify(opciones.desde)})`)
  const valores = tarea.nits.flatMap(nit => variantesNit(nit)).filter(v => /^\d+$/.test(v))
  const condiciones = [
    `nit_entidad in (${valores.map(sq).join(',')})`,
    `(${prefiltroProcesosSoql()})`,
    `fecha_de_publicacion_del >= ${sq(`${opciones.desde}T00:00:00.000`)}`,
  ]
  const params = new URLSearchParams({
    $where: condiciones.join(' AND '),
    $order: 'id_del_proceso',
    $limit: String(opciones.limit),
    $offset: String(opciones.offset),
  })
  return `${opciones.base ?? SECOP_BASE_URL}/resource/${SECOP_PROCESOS_DATASET}.json?${params.toString()}`
}
