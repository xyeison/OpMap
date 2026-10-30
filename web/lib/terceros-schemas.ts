// Fase 6 · F1 Terceros: validación (allow-list) de los cuerpos de /api/terceros/**.
// zod descarta cualquier clave no listada (id, origen, created_by, hospital_id, ubicacion_confirmada al
// crear...): nunca se pasa el body entero a insert/update. Mensajes en español, listos para la UI.
// Contrato: docs/fases/fase6-visitas-f1-terceros.md. Pruebas: scripts/terceros-check.ts.
//
// Convención de opcionales: un campo AUSENTE queda undefined (en PATCH: no se toca; en POST: lo pone la
// base por defecto); '' o null quedan null (borrar). Los nombres se guardan sin espacios de más.
import { z } from 'zod'
import {
  VALORES_CLASE_CUENTA,
  VALORES_ESPECIALIDAD,
  VALORES_MODALIDAD_FACTURACION,
  VALORES_ROL_CONTACTO,
  VALORES_ROL_MEDICO_SEDE,
  MENSAJE_CONTACTO_SIN_TELEFONO_NI_CORREO,
  MENSAJE_DOC_MEDICO_CC_CE,
  VALORES_TIPO_DOC_MEDICO_NUEVO,
  VALORES_TIPO_ID_CUENTA,
  errorModalidad,
  leerPagina,
  normalizarIdentificacion,
  rolDesdeCargo,
  validarIdentificacion,
  validarIdentificacionCuenta,
  type ClaseCuenta,
} from './terceros'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Límites de las coordenadas (los mismos del CHECK de sedes): Colombia con San Andrés y Providencia. */
export const LIMITES_COLOMBIA = { latMin: -5, latMax: 14, lngMin: -82, lngMax: -66 } as const

// ---------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------

const idSchema = (mensaje: string) =>
  z
    .string({ required_error: mensaje, invalid_type_error: mensaje })
    .trim()
    .regex(UUID_RE, mensaje)
    .transform(id => id.toLowerCase())

