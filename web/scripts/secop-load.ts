/**
 * PR 7 · Carga de SECOP en public.secop_contratos (inicial e incremental). Misma función que el cron
 * (lib/fuentes-runner.ts → lib/secop-sync.ts), pero sin el límite de 50 s: sirve para la carga inicial y
 * para ponerse al día si el cron estuvo apagado.
 *
 * Fuentes: SECOP II Contratos (jbjy-vk9h) y SECOP Integrado (rpmr-utcd), datos.gov.co, sin token.
 * Alcance: contratos de las IPS activas públicas o mixtas (REPS) que clasifican en una línea, son de un
 * proveedor vigilado o son servicios de especialistas; y todos los contratos de los proveedores vigilados.
 * Personas naturales sin documento en claro (hash con sal). Reglas en lib/secop.ts.
 *
 * Uso (desde web/):
 *   npx tsx scripts/secop-load.ts                       → las dos fuentes; sigue la pasada en curso o hace la
 *                                                         incremental (la primera vez, la inicial completa)
 *   npx tsx scripts/secop-load.ts --fuente secop2       → solo SECOP II (o --fuente integrado)
 *   npx tsx scripts/secop-load.ts --inicial             → fuerza una pasada inicial completa
 *   npx tsx scripts/secop-load.ts --dry-run --max-paginas 2   → lee y clasifica sin escribir nada
 *   --page-size N (por defecto 5000, máx. 50000)
 * Registra cada corrida en fuentes_estado (secop_ii / secop_integrado). Requiere la migración 0710.
 * No llama a Google.
 */
import path from 'path'
import dotenv from 'dotenv'
import type { SecopFuente } from '../lib/secop'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  fuentes: SecopFuente[]
  inicial: boolean
  dryRun: boolean
  pageSize: number
  maxPaginas: number | undefined
}

function parseArgs(argv: string[]): Args {
  const args: Args = { fuentes: ['secop2', 'integrado'], inicial: false, dryRun: false, pageSize: 5000, maxPaginas: undefined }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Falta el valor de ${arg}`)
      return value
    }
    if (arg === '--inicial') args.inicial = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--fuente') {
      const value = next()
      if (value === 'todas') args.fuentes = ['secop2', 'integrado']
      else if (value === 'secop2' || value === 'integrado') args.fuentes = [value]
      else throw new Error('--fuente debe ser secop2, integrado o todas')
    } else if (arg === '--page-size') args.pageSize = Number(next())
    else if (arg === '--max-paginas') args.maxPaginas = Number(next())
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!Number.isInteger(args.pageSize) || args.pageSize < 100 || args.pageSize > 50_000) throw new Error('--page-size entre 100 y 50.000')
  if (args.maxPaginas !== undefined && (!Number.isInteger(args.maxPaginas) || args.maxPaginas < 1)) throw new Error('--max-paginas debe ser un entero ≥ 1')
  return args
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-CO'))

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const log = (message: string) => console.log(message)

  for (const fuente of args.fuentes) {
    const inicio = Date.now()
    console.log(`\n=== ${fuente === 'secop2' ? 'SECOP II (jbjy-vk9h)' : 'SECOP Integrado (rpmr-utcd)'}${args.dryRun ? ' · DRY-RUN (no escribe)' : ''} ===`)
    if (args.dryRun || args.maxPaginas !== undefined) {
      const { sincronizarSecop } = await import('../lib/secop-sync')
      const r = await sincronizarSecop({ db, fuente, deadline: Infinity, pageSize: args.pageSize, forzarInicial: args.inicial, dryRun: args.dryRun, maxPaginas: args.maxPaginas, log })
      console.log(`Páginas ${r.paginas} · leídas ${fmt(r.leidas)} · guardadas ${fmt(r.guardadas)} (vigilado ${fmt(r.porAlcance.vigilado)}, línea ${fmt(r.porAlcance.linea)}, especialidad ${fmt(r.porAlcance.especialidad)}) · fuera de alcance ${fmt(r.descartadas)} · ilegibles ${fmt(r.errores)}`)
      r.ejemplosError.forEach(e => console.log(`  - ${e}`))
      console.log(r.mensaje)
      continue
    }
    const { ejecutarFuente } = await import('../lib/fuentes-runner')
    const r = await ejecutarFuente(fuente === 'secop2' ? 'secop_ii' : 'secop_integrado', {
      presupuestoMs: Number.POSITIVE_INFINITY,
      origen: 'script',
      forzarInicial: args.inicial,
      pageSize: args.pageSize,
      log,
      db,
    })
    console.log(`Resultado: ${r.estado} · filas de la pasada ${fmt(r.filas)} · ${((Date.now() - inicio) / 60000).toFixed(1)} min`)
    console.log(r.mensaje)
    if (!r.ok) process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
