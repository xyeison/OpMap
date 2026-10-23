/**
 * Zonas por línea · pruebas puras de las reglas de los botones "Darle <línea> a…" / "Quitarle <línea>" de /kams
 * (app/kams/zonas-ui.ts; spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md). SIN red ni Supabase.
 *
 * Frontera UI↔API que fija esta suite: GET /api/kams/zonas manda `residentes[].lineasPermitidas` como
 *   - null  → la dirección no limitó a esa persona (se le puede dar cualquier línea);
 *   - [...] → códigos permitidos, recortados a las líneas que el usuario ve;
 *   - []    → la dirección SÍ la limitó, pero a líneas que el usuario no ve (sigue siendo una restricción: la API
 *             respondería 409 "La dirección limitó a <nombre> a: …").
 * La UI debe deshabilitar "Darle" en los dos últimos casos cuando la línea no está en la lista, nunca tratar [] como
 * "sin restricción". También: a quien ya lleva la línea no se le vuelve a dar, y solo a quien la lleva se le quita.
 *
 * Uso (desde web/): npx tsx scripts/zonas-ui-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { motivoNoPuedeDar, nombreLinea, puedeQuitar, restriccionDe, textoRestriccion } from '../app/kams/zonas-ui'
import type { ZonaResidente } from '../lib/types/zonas'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}`)
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`)
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  check(name, ok, ok ? undefined : { actual, expected })
}

const LINEAS = [
  { code: 'trauma', name: 'Trauma' },
  { code: 'reemplazo', name: 'Reemplazo articular' },
  { code: 'sustitutos', name: 'Sustitutos óseos' },
]
const TRAUMA = LINEAS[0]

function residente(nombre: string, lineas: string[], lineasPermitidas: string[] | null): ZonaResidente {
  return { id: `id-${nombre.toLowerCase()}`, nombre, status: 'active', lineas, lineasPermitidas }
}

// ---------------------------------------------------------------------------------------------
console.log('\n1. restriccionDe: null = sin restricción; [] = limitada a líneas que no ves (NO es "sin restricción")')
// ---------------------------------------------------------------------------------------------
{
  eq('null → null', restriccionDe({ lineasPermitidas: null }), null)
  eq('lista con códigos → la misma lista', restriccionDe({ lineasPermitidas: ['reemplazo', 'sustitutos'] }), ['reemplazo', 'sustitutos'])
  eq('[] → [] (restricción a líneas no visibles)', restriccionDe({ lineasPermitidas: [] }), [])
}

// ---------------------------------------------------------------------------------------------
console.log('\n2. motivoNoPuedeDar: por qué el botón "Darle" queda deshabilitado')
// ---------------------------------------------------------------------------------------------
{
  eq('sin restricción y no la lleva → se puede dar (null)', motivoNoPuedeDar(residente('Ana', ['reemplazo'], null), TRAUMA, LINEAS), null)
  eq('ya la lleva → "ya lleva"', motivoNoPuedeDar(residente('Ana', ['trauma'], null), TRAUMA, LINEAS), 'Ana ya lleva Trauma')
  eq(
    'limitada a otras líneas visibles → nombres de las permitidas',
    motivoNoPuedeDar(residente('Carmen', [], ['reemplazo', 'sustitutos']), TRAUMA, LINEAS),
    'La dirección limitó a Carmen a: Reemplazo articular, Sustitutos óseos'
  )
  eq('limitada y la línea está entre las permitidas → se puede dar', motivoNoPuedeDar(residente('Carmen', [], ['trauma', 'reemplazo']), TRAUMA, LINEAS), null)
  eq(
    'limitada a líneas que el usuario no ve ([]) → deshabilitado con el texto de "no ves", no 409 después',
    motivoNoPuedeDar(residente('Carmen', [], []), TRAUMA, LINEAS),
    'La dirección limitó a Carmen a líneas que no ves'
  )
  eq('la vacante (placeholder) sigue las mismas reglas', motivoNoPuedeDar({ ...residente('Vacante Bogotá', [], null), status: 'placeholder' }, TRAUMA, LINEAS), null)
  eq(
    '"ya lleva" manda sobre la restricción',
    motivoNoPuedeDar(residente('Ana', ['trauma'], ['reemplazo']), TRAUMA, LINEAS),
    'Ana ya lleva Trauma'
  )
  check(
    'código permitido fuera de las líneas visibles → nombre legible, no rompe',
    motivoNoPuedeDar(residente('Luz', [], ['medicina_deportiva']), TRAUMA, LINEAS) === 'La dirección limitó a Luz a: Medicina deportiva'
  )
}

// ---------------------------------------------------------------------------------------------
console.log('\n3. textoRestriccion: la nota junto al nombre en la tabla')
// ---------------------------------------------------------------------------------------------
{
  eq('sin restricción → null', textoRestriccion(residente('Ana', [], null), LINEAS), null)
  eq('con permitidas → "solo puede tener: …"', textoRestriccion(residente('Carmen', [], ['reemplazo']), LINEAS), 'solo puede tener: Reemplazo articular')
  eq('[] → "solo puede tener líneas que no ves"', textoRestriccion(residente('Carmen', [], []), LINEAS), 'solo puede tener líneas que no ves')
}

// ---------------------------------------------------------------------------------------------
console.log('\n4. puedeQuitar y nombreLinea')
// ---------------------------------------------------------------------------------------------
{
  check('solo a quien la lleva se le puede quitar', puedeQuitar({ lineas: ['trauma'] }, 'trauma') && !puedeQuitar({ lineas: ['reemplazo'] }, 'trauma'))
  eq('nombreLinea con código conocido → nombre', nombreLinea('reemplazo', LINEAS), 'Reemplazo articular')
  eq('nombreLinea con código desconocido → legible', nombreLinea('medicina_deportiva', LINEAS), 'Medicina deportiva')
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} OK, ${failed} fallas`)
if (failed > 0) process.exit(1)
