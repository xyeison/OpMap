// Histórico del Excel "Tracker Líderes" de la directora comercial (dueño, 2026-10-29,
// docs/decisiones/2026-10-29-historico-tracker-lideres.md). El navegador lee la hoja REGISTRO y se queda con lo que
// sirve para el seguimiento: fecha, líder, ciudad, tipo, estado, cuántos médicos o contactos y si tenía observación.
// Ningún texto libre sale del navegador: ni los nombres de médicos o contactos, ni las observaciones, ni un tipo
// escrito a mano (solo la marca "a mano"), ni una fecha ilegible (solo sus dígitos y separadores). Pueden traer datos de
// médicos y de pacientes. El servidor reconoce a cada líder (su usuario) y cada ciudad (código DANE) y reemplaza el
// histórico completo: el Excel manda. Puro (sin red): lo usan /lideres y /api/lideres/historico.
// Pruebas: scripts/lideres-historico-check.ts.

/** Encabezados de la hoja REGISTRO (se comparan sin tildes ni mayúsculas). */
export const COLUMNAS_TRACKER = {
  fecha: 'Fecha',
  lider: 'Líder',
  ciudad: 'Ciudad',
  tipo: 'Tipo de actividad',
  estado: 'Estado',
  contactos: 'Médicos / Contactos',
  observaciones: 'Observaciones',
} as const

export const HOJA_TRACKER = 'REGISTRO'

export const TIPOS_HISTORICO = ['visita_medico', 'correria', 'reunion_clinica', 'congreso', 'capacitacion', 'cena', 'almuerzo', 'cirugia', 'otro'] as const
export type TipoHistorico = (typeof TIPOS_HISTORICO)[number]

export const TIPO_TEXTO: Record<TipoHistorico, string> = {
  visita_medico: 'Visita a médico',
  correria: 'Correría',
  reunion_clinica: 'Reunión clínica',
  congreso: 'Congreso o evento',
  capacitacion: 'Capacitación',
  cena: 'Cena comercial',
  almuerzo: 'Almuerzo comercial',
  cirugia: 'Cirugía',
  otro: 'Otro',
}

export const ESTADOS_HISTORICO = ['realizada', 'cancelada', 'sin_cerrar', 'planificada'] as const
export type EstadoHistorico = (typeof ESTADOS_HISTORICO)[number]

export const ESTADO_TEXTO: Record<EstadoHistorico, string> = {
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  sin_cerrar: 'Vencida sin cerrar',
  planificada: 'Planificada',
}

/** Filas por carga (el Excel de hoy tiene 263). */
export const MAX_FILAS_TRACKER = 5000
/** El encabezado se busca en las primeras filas con algo escrito (puede haber un título encima). */
export const FILAS_PARA_ENCABEZADO = 10

/** Lo único que se manda y se guarda de cada fila. */
export interface FilaTracker {
  /** Número de fila en la hoja (la del encabezado es la 1). */
  fila: number
  /** AAAA-MM-DD; null si no se pudo leer. */
  fecha: string | null
  /** Si no se pudo leer: solo sus dígitos y separadores ("31/02/2026"), o "sin fecha". Nunca texto libre. */
  fecha_texto: string | null
  /** El nombre de la líder como está en el Excel. */
  lider_texto: string
  /** La ciudad como está en el Excel. */
  ciudad_texto: string
  tipo: TipoHistorico
  /** El tipo no es uno de la lista del Excel (se escribió a mano). El texto no se manda: puede traer datos de pacientes. */
  tipo_a_mano: boolean
  estado: EstadoHistorico
  /** Cuántos médicos o contactos se anotaron (sin sus nombres). */
  contactos: number
  con_observacion: boolean
}

export interface LecturaTracker {
  filas: FilaTracker[]
  /** Filas de la hoja con algo escrito pero sin líder (no se guardan). */
  sinLider: number
  /** Filas con un estado que no es "Exitosa" ni "Cancelada" ni vacío ("Reprogramada"…): se cuentan como sin cerrar o planificadas. */
  estadosNoReconocidos: number
}

