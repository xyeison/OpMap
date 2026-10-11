/**
 * Fase 3 · Carga de las sedes del REPS en public.reps_sedes.
 *
 * Fuente: CSV de sedes del REPS (datos abiertos de MinSalud), con las columnas
 *   codigoprestador, nombreprestador, codigohabilitacionsede, nombresede, tipoid, numeroidentificacion,
 *   naturalezajuridica, ese, municipio_prestador, departamentoprestadordesc, municipioprestadordesc,
 *   direccionprestador, email_prestador, telefonoprestador, municipiosede, departamentodededesc,
 *   municipiosededesc, direcci_nsede, email_sede, t_lefonosede, claseprestador, fecha_corte_reps
 * (corte del 12-mar-2026: 76.821 sedes).
 *
 * Qué clases se cargan (decisión de la Fase 3):
 *   - "Instituciones Prestadoras de Servicios de Salud - IPS"           (19.551 en el corte de marzo)
 *   - "Objeto Social Diferente a la Prestación de Servicios de Salud"  (2.107)
 *   - "Transporte Especial de Pacientes"                               (506)
 *   Todas con NIT (tipo NI). Así entran todas las sedes con las que puede cruzar una IPS de OpMap
 *   (hospitals.code = NIT-DV): en marzo de 2026 ningún NIT de hospitals estaba solo entre los
 *   profesionales independientes.
 *   NO se cargan los "Profesionales Independientes" (54.657 personas naturales con cédula, correo y
 *   teléfono personales): no son IPS objetivo y no hace falta guardar esos datos personales.
 *
 * Idempotente: upsert por codigo_habilitacion en lotes de 1.000. Volver a cargar el mismo archivo deja
 * la tabla igual (solo cambia imported_at). Una sede que ya no viene en un corte nuevo se queda con su
 * fecha_corte e imported_at viejos; con --prune se borran (solo si la carga terminó sin errores).
 * hospitals.reps_code no tiene FOREIGN KEY: borrar una sede vinculada no rompe nada, el informe de
 * scripts/reps-match.ts la marca como "vínculo huérfano".
 *
 * Uso (desde web/):
 *   npx tsx scripts/reps-load-sedes.ts --file /ruta/reps_sedes.csv            → carga (upsert)
 *   npx tsx scripts/reps-load-sedes.ts --file /ruta/reps_sedes.csv --dry-run  → solo cuenta, no escribe
 *   npx tsx scripts/reps-load-sedes.ts --file /ruta/reps_sedes.csv --prune    → carga y borra sedes
 *                                                                               que no vienen en el archivo
 * No llama a Google ni recalcula asignaciones.
 */
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { isLoadedRepsClass, normalizeName, parseCsv, parseRepsCutDate, REPS_CODE_RE } from '../lib/reps-match'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const BATCH_SIZE = 1000

const REQUIRED_COLUMNS = [
  'codigoprestador', 'nombreprestador', 'codigohabilitacionsede', 'nombresede', 'tipoid',
  'numeroidentificacion', 'naturalezajuridica', 'ese', 'municipio_prestador', 'departamentoprestadordesc',
  'municipioprestadordesc', 'direccionprestador', 'email_prestador', 'telefonoprestador', 'municipiosede',
  'departamentodededesc', 'municipiosededesc', 'direcci_nsede', 'email_sede', 't_lefonosede',
  'claseprestador', 'fecha_corte_reps',
] as const

type CsvColumn = (typeof REQUIRED_COLUMNS)[number]

export interface RepsSedeRow {
  codigo_habilitacion: string
  codigo_prestador: string
  nombre_prestador: string
  nombre_sede: string
  tipo_id: string | null
  nit: string
  naturaleza: string | null
  ese: boolean
  municipio_prestador: string | null
  departamento_prestador: string | null
  municipio_prestador_nombre: string | null
  direccion_prestador: string | null
  email_prestador: string | null
  telefono_prestador: string | null
  municipio_sede: string
  departamento_sede: string | null
  municipio_sede_nombre: string | null
  direccion_sede: string | null
  email_sede: string | null
  telefono_sede: string | null
  clase_prestador: string
  fecha_corte: string | null
  imported_at: string
  nombre_busqueda: string
}

interface Args {
  file: string | null
  dryRun: boolean
  prune: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = { file: null, dryRun: false, prune: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--prune') args.prune = true
    else if (arg === '--file') args.file = argv[++i] ?? null
    else if (arg.startsWith('--file=')) args.file = arg.slice('--file='.length)
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!args.file) throw new Error('Falta --file /ruta/al/csv de sedes del REPS')
  if (args.dryRun && args.prune) throw new Error('--prune no se combina con --dry-run')
  return args
}

