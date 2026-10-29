// Bogotá hacia afuera (PR 3, 2026-10-11): validación de la configuración que edita el administrador,
// resumen de la simulación y fila agregada "Bogotá" de la tarjeta de distancias de la ficha.
// Spec: docs/specs/2026-10-11-bogota-corredores.md
//
// Módulo PURO (sin E/S): lo usan /api/kams/bogota-config (GET/PUT y /simulate),
// /api/hospitals/[id]/kam-distances, la tarjeta de /kams, la ficha de la IPS y
// scripts/corredores-config-check.ts. Las reglas del motor (candidato "Bogotá", corredor, celda) viven en
// lib/bogota-corredores.ts y lib/opmap-algorithm-simplified.ts; aquí solo se validan y se resumen.
// Imports relativos (no '@/') para que los scripts lo usen con tsx.

import {
  AGRUPACIONES_POR_K,
  CORREDORES,
  CORREDOR_LABEL,
  isBogotaK,
  resolveCorredor,
  validarGrupos,
  type BogotaK,
  type Corredor,
  type CorredorRow,
} from './bogota-corredores'

/** Límites del tope único de Bogotá hacia afuera (minutos). Igual que el CHECK de bogota_config. */
export const BOGOTA_MAX_MINUTES_MIN = 60
export const BOGOTA_MAX_MINUTES_MAX = 600

/** Celda de Bogotá = zona cuyo area_id es una localidad de Bogotá (11001 + 2 dígitos). */
export function isBogotaCellArea(areaId: string | null | undefined): boolean {
  return typeof areaId === 'string' && /^11001\d{2}$/.test(areaId)
}

/** Configuración propuesta ya validada (lo que se guarda en bogota_config o se simula). */
export interface BogotaConfigInput {
  k: BogotaK
  max_travel_minutes: number
  grupos: Record<Corredor, string>
}

export type BogotaConfigValidation = { ok: true; value: BogotaConfigInput } | { ok: false; errors: string[] }

/**
 * Valida la configuración que llega de la tarjeta de /kams (PUT) o de la simulación.
 * - k entero de 1 a 4.
 * - max_travel_minutes entero entre 60 y 600.
 * - grupos: un objeto con los cuatro corredores; cada uno apunta a una celda ACTIVA de Bogotá
 *   (activeCellIds) y la agrupación cuadra con k (validarGrupos de lib/bogota-corredores.ts).
 * Devuelve todos los errores en español, listos para mostrarlos.
 */
export function validateBogotaConfigInput(input: unknown, activeCellIds: ReadonlySet<string>): BogotaConfigValidation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['Faltan los datos de la configuración de Bogotá.'] }
  }
  const raw = input as Record<string, unknown>
  const errors: string[] = []

  const k = Number(raw.k)
  const kOk = raw.k !== null && raw.k !== undefined && raw.k !== '' && isBogotaK(k)
  if (!kOk) errors.push('El número de celdas (k) debe ser 1, 2, 3 o 4.')

  const max = Number(raw.max_travel_minutes)
  const maxOk =
    raw.max_travel_minutes !== null &&
    raw.max_travel_minutes !== undefined &&
    raw.max_travel_minutes !== '' &&
    Number.isInteger(max) &&
    max >= BOGOTA_MAX_MINUTES_MIN &&
    max <= BOGOTA_MAX_MINUTES_MAX
  if (!maxOk) {
    errors.push(`El tope único debe ser un número entero de minutos entre ${BOGOTA_MAX_MINUTES_MIN} y ${BOGOTA_MAX_MINUTES_MAX}.`)
  }

  const grupos = {} as Record<Corredor, string>
  const rawGrupos = raw.grupos
  if (!rawGrupos || typeof rawGrupos !== 'object' || Array.isArray(rawGrupos)) {
    errors.push('Falta la celda de cada corredor.')
  } else {
    const entries = rawGrupos as Record<string, unknown>
    for (const key of Object.keys(entries)) {
      if (!(CORREDORES as readonly string[]).includes(key)) errors.push(`Corredor desconocido: "${key}".`)
    }
    for (const corredor of CORREDORES) {
      const value = entries[corredor]
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`El corredor ${CORREDOR_LABEL[corredor]} no tiene celda asignada.`)
      } else if (!activeCellIds.has(value.trim())) {
        errors.push(`La celda del corredor ${CORREDOR_LABEL[corredor]} no es una zona activa de Bogotá.`)
      } else {
        grupos[corredor] = value.trim()
      }
    }
  }

  if (errors.length === 0 && kOk) {
    errors.push(...validarGrupos(k as BogotaK, grupos))
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: { k: k as BogotaK, max_travel_minutes: max, grupos } }
}