/** Texto obligatorio con largo mínimo; colapsa espacios internos. */
const nombreSchema = (minimo: number, requerido: string, corto: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .transform(valor => valor.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(minimo, corto).max(200, 'El nombre no puede superar 200 caracteres'))

/** Texto libre opcional: ausente → undefined; '' o null → null. */
const textoOpcional = (max: number, invalido = 'Texto no válido') =>
  z
    .string({ invalid_type_error: invalido })
    .trim()
    .max(max, `El texto no puede superar ${max} caracteres`)
    .nullish()
    .transform(valor => (valor === undefined ? undefined : valor ? valor : null))

/** Código DANE de municipio (5 dígitos). */
const municipioSchema = (requerido: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .trim()
    .regex(/^\d{5}$/, 'Municipio no válido: usa el código DANE de 5 dígitos')

const municipioOpcional = z
  .string({ invalid_type_error: 'Municipio no válido: usa el código DANE de 5 dígitos' })
  .trim()
  .nullish()
  .transform(valor => (valor === undefined ? undefined : valor ? valor : null))
  .refine(valor => valor === undefined || valor === null || /^\d{5}$/.test(valor), {
    message: 'Municipio no válido: usa el código DANE de 5 dígitos',
  })

// Email opcional: '' o null → null; en minúsculas.
const emailSchema = z
  .union([z.string().trim().email('Correo no válido').max(320, 'Correo demasiado largo'), z.literal(''), z.null()], {
    errorMap: () => ({ message: 'Correo no válido' }),
  })
  .optional()
  .transform(valor => (valor === undefined ? undefined : valor ? valor.toLowerCase() : null))

// Teléfono opcional: al menos 7 dígitos; se guarda como se escribió (sin espacios de más).
const telefonoSchema = z
  .string({ invalid_type_error: 'Teléfono no válido' })
  .nullish()
  .transform(valor => (valor === undefined ? undefined : valor ? valor.trim().replace(/\s+/g, ' ') : null))
  .refine(valor => !valor || (valor.length <= 60 && (valor.match(/\d/g) ?? []).length >= 7), {
    message: 'Teléfono no válido: debe tener al menos 7 dígitos',
  })
  .transform(valor => (valor === '' ? null : valor))

/** Código de habilitación de la sede en el REPS: 12 dígitos (se quitan espacios y guiones). */
const repsCodeSchema = z
  .string({ invalid_type_error: 'Código de habilitación no válido' })
  .nullish()
  .transform(valor => (valor === undefined ? undefined : valor ? valor.replace(/[\s-]+/g, '') : null))
  .refine(valor => !valor || /^\d{12}$/.test(valor), {
    message: 'El código de habilitación del REPS tiene 12 dígitos',
  })
  .transform(valor => (valor === '' ? null : valor))

/** Código de prestador del REPS: 10 dígitos. */
const codigoPrestadorSchema = z
  .string({ invalid_type_error: 'Código de prestador no válido' })
  .nullish()
  .transform(valor => (valor === undefined ? undefined : valor ? valor.replace(/[\s-]+/g, '') : null))
  .refine(valor => !valor || /^\d{10}$/.test(valor), { message: 'El código de prestador del REPS tiene 10 dígitos' })
  .transform(valor => (valor === '' ? null : valor))

const coordenada = (mensaje: string) =>
  z
    .number({ invalid_type_error: mensaje })
    .finite(mensaje)
    .nullish()
    .transform(valor => (valor === undefined || valor === null ? valor : Math.round(valor * 1e6) / 1e6))

/** Número de identificación tal como se escribe (texto o número); se valida con el tipo más abajo. */
const numeroIdSchema = (requerido: string, invalido = requerido) =>
  z.preprocess(
    valor => (typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor),
    z.string({ required_error: requerido, invalid_type_error: invalido })
  )

const claseSchema = z.enum(VALORES_CLASE_CUENTA, {
  errorMap: () => ({ message: 'Clase no válida: clínica, consultorio, EPS, operador logístico u otra' }),
})
const tipoIdCuentaSchema = z.enum(VALORES_TIPO_ID_CUENTA, {
  errorMap: () => ({ message: 'Elige el tipo de identificación: NIT, CC, CE, PA u otro' }),
})
// Crear, corregir y verificar: solo CC o CE (dueño, 2026-10-30). Sin tipo: "Elige el tipo de documento del médico".
const tipoDocMedicoSchema = z.enum(VALORES_TIPO_DOC_MEDICO_NUEVO, {
  errorMap: (issue, ctx) => ({
    message: issue.code === 'invalid_enum_value' ? MENSAJE_DOC_MEDICO_CC_CE : ctx.defaultError && 'Elige el tipo de documento del médico',
  }),
})
const modalidadSchema = z
  .enum(VALORES_MODALIDAD_FACTURACION, {
    errorMap: () => ({ message: 'Modalidad no válida: directa o a través de la clínica' }),
  })
  .nullish()
const rolContactoSchema = z.enum(VALORES_ROL_CONTACTO, { errorMap: () => ({ message: 'Rol de contacto no válido' }) })
const booleano = (mensaje: string) => z.boolean({ invalid_type_error: mensaje, required_error: mensaje })

/** Fecha YYYY-MM-DD que existe en el calendario. */
const fechaSchema = (requerido: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .trim()
    .refine(esFechaValida, { message: 'Fecha no válida: usa AAAA-MM-DD' })

export function esFechaValida(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!partes) return false
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])]
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

type Coordenadas = { lat?: number | null; lng?: number | null }

/** Latitud y longitud van juntas (las dos o ninguna) y dentro de Colombia. */
function revisarCoordenadas(datos: Coordenadas, ctx: z.RefinementCtx) {
  const tieneLat = datos.lat !== undefined && datos.lat !== null
  const tieneLng = datos.lng !== undefined && datos.lng !== null
  if (datos.lat === undefined && datos.lng === undefined) return
  if (tieneLat !== tieneLng || (datos.lat === undefined) !== (datos.lng === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lat'], message: 'Envía latitud y longitud juntas (o ninguna)' })
    return
  }
  if (!tieneLat) return
  const { latMin, latMax, lngMin, lngMax } = LIMITES_COLOMBIA
  if ((datos.lat as number) < latMin || (datos.lat as number) > latMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lat'], message: 'La latitud está fuera de Colombia' })
  }
  if ((datos.lng as number) < lngMin || (datos.lng as number) > lngMax) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lng'], message: 'La longitud está fuera de Colombia' })
  }
}