const text = (value: string | undefined): string | null => {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function mapRow(get: (column: CsvColumn) => string, importedAt: string): { row?: RepsSedeRow; error?: string } {
  const codigo = get('codigohabilitacionsede').trim()
  const prestador = get('codigoprestador').trim()
  const municipio = get('municipiosede').trim()
  const nit = get('numeroidentificacion').trim()
  if (!REPS_CODE_RE.test(codigo)) return { error: `código de habilitación inválido "${codigo}"` }
  if (!/^\d{10}$/.test(prestador)) return { error: `código de prestador inválido "${prestador}" (${codigo})` }
  if (!/^\d{5}$/.test(municipio)) return { error: `municipio de sede inválido "${municipio}" (${codigo})` }
  if (!nit) return { error: `sin número de identificación (${codigo})` }
  return {
    row: {
      codigo_habilitacion: codigo,
      codigo_prestador: prestador,
      nombre_prestador: get('nombreprestador').trim(),
      nombre_sede: get('nombresede').trim() || get('nombreprestador').trim(),
      tipo_id: text(get('tipoid')),
      nit,
      naturaleza: text(get('naturalezajuridica')),
      ese: get('ese').trim().toUpperCase() === 'SI',
      municipio_prestador: text(get('municipio_prestador')),
      departamento_prestador: text(get('departamentoprestadordesc')),
      municipio_prestador_nombre: text(get('municipioprestadordesc')),
      direccion_prestador: text(get('direccionprestador')),
      email_prestador: text(get('email_prestador')),
      telefono_prestador: text(get('telefonoprestador')),
      municipio_sede: municipio,
      departamento_sede: text(get('departamentodededesc')),
      municipio_sede_nombre: text(get('municipiosededesc')),
      direccion_sede: text(get('direcci_nsede')),
      email_sede: text(get('email_sede')),
      telefono_sede: text(get('t_lefonosede')),
      clase_prestador: get('claseprestador').trim(),
      fecha_corte: parseRepsCutDate(get('fecha_corte_reps')),
      imported_at: importedAt,
      // Para el buscador de la ficha: sede + prestador sin tildes ni signos
      nombre_busqueda: normalizeName(`${get('nombresede')} ${get('nombreprestador')}`),
    },
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = path.resolve(args.file as string)
  const importedAt = new Date().toISOString()

  const rows = parseCsv(fs.readFileSync(file, 'utf8'))
  const header = (rows.shift() ?? []).map(column => column.trim())
  const missing = REQUIRED_COLUMNS.filter(column => !header.includes(column))
  if (missing.length > 0) throw new Error(`Al CSV le faltan columnas: ${missing.join(', ')}`)
  const index = new Map(header.map((column, i) => [column, i]))

  const byClass = new Map<string, number>()
  const errors: string[] = []
  let malformed = 0
  let excluded = 0
  const sedes = new Map<string, RepsSedeRow>()

  for (const raw of rows) {
    if (raw.length === 1 && raw[0].trim() === '') continue // línea vacía final
    if (raw.length !== header.length) {
      malformed++
      continue
    }
    const get = (column: CsvColumn) => raw[index.get(column) as number] ?? ''
    const clase = get('claseprestador').trim()
    byClass.set(clase, (byClass.get(clase) ?? 0) + 1)
    if (!isLoadedRepsClass(clase)) {
      excluded++
      continue
    }
    const mapped = mapRow(get, importedAt)
    if (mapped.error) {
      errors.push(mapped.error)
      continue
    }
    sedes.set(mapped.row!.codigo_habilitacion, mapped.row!) // si el archivo repite un código, gana la última fila
  }

  const cuts = new Map<string, number>()
  for (const sede of Array.from(sedes.values())) cuts.set(String(sede.fecha_corte), (cuts.get(String(sede.fecha_corte)) ?? 0) + 1)

  console.log(`Archivo: ${file}`)
  console.log(`Filas leídas: ${rows.length.toLocaleString('es-CO')} (mal formadas: ${malformed})`)
  for (const [clase, count] of Array.from(byClass.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${isLoadedRepsClass(clase) ? 'carga ' : 'excluye'} ${count.toLocaleString('es-CO').padStart(7)}  ${clase}`)
  }
  console.log(`Excluidas por clase: ${excluded.toLocaleString('es-CO')} · inválidas: ${errors.length}`)
  errors.slice(0, 10).forEach(error => console.log(`  - ${error}`))
  console.log(`Sedes a cargar: ${sedes.size.toLocaleString('es-CO')} · fecha de corte: ${Array.from(cuts.entries()).map(([cut, n]) => `${cut} (${n})`).join(', ')}`)

  if (args.dryRun) {
    console.log('--dry-run: no se escribió nada.')
    return
  }

  const { getSupabaseAdmin } = await import('../lib/supabase-admin')
  const db = getSupabaseAdmin()

  const list = Array.from(sedes.values())
  let written = 0
  let failedBatches = 0
  for (let from = 0; from < list.length; from += BATCH_SIZE) {
    const batch = list.slice(from, from + BATCH_SIZE)
    const { error } = await db.from('reps_sedes').upsert(batch, { onConflict: 'codigo_habilitacion' })
    if (error) {
      failedBatches++
      console.error(`Lote ${from / BATCH_SIZE + 1}: error ${error.code ?? ''} ${error.message}`)
      continue
    }
    written += batch.length
    process.stdout.write(`\rEscritas ${written.toLocaleString('es-CO')} / ${list.length.toLocaleString('es-CO')}`)
  }
  process.stdout.write('\n')

  let pruned = 0
  if (args.prune) {
    if (failedBatches > 0) {
      console.log('--prune omitido: hubo lotes con error (se borrarían sedes que sí están en el archivo).')
    } else {
      const { count: stale, error: countError } = await db
        .from('reps_sedes')
        .select('codigo_habilitacion', { count: 'exact', head: true })
        .lt('imported_at', importedAt)
      if (countError) throw countError
      if ((stale ?? 0) > 0) {
        const { error: deleteError } = await db.from('reps_sedes').delete().lt('imported_at', importedAt)
        if (deleteError) throw deleteError
      }
      pruned = stale ?? 0
    }
  }

  const { count: total, error: totalError } = await db
    .from('reps_sedes')
    .select('codigo_habilitacion', { count: 'exact', head: true })
  if (totalError) throw totalError

  console.log('Resumen:')
  console.log(`  upsert: ${written.toLocaleString('es-CO')} sedes en ${Math.ceil(list.length / BATCH_SIZE)} lotes (${failedBatches} con error)`)
  if (args.prune) console.log(`  borradas por --prune (no venían en el archivo): ${pruned.toLocaleString('es-CO')}`)
  console.log(`  reps_sedes ahora: ${(total ?? 0).toLocaleString('es-CO')} filas`)
  if (failedBatches > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
