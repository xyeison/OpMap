// Fase 3 · Importador del REPS: definiciones compartidas entre servidor y navegador.
// Sin dependencias (lo importan la página /hospitals/import, la lista de IPS y el mapa); el
// parseo y la simulación viven en lib/reps-import.ts (solo servidor).

/** Quién importa del REPS (además de hospitals:edit): administradores y gestores de datos; contract_manager no. */
export const REPS_IMPORT_ROLES = ['admin', 'data_manager'] as const

/** Basta con que UNO de los papeles de la empresa activa sea de REPS_IMPORT_ROLES (suma de papeles, no el más alto). */
export function puedeImportarReps(papeles: readonly { papel: string }[]): boolean {
  return papeles.some(p => (REPS_IMPORT_ROLES as readonly string[]).includes(p.papel))
}

export type RepsImportKind = 'servicios' | 'capacidad'
export type RepsImportMode = 'replace' | 'merge'
export type RepsFileKind = 'xlsx' | 'xls' | 'csv' | 'pdf'

/** Campos que el importador sabe leer de un archivo del REPS. */
export type RepsFieldKey =
  | 'repsCode'
  | 'sedeNumber'
  | 'nit'
  | 'prestadorName'
  | 'sedeName'
  | 'department'
  | 'municipality'
  | 'municipalityCode'
  | 'group'
  | 'serviceCode'
  | 'serviceName'
  | 'complexity'
  | 'modality'
  | 'concept'
  | 'quantity'

export interface RepsFieldDef {
  key: RepsFieldKey
  label: string
  /** Tipos de archivo donde el campo tiene sentido. */
  kinds: RepsImportKind[]
  hint?: string
}

export const REPS_FIELDS: RepsFieldDef[] = [
  { key: 'repsCode', label: 'Código de habilitación (sede)', kinds: ['servicios', 'capacidad'], hint: '12 dígitos; o el del prestador (10) junto con el número de sede' },
  { key: 'sedeNumber', label: 'Número de sede', kinds: ['servicios', 'capacidad'] },
  { key: 'nit', label: 'NIT', kinds: ['servicios', 'capacidad'] },
  { key: 'prestadorName', label: 'Nombre del prestador', kinds: ['servicios', 'capacidad'] },
  { key: 'sedeName', label: 'Nombre de la sede', kinds: ['servicios', 'capacidad'] },
  { key: 'department', label: 'Departamento', kinds: ['servicios', 'capacidad'] },
  { key: 'municipality', label: 'Municipio', kinds: ['servicios', 'capacidad'] },
  { key: 'municipalityCode', label: 'Código DANE del municipio', kinds: ['servicios', 'capacidad'] },
  { key: 'group', label: 'Grupo (servicio o capacidad)', kinds: ['servicios', 'capacidad'] },
  { key: 'serviceCode', label: 'Código del servicio', kinds: ['servicios'] },
  { key: 'serviceName', label: 'Nombre del servicio', kinds: ['servicios'] },
  { key: 'complexity', label: 'Complejidad', kinds: ['servicios'] },
  { key: 'modality', label: 'Modalidad', kinds: ['servicios'] },
  { key: 'concept', label: 'Concepto (capacidad)', kinds: ['capacidad'] },
  { key: 'quantity', label: 'Cantidad', kinds: ['capacidad'] },
]

/** Mapeo campo → índice de columna del archivo (null = no usar). */
export type RepsColumnMapping = Partial<Record<RepsFieldKey, number | null>>

/** Servicios prioritarios que se resumen en hospitals.service_flags (Res. 3100 de 2019). */
export const SERVICE_FLAG_KEYS = [
  'ortopedia',
  'cirugia_ortopedica',
  'trauma',
  'neurocirugia',
  'columna',
  'medicina_deportiva',
  'cirugia_mano',
  'urgencias',
  'uci_adultos',
] as const
export type ServiceFlagKey = (typeof SERVICE_FLAG_KEYS)[number]
export type ServiceFlags = Partial<Record<ServiceFlagKey, boolean>>

