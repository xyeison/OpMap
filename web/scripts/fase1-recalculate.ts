// Fase 1 · Recálculo completo de asignaciones con el MISMO código que usa la app
// (SimplifiedOpMapAlgorithm.loadData → calculateAssignments → saveAssignments).
// Uso: npx tsx scripts/fase1-recalculate.ts          → solo muestra el resumen (no guarda)
//      npx tsx scripts/fase1-recalculate.ts --yes    → guarda en Supabase (service_role)
import path from 'path'
import dotenv from 'dotenv'
import { getSupabaseAdmin } from '../lib/supabase-admin'
import { SimplifiedOpMapAlgorithm } from '../lib/opmap-algorithm-simplified'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

async function countByZone(label: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('assignments').select('kam_id, kams!inner(name)')
  if (error) throw new Error(error.message)
  const counts = new Map<string, number>()
  for (const row of data || []) {
    const name = (row as any).kams?.name ?? row.kam_id
    counts.set(name, (counts.get(name) || 0) + 1)
  }
  console.log(`\n${label}: ${data?.length ?? 0} asignaciones`)
  for (const [name, n] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${name.padEnd(22)} ${String(n).padStart(4)}`)
  }
}

async function main() {
  const save = process.argv.includes('--yes')
  await countByZone('ANTES')
  const algorithm = new SimplifiedOpMapAlgorithm()
  await algorithm.loadData()
  const assignments = await algorithm.calculateAssignments()
  const byZone = new Map<string, number>()
  for (const a of assignments) byZone.set(a.kam_id, (byZone.get(a.kam_id) || 0) + 1)
  console.log(`\nCALCULADAS: ${assignments.length} asignaciones en ${byZone.size} zonas`)
  if (!save) {
    console.log('\n(sin --yes: no se guarda nada)')
    return
  }
  await algorithm.saveAssignments(assignments)
  console.log('\nGuardado.')
  await countByZone('DESPUÉS')
}

main().catch(err => { console.error('ERROR:', err); process.exit(1) })
