// Polígonos del mapa a partir del Marco Geoestadístico Nacional del DANE (MGN 2025).
// Dueño, 2026-10-29 ("Si"): los colores de las Zonas deben seguir las fronteras reales.
// Spec: docs/specs/2026-10-29-mapa-poligonos-dane.md
//
// Entradas
//   --dane         capa de municipios del MGN 2025: MGN2025_MPIO_GRAFICO.zip del geoportal del DANE
//                  (https://geoportal.dane.gov.co/descargas/mgn_2025/MGN2025_MPIO_GRAFICO.zip, 72 MB), su carpeta
//                  descomprimida o el .shp (capa MGN_ADM_MPIO_GRAFICO, WGS84)
//   --localidades  carpeta con las 20 localidades de Bogotá (1100101.geojson…); por defecto
//                  Trash/data/geojson/localities o data/geojson/localities. La capa del DANE no las trae.
// Salidas (--out, por defecto web/public/geo)
//   municipios.json      vista de país: municipios sin Bogotá (11001); properties = { code, name, dept }
//   localidades.json     vista de país: las 20 localidades, ajustadas al polígono de Bogotá del DANE
//   detalle/<dd>.json    detalle por departamento para el zoom alto (11 = las 20 localidades)
//
// Cada nivel sale de UNA pasada de mapshaper sobre municipios y localidades juntos: cada frontera es un solo arco que
// usan los dos vecinos, así que no quedan rendijas ni encimes. La vista de país toma el umbral más fino de
// PAIS_INTERVALOS_M que quepa en --pais-mb (el peso de antes); el detalle usa --detalle-m.
//
// Ajuste de Bogotá: las localidades se recortan con el polígono de Bogotá del DANE y cada pedazo de Bogotá que
// ninguna cubre pasa a la localidad con la que comparte más frontera.
// Códigos del DANE que no están en `municipalities`: su área se pinta con el municipio de HUERFANOS. Un código nuevo
// sin entrada detiene el generador.
//
// Uso (desde web/):
//   npx tsx scripts/build-geojson.ts --dane <zip, carpeta o .shp> [--localidades <carpeta>] [--out <dir>]
//     [--pais-mb 1.47] [--detalle-m 15] [--codes-file <json>]
// Códigos: con SUPABASE_SERVICE_ROLE_KEY en .env.local se leen de municipalities (solo SELECT); con --codes-file se
// usa ese archivo ([{code,name}] o [code]); sin ninguno, los del municipios.json actual (más 11001).
import fs from 'fs'
import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { execFileSync } from 'child_process'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const WEB_DIR = path.resolve(__dirname, '..')
const REPO_DIR = path.resolve(WEB_DIR, '..')
const GEO_ACTUAL = path.join(WEB_DIR, 'public', 'geo', 'municipios.json')
const BOGOTA = '11001'
const CAPA_DANE = 'MGN_ADM_MPIO_GRAFICO'
/** Municipios del DANE que aún no están en `municipalities` → municipio con el que se pintan */
const HUERFANOS: Record<string, string> = {
  // Nuevo Belén de Bajirá (Chocó) salió de Riosucio; en el mapa anterior el 99 % de su área ya era Riosucio
  '27493': '27615',
}
/** Umbrales de la vista de país en metros, del más fino al más grueso: se usa el primero que quepa en --pais-mb */
const PAIS_INTERVALOS_M = [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000]
const PRECISION = '0.00001' // ≈ 1 m
const LOCALIDADES = 20
/** Lo que el polígono de Bogotá del DANE y las localidades ajustadas pueden diferir */
const MAX_DIFERENCIA_BOGOTA_KM2 = 0.01
/** Rendijas (huecos dentro del país) y encimes que tolera cada nivel */
const MAX_RENDIJAS_KM2 = 0.01
const MAX_ENCIMES_KM2 = 0.01

