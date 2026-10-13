// Traspaso de un Ejecutivo Comercial: validación (allow-list) de los cuerpos de
// POST /api/executives/[id]/traspaso, POST /api/executives/[id]/traspaso/vista-previa y
// POST /api/executives/[id]/contratar. zod descarta cualquier clave no listada (origen_id, status, user_id,
// created_by...): quien entrega sale de la ruta, nunca del cuerpo. Mensajes en español, listos para la UI.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. Pruebas: scripts/traspaso-check.ts.
//
// Lo que necesita las filas de la base (que la persona lleve esas líneas, que la fecha esté entre hoy − 90 y hoy,
// que el email esté libre...) lo revisan planearTraspaso (lib/traspaso.ts) y ejecutivas_traspasar (0820).
import { z } from 'zod'
import {
  MENSAJE_BAJA_SIN_DESTINO,
  MENSAJE_USUARIO_SIN_BAJA,
  MOTIVO_MAX,
  NOMBRE_MAX,
  NOMBRE_MIN,
  type ContratarInput,
  type TraspasoInput,
} from './traspaso'
import { esFechaIso } from './visits-rules'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Máximo de líneas en un traspaso (lo mismo que acepta el formulario de Ejecutivos Comerciales). */
export const MAX_LINEAS_TRASPASO = 20

const MENSAJE_OBJETO = 'Datos no válidos: se esperaba un objeto JSON'
const MENSAJE_DESTINO = 'Elige quién recibe: otra persona, una persona nueva, una vacante o nadie'

// ---------------------------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------------------------

const idSchema = (mensaje: string) =>
  z
    .string({ required_error: mensaje, invalid_type_error: mensaje })
    .trim()
    .regex(UUID_RE, mensaje)
    .transform(id => id.toLowerCase())

/** Nombre de una persona: sin espacios de más, de NOMBRE_MIN a NOMBRE_MAX caracteres. */
const nombrePersonaSchema = (requerido: string) =>
  z
    .string({ required_error: requerido, invalid_type_error: requerido })
    .transform(valor => valor.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(NOMBRE_MIN, `El nombre debe tener al menos ${NOMBRE_MIN} letras`)
        .max(NOMBRE_MAX, `El nombre no puede superar ${NOMBRE_MAX} caracteres`)
    )

/** Largo máximo de un email: el mismo que acepta ejecutivas_traspasar (0820), para que la vista previa no deje pasar
 * lo que la función rechazaría. */
export const EMAIL_MAX = 254

/** Email opcional: ausente, '' o null → null; en minúsculas (único en executives). */
const emailOpcional = z
  .union([z.string().trim().email('Email no válido').max(EMAIL_MAX, 'Email demasiado largo'), z.literal(''), z.null()], {
    errorMap: () => ({ message: 'Email no válido' }),
  })
  .optional()
  .transform(valor => (valor ? valor.toLowerCase() : null))

/** Fecha AAAA-MM-DD que existe en el calendario; ausente, '' o null → null (la ruta pone hoy). */
const fechaOpcional = (invalido: string) =>
  z
    .union([z.string({ invalid_type_error: invalido }).trim(), z.null()], { errorMap: () => ({ message: invalido }) })
    .optional()
    .transform(valor => (valor ? valor : null))
    .refine(valor => valor === null || esFechaIso(valor), { message: invalido })

const booleanoOpcional = (mensaje: string) => z.boolean({ invalid_type_error: mensaje }).optional()

/** Texto libre opcional: ausente, '' o solo espacios → null. */
const textoOpcional = (max: number, invalido: string) =>
  z
    .string({ invalid_type_error: invalido })
    .trim()
    .max(max, `El motivo no puede superar ${max} caracteres`)
    .nullish()
    .transform(valor => (valor ? valor : null))

// ---------------------------------------------------------------------------------------------
// Traspaso
// ---------------------------------------------------------------------------------------------

