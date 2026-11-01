// Validación (allow-list) de los cuerpos de las rutas /api/users/**.
import { z } from 'zod'
import { rolePermissions, type Role } from './permissions'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from './passwords'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const roleSchema = z
  .string()
  .refine((value): value is Role => Object.prototype.hasOwnProperty.call(rolePermissions, value), {
    message: 'Rol no válido',
  })

export const passwordSchema = z
  .string({ required_error: 'La contraseña es requerida' })
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .refine(value => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES, {
    message: `La contraseña no puede superar ${PASSWORD_MAX_BYTES} bytes`,
  })

// Email normalizado (trim + minúsculas): el login busca con el mismo criterio
const emailSchema = z.string().trim().toLowerCase().min(1, 'El email es requerido').max(320).email('Email no válido')
const fullNameSchema = z.string().trim().min(1, 'El nombre es requerido').max(200)

const uuidSchema = z
  .string({ invalid_type_error: 'Identificador no válido' })
  .regex(UUID_RE, 'Identificador no válido')
  .transform(id => id.toLowerCase())

/**
 * Un papel en una empresa (empresas, capa 1). La línea va solo con line_leader (y es obligatoria ahí, como el CHECK
 * papeles_linea_solo_lider de la 0960); kam_ids son las Zonas de una líder por Zonas (sin ellas, nacional).
 */
export const papelEntradaSchema = z
  .object({
    papel: roleSchema,
    line_id: uuidSchema.nullable().optional(),
    kam_ids: z.array(uuidSchema, { invalid_type_error: 'kam_ids debe ser una lista de Zonas' }).max(200, 'Demasiadas Zonas').optional(),
  })
  .superRefine((valor, ctx) => {
    if (valor.papel === 'line_leader' && !valor.line_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El papel de líder de negocio necesita su línea' })
    }
    if (valor.papel !== 'line_leader' && (valor.line_id || (valor.kam_ids && valor.kam_ids.length > 0))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Solo el papel de líder de negocio lleva línea y Zonas' })
    }
  })
  .transform(valor => ({
    papel: valor.papel as Role,
    line_id: valor.papel === 'line_leader' ? valor.line_id ?? null : null,
    kam_ids: valor.papel === 'line_leader' ? Array.from(new Set(valor.kam_ids ?? [])) : [],
  }))

const clavePapel = (p: { papel: string; line_id: string | null }) => `${p.papel}|${p.line_id ?? ''}`

/** La lista de papeles de una persona en UNA empresa: sin repetir el mismo papel (y línea). */
export const listaPapelesSchema = z
  .array(papelEntradaSchema, { required_error: 'Falta la lista de papeles', invalid_type_error: 'papeles debe ser una lista' })
  .max(50, 'Demasiados papeles')
  .refine(lista => new Set(lista.map(clavePapel)).size === lista.length, { message: 'Hay papeles repetidos' })

/** PUT /api/users/[id]/papeles */
export const papelesPutSchema = z.object({
  empresa_id: uuidSchema,
  papeles: listaPapelesSchema,
})

const papelConEmpresaSchema = z
  .object({ empresa_id: uuidSchema })
  .passthrough()
  .transform((valor, ctx) => {
    const papel = papelEntradaSchema.safeParse(valor)
    if (!papel.success) {
      for (const issue of papel.error.issues) ctx.addIssue(issue)
      return z.NEVER
    }
    return { empresa_id: valor.empresa_id, ...papel.data }
  })

// role sin papeles = ese papel en VG (como antes de las empresas); con papeles, mandan los papeles y users.role es la
// caché que escribe el servidor. Hace falta uno de los dos.
export const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    full_name: fullNameSchema,
    role: roleSchema.optional(),
    papeles: z
      .array(papelConEmpresaSchema, { invalid_type_error: 'papeles debe ser una lista' })
      .min(1, 'Indica al menos un papel')
      .max(50, 'Demasiados papeles')
      .refine(lista => new Set(lista.map(p => `${p.empresa_id}|${clavePapel(p)}`)).size === lista.length, {
        message: 'Hay papeles repetidos',
      })
      .optional(),
  })
  .refine(valor => valor.role !== undefined || valor.papeles !== undefined, { message: 'Indica el rol o los papeles' })

// Campos editables desde PUT /api/users/[id]. Cualquier otro (password, id, created_at...) se descarta:
// la contraseña solo se cambia en /api/users/[id]/password, que la guarda hasheada.
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: fullNameSchema.optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  password: passwordSchema,
})

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Datos no válidos'
}
