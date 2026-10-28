/**
 * Refresca con Google (Distance Matrix, driving) los tiempos de hospital_kam_distances desde las celdas de Bogotá
 * (zonas con area_id 11001xx) hacia las IPS ACTIVAS de los departamentos indicados, REEMPLAZANDO los guardados.
 *
 * Caso (2026-10-28): los tiempos de Bogotá a Meta y Casanare eran del 2025-08-07, con la vía al Llano cerrada
 * (Villavicencio a ~7 h 30 y ~375 km; lo normal es ~2 h 30). El flujo de siempre (ensure-routes, process-pending) solo
 * pide los pares que FALTAN y nunca reemplaza los guardados. Autorización del dueño, 2026-10-28: "Sí, autorizo los
 * 0,44 USD y quita las forzadas" (88 elementos: 4 celdas × 22 IPS). Respaldo previo: migración 0901.
 *
 * Modos (desde web/):
 *   npx tsx scripts/tiempos-bogota-refrescar.ts --departamentos 50,85
 *        → dry-run (por defecto): celdas, IPS, pares, peticiones y costo, con los tiempos guardados hoy.
 *          NO llama a Google ni escribe.
 *   npx tsx scripts/tiempos-bogota-refrescar.ts --departamentos 50,85 --run --max-elements 88
 *        → llama a Google (tope duro de elementos, sin reintentos) y actualiza hospital_kam_distances (SEGUNDOS y km,
 *          source 'google_maps'). Un par sin ruta o con error NO se toca: se informa.
 * Después hay que recalcular (scripts/fase1-recalculate.ts --yes y scripts/fase2b-municipios.ts --assign).
 */
import path from 'path'
import dotenv from 'dotenv'
import { supabaseAdmin } from '../lib/supabase-admin'
import {
  COST_PER_ELEMENT_USD,
  MAX_DESTINATIONS,
  MAX_ELEMENTS,
  googleRoutesDisabled,
  requestDistanceMatrix,
} from '../lib/google-distance'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  departamentos: string[]
  run: boolean
  maxElements: number | null
}

function parseArgs(argv: string[]): Args {
  const args: Args = { departamentos: [], run: false, maxElements: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--run') args.run = true
    else if (arg === '--departamentos') args.departamentos = String(argv[++i] ?? '').split(',').map(d => d.trim()).filter(Boolean)
    else if (arg === '--max-elements') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value) || value <= 0) throw new Error('--max-elements debe ser un entero positivo')
      args.maxElements = value
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (args.departamentos.length === 0 || args.departamentos.some(d => !/^\d{2}$/.test(d))) {
    throw new Error('--departamentos es obligatorio: códigos DANE de 2 dígitos separados por comas (p. ej. 50,85)')
  }
  if (args.run && args.maxElements === null) throw new Error('--run exige --max-elements N (tope duro de elementos a pedir a Google)')
  if (!args.run && args.maxElements !== null) throw new Error('--max-elements solo tiene sentido con --run')
  return args
}

interface Celda {
  id: string
  name: string
  lat: number
  lng: number
}

interface Ips {
  id: string
  name: string
  municipality_id: string
  department_id: string
  lat: number
  lng: number
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const num = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value))
const minutos = (seconds: number | null | undefined) => (finite(seconds) ? Math.round(seconds / 60) : null)
const usd = (n: number) => `${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`

