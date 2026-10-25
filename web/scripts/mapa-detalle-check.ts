/**
 * Tarjetas del mapa · giros ADRES y compras SECOP de 12 meses: pruebas puras de las cuentas (sin red ni base de datos).
 * Spec: docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md ("Criterios de aceptación").
 *
 * Cubre: ventanas (giros termina en el último mes cargado, no en hoy; SECOP desde = primer día de hace 11 meses; textos
 * "oct-2025 a sep-2026" y "nov-2025 a hoy"); reparto por camas (un NIT con dos sedes en dos municipios se reparte y la
 * suma de los dos municipios es el giro del NIT; sin camas 1/n; nada dos veces; estimadoPorCamas; total = todos los
 * regímenes); compras (solo esOrto; servicios de especialistas, fuera de escala y personas naturales no suman y se
 * cuentan aparte; sin clasificar aparte con valor; estimados suman y se cuentan; orden por valor; vigilado; entidades
 * distintas; fuera de la ventana y NIT ajeno se ignoran); los cuatro ComprasEstado (la marca manual compra_publica =
 * false gana sobre el REPS); privacidad (el JSON nunca lleva "persona:", "proveedor_hash" ni nombres de personas);
 * una IPS privada → compras null y estado ips_privada; textos sin "KAM", "panel", "representante" ni "sin compras".
 *
 * Uso (desde web/): npx tsx scripts/mapa-detalle-check.ts      Código de salida 1 si alguna prueba falla.
 */
import { resolveGirosRange, type GiroNitResumen } from '../lib/adres-intelligence'
import { resolverCompraPublica, type SecopFact } from '../lib/compras-publicas'
import {
  MAPA_DETALLE_TEXTOS,
  MAPA_VENTANA_MESES,
  contratosEnVentana,
  estadoCompras,
  ipsDelTerritorio,
  mesCortoEs,
  notaEstadoCompras,
  notaParteSede,
  parteDeSede,
  resumirCompras,
  resumirGiros,
  textoSinIps,
  textoVentana,
  ventanaGiros,
  ventanaSecop,
  type SedeMapa,
} from '../lib/mapa-detalle'
import type { ComprasDetalle, IpsDetalle, TerritorioDetalle } from '../lib/types/mapa-detalle'

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FALLA ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : { actual, expected })
}

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol

// ---------------------------------------------------------------------------
// Datos de juguete
// ---------------------------------------------------------------------------
// NIT A (900000001): dos sedes en DOS municipios: a1 Bucaramanga (68001, 60 camas) y a2 Floridablanca (68276, 40 camas).
// NIT B (900000002): una sede b1 en Bucaramanga (20 camas), entidad pública.
// NIT C (900000003): dos sedes SIN camas en Bucaramanga (c1 null, c2 0) → 1/n cada una.
// NIT D (900000004): d1 en Bucaramanga, privada y sin giro. e1: código sin NIT. f1/f2: Bogotá (11001), dos localidades.

const sede = (id: string, code: string | null, municipality_id: string, beds: number | null, locality_id?: string): SedeMapa => ({
  id,
  code,
  beds,
  municipality_id,
  ...(locality_id ? { locality_id } : {}),
})

const hospitals: SedeMapa[] = [
  sede('a1', '9000000011', '68001', 60),
  sede('a2', '900000001-1', '68276', 40),
  sede('b1', '9000000029', '68001', 20),
  sede('c1', '9000000037', '68001', null),
  sede('c2', '9000000037', '68001', 0),
  sede('d1', '9000000045', '68001', 10),
  sede('e1', 'XYZ', '68001', 5),
  sede('f1', '9000000053', '11001', 30, 'loc-1'),
  sede('f2', '9000000061', '11001', 30, 'loc-2'),
]

