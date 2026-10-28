/**
 * Estilo del mapa · pruebas puras de grisDeZona (components/mapStyles.ts): el gris con un tono por Zona para
 * "Sin cobertura" en la vista por línea, autorizado por el dueño el 2026-10-23 (spec
 * docs/specs/2026-10-23-zonas-por-linea-para-lideres.md); y del color de Zona en las dos vistas (dueño, 2026-10-28,
 * docs/specs/2026-10-28-mapa-color-de-zona-en-las-dos-vistas.md). SIN red ni Supabase.
 *
 * Reglas: con las 16 Zonas activas salen 16 grises distintos y deterministas (la misma Zona da el mismo valor en
 * cualquier orden de entrada); formato hsl(h, 8%, L%) con L en rampa de 42 a 80 sobre las Zonas ordenadas por nombre
 * visible (sin el prefijo "KAM "); una sola Zona → L 61; un color ausente o inválido no rompe (matiz 160); y ninguna
 * otra constante del estilo autorizado el 2026-10-11 cambió.
 *
 * Uso (desde web/): npx tsx scripts/mapa-estilo-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  CLUSTER_NEUTRAL_COLOR,
  CONFLICT_FILL_COLOR,
  CONFLICT_FILL_OPACITY,
  IPS_FILL_OPACITY,
  REACH_FILL_OPACITY,
  TERRITORY_BORDER_COLOR,
  TERRITORY_BORDER_WEIGHT,
  VACANT_BADGE_COLOR,
  VACANT_BORDER_COLOR,
  VACANT_BORDER_WEIGHT,
  VACANT_FILL_COLOR,
  VACANT_FILL_OPACITY,
  VACANT_REACH_FILL_OPACITY,
  VACANT_STATE_COLOR,
  NO_COVERAGE_DATA_COLOR,
  colorDeEjecutivoEnLinea,
  colorDeRacimo,
  colorDeZonaEnLinea,
  grisDeZona,
} from '../components/mapStyles'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail)}`}`)
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected })
}

const HSL_RE = /^hsl\((\d{1,3}), 8%, (\d{1,3})%\)$/

function partes(valor: string): { h: number; l: number } | null {
  const match = HSL_RE.exec(valor)
  return match ? { h: Number(match[1]), l: Number(match[2]) } : null
}

/** Las 16 Zonas activas (nombres reales, colores de juguete), en el orden de la base (por id), no por nombre. */
const ZONAS = [
  { id: 'z-med', name: 'Medellín', color: '#2563eb' },
  { id: 'z-baq', name: 'Barranquilla', color: '#dc2626' },
  { id: 'z-cal', name: 'Cali', color: '#16a34a' },
  { id: 'z-cha', name: 'Bogotá – Chapinero', color: '#7c3aed' },
  { id: 'z-eng', name: 'Bogotá – Engativá', color: '#9333ea' },
  { id: 'z-ken', name: 'Bogotá – Kennedy', color: '#a855f7' },
  { id: 'z-scr', name: 'Bogotá – San Cristóbal', color: '#c084fc' },
  { id: 'z-buc', name: 'Bucaramanga', color: '#ea580c' },
  { id: 'z-ctg', name: 'Cartagena', color: '#0891b2' },
  { id: 'z-cuc', name: 'Cúcuta', color: '#ca8a04' },
  { id: 'z-iba', name: 'Ibagué', color: '#65a30d' },
  { id: 'z-man', name: 'Manizales', color: '#db2777' },
  { id: 'z-mon', name: 'Montería', color: '#0d9488' },
  { id: 'z-nei', name: 'Neiva', color: '#4f46e5' },
  { id: 'z-per', name: 'Pereira', color: '#be123c' },
  { id: 'z-vup', name: 'Valledupar', color: '#78716c' },
]