function revisarIdentificacion(
  tipo: string,
  numero: string,
  campo: string,
  ctx: z.RefinementCtx,
  validar: typeof validarIdentificacion = validarIdentificacion
): void {
  const resultado = validar(tipo, numero)
  if (!resultado.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [campo], message: resultado.error })
}

const hayCambios = (datos: Record<string, unknown>) => Object.values(datos).some(valor => valor !== undefined)
const SIN_CAMBIOS = { message: 'No hay campos para actualizar' }

/** Objeto del cuerpo de la petición (con mensaje en español si no es un objeto JSON). */
const cuerpo = <T extends z.ZodRawShape>(forma: T) =>
  z.object(forma, {
    required_error: 'Datos no válidos: se esperaba un objeto JSON',
    invalid_type_error: 'Datos no válidos: se esperaba un objeto JSON',
  })

// ---------------------------------------------------------------------------------------------
// Sedes
// ---------------------------------------------------------------------------------------------

const nombreSedeSchema = nombreSchema(2, 'Escribe el nombre de la sede', 'El nombre de la sede debe tener al menos 2 letras')

const sedeCampos = {
  reps_code: repsCodeSchema,
  direccion: textoOpcional(300, 'Dirección no válida'),
  ciudad: textoOpcional(120, 'Ciudad no válida'),
  lat: coordenada('Latitud no válida'),
  lng: coordenada('Longitud no válida'),
}

/** Sede principal dentro de POST /api/terceros/cuentas. Sin nombre → el de la cuenta. */
const sedePrincipalSchema = z
  .object(
    {
      nombre: nombreSchema(2, 'Escribe el nombre de la sede', 'El nombre de la sede debe tener al menos 2 letras').optional(),
      municipality_id: municipioSchema('Elige el municipio de la sede principal'),
      ...sedeCampos,
    },
    { required_error: 'Falta la sede principal de la cuenta', invalid_type_error: 'Sede principal no válida' }
  )
  .superRefine(revisarCoordenadas)

/** Origen de una sede que el cuerpo puede pedir: solo la app de visita con el GPS del sitio (lo demás es 'manual'). */
export const ORIGEN_SEDE_APP = 'gps_app' as const

const MENSAJE_PRECISION_GPS = 'Precisión del GPS no válida (metros, 0 a 100000)'

/**
 * POST /api/terceros/sedes. Sin origen (o con cualquier otro valor, que se descarta como antes): 'manual'. Con
 * origen 'gps_app' (app de visita, decisión 14 de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md) la
 * ubicación del teléfono (lat y lng) es obligatoria y gps_accuracy_m es la precisión que reporta el GPS.
 * ubicacion_confirmada la decide la API (nunca el cuerpo): false, salvo una sede 'gps_app' cuyo código de
 * habilitación cruce con el municipio en el REPS. La salida solo trae `origen` cuando es 'gps_app'.
 */
export const sedeCreateSchema = cuerpo({
    cuenta_id: idSchema('Elige la cuenta de la sede'),
    nombre: nombreSedeSchema,
    municipality_id: municipioSchema('Elige el municipio de la sede'),
    ...sedeCampos,
    origen: z
      .unknown()
      .optional()
      .transform(valor => (valor === ORIGEN_SEDE_APP ? ORIGEN_SEDE_APP : undefined)),
    gps_accuracy_m: z
      .number({ invalid_type_error: MENSAJE_PRECISION_GPS })
      .finite(MENSAJE_PRECISION_GPS)
      .min(0, MENSAJE_PRECISION_GPS)
      .max(100000, MENSAJE_PRECISION_GPS)
      .nullish()
      .transform(valor => (valor === undefined || valor === null ? null : Math.round(valor))),
  })
  .superRefine((datos, ctx) => {
    revisarCoordenadas(datos, ctx)
    if (datos.origen === 'gps_app' && (datos.lat === undefined || datos.lat === null || datos.lng === undefined || datos.lng === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lat'],
        message: 'Para crear la sede desde la app hace falta la ubicación del teléfono (latitud y longitud)',
      })
    }
  })
  .transform((datos): Omit<typeof datos, 'origen'> & { origen?: typeof ORIGEN_SEDE_APP } => {
    const { origen, ...resto } = datos
    return origen ? { ...resto, origen } : resto
  })

export type SedeCreate = z.infer<typeof sedeCreateSchema>

