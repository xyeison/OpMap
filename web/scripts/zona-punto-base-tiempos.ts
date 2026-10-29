/**
 * Recalcula con Google (Distance Matrix, driving) TODOS los tiempos guardados de UNA zona desde su punto base actual
 * (kams.lat/lng), REEMPLAZANDO los anteriores: hospital_kam_distances (las IPS activas que ya tenían par con la zona)
 * y municipality_travel_times (los municipios que ya tenían par). Es para cuando se mueve el punto base de una zona:
 * el flujo de siempre (ensure-routes, process-pending, fase2b --run) solo pide los pares que FALTAN.
 *
 * Caso (2026-10-28): con los 4 sectores de Bogotá, el punto base de Bogotá Norte pasa de Chapinero (sector Oriente)
 * a Usaquén (migración 0903, que respalda los tiempos de antes). Autorización del dueño: "Recalculalo asumo el costo"
 * (676 IPS + 795 municipios = 1.471 elementos ≈ 7,36 USD).
 *
 * Modos (desde web/):
 *   npx tsx scripts/zona-punto-base-tiempos.ts --zona <kam_id>
 *        → dry-run (por defecto): zona, punto, pares, peticiones y costo. NO llama a Google ni escribe.
 *   npx tsx scripts/zona-punto-base-tiempos.ts --zona <kam_id> --run --punto <lat>,<lng> --max-elements 1500
 *        → llama a Google (tope duro de elementos, sin reintentos) y reemplaza los tiempos de la zona. --punto debe
 *          coincidir con kams.lat/lng (confirma que el punto ya se movió: correrlo antes pagaría los tiempos viejos):
 *            IPS con ruta: travel_time (SEGUNDOS) y distance (km); IPS sin ruta: se borra el par (desde el punto
 *            nuevo no hay ruta; el motor lo trata como sin tiempo y la cola de pendientes lo vuelve a pedir).
 *            Municipio: status 'ok' / 'no_route' como en fase2b-municipios.
 *            Un error de Google o de red NO se guarda: se informa y el par queda con el tiempo anterior. Tras 3 lotes
 *            seguidos con error se detiene. Si algo quedó sin guardar, sale con código 1 y dice cómo repetir.
 *            Los pares de IPS inactivas o sin coordenadas (fuera del plan) se borran: su tiempo es del punto viejo.
 *   --antes-de <fecha ISO>: solo los pares calculados antes de esa fecha (para repetir sin volver a pagar los que ya
 *   quedaron bien en una corrida anterior; el script imprime la hora de inicio de cada corrida).
 * Después hay que recalcular, sin Google: scripts/fase1-recalculate.ts --yes, scripts/fase2b-municipios.ts --assign y
 * scripts/fase2-recalculate.ts (cobertura por línea: la matriz zona→zona usa el punto y la localidad base).
 */
import path from 'path'
import dotenv from 'dotenv'
import { supabaseAdmin } from '../lib/supabase-admin'
import { COST_PER_ELEMENT_USD, MAX_DESTINATIONS, googleRoutesDisabled, requestDistanceMatrix } from '../lib/google-distance'
import { upsertTravelTimes, type TravelTimeUpsertRow } from '../lib/municipality-coverage'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

interface Args {
  zona: string
  run: boolean
  maxElements: number | null
  antesDe: string | null
  punto: { lat: number; lng: number } | null
}

/** Lotes seguidos con error (no fatales) tras los que se detiene la corrida: Google pudo facturarlos sin guardar nada. */
const MAX_FALLAS_SEGUIDAS = 3