/** Solo dígitos y separadores de una fecha ilegible (sin letras: no entra texto libre). */
export function fechaIlegible(valor: unknown): string {
  const solo = String(valor ?? '').replace(/[^0-9 /.:-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40)
  return /[0-9]/.test(solo) ? solo : 'sin fecha'
}

/** Sin tildes, minúsculas, sin signos y con un espacio entre palabras: "Bogotá, D.C." → "bogota d c". */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
}

const texto = (valor: unknown) => String(valor ?? '').replace(/\s+/g, ' ').trim()
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Índice de cada columna en el encabezado, o el nombre de las que faltan. */
export function indicesColumnas(encabezado: unknown[]): { ok: true; indices: Record<keyof typeof COLUMNAS_TRACKER, number> } | { ok: false; faltan: string[] } {
  const normalizados = encabezado.map(normalizarTexto)
  const indices = {} as Record<keyof typeof COLUMNAS_TRACKER, number>
  const faltan: string[] = []
  for (const [clave, nombre] of Object.entries(COLUMNAS_TRACKER) as Array<[keyof typeof COLUMNAS_TRACKER, string]>) {
    const indice = normalizados.indexOf(normalizarTexto(nombre))
    if (indice === -1) faltan.push(nombre)
    else indices[clave] = indice
  }
  return faltan.length ? { ok: false, faltan } : { ok: true, indices }
}

/**
 * Fecha de una celda: número de serie de Excel (1 = 1900-01-01), Date, "dd/mm/aaaa" o "aaaa-mm-dd". null si no se lee
 * o si el año no es razonable (antes de 2020 o más de 2 años después del corte).
 */
export function fechaDeCelda(valor: unknown, corte: string): string | null {
  let anio: number
  let mes: number
  let dia: number
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // floor: la parte decimal es la hora (18:00 del 20 sigue siendo el 20)
    const fecha = new Date(Date.UTC(1899, 11, 30) + Math.floor(valor) * 86400000)
    ;[anio, mes, dia] = [fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate()]
  } else if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    ;[anio, mes, dia] = [valor.getFullYear(), valor.getMonth() + 1, valor.getDate()]
  } else {
    const t = texto(valor)
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
    const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
    if (dmy) [anio, mes, dia] = [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])]
    else if (ymd) [anio, mes, dia] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])]
    else return null
  }
  const iso = `${anio}-${pad2(mes)}-${pad2(dia)}`
  const real = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(real.getTime()) || real.getUTCMonth() + 1 !== mes || real.getUTCDate() !== dia) return null
  if (anio < 2020 || anio > Number(corte.slice(0, 4)) + 2) return null
  return iso
}

const TIPOS_EXACTOS: Record<string, TipoHistorico> = {
  'visita medico': 'visita_medico',
  'correria': 'correria',
  'reunion clinica': 'reunion_clinica',
  'congreso evento': 'congreso',
  'capacitacion': 'capacitacion',
  'cena comercial': 'cena',
  'almuerzo comercial': 'almuerzo',
  'cirugia': 'cirugia',
  'otro': 'otro',
}

/** Tipo de la lista del Excel; lo escrito a mano se acerca por la palabra con que empieza, y si no, "otro". */
export function tipoDeTexto(valor: unknown): { tipo: TipoHistorico; aMano: boolean } {
  const t = normalizarTexto(valor)
  if (TIPOS_EXACTOS[t]) return { tipo: TIPOS_EXACTOS[t], aMano: false }
  if (!t) return { tipo: 'otro', aMano: true }
  if (t.startsWith('correri')) return { tipo: 'correria', aMano: true }
  if (t.includes('visita') && t.includes('medic')) return { tipo: 'visita_medico', aMano: true }
  if (t.startsWith('cirugi')) return { tipo: 'cirugia', aMano: true }
  if (t.startsWith('capacitaci')) return { tipo: 'capacitacion', aMano: true }
  if (t.startsWith('congreso')) return { tipo: 'congreso', aMano: true }
  if (t.startsWith('reunion')) return { tipo: 'reunion_clinica', aMano: true }
  if (t.startsWith('cena')) return { tipo: 'cena', aMano: true }
  if (t.startsWith('almuerzo')) return { tipo: 'almuerzo', aMano: true }
  return { tipo: 'otro', aMano: true }
}