type Pos = number[]
type Geometria = { type: 'Polygon'; coordinates: Pos[][] } | { type: 'MultiPolygon'; coordinates: Pos[][][] }
type Feature = { type: 'Feature'; properties: Record<string, any>; geometry: Geometria | null }
type Coleccion = { type: 'FeatureCollection'; features: Feature[] }

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
const comprimido = (texto: string) => zlib.gzipSync(texto, { level: 9 }).length
const leer = (archivo: string): Coleccion => JSON.parse(fs.readFileSync(archivo, 'utf8'))
const escribir = (archivo: string, datos: unknown) => fs.writeFileSync(archivo, JSON.stringify(datos))
const coleccion = (features: Feature[]): Coleccion => ({ type: 'FeatureCollection', features })

const MAPSHAPER = path.join(WEB_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'mapshaper-xl.cmd' : 'mapshaper-xl')
function mapshaper(args: string[]) {
  if (!fs.existsSync(MAPSHAPER)) throw new Error('mapshaper no está instalado (npm install -D mapshaper)')
  execFileSync(MAPSHAPER, ['-quiet', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
}

function buscarShapefile(entrada: string, tmp: string): string {
  const p = path.resolve(entrada)
  if (!fs.existsSync(p)) throw new Error(`No existe ${p}`)
  if (p.toLowerCase().endsWith('.shp')) return p
  if (p.toLowerCase().endsWith('.zip')) {
    const dir = path.join(tmp, 'mgn')
    fs.mkdirSync(dir)
    execFileSync('unzip', ['-q', '-o', p, '-d', dir])
    return buscarShapefile(dir, tmp)
  }
  if (fs.statSync(p).isDirectory()) {
    const shp = fs.readdirSync(p).find(f => f.toUpperCase() === `${CAPA_DANE}.SHP`)
    if (shp) return path.join(p, shp)
  }
  throw new Error(`No se encontró ${CAPA_DANE}.shp en ${p}`)
}

function buscarLocalidades(): string {
  const candidatos = [
    arg('localidades'),
    path.join(REPO_DIR, 'Trash', 'data', 'geojson', 'localities'),
    path.join(REPO_DIR, 'data', 'geojson', 'localities'),
  ].filter(Boolean) as string[]
  const dir = candidatos.find(c => fs.existsSync(c) && fs.statSync(c).isDirectory())
  if (!dir) throw new Error(`No se encontraron las localidades (probado: ${candidatos.join(', ')}). Use --localidades <carpeta>.`)
  return dir
}

/** Las 20 localidades de la carpeta: properties = { code, name } (código del archivo, del id o de properties) */
function leerLocalidades(dir: string): Coleccion {
  const features: Feature[] = []
  for (const archivo of fs.readdirSync(dir).filter(f => /\.(geo)?json$/i.test(f)).sort()) {
    const datos = JSON.parse(fs.readFileSync(path.join(dir, archivo), 'utf8'))
    const lista = datos?.type === 'FeatureCollection' ? datos.features : [datos]
    for (const f of lista) {
      const code = [archivo.replace(/\.(geo)?json$/i, ''), f?.id, f?.properties?.code]
        .map(c => (c === undefined || c === null ? '' : String(c).trim()))
        .find(c => /^11001\d{2}$/.test(c))
      if (!code || !f?.geometry) throw new Error(`Localidad sin código o sin polígono: ${archivo}`)
      features.push({ type: 'Feature', properties: { code, name: String(f.properties?.name || code) }, geometry: f.geometry })
    }
  }
  const codigos = new Set(features.map(f => f.properties.code))
  if (features.length !== LOCALIDADES || codigos.size !== LOCALIDADES) {
    throw new Error(`Se esperaban ${LOCALIDADES} localidades distintas y hay ${features.length} (${codigos.size} códigos)`)
  }
  return coleccion(features)
}

/** Nombres del municipios.json actual (los de la base al generarlo) */
function nombresActuales(): Map<string, string> {
  const nombres = new Map<string, string>()
  if (!fs.existsSync(GEO_ACTUAL)) return nombres
  for (const f of leer(GEO_ACTUAL).features) nombres.set(String(f.properties?.code), String(f.properties?.name ?? ''))
  return nombres
}

async function municipiosDeLaBase(actuales: Map<string, string>): Promise<{ nombres: Map<string, string>; origen: string }> {
  const codesFile = arg('codes-file')
  if (codesFile) {
    const nombres = new Map<string, string>()
    for (const r of JSON.parse(fs.readFileSync(codesFile, 'utf8'))) {
      if (typeof r === 'string') nombres.set(r, '')
      else if (r?.code) nombres.set(String(r.code), r.name ? String(r.name) : '')
    }
    return { nombres, origen: codesFile }
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { supabaseAdmin } = await import('../lib/supabase-admin')
    const nombres = new Map<string, string>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from('municipalities').select('code, name').order('code').range(from, from + 999)
      if (error) throw error
      for (const r of (data || []) as any[]) nombres.set(String(r.code), String(r.name ?? ''))
      if (!data || data.length < 1000) break
    }
    return { nombres, origen: 'tabla municipalities' }
  }
  if (actuales.size === 0) throw new Error('Sin SUPABASE_SERVICE_ROLE_KEY, sin --codes-file y sin municipios.json actual: no hay contra qué cruzar los códigos')
  return { nombres: new Map([...actuales, [BOGOTA, 'Bogotá D.C.']]), origen: 'municipios.json actual' }
}

const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())