function parseArgs(argv: string[]): Args {
  const args: Args = { zona: '', run: false, maxElements: null, antesDe: null, punto: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--run') args.run = true
    else if (arg === '--zona') args.zona = String(argv[++i] ?? '').trim()
    else if (arg === '--antes-de') {
      const value = String(argv[++i] ?? '')
      if (Number.isNaN(Date.parse(value))) throw new Error('--antes-de debe ser una fecha ISO (p. ej. 2026-10-29T03:00:00Z)')
      args.antesDe = new Date(value).toISOString()
    } else if (arg === '--punto') {
      const [lat, lng] = String(argv[++i] ?? '').split(',').map(v => Number(v.trim()))
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('--punto debe ser "lat,lng" (p. ej. 4.706782,-74.039973)')
      args.punto = { lat, lng }
    } else if (arg === '--max-elements') {
      const value = Number(argv[++i])
      if (!Number.isInteger(value) || value <= 0) throw new Error('--max-elements debe ser un entero positivo')
      args.maxElements = value
    } else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!/^[0-9a-f-]{36}$/i.test(args.zona)) throw new Error('--zona es obligatorio: el id (uuid) de la zona en kams')
  if (args.run && args.maxElements === null) throw new Error('--run exige --max-elements N (tope duro de elementos a pedir a Google)')
  if (args.run && !args.punto) throw new Error('--run exige --punto lat,lng: el punto base nuevo, que debe estar ya en kams')
  if (!args.run && args.maxElements !== null) throw new Error('--max-elements solo tiene sentido con --run')
  return args
}

interface Destino {
  id: string // hospital_id o código DANE del municipio
  nombre: string
  lat: number
  lng: number
  antes: number | null // SEGUNDOS (IPS) o MINUTOS (municipio)
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const num = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value))
const usd = (n: number) => `${n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`

/** Lee todas las filas paginando de 1000 en 1000 (límite de PostgREST). */
async function todas<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