const resumen: GiroNitResumen[] = [
  { nit: '900000001', total: 1000, capitacion: 0, evento: 0, contributivo: 600, subsidiado: 300, otro: 100, ultima: '2026-09-15', meses: {}, eps: {} },
  { nit: '900000002', total: 500, capitacion: 0, evento: 0, contributivo: 0, subsidiado: 500, otro: 0, ultima: '2026-08-01', meses: {}, eps: {} },
  { nit: '900000003', total: 300, capitacion: 0, evento: 0, contributivo: 300, subsidiado: 0, otro: 0, ultima: '2026-07-20', meses: {}, eps: {} },
  // NIT ajeno al territorio (otra ciudad): nunca debe sumar.
  { nit: '900000099', total: 9999, capitacion: 0, evento: 0, contributivo: 9999, subsidiado: 0, otro: 0, ultima: '2026-09-30', meses: {}, eps: {} },
]

const fact = (partial: Partial<SecopFact> & Pick<SecopFact, 'nit_entidad' | 'proveedor_key' | 'valor'>): SecopFact => ({
  nombre_entidad: null,
  proveedor_nit: partial.proveedor_key.startsWith('nit:') ? partial.proveedor_key.slice(4) : null,
  proveedor_nombre: null,
  es_persona: false,
  es_servicio: false,
  especialidad: null,
  linea: null,
  fecha: '2026-04-01',
  contratos: 1,
  estimado: false,
  ...partial,
})

const A = '900000001'
const B = '900000002'
const OSTEOCOL = 'nit:900303413'
const PRECIMEC = 'nit:900656724'

const facts: SecopFact[] = [
  fact({ nit_entidad: A, proveedor_key: OSTEOCOL, proveedor_nombre: 'OSTEOCOL SAS', linea: 'trauma', valor: 1000, contratos: 2, fecha: '2026-05-21' }),
  fact({ nit_entidad: A, proveedor_key: PRECIMEC, proveedor_nombre: 'JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', linea: 'reemplazo', valor: 3000, fecha: '2026-03-10' }),
  fact({ nit_entidad: B, proveedor_key: OSTEOCOL, proveedor_nombre: 'OSTEOCOL SAS', linea: 'columna', valor: 500, fecha: '2026-01-15' }),
  // Servicios de especialistas: persona natural con especialidad y sin línea (nunca se nombra) y empresa de especialistas.
  fact({ nit_entidad: B, proveedor_key: 'persona:abc123', proveedor_nombre: 'Juan Pérez Rojas', es_persona: true, es_servicio: true, especialidad: 'ortopedia', valor: 80, contratos: 3 }),
  fact({ nit_entidad: B, proveedor_key: 'nit:900999999', proveedor_nombre: 'ESPECIALISTAS SAS', es_servicio: true, especialidad: 'neurocirugia', valor: 70, contratos: 2 }),
  // Persona natural CON línea ortopédica (suministro): cuenta aparte, con valor, sin nombre.
  fact({ nit_entidad: B, proveedor_key: 'persona:def456', proveedor_nombre: 'María Gómez Díaz', es_persona: true, linea: 'trauma', valor: 200, fecha: '2026-06-06' }),
  // Sin clasificar: proveedor vigilado sin línea.
  fact({ nit_entidad: A, proveedor_key: 'nit:900111222', proveedor_nombre: 'VIGILADO SAS', linea: null, valor: 400, contratos: 2 }),
  // Fuera de escala: un contrato de más de 50.000 millones.
  fact({ nit_entidad: B, proveedor_key: 'nit:900333444', proveedor_nombre: 'GIGANTE SAS', linea: 'trauma', valor: 60_000_000_000, fuera_escala: true }),
  // Firmado antes de la ventana.
  fact({ nit_entidad: B, proveedor_key: OSTEOCOL, proveedor_nombre: 'OSTEOCOL SAS', linea: 'trauma', valor: 999, fecha: '2025-10-30' }),
  // Entidad que no es IPS de OpMap.
  fact({ nit_entidad: '900000099', proveedor_key: OSTEOCOL, proveedor_nombre: 'OSTEOCOL SAS', linea: 'trauma', valor: 5000 }),
  // Estimado (SECOP I sin adjudicado): suma y se cuenta.
  fact({ nit_entidad: A, proveedor_key: 'nit:900555666', proveedor_nombre: 'ANTIGUO SAS', linea: 'otros', valor: 100, estimado: true, fecha: '2026-02-02' }),
]

