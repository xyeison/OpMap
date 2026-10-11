/**
 * Fase 3 · Cruce de las IPS (hospitals) con las sedes del REPS (reps_sedes).
 *
 * Reglas: lib/reps-match.ts (matchHospitalsToReps). Resumen:
 *   - 1 sede con el NIT de la IPS → matched; varias → municipio de la IPS; varias en el municipio →
 *     nombre normalizado (mismo nombre único, o muy parecido con ventaja clara); si no → ambiguous;
 *     ninguna sede con ese NIT → unmatched.
 *   - Una sede solo puede ir a una IPS. Las IPS que ya tienen reps_code (vínculos previos o hechos a
 *     mano en la ficha) NO se tocan.
 *   - Las IPS DESVINCULADAS A MANO (su último hospital_history.changes.reps_link tiene
 *     after.reps_code = null y hoy no tienen reps_code) tampoco: no entran al cruce, no reservan sede
 *     y --apply no las vuelve a vincular ni les cambia el estado. Se listan aparte en el informe.
 *
 * Uso (desde web/):
 *   npx tsx scripts/reps-match.ts           → informe (SOLO LECTURA): REPS_OUTPUT_DIR/reps-match-report.md
 *   npx tsx scripts/reps-match.ts --apply   → además escribe en hospitals:
 *       matched:              reps_code, reps_match_status = 'matched', reps_matched_at = now()
 *       ambiguous / unmatched: solo reps_match_status (reps_code sigue NULL)
 *     Solo sobre filas con reps_code NULL (no pisa vínculos existentes). hospitals.nit es una columna
 *     generada (sale de code): no se escribe. Ojo: el disparador update_hospitals_updated_at cambia
 *     updated_at de cada IPS escrita (no afecta a la cola de pendientes, que usa hospital_history).
 * No llama a Google ni recalcula asignaciones.
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import {
  checkDigitFromCode,
  groupSedesByNit,
  manualUnlinksFromHistory,
  matchHospitalsToRepsStable,
  nameSimilarity,
  nitCheckDigit,
  nitFromCode,
  REPS_STATUS_LABELS,
  summarizeMatches,
  type RepsLinkHistoryRow,
  type RepsMatchResult,
  type RepsSedeLite,
} from '../lib/reps-match'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const OUTPUT_DIR =
  process.env.REPS_OUTPUT_DIR ||
  '/private/tmp/claude-501/-Users-yjxm-Documents-GitHub-OpMap/b96592bc-25ae-4af0-afb9-263556da1e56/scratchpad'
const OUTPUT_MD = path.join(OUTPUT_DIR, 'reps-match-report.md')
const WRITE_CONCURRENCY = 5

interface HospitalRow {
  id: string
  code: string | null
  name: string
  municipality_id: string | null
  municipality_name: string | null
  locality_name: string | null
  active: boolean | null
  reps_code: string | null
  reps_match_status: string | null
}

interface SedeRow extends RepsSedeLite {
  codigo_prestador: string
  municipio_sede_nombre: string | null
  direccion_sede: string | null
  fecha_corte: string | null
}

type Db = ReturnType<typeof import('../lib/supabase-admin').getSupabaseAdmin>

async function fetchAll<T>(db: Db, table: string, columns: string, order: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

const METHOD_LABELS: Record<string, string> = {
  unica_sede: 'El NIT tiene una sola sede',
  municipio: 'Varias sedes, una sola en el municipio',
  nombre_exacto: 'Varias en el municipio, una sola con el mismo nombre',
  nombre_similar: 'Varias en el municipio, nombre muy parecido',
  ya_vinculada: 'Ya estaba vinculada (no se toca)',
}

const md = (value: unknown) => String(value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim()

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) {
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/**
 * IPS cuya última acción sobre el vínculo REPS (hospital_history.changes.reps_link, escrita por
 * PATCH /api/hospitals/[id]/reps-link y por PUT /api/hospitals/[id]) fue desvincular a mano.
 */
