// Fase 8 · F3 reporte de visitas y voz: validación (allow-list) de los cuerpos y consultas de /api/me/contexto,
// /api/me/visitas, /api/me/voz/**, /api/me/numeros y /api/me/agenda (0840), y del login móvil. zod descarta cualquier clave no listada:
// nunca se pasa el body entero a una RPC. Mensajes en español, listos para la app.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (sección "Código puro"). Pruebas:
// scripts/reporte-check.ts. Mismo estilo que lib/visits-config-schemas.ts (F2).
//
// Números: se aceptan como número o como texto ("4,7110" o "4.7110"), porque las consultas llegan como texto.
// Opcionales: ausente, '' o null quedan null.
import { z } from 'zod'
import {
  AUDIO_MAX_SEGUNDOS,
  MAX_COMPROMISOS,
  MAX_CONCLUSION,
  MAX_FAILURE_REASON,
  MAX_LINEAS_VISITA,
  MAX_PREGUNTAS_PROPUESTA,
  MAX_TRANSCRIPT,
  MAX_VISITAS_PROPUESTA,
  MAX_DIAS_CONSULTA_AGENDA,
  MAX_MOTIVO_CANCELACION_CITA,
  MAX_NOTA_CITA,
  MENSAJE_HORA_OBLIGATORIA,
  VALORES_MODALIDAD,
  VALORES_MODO_ENTRADA,
  esInstanteIso,
  horaCorta,
  type CamposCrudos,
  type CamposDictado,
  type CitaCancelar,
  type CitaCerrar,
  type CitaCreate,
  type CitaOtraFecha,
  type PropuestaCruda,
  type VisitaCreate,
  type VisitaCreateBase,
  type VisitaUpdate,
} from './reporte-visitas'
import { VALORES_MEDIO_TELEFONICA, VALORES_TIPO_VISITA, diasEntre, esFechaIso, esMesIso } from './visits-rules'
import { MENSAJE_COMO_NO_VALIDO, VALORES_COMO } from './persona-campo'
import {
  MAX_MOTIVO_CIERRE,
  MENSAJE_CANCELAR_SIN_MOTIVO,
  MENSAJE_MOTIVO_NO_VALIDO,
  MENSAJE_MOTIVO_SALIDA,
  VALORES_MOTIVO_CIERRE,
  revisarMotivo,
  type MotivoElegible,
} from './agenda-ciclo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------

/** Número escrito como texto ("12", "4,71", "-74.07") → número; lo demás pasa tal cual. */
function aNumero(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim().replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(texto) ? Number(texto) : valor
}

const MENSAJE_OBJETO = 'Datos no válidos: se esperaba un objeto JSON'

/** Objeto del cuerpo de la petición (con mensaje en español si no es un objeto JSON). */
const cuerpo = <T extends z.ZodRawShape>(forma: T) =>
  z.object(forma, { required_error: MENSAJE_OBJETO, invalid_type_error: MENSAJE_OBJETO })

const idSchema = (mensaje: string) =>
  z
    .string({ required_error: mensaje, invalid_type_error: mensaje })
    .trim()
    .regex(UUID_RE, mensaje)
    .transform(id => id.toLowerCase())

/** Id opcional: ausente, '' o null → null. */
const idOpcional = (mensaje: string) =>
  z
    .string({ invalid_type_error: mensaje })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor.toLowerCase() : null))
    .refine(valor => valor === null || UUID_RE.test(valor), { message: mensaje })

const booleano = (mensaje: string) => z.boolean({ invalid_type_error: mensaje, required_error: mensaje })

/** Texto libre opcional: ausente, '' o null → null; espacios de más fuera. */
const textoOpcional = (maximo: number, invalido: string) =>
  z
    .string({ invalid_type_error: invalido })
    .transform(valor => valor.trim().replace(/\s+/g, ' '))
    .pipe(z.string().max(maximo, `El texto no puede superar ${maximo} caracteres`))
    .nullish()
    .transform(valor => (valor ? valor : null))

const MENSAJE_FECHA = 'Fecha no válida: usa AAAA-MM-DD'

