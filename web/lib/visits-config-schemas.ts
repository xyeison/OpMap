// Fase 7 · F2 Configuración y calendario: validación (allow-list) de los cuerpos y consultas de
// /api/config-visitas/**, /api/calendario/**, /api/dias-libres/** y /api/me/{dias-libres,cuota}.
// zod descarta cualquier clave no listada: nunca se pasa el body entero a insert/update ni a una RPC.
// Mensajes en español, listos para la UI. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
// Pruebas: scripts/visits-check.ts.
//
// Números: se aceptan como número o como texto ("0,5" o "0.5"), porque los formularios mandan texto.
// Opcionales: ausente, '' o null quedan null (o undefined donde se dice).
import { z } from 'zod'
import { VALORES_ROL_CONTACTO } from './terceros'
import {
  MAX_IDS_REVISION,
  MENSAJE_HASTA_ANTES_DE_DESDE,
  MOTIVO_MINIMO,
  VALORES_ACCION_REVISION,
  VALORES_ESTADO_DIA_LIBRE,
  VALORES_MEDIO_TELEFONICA,
  VALORES_MODO_CONTEO,
  VALORES_PARAMETRO_GENERAL,
  VALORES_PERIODO_META,
  VALORES_ROL_APROBADOR,
  VALORES_SCOPE_META,
  VALORES_TABLA_CONFIG,
  VALORES_TIPO_DIA_CALENDARIO,
  VALORES_TIPO_VISITA,
  diasEntre,
  esFechaIso,
  esMesIso,
  redondear2,
  type DiasHabilesSemana,
  type ParametroGeneral,
  type ValorGeneralCambio,
  type ValoresGenerales,
} from './visits-rules'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODIGO_RE = /^[a-z_]{2,40}$/

/** Días como máximo en una consulta del calendario o de días libres. */
export const MAX_DIAS_CONSULTA = 400

// ---------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------

/** Número escrito como texto ("12", "0,5", "0.5") → número; lo demás pasa tal cual. */
function aNumero(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim().replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(texto) ? Number(texto) : valor
}

/** Número finito (acepta texto). */
const numero = (mensaje: string) =>
  z.preprocess(aNumero, z.number({ required_error: mensaje, invalid_type_error: mensaje }).finite(mensaje))

/** Entero entre min y max (acepta texto). */
const entero = (min: number, max: number, mensaje: string) =>
  z.preprocess(
    aNumero,
    z.number({ required_error: mensaje, invalid_type_error: mensaje }).int(mensaje).min(min, mensaje).max(max, mensaje)
  )

/** Entero opcional entre min y max: ausente, '' o null → null. */
const enteroOpcional = (min: number, max: number, mensaje: string) =>
  z
    .preprocess(
      valor => (valor === '' ? null : aNumero(valor)),
      z.number({ invalid_type_error: mensaje }).int(mensaje).min(min, mensaje).max(max, mensaje).nullish()
    )
    .transform(valor => valor ?? null)

/** Número redondeado a 2 decimales (numeric(6,2) y numeric(4,2)) y luego dentro del rango. */
const decimal2 = (mensaje: string, rango: (valor: number) => boolean) =>
  numero(mensaje)
    .transform(redondear2)
    .refine(rango, { message: mensaje })

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

const MENSAJE_FECHA = 'Fecha no válida: usa AAAA-MM-DD'
const MENSAJE_RANGO_CONSULTA = 'La fecha final no puede ser anterior a la inicial'

