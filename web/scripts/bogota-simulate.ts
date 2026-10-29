/**
 * Bogotá como UNA ciudad hacia afuera, con reparto por corredor · simulación (SOLO LECTURA).
 * Spec: docs/specs/2026-10-11-bogota-corredores.md
 *
 * Compara la asignación actual (tabla assignments) con:
 *  - "Recálculo hoy": el mismo algoritmo SIN la regla (cada celda compite sola con su tope), para
 *    separar el efecto de la regla de la deriva de datos;
 *  - "Nueva regla": Bogotá compite como una ciudad con tope único (--tope, 240 por defecto) y la celda
 *    se decide por corredor con k celdas (--k, 4 por defecto).
 *
 * Corredores: los de la tabla bogota_corredores si existe y tiene filas; si no, la semilla de
 * lib/bogota-corredores.ts (la misma de la migración). Grupos: los de bogota_config si existe con el
 * mismo k y son válidos; si no, los grupos por defecto para k.
 *
 * Garantía de solo lectura: solo .select() de Supabase y SimplifiedOpMapAlgorithm.loadData() /
 * calculateAssignments(), que no escriben. NUNCA llama a saveAssignments ni a runSimplifiedAlgorithm.
 * No usa Google Maps (solo hospital_kam_distances).
 *
 * Uso (desde web/): npx tsx scripts/bogota-simulate.ts [--tope 240] [--k 4]
 * Salida: <scratchpad>/bogota-simulacion.md y .json (BOGOTA_SIM_OUTPUT_DIR para cambiar la carpeta).
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabase-admin'
import {
  SimplifiedOpMapAlgorithm,
  bogotaVirtualCandidate,
  eligibleKamsForHospital,
  isBogotaKam,
  loadBogotaRule,
  type AdjacencyMatrix,
  type Assignment,
  type BogotaRuleInput,
} from '../lib/opmap-algorithm-simplified'
import {
  CORREDOR_LABEL,
  SEMILLA_CORREDORES,
  celdaParaCorredor,
  gruposPorDefecto,
  isBogotaK,
  resolveCorredor,
  validarGrupos,
  type BogotaK,
  type Corredor,
} from '../lib/bogota-corredores'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const OUTPUT_DIR =
  process.env.BOGOTA_SIM_OUTPUT_DIR ||
  '/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad'
const OUTPUT_MD = path.join(OUTPUT_DIR, 'bogota-simulacion.md')
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'bogota-simulacion.json')

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  if (!Number.isFinite(value)) throw new Error(`--${name} necesita un número`)
  return value
}

interface KamRow {
  id: string
  name: string
  area_id: string
  active: boolean
  participates_in_assignment: boolean | null
  max_travel_time: number
  priority: number
  enable_level2: boolean
}

interface HospitalRow {
  id: string
  code: string
  name: string
  department_id: string
  municipality_id: string
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

interface DistanceRow {
  hospital_id: string
  kam_id: string
  travel_time: number // SEGUNDOS
}

interface ForcedRow {
  territory_id: string
  territory_name: string
  kam_id: string
  active: boolean
}

interface Slot {
  kam_id: string
  seconds: number | null
  type: string | null
}

const PAGE = 1000

async function selectAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const supabase = getSupabaseAdmin()
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE - 1)
    if (filter) query = filter(query)
    const { data, error } = await query
    if (error) throw new Error(`Error leyendo ${table}: ${error.message}`)
    const batch = (data || []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function runInMemory(bogota: BogotaRuleInput | null): Promise<Assignment[]> {
  const algorithm = new SimplifiedOpMapAlgorithm()
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  try {
    await algorithm.loadData({ bogota })
    return await algorithm.calculateAssignments()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
  }
}

const toSlotMap = (list: Array<{ hospital_id: string; kam_id: string; travel_time: number | null; assignment_type: string | null }>) =>
  new Map<string, Slot>(list.map(a => [a.hospital_id, { kam_id: a.kam_id, seconds: a.travel_time, type: a.assignment_type }]))

function fmtMin(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const m = seconds / 60
  if (m === 0) return '0 (base)'
  const h = Math.floor(m / 60)
  const r = Math.round(m - h * 60)
  return h > 0 ? `${Math.round(m)} (${h} h ${String(r).padStart(2, '0')})` : `${Math.round(m)}`
}

const md = (text: string | null | undefined) => (text ?? '').replace(/\|/g, '\\|')

async function main() {
  const tope = argValue('tope', 240)
  const kArg = argValue('k', 4)
  if (!isBogotaK(kArg)) throw new Error('--k debe ser 1, 2, 3 o 4')
  const k: BogotaK = kArg
  console.log(`Bogotá como una ciudad · simulación (solo lectura): tope ${tope} min, k = ${k}`)

  const [kams, hospitals, current, forced, adjacencyRows, excludedRows] = await Promise.all([
    selectAll<KamRow>('kams', 'id, name, area_id, active, participates_in_assignment, max_travel_time, priority, enable_level2'),
    selectAll<HospitalRow>(
      'hospitals',
      'id, code, name, department_id, municipality_id, locality_id, municipality_name, department_name, locality_name',
      q => q.eq('active', true)
    ),
    selectAll<AssignmentRow>('assignments', 'hospital_id, kam_id, travel_time, assignment_type'),
    selectAll<ForcedRow>('forced_assignments', 'territory_id, territory_name, kam_id, active', q => q.eq('active', true)),
    selectAll<{ department_code: string; adjacent_department_code: string }>('department_adjacency', 'department_code, adjacent_department_code'),
    selectAll<{ code: string }>('departments', 'code', q => q.eq('excluded', true)),
  ])
  const activeKams = kams.filter(z => z.active && z.participates_in_assignment)
  const cells = activeKams.filter(z => isBogotaKam(z)).sort((a, b) => a.name.localeCompare(b.name))
  const cellIds = new Set(cells.map(c => c.id))
  const adjacency: AdjacencyMatrix = {}
  for (const row of adjacencyRows) {
    if (!adjacency[row.department_code]) adjacency[row.department_code] = []
    adjacency[row.department_code].push(row.adjacent_department_code)
  }
  const excluded = new Set(excludedRows.map(r => r.code))

  // Regla a simular
  const enBase = await loadBogotaRule()
  const corredores = enBase.rule?.corredores.length ? enBase.rule.corredores : SEMILLA_CORREDORES
  const fuenteCorredores = enBase.rule?.corredores.length ? 'tabla bogota_corredores' : 'semilla de lib/bogota-corredores.ts (la tabla no existe o está vacía)'
  const gruposBase = enBase.rule && enBase.rule.config.k === k && validarGrupos(k, enBase.rule.config.grupos).length === 0 ? enBase.rule.config.grupos : null
  const grupos = gruposBase ?? gruposPorDefecto(k, cells)
  if (!grupos) throw new Error('Faltan celdas base de Bogotá activas (1100102, 1100110, 1100108, 1100104) para los grupos por defecto')
  const rule: BogotaRuleInput = { config: { k, max_travel_minutes: tope, grupos }, corredores }
  const kamName = new Map(kams.map(z => [z.id, z.name]))
  const zoneName = (id: string | null | undefined) => (id ? kamName.get(id) ?? `¿${id}?` : null)

  console.log(`Leídos: ${activeKams.length} zonas activas (${cells.length} celdas de Bogotá), ${hospitals.length} IPS activas, ${current.length} asignaciones actuales`)
  console.log(`Configuración en base: ${enBase.status}. Corredores: ${fuenteCorredores} (${corredores.length} filas)`)

  console.log('Calculando recálculo hoy (sin la regla)...')
  const legacy = await runInMemory(null)
  console.log('Calculando nueva regla...')
  const nueva = await runInMemory(rule)

  // Distancias a las celdas (diagnóstico: mejor tiempo de Bogotá por IPS)
  const cellList = [...cellIds]
  const cellDistances = await selectAll<DistanceRow>('hospital_kam_distances', 'hospital_id, kam_id, travel_time', q => q.in('kam_id', cellList))
  const secondsByPair = new Map<string, number>()
  for (const d of cellDistances) {
    const key = `${d.hospital_id}|${d.kam_id}`
    if (!secondsByPair.has(key)) secondsByPair.set(key, d.travel_time)
  }

  const bdMap = toSlotMap(current)
  const legacyMap = toSlotMap(legacy)
  const nuevaMap = toSlotMap(nueva)
  const nuevaDetail = new Map(nueva.filter(a => a.detail).map(a => [a.hospital_id, a.detail!]))
  const hospitalById = new Map(hospitals.map(h => [h.id, h]))
  const place = (h: HospitalRow | undefined) =>
    h ? (h.locality_name ? `${h.municipality_name ?? ''} · ${h.locality_name}` : h.municipality_name ?? h.municipality_id) : ''

  // Diagnóstico Bogotá por IPS de fuera
  const bogotaInfo = (h: HospitalRow) => {
    if (h.department_id === '11' || excluded.has(h.department_id)) return null
    const eligibleCells = eligibleKamsForHospital(activeKams, h, adjacency).filter(z => cellIds.has(z.id))
    if (eligibleCells.length === 0) return null
    const virtual = bogotaVirtualCandidate(
      eligibleCells.map(z => ({ kam_id: z.id, priority: z.priority, seconds: secondsByPair.get(`${h.id}|${z.id}`) ?? null })),
      tope
    )
    const corredor = resolveCorredor(h.municipality_id, h.department_id, corredores)
    return { virtual, corredor, celdaCorredor: corredor ? celdaParaCorredor(corredor, rule.config) : null }
  }

  // (1) Resumen por celda y por zona
  const countBy = (map: Map<string, Slot>) => {
    const c = new Map<string, number>()
    for (const slot of map.values()) c.set(slot.kam_id, (c.get(slot.kam_id) ?? 0) + 1)
    return c
  }
  const cBd = countBy(bdMap)
  const cLegacy = countBy(legacyMap)
  const cNueva = countBy(nuevaMap)
  const typeCount = (kamId: string, type: string) => nueva.filter(a => a.kam_id === kamId && a.assignment_type === type).length
  const porCelda = cells.map(c => ({
    celda: c.name,
    area_id: c.area_id,
    tope_actual: c.max_travel_time,
    corredores: (Object.keys(grupos) as Corredor[]).filter(cor => grupos[cor] === c.id).map(cor => CORREDOR_LABEL[cor]),
    bd: cBd.get(c.id) ?? 0,
    recalculo_hoy: cLegacy.get(c.id) ?? 0,
    nueva: cNueva.get(c.id) ?? 0,
    nueva_base: typeCount(c.id, 'base_territory'),
    nueva_bogota_interna: typeCount(c.id, 'competitive') + typeCount(c.id, 'majority_rule'),
    // bogota_corredor incluye las IPS de Bogotá asignadas por el sector de su localidad (detail.localidad, 2026-10-28)
    nueva_corredor: typeCount(c.id, 'bogota_corredor'),
    nueva_forzadas: typeCount(c.id, 'forced'),
  }))
  const zoneIds = new Set<string>([...cBd.keys(), ...cLegacy.keys(), ...cNueva.keys()])
  const porZona = [...zoneIds]
    .map(id => ({ zona: zoneName(id) ?? id, celda: cellIds.has(id), bd: cBd.get(id) ?? 0, recalculo_hoy: cLegacy.get(id) ?? 0, nueva: cNueva.get(id) ?? 0 }))
    .sort((a, b) => a.zona.localeCompare(b.zona))

  // (2) IPS que cambian de celda / entran o salen de Bogotá (BD -> nueva regla)
  type Movimiento = {
    ips: string
    codigo: string
    municipio: string
    departamento: string
    tipo: 'entre_celdas' | 'bogota_a_otra_zona' | 'otra_zona_a_bogota' | 'bogota_a_sin_zona' | 'sin_zona_a_bogota'
    de: string | null
    min_de: string
    a: string | null
    min_a: string
    corredor: string
    bogota_min: string
    por_la_regla: boolean
  }
  const movimientos: Movimiento[] = []
  const allIds = new Set<string>([...bdMap.keys(), ...nuevaMap.keys()])
  for (const id of allIds) {
    const before = bdMap.get(id)
    const after = nuevaMap.get(id)
    if (before?.kam_id === after?.kam_id) continue
    const bIn = before ? cellIds.has(before.kam_id) : false
    const aIn = after ? cellIds.has(after.kam_id) : false
    if (!bIn && !aIn) continue
    const tipo: Movimiento['tipo'] =
      bIn && aIn ? 'entre_celdas' : bIn && after ? 'bogota_a_otra_zona' : bIn ? 'bogota_a_sin_zona' : before ? 'otra_zona_a_bogota' : 'sin_zona_a_bogota'
    const h = hospitalById.get(id)
    const info = h ? bogotaInfo(h) : null
    const detail = nuevaDetail.get(id)
    const corredor = detail ? detail.corredor : info?.corredor ?? null
    movimientos.push({
      ips: h?.name ?? `(IPS ${id} no activa)`,
      codigo: h?.code ?? '',
      municipio: place(h),
      departamento: h?.department_name ?? '',
      tipo,
      de: zoneName(before?.kam_id),
      min_de: fmtMin(before?.seconds),
      a: zoneName(after?.kam_id),
      min_a: fmtMin(after?.seconds),
      corredor: corredor ? CORREDOR_LABEL[corredor] : '(sin corredor)',
      bogota_min: fmtMin((detail && 'bogota_min_segundos' in detail ? detail.bogota_min_segundos : null) ?? info?.virtual?.min_seconds ?? null),
      por_la_regla: legacyMap.get(id)?.kam_id !== after?.kam_id,
    })
  }
  const orden: Movimiento['tipo'][] = ['entre_celdas', 'bogota_a_otra_zona', 'bogota_a_sin_zona', 'otra_zona_a_bogota', 'sin_zona_a_bogota']
  movimientos.sort((x, y) => orden.indexOf(x.tipo) - orden.indexOf(y.tipo) || (x.de ?? '').localeCompare(y.de ?? '') || (x.a ?? '').localeCompare(y.a ?? '') || x.municipio.localeCompare(y.municipio) || x.ips.localeCompare(y.ips))

  // (3) IPS que quedan fuera de alcance al unificar el tope (asignadas en la BD o en el recálculo de hoy, sin zona con la regla)
  const fueraDeAlcance = [...new Set([...bdMap.keys(), ...legacyMap.keys()])]
    .filter(id => !nuevaMap.has(id) && hospitalById.has(id))
    .map(id => {
      const h = hospitalById.get(id)!
      const info = bogotaInfo(h)
      return {
        ips: h.name,
        codigo: h.code,
        municipio: place(h),
        departamento: h.department_name ?? '',
        zona_bd: zoneName(bdMap.get(id)?.kam_id) ?? '(sin zona)',
        min_bd: fmtMin(bdMap.get(id)?.seconds),
        zona_recalculo_hoy: zoneName(legacyMap.get(id)?.kam_id) ?? '(sin zona)',
        bogota_min: fmtMin(info?.virtual?.min_seconds ?? null),
        celda_min: zoneName(info?.virtual?.celda_min) ?? '—',
        corredor: info?.corredor ? CORREDOR_LABEL[info.corredor] : '(sin corredor)',
      }
    })
    .sort((x, y) => x.zona_bd.localeCompare(y.zona_bd) || x.municipio.localeCompare(y.municipio) || x.ips.localeCompare(y.ips))

  // (4) Forzadas (sin tocar)
  const forzadasNueva = nueva.filter(a => a.assignment_type === 'forced')
  const forzadas = forced
    .map(f => {
      const ips = forzadasNueva.filter(a => {
        const h = hospitalById.get(a.hospital_id)
        return h && (h.locality_id || h.municipality_id) === f.territory_id
      })
      const secs = ips.map(a => a.travel_time).filter((s): s is number => s !== null)
      const h0 = ips.length ? hospitalById.get(ips[0].hospital_id) : undefined
      const corredor = h0 ? resolveCorredor(h0.municipality_id, h0.department_id, corredores) : resolveCorredor(f.territory_id, f.territory_id.substring(0, 2), corredores)
      return {
        territorio: `${f.territory_name} (${f.territory_id})`,
        municipio_ips: h0?.municipality_name ?? '—',
        zona_forzada: zoneName(f.kam_id) ?? f.kam_id,
        ips: ips.length,
        ips_bd: current.filter(a => a.assignment_type === 'forced' && (hospitalById.get(a.hospital_id)?.locality_id || hospitalById.get(a.hospital_id)?.municipality_id) === f.territory_id).length,
        minutos: secs.length ? `${fmtMin(Math.min(...secs))} – ${fmtMin(Math.max(...secs))}` : '—',
        corredor: corredor ? CORREDOR_LABEL[corredor] : '(sin corredor)',
        celda_por_corredor: corredor ? zoneName(celdaParaCorredor(corredor, rule.config)) ?? '—' : '—',
        dentro_del_tope: secs.length ? secs.every(s => s / 60 <= tope) : false,
      }
    })
    .sort((x, y) => x.territorio.localeCompare(y.territorio))

  // (5) Municipios sin corredor (IPS de fuera de Bogotá donde Bogotá es elegible)
  const sinCorredor = new Map<string, { municipio: string; departamento: string; ips: number; ganadas_por_bogota: number }>()
  for (const h of hospitals) {
    const info = bogotaInfo(h)
    if (!info || info.corredor) continue
    const key = h.municipality_id
    const row = sinCorredor.get(key) ?? { municipio: `${h.municipality_name ?? ''} (${h.municipality_id})`, departamento: h.department_name ?? h.department_id, ips: 0, ganadas_por_bogota: 0 }
    row.ips++
    if (nuevaMap.get(h.id)?.type === 'bogota_corredor') row.ganadas_por_bogota++
    sinCorredor.set(key, row)
  }
  const sinCorredorList = [...sinCorredor.values()].sort((a, b) => a.departamento.localeCompare(b.departamento) || a.municipio.localeCompare(b.municipio))

  // Reparto del cupo Bogotá por corredor y celda (solo IPS de fuera: las de dentro van por sector, detail.localidad)
  const deFuera = (a: (typeof nueva)[number]) => a.assignment_type === 'bogota_corredor' && !(a.detail && 'localidad' in a.detail)
  const cupo = new Map<string, number>()
  for (const a of nueva) {
    if (!deFuera(a)) continue
    const key = `${a.detail?.corredor ? CORREDOR_LABEL[a.detail.corredor] : '(sin corredor)'} -> ${zoneName(a.kam_id)}`
    cupo.set(key, (cupo.get(key) ?? 0) + 1)
  }
  const corredorDistintoDeMin = nueva.filter(a => a.assignment_type === 'bogota_corredor' && a.detail && 'celda_min' in a.detail && a.detail.celda_min !== a.kam_id).length

  const count = (t: Movimiento['tipo']) => movimientos.filter(m => m.tipo === t).length
  const totals = {
    ips_activas: hospitals.length,
    asignadas_bd: bdMap.size,
    asignadas_recalculo_hoy: legacyMap.size,
    asignadas_nueva: nuevaMap.size,
    cupo_bogota: nueva.filter(deFuera).length,
    bogota_por_sector: nueva.filter(a => a.assignment_type === 'bogota_corredor' && !deFuera(a)).length,
    cupo_bogota_en_celda_distinta_a_la_mas_cercana: corredorDistintoDeMin,
    movimientos_bogota: movimientos.length,
    entre_celdas: count('entre_celdas'),
    bogota_a_otra_zona: count('bogota_a_otra_zona'),
    bogota_a_sin_zona: count('bogota_a_sin_zona'),
    otra_zona_a_bogota: count('otra_zona_a_bogota'),
    sin_zona_a_bogota: count('sin_zona_a_bogota'),
    movimientos_por_la_regla: movimientos.filter(m => m.por_la_regla).length,
    fuera_de_alcance_al_unificar: fueraDeAlcance.length,
    forzadas_territorios: forzadas.length,
    forzadas_ips: forzadasNueva.length,
    municipios_sin_corredor: sinCorredorList.length,
    ips_sin_corredor_ganadas_por_bogota: sinCorredorList.reduce((s, r) => s + r.ganadas_por_bogota, 0),
  }

  const result = {
    generated_at: new Date().toISOString(),
    parametros: { tope_minutos: tope, k, grupos: Object.fromEntries(Object.entries(grupos).map(([c, id]) => [c, zoneName(id)])), fuente_corredores: fuenteCorredores, configuracion_en_base: enBase.status, fuente_grupos: gruposBase ? 'bogota_config' : `por defecto para k = ${k}` },
    totals,
    por_celda: porCelda,
    por_zona: porZona,
    cupo_bogota_por_corredor: Object.fromEntries([...cupo.entries()].sort()),
    movimientos,
    fuera_de_alcance: fueraDeAlcance,
    forzadas,
    municipios_sin_corredor: sinCorredorList,
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8')

  const L: string[] = []
  L.push('# Bogotá como una ciudad · simulación (solo lectura)')
  L.push('')
  L.push(`Generado: ${result.generated_at}. No se escribió nada en Supabase ni se llamó a Google.`)
  L.push('')
  L.push(`- Tope único de Bogotá hacia afuera: **${tope} min** (se ignora \`kams.max_travel_time\` de las celdas; las demás zonas conservan el suyo).`)
  L.push(`- k = **${k}**; grupos (${result.parametros.fuente_grupos}): ${Object.entries(result.parametros.grupos).map(([c, z]) => `${CORREDOR_LABEL[c as Corredor]} → ${z}`).join(', ')}.`)
  L.push(`- Corredores: ${fuenteCorredores} (${corredores.length} filas). Configuración en base: \`${enBase.status}\`.`)
  L.push('- **BD** = tabla `assignments` actual; **Recálculo hoy** = algoritmo sin la regla (cada celda con su tope); **Nueva** = algoritmo con la regla.')
  L.push('')
  L.push('## Totales')
  L.push('')
  L.push(`- IPS activas: ${totals.ips_activas}. Asignadas: BD ${totals.asignadas_bd}, recálculo hoy ${totals.asignadas_recalculo_hoy}, nueva regla ${totals.asignadas_nueva}.`)
  L.push(`- Cupo Bogotá (IPS de fuera que gana "Bogotá"): **${totals.cupo_bogota}**; de ellas ${totals.cupo_bogota_en_celda_distinta_a_la_mas_cercana} van a una celda distinta de la más cercana por el corredor.`)
  L.push(`- IPS que cambian de celda o entran/salen de Bogotá (BD → nueva): **${totals.movimientos_bogota}** — entre celdas ${totals.entre_celdas}, de Bogotá a otra zona ${totals.bogota_a_otra_zona}, de Bogotá a sin zona ${totals.bogota_a_sin_zona}, de otra zona a Bogotá ${totals.otra_zona_a_bogota}, de sin zona a Bogotá ${totals.sin_zona_a_bogota}. Atribuibles a la regla (distintos del recálculo hoy): ${totals.movimientos_por_la_regla}.`)
  L.push(`- IPS que quedan **fuera de alcance** al unificar el tope: **${totals.fuera_de_alcance_al_unificar}**.`)
  L.push(`- Forzadas (sin tocar): ${totals.forzadas_territorios} territorios, ${totals.forzadas_ips} IPS.`)
  L.push(`- Municipios sin corredor (Bogotá elegible): ${totals.municipios_sin_corredor} (${totals.ips_sin_corredor_ganadas_por_bogota} IPS ganadas por Bogotá sin corredor).`)
  L.push('')
  L.push('## Por celda de Bogotá')
  L.push('')
  L.push('| Celda | area_id | Tope actual | Corredores | BD | Recálculo hoy | Nueva | Δ vs BD | Nueva: base | Nueva: localidades | Nueva: corredor | Nueva: forzadas |')
  L.push('| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const r of porCelda) {
    const d = r.nueva - r.bd
    L.push(`| ${md(r.celda)} | ${r.area_id} | ${r.tope_actual} | ${r.corredores.join(' + ') || '—'} | ${r.bd} | ${r.recalculo_hoy} | ${r.nueva} | ${d > 0 ? '+' : ''}${d} | ${r.nueva_base} | ${r.nueva_bogota_interna} | ${r.nueva_corredor} | ${r.nueva_forzadas} |`)
  }
  L.push('')
  L.push('## Cupo Bogotá por corredor → celda')
  L.push('')
  for (const [key, n] of Object.entries(result.cupo_bogota_por_corredor)) L.push(`- ${key}: ${n}`)
  if (cupo.size === 0) L.push('Ninguno.')
  L.push('')
  L.push('## Todas las zonas')
  L.push('')
  L.push('| Zona | BD | Recálculo hoy | Nueva | Δ vs BD |')
  L.push('| --- | ---: | ---: | ---: | ---: |')
  for (const r of porZona) {
    const d = r.nueva - r.bd
    L.push(`| ${md(r.zona)}${r.celda ? ' (celda)' : ''} | ${r.bd} | ${r.recalculo_hoy} | ${r.nueva} | ${d > 0 ? '+' : ''}${d} |`)
  }
  L.push('')
  L.push(`## IPS que cambian de celda o entran/salen de Bogotá (${movimientos.length})`)
  L.push('')
  if (movimientos.length === 0) L.push('Ninguna.')
  else {
    L.push('| IPS | Municipio | Depto | Movimiento | De | Min. antes | A | Min. después | Corredor | Mejor min. Bogotá | Por la regla |')
    L.push('| --- | --- | --- | --- | --- | ---: | --- | ---: | --- | ---: | :---: |')
    for (const m of movimientos) {
      L.push(`| ${md(m.ips)} | ${md(m.municipio)} | ${md(m.departamento)} | ${m.tipo.replace(/_/g, ' ')} | ${md(m.de ?? '(sin zona)')} | ${m.min_de} | ${md(m.a ?? '(sin zona)')} | ${m.min_a} | ${m.corredor} | ${m.bogota_min} | ${m.por_la_regla ? 'sí' : 'no'} |`)
    }
  }
  L.push('')
  L.push(`## IPS que quedan fuera de alcance al unificar el tope (${fueraDeAlcance.length})`)
  L.push('')
  if (fueraDeAlcance.length === 0) L.push('Ninguna.')
  else {
    L.push('| IPS | Municipio | Depto | Zona en BD | Min. en BD | Zona recálculo hoy | Mejor min. Bogotá | Celda más cercana | Corredor |')
    L.push('| --- | --- | --- | --- | ---: | --- | ---: | --- | --- |')
    for (const f of fueraDeAlcance) {
      L.push(`| ${md(f.ips)} | ${md(f.municipio)} | ${md(f.departamento)} | ${md(f.zona_bd)} | ${f.min_bd} | ${md(f.zona_recalculo_hoy)} | ${f.bogota_min} | ${md(f.celda_min)} | ${f.corredor} |`)
    }
  }
  L.push('')
  L.push(`## Asignaciones forzadas (se conservan sin tocar: ${forzadas.length} territorios)`)
  L.push('')
  L.push('| Territorio | Municipio de las IPS | Zona forzada | IPS (nueva / BD) | Minutos | Corredor | Celda por corredor | Dentro del tope |')
  L.push('| --- | --- | --- | ---: | --- | --- | --- | :---: |')
  for (const f of forzadas) {
    L.push(`| ${md(f.territorio)} | ${md(f.municipio_ips)} | ${md(f.zona_forzada)} | ${f.ips} / ${f.ips_bd} | ${f.minutos} | ${f.corredor} | ${md(f.celda_por_corredor)} | ${f.dentro_del_tope ? 'sí' : 'no'} |`)
  }
  L.push('')
  L.push(`## Municipios sin corredor (${sinCorredorList.length})`)
  L.push('')
  if (sinCorredorList.length === 0) L.push('Ninguno: todas las IPS de fuera de Bogotá donde Bogotá puede competir tienen corredor.')
  else {
    L.push('| Municipio | Departamento | IPS | Ganadas por Bogotá (celda más cercana) |')
    L.push('| --- | --- | ---: | ---: |')
    for (const r of sinCorredorList) L.push(`| ${md(r.municipio)} | ${md(r.departamento)} | ${r.ips} | ${r.ganadas_por_bogota} |`)
  }
  L.push('')
  fs.writeFileSync(OUTPUT_MD, L.join('\n'), 'utf8')

  console.log('\nResumen:')
  console.log(JSON.stringify({ parametros: result.parametros, totals, por_celda: porCelda.map(r => ({ celda: r.celda, bd: r.bd, recalculo_hoy: r.recalculo_hoy, nueva: r.nueva })) }, null, 2))
  console.log(`\nEscrito: ${OUTPUT_MD}`)
  console.log(`Escrito: ${OUTPUT_JSON}`)
}

main().catch(err => {
  console.error('La simulación falló:', err instanceof Error ? err.message : err)
  process.exit(1)
})
