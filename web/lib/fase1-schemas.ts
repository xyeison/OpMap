// Validación (allow-list) de los cuerpos de /api/business-lines/** y /api/executives/**.
// zod descarta cualquier clave no listada (id, code, sort_order, user_id, left_at, created_at...):
// nunca se pasa el body entero a insert/update.
import { z } from 'zod'
import { EXECUTIVE_STATUSES, type ExecutiveStatus } from '@/lib/types/lines'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const uuidSchema = z.string().regex(UUID_RE, 'ID no válido')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `El texto no puede superar ${max} caracteres`)
    .nullish()
    .transform(value => (value ? value : null))

// ---------------------------------------------------------------------------
// Líneas de negocio
// ---------------------------------------------------------------------------

const lineNameSchema = z
  .string({ invalid_type_error: 'Nombre no válido' })
  .trim()
  .min(1, 'El nombre es requerido')
  .max(120, 'El nombre es demasiado largo')

const maxReachSchema = z
  .number({ invalid_type_error: 'Alcance máximo no válido' })
  .int('El alcance máximo debe ser un número entero de minutos')
  .min(30, 'El alcance máximo debe ser de al menos 30 minutos')
  .max(720, 'El alcance máximo no puede superar 720 minutos')

/** PATCH /api/business-lines/[id] */
export const businessLineUpdateSchema = z
  .object({
    name: lineNameSchema.optional(),
    leader_user_id: uuidSchema.nullable().optional(),
    max_reach_minutes: maxReachSchema.optional(),
    active: z.boolean({ invalid_type_error: 'Estado no válido' }).optional(),
  })
  .refine(data => Object.keys(data).length > 0, { message: 'No hay campos para actualizar' })

export type BusinessLineUpdate = z.infer<typeof businessLineUpdateSchema>

/** PUT /api/business-lines/[id]/zones — reemplaza la matriz línea × zona */
export const lineZonesSchema = z.object({
  zones: z
    .array(
      z.object({
        kam_id: uuidSchema.transform(id => id.toLowerCase()),
        has_equipment: z.boolean({
          required_error: 'Falta has_equipment',
          invalid_type_error: 'has_equipment debe ser verdadero o falso',
        }),
      }),
      { required_error: 'Falta la lista de zonas', invalid_type_error: 'zones debe ser una lista' }
    )
    .max(500, 'Demasiadas zonas')
    .refine(zones => new Set(zones.map(zone => zone.kam_id)).size === zones.length, {
      message: 'Hay zonas repetidas en la lista',
    }),
})

export type LineZonesBody = z.infer<typeof lineZonesSchema>

// ---------------------------------------------------------------------------
// Ejecutivas
// ---------------------------------------------------------------------------

const fullNameSchema = z
  .string({ required_error: 'El nombre es requerido', invalid_type_error: 'Nombre no válido' })
  .trim()
  .min(1, 'El nombre es requerido')
  .max(200, 'El nombre es demasiado largo')

// Email opcional: '' o null → null; se guarda en minúsculas (único en executives).
const emailSchema = z
  .union([z.string().trim().email('Email no válido').max(320, 'Email demasiado largo'), z.literal(''), z.null()])
  .transform(value => (value ? value.toLowerCase() : null))

const companySchema = z
  .string({ invalid_type_error: 'Empresa no válida' })
  .trim()
  .min(1, 'La empresa es requerida')
  .max(120, 'El nombre de la empresa es demasiado largo')

const statusSchema = z.enum(EXECUTIVE_STATUSES as [ExecutiveStatus, ...ExecutiveStatus[]], {
  errorMap: () => ({ message: 'Estado no válido: usa active, placeholder o inactive' }),
})

const odooEmployeeIdSchema = z
  .number({ invalid_type_error: 'ID de empleado de Odoo no válido' })
  .int('El ID de empleado de Odoo debe ser un entero')
  .positive('El ID de empleado de Odoo debe ser positivo')
  .nullable()

const baseKamIdSchema = z
  .string({ required_error: 'La zona base es requerida', invalid_type_error: 'Zona base no válida' })
  .regex(UUID_RE, 'Zona base no válida')
  .transform(id => id.toLowerCase())

// Color del Ejecutivo Comercial en el mapa por línea (Fase 2): #RRGGBB; '' o null → null (sin color).
const executiveColorSchema = z
  .union([z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'El color debe tener el formato #RRGGBB'), z.literal(''), z.null()], {
    errorMap: () => ({ message: 'El color debe tener el formato #RRGGBB' }),
  })
  .transform(value => (value ? value.toUpperCase() : null))

const linesSchema = z
  .array(uuidSchema, {
    required_error: 'Falta la lista de líneas',
    invalid_type_error: 'lines debe ser una lista',
  })
  .max(20, 'Demasiadas líneas')
  .transform(ids => Array.from(new Set(ids.map(id => id.toLowerCase()))))

/** POST /api/executives */
export const executiveCreateSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema.optional(),
  company: companySchema.optional(),
  base_kam_id: baseKamIdSchema,
  status: statusSchema.optional(),
  lines: linesSchema,
  odoo_employee_id: odooEmployeeIdSchema.optional(),
  notes: optionalText(2000),
  color: executiveColorSchema.optional(),
})

export type ExecutiveCreate = z.infer<typeof executiveCreateSchema>

// En PATCH, "notes" ausente debe quedar undefined (no tocar); '' o null → null (borrar).
const patchNotesSchema = z
  .string({ invalid_type_error: 'Notas no válidas' })
  .trim()
  .max(2000, 'El texto no puede superar 2000 caracteres')
  .nullable()
  .optional()
  .transform(value => (value === undefined ? undefined : value ? value : null))

/** PATCH /api/executives/[id] — mismo cuerpo, todo opcional */
export const executiveUpdateSchema = z
  .object({
    full_name: fullNameSchema.optional(),
    email: emailSchema.optional(),
    company: companySchema.optional(),
    base_kam_id: baseKamIdSchema.optional(),
    status: statusSchema.optional(),
    lines: linesSchema.optional(),
    odoo_employee_id: odooEmployeeIdSchema.optional(),
    notes: patchNotesSchema,
    color: executiveColorSchema.optional(),
  })
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'No hay campos para actualizar',
  })

export type ExecutiveUpdate = z.infer<typeof executiveUpdateSchema>