/** Barajado determinista (sin Math.random) para probar que el orden de entrada no importa. */
function barajar<T>(items: T[], semilla: number): T[] {
  const copia = [...items]
  let estado = semilla
  for (let i = copia.length - 1; i > 0; i--) {
    estado = (estado * 1103515245 + 12345) % 2147483648
    const j = estado % (i + 1)
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// ---------------------------------------------------------------------------------------------
console.log('1. 16 Zonas → 16 grises distintos, válidos y en rampa')
// ---------------------------------------------------------------------------------------------
{
  const valores = ZONAS.map(zone => grisDeZona(zone.id, ZONAS))
  eq('16 valores distintos', new Set(valores).size, 16)
  check('todos con formato hsl(h, 8%, L%)', valores.every(valor => HSL_RE.test(valor)), valores)
  check('L entre 42 y 80 y h entre 0 y 360', valores.every(valor => { const p = partes(valor); return p !== null && p.l >= 42 && p.l <= 80 && p.h >= 0 && p.h <= 360 }), valores)
  eq('la primera por nombre (Barranquilla) tiene L 42', partes(grisDeZona('z-baq', ZONAS))?.l, 42)
  eq('la última por nombre (Valledupar) tiene L 80', partes(grisDeZona('z-vup', ZONAS))?.l, 80)
  eq('la segunda por nombre (Bogotá – Chapinero) tiene L 45 (42 + 38/15 ≈ 44,5 redondeado)', partes(grisDeZona('z-cha', ZONAS))?.l, 45)
  const porNombre = [...ZONAS].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  const luces = porNombre.map(zone => partes(grisDeZona(zone.id, ZONAS))!.l)
  check('la luminosidad crece con el orden alfabético del nombre', luces.every((l, i) => i === 0 || l > luces[i - 1]), luces)
  eq('el matiz sale del color de la Zona (Barranquilla #dc2626 → rojo, matiz 0)', partes(grisDeZona('z-baq', ZONAS))?.h, 0)
  eq('Cali #16a34a → matiz verde (142)', partes(grisDeZona('z-cal', ZONAS))?.h, 142)
}

// ---------------------------------------------------------------------------------------------
console.log('\n2. Determinista ante distinto orden de entrada')
// ---------------------------------------------------------------------------------------------
{
  const referencia = Object.fromEntries(ZONAS.map(zone => [zone.id, grisDeZona(zone.id, ZONAS)]))
  const alReves = [...ZONAS].reverse()
  check('mismo valor por Zona con la lista al revés', ZONAS.every(zone => grisDeZona(zone.id, alReves) === referencia[zone.id]))
  for (const semilla of [1, 7, 42]) {
    const barajadas = barajar(ZONAS, semilla)
    check(`mismo valor por Zona con la lista barajada (semilla ${semilla})`, ZONAS.every(zone => grisDeZona(zone.id, barajadas) === referencia[zone.id]))
  }
  check('dos llamadas iguales dan lo mismo', ZONAS.every(zone => grisDeZona(zone.id, ZONAS) === referencia[zone.id]))
  // El prefijo "KAM " no cuenta para ordenar (zoneDisplayName): "KAM Barranquilla" sigue siendo la primera
  const conPrefijo = ZONAS.map(zone => (zone.id === 'z-baq' ? { ...zone, name: 'KAM Barranquilla' } : zone))
  eq('"KAM Barranquilla" ordena como "Barranquilla" (L 42)', partes(grisDeZona('z-baq', conPrefijo))?.l, 42)
  // Dos Zonas con el mismo nombre visible desempatan por id, siempre igual
  const repetidas = [{ id: 'b', name: 'Igual', color: null }, { id: 'a', name: 'Igual', color: null }, { id: 'c', name: 'Igual', color: null }]
  eq('nombres iguales: desempate por id (a < b < c)', repetidas.map(zone => partes(grisDeZona(zone.id, repetidas))?.l), [61, 42, 80])
  eq('… también con la lista al revés', [...repetidas].reverse().map(zone => partes(grisDeZona(zone.id, [...repetidas].reverse()))?.l), [80, 42, 61])
}

// ---------------------------------------------------------------------------------------------
console.log('\n3. Casos límite: una Zona, color inválido, Zona desconocida')
// ---------------------------------------------------------------------------------------------
{
  eq('una sola Zona → L 61 (punto medio de 42 y 80)', grisDeZona('z-baq', [ZONAS[1]]), 'hsl(0, 8%, 61%)')
  eq('dos Zonas → L 42 y 80 (Medellín #2563eb → matiz 221)', [grisDeZona('z-baq', ZONAS.slice(0, 2)), grisDeZona('z-med', ZONAS.slice(0, 2))], ['hsl(0, 8%, 42%)', 'hsl(221, 8%, 80%)'])
  eq('sin color → matiz 160', grisDeZona('x', [{ id: 'x', name: 'Sin color' }]), 'hsl(160, 8%, 61%)')
  eq('color null → matiz 160', grisDeZona('x', [{ id: 'x', name: 'Sin color', color: null }]), 'hsl(160, 8%, 61%)')
  eq('color inválido ("rojo") → matiz 160, no rompe', grisDeZona('x', [{ id: 'x', name: 'Rojo', color: 'rojo' }]), 'hsl(160, 8%, 61%)')
  eq('color corto ("#abc") → matiz 160', grisDeZona('x', [{ id: 'x', name: 'Corto', color: '#abc' }]), 'hsl(160, 8%, 61%)')
  eq('color gris (#808080, sin matiz) → matiz 0', grisDeZona('x', [{ id: 'x', name: 'Gris', color: '#808080' }]), 'hsl(0, 8%, 61%)')
  eq('color válido en mayúsculas (#00FF00) → matiz 120', grisDeZona('x', [{ id: 'x', name: 'Verde', color: '#00FF00' }]), 'hsl(120, 8%, 61%)')
  check('Zona que no está en la lista → gris medio válido, no rompe', grisDeZona('no-existe', ZONAS) === 'hsl(160, 8%, 61%)')
  check('lista vacía → gris medio válido, no rompe', grisDeZona('x', []) === 'hsl(160, 8%, 61%)')
  check('acepta una lista de solo lectura', HSL_RE.test(grisDeZona('z-baq', Object.freeze([...ZONAS]) as ReadonlyArray<{ id: string; name: string; color?: string | null }>)))
}

// ---------------------------------------------------------------------------------------------
console.log('\n4. Nada más de la estética autorizada el 2026-10-11 cambia')
// ---------------------------------------------------------------------------------------------
{
  eq('relleno de "sin cobertura" (pizarra) intacto', [VACANT_FILL_COLOR, VACANT_FILL_OPACITY, VACANT_REACH_FILL_OPACITY], ['#94a3b8', 0.5, 0.3])
  eq('borde de "sin cobertura" intacto', [VACANT_BORDER_COLOR, VACANT_BORDER_WEIGHT], ['#64748b', 0.8])
  eq('IPS e insignia hueca de "sin cobertura" intactos', [VACANT_STATE_COLOR, VACANT_BADGE_COLOR], ['#64748b', '#475569'])
  eq('opacidades de IPS y alcance intactas', [IPS_FILL_OPACITY, REACH_FILL_OPACITY], [0.55, 0.22])
  eq('borde de municipios intacto', [TERRITORY_BORDER_COLOR, TERRITORY_BORDER_WEIGHT], ['#ffffff', 0.6])
  eq('conflicto intacto', [CONFLICT_FILL_COLOR, CONFLICT_FILL_OPACITY], ['#f59e0b', 0.4])
}

// ---------------------------------------------------------------------------------------------
console.log('\n5. Un solo color por Zona en las dos vistas (dueño, 2026-10-28)')
// ---------------------------------------------------------------------------------------------
{
  const gris = () => '#9aa0a6'
  const azul = '#2563EB'
  eq('zona cubierta (local): el color de la Zona, como en la vista de Zonas', colorDeZonaEnLinea({ kind: 'local', executive: { id: 'e1' } }, azul, gris), azul)
  eq('zona cubierta por alcance o ajuste manual: también el color de la Zona', [
    colorDeZonaEnLinea({ kind: 'reach', executive: { id: 'e1' } }, azul, gris),
    colorDeZonaEnLinea({ kind: 'manual', executive: { id: 'e1' } }, azul, gris),
  ], [azul, azul])
  eq('sin cobertura: el gris propio de la Zona (2026-10-23), no su color', colorDeZonaEnLinea({ kind: 'vacant', executive: null }, azul, gris), '#9aa0a6')
  eq('conflicto: ámbar', colorDeZonaEnLinea({ kind: 'conflict', executive: null }, azul, gris), CONFLICT_FILL_COLOR)
  eq('fila sin Ejecutivo Comercial: gris de la Zona', colorDeZonaEnLinea({ kind: 'local', executive: null }, azul, gris), '#9aa0a6')
  eq('sin fila de cobertura: gris de "sin datos"', colorDeZonaEnLinea(undefined, azul, gris), NO_COVERAGE_DATA_COLOR)
  eq('Zona sin color guardado: gris de "sin datos"', colorDeZonaEnLinea({ kind: 'local', executive: { id: 'e1' } }, null, gris), NO_COVERAGE_DATA_COLOR)
  let pedidos = 0
  colorDeZonaEnLinea({ kind: 'local', executive: { id: 'e1' } }, azul, () => { pedidos++; return '#000000' })
  eq('el gris solo se calcula cuando hace falta', pedidos, 0)

  const colores: Record<string, string> = { cha: '#2563EB', eng: '#16A34A', ken: '#DC2626', scr: '#9333EA' }
  const colorDe = (kamId: string) => colores[kamId]
  eq(
    'chip del Ejecutivo Comercial: la Zona donde es local, aunque no sea la primera',
    colorDeEjecutivoEnLinea([{ kamId: 'eng', kind: 'reach' }, { kamId: 'cha', kind: 'local' }, { kamId: 'ken', kind: 'reach' }], colorDe),
    '#2563EB'
  )
  eq('chip sin Zona local: la primera de sus Zonas', colorDeEjecutivoEnLinea([{ kamId: 'ken', kind: 'reach' }, { kamId: 'scr', kind: 'manual' }], colorDe), '#DC2626')
  eq('chip sin Zonas en la línea: gris de "sin datos"', colorDeEjecutivoEnLinea([], colorDe), NO_COVERAGE_DATA_COLOR)

  eq('racimo con Zonas de colores distintos (las 4 de Bogotá): neutro', colorDeRacimo([
    { color: '#2563EB', hollow: false }, { color: '#16A34A', hollow: false }, { color: '#DC2626', hollow: false }, { color: '#9333EA', hollow: false },
  ]), CLUSTER_NEUTRAL_COLOR)
  eq('racimo con un solo color (mayúsculas o no): ese color', colorDeRacimo([{ color: '#2563EB', hollow: false }, { color: '#2563eb', hollow: false }]), '#2563EB')
  eq('racimo todo sin cobertura: el de la insignia hueca', colorDeRacimo([{ color: '#9aa0a6', hollow: true }, { color: '#b0b4b8', hollow: true }]), VACANT_BADGE_COLOR)
  eq('racimo mixto (alguna sin cobertura): neutro', colorDeRacimo([{ color: '#2563EB', hollow: false }, { color: '#2563EB', hollow: true }]), CLUSTER_NEUTRAL_COLOR)
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} OK, ${failed} fallas`)
if (failed > 0) process.exit(1)