/**
 * Configuración propuesta en la URL de GET /api/kams/bogota-config/simulate:
 * ?k=2&max=240&norte=<uuid>&occidente=<uuid>&sur=<uuid>&oriente=<uuid>.
 * null si no viene ninguno de esos parámetros (se simula la configuración guardada).
 */
export function parseSimulationQuery(params: URLSearchParams): Record<string, unknown> | null {
  const keys = ['k', 'max', ...CORREDORES]
  if (!keys.some(key => params.has(key))) return null
  const grupos: Record<string, string | null> = {}
  for (const corredor of CORREDORES) grupos[corredor] = params.get(corredor)
  return { k: params.get('k'), max_travel_minutes: params.get('max'), grupos }
}

/** Parámetros de la URL de simulación para una configuración (inverso de parseSimulationQuery). */
export function simulationQueryString(config: BogotaConfigInput): string {
  const params = new URLSearchParams()
  params.set('k', String(config.k))
  params.set('max', String(config.max_travel_minutes))
  for (const corredor of CORREDORES) params.set(corredor, config.grupos[corredor])
  return params.toString()
}

/**
 * grupos a partir de la celda elegida para cada grupo de AGRUPACIONES_POR_K[k] (lo que edita la
 * tarjeta: una celda por grupo). receptoras[i] = kam_id de la celda del grupo i.
 */
export function gruposDesdeReceptoras(k: BogotaK, receptoras: ReadonlyArray<string>): Partial<Record<Corredor, string>> {
  const grupos: Partial<Record<Corredor, string>> = {}
  AGRUPACIONES_POR_K[k].forEach((grupo, index) => {
    const celda = receptoras[index]
    if (celda) for (const corredor of grupo) grupos[corredor] = celda
  })
  return grupos
}

/** Celda de cada grupo de k a partir de unos grupos (la del primer corredor del grupo). */
export function receptorasDesdeGrupos(k: BogotaK, grupos: Partial<Record<Corredor, string>>): string[] {
  return AGRUPACIONES_POR_K[k].map(grupo => grupos[grupo[0]] ?? '')
}

/** Nombre del grupo de corredores para la tarjeta ("Norte y Oriente", "Los cuatro corredores"). */
export function nombreGrupo(grupo: readonly Corredor[]): string {
  if (grupo.length === CORREDORES.length) return 'Los cuatro corredores'
  const labels = grupo.map(c => CORREDOR_LABEL[c])
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}

// ---------------------------------------------------------------------------
// Resumen de la simulación (GET /api/kams/bogota-config/simulate). "Antes" = asignaciones guardadas
// hoy (lo que muestra el mapa); "después" = el motor en memoria con la configuración propuesta.
// ---------------------------------------------------------------------------

export interface SimCell {
  id: string
  name: string
  base_city?: string | null
  area_id: string
  max_travel_time: number // MINUTOS (tope individual de la celda, ya no se usa hacia afuera)
}

export interface SimZone {
  id: string
  name: string
}

export interface SimHospital {
  id: string
  code: string | null
  name: string
  department_id: string | null
  municipality_id: string | null
  locality_id?: string | null
  municipality_name?: string | null
  department_name?: string | null
}

export interface SimAssignment {
  hospital_id: string
  kam_id: string
  travel_time: number | null // SEGUNDOS
  assignment_type: string | null
  detail?: { corredor?: string | null; bogota_min_segundos?: number; celda_min?: string } | null
}

