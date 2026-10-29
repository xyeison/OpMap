/**
 * Polígonos del DANE y detalle al acercar · pruebas puras (SIN RED, sin Supabase). Pedido del dueño (2026-10-29): los
 * colores de las Zonas deben seguir las fronteras reales. Spec: docs/specs/2026-10-29-mapa-poligonos-dane.md
 *
 * Cubre los archivos de public/geo (vista de país y detalle por departamento, que genera scripts/build-geojson.ts a
 * partir del MGN 2025 del DANE) y las funciones de lib/geo-detalle.ts con que el mapa elige y combina el detalle.
 *
 * Uso (desde web/): npx tsx scripts/geo-detalle-check.ts   (incluida en npm run test)
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import {
  DEPTO_LOCALIDADES,
  DETALLE_ZOOM,
  combinarDetalle,
  deptoDe,
  deptosEnVista,
  detalleVigente,
  loteDetalle,
  porDepto,
  rectangulosPorDepto,
  siguientesDeptos,
  urlDetalle,
  type Rectangulo,
} from '../lib/geo-detalle'

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

const GEO = path.join(__dirname, '..', 'public', 'geo')
const leer = (archivo: string) => JSON.parse(readFileSync(path.join(GEO, archivo), 'utf8')).features as any[]
const municipios = leer('municipios.json')
const localidades = leer('localidades.json')
const archivosDetalle = readdirSync(path.join(GEO, 'detalle')).filter(f => /^\d{2}\.json$/.test(f)).sort()
const detalle: Record<string, any[]> = Object.fromEntries(archivosDetalle.map(f => [f.slice(0, 2), leer(`detalle/${f}`)]))
const codigos = (features: any[]) => features.map(f => String(f.properties.code))
const deUno = (features: any[], code: string) => features.find(f => f.properties.code === code)

// Metros de frontera idéntica (mismos segmentos) entre dos polígonos: prueba que salieron de la misma topología
const anillos = (g: any): number[][][] => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat())
const clave = (a: number[], b: number[]) => {
  const k1 = `${a[0]},${a[1]}`
  const k2 = `${b[0]},${b[1]}`
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`
}
const metros = (a: number[], b: number[]) =>
  Math.hypot((b[0] - a[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110574)
function fronteraCompartidaM(a: any, b: any): number {
  if (!a || !b) return 0
  const segmentos = new Set<string>()
  for (const r of anillos(a.geometry)) for (let i = 0; i < r.length - 1; i++) segmentos.add(clave(r[i], r[i + 1]))
  let total = 0
  for (const r of anillos(b.geometry)) {
    for (let i = 0; i < r.length - 1; i++) if (segmentos.has(clave(r[i], r[i + 1]))) total += metros(r[i], r[i + 1])
  }
  return total
}

console.log('Polígonos del DANE y detalle al acercar · pruebas puras (sin red)\n')

console.log('1. Vista de país (public/geo/municipios.json y localidades.json)')
const codigosMunicipios = codigos(municipios)
check('1.120 municipios, sin Bogotá (11001)', municipios.length === 1120 && !codigosMunicipios.includes('11001'), municipios.length)
check('códigos únicos de 5 dígitos', new Set(codigosMunicipios).size === 1120 && codigosMunicipios.every(c => /^\d{5}$/.test(c)))
check('properties = { code, name, dept } y dept = dos primeros dígitos del código',
  municipios.every(f => JSON.stringify(Object.keys(f.properties)) === '["code","name","dept"]' && f.properties.dept === f.properties.code.slice(0, 2) && f.properties.name),
  municipios.find(f => f.properties.dept !== f.properties.code.slice(0, 2))?.properties)
check('Nuevo Belén de Bajirá (27493) va dentro de Riosucio (27615), que no está en la base', !codigosMunicipios.includes('27493') && codigosMunicipios.includes('27615'))
const codigosLocalidades = codigos(localidades).sort()
const veinte = Array.from({ length: 20 }, (_, i) => `11001${String(i + 1).padStart(2, '0')}`)
check('las 20 localidades (1100101…1100120), departamento 11',
  JSON.stringify(codigosLocalidades) === JSON.stringify(veinte) && localidades.every(f => f.properties.dept === '11'), codigosLocalidades)
const pesoPais = statSync(path.join(GEO, 'municipios.json')).size + statSync(path.join(GEO, 'localidades.json')).size
check('la vista de país no pesa más que antes (1.468.724 B)', pesoPais <= 1_468_724, `${pesoPais} B`)

console.log('\n2. Detalle por departamento (public/geo/detalle/<dd>.json)')
check('33 archivos: 32 departamentos y el 11 de las localidades', archivosDetalle.length === 33, archivosDetalle.length)
check('cada archivo trae solo su departamento',
  Object.entries(detalle).every(([dd, features]) => features.length > 0 && features.every(f => f.properties.dept === dd)),
  Object.entries(detalle).find(([dd, features]) => features.some(f => f.properties.dept !== dd))?.[0])
const codigosDetalle = Object.values(detalle).flatMap(codigos).sort()
check('los mismos códigos que la vista de país', JSON.stringify(codigosDetalle) === JSON.stringify([...codigosMunicipios, ...codigosLocalidades].sort()))
check('el 11 trae las 20 localidades', JSON.stringify(codigos(detalle['11'] || []).sort()) === JSON.stringify(veinte))
check('url del detalle', urlDetalle('25') === '/geo/detalle/25.json')

console.log('\n3. Fronteras compartidas: los vecinos usan los mismos puntos (sin rendijas)')
const zipaNemoPais = fronteraCompartidaM(deUno(municipios, '25899'), deUno(municipios, '25486'))
const zipaNemoDetalle = fronteraCompartidaM(deUno(detalle['25'], '25899'), deUno(detalle['25'], '25486'))
check('Zipaquirá y Nemocón comparten frontera en la vista de país', zipaNemoPais > 1000, Math.round(zipaNemoPais))
check('… y en el detalle', zipaNemoDetalle > 1000, Math.round(zipaNemoDetalle))
const bosaSoacha = fronteraCompartidaM(deUno(detalle['11'], '1100107'), deUno(detalle['25'], '25754'))
check('Bosa (11.json) y Soacha (25.json) comparten frontera entre archivos', bosaSoacha > 1000, Math.round(bosaSoacha))
const usmeSoachaPais = fronteraCompartidaM(deUno(localidades, '1100119'), deUno(municipios, '25754'))
check('Ciudad Bolívar y Soacha comparten frontera en la vista de país', usmeSoachaPais > 1000, Math.round(usmeSoachaPais))
const riosucioTurbo = fronteraCompartidaM(deUno(detalle['27'], '27615'), deUno(detalle['05'], '05837'))
check('Riosucio (27.json, con Belén de Bajirá) y Turbo (05.json) comparten frontera entre archivos', riosucioTurbo > 1000, Math.round(riosucioTurbo))

// Cuántos polígonos usan cada segmento: nunca más de dos (sin encimes ni repetidos) y, en Bogotá (sin costa ni
// frontera con otro país), todo segmento de una localidad tiene vecino al otro lado (sin rendijas en el ajuste)
function usosDeSegmentos(features: any[]): Map<string, number> {
  const usos = new Map<string, number>()
  for (const f of features) {
    for (const r of anillos(f.geometry)) for (let i = 0; i < r.length - 1; i++) {
      const k = clave(r[i], r[i + 1])
      usos.set(k, (usos.get(k) || 0) + 1)
    }
  }
  return usos
}
function sinVecino(localidades: any[], usos: Map<string, number>): number {
  let n = 0
  for (const f of localidades) {
    for (const r of anillos(f.geometry)) for (let i = 0; i < r.length - 1; i++) if (usos.get(clave(r[i], r[i + 1])) !== 2) n++
  }
  return n
}
const usosPais = usosDeSegmentos([...municipios, ...localidades])
const usosDetalle = usosDeSegmentos(Object.values(detalle).flat())
const masDeDos = (usos: Map<string, number>) => [...usos.values()].filter(n => n > 2).length
check('vista de país: ningún segmento lo usan más de dos polígonos', masDeDos(usosPais) === 0, masDeDos(usosPais))
check('detalle (los 33 archivos juntos): ningún segmento lo usan más de dos polígonos', masDeDos(usosDetalle) === 0, masDeDos(usosDetalle))
check('vista de país: todo borde de una localidad tiene vecino', sinVecino(localidades, usosPais) === 0, sinVecino(localidades, usosPais))
check('detalle: todo borde de una localidad tiene vecino (también entre archivos)', sinVecino(detalle['11'] || [], usosDetalle) === 0, sinVecino(detalle['11'] || [], usosDetalle))

console.log('\n4. Departamentos en la vista')
const rectangulos = rectangulosPorDepto([...municipios, ...localidades])
check('un rectángulo por municipio, agrupados por departamento (localidades → 11)',
  rectangulos['25']?.length === municipios.filter(f => f.properties.dept === '25').length && rectangulos['11']?.length === 20,
  { '25': rectangulos['25']?.length, '11': rectangulos['11']?.length })
check('deptoDe: properties.dept, o el código si no hay dept',
  deptoDe({ properties: { code: '25899', dept: '25' } }) === '25' && deptoDe({ properties: { code: '1100101' } }) === '11')
// Lo que cubre una pantalla de 1280 × 800 a zoom 11 en Zipaquirá y en Medellín
const zipaquira: Rectangulo = [-74.4, 4.79, -73.52, 5.34]
const medellin: Rectangulo = [-76.01, 5.97, -75.13, 6.52]
const enZipaquira = deptosEnVista(zipaquira, 11, rectangulos)
check(`por debajo de zoom ${DETALLE_ZOOM}: ningún departamento`, deptosEnVista(zipaquira, DETALLE_ZOOM - 1, rectangulos).length === 0)
check('Zipaquirá a zoom 11: Cundinamarca y Bogotá, en orden', enZipaquira.includes('25') && enZipaquira.includes('11') && enZipaquira.join(',') === [...enZipaquira].sort().join(','), enZipaquira)
check('… sin Meta ni Tolima (sus rectángulos de departamento sí tocarían)', !enZipaquira.includes('50') && !enZipaquira.includes('73'), enZipaquira)
check('Medellín a zoom 11: Antioquia y no el Valle', deptosEnVista(medellin, 11, rectangulos).includes('05') && !deptosEnVista(medellin, 11, rectangulos).includes('76'))
const unoSolo = { '99': [[10, 10, 11, 11] as Rectangulo] }
check('margen del 10 %: entra lo que está a punto de verse', deptosEnVista([11.05, 10, 12, 11], 12, unoSolo).length === 1 && deptosEnVista([11.2, 10, 12, 11], 12, unoSolo).length === 0)

console.log('\n5. Departamentos con detalle al mover el mapa')
const a = siguientesDeptos([], ['25'], 11)
const b = siguientesDeptos(a, ['15', '25'], 11)
check('acerca: los que se ven', JSON.stringify(a) === '["25"]')
check('mueve: los que se ven ahora, en orden', JSON.stringify(b) === '["15","25"]')
check('mueve lejos: solo los nuevos (no se acumulan)', JSON.stringify(siguientesDeptos(b, ['68'], 11)) === '["68"]')
check('sin cambios: la misma lista (no vuelve a pintar)', siguientesDeptos(b, ['25', '15'], 12) === b)
check(`aleja por debajo de ${DETALLE_ZOOM}: ninguno`, siguientesDeptos(b, [], DETALLE_ZOOM - 1).length === 0)
const vacia: readonly string[] = []
check('lejos y sin nada: la misma lista', siguientesDeptos(vacia, [], 6) === vacia)

console.log('\n6. Combinación con el detalle')
const pais = [
  { properties: { code: '25899', name: 'Zipaquirá', dept: '25' }, geometry: null },
  { properties: { code: '25486', name: 'Nemocón', dept: '25' }, geometry: null },
  { properties: { code: '05001', name: 'Medellín', dept: '05' }, geometry: null },
]
const detalle25 = [
  { properties: { code: '25899', name: 'Zipaquirá', dept: '25' }, geometry: null },
  { properties: { code: '25486', name: 'Nemocón', dept: '25' }, geometry: null },
]
const detalleLoc = [{ properties: { code: '1100101', name: 'Usaquén', dept: '11' }, geometry: null }]
const combinado = combinarDetalle(pais, { '25': detalle25, [DEPTO_LOCALIDADES]: detalleLoc })
check('cambia solo los departamentos con detalle', combinado.length === 3 && combinado.includes(pais[2]) && combinado.includes(detalle25[0]) && !combinado.includes(pais[0]))
check('el detalle de las localidades no entra en los municipios', !combinado.includes(detalleLoc[0]))
check('sin detalle: la vista de país igual', JSON.stringify(combinarDetalle(pais, {})) === JSON.stringify(pais))
check('porDepto agrupa por departamento', JSON.stringify(Object.keys(porDepto(pais)).sort()) === '["05","25"]' && porDepto(pais)['25'].length === 2)

console.log('\n7. Por lotes: no se juntan los dos niveles en un borde')
const fc = (features: unknown[]) => ({ data: { type: 'FeatureCollection', features } })
const listo = loteDetalle<string>(['15', '25'], [fc(['a']), fc(['b'])])
check('llegaron todos: listo, cada uno con lo suyo', listo.estado === 'listo' && JSON.stringify(listo.detalle) === '{"15":["a"],"25":["b"]}')
check('falta uno: cargando, sin detalle', loteDetalle(['15', '25'], [fc(['a']), {}]).estado === 'cargando')
check('falló uno: error, sin detalle', loteDetalle(['15', '25'], [fc(['a']), { isError: true }]).estado === 'error')
check('nada que pedir (lejos): listo y vacío', loteDetalle([], []).estado === 'listo' && Object.keys(loteDetalle([], []).detalle).length === 0)
const anterior = { '25': ['viejo'] }
check('mientras carga se queda el lote anterior', detalleVigente(anterior, { estado: 'cargando', detalle: {} }) === anterior)
check('si falla, vuelve la vista de país', Object.keys(detalleVigente(anterior, { estado: 'error', detalle: {} })).length === 0)
check('listo: el lote nuevo entero', JSON.stringify(detalleVigente(anterior, listo)) === JSON.stringify(listo.detalle))

console.log(`\n${passed} OK, ${failed} fallas`)
if (failed > 0) process.exit(1)