const vigilados = new Set(['900303413', '900111222'])
const HOY = '2026-10-24'
const vGiros = ventanaGiros('2026-09')!
const vSecop = ventanaSecop(HOY)

// ---------------------------------------------------------------------------
// 1. Constante y ventanas
// ---------------------------------------------------------------------------
console.log('\n1. Ventanas')
eq('MAPA_VENTANA_MESES = 12', MAPA_VENTANA_MESES, 12)
eq('mes corto en español', ['2025-10', '2026-09-30', '2026-01'].map(mesCortoEs), ['oct-2025', 'sep-2026', 'ene-2026'])
eq('textoVentana con dos meses y con "hoy"', [textoVentana('2025-10', '2026-09'), textoVentana('2025-11-01', 'hoy')], ['oct-2025 a sep-2026', 'nov-2025 a hoy'])
eq('giros: 12 meses que terminan en el último mes cargado, con texto', vGiros, { desde: '2025-10', hasta: '2026-09', texto: 'oct-2025 a sep-2026' })
eq('giros: acepta la fecha completa de loadIdentificaBounds().max', ventanaGiros('2026-09-30'), vGiros)
eq('giros: termina en el último mes cargado, NO en hoy (hoy es 2026-10)', ventanaGiros('2026-06'), { desde: '2025-07', hasta: '2026-06', texto: 'jul-2025 a jun-2026' })
const rangoIntel = resolveGirosRange(null, null, '2026-09')!
eq('giros: mismo rango que /inteligencia (resolveGirosRange por defecto)', [vGiros.desde, vGiros.hasta], [rangoIntel.desde, rangoIntel.hasta])
eq('giros: sin giros cargados → null', [ventanaGiros(null), ventanaGiros(''), ventanaGiros('2026')], [null, null, null])
eq('SECOP: desde = primer día de hace 11 meses, hasta = hoy, texto "a hoy"', vSecop, { desde: '2025-11-01', hasta: '2026-10-24', texto: 'nov-2025 a hoy' })
eq('SECOP: cruza el año (hoy 2026-01-05 → desde 2025-02-01)', ventanaSecop('2026-01-05').desde, '2025-02-01')
check('SECOP: hoy inválido lanza error (nunca una ventana silenciosa)', (() => { try { ventanaSecop('ayer'); return false } catch { return true } })())

// ---------------------------------------------------------------------------
// 2. Territorio y parte por camas
// ---------------------------------------------------------------------------
console.log('\n2. Territorio y parte por camas')
const bucaramanga = ipsDelTerritorio(hospitals, 'municipio', '68001')
const floridablanca = ipsDelTerritorio(hospitals, 'municipio', '68276')
eq('IPS del municipio (municipality_id)', Array.from(bucaramanga).sort(), ['a1', 'b1', 'c1', 'c2', 'd1', 'e1'])
eq('IPS de la localidad (locality_id), no todo Bogotá', Array.from(ipsDelTerritorio(hospitals, 'localidad', 'loc-1')), ['f1'])
eq('municipio sin IPS → vacío', ipsDelTerritorio(hospitals, 'municipio', '25175').size, 0)
eq('parte de una sede con camas: 60 de 100 → 0,6, 2 sedes del NIT', parteDeSede('a1', hospitals), { nit: '900000001', sedesNit: 2, parte: 0.6 })
eq('parte sin camas: 1/n', parteDeSede('c1', hospitals), { nit: '900000003', sedesNit: 2, parte: 0.5 })
eq('sede única: parte 1', parteDeSede('b1', hospitals), { nit: '900000002', sedesNit: 1, parte: 1 })
eq('código sin NIT: nit null, parte 1', parteDeSede('e1', hospitals), { nit: null, sedesNit: 1, parte: 1 })
eq('id desconocido → null', parteDeSede('zzz', hospitals), null)
eq('nota de parte de sede solo con n > 1', [notaParteSede('900000001', 2), notaParteSede('900000002', 1), notaParteSede(null, 3)], [
  'Parte de esta sede: 1 de 2 sedes del NIT 900000001, reparto por camas. La ficha muestra el NIT completo.',
  null,
  null,
])