/** Fecha opcional AAAA-MM-DD: ausente, '' o null → null. */
const fechaOpcional = z
  .string({ invalid_type_error: MENSAJE_FECHA })
  .trim()
  .nullish()
  .transform(valor => (valor ? valor : null))
  .refine(valor => valor === null || esFechaIso(valor), { message: MENSAJE_FECHA })

/** Instante ISO 8601 con zona (lo que manda el teléfono). */
const instante = (requerido: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .trim()
    .refine(valor => esInstanteIso(valor), { message: `${requerido} (instante ISO con zona, p. ej. 2026-10-13T10:42:00-05:00)` })

const MENSAJE_LAT = 'Latitud no válida (−90 a 90)'
const MENSAJE_LNG = 'Longitud no válida (−180 a 180)'
const MENSAJE_PRECISION = 'Precisión del GPS no válida (metros, 0 a 100000)'

/** Coordenada opcional: ausente, '' o null → null; texto o número. */
const coordenadaOpcional = (limite: number, mensaje: string) =>
  z
    .preprocess(
      valor => (valor === '' ? null : aNumero(valor)),
      z.number({ invalid_type_error: mensaje }).finite(mensaje).min(-limite, mensaje).max(limite, mensaje).nullish()
    )
    .transform(valor => (valor === undefined ? null : valor))

const precisionOpcional = z
  .preprocess(
    valor => (valor === '' ? null : aNumero(valor)),
    z.number({ invalid_type_error: MENSAJE_PRECISION }).finite(MENSAJE_PRECISION).min(0, MENSAJE_PRECISION).max(100000, MENSAJE_PRECISION).nullish()
  )
  .transform(valor => (valor === undefined || valor === null ? null : Math.round(valor)))

const MENSAJE_LINEAS = `Elige al menos una línea (como máximo ${MAX_LINEAS_VISITA})`

const lineasSchema = z
  .array(idSchema('Línea no válida'), { required_error: MENSAJE_LINEAS, invalid_type_error: MENSAJE_LINEAS })
  .min(1, MENSAJE_LINEAS)
  .max(MAX_LINEAS_VISITA, MENSAJE_LINEAS)
  .refine(ids => new Set(ids).size === ids.length, { message: 'Hay líneas repetidas' })

const MENSAJE_FAILURE = `Indica el motivo de la visita no efectiva (hasta ${MAX_FAILURE_REASON} caracteres)`

/** Ambas coordenadas o ninguna. */
function revisarPunto(datos: { lat: number | null; lng: number | null }, ctx: z.RefinementCtx) {
  if ((datos.lat === null) !== (datos.lng === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [datos.lat === null ? 'lat' : 'lng'], message: 'Manda latitud y longitud juntas' })
  }
}

// ---------------------------------------------------------------------------------------------
// Sesión del teléfono
// ---------------------------------------------------------------------------------------------

/** POST /api/auth/login desde la app: { email, password, cliente: 'movil' } (la ruta aplica además sus límites). */
export const loginMovilSchema = cuerpo({
  email: z
    .string({ required_error: 'Escribe tu email', invalid_type_error: 'Escribe tu email' })
    .trim()
    .toLowerCase()
    .min(1, 'Escribe tu email')
    .max(320, 'Email no válido')
    .email('Email no válido'),
  password: z
    .string({ required_error: 'Escribe tu contraseña', invalid_type_error: 'Escribe tu contraseña' })
    .min(1, 'Escribe tu contraseña')
    .max(1024, 'Contraseña no válida'),
  cliente: z.literal('movil', { errorMap: () => ({ message: "El cliente de la app es 'movil'" }) }),
})

export type LoginMovil = z.infer<typeof loginMovilSchema>

// ---------------------------------------------------------------------------------------------
// Contexto, visitas y números
// ---------------------------------------------------------------------------------------------

/** GET /api/me/contexto?lat=&lng=&precision= (todo opcional; lat y lng van juntas). */
export const contextoQuerySchema = cuerpo({
  lat: coordenadaOpcional(90, MENSAJE_LAT),
  lng: coordenadaOpcional(180, MENSAJE_LNG),
  precision: precisionOpcional,
}).superRefine(revisarPunto)