/** Fecha AAAA-MM-DD que existe en el calendario. */
const fechaSchema = (requerido: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .trim()
    .refine(valor => esFechaIso(valor), { message: MENSAJE_FECHA })

/** Fecha opcional: ausente, '' o null → null. */
const fechaOpcional = z
  .string({ invalid_type_error: MENSAJE_FECHA })
  .trim()
  .nullish()
  .transform(valor => (valor ? valor : null))
  .refine(valor => valor === null || esFechaIso(valor), { message: MENSAJE_FECHA })

/** Texto obligatorio sin espacios de más, con largo mínimo y máximo. */
const textoSchema = (minimo: number, maximo: number, requerido: string, corto: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .transform(valor => valor.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(minimo, corto).max(maximo, `El texto no puede superar ${maximo} caracteres`))

/** Texto libre opcional: ausente, '' o null → null. */
const textoOpcional = (maximo: number, invalido: string) =>
  z
    .string({ invalid_type_error: invalido })
    .trim()
    .max(maximo, `El texto no puede superar ${maximo} caracteres`)
    .nullish()
    .transform(valor => (valor ? valor : null))

const MENSAJE_MOTIVO = `Escribe el motivo (al menos ${MOTIVO_MINIMO} caracteres)`

/** Motivo obligatorio de 5 a 300 caracteres (anular, rechazar). */
const motivoObligatorio = z
  .string({ required_error: MENSAJE_MOTIVO, invalid_type_error: MENSAJE_MOTIVO })
  .transform(valor => valor.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(MOTIVO_MINIMO, MENSAJE_MOTIVO).max(300, 'El motivo no puede superar 300 caracteres'))

/** Motivo opcional de un cambio de configuración (lo exige la base si corrige el pasado). */
const motivoOpcional = textoOpcional(500, 'Motivo no válido')

const MENSAJE_MUNICIPIO = 'Municipio no válido: usa el código DANE de 5 dígitos'

const booleano = (mensaje: string) => z.boolean({ invalid_type_error: mensaje, required_error: mensaje })

/** Lista sin repetidos (conserva el primer orden). */
const sinRepetidos = <T>(lista: T[]): T[] => Array.from(new Set(lista))

const hayCambios = (datos: Record<string, unknown>) => Object.values(datos).some(valor => valor !== undefined)
const SIN_CAMBIOS = { message: 'No hay campos para actualizar' }

const MENSAJE_OBJETO = 'Datos no válidos: se esperaba un objeto JSON'

/** Objeto del cuerpo de la petición (con mensaje en español si no es un objeto JSON). */
const cuerpo = <T extends z.ZodRawShape>(forma: T) =>
  z.object(forma, { required_error: MENSAJE_OBJETO, invalid_type_error: MENSAJE_OBJETO })

/** hasta >= desde (cuando hay hasta). */
function revisarRango(datos: { desde: string; hasta: string | null }, ctx: z.RefinementCtx, campo = 'hasta') {
  if (datos.hasta !== null && datos.hasta < datos.desde) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: MENSAJE_HASTA_ANTES_DE_DESDE })
  }
}

// ---------------------------------------------------------------------------------------------
// Parámetros generales (config_general.valor)
// ---------------------------------------------------------------------------------------------

const MENSAJE_DIA_SEMANA = 'Indica cada día de lunes a domingo con 0, 0,5 o 1'
const fraccionDiaSemana = numero(MENSAJE_DIA_SEMANA).refine(valor => valor === 0 || valor === 0.5 || valor === 1, {
  message: 'Cada día de la semana vale 0, 0,5 o 1',
})

const diasHabilesSemanaSchema = z
  .object(
    {
      '1': fraccionDiaSemana,
      '2': fraccionDiaSemana,
      '3': fraccionDiaSemana,
      '4': fraccionDiaSemana,
      '5': fraccionDiaSemana,
      '6': fraccionDiaSemana,
      '7': fraccionDiaSemana,
    },
    { required_error: MENSAJE_DIA_SEMANA, invalid_type_error: MENSAJE_DIA_SEMANA }
  )
  .strict('Los días de la semana van de "1" (lunes) a "7" (domingo)')
  .refine(dias => Object.values(dias).some(valor => valor > 0), {
    message: 'Al menos un día de la semana debe ser hábil',
  })
  .transform(dias => dias as DiasHabilesSemana)

const MENSAJE_MEDIOS = 'Elige al menos un medio: llamada o videollamada'
const MENSAJE_TELEFONICAS = 'Datos de telefónicas no válidos'

const telefonicasSchema = z.object(
  {
    tope_dia: entero(0, 20, 'El tope de telefónicas al día es un entero entre 0 y 20'),
    peso: decimal2('El peso de una telefónica es un número mayor que 0 y hasta 10', valor => valor > 0 && valor <= 10),
    medios: z
      .array(z.enum(VALORES_MEDIO_TELEFONICA, { errorMap: () => ({ message: 'Medio no válido: llamada o videollamada' }) }), {
        required_error: MENSAJE_MEDIOS,
        invalid_type_error: MENSAJE_MEDIOS,
      })
      .min(1, MENSAJE_MEDIOS)
      .transform(sinRepetidos),
  },
  { required_error: MENSAJE_TELEFONICAS, invalid_type_error: MENSAJE_TELEFONICAS }
)

