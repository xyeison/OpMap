/**
 * PR 7 · Marca el estado de una carga que NO corre en Vercel (hoy: ADRES "Identifica tu Giro" en GitHub
 * Actions) en public.fuentes_estado, para que el panel "Fuentes de datos" la muestre igual que las demás.
 *
 * Uso (desde web/; lo llama .github/workflows/datos.yml):
 *   npx tsx scripts/fuente-estado.ts --fuente adres_identifica --inicio
 *   npx tsx scripts/fuente-estado.ts --fuente adres_identifica --fin --resultado success|failure|cancelled
 * --inicio: estado "corriendo" y guarda la hora de inicio en el cursor.
 * --fin:    lee adres_fetch_log desde esa hora (consultas ok / sin registros / error y filas) y cierra con
 *           estado ok (el paso de carga terminó bien y sin NIT con error) o error. Si existen las variables de
 *           GitHub (GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID) añade el enlace a la corrida.
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (secretos del repositorio en GitHub).
 */
import path from 'path'
import dotenv from 'dotenv'
import { cerrarFuente, leerEstadoFuente, type FuenteId } from '../lib/fuentes-estado'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), quiet: true } as Parameters<typeof dotenv.config>[0])

const FUENTE_LOG: Partial<Record<FuenteId, string>> = { adres_identifica: 'adres_identifica_giro' }

function parseArgs(argv: string[]) {
  const args = { fuente: null as FuenteId | null, inicio: false, fin: false, resultado: 'success' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--inicio') args.inicio = true
    else if (arg === '--fin') args.fin = true
    else if (arg === '--fuente') args.fuente = (argv[++i] ?? null) as FuenteId | null
    else if (arg === '--resultado') args.resultado = argv[++i] ?? 'failure'
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!args.fuente || !FUENTE_LOG[args.fuente]) throw new Error('--fuente debe ser adres_identifica')
  if (args.inicio === args.fin) throw new Error('Usa --inicio o --fin (uno de los dos)')
  return args as { fuente: FuenteId; inicio: boolean; fin: boolean; resultado: string }
}

function enlaceCorrida(): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env
  return GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID ? ` Corrida: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : ''
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const ahora = new Date()

  if (args.inicio) {
    const { error } = await db
      .from('fuentes_estado')
      .update({ estado: 'corriendo', ultimo_intento: ahora.toISOString(), mensaje: `Corriendo en GitHub Actions.${enlaceCorrida()}`, cursor: { inicio: ahora.toISOString() }, updated_at: ahora.toISOString() })
      .eq('fuente', args.fuente)
    if (error) throw new Error(`fuentes_estado: ${error.message}`)
    console.log(`${args.fuente}: corriendo desde ${ahora.toISOString()}`)
    return
  }

  const estado = await leerEstadoFuente(db, args.fuente)
  const inicio = typeof estado?.cursor?.inicio === 'string' ? (estado.cursor.inicio as string) : new Date(ahora.getTime() - 6 * 3600_000).toISOString()
  const conteo = { ok: 0, sin_registros: 0, error: 0, filas: 0 }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('adres_fetch_log')
      .select('estado, filas')
      .eq('fuente', FUENTE_LOG[args.fuente] as string)
      .gte('fetched_at', inicio)
      .order('fetched_at')
      .range(from, from + 999)
    if (error) throw new Error(`adres_fetch_log: ${error.message}`)
    for (const row of (data ?? []) as Array<{ estado: string; filas: number | null }>) {
      if (row.estado === 'ok') conteo.ok++
      else if (row.estado === 'sin_registros') conteo.sin_registros++
      else conteo.error++
      conteo.filas += row.filas ?? 0
    }
    if (!data || data.length < 1000) break
  }
  const exito = args.resultado === 'success' && conteo.error === 0
  const resumen = `NIT consultados: ${conteo.ok + conteo.sin_registros + conteo.error} (con giros ${conteo.ok}, sin registros ${conteo.sin_registros}, con error ${conteo.error}); filas ${conteo.filas.toLocaleString('es-CO')}.`
  const mensaje = exito
    ? `ADRES Identifica tu Giro (GitHub Actions): ${resumen}${enlaceCorrida()}`
    : `ADRES Identifica tu Giro (GitHub Actions) terminó con ${args.resultado === 'success' ? 'NIT con error' : `resultado "${args.resultado}"`}: ${resumen} Si el firewall de la ADRES bloqueó la consulta, correr el script desde un equipo propio.${enlaceCorrida()}`
  await cerrarFuente(db, args.fuente, { estado: exito ? 'ok' : 'error', filas: conteo.filas, mensaje, cursor: { inicio, fin: ahora.toISOString(), ...conteo } }, ahora)
  console.log(mensaje)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