export type ContextoQuery = z.infer<typeof contextoQuerySchema>

/** GET /api/me/visitas?fecha= (sin fecha: hoy). */
export const visitasQuerySchema = cuerpo({ fecha: fechaOpcional })

const MENSAJE_TIPO = 'Tipo de visita no válido: medica o institucional'
const MENSAJE_MODALIDAD = 'Modalidad no válida: presencial o telefonica'
const MENSAJE_MEDIO = 'Medio no válido: llamada o videollamada'
const MENSAJE_INPUT = 'Modo de entrada no válido: voz o toques'

const camposVisita = {
  client_id: idSchema('client_id no válido (uuid que genera la app)'),
  tipo: z.enum(VALORES_TIPO_VISITA, { errorMap: () => ({ message: MENSAJE_TIPO }) }),
  subtipo_id: idOpcional('Subtipo no válido'),
  medico_id: idOpcional('Médico no válido'),
  cuenta_id: idOpcional('Cuenta no válida'),
  sede_id: idSchema('Elige la sede'),
  contacto_id: idOpcional('Contacto no válido'),
  modalidad: z.enum(VALORES_MODALIDAD, { errorMap: () => ({ message: MENSAJE_MODALIDAD }) }),
  medio: z
    .enum(VALORES_MEDIO_TELEFONICA, { errorMap: () => ({ message: MENSAJE_MEDIO }) })
    .nullish()
    .transform(valor => valor ?? null),
  efectiva: booleano('Indica si la visita fue efectiva (sí o no)'),
  failure_reason: textoOpcional(MAX_FAILURE_REASON, MENSAJE_FAILURE),
  retry_date: fechaOpcional,
  checked_in_at: instante('Falta la hora de llegada'),
  reported_at: instante('Falta la hora del reporte'),
  lat: coordenadaOpcional(90, MENSAJE_LAT),
  lng: coordenadaOpcional(180, MENSAJE_LNG),
  gps_accuracy_m: precisionOpcional,
  conclusion: textoOpcional(MAX_CONCLUSION, 'Conclusión no válida'),
  compromisos: textoOpcional(MAX_COMPROMISOS, 'Compromisos no válidos'),
  next_step_date: fechaOpcional,
  transcript: textoOpcional(MAX_TRANSCRIPT, 'Transcripción no válida'),
  input_mode: z.enum(VALORES_MODO_ENTRADA, { errorMap: () => ({ message: MENSAJE_INPUT }) }),
  lineas: lineasSchema,
  // 0840: la cita de la agenda que se cumple (opcional; sin ella la base vincula sola la del mismo médico o cuenta).
  agenda_id: idOpcional('Cita no válida'),
}

type VisitaPlana = z.infer<z.ZodObject<typeof camposVisita>>

/** Reglas de tipo y modalidad (lo que la base exige con visits_app_check), con el campo que falla. */
function revisarVisita(datos: VisitaPlana, ctx: z.RefinementCtx) {
  const falla = (campo: string, mensaje: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: mensaje })
  if (datos.tipo === 'medica') {
    if (!datos.medico_id) falla('medico_id', 'Elige el médico')
  } else {
    if (!datos.cuenta_id) falla('cuenta_id', 'Elige la cuenta')
    if (!datos.subtipo_id) falla('subtipo_id', 'Elige el subtipo de la visita institucional')
  }
  if (datos.modalidad === 'presencial') {
    if (datos.lat === null && datos.lng === null) falla('lat', 'La ubicación del teléfono es obligatoria en una visita presencial')
    else revisarPunto(datos, ctx)
  } else {
    if (!datos.medio) falla('medio', 'Indica el medio: llamada o videollamada')
    revisarPunto(datos, ctx)
  }
  if (!datos.efectiva && !datos.failure_reason) falla('failure_reason', MENSAJE_FAILURE)
  if (datos.reported_at && datos.checked_in_at && Date.parse(datos.reported_at) < Date.parse(datos.checked_in_at)) {
    falla('reported_at', 'La hora del reporte no puede ser anterior a la de llegada')
  }
}