// ---------- Geometría (sin dependencias) ----------

function anillos(g: Geometria | null): Pos[][] {
  if (!g) return []
  return g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()
}

/** Clave de un segmento sin importar su sentido: dos polígonos de la misma pasada comparten las mismas coordenadas */
const claveSegmento = (a: Pos, b: Pos) => {
  const k1 = `${a[0]},${a[1]}`
  const k2 = `${b[0]},${b[1]}`
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
}

function metros(a: Pos, b: Pos): number {
  const dx = (b[0] - a[0]) * 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  const dy = (b[1] - a[1]) * 110574
  return Math.hypot(dx, dy)
}

/** Área de un anillo en km² (proyección local; sirve para huecos pequeños) */
function areaAnilloKm2(anillo: Pos[]): number {
  const lat = anillo.reduce((s, p) => s + p[1], 0) / anillo.length
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180)
  const ky = 110.574
  let suma = 0
  for (let i = 0; i < anillo.length - 1; i++) {
    suma += anillo[i][0] * kx * (anillo[i + 1][1] * ky) - anillo[i + 1][0] * kx * (anillo[i][1] * ky)
  }
  return Math.abs(suma) / 2
}

/** Distancia mínima en metros entre los vértices de dos geometrías (para pedazos sin frontera compartida) */
function distanciaVertices(a: Geometria | null, b: Geometria | null): number {
  let min = Infinity
  for (const ra of anillos(a)) for (const p of ra) for (const rb of anillos(b)) for (const q of rb) min = Math.min(min, metros(p, q))
  return min
}

// ---------- Pasos ----------