const MENSAJE_APROBACION = 'Datos de aprobación de días libres no válidos'

const aprobacionSchema = z.object(
  {
    requiere: booleano('Indica si los días libres requieren aprobación (sí o no)'),
    aprueban: z
      .array(
        z.enum(VALORES_ROL_APROBADOR, {
          errorMap: () => ({ message: 'Solo aprueban la dirección comercial o recursos humanos (admin siempre puede)' }),
        }),
        { required_error: 'Indica quién aprueba los días libres', invalid_type_error: 'Indica quién aprueba los días libres' }
      )
      .transform(sinRepetidos),
  },
  { required_error: MENSAJE_APROBACION, invalid_type_error: MENSAJE_APROBACION }
)

const MENSAJE_MOTIVOS = 'La lista de motivos de día libre no es válida'

const motivoDiaLibreSchema = z.object(
  {
    codigo: z
      .string({ required_error: 'Cada motivo necesita un código', invalid_type_error: 'Código de motivo no válido' })
      .trim()
      .regex(CODIGO_RE, 'El código del motivo lleva de 2 a 40 letras minúsculas sin tildes o guiones bajos'),
    nombre: textoSchema(2, 60, 'Cada motivo necesita un nombre', 'El nombre del motivo debe tener al menos 2 letras'),
  },
  { invalid_type_error: 'Motivo no válido' }
)

const motivosDiaLibreSchema = z
  .array(motivoDiaLibreSchema, { required_error: MENSAJE_MOTIVOS, invalid_type_error: MENSAJE_MOTIVOS })
  .min(1, 'Deja al menos un motivo de día libre')
  .max(30, 'Como máximo 30 motivos de día libre')
  .refine(motivos => new Set(motivos.map(motivo => motivo.codigo)).size === motivos.length, {
    message: 'Hay códigos de motivo repetidos',
  })

const MENSAJE_ALERTAS = 'Las alertas de mezcla son un objeto con un umbral (0 a 100) por tipo o subtipo'

const alertasMezclaSchema = z
  .record(
    z.string().trim().min(1, MENSAJE_ALERTAS).max(80, MENSAJE_ALERTAS),
    numero(MENSAJE_ALERTAS).refine(valor => valor >= 0 && valor <= 100, { message: MENSAJE_ALERTAS }),
    { required_error: MENSAJE_ALERTAS, invalid_type_error: MENSAJE_ALERTAS }
  )
  .refine(alertas => Object.keys(alertas).length <= 50, { message: 'Como máximo 50 alertas de mezcla' })

type EsquemasGenerales = { [P in ParametroGeneral]: z.ZodType<ValoresGenerales[P], z.ZodTypeDef, unknown> }

/** Un esquema por parámetro de config_general (la base solo revisa el tipo jsonb mínimo; esto es lo completo). */
export const valorGeneralSchemas: EsquemasGenerales = {
  radio_presencial_m: entero(50, 5000, 'El radio de presencial es un número entero de metros entre 50 y 5000'),
  plazo_gracia_horas: entero(0, 720, 'El plazo de gracia es un número entero de horas entre 0 y 720'),
  dias_habiles_semana: diasHabilesSemanaSchema,
  tope_visitas_medico_dia: entero(1, 10, 'Las visitas que suman por médico al día son un entero entre 1 y 10'),
  telefonicas: telefonicasSchema,
  aprobacion_dias_libres: aprobacionSchema,
  motivos_dia_libre: motivosDiaLibreSchema,
  primer_mes_factor: numero('El factor del primer mes es un número entre 0 y 1').refine(valor => valor >= 0 && valor <= 1, {
    message: 'El factor del primer mes es un número entre 0 y 1',
  }),
  alertas_mezcla: alertasMezclaSchema,
}

// ---------------------------------------------------------------------------------------------
// Cambios de configuración (POST /api/config-visitas/vista-previa y /cambios)
// ---------------------------------------------------------------------------------------------

const MENSAJE_VALORES = 'Faltan los valores del cambio'

