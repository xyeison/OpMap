/**
 * Buscador de municipios del mapa · pruebas puras (SIN RED, sin Supabase). Pedido del dueño (2026-10-28): escribir
 * "Yop" y que salga "Yopal, Casanare"; al dar clic, el mapa va a ese municipio. Spec:
 * docs/specs/2026-10-28-mapa-buscar-municipio.md
 *
 * Cubre lib/buscar-territorios.ts con los polígonos reales del mapa (public/geo/*.json): normalización sin tildes,
 * orden de los resultados, localidades con tilde, la ciudad de Bogotá, el departamento de cada municipio y el
 * rectángulo que encuadra el mapa.
 *
 * Uso (desde web/): npx tsx scripts/mapa-buscar-check.ts   (incluida en npm run test)
 */
import { readFileSync } from 'fs'
import path from 'path'
import {
  BOGOTA_CIUDAD,
  DEPARTAMENTOS,
  buscarTerritorios,
  etiquetaTerritorio,
  geometriasDeTerritorio,
  normalizar,
  rectanguloDeGeometrias,
  territoriosBuscables,
} from '../lib/buscar-territorios'

let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  OK    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`)
  }
}

const geo = (archivo: string) => JSON.parse(readFileSync(path.join(__dirname, '..', 'public', 'geo', archivo), 'utf8')).features as any[]
const municipios = geo('municipios.json')
const localidades = geo('localidades.json')
const lista = territoriosBuscables(
  municipios.map(f => f.properties),
  localidades.map(f => f.properties),
  () => null
)
const etiquetas = (termino: string) => buscarTerritorios(termino, lista).map(etiquetaTerritorio)

console.log('Buscador de municipios del mapa · pruebas puras (sin red)\n')

console.log('1. Normalización')
check('sin tildes ni mayúsculas: "San José de CÚCUTA" → "san jose de cucuta"', normalizar('San José de CÚCUTA') === 'san jose de cucuta')
check('espacios repetidos', normalizar('  Puerto   Gaitán ') === 'puerto gaitan')

console.log('\n2. Lista: 1.120 municipios + 20 localidades + la ciudad de Bogotá')
check('1.141 territorios', lista.length === 1141, lista.length)
check('todo municipio lleva su departamento', lista.filter(t => t.tipo === 'municipio').every(t => t.detalle !== ''), lista.filter(t => !t.detalle).slice(0, 3))
check('33 departamentos', Object.keys(DEPARTAMENTOS).length === 33)

console.log('\n3. Resultados (el caso del dueño y otros)')
check('"Yop" → "Yopal, Casanare" (único)', JSON.stringify(etiquetas('Yop')) === JSON.stringify(['Yopal, Casanare']), etiquetas('Yop'))
check('"yo": los que empiezan por "yo", el más corto primero', etiquetas('yo')[0] === 'Yondó, Antioquia' && etiquetas('yo').includes('Yopal, Casanare'), etiquetas('yo'))
check('"cucuta" sin tilde encuentra San José de Cúcuta', etiquetas('cucuta').includes('San José de Cúcuta, Norte de Santander'), etiquetas('cucuta'))
check('"gaitan": una palabra del nombre (Puerto Gaitán)', etiquetas('gaitan')[0] === 'Puerto Gaitán, Meta', etiquetas('gaitan'))
check('"chia": Chía, Cundinamarca primero', etiquetas('chia')[0] === 'Chía, Cundinamarca', etiquetas('chia'))
check('"usaquen": la localidad, con tilde', etiquetas('usaquen')[0] === 'Usaquén, Bogotá D.C. · localidad', etiquetas('usaquen'))
check('"bogo": la ciudad de Bogotá primero', etiquetas('bogo')[0] === 'Bogotá D.C., ciudad', etiquetas('bogo'))
check('empieza por > palabra empieza por > contiene ("san": San Andrés antes que Puerto Santander)', (() => {
  const r = etiquetas('san')
  return r.length === 8 && r.every(e => normalizar(e).startsWith('san'))
})(), etiquetas('san'))
check('una sola letra: sin resultados', etiquetas('y').length === 0)
check('nada que coincida: sin resultados', etiquetas('zzzz').length === 0)
check('como mucho 8', etiquetas('a').length === 0 && etiquetas('la').length === 8)

console.log('\n4. Encuadre del mapa')
const yopal = rectanguloDeGeometrias(geometriasDeTerritorio('85001', municipios, localidades))
check('Yopal: el rectángulo contiene su cabecera (5,33 / -72,39)', !!yopal && yopal[0][0] < 5.33 && yopal[1][0] > 5.33 && yopal[0][1] < -72.39 && yopal[1][1] > -72.39, yopal)
const usme = rectanguloDeGeometrias(geometriasDeTerritorio('1100105', municipios, localidades))
check('Usme (localidad, 7 dígitos): su polígono', !!usme && usme[0][0] > 4.0 && usme[1][0] < 4.6, usme)
const ciudad = rectanguloDeGeometrias(geometriasDeTerritorio(BOGOTA_CIUDAD, municipios, localidades))
const conSumapaz = rectanguloDeGeometrias(localidades.map(f => f.geometry))
check(
  'Bogotá D.C.: las localidades sin Sumapaz (que baja hasta ~3,7°); el sur rural de Usme llega a ~4,27°',
  !!ciudad && !!conSumapaz && ciudad[0][0] > 4.2 && conSumapaz[0][0] < 4.0 && ciudad[1][0] < 4.85,
  { ciudad, conSumapaz }
)
check('código inexistente: null', rectanguloDeGeometrias(geometriasDeTerritorio('99999', municipios, localidades)) === null)

console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
if (failed > 0) process.exit(1)