/**
 * Deja solo los campos que aplican al tipo y a la modalidad (lo demás en null). En una TELEFÓNICA la ubicación del
 * teléfono no se usa ni se guarda (privacidad: la ejecutiva puede estar en su casa; el punto del mapa sale de la sede,
 * de su municipio o de la zona): lat, lng y gps_accuracy_m quedan en null.
 */
function normalizarVisita(datos: VisitaPlana): VisitaCreate {
  const telefonica = datos.modalidad === 'telefonica'
  const base: VisitaCreateBase = {
    client_id: datos.client_id,
    sede_id: datos.sede_id,
    efectiva: datos.efectiva,
    failure_reason: datos.efectiva ? null : datos.failure_reason,
    retry_date: datos.efectiva ? null : datos.retry_date,
    checked_in_at: datos.checked_in_at,
    reported_at: datos.reported_at,
    lat: telefonica ? null : datos.lat,
    lng: telefonica ? null : datos.lng,
    gps_accuracy_m: telefonica ? null : datos.gps_accuracy_m,
    conclusion: datos.conclusion,
    compromisos: datos.compromisos,
    next_step_date: datos.next_step_date,
    transcript: datos.transcript,
    input_mode: datos.input_mode,
    lineas: datos.lineas,
    agenda_id: datos.agenda_id,
  }
  const tipo =
    datos.tipo === 'medica'
      ? { tipo: 'medica' as const, medico_id: datos.medico_id as string, cuenta_id: null, subtipo_id: null, contacto_id: null }
      : {
          tipo: 'institucional' as const,
          medico_id: null,
          cuenta_id: datos.cuenta_id as string,
          subtipo_id: datos.subtipo_id as string,
          contacto_id: datos.contacto_id,
        }
  const modalidad =
    datos.modalidad === 'presencial'
      ? { modalidad: 'presencial' as const, lat: datos.lat as number, lng: datos.lng as number, medio: null }
      : { modalidad: 'telefonica' as const, medio: datos.medio as NonNullable<typeof datos.medio> }
  return { ...base, ...tipo, ...modalidad }
}

/**
 * POST /api/me/visitas. Tipo discriminado (médica: medico_id; institucional: cuenta_id y subtipo_id, contacto
 * opcional), modalidad discriminada (presencial: lat y lng; telefónica: medio), lineas 1..10 sin repetir, textos
 * con tope, instantes ISO con zona. Que el médico, la sede, el subtipo y el contacto existan y crucen, el radio,
 * los topes y el perfil los revisa validarVisita (y la base).
 */
export const visitaCreateSchema: z.ZodType<VisitaCreate, z.ZodTypeDef, unknown> = cuerpo(camposVisita)
  .superRefine(revisarVisita)
  .transform(normalizarVisita)

const sinCambios = (datos: Record<string, unknown>) => Object.values(datos).every(valor => valor === undefined)

/** PATCH /api/me/visitas/[id]: solo lo que la ejecutiva corrige el mismo día (al menos un campo). */
export const visitaUpdateSchema: z.ZodType<VisitaUpdate, z.ZodTypeDef, unknown> = cuerpo({
  conclusion: textoOpcional(MAX_CONCLUSION, 'Conclusión no válida').optional(),
  compromisos: textoOpcional(MAX_COMPROMISOS, 'Compromisos no válidos').optional(),
  next_step_date: fechaOpcional.optional(),
  efectiva: booleano('Indica si la visita fue efectiva (sí o no)').optional(),
  failure_reason: textoOpcional(MAX_FAILURE_REASON, MENSAJE_FAILURE).optional(),
  retry_date: fechaOpcional.optional(),
  lineas: lineasSchema.optional(),
})
  .superRefine((datos, ctx) => {
    if (sinCambios(datos)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'No hay campos para corregir' })
    if (datos.efectiva === false && !datos.failure_reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['failure_reason'], message: MENSAJE_FAILURE })
    }
  })
  .transform(datos => {
    const salida: VisitaUpdate = {}
    if (datos.conclusion !== undefined) salida.conclusion = datos.conclusion
    if (datos.compromisos !== undefined) salida.compromisos = datos.compromisos
    if (datos.next_step_date !== undefined) salida.next_step_date = datos.next_step_date
    if (datos.efectiva !== undefined) salida.efectiva = datos.efectiva
    if (datos.failure_reason !== undefined) salida.failure_reason = datos.failure_reason
    if (datos.retry_date !== undefined) salida.retry_date = datos.retry_date
    if (datos.lineas !== undefined) salida.lineas = datos.lineas
    return salida
  })