const scopeSchema = z.enum(VALORES_SCOPE_META, {
  errorMap: () => ({ message: 'Alcance de la meta no válido: toda la empresa, zona o Ejecutivo Comercial' }),
})
const tipoVisitaSchema = z.enum(VALORES_TIPO_VISITA, {
  errorMap: () => ({ message: 'Tipo de visita no válido: médica o institucional' }),
})
const periodoSchema = z.enum(VALORES_PERIODO_META, {
  errorMap: () => ({ message: 'Periodo no válido: al día o a la semana' }),
})

/** config_metas: general sin zona ni persona; zona solo con kam_id; ejecutiva solo con executive_id. */
export const metaValoresSchema = z
  .object(
    {
      scope: scopeSchema,
      kam_id: idOpcional('Zona no válida'),
      executive_id: idOpcional('Ejecutivo Comercial no válido'),
      tipo: tipoVisitaSchema,
      subtipo_id: idOpcional('Subtipo no válido'),
      periodo: periodoSchema,
      cantidad: decimal2('La meta es un número entre 0 y 100', valor => valor >= 0 && valor <= 100),
    },
    { required_error: MENSAJE_VALORES, invalid_type_error: MENSAJE_VALORES }
  )
  .superRefine((datos, ctx) => {
    const problema = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
    if (datos.scope === 'general') {
      if (datos.kam_id || datos.executive_id) problema('scope', 'Una meta de toda la empresa no lleva zona ni Ejecutivo Comercial')
    } else if (datos.scope === 'zona') {
      if (!datos.kam_id) problema('kam_id', 'Elige la zona de la meta')
      if (datos.executive_id) problema('executive_id', 'Una meta de zona no lleva Ejecutivo Comercial')
    } else {
      if (!datos.executive_id) problema('executive_id', 'Elige el Ejecutivo Comercial de la meta')
      if (datos.kam_id) problema('kam_id', 'Una meta de un Ejecutivo Comercial no lleva zona')
    }
    if (datos.subtipo_id && datos.tipo !== 'institucional') {
      problema('subtipo_id', 'Solo las metas institucionales llevan subtipo')
    }
  })

/** config_conteo: modo y peso de un subtipo. */
export const conteoValoresSchema = z.object(
  {
    subtipo_id: idSchema('Elige el subtipo'),
    modo: z.enum(VALORES_MODO_CONTEO, {
      errorMap: () => ({ message: 'Modo no válido: suma a la institucional, meta propia o solo seguimiento' }),
    }),
    peso: z
      .preprocess(valor => (valor === undefined || valor === null || valor === '' ? 1 : valor), numero('El peso es un número mayor que 0 y hasta 10'))
      .transform(redondear2)
      .refine(valor => valor > 0 && valor <= 10, { message: 'El peso es un número mayor que 0 y hasta 10' }),
  },
  { required_error: MENSAJE_VALORES, invalid_type_error: MENSAJE_VALORES }
)

/** config_general: el parámetro y su valor, validado con el esquema de ese parámetro. */
export const generalValoresSchema = z
  .object(
    {
      parametro: z.enum(VALORES_PARAMETRO_GENERAL, { errorMap: () => ({ message: 'Parámetro general no válido' }) }),
      valor: z.unknown(),
    },
    { required_error: MENSAJE_VALORES, invalid_type_error: MENSAJE_VALORES }
  )
  .transform((datos, ctx): ValorGeneralCambio => {
    const resultado = valorGeneralSchemas[datos.parametro].safeParse(datos.valor)
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valor', ...issue.path], message: issue.message })
      }
      return z.NEVER
    }
    return { parametro: datos.parametro, valor: resultado.data } as ValorGeneralCambio
  })

const MENSAJE_PERFIL = 'Elige al menos un perfil: médica o institucional'