/** PATCH /api/terceros/sedes/[id] (terceros:manage). es_principal solo admite true: cambia la principal. */
export const sedeUpdateSchema = cuerpo({
    nombre: nombreSedeSchema.optional(),
    municipality_id: municipioSchema('Elige el municipio de la sede').optional(),
    ...sedeCampos,
    ubicacion_confirmada: booleano('ubicacion_confirmada debe ser verdadero o falso').optional(),
    es_principal: z
      .literal(true, { errorMap: () => ({ message: 'Para cambiar la sede principal, marca otra sede como principal' }) })
      .optional(),
    activo: booleano('activo debe ser verdadero o falso').optional(),
  })
  .superRefine(revisarCoordenadas)
  .refine(hayCambios, SIN_CAMBIOS)

export type SedeUpdate = z.infer<typeof sedeUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------------------------

const nombreCuentaSchema = nombreSchema(2, 'Escribe el nombre de la cuenta', 'El nombre de la cuenta debe tener al menos 2 letras')

/**
 * POST /api/terceros/cuentas: la cuenta con su sede principal. numero_identificacion sale normalizado
 * (NIT a 9 dígitos sin DV). Un tipo que no es NIT no admite un DV tras guion y "otro" no admite forma de NIT
 * (validarIdentificacionCuenta); el choque con una cuenta NIT que ya existe lo mira la API. es_cliente y
 * modalidad_facturacion los marca solo terceros:manage: la API los ignora o rechaza para quien solo tiene
 * terceros:create.
 */
export const cuentaCreateSchema = cuerpo({
    nombre: nombreCuentaSchema,
    clase: claseSchema,
    es_cliente: booleano('es_cliente debe ser verdadero o falso').optional(),
    tipo_identificacion: tipoIdCuentaSchema,
    numero_identificacion: numeroIdSchema('Escribe el número de identificación de la cuenta'),
    codigo_prestador: codigoPrestadorSchema,
    modalidad_facturacion: modalidadSchema,
    notas: textoOpcional(2000, 'Notas no válidas'),
    sede: sedePrincipalSchema,
  })
  .superRefine((datos, ctx) => {
    revisarIdentificacion(
      datos.tipo_identificacion,
      datos.numero_identificacion,
      'numero_identificacion',
      ctx,
      validarIdentificacionCuenta
    )
    const error = errorModalidad(datos.clase, datos.modalidad_facturacion)
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['modalidad_facturacion'], message: error })
  })
  .transform(datos => ({
    ...datos,
    numero_identificacion: normalizarIdentificacion(datos.tipo_identificacion, datos.numero_identificacion) as string,
    sede: { ...datos.sede, nombre: datos.sede.nombre ?? datos.nombre },
  }))

export type CuentaCreate = z.infer<typeof cuentaCreateSchema>

/**
 * PATCH /api/terceros/cuentas/[id] (terceros:manage). La identificación no se edita. Si la clase pasa a
 * algo que no es EPS y no viene modalidad, sale modalidad_facturacion = null (el CHECK de la base lo exige).
 * Si viene modalidad sin clase, la API la comprueba contra la clase guardada con errorModalidad().
 */
export const cuentaUpdateSchema = cuerpo({
    nombre: nombreCuentaSchema.optional(),
    clase: claseSchema.optional(),
    es_cliente: booleano('es_cliente debe ser verdadero o falso').optional(),
    codigo_prestador: codigoPrestadorSchema,
    modalidad_facturacion: modalidadSchema,
    notas: textoOpcional(2000, 'Notas no válidas'),
    activo: booleano('activo debe ser verdadero o falso').optional(),
  })
  .refine(hayCambios, SIN_CAMBIOS)
  .superRefine((datos, ctx) => {
    if (datos.clase === undefined) return
    const error = errorModalidad(datos.clase, datos.modalidad_facturacion)
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['modalidad_facturacion'], message: error })
  })
  .transform(datos =>
    datos.clase !== undefined && datos.clase !== 'eps' && datos.modalidad_facturacion === undefined
      ? { ...datos, modalidad_facturacion: null }
      : datos
  )

export type CuentaUpdate = z.infer<typeof cuentaUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Médicos
// ---------------------------------------------------------------------------------------------

const nombreMedicoSchema = nombreSchema(3, 'Escribe el nombre del médico', 'El nombre del médico debe tener al menos 3 letras')

