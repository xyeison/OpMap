/**
 * Fase 4 · Carga de las cifras mensuales de afiliación de MinSalud en public.afiliacion_cifras.
 *
 * Fuente: MinSalud, "Cifras de aseguramiento en salud": un ZIP por mes con "CIFRAS <MES>-<AÑO>.xlsx"
 * (9 hojas). Se lee la hoja CoberturaMunicipio: fila 1 título ("CIFRAS AGOSTO-2026"), fila 2
 * encabezados, una fila por municipio y una final "Total general" (o "Total").
 *   - feb-2026 en adelante: IdDepartamento, Departamento, IdMunicipio, Municipio, Contributivo,
 *     Subsidiado, Excepción & Especiales, Afiliados, Población, Cobertura, + 4 columnas de SISBEN.
 *   - jul-2025 a ene-2026: las mismas sin IdDepartamento ni IdMunicipio (solo nombres).
 * Estructura completa: docs/fases/fase4-poblacion.md.
 *
 * Código DANE de cada fila, en este orden:
 *   1. IdMunicipio del archivo                                     → codigo_origen 'archivo'
 *   2. nombre en municipalities o alias en municipio_alias         → 'nombre' | 'alias'
 *   3. mismo departamento + municipio en un archivo con IdMunicipio (de esta corrida o ya cargado):
 *      cubre las filas que no son municipio ("SIN UBICACIÓN" 00000, "AMAZONAS-SM" 91000…) → 'aprendido'
 *   Si 2 y 3 dan códigos distintos, la fila NO se carga y se reporta. Sin código → no se carga.
 * Los nombres con código que no coinciden con municipalities.name se guardan en municipio_alias
 * (fuente minsalud_cifras), solo si el código existe en municipalities.
 *
 * corte = último día del mes del archivo. Upsert por (corte, municipality_code); al terminar sin
 * errores, borra las filas de ese corte que no vinieron en esta carga. No llama a Google.
 *
 * Uso (desde web/):
 *   npx tsx scripts/minsalud-cifras-load.ts --dir /ruta/zips             → todos los .zip y .xlsx
 *   npx tsx scripts/minsalud-cifras-load.ts --file /ruta/cifras-agosto2026.zip [--file ...]
 *   npx tsx scripts/minsalud-cifras-load.ts --dir /ruta/zips --dry-run   → solo lee y cuadra
 *   --no-alias  no escribe alias aprendidos en municipio_alias
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { cargarCifras } from '../lib/cifras-sync'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  files: string[]
  dryRun: boolean
  alias: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { files: [], dryRun: false, alias: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--no-alias') args.alias = false
    else if (arg === '--file') args.files.push(path.resolve(argv[++i] ?? ''))
    else if (arg === '--dir') {
      const dir = path.resolve(argv[++i] ?? '')
      for (const name of fs.readdirSync(dir).sort()) {
        if (/\.(zip|xlsx)$/i.test(name) && !name.startsWith('.')) args.files.push(path.join(dir, name))
      }
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (args.files.length === 0) throw new Error('Falta --dir /carpeta o --file /ruta.zip')
  return args
}

// Lectura, códigos DANE, cuadre, alias, upsert, poda y verificación: lib/cifras-sync.ts (compartido con la
// carga automática del cron, PR 7). Aquí solo se leen los archivos del disco.
async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()
  const archivos: { file: string; bytes: Uint8Array }[] = []
  let noLeidos = 0
  for (const file of args.files) {
    try {
      archivos.push({ file, bytes: new Uint8Array(fs.readFileSync(file)) })
    } catch (error) {
      noLeidos++
      console.error(`${path.basename(file)}: ${error instanceof Error ? error.message : error}`)
    }
  }
  const r = await cargarCifras({
    db,
    archivos,
    dryRun: args.dryRun,
    alias: args.alias,
    log: line => console.log(line),
    logError: line => console.error(line),
  })
  if (!r.ok || noLeidos > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