const MOTIVO_MINIMO = 5
const MENSAJE_MOTIVO = `Escribe el motivo (al menos ${MOTIVO_MINIMO} caracteres)`

/** POST /api/me/visitas/[id]/anular: motivo de 5 a 300 caracteres. */
export const anularSchema = cuerpo({
  motivo: z
    .string({ required_error: MENSAJE_MOTIVO, invalid_type_error: MENSAJE_MOTIVO })
    .transform(valor => valor.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(MOTIVO_MINIMO, MENSAJE_MOTIVO).max(300, 'El motivo no puede superar 300 caracteres')),
})

export type Anular = z.infer<typeof anularSchema>

const MENSAJE_TRANSCRIPT = `La transcripción va de 1 a ${MAX_TRANSCRIPT} caracteres`

/** POST /api/me/voz/proponer: la transcripción, dónde está (opcional) y la hora del dictado. */
export const proponerSchema = cuerpo({
  transcript: z
    .string({ required_error: MENSAJE_TRANSCRIPT, invalid_type_error: MENSAJE_TRANSCRIPT })
    .transform(valor => valor.trim().replace(/[ \t]+/g, ' '))
    .pipe(z.string().min(1, MENSAJE_TRANSCRIPT).max(MAX_TRANSCRIPT, MENSAJE_TRANSCRIPT)),
  lat: coordenadaOpcional(90, MENSAJE_LAT),
  lng: coordenadaOpcional(180, MENSAJE_LNG),
  precision: precisionOpcional,
  hora: instante('Falta la hora del dictado'),
  // 0840: la cita que la ejecutiva eligió antes de dictar (opcional): Claude prefiere esa cita.
  cita_id: idOpcional('Cita no válida'),
}).superRefine(revisarPunto)

export type Proponer = z.infer<typeof proponerSchema>

/** GET /api/me/numeros?mes=AAAA-MM (sin mes: el de hoy). */
export const numerosQuerySchema = cuerpo({
  mes: z
    .string({ invalid_type_error: 'Mes no válido: usa AAAA-MM' })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor : null))
    .refine(valor => valor === null || (esMesIso(valor) && Number(valor.slice(0, 4)) >= 2000), { message: 'Mes no válido: usa AAAA-MM' }),
})

/** Metadatos del audio que la ruta de transcripción revisa antes de mandarlo (el archivo va aparte). */
export const audioMetaSchema = cuerpo({
  duracion_s: z
    .preprocess(
      valor => (valor === '' ? null : aNumero(valor)),
      z.number({ invalid_type_error: 'Duración no válida' }).finite().min(0).max(AUDIO_MAX_SEGUNDOS, `El audio no puede durar más de ${AUDIO_MAX_SEGUNDOS / 60} minutos`).nullish()
    )
    .transform(valor => (valor === undefined ? null : valor)),
})

// ---------------------------------------------------------------------------------------------
// Lo que devuelve Claude (herramienta proponer_visitas)
// ---------------------------------------------------------------------------------------------

const textoONulo = (max: number) =>
  z
    .string()
    .nullish()
    .transform(valor => (typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, max) : null))

const idONulo = z
  .string()
  .nullish()
  .transform(valor => (typeof valor === 'string' && valor.trim() ? valor.trim() : null))