const especialidadesSchema = z
  .array(z.enum(VALORES_ESPECIALIDAD, { errorMap: () => ({ message: 'Especialidad no válida: elige una de la lista' }) }), {
    required_error: 'Elige al menos una especialidad',
    invalid_type_error: 'Elige al menos una especialidad',
  })
  .min(1, 'Elige al menos una especialidad')
  .max(VALORES_ESPECIALIDAD.length, 'Hay especialidades de más')
  .transform(lista => Array.from(new Set(lista)))

const medicoSedeSchema = z.object(
  {
    sede_id: idSchema('Sede no válida'),
    rol: z.enum(VALORES_ROL_MEDICO_SEDE, {
      errorMap: () => ({ message: 'El rol en la sede debe ser consultorio o atiende' }),
    }),
    principal: booleano('principal debe ser verdadero o falso').optional(),
  },
  { invalid_type_error: 'Sede no válida' }
)

export type MedicoSedeInput = z.infer<typeof medicoSedeSchema>

const sedesMedicoSchema = z
  .array(medicoSedeSchema, {
    required_error: 'Elige al menos una sede donde atiende el médico',
    invalid_type_error: 'Elige al menos una sede donde atiende el médico',
  })
  .min(1, 'Elige al menos una sede donde atiende el médico')
  .max(30, 'Demasiadas sedes')
  .refine(sedes => new Set(sedes.map(sede => sede.sede_id)).size === sedes.length, {
    message: 'Hay sedes repetidas en la lista',
  })
  .refine(sedes => sedes.filter(sede => sede.principal).length <= 1, {
    message: 'Solo una sede puede ser la principal del médico',
  })

/**
 * POST /api/terceros/medicos: médico completo o no se crea (tipo y número de documento, nombre >= 3,
 * especialidades >= 1 de la lista, municipio y sedes >= 1 sin repetir). numero_documento sale normalizado.
 * La API llama a terceros_crear_medico(p_medico, p_sedes, p_user) con esto.
 */
export const medicoCreateSchema = cuerpo({
    tipo_documento: tipoDocMedicoSchema,
    numero_documento: numeroIdSchema('Escribe el número de documento del médico'),
    nombre: nombreMedicoSchema,
    especialidades: especialidadesSchema,
    municipality_id: municipioSchema('Elige el municipio del médico'),
    telefono: telefonoSchema,
    email: emailSchema,
    notas: textoOpcional(2000, 'Notas no válidas'),
    sedes: sedesMedicoSchema,
  })
  .superRefine((datos, ctx) => revisarIdentificacion(datos.tipo_documento, datos.numero_documento, 'numero_documento', ctx))
  .transform(datos => ({
    ...datos,
    numero_documento: normalizarIdentificacion(datos.tipo_documento, datos.numero_documento) as string,
  }))

export type MedicoCreate = z.infer<typeof medicoCreateSchema>

/**
 * PATCH /api/terceros/medicos/[id] (terceros:manage). El documento se puede corregir (tipo y número juntos)
 * pero no quitar. Las sedes se cambian por /medicos/[id]/sedes.
 */
export const medicoUpdateSchema = cuerpo({
    tipo_documento: tipoDocMedicoSchema.optional(),
    numero_documento: numeroIdSchema(
      'Escribe el número de documento del médico',
      'El documento del médico no se puede quitar'
    ).optional(),
    nombre: nombreMedicoSchema.optional(),
    especialidades: especialidadesSchema.optional(),
    municipality_id: municipioSchema('Elige el municipio del médico').optional(),
    telefono: telefonoSchema,
    email: emailSchema,
    notas: textoOpcional(2000, 'Notas no válidas'),
    activo: booleano('activo debe ser verdadero o falso').optional(),
  })
  .refine(hayCambios, SIN_CAMBIOS)
  .superRefine((datos, ctx) => {
    if (datos.tipo_documento === undefined && datos.numero_documento === undefined) return
    if (datos.tipo_documento === undefined || datos.numero_documento === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['numero_documento'],
        message: 'Para corregir el documento envía el tipo y el número juntos',
      })
      return
    }
    revisarIdentificacion(datos.tipo_documento, datos.numero_documento, 'numero_documento', ctx)
  })
  .transform(datos =>
    datos.tipo_documento !== undefined && datos.numero_documento !== undefined
      ? { ...datos, numero_documento: normalizarIdentificacion(datos.tipo_documento, datos.numero_documento) as string }
      : datos
  )

