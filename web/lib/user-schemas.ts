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

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: fullNameSchema,
  role: roleSchema,
})

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