// ---------------------------------------------------------------------------
// 3. Giros ADRES
// ---------------------------------------------------------------------------
console.log('\n3. Giros ADRES')
const girosBuc = resumirGiros({ resumen, hospitals, ips: bucaramanga, ventana: vGiros })
const girosFlo = resumirGiros({ resumen, hospitals, ips: floridablanca, ventana: vGiros })
eq('Bucaramanga: A 60 % (600) + B (500) + C 1/n+1/n (300) = 1400, por régimen', [girosBuc.total, girosBuc.contributivo, girosBuc.subsidiado, girosBuc.otro], [1400, 660, 680, 60])
eq('total = contributivo + subsidiado + otro (todos los regímenes)', girosBuc.total, girosBuc.contributivo + girosBuc.subsidiado + girosBuc.otro)
eq('Floridablanca: A 40 % = 400 (240 / 120 / 40)', [girosFlo.total, girosFlo.contributivo, girosFlo.subsidiado, girosFlo.otro], [400, 240, 120, 40])
check('la suma de los dos municipios es el giro del NIT A (nada dos veces)', near(600 + girosFlo.total, 1000))
eq('nits y nitsConGiro del territorio (A, B, C, D; D sin giro; e1 sin NIT no cuenta)', [girosBuc.nits, girosBuc.nitsConGiro], [4, 3])
eq('último giro del territorio', girosBuc.ultimaFecha, '2026-09-15')
eq('estimadoPorCamas: A tiene una sede en otro municipio', [girosBuc.estimadoPorCamas, girosFlo.estimadoPorCamas], [true, true])
eq('fuente por defecto y ventana', [girosBuc.fuente, girosBuc.ventana.texto], ['identifica', 'oct-2025 a sep-2026'])
const girosA = resumirGiros({ resumen, hospitals, ips: ['a1', 'a2'], ventana: vGiros })
eq('las dos sedes juntas: giro exacto del NIT y sin estimación', [girosA.total, girosA.estimadoPorCamas, girosA.nits], [1000, false, 1])
const girosC1 = resumirGiros({ resumen, hospitals, ips: ['c1'], ventana: vGiros, fuente: 'reporte29' })
eq('sin camas: 1/n (150 de 300), estimación, fuente pasada', [girosC1.total, girosC1.estimadoPorCamas, girosC1.fuente], [150, true, 'reporte29'])
const girosB1 = resumirGiros({ resumen, hospitals, ips: ['b1'], ventana: vGiros })
eq('sede única: el NIT completo, sin estimación', [girosB1.total, girosB1.estimadoPorCamas, girosB1.nits, girosB1.nitsConGiro], [500, false, 1, 1])
const girosE1 = resumirGiros({ resumen, hospitals, ips: ['e1'], ventana: vGiros })
eq('IPS sin NIT: 0 NIT, 0 giro, sin fecha', [girosE1.total, girosE1.nits, girosE1.nitsConGiro, girosE1.ultimaFecha], [0, 0, 0, null])
const girosD1 = resumirGiros({ resumen, hospitals, ips: ['d1'], ventana: vGiros })
eq('IPS con NIT sin giro: 1 NIT, 0 con giro', [girosD1.total, girosD1.nits, girosD1.nitsConGiro, girosD1.estimadoPorCamas], [0, 1, 0, false])
eq('territorio vacío: todo en cero', resumirGiros({ resumen, hospitals, ips: [], ventana: vGiros }).total, 0)
check('el NIT ajeno (9999) nunca entra', !JSON.stringify([girosBuc, girosFlo, girosA]).includes('9999'))