function lotes<T>(items: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += MAX_DESTINATIONS) out.push(items.slice(i, i + MAX_DESTINATIONS))
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const { data: zona, error: zonaError } = await supabaseAdmin
    .from('kams')
    .select('id, name, base_city, area_id, lat, lng')
    .eq('id', args.zona)
    .maybeSingle()
  if (zonaError) throw new Error(`Error leyendo kams: ${zonaError.message}`)
  if (!zona) throw new Error(`No existe la zona ${args.zona}`)
  const origen = { lat: num(zona.lat), lng: num(zona.lng) }
  if (!finite(origen.lat) || !finite(origen.lng)) throw new Error('La zona no tiene punto base (lat/lng)')
  if (args.punto && (Math.abs(args.punto.lat - origen.lat) > 1e-6 || Math.abs(args.punto.lng - origen.lng) > 1e-6)) {
    throw new Error(`--punto ${args.punto.lat},${args.punto.lng} no es el punto base guardado (${origen.lat}, ${origen.lng}): no se llama a Google`)
  }

  const pares = await todas<any>((from, to) =>
    supabaseAdmin
      .from('hospital_kam_distances')
      .select('hospital_id, travel_time, calculated_at, hospitals!inner(name, lat, lng, active)')
      .eq('kam_id', zona.id)
      .order('hospital_id')
      .range(from, to)
  )
  const viejo = (calculatedAt: unknown) => !args.antesDe || !calculatedAt || String(calculatedAt) < args.antesDe
  const enPlan = (p: any) => p.hospitals?.active === true && finite(num(p.hospitals?.lat)) && finite(num(p.hospitals?.lng))
  const ips: Destino[] = pares
    .filter(p => enPlan(p) && viejo(p.calculated_at))
    .map(p => ({ id: p.hospital_id, nombre: p.hospitals.name, lat: num(p.hospitals.lat) as number, lng: num(p.hospitals.lng) as number, antes: num(p.travel_time) }))
  // Pares de IPS inactivas o sin coordenadas: tiempo del punto viejo que nadie recalcula; se borran (costo 0). Con
  // --antes-de no se tocan (es una corrida de repaso).
  const ipsFueraDelPlan: string[] = args.antesDe ? [] : pares.filter(p => !enPlan(p)).map(p => p.hospital_id)
  const ipsFuera = pares.length - ips.length

  const tiempos = await todas<any>((from, to) =>
    supabaseAdmin
      .from('municipality_travel_times')
      .select('municipality_code, travel_minutes, status, calculated_at, municipalities!inner(name, lat, lng)')
      .eq('kam_id', zona.id)
      .order('municipality_code')
      .range(from, to)
  )
  const municipios: Destino[] = tiempos
    .filter(t => finite(num(t.municipalities?.lat)) && finite(num(t.municipalities?.lng)) && viejo(t.calculated_at))
    .map(t => ({ id: t.municipality_code, nombre: t.municipalities.name, lat: num(t.municipalities.lat) as number, lng: num(t.municipalities.lng) as number, antes: num(t.travel_minutes) }))
  const municipiosFuera = tiempos.length - municipios.length

  const elementos = ips.length + municipios.length
  const planIps = lotes(ips)
  const planMunicipios = lotes(municipios)
  console.log(`Zona: ${zona.name} (${zona.base_city ?? '-'}, ${zona.area_id}) · punto base ${origen.lat}, ${origen.lng}`)
  console.log(`IPS: ${ips.length} pares${ipsFuera ? ` (se omiten ${ipsFuera}: inactivas, sin coordenadas o ya recalculadas)` : ''}`)
  if (ipsFueraDelPlan.length > 0) console.log(`  Con --run se borran ${ipsFueraDelPlan.length} pares de IPS inactivas o sin coordenadas (tiempo del punto viejo; costo 0)`)
  console.log(`Municipios: ${municipios.length} pares${municipiosFuera ? ` (se omiten ${municipiosFuera})` : ''}`)
  console.log(`Plan: ${planIps.length + planMunicipios.length} petición(es) · ${elementos} elementos · costo ${usd(elementos * COST_PER_ELEMENT_USD)}`)

  if (!args.run) {
    console.log('\nDRY-RUN: no se llamó a Google ni se escribió nada.')
    return
  }
  if (elementos === 0) {
    console.log('\nNada que pedir.')
    return
  }
  if (googleRoutesDisabled()) throw new Error('GOOGLE_ROUTES_DISABLED=true: abortado sin llamar a Google')
  if (!process.env.GOOGLE_MAPS_API_KEY) throw new Error('Falta GOOGLE_MAPS_API_KEY en .env.local')
  if ((args.maxElements as number) < elementos) {
    throw new Error(`El plan necesita ${elementos} elementos y el tope es ${args.maxElements}: no se llama a Google`)
  }

  const inicio = new Date().toISOString()
  console.log(`\nInicio de la corrida: ${inicio} (para repetir lo que falte: --antes-de ${inicio})`)
  if (ipsFueraDelPlan.length > 0) {
    const { error } = await supabaseAdmin.from('hospital_kam_distances').delete().eq('kam_id', zona.id).in('hospital_id', ipsFueraDelPlan)
    if (error) throw new Error(`Error borrando pares de IPS inactivas o sin coordenadas: ${error.message} (aún no se llamó a Google)`)
  }

  let facturados = 0
  const errores: string[] = []
  const resumen = { ips_ok: 0, ips_sin_ruta: 0, municipios_ok: 0, municipios_sin_ruta: 0 }
  let detenido = false
  let fallasSeguidas = 0
  let sinPedir = 0
  // Un lote que Google no respondió bien: se informa; un fatal o MAX_FALLAS_SEGUIDAS seguidos detienen la corrida
  const loteFallido = (tipo: string, lote: Destino[], result: { status: string; billing_uncertain?: boolean; fatal?: boolean }) => {
    errores.push(`${tipo}: Google respondió ${result.status} en un lote de ${lote.length}${result.billing_uncertain ? ' (facturación incierta)' : ''}`)
    fallasSeguidas++
    if (result.fatal || fallasSeguidas >= MAX_FALLAS_SEGUIDAS) detenido = true
  }

  for (const lote of planIps) {
    if (detenido) {
      sinPedir += lote.length
      continue
    }
    const result = await requestDistanceMatrix([origen as { lat: number; lng: number }], lote.map(d => ({ lat: d.lat, lng: d.lng })), { networkRetries: 0 })
    facturados += result.elements_billed
    if (!result.ok) {
      loteFallido('IPS', lote, result)
      continue
    }
    fallasSeguidas = 0
    const ahora = new Date().toISOString()
    const filas: Array<Record<string, unknown>> = []
    const sinRuta: string[] = []
    lote.forEach((destino, j) => {
      const el = result.rows[0]?.[j]
      if (el?.status === 'ok' && finite(el.seconds)) {
        filas.push({ hospital_id: destino.id, kam_id: zona.id, travel_time: Math.round(el.seconds), distance: el.distance_km, source: 'google_maps', calculated_at: ahora, updated_at: ahora })
      } else if (el?.status === 'no_route') {
        sinRuta.push(destino.id)
      } else {
        errores.push(`IPS ${destino.nombre}: ${el?.google_status ?? 'sin respuesta'}`)
      }
    })
    if (filas.length > 0) {
      const { error } = await supabaseAdmin.from('hospital_kam_distances').upsert(filas, { onConflict: 'hospital_id,kam_id' })
      if (error) throw new Error(`Error guardando hospital_kam_distances: ${error.message} (Google ya facturó ${facturados} elementos)`)
      resumen.ips_ok += filas.length
    }
    if (sinRuta.length > 0) {
      const { error } = await supabaseAdmin.from('hospital_kam_distances').delete().eq('kam_id', zona.id).in('hospital_id', sinRuta)
      if (error) throw new Error(`Error borrando pares sin ruta: ${error.message} (Google ya facturó ${facturados} elementos)`)
      resumen.ips_sin_ruta += sinRuta.length
    }
  }

  for (const lote of planMunicipios) {
    if (detenido) {
      sinPedir += lote.length
      continue
    }
    const result = await requestDistanceMatrix([origen as { lat: number; lng: number }], lote.map(d => ({ lat: d.lat, lng: d.lng })), { networkRetries: 0 })
    facturados += result.elements_billed
    if (!result.ok) {
      loteFallido('Municipios', lote, result)
      continue
    }
    fallasSeguidas = 0
    const ahora = new Date().toISOString()
    const filas: TravelTimeUpsertRow[] = []
    lote.forEach((destino, j) => {
      const el = result.rows[0]?.[j]
      if (el?.status === 'ok' && finite(el.minutes)) {
        filas.push({ kam_id: zona.id, municipality_code: destino.id, travel_minutes: el.minutes, distance_km: el.distance_km, status: 'ok', source: 'google_maps', calculated_at: ahora })
        resumen.municipios_ok++
      } else if (el?.status === 'no_route') {
        filas.push({ kam_id: zona.id, municipality_code: destino.id, travel_minutes: null, distance_km: null, status: 'no_route', source: 'google_maps', calculated_at: ahora })
        resumen.municipios_sin_ruta++
      } else {
        errores.push(`Municipio ${destino.nombre}: ${el?.google_status ?? 'sin respuesta'}`)
      }
    })
    try {
      await upsertTravelTimes(filas)
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : String(error)} (Google ya facturó ${facturados} elementos)`)
    }
  }

  console.log('\nResultado')
  if (ipsFueraDelPlan.length > 0) console.log(`  IPS inactivas o sin coordenadas: ${ipsFueraDelPlan.length} pares borrados`)
  console.log(`  IPS: ${resumen.ips_ok} con tiempo nuevo, ${resumen.ips_sin_ruta} sin ruta (par borrado)`)
  console.log(`  Municipios: ${resumen.municipios_ok} con tiempo nuevo, ${resumen.municipios_sin_ruta} sin ruta`)
  console.log(`  Elementos facturados por Google: ${facturados} · costo ${usd(facturados * COST_PER_ELEMENT_USD)}`)
  if (errores.length > 0) {
    console.log(`  Sin guardar por error (${errores.length}):`)
    for (const linea of errores.slice(0, 30)) console.log(`    ${linea}`)
  }
  if (detenido) console.log(`  Se detuvo antes de terminar (error fatal o ${MAX_FALLAS_SEGUIDAS} lotes seguidos con error): ${sinPedir} pares sin pedir.`)
  if (detenido || errores.length > 0) {
    console.log(`\nNO recalcular todavía: hay tiempos del punto viejo mezclados con los nuevos. Repetir lo que falta con`)
    console.log(`  --antes-de ${inicio}`)
    process.exitCode = 1
    return
  }
  console.log('\nDespués, sin Google: npx tsx scripts/fase1-recalculate.ts --yes, npx tsx scripts/fase2b-municipios.ts --assign')
  console.log('y npx tsx scripts/fase2-recalculate.ts (cobertura por línea).')
}

main().catch(error => {
  console.error('ERROR:', error instanceof Error ? error.message : error)
  process.exit(1)
})