const visitaPropuestaSchema = z.object({
  tipo: z.enum(VALORES_TIPO_VISITA),
  subtipo_codigo: textoONulo(40),
  medico_id: idONulo,
  medico_nombre_dicho: textoONulo(120),
  sugerir_crear_medico: z.boolean().nullish().transform(valor => valor === true),
  cuenta_id: idONulo,
  sede_id: idONulo,
  contacto_id: idONulo,
  contacto_nombre_dicho: textoONulo(120),
  lineas: z
    .array(z.string())
    .nullish()
    .transform(valor => (Array.isArray(valor) ? valor.filter(id => typeof id === 'string' && id.trim()).slice(0, MAX_LINEAS_VISITA) : [])),
  efectiva: z.boolean().nullish().transform(valor => valor !== false),
  failure_reason: textoONulo(MAX_FAILURE_REASON),
  conclusion: textoONulo(MAX_CONCLUSION),
  compromisos: textoONulo(MAX_COMPROMISOS),
  next_step_date: textoONulo(10),
  modalidad_sugerida: z
    .enum(VALORES_MODALIDAD)
    .nullish()
    .transform(valor => valor ?? 'presencial'),
  confianza: z
    .number()
    .nullish()
    .transform(valor => (typeof valor === 'number' && Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0)),
  preguntas: z
    .array(z.string())
    .nullish()
    .transform(valor => (Array.isArray(valor) ? valor.map(p => p.trim()).filter(Boolean).slice(0, MAX_PREGUNTAS_PROPUESTA) : [])),
})

/**
 * Valida la salida de la herramienta (tolerante con nulos y claves de más, que descarta): lo que no cruce con el
 * contexto lo quita después normalizarPropuesta. Nunca acepta más de 10 visitas.
 */
export const propuestaSchema: z.ZodType<PropuestaCruda, z.ZodTypeDef, unknown> = z.object({
  visitas: z.array(visitaPropuestaSchema).max(MAX_VISITAS_PROPUESTA, `Como máximo ${MAX_VISITAS_PROPUESTA} visitas por dictado`),
  aviso: textoONulo(300),
})

// ---------------------------------------------------------------------------------------------
// Agenda (F4.1, migración 0840) y dictado por campo
// ---------------------------------------------------------------------------------------------

const MENSAJE_HORA = 'Hora no válida: usa HH:MM (de 00:00 a 23:59)'

/**
 * Hora OBLIGATORIA de la cita (decisión del dueño 2026-10-15): ausente, '' o null → MENSAJE_HORA_OBLIGATORIA; lo que no
 * es HH:MM (o HH:MM:SS) → MENSAJE_HORA; queda en HH:MM. La base sigue aceptando NULL (las citas viejas sin hora).
 */
const horaObligatoria = z.unknown().transform((valor, ctx): string => {
  if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_HORA_OBLIGATORIA })
    return z.NEVER
  }
  const hora = horaCorta(valor)
  if (hora === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_HORA })
    return z.NEVER
  }
  return hora
})

/** "Como qué" (0850, C12): ausente, '' o null → null (la base elige: como Ejecutivo Comercial si lo tiene). */
const comoOpcional = z
  .string({ invalid_type_error: MENSAJE_COMO_NO_VALIDO })
  .trim()
  .nullish()
  .transform(valor => (valor ? valor : null))
  .refine((valor): valor is (typeof VALORES_COMO)[number] | null => valor === null || (VALORES_COMO as readonly string[]).includes(valor), {
    message: MENSAJE_COMO_NO_VALIDO,
  })

const fechaCita = z
  .string({ required_error: 'Elige la fecha de la cita', invalid_type_error: MENSAJE_FECHA })
  .trim()
  .refine(valor => esFechaIso(valor), { message: MENSAJE_FECHA })

const camposCita = {
  fecha: fechaCita,
  hora: horaObligatoria,
  tipo: z.enum(VALORES_TIPO_VISITA, { errorMap: () => ({ message: MENSAJE_TIPO }) }),
  medico_id: idOpcional('Médico no válido'),
  cuenta_id: idOpcional('Cuenta no válida'),
  subtipo_id: idOpcional('Subtipo no válido'),
  sede_id: idSchema('Elige la sede'),
  nota: textoOpcional(MAX_NOTA_CITA, 'Nota no válida'),
  como: comoOpcional,
}

