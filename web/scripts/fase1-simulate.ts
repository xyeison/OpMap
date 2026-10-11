/**
 * Fase 1 · Simulador de activación de zonas (SOLO LECTURA).
 *
 * Pregunta: ¿qué IPS cambian de zona si se activan Cartagena (13001) e Ibagué (73001)
 * y se borran 'KAM Barranquilla MD' y 'Kam Valledupar MD'?
 *
 * Garantía de solo lectura: este script solo usa .select() de Supabase y
 * SimplifiedOpMapAlgorithm.loadData()/calculateAssignments(), que no escriben.
 * NUNCA llama a saveAssignments ni a runSimplifiedAlgorithm.
 *
 * Uso (desde web/): npm run fase1:simulate
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabase-admin'
import { SimplifiedOpMapAlgorithm, type Assignment, type AlgorithmOverrides } from '../lib/opmap-algorithm-simplified'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const OUTPUT_DIR =
  process.env.FASE1_OUTPUT_DIR ||
  '/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad'
const OUTPUT_MD = path.join(OUTPUT_DIR, 'fase1-simulacion.md')
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'fase1-simulacion.json')

const SCENARIO: AlgorithmOverrides = {
  kamActive: { '13001': true, '73001': true },
  excludeKamNames: ['KAM Barranquilla MD', 'Kam Valledupar MD'],
}

interface KamRow {
  id: string
  name: string
  area_id: string
  active: boolean
}

interface HospitalRow {
  id: string
  code: string
  name: string
  department_id: string | null
  municipality_id: string | null
  locality_id: string | null
  municipality_name: string | null
  department_name: string | null
  locality_name: string | null
}

interface AssignmentRow {
  hospital_id: string
  kam_id: string
  travel_time: number | null // SEGUNDOS
  assignment_type: string | null
}

// Asignación normalizada para comparar (minutos redondeados a 1 decimal)
interface Slot {
  kam_id: string
  minutes: number | null
  type: string | null
}

type ChangeKind = 'sin_cambio' | 'cambia_zona' | 'nueva' | 'pierde'

interface Change {
  hospital_id: string
  code: string
  name: string
  municipality: string
  department: string
  kind: Exclude<ChangeKind, 'sin_cambio'>
  from_zone: string | null
  from_minutes: number | null
  from_type: string | null
  to_zone: string | null
  to_minutes: number | null
  to_type: string | null
  // true si el cambio también aparece entre el algoritmo sin overrides y el escenario
  // (es efecto del escenario); false = deriva entre la BD y un recálculo hoy.
  caused_by_scenario: boolean
}

const PAGE = 1000

async function selectAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const supabase = getSupabaseAdmin()
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (filter) query = filter(query)
    const { data, error } = await query
    if (error) throw new Error(`Error leyendo ${table}`)
    const batch = (data || []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

function toMinutes(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined) return null
  return Math.round((seconds / 60) * 10) / 10
}

// Ejecuta el algoritmo en memoria con los logs del algoritmo silenciados
async function runInMemory(overrides?: AlgorithmOverrides): Promise<Assignment[]> {
  const algorithm = new SimplifiedOpMapAlgorithm()
  const originalLog = console.log
  console.log = () => {}
  try {
    await algorithm.loadData(overrides)
    return await algorithm.calculateAssignments()
  } finally {
    console.log = originalLog
  }
}

function toSlotMap(assignments: { hospital_id: string; kam_id: string; travel_time: number | null; assignment_type: string | null }[]): Map<string, Slot> {
  const map = new Map<string, Slot>()
  for (const a of assignments) {
    map.set(a.hospital_id, { kam_id: a.kam_id, minutes: toMinutes(a.travel_time), type: a.assignment_type })
  }
  return map
}

function classify(before: Slot | undefined, after: Slot | undefined): ChangeKind {
  if (!before && !after) return 'sin_cambio'
  if (!before) return 'nueva'
  if (!after) return 'pierde'
  return before.kam_id === after.kam_id ? 'sin_cambio' : 'cambia_zona'
}

function fmtMin(m: number | null): string {
  if (m === null) return '—'
  if (m === 0) return '0 (base)'
  const h = Math.floor(m / 60)
  const r = Math.round(m - h * 60)
  return h > 0 ? `${m.toFixed(0)} (${h} h ${r})` : `${m.toFixed(0)}`
}

function mdEscape(text: string): string {
  return text.replace(/\|/g, '\\|')
}

async function main() {
  console.log('Fase 1 · simulación de activación de zonas (solo lectura)')

  // (a) Estado actual
  const [kams, hospitals, current] = await Promise.all([
    selectAll<KamRow>('kams', 'id, name, area_id, active'),
    selectAll<HospitalRow>(
      'hospitals',
      'id, code, name, department_id, municipality_id, locality_id, municipality_name, department_name, locality_name',
      q => q.eq('active', true)
    ),
    selectAll<AssignmentRow>('assignments', 'hospital_id, kam_id, travel_time, assignment_type'),
  ])
  console.log(`Leídos: ${kams.length} zonas (kams), ${hospitals.length} IPS activas, ${current.length} asignaciones actuales`)

  const kamName = new Map(kams.map(k => [k.id, k.name]))
  const hospitalById = new Map(hospitals.map(h => [h.id, h]))
  const zoneName = (id: string | null | undefined) => (id ? kamName.get(id) ?? `¿${id}?` : null)

  // (b) Algoritmo: recálculo hoy sin cambios (línea base) y con el escenario
  console.log('Calculando línea base (algoritmo sin overrides)...')
  const baseline = await runInMemory()
  console.log('Calculando escenario (Cartagena + Ibagué activas, sin los MD)...')
  const simulated = await runInMemory(SCENARIO)

  const currentMap = toSlotMap(current)
  const baselineMap = toSlotMap(baseline)
  const simulatedMap = toSlotMap(simulated)

  // (c) Diff por hospital: BD actual -> escenario
  const allIds = new Set<string>([...currentMap.keys(), ...simulatedMap.keys(), ...baselineMap.keys()])
  const changes: Change[] = []
  const counts: Record<ChangeKind, number> = { sin_cambio: 0, cambia_zona: 0, nueva: 0, pierde: 0 }
  const scenarioOnly: Change[] = [] // cambios línea base -> escenario (efecto puro del escenario)

  const buildChange = (id: string, kind: Exclude<ChangeKind, 'sin_cambio'>, before?: Slot, after?: Slot, caused = false): Change => {
    const h = hospitalById.get(id)
    return {
      hospital_id: id,
      code: h?.code ?? '',
      name: h?.name ?? `(IPS ${id} no activa)`,
      municipality: h ? (h.locality_name ? `${h.municipality_name ?? ''} · ${h.locality_name}` : h.municipality_name ?? '') : '',
      department: h?.department_name ?? '',
      kind,
      from_zone: zoneName(before?.kam_id),
      from_minutes: before?.minutes ?? null,
      from_type: before?.type ?? null,
      to_zone: zoneName(after?.kam_id),
      to_minutes: after?.minutes ?? null,
      to_type: after?.type ?? null,
      caused_by_scenario: caused,
    }
  }

  for (const id of allIds) {
    const before = currentMap.get(id)
    const after = simulatedMap.get(id)
    const kind = classify(before, after)
    counts[kind]++
    const scenarioKind = classify(baselineMap.get(id), after)
    if (scenarioKind !== 'sin_cambio') {
      scenarioOnly.push(buildChange(id, scenarioKind, baselineMap.get(id), after, true))
    }
    if (kind !== 'sin_cambio') {
      changes.push(buildChange(id, kind, before, after, scenarioKind !== 'sin_cambio'))
    }
  }

  const sortChanges = (list: Change[]) =>
    list.sort(
      (a, b) =>
        (a.to_zone ?? '').localeCompare(b.to_zone ?? '') ||
        (a.from_zone ?? '').localeCompare(b.from_zone ?? '') ||
        a.municipality.localeCompare(b.municipality) ||
        a.name.localeCompare(b.name)
    )
  sortChanges(changes)
  sortChanges(scenarioOnly)

  // (d) Resumen por zona: IPS antes (BD) / recálculo hoy / después (escenario)
  const countBy = (map: Map<string, Slot>) => {
    const c = new Map<string, number>()
    for (const slot of map.values()) c.set(slot.kam_id, (c.get(slot.kam_id) ?? 0) + 1)
    return c
  }
  const cCurrent = countBy(currentMap)
  const cBaseline = countBy(baselineMap)
  const cSim = countBy(simulatedMap)
  const zoneIds = new Set<string>([...cCurrent.keys(), ...cBaseline.keys(), ...cSim.keys()])
  const summary = [...zoneIds]
    .map(id => ({
      kam_id: id,
      zone: zoneName(id) ?? id,
      before: cCurrent.get(id) ?? 0,
      baseline: cBaseline.get(id) ?? 0,
      after: cSim.get(id) ?? 0,
    }))
    .map(r => ({ ...r, delta: r.after - r.before }))
    .sort((a, b) => a.zone.localeCompare(b.zone))

  // Agregados para el informe
  const cartagenaId = kams.find(k => k.area_id === '13001')?.id
  const ibagueId = kams.find(k => k.area_id === '73001')?.id
  const newZoneIds = new Set([cartagenaId, ibagueId].filter((x): x is string => !!x))
  const toCartagena = changes.filter(c => c.kind !== 'pierde' && simulatedMap.get(c.hospital_id)?.kam_id === cartagenaId)
  const toIbague = changes.filter(c => c.kind !== 'pierde' && simulatedMap.get(c.hospital_id)?.kam_id === ibagueId)
  const otherMoves = changes.filter(c => !newZoneIds.has(simulatedMap.get(c.hospital_id)?.kam_id ?? ''))
  const otherMovesFromScenario = scenarioOnly.filter(c => !newZoneIds.has(simulatedMap.get(c.hospital_id)?.kam_id ?? ''))

  const fromBreakdown = (list: Change[]) => {
    const m = new Map<string, number>()
    for (const c of list) m.set(c.from_zone ?? '(sin asignar)', (m.get(c.from_zone ?? '(sin asignar)') ?? 0) + 1)
    return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]))
  }

  const result = {
    generated_at: new Date().toISOString(),
    scenario: SCENARIO,
    note:
      'Solo lectura. "before" = tabla assignments actual; "baseline" = algoritmo recalculado hoy sin cambios; ' +
      '"after" = algoritmo con el escenario. Minutos = travel_time (segundos) / 60.',
    totals: {
      active_hospitals: hospitals.length,
      assigned_before: currentMap.size,
      assigned_baseline: baselineMap.size,
      assigned_after: simulatedMap.size,
      ...counts,
      total_changes: changes.length,
      changes_caused_by_scenario: changes.filter(c => c.caused_by_scenario).length,
      changes_from_drift: changes.filter(c => !c.caused_by_scenario).length,
      to_cartagena: toCartagena.length,
      to_ibague: toIbague.length,
      to_cartagena_from: fromBreakdown(toCartagena),
      to_ibague_from: fromBreakdown(toIbague),
      other_moves: otherMoves.length,
      other_moves_caused_by_scenario: otherMovesFromScenario.length,
    },
    summary_by_zone: summary,
    changes,
    scenario_only_changes: scenarioOnly,
  }

  // (e) Salidas
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8')

  const lines: string[] = []
  lines.push('# Fase 1 · Simulación de activación de zonas')
  lines.push('')
  lines.push(`Generado: ${result.generated_at}. Solo lectura, no se escribió nada en Supabase.`)
  lines.push('')
  lines.push('Escenario: activar Cartagena (13001) e Ibagué (73001) y quitar `KAM Barranquilla MD` y `Kam Valledupar MD`.')
  lines.push('')
  lines.push('- **Antes** es la tabla `assignments` actual.')
  lines.push('- **Recálculo hoy** es el mismo algoritmo sin cambios, para separar el efecto del escenario de la deriva de datos.')
  lines.push('- **Después** es el algoritmo con el escenario.')
  lines.push('')
  lines.push('## Totales')
  lines.push('')
  lines.push(`- IPS activas: ${hospitals.length}. Asignadas antes ${currentMap.size}, recálculo hoy ${baselineMap.size}, después ${simulatedMap.size}.`)
  lines.push(`- Cambios BD → escenario: **${changes.length}** (cambian de zona ${counts.cambia_zona}, nuevas ${counts.nueva}, pierden asignación ${counts.pierde}).`)
  lines.push(`- De ellos, ${result.totals.changes_caused_by_scenario} los causa el escenario y ${result.totals.changes_from_drift} son deriva (también cambiarían con un recálculo hoy sin tocar nada).`)
  lines.push(`- Pasan a Cartagena: **${toCartagena.length}** (${Object.entries(result.totals.to_cartagena_from).map(([z, n]) => `${n} desde ${z}`).join(', ') || '—'}).`)
  lines.push(`- Pasan a Ibagué: **${toIbague.length}** (${Object.entries(result.totals.to_ibague_from).map(([z, n]) => `${n} desde ${z}`).join(', ') || '—'}).`)
  lines.push(`- Movimientos entre otras zonas: ${otherMoves.length} frente a la BD, ${otherMovesFromScenario.length} atribuibles al escenario.`)
  lines.push('')
  lines.push('## Resumen por zona')
  lines.push('')
  lines.push('| Zona | Antes (BD) | Recálculo hoy | Después | Δ vs BD |')
  lines.push('| --- | ---: | ---: | ---: | ---: |')
  for (const r of summary) {
    lines.push(`| ${mdEscape(r.zone)} | ${r.before} | ${r.baseline} | ${r.after} | ${r.delta > 0 ? '+' : ''}${r.delta} |`)
  }
  lines.push('')

  const renderTable = (title: string, list: Change[]) => {
    lines.push(`## ${title} (${list.length})`)
    lines.push('')
    if (list.length === 0) {
      lines.push('Ninguno.')
      lines.push('')
      return
    }
    lines.push('| IPS | Municipio | Depto | Tipo | Zona anterior | Min. anterior | Zona nueva | Min. nueva | Por escenario |')
    lines.push('| --- | --- | --- | --- | --- | ---: | --- | ---: | :---: |')
    for (const c of list) {
      lines.push(
        `| ${mdEscape(c.name)} | ${mdEscape(c.municipality)} | ${mdEscape(c.department)} | ${c.kind} | ${mdEscape(c.from_zone ?? '—')} | ${fmtMin(c.from_minutes)} | ${mdEscape(c.to_zone ?? '—')} | ${fmtMin(c.to_minutes)} | ${c.caused_by_scenario ? 'sí' : 'no'} |`
      )
    }
    lines.push('')
  }
  renderTable('Cambios BD actual → escenario', changes)
  renderTable('Cambios atribuibles solo al escenario (recálculo hoy → escenario)', scenarioOnly)

  fs.writeFileSync(OUTPUT_MD, lines.join('\n'), 'utf8')

  console.log('\nResumen:')
  console.log(JSON.stringify(result.totals, null, 2))
  console.log(`\nEscrito: ${OUTPUT_MD}`)
  console.log(`Escrito: ${OUTPUT_JSON}`)
}

main().catch(err => {
  console.error('La simulación falló:', err instanceof Error ? err.message : err)
  process.exit(1)
})