async function loadManualUnlinks(db: Db): Promise<Map<string, string>> {
  const rows: RepsLinkHistoryRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('hospital_history')
      .select('hospital_id, created_at, reason, changes')
      // Todas las filas con changes.reps_link son action 'edited'; el filtro fino lo hace la regla pura
      .eq('action', 'edited')
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(`hospital_history: ${error.message}`)
    rows.push(...((data ?? []) as RepsLinkHistoryRow[]))
    if (!data || data.length < 1000) break
  }
  return manualUnlinksFromHistory(rows)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const unknown = process.argv.slice(2).filter(arg => arg !== '--apply')
  if (unknown.length > 0) throw new Error(`Argumento desconocido: ${unknown.join(' ')}`)

  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()

  const hospitals = await fetchAll<HospitalRow>(
    db,
    'hospitals',
    'id, code, name, municipality_id, municipality_name, locality_name, active, reps_code, reps_match_status',
    'id'
  )
  const sedes = await fetchAll<SedeRow>(
    db,
    'reps_sedes',
    'codigo_habilitacion, codigo_prestador, nit, nombre_sede, municipio_sede, municipio_sede_nombre, direccion_sede, fecha_corte',
    'codigo_habilitacion'
  )
  if (sedes.length === 0) throw new Error('reps_sedes está vacía: correr antes scripts/reps-load-sedes.ts')

  const sedeByCode = new Map(sedes.map(sede => [sede.codigo_habilitacion, sede]))
  const sedesByNit = groupSedesByNit(sedes)
  // Desvinculadas a mano: se respetan (no entran al cruce ni a --apply)
  const manualUnlinks = await loadManualUnlinks(db)
  const manualUnlinked = hospitals.filter(h => !h.reps_code && manualUnlinks.has(h.id))
  const manualUnlinkedIds = new Set(manualUnlinked.map(h => h.id))
  // Varias vueltas: lo que se vincula en una vuelta deja de competir en la siguiente (ver lib)
  const results = matchHospitalsToRepsStable(hospitals.filter(h => !manualUnlinkedIds.has(h.id)), sedesByNit)
  const rounds = Math.max(...results.map(result => result.round))
  const summary = summarizeMatches(results)
  const hospitalById = new Map(hospitals.map(hospital => [hospital.id, hospital]))

  // Diagnósticos adicionales
  const cuts = new Map<string, number>()
  for (const sede of sedes) cuts.set(String(sede.fecha_corte), (cuts.get(String(sede.fecha_corte)) ?? 0) + 1)
  const orphans = hospitals.filter(h => h.reps_code && !sedeByCode.has(h.reps_code))
  const dvMismatch = hospitals.filter(h => {
    const nit = nitFromCode(h.code)
    const dv = checkDigitFromCode(h.code)
    return nit !== null && dv !== null && nitCheckDigit(nit) !== dv
  })
  const nitCount = new Map<string, number>()
  for (const h of hospitals) {
    const nit = nitFromCode(h.code)
    if (nit) nitCount.set(nit, (nitCount.get(nit) ?? 0) + 1)
  }
  const sedesByMunicipality = new Map<string, SedeRow[]>()
  for (const sede of sedes) {
    const list = sedesByMunicipality.get(sede.municipio_sede)
    if (list) list.push(sede)
    else sedesByMunicipality.set(sede.municipio_sede, [sede])
  }
  /** Para las sin cruce: sede del mismo municipio con nombre muy parecido (otro NIT). Solo sugerencia. */
  const possibleOtherNit = (hospital: HospitalRow) => {
    const pool = sedesByMunicipality.get(hospital.municipality_id ?? '') ?? []
    let best: { sede: SedeRow; score: number } | null = null
    for (const sede of pool) {
      const score = nameSimilarity(hospital.name, sede.nombre_sede)
      if (score >= 0.8 && (!best || score > best.score)) best = { sede, score }
    }
    return best
  }

  const label = (h: HospitalRow) => `${md(h.name)}${h.active === false ? ' (inactiva)' : ''}`
  const place = (h: HospitalRow) => md(h.locality_name ? `${h.municipality_name ?? h.municipality_id} – ${h.locality_name}` : h.municipality_name ?? h.municipality_id)
  const sedeLabel = (code: string | null) => {
    if (!code) return ''
    const sede = sedeByCode.get(code)
    return sede ? `${code} ${md(sede.nombre_sede)}` : `${code} (no está en reps_sedes)`
  }

  // ---------------------------------------------------------------------------------------------
  // Informe
  // ---------------------------------------------------------------------------------------------
  const out: string[] = []
  const now = new Date()
  out.push('# Cruce IPS ↔ sedes del REPS (Fase 3)', '')
  out.push(`Generado: ${now.toISOString()} · modo: ${apply ? '**--apply** (escribe en hospitals)' : 'informe (solo lectura)'}`)
  out.push(`Sedes en reps_sedes: ${sedes.length.toLocaleString('es-CO')} · fecha de corte: ${Array.from(cuts.entries()).map(([cut, n]) => `${cut} (${n.toLocaleString('es-CO')})`).join(', ')}`)
  out.push(`IPS en hospitals: ${hospitals.length} (activas ${hospitals.filter(h => h.active === true).length}) · NIT distintos: ${nitCount.size} · NIT repetidos en hospitals: ${Array.from(nitCount.values()).filter(n => n > 1).length}`, '')

  out.push('## Resultado', '', '| Estado | IPS |', '|---|---:|')
  for (const status of ['matched', 'ambiguous', 'unmatched'] as const) {
    out.push(`| ${REPS_STATUS_LABELS[status]} (\`${status}\`) | ${summary[status]} |`)
  }
  out.push(`| **Total** | **${summary.total}** |`, '')
  out.push(`Desvinculadas a mano (fuera del cruce; --apply no las toca): ${manualUnlinked.length}.`, '')
  out.push('| Cómo se vinculó | IPS |', '|---|---:|')
  for (const [method, count] of Object.entries(summary.byMethod).sort((a, b) => b[1] - a[1])) {
    out.push(`| ${METHOD_LABELS[method] ?? method} (\`${method}\`) | ${count} |`)
  }
  out.push('')

  // Simulación desde cero (como si ninguna IPS tuviera reps_code): cómo vincularía hoy el cruce automático.
  // Sirve para ver el método de cada vínculo después de --apply y para auditar los vínculos manuales.
  const scratch = matchHospitalsToRepsStable(hospitals.map(h => ({ ...h, reps_code: null })), sedesByNit)
  const scratchSummary = summarizeMatches(scratch)
  const scratchById = new Map(scratch.map(result => [result.hospital_id, result]))
  const differing = hospitals.filter(h => h.reps_code && scratchById.get(h.id)?.reps_code !== h.reps_code)
  out.push('### Simulación desde cero (sin vínculos previos)', '')
  out.push(`matched ${scratchSummary.matched} · ambiguous ${scratchSummary.ambiguous} · unmatched ${scratchSummary.unmatched} · por método: ${Object.entries(scratchSummary.byMethod).sort((a, b) => b[1] - a[1]).map(([method, n]) => `${METHOD_LABELS[method] ?? method} ${n}`).join(' · ')}`, '')
  out.push(`Vínculos actuales que el cruce automático NO haría hoy (manuales o de un corte anterior): ${differing.length}.`, '')
  if (differing.length > 0) {
    out.push('| IPS | Vinculada a | El cruce automático haría |', '|---|---|---|')
    for (const h of differing.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      const sim = scratchById.get(h.id)
      out.push(`| ${label(h)} | ${sedeLabel(h.reps_code)} | ${sim?.reps_code ? sedeLabel(sim.reps_code) : `${sim?.status ?? ''}: ${md(sim?.reason)}`} |`)
    }
    out.push('')
  }
  const suggested = results.filter(r => r.status === 'ambiguous' && r.suggested_code).length
  out.push(`- Vueltas del cruce: ${rounds} (en la 2ª y siguientes solo entran IPS cuya competidora ya quedó vinculada a otra IPS: ${results.filter(result => result.round > 1 && result.status === 'matched' && result.method !== 'ya_vinculada').length}).`)
  out.push(`- Ambiguas con sugerencia (la ficha la preselecciona, no se aplica sola): ${suggested} de ${summary.ambiguous}.`)
  out.push(`- Vinculadas con la sede en otro municipio (revisar el municipio de la IPS): ${summary.municipalityMismatch}.`)
  out.push(`- Vínculos huérfanos (reps_code que ya no está en reps_sedes): ${orphans.length}.`)
  const suffixes = new Map<string, number>()
  for (const h of hospitals) {
    const dv = checkDigitFromCode(h.code)
    suffixes.set(dv === null ? 'sin sufijo' : `-${dv}`, (suffixes.get(dv === null ? 'sin sufijo' : `-${dv}`) ?? 0) + 1)
  }
  out.push(
    `- El número tras el guion de hospitals.code NO es el dígito de verificación de la DIAN en ${dvMismatch.length} de ${hospitals.length} IPS ` +
      `(módulo 11). Reparto de sufijos: ${Array.from(suffixes.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}. ` +
      'Parece un consecutivo de sede, no un DV: el cruce usa solo los 9 dígitos del NIT (hospitals.nit).',
    ''
  )

  const byStatus = (status: string) => results.filter(r => r.status === status)
  const sortByName = (a: RepsMatchResult, b: RepsMatchResult) =>
    (hospitalById.get(a.hospital_id)?.name ?? '').localeCompare(hospitalById.get(b.hospital_id)?.name ?? '', 'es')

  const mismatched = results.filter(r => r.status === 'matched' && r.municipality_mismatch).sort(sortByName)
  if (mismatched.length > 0) {
    out.push('## Vinculadas con sede en otro municipio', '', '| IPS | Municipio IPS | Sede | Municipio sede |', '|---|---|---|---|')
    for (const r of mismatched) {
      const h = hospitalById.get(r.hospital_id)!
      const sede = sedeByCode.get(r.reps_code ?? '')
      out.push(`| ${label(h)} | ${place(h)} | ${sedeLabel(r.reps_code)} | ${md(sede?.municipio_sede_nombre)} (${md(sede?.municipio_sede)}) |`)
    }
    out.push('')
  }

  out.push(`## Ambiguas (${summary.ambiguous})`, '', 'Vincular a mano desde la ficha de la IPS (sección "Sede REPS") o en /hospitals/reps.', '')
  out.push('| IPS | NIT | Municipio | Motivo | Sugerida | Candidatas |', '|---|---|---|---|---|---:|')
  for (const r of byStatus('ambiguous').sort(sortByName)) {
    const h = hospitalById.get(r.hospital_id)!
    out.push(`| ${label(h)} | ${r.nit ?? ''} | ${place(h)} | ${md(r.reason)} | ${sedeLabel(r.suggested_code)} | ${r.candidates.length} |`)
  }
  out.push('')

  out.push(`## Sin cruce (${summary.unmatched})`, '')
  out.push('| IPS | code | Municipio | Motivo | Posible sede por nombre (otro NIT, solo pista) |', '|---|---|---|---|---|')
  for (const r of byStatus('unmatched').sort(sortByName)) {
    const h = hospitalById.get(r.hospital_id)!
    const hint = possibleOtherNit(h)
    out.push(`| ${label(h)} | ${md(h.code)} | ${place(h)} | ${md(r.reason)} | ${hint ? `${hint.sede.codigo_habilitacion} ${md(hint.sede.nombre_sede)} (NIT ${hint.sede.nit}, ${hint.score.toFixed(2)})` : ''} |`)
  }
  out.push('')

  out.push('## Ejemplos de vínculos automáticos', '')
  for (const method of ['unica_sede', 'municipio', 'nombre_exacto', 'nombre_similar']) {
    const sample = results.filter(r => r.method === method).sort(sortByName)
    if (sample.length === 0) continue
    out.push(`### ${METHOD_LABELS[method]} (${sample.length})`, '', '| IPS | Municipio | Sede vinculada | Puntaje nombre |', '|---|---|---|---:|')
    const shown = method === 'nombre_similar' ? sample : sample.slice(0, 8)
    for (const r of shown) {
      const h = hospitalById.get(r.hospital_id)!
      out.push(`| ${label(h)}${r.round > 1 ? ` (vuelta ${r.round})` : ''} | ${place(h)} | ${sedeLabel(r.reps_code)} | ${r.score === null ? '' : r.score.toFixed(2)} |`)
    }
    out.push('')
  }

  if (manualUnlinked.length > 0) {
    out.push(`## Desvinculadas a mano (${manualUnlinked.length})`, '', 'No entran al cruce automático ni a --apply. Para volver a vincularlas, hacerlo desde la ficha.', '')
    out.push('| IPS | Municipio | Última acción |', '|---|---|---|')
    for (const h of [...manualUnlinked].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      out.push(`| ${label(h)} | ${place(h)} | ${md(manualUnlinks.get(h.id))} |`)
    }
    out.push('')
  }

  if (orphans.length > 0) {
    out.push('## Vínculos huérfanos', '', '| IPS | reps_code |', '|---|---|')
    for (const h of orphans) out.push(`| ${label(h)} | ${h.reps_code} |`)
    out.push('')
  }

  // ---------------------------------------------------------------------------------------------
  // --apply
  // ---------------------------------------------------------------------------------------------
  const applied = { matched: 0, ambiguous: 0, unmatched: 0, unchanged: 0, skipped: 0, errors: 0 }
  if (apply) {
    const nowIso = now.toISOString()
    const toLink = results.filter(r => r.status === 'matched' && r.method !== 'ya_vinculada' && r.reps_code)
    await runPool(
      toLink,
      async r => {
        const { data, error } = await db
          .from('hospitals')
          .update({ reps_code: r.reps_code, reps_match_status: 'matched', reps_matched_at: nowIso })
          .eq('id', r.hospital_id)
          .is('reps_code', null)
          .select('id')
        if (error) {
          applied.errors++
          console.error(`No se pudo vincular ${r.hospital_id} → ${r.reps_code}: ${error.code ?? ''} ${error.message}`)
        } else if (!data || data.length === 0) applied.skipped++
        else applied.matched++
      },
      WRITE_CONCURRENCY
    )

    for (const status of ['ambiguous', 'unmatched'] as const) {
      // Solo las que cambian de estado (no reescribir lo mismo: cada UPDATE mueve updated_at)
      const ids = results
        .filter(r => r.status === status && hospitalById.get(r.hospital_id)?.reps_match_status !== status)
        .map(r => r.hospital_id)
      applied.unchanged += results.filter(r => r.status === status).length - ids.length
      for (let from = 0; from < ids.length; from += 200) {
        const chunk = ids.slice(from, from + 200)
        const { data, error } = await db
          .from('hospitals')
          .update({ reps_match_status: status })
          .in('id', chunk)
          .is('reps_code', null)
          .select('id')
        if (error) {
          applied.errors++
          console.error(`No se pudo marcar ${status}: ${error.code ?? ''} ${error.message}`)
        } else {
          applied[status] += data?.length ?? 0
          applied.skipped += chunk.length - (data?.length ?? 0)
        }
      }
    }

    const after = await fetchAll<{ reps_match_status: string | null; reps_code: string | null }>(
      db,
      'hospitals',
      'id, reps_match_status, reps_code',
      'id'
    )
    const counts = new Map<string, number>()
    for (const row of after) counts.set(String(row.reps_match_status), (counts.get(String(row.reps_match_status)) ?? 0) + 1)
    out.push('## Escrito con --apply', '')
    out.push(`- Vinculadas ahora: ${applied.matched} · marcadas ambiguous: ${applied.ambiguous} · marcadas unmatched: ${applied.unmatched} · sin cambios: ${applied.unchanged} · omitidas (ya tenían reps_code): ${applied.skipped} · errores: ${applied.errors}`)
    out.push(`- Estado en la base tras escribir: ${Array.from(counts.entries()).map(([status, n]) => `${status} ${n}`).join(' · ')} · con reps_code: ${after.filter(row => row.reps_code).length}`, '')
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_MD, out.join('\n'))

  console.log(`Sedes REPS: ${sedes.length} · IPS: ${hospitals.length}`)
  console.log(`matched ${summary.matched} · ambiguous ${summary.ambiguous} · unmatched ${summary.unmatched} · desvinculadas a mano (no se tocan) ${manualUnlinked.length}`)
  console.log(`por método: ${Object.entries(summary.byMethod).map(([m, n]) => `${m} ${n}`).join(' · ')} · vueltas: ${rounds}`)
  console.log(`ambiguas con sugerencia: ${suggested} · sede en otro municipio: ${summary.municipalityMismatch} · huérfanas: ${orphans.length} · sufijo de code distinto del DV DIAN: ${dvMismatch.length}`)
  if (apply) {
    console.log(`--apply: vinculadas ${applied.matched} · ambiguous ${applied.ambiguous} · unmatched ${applied.unmatched} · sin cambios ${applied.unchanged} · omitidas ${applied.skipped} · errores ${applied.errors}`)
    if (applied.errors > 0) process.exitCode = 1
  }
  console.log(`Informe: ${OUTPUT_MD}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
