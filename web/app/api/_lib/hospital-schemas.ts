// Validación (allow-list) de los cuerpos que escriben en public.hospitals.
// Solo columnas reales y editables; zod descarta cualquier otra clave (id, created_at, active...).
import { z } from 'zod'

const emptyToNull = (value: unknown) =>
  value === '' || value === undefined ? null : value

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional()

const optionalInt = (max: number) =>
  z
    .preprocess(value => {
      if (value === '' || value === null || value === undefined) return null
      if (typeof value === 'string') return Number(value)
      return value
    }, z.number().int().min(0).max(max).nullable())
    .optional()

const latSchema = z.preprocess(
  value => (typeof value === 'string' ? Number(value) : value),
  z.number().finite().min(-90).max(90)
)
const lngSchema = z.preprocess(
  value => (typeof value === 'string' ? Number(value) : value),
  z.number().finite().min(-180).max(180)
)

export const HOSPITAL_TYPES = ['Publico', 'Privado', 'Mixto'] as const

// Campos editables comunes (sin códigos territoriales ni coordenadas)
const editableFields = {
  name: z.string().trim().min(1, 'El nombre es requerido').max(300),
  code: z.string().trim().min(1, 'El código es requerido').max(50),
  address: optionalText(500),
  phone: optionalText(100),
  email: optionalText(320),
  beds: optionalInt(100000),
  service_level: optionalInt(10),
  services: optionalText(10000),
  surgeries: optionalInt(10000000),
  ambulances: optionalInt(100000),
  doctors: optionalText(20000),
  documents_url: z
    .preprocess(emptyToNull, z.string().trim().max(2000).url('URL no válida').nullable())
    .optional(),
  hospital_type: z.enum(HOSPITAL_TYPES, { errorMap: () => ({ message: 'Tipo de hospital inválido' }) }).optional(),
}

// POST /api/hospitals
export const createHospitalSchema = z.object({
  ...editableFields,
  department_id: z.string().trim().regex(/^\d{2}$/, 'department_id inválido'),
  municipality_id: z.string().trim().regex(/^\d{5}$/, 'municipality_id inválido'),
  locality_id: z
    .preprocess(emptyToNull, z.string().trim().regex(/^\d{5,10}$/, 'locality_id inválido').nullable())
    .optional(),
  municipality_name: optionalText(200),
  department_name: optionalText(200),
  locality_name: optionalText(200),
  lat: latSchema,
  lng: lngSchema,
  active: z.boolean().optional(),
})

// PUT /api/hospitals/[id] (todos opcionales). lat/lng solo se aplican si el usuario es admin.
export const updateHospitalSchema = z.object({
  name: editableFields.name.optional(),
  code: editableFields.code.optional(),
  address: editableFields.address,
  phone: editableFields.phone,
  email: editableFields.email,
  beds: editableFields.beds,
  service_level: editableFields.service_level,
  services: editableFields.services,
  surgeries: editableFields.surgeries,
  ambulances: editableFields.ambulances,
  doctors: editableFields.doctors,
  documents_url: editableFields.documents_url,
  hospital_type: editableFields.hospital_type,
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
})

// PATCH /api/hospitals/[id]
export const patchHospitalSchema = z.object({
  documents_url: editableFields.documents_url,
  doctors: editableFields.doctors,
})

// POST activate / deactivate
export const hospitalStateChangeSchema = z.object({
  reason: z.preprocess(
    value => (typeof value === 'string' ? value : ''),
    z.string().trim().min(1, 'La razón es requerida').max(2000)
  ),
})