export interface SimForced {
  territory_id: string
  territory_name: string | null
  kam_id: string
  active?: boolean | null
}

export type SimChangeKind = 'cambia_celda' | 'sale_de_bogota' | 'entra_a_bogota' | 'queda_sin_zona' | 'gana_zona'

export interface SimSide {
  kam_id: string
  zona: string
  minutos: number | null
  tipo: string | null
  corredor?: Corredor | null
}

export interface SimChange {
  hospital_id: string
  code: string | null
  name: string
  municipio: string
  departamento: string
  tipo: SimChangeKind
  antes: SimSide | null
  despues: SimSide | null
}

export interface SimCellSummary {
  kam_id: string
  nombre: string
  area_id: string
  tope_actual_min: number
  antes: number
  despues: number
  diferencia: number
  despues_por_tipo: Record<string, number>
  corredores: Corredor[]
}

export interface SimForcedSummary {
  territory_id: string
  territory_name: string
  celda_forzada: { kam_id: string; nombre: string }
  ips: number
  corredor: Corredor | null
  celda_por_corredor: { kam_id: string; nombre: string } | null
  coincide: boolean
}

export interface BogotaSimulationSummary {
  propuesta: BogotaConfigInput
  celdas: SimCellSummary[]
  totales: {
    asignadas_antes: number
    asignadas_despues: number
    por_corredor: Record<Corredor, number>
    sin_corredor: number
    cambios: number
    fuera_de_alcance: number
    otros_cambios: number
  }
  cambios: SimChange[]
  fuera_de_alcance: SimChange[]
  sin_corredor: SimChange[]
  forzadas: SimForcedSummary[]
}

export interface BuildSimulationInput {
  propuesta: BogotaConfigInput
  cells: readonly SimCell[]
  zones: readonly SimZone[]
  hospitals: readonly SimHospital[]
  before: readonly SimAssignment[]
  after: readonly SimAssignment[]
  forced: readonly SimForced[]
  corredores: readonly CorredorRow[]
}

const minutesOf = (seconds: number | null | undefined) =>
  seconds === null || seconds === undefined || !Number.isFinite(seconds) ? null : Math.round(seconds / 60)

// Nombre de la zona ("Bogotá Norte"); la localidad del punto base solo si no hay nombre
function cellName(cell: Pick<SimCell, 'name' | 'base_city'>): string {
  return cell.name.replace(/^\s*KAM\s+/i, '').trim() || (cell.base_city && cell.base_city.trim()) || ''
}

/**
 * Resumen pura de la simulación: conteo por celda antes/después, cambios en los que interviene alguna
 * celda de Bogotá, IPS que quedan fuera de alcance (antes en una celda, después sin zona), IPS que
 * entran a Bogotá sin corredor configurado, y las asignaciones forzadas a celdas de Bogotá comparadas
 * con lo que daría el corredor. Los cambios en los que no interviene Bogotá (datos pendientes de
 * recalcular) solo se cuentan en otros_cambios.
 */