/** config_personas: perfil, telefónica, tope y radio propios (NULL = los generales). */
export const personaValoresSchema = z.object(
  {
    executive_id: idSchema('Elige el Ejecutivo Comercial'),
    perfil: z
      .array(z.enum(VALORES_TIPO_VISITA, { errorMap: () => ({ message: 'Perfil no válido: médica o institucional' }) }), {
        required_error: MENSAJE_PERFIL,
        invalid_type_error: MENSAJE_PERFIL,
      })
      .min(1, MENSAJE_PERFIL)
      .transform(perfil => VALORES_TIPO_VISITA.filter(tipo => perfil.includes(tipo))),
    telefonica_habilitada: booleano('Indica si tiene telefónica habilitada (sí o no)').default(false),
    tope_telefonicas_dia: enteroOpcional(0, 20, 'El tope de telefónicas al día es un entero entre 0 y 20'),
    radio_m: enteroOpcional(50, 5000, 'El radio es un número entero de metros entre 50 y 5000'),
  },
  { required_error: MENSAJE_VALORES, invalid_type_error: MENSAJE_VALORES }
)

const camposCambio = {
  desde: fechaSchema('Escribe desde cuándo rige el valor'),
  hasta: fechaOpcional,
  motivo: motivoOpcional,
}

const MENSAJE_TABLA = 'Elige qué se configura: metas, qué cuenta, general o personas'

/**
 * Cuerpo de vista previa y de cambio: { tabla, valores, desde, hasta?, motivo? }. La API llama a
 * config_registrar con esto (p_tabla = tabla, p_valores = valores). El motivo cuando el cambio corrige el pasado
 * lo exige la base (y planearCambio en la vista previa); aquí solo se limpia.
 */
export const cambioConfigSchema = z
  .discriminatedUnion(
    'tabla',
    [
      cuerpo({ tabla: z.literal('config_metas'), valores: metaValoresSchema, ...camposCambio }),
      cuerpo({ tabla: z.literal('config_conteo'), valores: conteoValoresSchema, ...camposCambio }),
      cuerpo({ tabla: z.literal('config_general'), valores: generalValoresSchema, ...camposCambio }),
      cuerpo({ tabla: z.literal('config_personas'), valores: personaValoresSchema, ...camposCambio }),
    ],
    {
      errorMap: (issue, ctx) => {
        if (issue.code === z.ZodIssueCode.invalid_union_discriminator) return { message: MENSAJE_TABLA }
        if (issue.code === z.ZodIssueCode.invalid_type) return { message: MENSAJE_OBJETO }
        return { message: ctx.defaultError }
      },
    }
  )
  .superRefine((datos, ctx) => revisarRango(datos, ctx))

export type CambioConfig = z.infer<typeof cambioConfigSchema>

const tablaSchema = z.enum(VALORES_TABLA_CONFIG, { errorMap: () => ({ message: MENSAJE_TABLA }) })

/** POST /api/config-visitas/cerrar → config_cerrar. */
export const cerrarConfigSchema = cuerpo({
  tabla: tablaSchema,
  id: idSchema('Elige el valor que se cierra'),
  hasta: fechaSchema('Escribe hasta cuándo rige el valor'),
  motivo: motivoOpcional,
})

export type CerrarConfig = z.infer<typeof cerrarConfigSchema>

// ---------------------------------------------------------------------------------------------
// Subtipos institucionales
// ---------------------------------------------------------------------------------------------

const MENSAJE_CODIGO_SUBTIPO =
  'El código del subtipo lleva de 2 a 40 letras minúsculas sin tildes o guiones bajos (por ejemplo, "programacion")'

const rolesSugeridosSchema = z
  .array(z.enum(VALORES_ROL_CONTACTO, { errorMap: () => ({ message: 'Cargo sugerido no válido: elige uno de la lista' }) }), {
    invalid_type_error: 'Cargos sugeridos no válidos',
  })
  .max(VALORES_ROL_CONTACTO.length, 'Hay cargos sugeridos de más')
  .transform(sinRepetidos)

const nombreSubtipo = textoSchema(2, 60, 'Escribe el nombre del subtipo', 'El nombre del subtipo debe tener al menos 2 letras')
const paraQueSubtipo = textoSchema(2, 300, 'Escribe para qué sirve el subtipo', 'Escribe para qué sirve el subtipo')
const ordenSubtipo = entero(0, 1000, 'El orden es un número entero entre 0 y 1000')