/** Recorta las localidades con Bogotá del DANE y reparte lo que ninguna cubre; devuelve el archivo ajustado */
function ajustarLocalidades(shp: string, localidades: Coleccion, tmp: string): { archivo: string; pedazos: number; repartidos: number; varias: number } {
  const bogota = path.join(tmp, 'bogota.json')
  mapshaper(['-i', shp, '-filter', `mpio_cdpmp == '${BOGOTA}'`, '-filter-fields', 'mpio_cdpmp', '-o', bogota, 'format=geojson'])
  const loc = path.join(tmp, 'loc.json')
  escribir(loc, localidades)
  mapshaper([
    '-i', bogota, loc, 'combine-files',
    '-clip', 'source=bogota', 'target=loc', '+', 'name=recortadas',
    '-erase', 'source=loc', 'target=bogota', '+', 'name=faltan',
    '-explode', 'target=faltan',
    '-o', tmp + path.sep, 'target=recortadas,faltan', 'format=geojson',
  ])
  const recortadas = leer(path.join(tmp, 'recortadas.json')).features
  const faltanArchivo = path.join(tmp, 'faltan.json')
  const faltan = fs.existsSync(faltanArchivo) ? leer(faltanArchivo).features.filter(f => f.geometry) : []

  const nombre = new Map(localidades.features.map(f => [f.properties.code as string, f.properties.name as string]))
  const duenoDe = new Map<string, string>()
  for (const f of recortadas) {
    for (const r of anillos(f.geometry)) for (let i = 0; i < r.length - 1; i++) duenoDe.set(claveSegmento(r[i], r[i + 1]), f.properties.code)
  }
  let varias = 0
  const repartidos: Feature[] = faltan.map(pedazo => {
    const porLocalidad = new Map<string, number>()
    for (const r of anillos(pedazo.geometry)) {
      for (let i = 0; i < r.length - 1; i++) {
        const dueno = duenoDe.get(claveSegmento(r[i], r[i + 1]))
        if (dueno) porLocalidad.set(dueno, (porLocalidad.get(dueno) || 0) + metros(r[i], r[i + 1]))
      }
    }
    if (porLocalidad.size > 1) varias++
    let code = [...porLocalidad.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!code) {
      // Sin frontera compartida (isla dentro de Bogotá): la localidad más cercana
      code = recortadas
        .map(f => ({ code: f.properties.code as string, d: distanciaVertices(pedazo.geometry, f.geometry) }))
        .sort((a, b) => a.d - b.d)[0].code
    }
    return { type: 'Feature', properties: { code, name: nombre.get(code) }, geometry: pedazo.geometry }
  })
  const repartidosArchivo = path.join(tmp, 'repartidos.json')
  escribir(repartidosArchivo, coleccion(repartidos))
  const ajustadas = path.join(tmp, 'localidades-ajustadas.json')
  mapshaper([
    '-i', path.join(tmp, 'recortadas.json'), repartidosArchivo, 'combine-files',
    '-merge-layers', 'force',
    '-dissolve', 'code', 'copy-fields=name',
    '-o', ajustadas, 'format=geojson',
  ])
  return { archivo: ajustadas, pedazos: faltan.length, repartidos: repartidos.length, varias }
}

/** km² de Bogotá del DANE sin localidad y de localidad fuera de Bogotá */
function diferenciaBogota(bogota: string, ajustadas: string, tmp: string): { falta: number; sobra: number } {
  const dir = path.join(tmp, 'diferencia')
  fs.mkdirSync(dir)
  mapshaper([
    '-i', bogota, ajustadas, 'combine-files',
    '-rename-layers', 'b,l',
    '-erase', 'source=l', 'target=b', '+', 'name=falta',
    '-erase', 'source=b', 'target=l', '+', 'name=sobra',
    '-each', 'a = this.area', 'target=falta,sobra',
    '-o', dir + path.sep, 'target=falta,sobra', 'format=json',
  ])
  const km2 = (archivo: string) => {
    const p = path.join(dir, archivo)
    if (!fs.existsSync(p)) return 0
    return (JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{ a?: number }>).reduce((s, r) => s + (r.a || 0), 0) / 1e6
  }
  return { falta: km2('falta.json'), sobra: km2('sobra.json') }
}

/** Rendijas (anillos interiores de la unión) y encimes (suma de áreas − área de la unión) de un nivel */
function revisarCobertura(archivo: string, tmp: string, etiqueta: string): { rendijas: number; rendijasKm2: number; encimesKm2: number } {
  const union = path.join(tmp, `union-${etiqueta}.json`)
  const areas = path.join(tmp, `areas-${etiqueta}.json`)
  const areaUnion = path.join(tmp, `area-union-${etiqueta}.json`)
  mapshaper(['-i', archivo, '-dissolve', '-o', union, 'format=geojson'])
  mapshaper(['-i', archivo, '-each', 'a = this.area', '-o', areas, 'format=json'])
  mapshaper(['-i', union, '-each', 'a = this.area', '-o', areaUnion, 'format=json'])
  const suma = (p: string) => (JSON.parse(fs.readFileSync(p, 'utf8')) as Array<{ a?: number }>).reduce((s, r) => s + (r.a || 0), 0) / 1e6
  let rendijas = 0
  let rendijasKm2 = 0
  // Sin atributos, mapshaper escribe la unión como GeometryCollection
  const datosUnion = JSON.parse(fs.readFileSync(union, 'utf8'))
  const geometrias: Array<Geometria | null> = datosUnion.type === 'GeometryCollection'
    ? datosUnion.geometries
    : (datosUnion.features || []).map((f: Feature) => f.geometry)
  for (const g of geometrias) {
    if (!g) continue
    const poligonos = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    for (const poligono of poligonos) {
      for (const hueco of poligono.slice(1)) {
        rendijas++
        rendijasKm2 += areaAnilloKm2(hueco)
      }
    }
  }
  return { rendijas, rendijasKm2, encimesKm2: Math.max(0, suma(areas) - suma(areaUnion)) }
}

