// Simulación de "Bogotá hacia afuera" con una configuración propuesta (solo servidor, SOLO LECTURA).
// Ejecuta el motor de asignación en memoria (SimplifiedOpMapAlgorithm.loadData + calculateAssignments,
// sin saveAssignments) y compara con las asignaciones guardadas hoy. No escribe nada ni llama a Google.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SimplifiedOpMapAlgorithm } from '@/lib/opmap-algorithm-simplified'
import { parseCorredorRows, SEMILLA_CORREDORES, type CorredorRow } from '@/lib/bogota-corredores'
import {
  buildBogotaSimulationSummary,
  type BogotaConfigInput,
  type BogotaSimulationSummary,
  type SimAssignment,
  type SimForced,
  type SimHospital,
} from '@/lib/bogota-admin'
import { fetchAllRows } from './kam-shared'
import type { BogotaCellRow } from '../../_lib/bogota-config'

export interface BogotaSimulationResult extends BogotaSimulationSummary {
  /** De dónde salieron los corredores: la tabla bogota_corredores o la semilla en memoria (tabla vacía). */
  fuente_corredores: 'tabla' | 'semilla'
  segundos: number
}

async function loadCorredores(): Promise<{ rows: CorredorRow[]; fuente: 'tabla' | 'semilla' }> {
  const { data, error } = await supabaseAdmin
    .from('bogota_corredores')
    .select('department_code, municipality_code, corredor, nota')
    .range(0, 4999)
  if (error) throw new Error(`Error cargando bogota_corredores: ${error.message}`)
  const rows = parseCorredorRows(data)
  return rows.length > 0 ? { rows, fuente: 'tabla' } : { rows: [...SEMILLA_CORREDORES], fuente: 'semilla' }
}

/** Simula la configuración propuesta (ya validada) contra las asignaciones guardadas hoy. */
export async function runBogotaSimulation(
  propuesta: BogotaConfigInput,
  cells: readonly BogotaCellRow[]
): Promise<BogotaSimulationResult> {
  const started = Date.now()
  const corredores = await loadCorredores()

  const algorithm = new SimplifiedOpMapAlgorithm()
  await algorithm.loadData({
    bogota: {
      config: { k: propuesta.k, max_travel_minutes: propuesta.max_travel_minutes, grupos: propuesta.grupos },
      corredores: corredores.rows,
    },
  })
  const after = await algorithm.calculateAssignments()

  const [before, hospitals, zones, forced] = await Promise.all([
    fetchAllRows<SimAssignment>((from, to) =>
      supabaseAdmin
        .from('assignments')
        .select('hospital_id, kam_id, travel_time, assignment_type')
        .order('hospital_id')
        .range(from, to)
    ),
    fetchAllRows<SimHospital>((from, to) =>
      supabaseAdmin
        .from('hospitals')
        .select('id, code, name, department_id, municipality_id, locality_id, municipality_name, department_name')
        .eq('active', true)
        .order('id')
        .range(from, to)
    ),
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabaseAdmin.from('kams').select('id, name').order('id').range(from, to)
    ),
    fetchAllRows<SimForced>((from, to) =>
      supabaseAdmin
        .from('forced_assignments')
        .select('territory_id, territory_name, kam_id, active')
        .eq('active', true)
        .order('territory_id')
        .range(from, to)
    ),
  ])

  const summary = buildBogotaSimulationSummary({
    propuesta,
    cells,
    zones,
    hospitals,
    before,
    after,
    forced,
    corredores: corredores.rows,
  })
  return { ...summary, fuente_corredores: corredores.fuente, segundos: Math.round((Date.now() - started) / 100) / 10 }
}