export type MedicoUpdate = z.infer<typeof medicoUpdateSchema>

/** POST /api/terceros/medicos/verificar: documento (obligatorio) y nombre (opcional, para parecidos). */
export const medicoVerificarSchema = cuerpo({
    tipo_documento: tipoDocMedicoSchema,
    numero_documento: numeroIdSchema('Escribe el número de documento del médico'),
    nombre: z
      .string({ invalid_type_error: 'Nombre no válido' })
      .nullish()
      .transform(valor => (valor ? valor.trim().replace(/\s+/g, ' ') : null)),
    municipality_id: municipioOpcional,
  })
  .superRefine((datos, ctx) => revisarIdentificacion(datos.tipo_documento, datos.numero_documento, 'numero_documento', ctx))
  .transform(datos => ({
    ...datos,
    numero_documento: normalizarIdentificacion(datos.tipo_documento, datos.numero_documento) as string,
  }))

export type MedicoVerificar = z.infer<typeof medicoVerificarSchema>

/** POST /api/terceros/medicos/[id]/sedes: vincula una sede más. */
export const medicoSedeCreateSchema = medicoSedeSchema

// ---------------------------------------------------------------------------------------------
// Visitantes
// ---------------------------------------------------------------------------------------------

/** POST /api/terceros/medicos/[id]/visitantes (visitantes:manage). Ciudad opcional. */
export const visitanteCreateSchema = cuerpo({
  executive_id: idSchema('Elige el Ejecutivo Comercial'),
  line_id: idSchema('Elige la línea'),
  municipality_id: municipioOpcional,
})

export type VisitanteCreate = z.infer<typeof visitanteCreateSchema>

/** PATCH /api/terceros/medicos/[id]/visitantes/[visitanteId]: { hasta } termina la asignación. */
export const visitanteUpdateSchema = cuerpo({
  hasta: fechaSchema('Escribe la fecha en que termina la asignación'),
})

export type VisitanteUpdate = z.infer<typeof visitanteUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Contactos
// ---------------------------------------------------------------------------------------------

const nombreContactoSchema = nombreSchema(2, 'Escribe el nombre del contacto', 'El nombre del contacto debe tener al menos 2 letras')

const sedeOpcional = z
  .string({ invalid_type_error: 'Sede no válida' })
  .trim()
  .nullish()
  .transform(valor => (valor === undefined ? undefined : valor ? valor.toLowerCase() : null))
  .refine(valor => !valor || UUID_RE.test(valor), { message: 'Sede no válida' })

/** POST /api/terceros/contactos: sin rol → el que sugiere el cargo (rolDesdeCargo). */
export const contactoCreateSchema = cuerpo({
    cuenta_id: idSchema('Elige la cuenta del contacto'),
    sede_id: sedeOpcional,
    nombre: nombreContactoSchema,
    cargo_texto: textoOpcional(200, 'Cargo no válido'),
    rol: rolContactoSchema.nullish(),
    telefono: telefonoSchema,
    email: emailSchema,
  })
  // Sin duplicados (dueño, 2026-10-30): teléfono y/o correo; la API ofrece el que ya está en la cuenta (409)
  .refine(datos => Boolean(datos.telefono) || Boolean(datos.email), { message: MENSAJE_CONTACTO_SIN_TELEFONO_NI_CORREO, path: ['telefono'] })
  .transform(datos => ({ ...datos, rol: datos.rol ?? rolDesdeCargo(datos.cargo_texto) }))

export type ContactoCreate = z.infer<typeof contactoCreateSchema>

/** PATCH /api/terceros/contactos/[id] (terceros:manage). Cambiar el cargo no cambia el rol guardado. */
export const contactoUpdateSchema = cuerpo({
    sede_id: sedeOpcional,
    nombre: nombreContactoSchema.optional(),
    cargo_texto: textoOpcional(200, 'Cargo no válido'),
    rol: rolContactoSchema.optional(),
    telefono: telefonoSchema,
    email: emailSchema,
    activo: booleano('activo debe ser verdadero o falso').optional(),
  })
  .refine(hayCambios, SIN_CAMBIOS)

export type ContactoUpdate = z.infer<typeof contactoUpdateSchema>