/** Quién recibe: otra persona que ya existe, una persona nueva, una vacante nueva o nadie. */
export const destinoSchema = z.discriminatedUnion(
  'tipo',
  [
    z.object({ tipo: z.literal('existente'), id: idSchema('Elige la persona que recibe') }),
    z.object({
      tipo: z.literal('nueva'),
      full_name: nombrePersonaSchema('Escribe el nombre de la persona nueva'),
      email: emailOpcional,
    }),
    z.object({ tipo: z.literal('vacante') }),
    z.object({ tipo: z.literal('nadie') }),
  ],
  {
    errorMap: (issue, ctx) =>
      issue.code === 'invalid_union_discriminator' || issue.code === 'invalid_type'
        ? { message: MENSAJE_DESTINO }
        : { message: ctx.defaultError },
  }
)

/** null o ausente = todas las líneas de quien entrega; si no, una lista no vacía y sin repetir. */
const lineasSchema = z
  .array(idSchema('Línea no válida'), { invalid_type_error: 'Las líneas deben ser una lista (o nada para todas)' })
  .min(1, 'Elige al menos una línea')
  .max(MAX_LINEAS_TRASPASO, 'Demasiadas líneas')
  .refine(ids => new Set(ids).size === ids.length, { message: 'Hay líneas repetidas en la lista' })
  .nullish()
  .transform(ids => ids ?? null)

/**
 * POST /api/executives/[id]/traspaso y su vista previa. Por defecto: sin baja, desactivar el usuario solo si se da
 * de baja (y entonces sí), no copiar excepciones, guardar la versión final del anexo.
 */
export const traspasoSchema = z
  .object(
    {
      destino: destinoSchema,
      lineas: lineasSchema,
      fecha: fechaOpcional('Fecha del traspaso no válida: usa AAAA-MM-DD'),
      dar_de_baja: booleanoOpcional('Indica si la persona se va (verdadero o falso)'),
      desactivar_usuario: booleanoOpcional('Indica si se desactiva su usuario (verdadero o falso)'),
      copiar_excepciones: booleanoOpcional('Indica si se copian sus excepciones (verdadero o falso)'),
      guardar_anexo_final: booleanoOpcional('Indica si se guarda la versión final del anexo (verdadero o falso)'),
      motivo: textoOpcional(MOTIVO_MAX, 'Motivo no válido'),
    },
    { required_error: MENSAJE_OBJETO, invalid_type_error: MENSAJE_OBJETO }
  )
  .superRefine((datos, ctx) => {
    if (datos.dar_de_baja && datos.destino.tipo === 'nadie') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destino'], message: MENSAJE_BAJA_SIN_DESTINO })
    }
    if (!datos.dar_de_baja && datos.desactivar_usuario === true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['desactivar_usuario'], message: MENSAJE_USUARIO_SIN_BAJA })
    }
  })
  .transform(
    (datos): TraspasoInput => ({
      destino: datos.destino,
      lineas: datos.lineas,
      fecha: datos.fecha,
      dar_de_baja: datos.dar_de_baja ?? false,
      desactivar_usuario: datos.dar_de_baja ? datos.desactivar_usuario ?? true : false,
      copiar_excepciones: datos.copiar_excepciones ?? false,
      guardar_anexo_final: datos.guardar_anexo_final ?? true,
      motivo: datos.motivo,
    })
  )

export type TraspasoBody = z.infer<typeof traspasoSchema>

// ---------------------------------------------------------------------------------------------
// Contratar (la vacante pasa a ser la persona contratada)
// ---------------------------------------------------------------------------------------------

/** POST /api/executives/[id]/contratar. */
export const contratarSchema = z
  .object(
    {
      full_name: nombrePersonaSchema('Escribe el nombre de la persona contratada'),
      email: emailOpcional,
      fecha_ingreso: fechaOpcional('Fecha de ingreso no válida: usa AAAA-MM-DD'),
    },
    { required_error: MENSAJE_OBJETO, invalid_type_error: MENSAJE_OBJETO }
  )
  .transform(
    (datos): ContratarInput => ({ full_name: datos.full_name, email: datos.email, fecha_ingreso: datos.fecha_ingreso })
  )

export type ContratarBody = z.infer<typeof contratarSchema>