/**
 * "Exitosa" → realizada; "Cancelada" → cancelada; lo demás → planificada si la fecha es la del corte o posterior (lo de
 * hoy aún puede cerrarse), si no, sin cerrar.
 */
export function estadoDeTexto(valor: unknown, fecha: string | null, corte: string): EstadoHistorico {
  const t = normalizarTexto(valor)
  if (t.startsWith('exitos')) return 'realizada'
  if (t.startsWith('cancel')) return 'cancelada'
  return fecha && fecha >= corte ? 'planificada' : 'sin_cerrar'
}

/** ¿El estado escrito es uno de los del Excel (Exitosa, Cancelada o vacío)? */
export function estadoReconocido(valor: unknown): boolean {
  const t = normalizarTexto(valor)
  return t === '' || t.startsWith('exitos') || t.startsWith('cancel')
}

/** Cuántos nombres hay en la celda de médicos o contactos (separados por coma, punto y coma o salto de línea). */
export function contarContactos(valor: unknown): number {
  return String(valor ?? '')
    .split(/[,;\n]/)
    .map(parte => parte.trim())
    .filter(Boolean).length
}

/**
 * Lee la hoja REGISTRO como arreglo de filas desde la fila 1 (sheet_to_json con range: 0). El encabezado es la primera
 * de las FILAS_PARA_ENCABEZADO filas con algo escrito que tiene todas las columnas (puede haber un título encima).
 * Devuelve solo los campos de FilaTracker: los nombres de médicos o contactos, las observaciones, el tipo escrito a mano
 * y el texto de una fecha ilegible se cuentan o se reducen aquí y no salen.
 * @param corte AAAA-MM-DD: el día de la carga (decide planificada o sin cerrar).
 */
export function leerTracker(filas: unknown[][], corte: string): { ok: true; lectura: LecturaTracker } | { ok: false; error: string } {
  const conAlgo = filas.map((fila, indice) => ({ fila, indice })).filter(({ fila }) => Array.isArray(fila) && fila.some(celda => texto(celda) !== ''))
  if (conAlgo.length === 0) return { ok: false, error: 'La hoja REGISTRO está vacía.' }
  const candidatas = conAlgo.slice(0, FILAS_PARA_ENCABEZADO)
  const encontrada = candidatas.find(({ fila }) => indicesColumnas(fila).ok)
  if (!encontrada) {
    const primera = indicesColumnas(candidatas[0].fila)
    return { ok: false, error: `A la hoja REGISTRO le faltan las columnas: ${primera.ok ? '' : primera.faltan.join(', ')}.` }
  }
  const columnas = indicesColumnas(encontrada.fila)
  if (!columnas.ok) return { ok: false, error: 'No se encontró el encabezado de la hoja REGISTRO.' }
  const inicio = encontrada.indice
  const i = columnas.indices
  const salida: FilaTracker[] = []
  let sinLider = 0
  let estadosNoReconocidos = 0
  for (let n = inicio + 1; n < filas.length; n++) {
    const fila = filas[n] ?? []
    if (!fila.some(celda => texto(celda) !== '')) continue
    const lider = texto(fila[i.lider])
    if (!lider) {
      sinLider++
      continue
    }
    const fecha = fechaDeCelda(fila[i.fecha], corte)
    const crudoFecha = fila[i.fecha]
    const tipo = tipoDeTexto(fila[i.tipo])
    if (!estadoReconocido(fila[i.estado])) estadosNoReconocidos++
    salida.push({
      fila: n + 1,
      fecha,
      fecha_texto: fecha ? null : fechaIlegible(crudoFecha instanceof Date ? crudoFecha.toISOString().slice(0, 10) : crudoFecha),
      lider_texto: lider.slice(0, 120),
      ciudad_texto: texto(fila[i.ciudad]).slice(0, 120),
      tipo: tipo.tipo,
      tipo_a_mano: tipo.aMano,
      estado: estadoDeTexto(fila[i.estado], fecha, corte),
      contactos: Math.min(200, contarContactos(fila[i.contactos])),
      con_observacion: texto(fila[i.observaciones]) !== '',
    })
  }
  if (salida.length > MAX_FILAS_TRACKER) return { ok: false, error: `El registro tiene ${salida.length} filas; el máximo es ${MAX_FILAS_TRACKER}.` }
  return { ok: true, lectura: { filas: salida, sinLider, estadosNoReconocidos } }
}

