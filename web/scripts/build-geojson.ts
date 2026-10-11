// Fase 2b · Consolida los polígonos de municipios (1.121) y localidades de Bogotá (20) en dos
// archivos estáticos simplificados que el mapa carga UNA sola vez:
//   public/geo/municipios.json   FeatureCollection de municipios, SIN Bogotá (11001)
//   public/geo/localidades.json  FeatureCollection de las 20 localidades (código 11001xx)
// Cada feature queda con properties = { code, name, dept }.
//
// Municipios y localidades se simplifican en UNA sola pasada de mapshaper para que los bordes
// compartidos (Bogotá ↔ Cundinamarca y entre vecinos) queden idénticos y no aparezcan huecos.
// Municipios: se prueba 8 %, 6 %, 5 %… (keep-shapes) hasta que el total pese ≤ --max-mb (4 MB).
// Localidades: se conserva el 40 % de vértices (simplificación variable en la misma pasada): al 8 %
// global las localidades pequeñas quedaban como cuadriláteros (Barrios Unidos con 5 vértices).
//
// Uso:
//   npx tsx scripts/build-geojson.ts
//   npx tsx scripts/build-geojson.ts --src <dir con municipalities/ y localities/> --max-mb 4
// Verificación de códigos: si .env.local tiene SUPABASE_SERVICE_ROLE_KEY se leen los códigos de
// municipalities (solo SELECT); con --codes-file <json> se usa ese archivo ([{code,name}] o [code]).
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const WEB_DIR = path.resolve(__dirname, '..')
const REPO_DIR = path.resolve(WEB_DIR, '..')
const OUT_DIR = path.join(WEB_DIR, 'public', 'geo')
const BOGOTA = '11001'
const SIMPLIFY_STEPS = ['8%', '6%', '5%', '4%', '3%', '2%']
const LOCALITY_KEEP = 0.4 // fracción de vértices que conservan las localidades de Bogotá

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function findSourceDir(): string {
  const candidates = [
    arg('src'),
    path.join(REPO_DIR, 'Trash', 'data', 'geojson'),
    path.join(REPO_DIR, 'data', 'geojson'),
  ].filter(Boolean) as string[]
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'municipalities')) && fs.existsSync(path.join(c, 'localities'))) return c
  }
  throw new Error(`No se encontró la carpeta de GeoJSON (probado: ${candidates.join(', ')}). Use --src <dir>.`)
}

type Props = { code: string; name: string; dept: string; layer: 'm' | 'l' }

function readFeatures(file: string): any[] {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (data?.type === 'FeatureCollection') return Array.isArray(data.features) ? data.features : []
  if (data?.type === 'Feature') return [data]
  return []
}

// Código DANE: nombre de archivo → feature.id → properties.code/id
function deduceCode(file: string, feature: any, digits: number): string | null {
  const re = new RegExp(`^\\d{${digits}}$`)
  const fromFile = path.basename(file).replace(/\.(geo)?json$/i, '')
  for (const c of [fromFile, feature?.id, feature?.properties?.code, feature?.properties?.id]) {
    const s = c === undefined || c === null ? '' : String(c).trim()
    if (re.test(s)) return s
  }
  return null
}

async function loadDbMunicipalities(): Promise<Map<string, string> | null> {
  const codesFile = arg('codes-file')
  if (codesFile) {
    const raw = JSON.parse(fs.readFileSync(codesFile, 'utf8'))
    const map = new Map<string, string>()
    for (const r of raw) {
      if (typeof r === 'string') map.set(r, '')
      else if (r?.code) map.set(String(r.code), r.name ? String(r.name) : '')
    }
    return map
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { supabaseAdmin } = await import('../lib/supabase-admin')
  const map = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('municipalities')
      .select('code, name')
      .order('code')
      .range(from, from + 999)
    if (error) throw error
    for (const r of (data || []) as any[]) map.set(String(r.code), String(r.name ?? ''))
    if (!data || data.length < 1000) break
  }
  return map
}