// ---------------------------------------------------------------------------
// 4. Compras públicas (SECOP)
// ---------------------------------------------------------------------------
console.log('\n4. Compras públicas (SECOP)')
const comprasBuc = resumirCompras({ facts, hospitals, ips: bucaramanga, vigilados, ventana: vSecop, actualizado: '2026-10-24T05:00:00Z' })
const comprasFlo = resumirCompras({ facts, hospitals, ips: floridablanca, vigilados, ventana: vSecop })
eq('Bucaramanga: solo esOrto, parte por camas (A 60 %): 1800 + 1100 + 60', [comprasBuc.valor, comprasBuc.contratos, comprasBuc.entidades], [2960, 5, 2])
eq('proveedores ordenados por valor desc (PRECIMEC, OSTEOCOL, ANTIGUO)', comprasBuc.proveedores.map(p => [p.nombre, p.valor, p.contratos]), [
  ['JAIMES RUEDA Y COMPAÑIA PRECIMEC S.A.S', 1800, 1],
  ['OSTEOCOL SAS', 1100, 3],
  ['ANTIGUO SAS', 60, 1],
])
const osteocol = comprasBuc.proveedores[1]
eq('proveedor: NIT, entidades distintas, última firma, líneas (códigos, orden del catálogo) y vigilado', [osteocol.nit, osteocol.entidades, osteocol.ultimaFecha, osteocol.lineas, osteocol.vigilado], [
  '900303413',
  2,
  '2026-05-21',
  ['trauma', 'columna'],
  true,
])
eq('proveedor no vigilado', comprasBuc.proveedores[0].vigilado, false)
eq('sin clasificar aparte, con valor repartido (400 × 0,6)', comprasBuc.sinClasificar, { contratos: 2, valor: 240 })
eq('servicios de especialistas: persona (3) + empresa (2), solo contratos', comprasBuc.especialistas, { contratos: 5 })
eq('personas naturales con línea: aparte, con valor, sin nombre', comprasBuc.personasNaturales, { contratos: 1, valor: 200 })
eq('estimados: suman en el total y se cuentan (100 × 0,6)', comprasBuc.estimados, { contratos: 1, valor: 60 })
check('fuera de escala no suma ni aparece', !JSON.stringify(comprasBuc).includes('GIGANTE') && comprasBuc.valor < 1_000_000)
eq('fuera de escala: se cuenta aparte (solo contratos, sin su valor)', comprasBuc.fueraEscala, { contratos: 1 })
eq('Floridablanca: el fuera de escala de B no es suyo', comprasFlo.fueraEscala, { contratos: 0 })
check('el contrato firmado antes de la ventana no suma (OSTEOCOL = 1100, no 2099)', osteocol.valor === 1100)
check('la entidad que no es IPS de OpMap no suma', comprasBuc.entidades === 2 && !JSON.stringify(comprasBuc).includes('900000099'))
eq('ventana y actualizado en la respuesta', [comprasBuc.ventana.texto, comprasBuc.actualizado, comprasFlo.actualizado], ['nov-2025 a hoy', '2026-10-24T05:00:00Z', null])
eq('Floridablanca: A 40 % → 1200 + 400 + 40', [comprasFlo.valor, comprasFlo.contratos, comprasFlo.entidades], [1640, 4, 1])
check('valor de los dos municipios = material ortopédico de A (4100) + B (500); nada dos veces', near(comprasBuc.valor + comprasFlo.valor, 4600))
check('OSTEOCOL en los dos municipios suma el valor del NIT A (1000) + B (500)', near(osteocol.valor + comprasFlo.proveedores.find(p => p.nit === '900303413')!.valor, 1500))
const comprasA = resumirCompras({ facts, hospitals, ips: ['a1', 'a2'], vigilados, ventana: vSecop })
eq('las dos sedes del NIT A juntas: valor exacto del NIT', [comprasA.valor, comprasA.contratos, comprasA.sinClasificar.valor], [4100, 4, 400])
const comprasA1 = resumirCompras({ facts, hospitals, ips: ['a1'], vigilados, ventana: vSecop })
eq('una sede: la parte del NIT (60 %) en proveedores y aparte', [comprasA1.valor, comprasA1.proveedores.map(p => p.valor), comprasA1.sinClasificar.valor], [2460, [1800, 600, 60], 240])
const comprasVacias = resumirCompras({ facts: [], hospitals, ips: bucaramanga, vigilados, ventana: vSecop })
eq('sin hechos: todo en cero y sin proveedores', [comprasVacias.valor, comprasVacias.contratos, comprasVacias.proveedores, contratosEnVentana(comprasVacias)], [0, 0, [], 0])
eq('contratosEnVentana cuenta lo que la tarjeta puede mostrar (5 + 2 + 5 + 1 + 1 fuera de escala)', [contratosEnVentana(comprasBuc), contratosEnVentana(null)], [14, 0])