// ---------------------------------------------------------------------------
// Reconocer a la líder y la ciudad (en el servidor)
// ---------------------------------------------------------------------------

export interface UsuarioRef {
  id: string
  full_name: string
  role: string
  active: boolean
}

/**
 * La líder del Excel ("Paola Jiménez", al menos dos palabras) es el usuario cuyo nombre contiene todas sus palabras
 * ("Yineth Paola Jiménez Escobar"), activo o no: el histórico también es de las que ya se fueron.
 * - Si hay uno solo, ese.
 * - Si hay varios, la única líder de negocio entre ellos (activa o no). Así una líder que se fue no queda a nombre de
 *   una Ejecutiva Comercial con un nombre parecido.
 * - Si no, null: no se adivina (y la vista previa lo dice).
 */
export function reconocerLider(nombre: string, usuarios: UsuarioRef[]): string | null {
  const palabras = normalizarTexto(nombre).split(' ').filter(palabra => palabra.length >= 3)
  if (palabras.length < 2) return null
  const contiene = (usuario: UsuarioRef) => {
    const suyas = new Set(normalizarTexto(usuario.full_name).split(' '))
    return palabras.every(palabra => suyas.has(palabra))
  }
  const candidatos = usuarios.filter(contiene)
  if (candidatos.length === 1) return candidatos[0].id
  const lideres = candidatos.filter(usuario => usuario.role === 'line_leader')
  return lideres.length === 1 ? lideres[0].id : null
}

export interface MunicipioRef {
  code: string
  name: string
}

/**
 * Ciudades que el Tracker escribe distinto del nombre del DANE (verificadas a mano el 2026-10-29). Las que no son de
 * Colombia (un congreso en Verona) o son un departamento ("La Guajira") quedan sin código, con su texto.
 */
export const ALIAS_CIUDADES: Readonly<Record<string, string>> = {
  'bogota': '11001',
  'bogota d c': '11001',
  'cartagena': '13001',
  'cucuta': '54001',
  'bquilla': '08001',
  'santa martha': '47001',
  'codazzi': '20013',
  'cali': '76001',
}

/**
 * Código DANE de la ciudad escrita: alias, o nombre exacto (sin tildes) de un municipio. Si el nombre es de varios
 * municipios, la capital (código terminado en 001); si ninguno es capital, null. Nunca por parecido.
 */
export function crearResolutorCiudades(municipios: MunicipioRef[]): (ciudad: string) => string | null {
  const porNombre = new Map<string, string[]>()
  for (const municipio of municipios) {
    const clave = normalizarTexto(municipio.name)
    porNombre.set(clave, [...(porNombre.get(clave) ?? []), municipio.code])
  }
  const existe = new Set(municipios.map(municipio => municipio.code))
  return ciudad => {
    const clave = normalizarTexto(ciudad)
    if (!clave) return null
    const alias = ALIAS_CIUDADES[clave]
    if (alias && existe.has(alias)) return alias
    const codigos = porNombre.get(clave) ?? []
    if (codigos.length === 1) return codigos[0]
    const capitales = codigos.filter(codigo => codigo.endsWith('001'))
    return capitales.length === 1 ? capitales[0] : null
  }
}

// ---------------------------------------------------------------------------
// Lo que manda el navegador
// ---------------------------------------------------------------------------