export function buildBogotaSimulationSummary(input: BuildSimulationInput): BogotaSimulationSummary {
  const { propuesta, cells, zones, hospitals, before, after, forced, corredores } = input
  const cellIds = new Set(cells.map(c => c.id))
  const zoneName = new Map<string, string>()
  for (const zone of zones) zoneName.set(zone.id, zone.name.replace(/^\s*KAM\s+/i, '').trim())
  for (const cell of cells) zoneName.set(cell.id, cellName(cell))
  const nameOf = (kamId: string) => zoneName.get(kamId) ?? kamId
  const hospitalById = new Map(hospitals.map(h => [h.id, h]))
  const beforeById = new Map(before.map(a => [a.hospital_id, a]))
  const afterById = new Map(after.map(a => [a.hospital_id, a]))

  const side = (a: SimAssignment | undefined): SimSide | null => {
    if (!a) return null
    const corredor = a.detail && typeof a.detail.corredor === 'string' ? (a.detail.corredor as Corredor) : null
    return {
      kam_id: a.kam_id,
      zona: nameOf(a.kam_id),
      minutos: minutesOf(a.travel_time),
      tipo: a.assignment_type,
      ...(a.assignment_type === 'bogota_corredor' ? { corredor } : {}),
    }
  }

  const changeFor = (hospitalId: string, tipo: SimChangeKind, b?: SimAssignment, a?: SimAssignment): SimChange => {
    const h = hospitalById.get(hospitalId)
    return {
      hospital_id: hospitalId,
      code: h?.code ?? null,
      name: h?.name ?? hospitalId,
      municipio: h?.municipality_name || h?.municipality_id || '',
      departamento: h?.department_name || h?.department_id || '',
      tipo,
      antes: side(b),
      despues: side(a),
    }
  }

  const cambios: SimChange[] = []
  const fueraDeAlcance: SimChange[] = []
  let otros = 0
  const ids = new Set<string>([...beforeById.keys(), ...afterById.keys()])
  for (const id of ids) {
    const b = beforeById.get(id)
    const a = afterById.get(id)
    if (b && a && b.kam_id === a.kam_id) continue
    const bCell = !!b && cellIds.has(b.kam_id)
    const aCell = !!a && cellIds.has(a.kam_id)
    if (!bCell && !aCell) {
      otros++
      continue
    }
    if (b && !a) fueraDeAlcance.push(changeFor(id, 'queda_sin_zona', b, a))
    else if (!b && a) cambios.push(changeFor(id, 'gana_zona', b, a))
    else if (bCell && aCell) cambios.push(changeFor(id, 'cambia_celda', b, a))
    else if (bCell) cambios.push(changeFor(id, 'sale_de_bogota', b, a))
    else cambios.push(changeFor(id, 'entra_a_bogota', b, a))
  }

  const sinCorredor: SimChange[] = []
  const porCorredor = Object.fromEntries(CORREDORES.map(c => [c, 0])) as Record<Corredor, number>
  for (const a of after) {
    if (a.assignment_type !== 'bogota_corredor') continue
    const corredor = a.detail?.corredor
    if (typeof corredor === 'string' && (CORREDORES as readonly string[]).includes(corredor)) {
      porCorredor[corredor as Corredor]++
    } else {
      // Lista informativa (no es un cambio): municipio sin fila en bogota_corredores
      const b = beforeById.get(a.hospital_id)
      sinCorredor.push(changeFor(a.hospital_id, b && cellIds.has(b.kam_id) ? 'cambia_celda' : 'entra_a_bogota', b, a))
    }
  }

  const corredoresDeCelda = (kamId: string) => CORREDORES.filter(c => propuesta.grupos[c] === kamId)
  const celdas: SimCellSummary[] = cells.map(cell => {
    const antes = before.filter(a => a.kam_id === cell.id).length
    const despuesRows = after.filter(a => a.kam_id === cell.id)
    const porTipo: Record<string, number> = {}
    for (const a of despuesRows) {
      const tipo = a.assignment_type || 'sin_tipo'
      porTipo[tipo] = (porTipo[tipo] || 0) + 1
    }
    return {
      kam_id: cell.id,
      nombre: cellName(cell),
      area_id: cell.area_id,
      tope_actual_min: cell.max_travel_time,
      antes,
      despues: despuesRows.length,
      diferencia: despuesRows.length - antes,
      despues_por_tipo: porTipo,
      corredores: corredoresDeCelda(cell.id),
    }
  })

  // Asignaciones forzadas a celdas de Bogotá (una fila por territorio activo)
  const forzadas: SimForcedSummary[] = []
  const seen = new Set<string>()
  for (const f of forced) {
    if (f.active === false || !cellIds.has(f.kam_id) || seen.has(f.territory_id)) continue
    seen.add(f.territory_id)
    const ips = hospitals.filter(h => (h.locality_id || h.municipality_id) === f.territory_id).length
    const isMunicipality = /^\d{5}$/.test(f.territory_id)
    const corredor = isMunicipality ? resolveCorredor(f.territory_id, f.territory_id.substring(0, 2), corredores) : null
    const celda = corredor ? propuesta.grupos[corredor] : null
    forzadas.push({
      territory_id: f.territory_id,
      territory_name: f.territory_name || f.territory_id,
      celda_forzada: { kam_id: f.kam_id, nombre: nameOf(f.kam_id) },
      ips,
      corredor,
      celda_por_corredor: celda ? { kam_id: celda, nombre: nameOf(celda) } : null,
      coincide: !!celda && celda === f.kam_id,
    })
  }

  const byPlace = (x: SimChange, y: SimChange) =>
    x.departamento.localeCompare(y.departamento, 'es') ||
    x.municipio.localeCompare(y.municipio, 'es') ||
    x.name.localeCompare(y.name, 'es')
  cambios.sort(byPlace)
  fueraDeAlcance.sort(byPlace)
  sinCorredor.sort(byPlace)
  forzadas.sort((x, y) => x.territory_name.localeCompare(y.territory_name, 'es'))

  return {
    propuesta,
    celdas,
    totales: {
      asignadas_antes: before.length,
      asignadas_despues: after.length,
      por_corredor: porCorredor,
      sin_corredor: sinCorredor.length,
      cambios: cambios.length,
      fuera_de_alcance: fueraDeAlcance.length,
      otros_cambios: otros,
    },
    cambios,
    fuera_de_alcance: fueraDeAlcance,
    sin_corredor: sinCorredor,
    forzadas,
  }
}