function fileSize(p: string): number {
  return fs.statSync(p).size
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

async function main() {
  const srcDir = findSourceDir()
  const maxBytes = Math.round(Number(arg('max-mb') || 4) * 1024 * 1024)
  console.log(`Origen: ${srcDir}`)

  const db = await loadDbMunicipalities()
  if (!db) console.warn('AVISO: sin SUPABASE_SERVICE_ROLE_KEY ni --codes-file; no se verifican los códigos contra municipalities')

  const features: any[] = []
  const skipped: string[] = []
  const seen = new Set<string>()

  // Municipios
  const muniDir = path.join(srcDir, 'municipalities')
  const muniFiles = fs.readdirSync(muniDir).filter(f => /\.(geo)?json$/i.test(f)).sort()
  for (const f of muniFiles) {
    const file = path.join(muniDir, f)
    for (const feat of readFeatures(file)) {
      const code = deduceCode(file, feat, 5)
      if (!code || !feat.geometry) { skipped.push(f); continue }
      if (code === BOGOTA) continue // Bogotá se pinta por localidades
      if (seen.has(code)) { skipped.push(`${f} (duplicado ${code})`); continue }
      seen.add(code)
      const p = feat.properties || {}
      const props: Props = {
        code,
        name: (db?.get(code) || p.name || code).toString(),
        dept: String(p.departmentId || code.slice(0, 2)).padStart(2, '0'),
        layer: 'm',
      }
      features.push({ type: 'Feature', properties: props, geometry: feat.geometry })
    }
  }

  // Localidades de Bogotá
  const locDir = path.join(srcDir, 'localities')
  const locFiles = fs.readdirSync(locDir).filter(f => /\.(geo)?json$/i.test(f)).sort()
  let localities = 0
  for (const f of locFiles) {
    const file = path.join(locDir, f)
    for (const feat of readFeatures(file)) {
      const code = deduceCode(file, feat, 7)
      if (!code || !code.startsWith(BOGOTA) || !feat.geometry) { skipped.push(f); continue }
      if (seen.has(code)) { skipped.push(`${f} (duplicado ${code})`); continue }
      seen.add(code)
      localities++
      features.push({
        type: 'Feature',
        properties: { code, name: String(feat.properties?.name || code), dept: '11', layer: 'l' } as Props,
        geometry: feat.geometry,
      })
    }
  }

  const muniCodes = features.filter(f => f.properties.layer === 'm').map(f => f.properties.code as string)
  console.log(`Leídos: ${muniCodes.length} municipios (sin ${BOGOTA}) y ${localities} localidades`)

  // Cruce con la tabla municipalities
  let notInDb: string[] = []
  let withoutPolygon: string[] = []
  if (db) {
    notInDb = muniCodes.filter(c => !db.has(c))
    withoutPolygon = Array.from(db.keys()).filter(c => c !== BOGOTA && !seen.has(c)).sort()
    console.log(`Códigos del GeoJSON que no están en municipalities: ${notInDb.length}${notInDb.length ? ' → ' + notInDb.join(', ') : ''}`)
    console.log(`Municipios de la tabla sin polígono: ${withoutPolygon.length}${withoutPolygon.length ? ' → ' + withoutPolygon.join(', ') : ''}`)
  }

  // Simplificación con mapshaper (una sola pasada para ambas capas)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opmap-geo-'))
  const input = path.join(tmp, 'all.json')
  fs.writeFileSync(input, JSON.stringify({ type: 'FeatureCollection', features }))
  console.log(`Entrada combinada: ${mb(fileSize(input))}`)

  const bin = path.join(WEB_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'mapshaper.cmd' : 'mapshaper')
  if (!fs.existsSync(bin)) throw new Error('mapshaper no está instalado (npm install -D mapshaper)')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outMunis = path.join(OUT_DIR, 'municipios.json')
  const outLocs = path.join(OUT_DIR, 'localidades.json')
  let chosen = ''
  for (const pct of SIMPLIFY_STEPS) {
    const outDir = path.join(tmp, `s${pct.replace('%', '')}`)
    fs.mkdirSync(outDir)
    execFileSync(bin, [
      '-i', input,
      '-simplify', 'variable', `percentage=layer == 'l' ? ${LOCALITY_KEEP} : ${parseFloat(pct) / 100}`, 'keep-shapes',
      '-clean',
      '-split', 'layer',
      '-o', outDir + path.sep, 'format=geojson', 'precision=0.00001',
    ], { stdio: ['ignore', 'ignore', 'inherit'] })

    const produced = fs.readdirSync(outDir)
    const pick = (suffix: string) => {
      const name = produced.find(n => n === `${suffix}.json` || n.endsWith(`-${suffix}.json`))
      if (!name) throw new Error(`mapshaper no produjo la capa "${suffix}" (salida: ${produced.join(', ')})`)
      return JSON.parse(fs.readFileSync(path.join(outDir, name), 'utf8'))
    }
    const strip = (fc: any) => ({
      type: 'FeatureCollection',
      features: (fc.features || [])
        .filter((f: any) => f.geometry)
        .map((f: any) => ({
          type: 'Feature',
          properties: { code: f.properties.code, name: f.properties.name, dept: f.properties.dept },
          geometry: f.geometry,
        })),
    })
    const munis = strip(pick('m'))
    const locs = strip(pick('l'))
    const munisJson = JSON.stringify(munis)
    const locsJson = JSON.stringify(locs)
    const total = Buffer.byteLength(munisJson) + Buffer.byteLength(locsJson)
    console.log(`simplify ${pct}: municipios ${mb(Buffer.byteLength(munisJson))} (${munis.features.length}), localidades ${mb(Buffer.byteLength(locsJson))} (${locs.features.length}) → total ${mb(total)}`)
    if (total <= maxBytes || pct === SIMPLIFY_STEPS[SIMPLIFY_STEPS.length - 1]) {
      fs.writeFileSync(outMunis, munisJson)
      fs.writeFileSync(outLocs, locsJson)
      chosen = pct
      const lost = muniCodes.length + localities - munis.features.length - locs.features.length
      if (lost > 0) console.warn(`AVISO: ${lost} polígonos se perdieron en la simplificación`)
      break
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true })

  console.log('')
  console.log('Resultado')
  console.log(`  simplify elegido: municipios ${chosen}, localidades ${LOCALITY_KEEP * 100}% (keep-shapes, -clean, precisión 0.00001°)`)
  console.log(`  ${path.relative(WEB_DIR, outMunis)}: ${mb(fileSize(outMunis))}`)
  console.log(`  ${path.relative(WEB_DIR, outLocs)}: ${mb(fileSize(outLocs))}`)
  console.log(`  archivos omitidos: ${skipped.length}${skipped.length ? ' → ' + skipped.join(', ') : ''}`)
  if (db) console.log(`  códigos que no cruzaron: ${notInDb.length} del GeoJSON sin fila en municipalities; ${withoutPolygon.length} de la tabla sin polígono`)
}

main().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