export interface CargaTracker {
  archivo: string
  /** sha256 del archivo, en hexadecimal: deja rastro de qué versión del Excel se cargó. */
  huella: string
  corte: string
  filas: FilaTracker[]
  /** false: solo la vista previa (quién es quién y qué ciudades no se reconocen); true: reemplaza el histórico. */
  confirmar: boolean
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const FECHA_ILEGIBLE_RE = /^[0-9 /.:-]{1,40}$/
const CLAVES_FILA = ['fila', 'fecha', 'fecha_texto', 'lider_texto', 'ciudad_texto', 'tipo', 'tipo_a_mano', 'estado', 'contactos', 'con_observacion']

/** ¿AAAA-MM-DD es un día que existe (no el 31 de febrero)? */
function diaReal(iso: unknown): iso is string {
  if (typeof iso !== 'string' || !FECHA_RE.test(iso)) return false
  const fecha = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === iso
}

/** Valida el cuerpo de POST /api/lideres/historico. Rechaza cualquier campo de más en las filas (privacidad). */
export function validarCarga(cuerpo: unknown): { ok: true; carga: CargaTracker } | { ok: false; error: string } {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'Cuerpo inválido' }
  const c = cuerpo as Record<string, unknown>
  if (typeof c.archivo !== 'string' || !c.archivo.trim() || c.archivo.length > 200) return { ok: false, error: 'Falta el nombre del archivo' }
  if (typeof c.huella !== 'string' || !/^[0-9a-f]{64}$/.test(c.huella)) return { ok: false, error: 'Huella del archivo inválida' }
  if (!diaReal(c.corte)) return { ok: false, error: 'corte debe ser una fecha AAAA-MM-DD' }
  if (typeof c.confirmar !== 'boolean') return { ok: false, error: 'confirmar debe ser sí o no' }
  if (!Array.isArray(c.filas) || c.filas.length === 0) return { ok: false, error: 'El registro no tiene filas' }
  if (c.filas.length > MAX_FILAS_TRACKER) return { ok: false, error: `Máximo ${MAX_FILAS_TRACKER} filas` }
  const vistas = new Set<number>()
  for (const fila of c.filas as unknown[]) {
    if (!fila || typeof fila !== 'object') return { ok: false, error: 'Fila inválida' }
    const f = fila as Record<string, unknown>
    const extra = Object.keys(f).filter(clave => !CLAVES_FILA.includes(clave))
    if (extra.length) return { ok: false, error: `La fila trae campos que no se guardan: ${extra.join(', ')}` }
    if (!Number.isInteger(f.fila) || (f.fila as number) < 2 || vistas.has(f.fila as number)) return { ok: false, error: 'Número de fila inválido o repetido' }
    vistas.add(f.fila as number)
    if (!(f.fecha === null || diaReal(f.fecha))) return { ok: false, error: `Fila ${f.fila}: fecha inválida` }
    if (f.fecha !== null && f.fecha_texto !== null) return { ok: false, error: `Fila ${f.fila}: con fecha no va el texto de la fecha` }
    if (f.fecha === null && !(f.fecha_texto === 'sin fecha' || (typeof f.fecha_texto === 'string' && FECHA_ILEGIBLE_RE.test(f.fecha_texto)))) {
      return { ok: false, error: `Fila ${f.fila}: la fecha ilegible solo lleva dígitos y separadores` }
    }
    if (typeof f.lider_texto !== 'string' || !f.lider_texto.trim() || f.lider_texto.length > 120) return { ok: false, error: `Fila ${f.fila}: falta la líder` }
    if (typeof f.ciudad_texto !== 'string' || f.ciudad_texto.length > 120) return { ok: false, error: `Fila ${f.fila}: ciudad inválida` }
    if (!(TIPOS_HISTORICO as readonly string[]).includes(f.tipo as string)) return { ok: false, error: `Fila ${f.fila}: tipo inválido` }
    if (typeof f.tipo_a_mano !== 'boolean') return { ok: false, error: `Fila ${f.fila}: tipo_a_mano debe ser sí o no` }
    if (!(ESTADOS_HISTORICO as readonly string[]).includes(f.estado as string)) return { ok: false, error: `Fila ${f.fila}: estado inválido` }
    if (f.estado === 'planificada' && f.fecha === null) return { ok: false, error: `Fila ${f.fila}: una actividad planificada necesita fecha` }
    if (!Number.isInteger(f.contactos) || (f.contactos as number) < 0 || (f.contactos as number) > 200) return { ok: false, error: `Fila ${f.fila}: contactos inválido` }
    if (typeof f.con_observacion !== 'boolean') return { ok: false, error: `Fila ${f.fila}: con_observacion debe ser sí o no` }
  }
  return { ok: true, carga: { archivo: c.archivo.trim(), huella: c.huella, corte: c.corte, filas: c.filas as FilaTracker[], confirmar: c.confirmar } }
}
