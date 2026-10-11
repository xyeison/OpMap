// Fase 2 · Recalcula y guarda la cobertura por línea con el MISMO motor que usa la app
// (lib/coverage.ts → recomputeAndSaveCoverage). Requiere la migración 0400 aplicada.
// Uso: npx tsx scripts/fase2-recalculate.ts
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

async function main() {
  const mod = await import('../lib/coverage')
  const fn = (mod as any).recomputeAndSaveCoverage
  if (typeof fn !== 'function') throw new Error('lib/coverage.ts no exporta recomputeAndSaveCoverage')
  const result = await fn()
  console.log('Cobertura recalculada:', JSON.stringify(result))
}
main().catch(err => { console.error('ERROR:', err); process.exit(1) })