/** Municipios y localidades de una salida de mapshaper, con properties = { code, name, dept } */
function separar(archivo: string, nombreMunicipio: (code: string) => string): { municipios: Coleccion; localidades: Coleccion } {
  const municipios: Feature[] = []
  const localidades: Feature[] = []
  for (const f of leer(archivo).features) {
    if (!f.geometry) continue
    const code = String(f.properties.code)
    const esLocalidad = f.properties.layer === 'l'
    const properties = {
      code,
      name: esLocalidad ? String(f.properties.name ?? code) : nombreMunicipio(code),
      dept: esLocalidad ? '11' : String(f.properties.dept ?? code.slice(0, 2)).padStart(2, '0'),
    }
    ;(esLocalidad ? localidades : municipios).push({ type: 'Feature', properties, geometry: f.geometry })
  }
  const orden = (a: Feature, b: Feature) => String(a.properties.code).localeCompare(String(b.properties.code))
  return { municipios: coleccion(municipios.sort(orden)), localidades: coleccion(localidades.sort(orden)) }
}

async function main() {
  const daneArg = arg('dane')
  if (!daneArg) throw new Error('Falta --dane <MGN2025_MPIO_GRAFICO.zip, su carpeta o el .shp>')
  const outDir = path.resolve(arg('out') || path.join(WEB_DIR, 'public', 'geo'))
  const paisMaxBytes = Math.round(Number(arg('pais-mb') || 1.47) * 1024 * 1024)
  const detalleM = Number(arg('detalle-m') || 15)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opmap-dane-'))
  const fallas: string[] = []

  try {
    const shp = buscarShapefile(daneArg, tmp)
    console.log(`DANE: ${shp}`)
    const actuales = nombresActuales()
    const base = await municipiosDeLaBase(actuales)
    console.log(`Códigos de la base: ${base.nombres.size} (${base.origen})`)

    // 1. Cruce de códigos
    const atributos = path.join(tmp, 'atributos.json')
    mapshaper(['-i', shp, '-filter-fields', 'mpio_cdpmp,mpio_cnmbr', '-o', atributos, 'format=json'])
    const dane = JSON.parse(fs.readFileSync(atributos, 'utf8')) as Array<{ mpio_cdpmp: string; mpio_cnmbr: string }>
    const nombreDane = new Map(dane.map(r => [String(r.mpio_cdpmp), String(r.mpio_cnmbr)]))
    const sinBase = [...nombreDane.keys()].filter(c => !base.nombres.has(c)).sort()
    for (const c of sinBase) {
      const destino = HUERFANOS[c]
      if (!destino) throw new Error(`El DANE trae ${c} (${nombreDane.get(c)}) y no está en municipalities: agréguelo a HUERFANOS o a la base`)
      if (!nombreDane.has(destino) || !base.nombres.has(destino)) throw new Error(`HUERFANOS: ${c} → ${destino}, que no existe`)
      console.log(`  ${c} ${nombreDane.get(c)}: no está en la base; su área se pinta con ${destino} ${base.nombres.get(destino) || nombreDane.get(destino)}`)
    }
    const sinPoligono = [...base.nombres.keys()].filter(c => !nombreDane.has(c)).sort()
    if (sinPoligono.length) throw new Error(`Municipios de la base sin polígono en el DANE: ${sinPoligono.join(', ')}`)
    const nombreMunicipio = (code: string) =>
      base.nombres.get(code) || actuales.get(code) || titulo(nombreDane.get(code) || code)

    // 2. Localidades ajustadas a Bogotá del DANE
    const locDir = buscarLocalidades()
    const ajuste = ajustarLocalidades(shp, leerLocalidades(locDir), tmp)
    const diferencia = diferenciaBogota(path.join(tmp, 'bogota.json'), ajuste.archivo, tmp)
    console.log(`Localidades (${locDir}): ${ajuste.pedazos} pedazos de Bogotá sin localidad repartidos (${ajuste.varias} tocaban 2 o más)`)
    console.log(`  diferencia con Bogotá del DANE: faltan ${diferencia.falta.toFixed(4)} km², sobran ${diferencia.sobra.toFixed(4)} km²`)
    if (diferencia.falta > MAX_DIFERENCIA_BOGOTA_KM2 || diferencia.sobra > MAX_DIFERENCIA_BOGOTA_KM2) {
      fallas.push(`las localidades no cubren Bogotá del DANE (faltan ${diferencia.falta.toFixed(4)} km², sobran ${diferencia.sobra.toFixed(4)} km²)`)
    }

    // 3. Una pasada: municipios (sin Bogotá, huérfanos dentro de su municipio) + localidades, dos niveles
    const nivel = (m: number) => path.join(tmp, `nivel-${m}.json`)
    mapshaper([
      '-i', shp, ajuste.archivo, 'combine-files',
      '-rename-layers', 'dane,loc',
      '-rename-fields', 'code=mpio_cdpmp,dept=dpto_ccdgo', 'target=dane',
      '-filter-fields', 'code,dept', 'target=dane',
      '-filter', `code != '${BOGOTA}'`, 'target=dane',
      '-each', `code = (${JSON.stringify(HUERFANOS)})[code] || code`, 'target=dane',
      '-dissolve', 'code', 'copy-fields=dept', 'target=dane',
      '-each', "layer = 'm'", 'target=dane',
      '-each', "layer = 'l'", 'target=loc',
      '-merge-layers', 'target=dane,loc', 'force', 'name=todo',
      '-clean',
      '-simplify', `interval=${detalleM}`, 'keep-shapes',
      '-o', nivel(detalleM), 'format=geojson', `precision=${PRECISION}`,
      ...PAIS_INTERVALOS_M.flatMap(m => ['-simplify', `interval=${m}`, 'keep-shapes', '-o', nivel(m), 'format=geojson', `precision=${PRECISION}`]),
    ])

    // 4. Vista de país: el umbral más fino que quepa en el peso de antes
    let pais: { m: number; municipios: string; localidades: string } | null = null
    for (const m of PAIS_INTERVALOS_M) {
      const { municipios, localidades } = separar(nivel(m), nombreMunicipio)
      const textoM = JSON.stringify(municipios)
      const textoL = JSON.stringify(localidades)
      const bytes = Buffer.byteLength(textoM) + Buffer.byteLength(textoL)
      console.log(`  país a ${m} m: ${mb(bytes)} (${mb(comprimido(textoM) + comprimido(textoL))} comprimido)`)
      if (bytes <= paisMaxBytes) {
        pais = { m, municipios: textoM, localidades: textoL }
        break
      }
    }
    if (!pais) throw new Error(`Ningún umbral de ${PAIS_INTERVALOS_M.join(', ')} m cabe en ${mb(paisMaxBytes)}`)

    // 5. Escribir
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'municipios.json'), pais.municipios)
    fs.writeFileSync(path.join(outDir, 'localidades.json'), pais.localidades)
    const detalleDir = path.join(outDir, 'detalle')
    fs.mkdirSync(detalleDir, { recursive: true })
    for (const viejo of fs.readdirSync(detalleDir).filter(f => f.endsWith('.json'))) fs.rmSync(path.join(detalleDir, viejo))
    const detalle = separar(nivel(detalleM), nombreMunicipio)
    const porDepto = new Map<string, Feature[]>()
    for (const f of [...detalle.municipios.features, ...detalle.localidades.features]) {
      const dept = f.properties.dept as string
      porDepto.set(dept, [...(porDepto.get(dept) || []), f])
    }
    let detalleBytes = 0
    let detalleComprimido = 0
    let mayor = { dept: '', bytes: 0, comprimido: 0 }
    for (const [dept, features] of [...porDepto.entries()].sort()) {
      const texto = JSON.stringify(coleccion(features))
      const bytes = Buffer.byteLength(texto)
      const gz = comprimido(texto)
      detalleBytes += bytes
      detalleComprimido += gz
      if (bytes > mayor.bytes) mayor = { dept, bytes, comprimido: gz }
      fs.writeFileSync(path.join(detalleDir, `${dept}.json`), texto)
    }

    // 6. Verificación
    const municipiosPais = JSON.parse(pais.municipios) as Coleccion
    const localidadesPais = JSON.parse(pais.localidades) as Coleccion
    const esperados = [...base.nombres.keys()].filter(c => c !== BOGOTA).sort()
    const obtenidos = municipiosPais.features.map(f => String(f.properties.code))
    if (JSON.stringify(obtenidos) !== JSON.stringify(esperados)) {
      fallas.push(`municipios.json tiene ${obtenidos.length} municipios y la base ${esperados.length} (sin ${BOGOTA})`)
    }
    if (localidadesPais.features.length !== LOCALIDADES) fallas.push(`localidades.json tiene ${localidadesPais.features.length} localidades`)
    const detalleCodigos = [...detalle.municipios.features, ...detalle.localidades.features].map(f => String(f.properties.code)).sort()
    const paisCodigos = [...obtenidos, ...localidadesPais.features.map(f => String(f.properties.code))].sort()
    if (JSON.stringify(detalleCodigos) !== JSON.stringify(paisCodigos)) fallas.push('el detalle no tiene los mismos códigos que la vista de país')
    const cobertura = {
      pais: revisarCobertura(nivel(pais.m), tmp, 'pais'),
      detalle: revisarCobertura(nivel(detalleM), tmp, 'detalle'),
    }
    for (const [etiqueta, c] of Object.entries(cobertura)) {
      if (c.rendijasKm2 > MAX_RENDIJAS_KM2) fallas.push(`${etiqueta}: rendijas de ${c.rendijasKm2.toFixed(4)} km²`)
      if (c.encimesKm2 > MAX_ENCIMES_KM2) fallas.push(`${etiqueta}: encimes de ${c.encimesKm2.toFixed(4)} km²`)
    }

    const pesoAntes = 1.47 * 1024 * 1024
    console.log('')
    console.log('Resultado')
    console.log(`  vista de país (umbral ${pais.m} m): municipios.json ${mb(Buffer.byteLength(pais.municipios))} (${municipiosPais.features.length}), localidades.json ${mb(Buffer.byteLength(pais.localidades))} (${localidadesPais.features.length}); comprimido ${mb(comprimido(pais.municipios) + comprimido(pais.localidades))}; tope ${mb(paisMaxBytes)} (antes ${mb(pesoAntes)})`)
    console.log(`  detalle (umbral ${detalleM} m): ${porDepto.size} archivos, ${mb(detalleBytes)} en total (${mb(detalleComprimido)} comprimido); el mayor ${mayor.dept}.json ${mb(mayor.bytes)} (${mb(mayor.comprimido)} comprimido)`)
    for (const [etiqueta, c] of Object.entries(cobertura)) {
      console.log(`  ${etiqueta}: ${c.rendijas} rendijas (${c.rendijasKm2.toFixed(4)} km²), encimes ${c.encimesKm2.toFixed(4)} km²`)
    }
    if (fallas.length) {
      console.error(`\nFALLAS:\n  - ${fallas.join('\n  - ')}`)
      process.exitCode = 1
    } else {
      console.log('  OK: códigos, Bogotá, rendijas y encimes')
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