// ---------------------------------------------------------------------------
// Ficha de la IPS: fila agregada "Bogotá" en "Distancias desde cada zona"
// ---------------------------------------------------------------------------

export interface DistanceRowLite {
  kam_id: string
  travel_time: number // SEGUNDOS
  area_id?: string | null
}

export interface BogotaDistanceAggregate {
  min_seconds: number
  celda_min: string
  max_travel_minutes: number
  over_limit: boolean
}

/**
 * Fila "Bogotá" para una IPS FUERA de Bogotá: mejor tiempo entre las celdas de Bogotá que tienen
 * distancia y el tope único. null si la IPS está en Bogotá (department_id '11'), si no hay
 * configuración (maxTravelMinutes null) o si ninguna celda tiene distancia.
 */
export function bogotaDistanceAggregate(
  rows: readonly DistanceRowLite[],
  hospitalDepartmentId: string | null | undefined,
  maxTravelMinutes: number | null
): BogotaDistanceAggregate | null {
  if (maxTravelMinutes === null || hospitalDepartmentId === '11') return null
  let best: DistanceRowLite | null = null
  for (const row of rows) {
    if (!isBogotaCellArea(row.area_id) || !Number.isFinite(row.travel_time)) continue
    if (!best || row.travel_time < best.travel_time) best = row
  }
  if (!best) return null
  return {
    min_seconds: best.travel_time,
    celda_min: best.kam_id,
    max_travel_minutes: maxTravelMinutes,
    over_limit: best.travel_time / 60 > maxTravelMinutes,
  }
}

/**
 * Texto de la ficha para una asignación 'bogota_corredor': hacia afuera "Bogotá (corredor Norte) → Bogotá Norte"; una
 * IPS de Bogotá asignada por el sector de su localidad (detail.localidad, 2026-10-28) "Bogotá, sector Norte → Bogotá Norte".
 */
export function bogotaAssignmentLabel(corredor: string | null | undefined, cellName: string, localidad?: string | null): string {
  if (typeof corredor === 'string' && (CORREDORES as readonly string[]).includes(corredor)) {
    const label = CORREDOR_LABEL[corredor as Corredor]
    return localidad ? `Bogotá, sector ${label} → ${cellName}` : `Bogotá (corredor ${label}) → ${cellName}`
  }
  return `Bogotá (sin corredor: celda con menor tiempo) → ${cellName}`
}
