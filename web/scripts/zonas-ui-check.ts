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
import { motivoNoPuedeDar, nombreLinea, puedeQuitar, restriccionDe, sugerenciaCobertura, textoEstado, textoPuedeTener, textoRestriccion } from '../app/kams/zonas-ui'
import type { ZonaEnLinea, ZonaFila, ZonaResidente } from '../lib/types/zonas'

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
console.log('\n5. textoPuedeTener: siempre visible junto al nombre (qué unidades puede tener cada persona o vacante)')
// ---------------------------------------------------------------------------------------------
{
  eq('sin restricción → "Puede tener cualquier línea"', textoPuedeTener(residente('Ana', [], null), LINEAS), 'Puede tener cualquier línea')
  eq('con permitidas → "Solo puede tener: …"', textoPuedeTener(residente('Carmen', [], ['reemplazo', 'sustitutos']), LINEAS), 'Solo puede tener: Reemplazo articular, Sustitutos óseos')
  eq('[] → "Solo puede tener líneas que no ves"', textoPuedeTener(residente('Carmen', [], []), LINEAS), 'Solo puede tener líneas que no ves')
}

// ---------------------------------------------------------------------------------------------
console.log('\n6. textoEstado: el estado en lenguaje llano (dueño 2026-10-23: "necesito mejor usabilidad")')
// ---------------------------------------------------------------------------------------------
{
  const DEPORTIVA = { name: 'Medicina deportiva', max_reach_minutes: 240 }
  const celda = (parte: Partial<ZonaEnLinea>): ZonaEnLinea => ({
    estado: 'ocupada', ejecutivo: null, desde: null, minutos: null, masCercano: null, ajuste: null, sinEquipo: false, nota: null, ...parte,
  })
  const joana = { id: 'e1', nombre: 'Joana', status: 'active' as const }
  const vacanteBaq = { id: 'v1', nombre: 'Vacante Barranquilla', status: 'placeholder' as const }
  eq('ocupada → "La atiende Joana, que vive en la Zona."', textoEstado(celda({ estado: 'ocupada', ejecutivo: joana, minutos: 0 }), DEPORTIVA).detalle, 'La atiende Joana, que vive en la Zona.')
  eq(
    'reservada → "Reservada para Vacante Barranquilla (por contratar), que vive en la Zona." (sin repetir "vacante")',
    textoEstado(celda({ estado: 'reservada', ejecutivo: vacanteBaq, minutos: 0 }), DEPORTIVA).detalle,
    'Reservada para Vacante Barranquilla (por contratar), que vive en la Zona.'
  )
  eq(
    'por alcance → "La atiende … desde Barranquilla, a 2 h 26 por carretera."',
    textoEstado(celda({ estado: 'alcance', ejecutivo: vacanteBaq, desde: { kam_id: 'k1', nombre: 'Barranquilla' }, minutos: 146 }), DEPORTIVA).detalle,
    'La atiende Vacante Barranquilla (por contratar) desde Barranquilla, a 2 h 26 por carretera.'
  )
  eq(
    'sin cobertura → "Nadie que lleve Medicina deportiva llega en menos de 4 h por carretera. La más cercana es …, a 9 h 15."',
    textoEstado(celda({ estado: 'sin_cobertura', masCercano: { id: 'v2', nombre: 'Vacante Bogotá', status: 'placeholder', minutos: 555 } }), DEPORTIVA).detalle,
    'Nadie que lleve Medicina deportiva llega en menos de 4 h por carretera. La más cercana es Vacante Bogotá (por contratar), a 9 h 15.'
  )
  eq(
    'sin cobertura y sin nadie cerca → solo la primera frase',
    textoEstado(celda({ estado: 'sin_cobertura' }), DEPORTIVA).detalle,
    'Nadie que lleve Medicina deportiva llega en menos de 4 h por carretera.'
  )
  eq(
    'conflicto → quiénes y qué hacer',
    textoEstado(celda({ estado: 'conflicto', nota: 'Ana y Beto' }), DEPORTIVA).detalle,
    'Más de una persona de la Zona lleva Medicina deportiva: Ana y Beto. Resuélvelo con un ajuste manual.'
  )
  eq('sin línea → "la línea" y "dentro del tope"', textoEstado(celda({ estado: 'sin_cobertura' })).detalle, 'Nadie que lleve la línea llega dentro del tope por carretera.')
  eq('el título no cambia: "Sin cobertura"', textoEstado(celda({ estado: 'sin_cobertura' }), DEPORTIVA).titulo, 'Sin cobertura')
}

// ---------------------------------------------------------------------------------------------
console.log('\n7. sugerenciaCobertura: qué puede hacer la líder cuando nadie de la Zona atiende su línea')
// ---------------------------------------------------------------------------------------------
{
  const zona = (estado: ZonaEnLinea['estado'], residentes: ZonaResidente[]): ZonaFila =>
    ({ kam_id: 'k1', nombre: 'Cartagena', residentes, enLinea: { estado, ejecutivo: null, desde: null, minutos: null, masCercano: null, ajuste: null, sinEquipo: false, nota: null } }) as unknown as ZonaFila
  eq('por alcance con alguien que puede recibirla → "dale Trauma a Alexa."', sugerenciaCobertura(zona('alcance', [residente('Alexa', [], null)]), TRAUMA, LINEAS), 'Para que la atienda alguien de aquí, dale Trauma a Alexa.')
  eq(
    'varias personas → "a Alexa o a Vacante Cartagena"',
    sugerenciaCobertura(zona('sin_cobertura', [residente('Alexa', [], null), { ...residente('Vacante Cartagena', [], null), status: 'placeholder' }]), TRAUMA, LINEAS),
    'Para que la atienda alguien de aquí, dale Trauma a Alexa o a Vacante Cartagena.'
  )
  eq('ocupada → nada que sugerir', sugerenciaCobertura(zona('ocupada', [residente('Alexa', [], null)]), TRAUMA, LINEAS), null)
  eq('la única residente está limitada a otras líneas → nada (el botón ya explica)', sugerenciaCobertura(zona('alcance', [residente('Carmen', [], ['reemplazo'])]), TRAUMA, LINEAS), null)
  check('nadie vive en la Zona → hace falta vacante o persona; mientras, forzar', (sugerenciaCobertura(zona('sin_cobertura', []), TRAUMA, LINEAS) ?? '').startsWith('Nadie vive en esta Zona'))
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} OK, ${failed} fallas`)
if (failed > 0) process.exit(1)