/** POST /api/config-visitas/subtipos (la API crea además su conteo inicial 'seguimiento' peso 1). */
export const subtipoCreateSchema = cuerpo({
  codigo: z
    .string({ required_error: 'Escribe el código del subtipo', invalid_type_error: 'Escribe el código del subtipo' })
    .trim()
    .toLowerCase()
    .regex(CODIGO_RE, MENSAJE_CODIGO_SUBTIPO),
  nombre: nombreSubtipo,
  para_que: paraQueSubtipo,
  roles_sugeridos: rolesSugeridosSchema.default([]),
  orden: ordenSubtipo,
  vigente_desde: fechaSchema('Escribe desde cuándo rige el subtipo'),
})

export type SubtipoCreate = z.infer<typeof subtipoCreateSchema>

/** PATCH /api/config-visitas/subtipos/[id]: el código no cambia; vigente_hasta lo apaga (nunca se borra). */
export const subtipoUpdateSchema = cuerpo({
  nombre: nombreSubtipo.optional(),
  para_que: paraQueSubtipo.optional(),
  roles_sugeridos: rolesSugeridosSchema.optional(),
  orden: ordenSubtipo.optional(),
  vigente_hasta: z
    .string({ invalid_type_error: MENSAJE_FECHA })
    .trim()
    .nullable()
    .optional()
    .transform(valor => (valor === undefined ? undefined : valor ? valor : null))
    .refine(valor => valor === undefined || valor === null || esFechaIso(valor), { message: MENSAJE_FECHA }),
}).refine(hayCambios, SIN_CAMBIOS)

export type SubtipoUpdate = z.infer<typeof subtipoUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------------------------

/** POST /api/calendario: día de empresa o de ciudad (los nacionales los pone el sistema). */
export const calendarioDiaCreateSchema = cuerpo({
  fecha: fechaSchema('Escribe la fecha del día'),
  alcance: z.enum(['empresa', 'ciudad'], {
    errorMap: () => ({ message: 'Alcance no válido: día de empresa o día de ciudad' }),
  }),
  municipality_id: z
    .string({ invalid_type_error: MENSAJE_MUNICIPIO })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor : null))
    .refine(valor => valor === null || /^\d{5}$/.test(valor), { message: MENSAJE_MUNICIPIO }),
  tipo: z.enum(VALORES_TIPO_DIA_CALENDARIO, {
    errorMap: () => ({ message: 'Tipo de día no válido: hábil o no hábil' }),
  }),
  nombre: textoSchema(2, 120, 'Escribe el nombre del día', 'El nombre del día debe tener al menos 2 letras'),
}).superRefine((datos, ctx) => {
  if (datos.alcance === 'ciudad' && !datos.municipality_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['municipality_id'], message: 'Elige la ciudad del día' })
  }
  if (datos.alcance === 'empresa' && datos.municipality_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['municipality_id'], message: 'Un día de empresa no lleva ciudad' })
  }
})

export type CalendarioDiaCreate = z.infer<typeof calendarioDiaCreateSchema>

/** POST /api/calendario/[id]/anular (y cualquier anulación con motivo). */
export const anularSchema = cuerpo({ motivo: motivoObligatorio })

/** POST /api/calendario/festivos */
export const cargarFestivosSchema = cuerpo({
  anio: entero(2020, 2100, 'El año es un número entre 2020 y 2100'),
})

/** GET /api/calendario?desde=&hasta=&municipio= (máximo 400 días). */
export const consultaCalendarioSchema = cuerpo({
  desde: fechaSchema('Indica desde qué fecha'),
  hasta: fechaSchema('Indica hasta qué fecha'),
  municipio: z
    .string({ invalid_type_error: MENSAJE_MUNICIPIO })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor : null))
    .refine(valor => valor === null || /^\d{5}$/.test(valor), { message: MENSAJE_MUNICIPIO }),
}).superRefine((datos, ctx) => {
  if (datos.hasta < datos.desde) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: MENSAJE_RANGO_CONSULTA })
  } else if (diasEntre(datos.desde, datos.hasta) + 1 > MAX_DIAS_CONSULTA) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hasta'],
      message: `Consulta como máximo ${MAX_DIAS_CONSULTA} días`,
    })
  }
})

// ---------------------------------------------------------------------------------------------
// Días libres
// ---------------------------------------------------------------------------------------------

const MENSAJE_FRACCION = 'Elige día completo (1) o medio día (0,5)'