export const SERVICE_FLAG_LABELS: Record<ServiceFlagKey, string> = {
  ortopedia: 'Ortopedia y/o traumatología',
  cirugia_ortopedica: 'Cirugía ortopédica',
  trauma: 'Trauma',
  neurocirugia: 'Neurocirugía',
  columna: 'Cirugía de columna',
  medicina_deportiva: 'Medicina del deporte',
  cirugia_mano: 'Cirugía de mano',
  urgencias: 'Urgencias',
  uci_adultos: 'UCI adultos',
}

export const CAPACITY_GROUPS = ['camas', 'salas', 'ambulancias', 'otros'] as const
export type CapacityGroup = (typeof CAPACITY_GROUPS)[number]

export const CAPACITY_GROUP_LABELS: Record<CapacityGroup, string> = {
  camas: 'Camas',
  salas: 'Salas',
  ambulancias: 'Ambulancias',
  otros: 'Otros',
}

/** Máximo de bytes por archivo: Vercel corta el cuerpo de una petición en 4,5 MB. */
export const REPS_MAX_FILE_BYTES = 4 * 1024 * 1024

// ---------------------------------------------------------------------------------------
// Respuesta de POST /api/hospitals/import/preview (la página la pinta tal cual)
// ---------------------------------------------------------------------------------------

export type RepsMatchMethod = 'reps_code' | 'importacion_previa' | 'nit' | 'nit_municipio'

export interface RepsSimulationItem {
  /** Sede: código de habilitación de 12 (o 10) dígitos, o "NIT-<nit>" si el archivo solo trae NIT. */
  key: string
  sedeName: string | null
  prestadorName: string | null
  nit: string | null
  municipality: string | null
  status: 'matched' | 'ambiguous' | 'unmatched'
  method: RepsMatchMethod | null
  reason: string | null
  hospital: { id: string; name: string; code: string; active: boolean } | null
  rowsInFile: number
  /** Servicios: nombres añadidos / retirados (máx. 25 cada uno) y totales. */
  added: string[]
  removed: string[]
  addedCount: number
  removedCount: number
  /** Capacidad: conceptos cuya cantidad cambia ("Camas · Adultos: 10 → 12"). */
  changed: string[]
  flagsBefore: ServiceFlags | null
  flagsAfter: ServiceFlags | null
  servicesBefore: number | null
  servicesAfter: number | null
  quirofanosBefore: number | null
  quirofanosAfter: number | null
  bedsBefore: number | null
  bedsAfter: number | null
  hasChanges: boolean
}

export interface RepsInvalidRow {
  /** Fila del archivo (1 = primera fila; en PDF, número de fila reconstruida). */
  row: number
  reason: string
}

export interface RepsPreviewResponse {
  /** Vacío si falta mapear columnas obligatorias (needsMapping): no hay nada que aplicar. */
  token: string
  expiresAt: string | null
  needsMapping: boolean
  missingFields: string[]
  kind: RepsImportKind
  detectedKind: RepsImportKind | null
  mode: RepsImportMode
  fileKind: RepsFileKind
  fileName: string
  table: {
    headers: string[]
    headerRow: number
    sampleRows: string[][]
    totalRows: number
    sheetName: string | null
  }
  mapping: RepsColumnMapping
  /** Columnas de modalidad / complejidad tipo SI/NO detectadas (no se mapean a mano). */
  flagColumns: { index: number; header: string; meaning: string }[]
  stats: {
    rowsRead: number
    validRows: number
    invalidRows: number
    sedes: number
    matched: number
    ambiguous: number
    unmatched: number
    hospitalsWithChanges: number
    groupsInFile: string[]
    servicesToUpsert: number
    servicesToDelete: number
    capacityToUpsert: number
    capacityToDelete: number
  }
  invalidSamples: RepsInvalidRow[]
  items: RepsSimulationItem[]
  itemsTruncated: boolean
  warnings: string[]
}

export interface RepsApplyResponse {
  ok: true
  kind: RepsImportKind
  counts: {
    linked_rows: number
    services_upserted: number
    services_deleted: number
    capacity_upserted: number
    capacity_deleted: number
    hospitals_updated: number
    history_rows: number
  }
  hospitalsWithChanges: number
  changedSincePreview: boolean
  message: string
}