type CitaPlana = z.infer<z.ZodObject<typeof camposCita>>

/**
 * POST /api/me/agenda: fecha, HORA (obligatoria desde el 2026-10-15), médica con médico; institucional con cuenta y
 * subtipo (lo que no aplica al tipo queda en null); 0850: `como` opcional ('ejecutivo' | 'lider', C12).
 * Que la fecha sea de hoy en adelante (sin tope, A4), la hora no haya pasado, el perfil, el médico en esa sede (como
 * líder, de sus líneas), la cuenta, el subtipo vigente, los repetidos y el choque de media hora los revisa agenda_crear
 * (la base); la API repite el pasado y la hora pasada (mensajeFechaCita, mensajeHoraCita) para responder sin ir a la base.
 */
export const citaCreateSchema: z.ZodType<CitaCreate, z.ZodTypeDef, unknown> = cuerpo(camposCita)
  .superRefine((datos: CitaPlana, ctx) => {
    const falla = (campo: string, mensaje: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: mensaje })
    if (datos.tipo === 'medica') {
      if (!datos.medico_id) falla('medico_id', 'Elige el médico')
    } else {
      if (!datos.cuenta_id) falla('cuenta_id', 'Elige la cuenta')
      if (!datos.subtipo_id) falla('subtipo_id', 'Elige el subtipo de la visita institucional')
    }
  })
  .transform((datos: CitaPlana): CitaCreate => {
    const base = { fecha: datos.fecha, hora: datos.hora, sede_id: datos.sede_id, nota: datos.nota, como: datos.como }
    return datos.tipo === 'medica'
      ? { ...base, tipo: 'medica', medico_id: datos.medico_id as string, cuenta_id: null, subtipo_id: null }
      : { ...base, tipo: 'institucional', medico_id: null, cuenta_id: datos.cuenta_id as string, subtipo_id: datos.subtipo_id as string }
  })

/** Código de motivo (0850, C10): de la lista; 'salida' solo lo pone el sistema. */
const motivoCodigo = (requerido: boolean) =>
  z
    .string({ invalid_type_error: MENSAJE_MOTIVO_NO_VALIDO, required_error: MENSAJE_MOTIVO_NO_VALIDO })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor : null))
    .superRefine((valor, ctx) => {
      if (valor === null) {
        if (requerido) ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_MOTIVO_NO_VALIDO })
        return
      }
      if (!(VALORES_MOTIVO_CIERRE as readonly string[]).includes(valor)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_MOTIVO_NO_VALIDO })
      else if (valor === 'salida') ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_MOTIVO_SALIDA })
    })

/**
 * POST /api/me/agenda/[id]/cancelar (0850, A8): el motivo es OBLIGATORIO. { motivo_codigo?, motivo? }: sin código y con
 * texto = 'otro' (la app de hoy solo manda el texto); con 'otro', texto de 3 a 300; sin nada → 400
 * MENSAJE_CANCELAR_SIN_MOTIVO. Cuerpo vacío = sin nada.
 */
export const citaCancelarSchema: z.ZodType<CitaCancelar, z.ZodTypeDef, unknown> = cuerpo({
  motivo: textoOpcional(MAX_MOTIVO_CANCELACION_CITA, 'Motivo no válido'),
  motivo_codigo: motivoCodigo(false),
})
  .superRefine((datos, ctx) => {
    if (datos.motivo_codigo === null && datos.motivo === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: MENSAJE_CANCELAR_SIN_MOTIVO })
      return
    }
    const error = revisarMotivo(datos.motivo_codigo, datos.motivo, 'cancelar')
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: error })
  })
  .transform(datos => ({ motivo: datos.motivo, motivo_codigo: (datos.motivo_codigo ?? 'otro') as MotivoElegible }))