const camposDiaLibre = {
  fecha: fechaSchema('Escribe la fecha del día libre'),
  fraccion: numero(MENSAJE_FRACCION).refine(valor => valor === 1 || valor === 0.5, { message: MENSAJE_FRACCION }),
  motivo: z
    .string({ required_error: 'Elige el motivo del día libre', invalid_type_error: 'Elige el motivo del día libre' })
    .trim()
    .regex(CODIGO_RE, 'Elige el motivo del día libre'),
  nota: textoOpcional(500, 'Nota no válida'),
}

/**
 * POST /api/me/dias-libres. Que el motivo esté en la lista vigente, que el día sea hábil para ella y el plazo
 * de gracia (puedeRegistrarDiaLibre) los revisa la API.
 */
export const diaLibreCreateSchema = cuerpo(camposDiaLibre)

export type DiaLibreCreate = z.infer<typeof diaLibreCreateSchema>

const MENSAJE_JUSTIFICACION = `La justificación debe tener al menos ${MOTIVO_MINIMO} caracteres`

/** POST /api/dias-libres: quien aprueba registra por otra persona (justificación si está fuera de plazo). */
export const diaLibrePorOtraSchema = cuerpo({
  ...camposDiaLibre,
  executive_id: idSchema('Elige el Ejecutivo Comercial'),
  justificacion: textoOpcional(500, 'Justificación no válida').refine(
    valor => valor === null || valor.length >= MOTIVO_MINIMO,
    { message: MENSAJE_JUSTIFICACION }
  ),
})

export type DiaLibrePorOtra = z.infer<typeof diaLibrePorOtraSchema>

const MENSAJE_IDS = 'Selecciona al menos un día libre'

/** POST /api/dias-libres/revisar: aprobar o rechazar en bloque (motivo para rechazar y anular). */
export const revisarDiasLibresSchema = cuerpo({
  ids: z
    .array(idSchema('Día libre no válido'), { required_error: MENSAJE_IDS, invalid_type_error: MENSAJE_IDS })
    .min(1, MENSAJE_IDS)
    .max(MAX_IDS_REVISION, `Como máximo ${MAX_IDS_REVISION} días libres a la vez`)
    .refine(ids => new Set(ids).size === ids.length, { message: 'Hay días libres repetidos en la selección' }),
  accion: z.enum(VALORES_ACCION_REVISION, {
    errorMap: () => ({ message: 'Acción no válida: aprobar, rechazar o anular' }),
  }),
  motivo: textoOpcional(300, 'Motivo no válido'),
}).superRefine((datos, ctx) => {
  if (datos.accion !== 'aprobar' && (datos.motivo ?? '').length < MOTIVO_MINIMO) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: MENSAJE_MOTIVO })
  }
})

export type RevisarDiasLibres = z.infer<typeof revisarDiasLibresSchema>

/** GET /api/dias-libres?desde=&hasta=&estado=&executive_id= (todo opcional; con las dos fechas, máximo 400 días). */
export const consultaDiasLibresSchema = cuerpo({
  desde: fechaOpcional,
  hasta: fechaOpcional,
  estado: z
    .string({ invalid_type_error: 'Estado no válido' })
    .trim()
    .nullish()
    .transform(valor => (valor ? valor : null))
    .refine(valor => valor === null || (VALORES_ESTADO_DIA_LIBRE as readonly string[]).includes(valor), {
      message: 'Estado no válido: registrado, por aprobar, aprobado, rechazado o anulado',
    }),
  executive_id: idOpcional('Ejecutivo Comercial no válido'),
}).superRefine((datos, ctx) => {
  if (datos.desde === null || datos.hasta === null) return
  if (datos.hasta < datos.desde) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: MENSAJE_RANGO_CONSULTA })
  } else if (diasEntre(datos.desde, datos.hasta) + 1 > MAX_DIAS_CONSULTA) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hasta'], message: `Consulta como máximo ${MAX_DIAS_CONSULTA} días` })
  }
})

/** Mes AAAA-MM (?mes= de las cuotas). */
export const mesSchema = z
  .string({ required_error: 'Indica el mes (AAAA-MM)', invalid_type_error: 'Mes no válido: usa AAAA-MM' })
  .trim()
  .refine(valor => esMesIso(valor) && Number(valor.slice(0, 4)) >= 2000, { message: 'Mes no válido: usa AAAA-MM' })