// ---------------------------------------------------------------------------
// 5. Estado de compras
// ---------------------------------------------------------------------------
console.log('\n5. Estado de compras')
eq('con_datos', estadoCompras(2, contratosEnVentana(comprasBuc)), 'con_datos')
eq('sin_contratos_12m: entidad pública sin hechos', estadoCompras(1, 0), 'sin_contratos_12m')
eq('sin_entidad_publica: municipio con IPS pero ninguna pública', estadoCompras(0, 0), 'sin_entidad_publica')
eq('ips_privada manda aunque haya hechos', [estadoCompras(0, 0, true), estadoCompras(1, 9, true)], ['ips_privada', 'ips_privada'])
const manual = resolverCompraPublica(false, 'Pública', 5)
eq('marca manual compra_publica = false gana sobre el REPS "Pública"', manual, { publica: false, origen: 'manual' })
const comprasPrivada = manual.publica ? resumirCompras({ facts, hospitals, ips: ['b1'], vigilados, ventana: vSecop }) : null
const estadoPrivada = estadoCompras(manual.publica ? 1 : 0, contratosEnVentana(comprasPrivada), !manual.publica)
eq('IPS privada → compras null y estado ips_privada', [comprasPrivada, estadoPrivada], [null, 'ips_privada'])
eq('REPS Pública sin marca manual → pública (reps)', resolverCompraPublica(null, 'Pública', 0), { publica: true, origen: 'reps' })
const publicaB = resolverCompraPublica(null, 'Pública', 0)
const comprasB1 = resumirCompras({ facts, hospitals, ips: ['b1'], vigilados, ventana: vSecop })
eq('IPS pública con hechos → con_datos', estadoCompras(publicaB.publica ? 1 : 0, contratosEnVentana(comprasB1), !publicaB.publica), 'con_datos')
eq('IPS pública sin hechos en la ventana → sin_contratos_12m', estadoCompras(1, contratosEnVentana(resumirCompras({ facts, hospitals, ips: ['d1'], vigilados, ventana: vSecop })), false), 'sin_contratos_12m')
eq('notas por estado (null con datos)', (['con_datos', 'sin_contratos_12m', 'sin_entidad_publica', 'ips_privada', 'sin_nit'] as const).map(estado => notaEstadoCompras(estado)), [
  null,
  'Sin contratos de ortopedia o neurocirugía en SECOP en los últimos 12 meses',
  'Sin entidades públicas de compra en OpMap en este municipio',
  'IPS privada: sin contratación pública (SECOP)',
  'El código de esta IPS no es un NIT válido; no se puede cruzar con la ADRES ni con SECOP',
])
eq('en una localidad de Bogotá: "en esta localidad" (solo cambia esa nota)', (['sin_entidad_publica', 'sin_contratos_12m'] as const).map(estado => notaEstadoCompras(estado, 'localidad')), [
  'Sin entidades públicas de compra en OpMap en esta localidad',
  'Sin contratos de ortopedia o neurocirugía en SECOP en los últimos 12 meses',
])
eq('sin IPS: "este municipio" / "esta localidad"', [textoSinIps(), textoSinIps('municipio'), textoSinIps('localidad')], [
  MAPA_DETALLE_TEXTOS.sinIps,
  MAPA_DETALLE_TEXTOS.sinIps,
  'Giros y compras se cuentan donde está la IPS; esta localidad no tiene IPS en OpMap',
])
check('la IPS sin NIT válido no se llama "privada"', !/privada/i.test(notaEstadoCompras('sin_nit') ?? ''))
eq('territorio sin ningún NIT válido: nota del territorio (municipio / localidad), no la de la IPS', [notaEstadoCompras('sin_nit', 'municipio'), notaEstadoCompras('sin_nit', 'localidad')], [
  'Ninguna IPS de este municipio tiene un NIT válido en OpMap; no se pueden cruzar con la ADRES ni con SECOP',
  'Ninguna IPS de esta localidad tiene un NIT válido en OpMap; no se pueden cruzar con la ADRES ni con SECOP',
])
{
  const soloFuera = resumirCompras({
    facts: [fact({ nit_entidad: B, proveedor_key: 'nit:900333444', proveedor_nombre: 'GIGANTE SAS', linea: 'trauma', valor: 60_000_000_000, fuera_escala: true })],
    hospitals,
    ips: ['b1'],
    vigilados,
    ventana: vSecop,
  })
  eq('solo un contrato fuera de escala: cuenta en la ventana → con_datos (el contador se ve), valor 0', [contratosEnVentana(soloFuera), estadoCompras(1, contratosEnVentana(soloFuera), false), soloFuera.valor, soloFuera.fueraEscala], [1, 'con_datos', 0, { contratos: 1 }])
}

