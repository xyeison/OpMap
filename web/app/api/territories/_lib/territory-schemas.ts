// Validación (allow-list) de los cuerpos de /api/territories/**.
import { z } from 'zod'
import { uuidSchema } from '@/app/api/kams/_lib/kam-shared'

// Municipio (5 dígitos) o localidad de Bogotá (7 dígitos)
export const territoryIdSchema = z
  .string()
  .trim()
  .regex(/^(\d{5}|\d{7})$/, 'Código de territorio no válido')

export const territoryTypeSchema = z.enum(['municipality', 'locality'], {
  errorMap: () => ({ message: 'Tipo de territorio no válido' }),
})

export const forceAssignmentSchema = z
  .object({
    territoryId: territoryIdSchema,
    territoryType: territoryTypeSchema,
    kamId: uuidSchema,
    territoryName: z.string().trim().max(200).nullish(),
    reason: z.string().trim().max(1000).nullish(),
  })
  .refine(data => (data.territoryType === 'locality') === (data.territoryId.length === 7), {
    message: 'El tipo de territorio no coincide con el código',
  })

export const removeForcedAssignmentSchema = z
  .object({
    territoryId: territoryIdSchema,
    territoryType: territoryTypeSchema,
  })
  .refine(data => (data.territoryType === 'locality') === (data.territoryId.length === 7), {
    message: 'El tipo de territorio no coincide con el código',
  })