// ---------------------------------------------------------------------------------------------
// Búsquedas de las listas de /terceros
// ---------------------------------------------------------------------------------------------
// Los mismos filtros llegan por GET (?q=&...: Object.fromEntries de la URL, todo texto) o por POST .../buscar (el
// cuerpo JSON, con booleanos y números). La interfaz usa POST: lo que se escribe en el buscador (un nombre o un
// documento) no queda en la URL ni en los logs de peticiones. Un documento de persona solo se busca por POST.

const MENSAJE_MUNICIPIO_FILTRO = 'Municipio no válido: usa el código DANE de 5 dígitos'

/** Texto del buscador: sin espacios de más, máx. 100 caracteres; '' si no viene. */
const textoBusquedaSchema = z
  .union([z.string(), z.number()], { errorMap: () => ({ message: 'Búsqueda no válida' }) })
  .nullish()
  .transform(valor => (valor === null || valor === undefined ? '' : String(valor).trim().replace(/\s+/g, ' ').slice(0, 100)))

/** Filtro sí/no: true/false o 'true', '1', 'si', 'sí' / 'false', '0', 'no'. Ausente o '' → undefined. */
const filtroBooleano = (campo: string) => {
  const mensaje = `El filtro ${campo} debe ser true o false`
  return z
    .union([z.boolean(), z.string()], { errorMap: () => ({ message: mensaje }) })
    .nullish()
    .transform((valor, ctx): boolean | undefined => {
      if (valor === null || valor === undefined) return undefined
      if (typeof valor === 'boolean') return valor
      const texto = valor.trim().toLowerCase()
      if (!texto) return undefined
      if (['true', '1', 'si', 'sí'].includes(texto)) return true
      if (['false', '0', 'no'].includes(texto)) return false
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: mensaje })
      return z.NEVER
    })
}

/** Código DANE del filtro "Ciudad" (5 dígitos, como texto: '05001' no es un número). Ausente o '' → undefined. */
const filtroMunicipio = z
  .string({ invalid_type_error: MENSAJE_MUNICIPIO_FILTRO })
  .nullish()
  .transform(valor => (valor ? valor.trim() : '') || undefined)
  .refine(valor => valor === undefined || /^\d{5}$/.test(valor), { message: MENSAJE_MUNICIPIO_FILTRO })

/** Página (1 si falta o no es un entero positivo; tope 10.000), como leerPagina. */
const filtroPagina = z
  .union([z.number(), z.string()], { errorMap: () => ({ message: 'Página no válida' }) })
  .nullish()
  .transform(valor => leerPagina(valor === null || valor === undefined ? null : String(valor)))

/** GET /api/terceros/cuentas?… y POST /api/terceros/cuentas/buscar { q, clase, cliente, municipio, activo, page }. */
export const busquedaCuentasSchema = cuerpo({
  q: textoBusquedaSchema,
  clase: z
    .string({ invalid_type_error: 'Clase de cuenta no válida' })
    .nullish()
    .transform(valor => (valor ? valor.trim() : '') || undefined)
    .refine(valor => valor === undefined || (VALORES_CLASE_CUENTA as readonly string[]).includes(valor), {
      message: 'Clase de cuenta no válida',
    })
    .transform(valor => valor as ClaseCuenta | undefined),
  cliente: filtroBooleano('cliente'),
  municipio: filtroMunicipio,
  activo: filtroBooleano('activo'),
  page: filtroPagina,
})

export type BusquedaCuentas = z.infer<typeof busquedaCuentasSchema>

/** GET /api/terceros/medicos?… y POST /api/terceros/medicos/buscar { q, municipio, visitante, activo, page }. */
export const busquedaMedicosSchema = cuerpo({
  q: textoBusquedaSchema,
  municipio: filtroMunicipio,
  visitante: z
    .string({ invalid_type_error: 'El filtro visitante solo admite "me"' })
    .nullish()
    .transform(valor => (valor ? valor.trim() : '') || undefined)
    .refine(valor => valor === undefined || valor === 'me', { message: 'El filtro visitante solo admite "me"' })
    .transform(valor => valor as 'me' | undefined),
  activo: filtroBooleano('activo'),
  page: filtroPagina,
})

export type BusquedaMedicos = z.infer<typeof busquedaMedicosSchema>
