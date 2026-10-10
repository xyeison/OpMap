// Validación (allow-list) de los cuerpos de /api/zones/**.
import { z } from 'zod'
import { colorSchema } from '@/app/api/kams/_lib/kam-shared'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `El texto no puede superar ${max} caracteres`)
    .nullish()
    .transform(value => (value ? value : null))

export const zoneSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código es requerido')
    .max(50, 'El código es demasiado largo')
    .transform(value => value.toUpperCase()),
  name: z.string().trim().min(1, 'El nombre es requerido').max(120, 'El nombre es demasiado largo'),
  description: optionalText(1000),
  coordinator_name: optionalText(200),
  coordinator_email: z
    .union([z.string().trim().email('Email del coordinador no válido').max(320), z.literal(''), z.null()])
    .optional()
    .transform(value => (value ? value : null)),
  coordinator_phone: optionalText(50),
  color: colorSchema,
  active: z.boolean().default(true),
})

export const zoneUpdateSchema = zoneSchema.partial().refine(data => Object.keys(data).length > 0, {
  message: 'No hay campos para actualizar',
})
