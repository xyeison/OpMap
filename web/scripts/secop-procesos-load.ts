/**
 * Carga de los procesos de SECOP II sin contrato (p6dx-8zbt) en public.secop_procesos: la carga inicial de 24 meses y
 * ponerse al día si el cron estuvo apagado. Misma función que el cron diario (lib/fuentes-runner.ts →
 * lib/secop-procesos-sync.ts), pero sin el límite de 50 s. Spec: docs/specs/2026-10-25-secop-procesos-radar.md.
 *
 * Alcance: procesos de las IPS públicas objetivo (secop_nits_ips().publica) que clasifican en una línea de ortopedia o
 * neurocirugía (no los servicios de médicos ni lo que solo clasifica por UNSPSC). Personas naturales sin nombre ni
 * documento (solo hash con sal); descripción con los datos de pacientes redactados. No toca secop_contratos: los
 * procesos nunca suman como compras. Reglas en lib/secop-procesos.ts.
 *
 * Uso (desde web/):
 *   npx tsx scripts/secop-procesos-load.ts --inicial      → pasada inicial completa (publicados desde el primer día de hace
 *                                                           24 meses); la primera vez es la inicial aunque no se pida
 *   npx tsx scripts/secop-procesos-load.ts                → sigue la pasada a medias o relee los últimos 120 días
 *   npx tsx scripts/secop-procesos-load.ts --dry-run --max-paginas 1   → lee y mapea SIN escribir nada (ni la tabla ni
 *                                                           fuentes_estado); imprime 3 ejemplos sin nombres de personas
 *   --page-size N (por defecto 5000; de 100 a 50.000)
 *   --nit 900042103,891079999   (solo con --dry-run) limita la lectura a esas entidades
 * Sin --dry-run registra la corrida en fuentes_estado ('secop_procesos') y necesita la migración 0890 (si falta, para
 * antes de leer datos.gov.co). Con --dry-run funciona aunque la migración no esté aplicada. No llama a Google.
 */
import path from 'path'
import dotenv from 'dotenv'
import { SECOP_PROCESOS_DATASET, SECOP_PROCESOS_FUENTE, SECOP_PROCESOS_NOMBRE } from '../lib/secop-procesos'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  inicial: boolean
  dryRun: boolean
  pageSize: number
  maxPaginas: number | undefined
  nits: string[] | undefined
}

function parseArgs(argv: string[]): Args {
  const args: Args = { inicial: false, dryRun: false, pageSize: 5000, maxPaginas: undefined, nits: undefined }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Falta el valor de ${arg}`)
      return value
    }
    if (arg === '--inicial') args.inicial = true
    else if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--page-size') args.pageSize = Number(next())
    else if (arg === '--max-paginas') args.maxPaginas = Number(next())
    else if (arg === '--nit') args.nits = next().split(',').map(n => n.trim()).filter(Boolean)
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!Number.isInteger(args.pageSize) || args.pageSize < 100 || args.pageSize > 50_000) throw new Error('--page-size entre 100 y 50.000')
  if (args.maxPaginas !== undefined && (!Number.isInteger(args.maxPaginas) || args.maxPaginas < 1)) throw new Error('--max-paginas debe ser un entero ≥ 1')
  if (args.nits !== undefined) {
    if (!args.dryRun) throw new Error('--nit solo se permite con --dry-run (cambiaría la lista de tareas de la pasada guardada)')
    if (args.nits.length === 0 || args.nits.some(n => !/^\d{9}$/.test(n))) throw new Error('--nit lleva NIT de 9 dígitos separados por comas')
  }
  return args
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('es-CO'))

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const log = (message: string) => console.log(message)
  const inicio = Date.now()
  console.log(`\n=== ${SECOP_PROCESOS_NOMBRE} (${SECOP_PROCESOS_DATASET})${args.dryRun ? ' · DRY-RUN (no escribe nada)' : ''} ===`)

  if (args.dryRun || args.maxPaginas !== undefined) {
    // Directo a la carga (sin tomar el bloqueo ni cerrar la fila de fuentes_estado). En dry-run no se escribe nada.
    const { sincronizarSecopProcesos } = await import('../lib/secop-procesos-sync')
    const r = await sincronizarSecopProcesos({
      db,
      deadline: Number.POSITIVE_INFINITY,
      pageSize: args.pageSize,
      forzarInicial: args.inicial,
      dryRun: args.dryRun,
      maxPaginas: args.maxPaginas,
      soloNits: args.nits,
      log,
    })
    const motivos = Object.entries(r.porMotivo)
      .filter(([, n]) => n > 0)
      .map(([motivo, n]) => `${motivo} ${fmt(n)}`)
      .join(', ')
    console.log(
      `Páginas ${r.paginas} · filas leídas ${fmt(r.leidas)} · mapeadas ${fmt(r.mapeadas)} · procesos ${args.dryRun ? 'que se guardarían' : 'guardados'} ${fmt(r.guardadas)} · ` +
        `descartadas ${fmt(r.descartadas)}${motivos ? ` (${motivos})` : ''}`
    )
    console.log(r.mensaje)
    return
  }

  const { ejecutarFuente } = await import('../lib/fuentes-runner')
  const r = await ejecutarFuente(SECOP_PROCESOS_FUENTE, {
    presupuestoMs: Number.POSITIVE_INFINITY,
    origen: 'script',
    forzarInicial: args.inicial,
    pageSize: args.pageSize,
    log,
    db,
  })
  console.log(`Resultado: ${r.estado} · procesos de la pasada ${fmt(r.filas)} · ${((Date.now() - inicio) / 60000).toFixed(1)} min`)
  console.log(r.mensaje)
  if (!r.ok) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