/** Lotes de IPS por petición: con n celdas como orígenes caben hasta min(25, floor(100 / n)) destinos. */
function lotes<T>(items: T[], celdas: number): T[][] {
  const size = Math.max(1, Math.min(MAX_DESTINATIONS, Math.floor(MAX_ELEMENTS / Math.max(1, celdas))))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const { data: kams, error: kamsError } = await supabaseAdmin
    .from('kams')
    .select('id, name, area_id, lat, lng, active, participates_in_assignment')
    .like('area_id', '11001%')
    .order('name')
  if (kamsError) throw new Error(`Error leyendo kams: ${kamsError.message}`)
  const celdas: Celda[] = (kams || [])
    .filter((k: any) => String(k.area_id).length === 7 && k.active === true && k.participates_in_assignment === true)
    .map((k: any) => ({ id: k.id, name: k.name, lat: num(k.lat) as number, lng: num(k.lng) as number }))
    .filter(c => finite(c.lat) && finite(c.lng))
  if (celdas.length === 0) throw new Error('No hay celdas de Bogotá activas con coordenadas')

  const { data: hospitals, error: hospitalsError } = await supabaseAdmin
    .from('hospitals')
    .select('id, name, municipality_id, department_id, lat, lng')
    .eq('active', true)
    .in('department_id', args.departamentos)
    .order('id')
  if (hospitalsError) throw new Error(`Error leyendo hospitals: ${hospitalsError.message}`)
  const todas = (hospitals || []).map((h: any) => ({ ...h, lat: num(h.lat), lng: num(h.lng) }))
  const ips: Ips[] = todas.filter((h: any) => finite(h.lat) && finite(h.lng))
  const sinCoordenadas = todas.length - ips.length

  const { data: actuales, error: actualesError } = await supabaseAdmin
    .from('hospital_kam_distances')
    .select('hospital_id, kam_id, travel_time, distance, calculated_at')
    .in('hospital_id', ips.map(h => h.id))
    .in('kam_id', celdas.map(c => c.id))
  if (actualesError) throw new Error(`Error leyendo hospital_kam_distances: ${actualesError.message}`)
  const mejorAntes = new Map<string, { segundos: number; km: number | null; celda: string; fecha: string }>()
  for (const row of actuales || []) {
    const segundos = num(row.travel_time)
    if (!finite(segundos)) continue
    const previo = mejorAntes.get(row.hospital_id)
    if (!previo || segundos < previo.segundos) {
      mejorAntes.set(row.hospital_id, {
        segundos,
        km: num(row.distance),
        celda: celdas.find(c => c.id === row.kam_id)?.name ?? row.kam_id,
        fecha: String(row.calculated_at ?? '').slice(0, 10),
      })
    }
  }

  const plan = lotes(ips, celdas.length)
  const elementos = ips.length * celdas.length
  console.log(`Tiempos de Bogotá → IPS activas de los departamentos ${args.departamentos.join(', ')}`)
  console.log(`Celdas (orígenes): ${celdas.map(c => c.name).join(', ')}`)
  console.log(`IPS (destinos): ${ips.length}${sinCoordenadas ? ` (sin coordenadas, se omiten: ${sinCoordenadas})` : ''}`)
  console.log(`Plan: ${plan.length} petición(es) · ${elementos} elementos · costo ${usd(elementos * COST_PER_ELEMENT_USD)}`)
  console.log('\nHoy (mejor celda por IPS):')
  for (const h of ips) {
    const antes = mejorAntes.get(h.id)
    console.log(`  ${h.municipality_id} ${h.name}: ${antes ? `${minutos(antes.segundos)} min, ${antes.km ?? '?'} km desde ${antes.celda} (${antes.fecha})` : 'sin tiempo'}`)
  }

  if (!args.run) {
    console.log('\nDRY-RUN: no se llamó a Google ni se escribió nada.')
    return
  }
  if (googleRoutesDisabled()) throw new Error('GOOGLE_ROUTES_DISABLED=true: abortado sin llamar a Google')
  if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error('Falta GOOGLE_MAPS_API_KEY en .env.local')
  if ((args.maxElements as number) < elementos) {
    throw new Error(`El plan necesita ${elementos} elementos y el tope es ${args.maxElements}: no se llama a Google`)
  }

  const origenes = celdas.map(c => ({ lat: c.lat, lng: c.lng }))
  let facturados = 0
  let guardados = 0
  const sinRuta: string[] = []
  const mejorDespues = new Map<string, { segundos: number; km: number | null; celda: string }>()
  for (const lote of plan) {
    const result = await requestDistanceMatrix(origenes, lote.map(h => ({ lat: h.lat, lng: h.lng })), { networkRetries: 0 })
    facturados += result.elements_billed
    if (!result.ok) {
      console.error(`Google respondió ${result.status}${result.billing_uncertain ? ' (facturación incierta)' : ''}: no se guardó nada de este lote`)
      if (result.fatal) break
      continue
    }
    const ahora = new Date().toISOString()
    const filas: Array<Record<string, unknown>> = []
    celdas.forEach((celda, i) => {
      lote.forEach((h, j) => {
        const el = result.rows[i]?.[j]
        if (el?.status !== 'ok' || !finite(el.seconds)) {
          sinRuta.push(`${celda.name} → ${h.name}: ${el?.google_status ?? 'sin respuesta'}`)
          return
        }
        filas.push({
          hospital_id: h.id,
          kam_id: celda.id,
          travel_time: Math.round(el.seconds),
          distance: el.distance_km,
          source: 'google_maps',
          calculated_at: ahora,
          updated_at: ahora,
        })
        const previo = mejorDespues.get(h.id)
        if (!previo || el.seconds < previo.segundos) mejorDespues.set(h.id, { segundos: el.seconds, km: el.distance_km, celda: celda.name })
      })
    })
    if (filas.length > 0) {
      const { error } = await supabaseAdmin.from('hospital_kam_distances').upsert(filas, { onConflict: 'hospital_id,kam_id' })
      if (error) throw new Error(`Error guardando hospital_kam_distances: ${error.message} (Google ya facturó ${facturados} elementos)`)
      guardados += filas.length
    }
  }

  console.log('\nDespués (mejor celda por IPS):')
  for (const h of ips) {
    const antes = mejorAntes.get(h.id)
    const despues = mejorDespues.get(h.id)
    console.log(
      `  ${h.municipality_id} ${h.name}: ${antes ? minutos(antes.segundos) : '—'} → ${despues ? `${minutos(despues.segundos)} min, ${despues.km} km desde ${despues.celda}` : 'sin cambio'}`
    )
  }
  if (sinRuta.length > 0) console.log(`\nPares sin ruta o con error (no se tocaron): ${sinRuta.length}\n  ${sinRuta.join('\n  ')}`)
  console.log(`\nGuardados: ${guardados} de ${elementos} pares · facturados por Google (peor caso): ${facturados} elementos = ${usd(facturados * COST_PER_ELEMENT_USD)}`)
}

main().catch(error => {
  console.error('ERROR:', error instanceof Error ? error.message : error)
  process.exit(1)
})