// ---------------------------------------------------------------------------
// 6. Privacidad y terminología
// ---------------------------------------------------------------------------
console.log('\n6. Privacidad y terminología')
const territorio: TerritorioDetalle = {
  territorio: { code: '68001', tipo: 'municipio', nombre: 'Bucaramanga', departamento: 'Santander' },
  ips: { total: bucaramanga.size, publicas: 2 },
  giros: girosBuc,
  compras: comprasBuc,
  comprasEstado: estadoCompras(2, contratosEnVentana(comprasBuc)),
  notas: [MAPA_DETALLE_TEXTOS.estimadoPorCamas, MAPA_DETALLE_TEXTOS.fuentes],
}
const parteB1 = parteDeSede('b1', hospitals)!
const ips: IpsDetalle = {
  hospital: { id: 'b1', nombre: 'Hospital B', nit: parteB1.nit, sedesNit: parteB1.sedesNit, parte: parteB1.parte, compraPublica: true, compraPublicaOrigen: 'reps' },
  giros: girosB1,
  compras: comprasB1,
  comprasEstado: 'con_datos',
  notas: [MAPA_DETALLE_TEXTOS.fuentes],
}
const serializado = JSON.stringify([territorio, ips, comprasFlo, comprasA, comprasA1])
const prohibidos = ['persona:', 'proveedor_hash', 'proveedor_key', 'abc123', 'def456', 'Juan Pérez', 'Pérez Rojas', 'María Gómez', 'Gómez Díaz', 'ESPECIALISTAS SAS']
for (const texto of prohibidos) check(`el JSON serializado no contiene "${texto}"`, !serializado.includes(texto))
check('el JSON sí nombra al proveedor empresa con su NIT', serializado.includes('OSTEOCOL SAS') && serializado.includes('"nit":"900303413"'))
const textos = [...Object.values(MAPA_DETALLE_TEXTOS), notaParteSede('900000001', 2) ?? '', serializado]
for (const [patron, nombre] of [
  [/\bKAM\b/, 'KAM'],
  [/\bpanel\b/i, 'panel'],
  [/representante/i, 'representante'],
  [/sin compras/i, 'sin compras'],
] as const) check(`ningún texto visible dice "${nombre}"`, !textos.some(t => patron.test(t)))
check('los títulos rotulan la fuente y el alcance', MAPA_DETALLE_TEXTOS.tituloGiros === 'Giros ADRES' && MAPA_DETALLE_TEXTOS.tituloCompras.includes('material ortopédico y neurocirugía (SECOP)'))
const forma: Array<keyof ComprasDetalle> = ['ventana', 'actualizado', 'valor', 'contratos', 'entidades', 'proveedores', 'sinClasificar', 'especialistas', 'personasNaturales', 'estimados', 'fueraEscala']
eq('ComprasDetalle trae exactamente las claves del contrato', Object.keys(comprasBuc).sort(), [...forma].sort())
eq('GirosDetalle trae exactamente las claves del contrato', Object.keys(girosBuc).sort(), ['fuente', 'ventana', 'total', 'contributivo', 'subsidiado', 'otro', 'ultimaFecha', 'nits', 'nitsConGiro', 'estimadoPorCamas'].sort())

console.log(`\n${passed} pruebas OK, ${failed} fallidas`)
process.exit(failed > 0 ? 1 : 0)
