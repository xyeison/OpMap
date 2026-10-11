// Validación (allow-list) de los cuerpos que escriben en public.hospitals.
// Solo columnas reales y editables; zod descarta cualquier otra clave (id, created_at, active...).
import { z } from 'zod'
import { BOGOTA_MUNICIPALITY_ID } from '@/lib/opmap-algorithm-simplified'

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

// Colombia continental, San Andrés y Providencia (lat 13,4; lng -81,7) y Leticia (lat -4,2), con margen.
// Una IPS sin coordenadas o fuera de Colombia no puede recibir tiempos de viaje y quedaría sin zona.
export const COLOMBIA_BOUNDS = { minLat: -4.3, maxLat: 13.5, minLng: -82, maxLng: -66.8 } as const

const coordinateSchema = (label: 'latitud' | 'longitud', min: number, max: number) => {
  const outOfRange = `La ${label} debe estar dentro de Colombia (entre ${min} y ${max})`
  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) return undefined
      if (typeof value === 'string') return Number(value.trim().replace(',', '.'))
      return value
    },
    z
      .number({ required_error: `La ${label} es obligatoria`, invalid_type_error: `La ${label} debe ser un número` })
      .finite(`La ${label} debe ser un número`)
      .min(min, outOfRange)
      .max(max, outOfRange)
  )
}

const latSchema = coordinateSchema('latitud', COLOMBIA_BOUNDS.minLat, COLOMBIA_BOUNDS.maxLat)
const lngSchema = coordinateSchema('longitud', COLOMBIA_BOUNDS.minLng, COLOMBIA_BOUNDS.maxLng)

// Localidad de Bogotá: 11001 + código de 2 dígitos (1100102 = Chapinero), como kams.area_id y el GeoJSON
export const BOGOTA_LOCALITY_RE = /^11001\d{2}$/
export const BOGOTA_LOCALITY_REQUIRED = 'Las IPS de Bogotá necesitan localidad'

export const HOSPITAL_TYPES = ['Publico', 'Privado', 'Mixto'] as const

// Fase 3: código de habilitación de la sede del REPS que ES la IPS (12 dígitos; hospitals.reps_code).
// Al guardarlo, la ruta comprueba que la sede exista en reps_sedes y que no esté vinculada a otra IPS
// (app/api/_lib/reps.ts, resolveRepsLink) y marca reps_match_status = 'matched'.
export const REPS_CODE_MESSAGE = 'El código de habilitación del REPS son 12 dígitos'
export const repsCodeSchema = z.string().trim().regex(/^\d{12}$/, REPS_CODE_MESSAGE)
const optionalRepsCode = z.preprocess(emptyToNull, repsCodeSchema.nullable()).optional()

// PATCH /api/hospitals/[id]/reps-link: { reps_code: "<12 dígitos>" } vincula; { reps_code: null } desvincula.
// La clave es obligatoria (un cuerpo vacío no desvincula por accidente).
export const repsLinkSchema = z.object({
  reps_code: z.union([repsCodeSchema, z.null()], {
    errorMap: () => ({ message: `${REPS_CODE_MESSAGE} (o null para desvincular)` }),
  }),
})

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
// Reglas territoriales (sin ellas la IPS no entra bien en el algoritmo y queda sin zona):
//  - el municipio pertenece al departamento (los 2 primeros dígitos DANE),
//  - en Bogotá (11001) la localidad es obligatoria y tiene 7 dígitos; fuera de Bogotá no hay localidad,
//  - lat/lng obligatorias y dentro de Colombia.
export const createHospitalSchema = z
  .object({
    ...editableFields,
    department_id: z.string().trim().regex(/^\d{2}$/, 'department_id inválido'),
    municipality_id: z.string().trim().regex(/^\d{5}$/, 'municipality_id inválido'),
    locality_id: z.preprocess(emptyToNull, z.string().trim().nullable()).optional(),
    municipality_name: optionalText(200),
    department_name: optionalText(200),
    locality_name: optionalText(200),
    lat: latSchema,
    lng: lngSchema,
    active: z.boolean().optional(),
    reps_code: optionalRepsCode,
  })
  .superRefine((value, ctx) => {
    if (!value.municipality_id.startsWith(value.department_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['municipality_id'],
        message: 'El municipio no pertenece al departamento indicado',
      })
    }
    const locality = value.locality_id ?? null
    if (value.municipality_id === BOGOTA_MUNICIPALITY_ID) {
      if (!locality) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['locality_id'], message: BOGOTA_LOCALITY_REQUIRED })
      } else if (!BOGOTA_LOCALITY_RE.test(locality)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['locality_id'],
          message: 'Localidad inválida: son 7 dígitos (11001 + código de la localidad, p. ej. 1100102 = Chapinero)',
        })
      }
    } else if (locality) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locality_id'],
        message: 'La localidad solo aplica a IPS de Bogotá (municipio 11001)',
      })
    }
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
  reps_code: optionalRepsCode,
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
