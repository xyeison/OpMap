// Validación (allow-list) de los cuerpos de /api/kams/**. Cualquier campo no listado se descarta
// (id, active, created_at, zone_id...): active solo cambia por /activate y /deactivate, zone_id por /zone.
import { z } from 'zod'
import { areaIdSchema, colorSchema, uuidSchema } from './kam-shared'

const nameSchema = z.string().trim().min(1, 'El nombre es requerido').max(120, 'El nombre es demasiado largo')
const latSchema = z.number({ invalid_type_error: 'Latitud no válida' }).finite().min(-90).max(90)
const lngSchema = z.number({ invalid_type_error: 'Longitud no válida' }).finite().min(-180).max(180)
const maxTravelTimeSchema = z
  .number({ invalid_type_error: 'Tiempo máximo no válido' })
  .int('El tiempo máximo debe ser un número entero de minutos')
  .min(30, 'El tiempo máximo debe ser de al menos 30 minutos')
  .max(720, 'El tiempo máximo no puede superar 720 minutos')
const prioritySchema = z.number({ invalid_type_error: 'Prioridad no válida' }).int().min(1).max(10)

export const createKamSchema = z.object({
  name: nameSchema,
  area_id: areaIdSchema,
  lat: latSchema,
  lng: lngSchema,
  max_travel_time: maxTravelTimeSchema.default(240),
  enable_level2: z.boolean().default(true),
  priority: prioritySchema.default(2),
  participates_in_assignment: z.boolean().default(true),
  color: colorSchema,
})

export const updateKamFieldsSchema = z
  .object({
    name: nameSchema.optional(),
    area_id: areaIdSchema.optional(),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    max_travel_time: maxTravelTimeSchema.optional(),
    enable_level2: z.boolean().optional(),
    priority: prioritySchema.optional(),
    participates_in_assignment: z.boolean().optional(),
    color: colorSchema.optional(),
  })
  .refine(data => Object.keys(data).length > 0, { message: 'No hay campos para actualizar' })

export const updateKamSchema = z.object({
  kamId: uuidSchema,
  updateData: updateKamFieldsSchema,
})

export const kamIdSchema = z.object({ kamId: uuidSchema })

// Campos que cambian el resultado del algoritmo: si cambian en un KAM activo hay que recalcular.
export const ALGORITHM_FIELDS = [
  'area_id',
  'lat',
  'lng',
  'max_travel_time',
  'enable_level2',
  'priority',
  'participates_in_assignment',
] as const