/** POST /api/me/agenda/[id]/cerrar ("no se hizo", 0850): { motivo_codigo, motivo? }; con 'otro', texto de 3 a 300. */
export const citaCerrarSchema: z.ZodType<CitaCerrar, z.ZodTypeDef, unknown> = cuerpo({
  motivo_codigo: motivoCodigo(true),
  motivo: textoOpcional(MAX_MOTIVO_CIERRE, 'Motivo no válido'),
})
  .superRefine((datos, ctx) => {
    if (datos.motivo_codigo === null) return
    const error = revisarMotivo(datos.motivo_codigo, datos.motivo, 'cerrar')
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: error })
  })
  .transform(datos => ({ motivo_codigo: datos.motivo_codigo as MotivoElegible, motivo: datos.motivo }))

/**
 * POST /api/me/agenda/[id]/otra-fecha (0850, A7): { fecha, hora (obligatoria), sede_id?, nota?, como? }. Sin nota: la
 * de la anterior (la clave ausente); nota null o '': sin nota.
 */
export const citaOtraFechaSchema: z.ZodType<CitaOtraFecha, z.ZodTypeDef, unknown> = cuerpo({
  fecha: fechaCita,
  hora: horaObligatoria,
  sede_id: idOpcional('Sede no válida'),
  nota: z.unknown().optional(),
  como: comoOpcional,
})
  .superRefine((datos, ctx) => {
    if (datos.nota === undefined || datos.nota === null) return
    if (typeof datos.nota !== 'string') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nota'], message: 'Nota no válida' })
    else if (datos.nota.trim().length > MAX_NOTA_CITA) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nota'], message: `El texto no puede superar ${MAX_NOTA_CITA} caracteres` })
  })
  .transform((datos): CitaOtraFecha => {
    const salida: CitaOtraFecha = { fecha: datos.fecha, hora: datos.hora, sede_id: datos.sede_id, como: datos.como }
    if (datos.nota !== undefined) {
      const texto = typeof datos.nota === 'string' ? datos.nota.trim().replace(/\s+/g, ' ') : ''
      salida.nota = texto ? texto : null
    }
    return salida
  })

/**
 * GET /api/me/agenda?desde=&hasta=&canceladas= (sin fechas: hoy a hoy + 7; sin hasta: desde + 7; como mucho 31 días;
 * canceladas=1 o true las incluye). Los valores por defecto los pone la ruta (necesita la fecha de hoy).
 */
export const agendaQuerySchema = cuerpo({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  canceladas: z
    .string({ invalid_type_error: 'canceladas: usa true o false' })
    .trim()
    .nullish()
    .transform(valor => valor === '1' || valor === 'true'),
}).superRefine((datos, ctx) => {
  if (datos.desde && datos.hasta) {
    if (datos.hasta < datos.desde) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: 'La fecha final no puede ser anterior a la inicial' })
    } else if (diasEntre(datos.desde, datos.hasta) + 1 > MAX_DIAS_CONSULTA_AGENDA) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: `Como mucho ${MAX_DIAS_CONSULTA_AGENDA} días por consulta` })
    }
  }
})

/** POST /api/me/voz/campos: lo dictado para UNA visita (1..8000 caracteres) y su tipo. */
export const camposDictadoSchema: z.ZodType<CamposDictado, z.ZodTypeDef, unknown> = cuerpo({
  transcript: z
    .string({ required_error: MENSAJE_TRANSCRIPT, invalid_type_error: MENSAJE_TRANSCRIPT })
    .transform(valor => valor.trim().replace(/[ \t]+/g, ' '))
    .pipe(z.string().min(1, MENSAJE_TRANSCRIPT).max(MAX_TRANSCRIPT, MENSAJE_TRANSCRIPT)),
  tipo: z.enum(VALORES_TIPO_VISITA, { errorMap: () => ({ message: MENSAJE_TIPO }) }),
})

/** Lo que devuelve Claude por repartir_campos (tolerante con nulos y claves de más; normalizarCampos acota después). */
export const camposSchema: z.ZodType<CamposCrudos, z.ZodTypeDef, unknown> = z.object({
  conclusion: textoONulo(MAX_CONCLUSION),
  compromisos: textoONulo(MAX_COMPROMISOS),
  next_step_date: textoONulo(10),
})
