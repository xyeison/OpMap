/**
 * Pruebas puras de las variaciones de giros ADRES y del período del filtro (spec 2026-10-29-giros-variaciones), sin
 * red ni base de datos.
 *
 * Cubre: estadística contra valores de referencia (t de Student, beta incompleta, normal, Welch, mes atípico,
 * Mann–Kendall con empates, pendiente de Sen, Benjamini–Hochberg); ventanas de meses; análisis por NIT (señales,
 * confianza, mercado, mínimo, reparto por camas, entidades que explican el cambio); parámetros de la API; y las
 * opciones del selector "Período".
 *
 * Uso (desde web/): npx tsx scripts/giros-variacion-check.ts      Código de salida 1 si alguna prueba falla.
 */
import {
  analizarVariaciones,
  benjaminiHochberg,
  cubreMeses,
  betaIncompleta,
  entidadesDelCambio,
  logGamma,
  mannKendall,
  senalBaja,
  senalSube,
  textoSenal,
  parseVariacionQuery,
  pendienteSen,
  pruebaMesAtipico,
  pValorNormal,
  pValorT,
  ventanasVariacion,
  welch,
  type VentanasVariacion,
} from '../lib/giros-variacion'
import {
  aniosDisponibles,
  ajustarAlDisponible,
  mesesDelAnio,
  opcionesPeriodo,
  periodoDeRango,
  rangoDePeriodo,
} from '../lib/periodo-giros'
import type { IntelHospital } from '../lib/adres-intelligence'
import { nombreCortoEntidad } from '../lib/giros-format'

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

const cerca = (a: number | null | undefined, b: number, tolerancia: number) => typeof a === 'number' && Math.abs(a - b) <= tolerancia

// ---------------------------------------------------------------------------
console.log('\n1. Estadística contra valores de referencia')
// ---------------------------------------------------------------------------

check('ln Γ(5) = ln 24', cerca(logGamma(5), Math.log(24), 1e-10), logGamma(5))
check('ln Γ(0,5) = ln √π', cerca(logGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-10), logGamma(0.5))
check('I_0,5(2, 3) = 11/16', cerca(betaIncompleta(0.5, 2, 3), 11 / 16, 1e-10), betaIncompleta(0.5, 2, 3))
check('I_x en los bordes: 0 y 1', betaIncompleta(0, 2, 3) === 0 && betaIncompleta(1, 2, 3) === 1)
// Valores críticos de tablas (dos colas, 5 %)
check('t = 12,706 con 1 gl → p = 0,05', cerca(pValorT(12.706, 1), 0.05, 5e-4), pValorT(12.706, 1))
check('t = 3,182 con 3 gl → p = 0,05', cerca(pValorT(3.182, 3), 0.05, 5e-4), pValorT(3.182, 3))
check('t = 2,228 con 10 gl → p = 0,05', cerca(pValorT(2.228, 10), 0.05, 5e-4), pValorT(2.228, 10))
check('t = 2,0 con 10 gl → p = 0,0734', cerca(pValorT(2.0, 10), 0.0734, 5e-4), pValorT(2.0, 10))
check('t = −2,228 da lo mismo (dos colas)', cerca(pValorT(-2.228, 10), pValorT(2.228, 10), 1e-12))
check('t = 0 → p = 1; t infinita → p = 0', pValorT(0, 5) === 1 && pValorT(Infinity, 5) === 0)
check('z = 1,96 → p = 0,05', cerca(pValorNormal(1.96), 0.05, 5e-4), pValorNormal(1.96))
check('z = 2,5758 → p = 0,01', cerca(pValorNormal(2.5758), 0.01, 2e-4), pValorNormal(2.5758))

const w = welch([1, 2, 3], [4, 5, 6])
check('Welch [1,2,3] contra [4,5,6]: t = −3,674, 4 gl, p = 0,0213', !!w && cerca(w.t, -3.6742, 1e-3) && cerca(w.df, 4, 1e-9) && cerca(w.p, 0.0213, 5e-4), w)
const wFactor = welch([2, 4, 6], [1, 2, 3], 2)
check('Welch contra el doble de la base (crecer 100 % como el mercado): t = 0, p = 1', !!wFactor && wFactor.t === 0 && wFactor.p === 1, wFactor)
eq('Welch sin varianza e iguales → p = 1', welch([5, 5, 5], [5, 5, 5])?.p, 1)
check('Welch sin varianza y distintos → t infinita, p = 0', welch([6, 6, 6], [5, 5, 5])?.t === Infinity && welch([6, 6, 6], [5, 5, 5])?.p === 0)
check('Welch con menos de 2 meses → null', welch([1], [1, 2]) === null)

const atipico = pruebaMesAtipico(6, [1, 1.02, 0.98, 1.01, 0.99, 1])
check('un mes de 6 cuando la base anda en 1 ± 0,01 → p casi 0', !!atipico && atipico.p < 1e-6 && atipico.df === 5, atipico)
const normal = pruebaMesAtipico(1.01, [1, 1.02, 0.98, 1.01, 0.99, 1])
check('un mes dentro de lo normal → p alto', !!normal && normal.p > 0.5, normal)
check('base sin varianza: igual → p = 1; distinto → p = 0', pruebaMesAtipico(5, [5, 5])?.p === 1 && pruebaMesAtipico(6, [5, 5])?.p === 0)

const mk = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
check('Mann–Kendall de 1..10: S = 45, tau = 1, z = 3,9355, p < 0,0001', !!mk && mk.s === 45 && mk.tau === 1 && cerca(mk.z, 3.9355, 1e-3) && mk.p < 1e-4, mk)
const mkEmpates = mannKendall([1, 1, 2, 2, 3])
check('Mann–Kendall con empates [1,1,2,2,3]: S = 8, z = 1,8278, p = 0,0676', !!mkEmpates && mkEmpates.s === 8 && cerca(mkEmpates.z, 1.8278, 1e-3) && cerca(mkEmpates.p, 0.0676, 1e-3), mkEmpates)
const mkPlano = mannKendall([3, 3, 3, 3])
check('Mann–Kendall de una serie plana: S = 0, p = 1', !!mkPlano && mkPlano.s === 0 && mkPlano.p === 1, mkPlano)
check('Mann–Kendall con menos de 4 meses → null', mannKendall([1, 2, 3]) === null)
eq('Sen de [1,2,3,4,5] = 1', pendienteSen([1, 2, 3, 4, 5]), 1)
eq('Sen de [10,0,10,0,10] = 0', pendienteSen([10, 0, 10, 0, 10]), 0)
eq('Sen no se deja llevar por un mes atípico: [1,2,3,100,5] = 1', pendienteSen([1, 2, 3, 100, 5]), 1)
const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005])
check('Benjamini–Hochberg de [0,01; 0,04; 0,03; 0,005] = [0,02; 0,04; 0,04; 0,02]', q.every((v, i) => cerca(v, [0.02, 0.04, 0.04, 0.02][i], 1e-12)), q)
eq('Benjamini–Hochberg deja los null', benjaminiHochberg([null, 0.01, null]), [null, 0.01, null])

// ---------------------------------------------------------------------------
console.log('\n2. Ventanas de meses')
// ---------------------------------------------------------------------------

const DISPONIBLE = { min: '2025-04', max: '2026-09' }
const v6 = ventanasVariacion({ hasta: '2026-09', ventana: 6, comparacion: 'anterior', disponible: DISPONIBLE })
check(
  '6 contra los 6 anteriores: abr–sep 2026 frente a oct 2025 – mar 2026; tendencia de 12 meses sin pedir nada aparte',
  v6.ok &&
    v6.value.reciente.desde === '2026-04' &&
    v6.value.base.desde === '2025-10' &&
    v6.value.base.hasta === '2026-03' &&
    v6.value.tendencia.length === 12 &&
    v6.value.extra.length === 0 &&
    v6.value.meses.length === 12 &&
    v6.value.texto === 'abr–sep 2026 frente a oct 2025 – mar 2026',
  v6
)
const v6a = ventanasVariacion({ hasta: '2026-09', ventana: 6, comparacion: 'anio_anterior', disponible: DISPONIBLE })
check(
  '6 contra el año anterior: base abr–sep 2025; la tendencia pide aparte oct 2025 – mar 2026; se cargan 18 meses',
  v6a.ok &&
    v6a.value.base.desde === '2025-04' &&
    v6a.value.base.hasta === '2025-09' &&
    JSON.stringify(v6a.value.extra) === JSON.stringify([{ desde: '2025-10', hasta: '2026-03' }]) &&
    v6a.value.meses.length === 18,
  v6a
)
const v3 = ventanasVariacion({ hasta: '2026-09', ventana: 3, comparacion: 'anterior', disponible: DISPONIBLE })
check(
  '3 contra 3: jul–sep frente a abr–jun 2026, y la tendencia pide oct 2025 – mar 2026',
  v3.ok && v3.value.reciente.meses.join() === '2026-07,2026-08,2026-09' && v3.value.base.meses.join() === '2026-04,2026-05,2026-06' && v3.value.extra.length === 1 && v3.value.extra[0].desde === '2025-10',
  v3
)
const v12 = ventanasVariacion({ hasta: '2026-09', ventana: 12, comparacion: 'anterior', disponible: DISPONIBLE })
check('12 contra 12 con 18 meses cargados → error que dice cuántos meses pide', !v12.ok && v12.error.includes('24 meses') && v12.error.includes('abr 2025'), v12)
const vSinBase = ventanasVariacion({ hasta: '2025-09', ventana: 3, comparacion: 'anio_anterior', disponible: DISPONIBLE })
check('contra el año anterior sin datos de ese año → error', !vSinBase.ok, vSinBase)
const vFuera = ventanasVariacion({ hasta: '2026-12', ventana: 3, comparacion: 'anterior', disponible: DISPONIBLE })
check('"hasta" sin datos → error', !vFuera.ok && vFuera.error.includes('dic 2026'), vFuera)
const vCorta = ventanasVariacion({ hasta: '2025-12', ventana: 3, comparacion: 'anterior', disponible: DISPONIBLE })
check('la tendencia toma los meses que haya (abr–dic 2025: 9)', vCorta.ok && vCorta.value.tendencia.length === 9 && vCorta.value.tendencia[0] === '2025-04', vCorta)

// ---------------------------------------------------------------------------
console.log('\n3. Análisis por NIT')
// ---------------------------------------------------------------------------

const M = 1e9 // mil millones
const ventanas = (v6 as { ok: true; value: VentanasVariacion }).value
const meses = ventanas.meses // oct 2025 … sep 2026 (6 base + 6 reciente)
const serie = (valores: number[]) => Object.fromEntries(meses.map((mes, i) => [mes, valores[i] * M]))

function hospital(id: string, nit: string, municipio: string, beds: number, extra: Partial<IntelHospital> = {}): IntelHospital {
  return {
    id,
    name: `IPS ${id}`,
    code: `${nit}-1`,
    municipality_id: municipio,
    municipality_name: municipio === '68001' ? 'Bucaramanga' : 'Cúcuta',
    department_id: municipio.slice(0, 2),
    department_name: municipio === '68001' ? 'Santander' : 'Norte de Santander',
    beds,
    kam_id: 'zona-1',
    zone_name: 'Zona Uno',
    executive: { id: 'ej-1', full_name: 'Ana', color: '#123456' },
    coverage_kind: 'local',
    ...extra,
  }
}

const NIT = {
  sube: '900000001',
  pico: '900000002',
  mercado: '900000003',
  nueva: '900000004',
  deja: '900000005',
  pequena: '900000006',
  baja: '900000007',
  dosSedes: '900000008',
  sinIps: '900000009',
  rezagada: '900000010',
  chico: '900000011',
  corrido: '900000012',
}
const hospitals: IntelHospital[] = [
  hospital('sube', NIT.sube, '68001', 100),
  hospital('pico', NIT.pico, '68001', 50),
  hospital('mercado', NIT.mercado, '68001', 50),
  hospital('nueva', NIT.nueva, '68001', 10),
  hospital('deja', NIT.deja, '68001', 10),
  hospital('pequena', NIT.pequena, '68001', 5),
  hospital('baja', NIT.baja, '68001', 80),
  hospital('dos-a', NIT.dosSedes, '68001', 30),
  hospital('dos-b', NIT.dosSedes, '54001', 10),
  hospital('rezagada', NIT.rezagada, '68001', 20),
  hospital('chico', NIT.chico, '68001', 20),
  hospital('corrido', NIT.corrido, '68001', 20),
]
// El mercado: un NIT grande sin IPS en OpMap que crece 20 % (fija el crecimiento del país cerca de 20 %)
const series = new Map<string, Record<string, number>>([
  [NIT.sinIps, serie([100, 100, 100, 100, 100, 100, 120, 120, 120, 120, 120, 120])],
  [NIT.sube, serie([1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1])],
  [NIT.pico, serie([1.0, 1.02, 0.98, 1.01, 0.99, 1.0, 1.0, 1.01, 0.99, 6.0, 1.0, 1.02])],
  [NIT.mercado, serie([1.0, 1.02, 0.98, 1.01, 0.99, 1.0, 1.2, 1.23, 1.17, 1.22, 1.18, 1.2])],
  [NIT.nueva, serie([0, 0, 0, 0, 0, 0, 0, 0.5, 0.6, 0.7, 0.5, 0.6])],
  [NIT.deja, serie([0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0, 0, 0, 0, 0, 0])],
  [NIT.pequena, serie([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05])],
  [NIT.baja, serie([2.0, 1.95, 1.9, 1.85, 1.8, 1.75, 1.2, 1.15, 1.1, 1.05, 1.0, 0.95])],
  [NIT.dosSedes, serie([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 2.0, 2.0, 2.0, 2.0, 2.0])],
  [NIT.rezagada, serie([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.03, 1.03, 1.03, 1.03, 1.03, 1.03])],
  [NIT.chico, serie([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.25, 1.25, 1.25, 1.25, 1.25, 1.25])],
  // Un giro que se corrió de un mes al siguiente: el total sube como el mercado (×1,2), con un mes en 0 y otro doble
  [NIT.corrido, serie([1.0, 1.01, 0.99, 1.0, 1.01, 0.99, 1.2, 1.2, 0, 2.4, 1.2, 1.2])],
])
// Crecimiento del país calculado aparte, sumando todas las series
const sumaMeses = (desde: number, hasta: number) => Array.from(series.values()).reduce((acc, porMes) => acc + meses.slice(desde, hasta).reduce((s, mes) => s + (porMes[mes] || 0), 0), 0)
const MERCADO = sumaMeses(6, 12) / sumaMeses(0, 6) - 1
const entidadesBase = new Map<string, Record<string, number>>([
  [NIT.sube, { '800130907': 5 * M, '900156264': 1.75 * M }],
  [NIT.deja, { '900156264': 3.1 * M }],
  [NIT.dosSedes, { '800130907': 6 * M }],
])
const entidadesReciente = new Map<string, Record<string, number>>([
  [NIT.sube, { '800130907': 6 * M, '900156264': 1.5 * M, '901097473': 3.6 * M }],
  [NIT.dosSedes, { '800130907': 12 * M }],
])
const nombresEntidades = { '800130907': 'SALUD TOTAL', '900156264': 'NUEVA EPS', '901097473': 'SANITAS' }

const resultado = analizarVariaciones({
  hospitals,
  series,
  entidadesBase,
  entidadesReciente,
  nombresEntidades,
  ventanas,
  filtro: {},
  minimoMensual: 100_000_000,
  conEjecutivo: true,
})
const fila = (nit: string) => resultado.filas.find(item => item.nit === nit)

check('el mercado son todos los NIT cargados (también el que no tiene IPS activa en OpMap): crece ≈ 20 %', cerca(resultado.mercado.variacion, MERCADO, 1e-9) && cerca(MERCADO, 0.2, 0.01) && resultado.mercado.nits === series.size, { mercado: resultado.mercado, MERCADO })
const sube = fila(NIT.sube)
check(
  'sube parejo: "sube sostenido" con confianza alta, variación +64 % (11,1 / 6,75) y frente al mercado (1 + 64 %) / (1 + mercado) − 1',
  sube?.senal === 'sube_sostenido' && sube.confianza === 'alta' && cerca(sube.variacion, 11.1 / 6.75 - 1, 1e-9) && cerca(sube.frenteAlMercado, (11.1 / 6.75) / (1 + MERCADO) - 1, 1e-9) && sube.prueba === 'nivel',
  sube
)
check('sube parejo: la tendencia de Mann–Kendall es significativa y la pendiente de Sen es positiva', !!sube?.tendencia && sube.tendencia.p < 0.05 && (sube.tendencia.pendientePct ?? 0) > 0, sube?.tendencia)
check('sube parejo: q ≥ p (corrección por muchas IPS)', sube?.q !== null && sube?.p !== null && sube!.q! >= sube!.p!, sube)
const pico = fila(NIT.pico)
check('un pago único: "sube por un mes" en jul 2026, probado como mes atípico', pico?.senal === 'sube_un_mes' && pico.mesPico === '2026-07' && pico.prueba === 'mes' && pico.confianza !== 'baja', pico)
const mercado = fila(NIT.mercado)
check('crece como el mercado: "sin cambio claro", frente al mercado ≈ 0', mercado?.senal === 'sin_cambio' && mercado.confianza === 'baja' && cerca(mercado.frenteAlMercado, 0, 0.02), mercado)
const nueva = fila(NIT.nueva)
check('sin giros en la base: "giros nuevos", sin variación % y confianza alta (5 meses con giros)', nueva?.senal === 'giros_nuevos' && nueva.variacion === null && nueva.confianza === 'alta' && nueva.p === null, nueva)
const deja = fila(NIT.deja)
check('sin giros en la reciente: "dejó de recibir"', deja?.senal === 'dejo_de_recibir' && deja.reciente === 0, deja)
check('y quién dejó de girar: NUEVA EPS, marcada "dejó"', deja?.entidades.length === 1 && deja.entidades[0].nombre === 'NUEVA EPS' && deja.entidades[0].dejo, deja?.entidades)
const baja = fila(NIT.baja)
check('baja parejo: "baja sostenido"', baja?.senal === 'baja_sostenido' && baja.confianza !== 'baja', baja)
const rezagada = fila(NIT.rezagada)
check(
  'crece 3 % cuando el mercado crece 20 %: "crece menos que el mercado", nunca "baja", y cuenta entre las de abajo',
  rezagada?.senal === 'crece_menos' && rezagada.confianza === 'alta' && cerca(rezagada.variacion, 0.03, 1e-9) && (rezagada.frenteAlMercado ?? 0) < 0,
  rezagada
)
const chico = fila(NIT.chico)
check(
  'sube 25 % con el mercado en 20 %: significativo pero +4 % frente al mercado → "cambio pequeño", ni sube ni baja',
  chico?.senal === 'cambio_pequeno' && chico.confianza === 'alta' && cerca(chico.frenteAlMercado, 1.25 / (1 + MERCADO) - 1, 1e-9) && !senalSube(chico.senal) && !senalBaja(chico.senal),
  chico
)
const corrido = fila(NIT.corrido)
check(
  'un giro corrido de un mes al siguiente (total igual al mercado) no es noticia: ni sube ni baja, aunque un mes sea atípico',
  !!corrido && !senalSube(corrido.senal) && !senalBaja(corrido.senal) && cerca(corrido.frenteAlMercado, 0, 0.01),
  corrido
)
const dosNacional = fila(NIT.dosSedes)
check('un escalón (1,0 seis meses y 2,0 los otros seis) es "sube sostenido": todos los meses recientes por encima', dosNacional?.senal === 'sube_sostenido', dosNacional)
eq('textoSenal con el mes del pago grande', textoSenal({ senal: 'sube_un_mes', mesPico: '2026-07' }), 'Pago grande en jul 2026')
check('la pequeña (menos de 100 M al mes) no se lista y se cuenta', !fila(NIT.pequena) && resultado.resumen.pequenas === 1, resultado.resumen)
check('el NIT sin IPS en OpMap no se lista y se cuenta', !fila(NIT.sinIps) && resultado.resumen.sinIps === 1, resultado.resumen)
check(
  'quién explica la subida: SANITAS (nueva, +3,6 mil M) y luego SALUD TOTAL (+1 mil M); NUEVA EPS bajó y no sale',
  sube?.entidades.map(entidad => entidad.nombre).join() === 'SANITAS,SALUD TOTAL' && sube.entidades[0].nueva && cerca(sube.entidades[0].cambio, 3.6 * M, 1) && cerca(sube.entidades[1].cambio, 1 * M, 1),
  sube?.entidades
)
check('la fila lleva sede principal, Zona y Ejecutivo Comercial', sube?.nombre === 'IPS sube' && sube.zona === 'Zona Uno' && sube.ejecutivo === 'Ana' && sube.ejecutivo_color === '#123456', sube)
check('la serie de la minigráfica tiene un valor por mes cargado', sube?.serie.length === meses.length && sube.serie[0] === 1 * M, sube?.serie)
check(
  'resumen: suben, bajan (por confianza), nuevas, dejan y sin cambio suman las evaluadas',
  resultado.resumen.evaluadas === resultado.filas.length &&
    resultado.resumen.suben.alta + resultado.resumen.suben.media + resultado.resumen.bajan.alta + resultado.resumen.bajan.media + resultado.resumen.nuevas + resultado.resumen.dejan + resultado.resumen.sinCambio ===
      resultado.resumen.evaluadas,
  resultado.resumen
)
check('las filas van de mayor a menor cambio en pesos', resultado.filas.every((item, i) => i === 0 || Math.abs(resultado.filas[i - 1].cambio) >= Math.abs(item.cambio)))

// Filtro por municipio: el NIT con dos sedes entra con la parte de la de Bucaramanga (30 de 40 camas)
const enBucaramanga = analizarVariaciones({
  hospitals,
  series,
  entidadesBase,
  entidadesReciente,
  nombresEntidades,
  ventanas,
  filtro: { municipio: '68001' },
  minimoMensual: 100_000_000,
  conEjecutivo: false,
})
const dos = enBucaramanga.filas.find(item => item.nit === NIT.dosSedes)
check(
  'filtro por municipio: parte 0,75 por camas, pesos escalados y el % igual (+100 %)',
  !!dos && cerca(dos.parte, 0.75, 1e-12) && cerca(dos.base, 4.5 * M, 1) && cerca(dos.variacion, 1, 1e-9) && dos.sedes === 2 && dos.sedesEnFiltro === 1,
  dos
)
check('las entidades también van con la parte (+6 mil M × 0,75)', !!dos && cerca(dos.entidades[0]?.cambio, 4.5 * M, 1), dos?.entidades)
check('sin línea elegida no hay columna de Ejecutivo', dos?.ejecutivo === null)
check('el mercado no cambia con el filtro', cerca(enBucaramanga.mercado.variacion, resultado.mercado.variacion ?? -1, 1e-12))
const subeFiltrada = enBucaramanga.filas.find(item => item.nit === NIT.sube)
check(
  'la corrección por muchas IPS es de todo el país: al filtrar, la misma IPS conserva su valor q',
  !!subeFiltrada && !!sube && subeFiltrada.q === sube.q && enBucaramanga.resumen.familia === resultado.resumen.familia,
  { filtrada: subeFiltrada?.q, nacional: sube?.q }
)
const enCucuta = analizarVariaciones({
  hospitals,
  series,
  entidadesBase,
  entidadesReciente,
  nombresEntidades,
  ventanas,
  filtro: { municipio: '54001' },
  minimoMensual: 1_000_000_000,
  conEjecutivo: false,
})
const dosEnCucuta = enCucuta.filas.find(item => item.nit === NIT.dosSedes)
check(
  'el mínimo se mide con el giro de todo el NIT: su sede de Cúcuta (parte 0,25, 0,5 mil M al mes) se lista con mínimo de 1.000 M',
  !!dosEnCucuta && cerca(dosEnCucuta.parte, 0.25, 1e-12) && enCucuta.resumen.pequenas === 0,
  { dosEnCucuta, resumen: enCucuta.resumen }
)

// Bitácora: un NIT sin consulta en los meses de la base no se compara (no es "giros nuevos") ni entra al mercado
const coberturaCompleta = { desde: '2025-04', hasta: '2026-09' }
const cobertura = new Map(Array.from(series.keys()).map(nit => [nit, [coberturaCompleta]]))
cobertura.set(NIT.nueva, [{ desde: '2026-04', hasta: '2026-09' }])
const conBitacora = analizarVariaciones({ hospitals, series, entidadesBase, entidadesReciente, nombresEntidades, ventanas, filtro: {}, minimoMensual: 100_000_000, conEjecutivo: false, cobertura })
check(
  'sin consulta de los meses de la base: no sale "giros nuevos", se cuenta aparte y no va al mercado',
  !conBitacora.filas.some(item => item.nit === NIT.nueva) && conBitacora.resumen.sinDatosCompletos === 1 && conBitacora.mercado.nits === series.size - 1,
  conBitacora.resumen
)
cobertura.set(NIT.nueva, [{ desde: '2025-04', hasta: '2025-12' }, { desde: '2026-01', hasta: '2026-09' }])
const conDosConsultas = analizarVariaciones({ hospitals, series, entidadesBase, entidadesReciente, nombresEntidades, ventanas, filtro: {}, minimoMensual: 100_000_000, conEjecutivo: false, cobertura })
check('dos consultas seguidas que cubren los meses cuentan como completas', conDosConsultas.filas.some(item => item.nit === NIT.nueva) && conDosConsultas.resumen.sinDatosCompletos === 0, conDosConsultas.resumen)
check('cubreMeses: sin rangos → no', !cubreMeses(undefined, ['2026-01']) && !cubreMeses([], ['2026-01']))

eq(
  'quién explica: como mucho 3 entidades, de mayor a menor cambio',
  entidadesDelCambio({}, { a: 1, b: 4, c: 3, d: 2 }, 1, 1, {}).map(entidad => entidad.clave),
  ['b', 'c', 'd']
)

// Calibración bajo la hipótesis nula: todas las IPS crecen en promedio igual que el mercado, con un giro mensual que
// varía ±25 %. Con pruebas válidas, p < 0,05 sale en ≈ 5 % o menos de las IPS y casi ninguna con confianza alta.
function prng(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let pruebasNulas = 0
let menoresA5 = 0
let altasNulas = 0
let senalesNulas = 0
for (const semilla of [11, 22, 33]) {
  const azar = prng(semilla)
  const normal = () => {
    let x = 0
    while (x === 0) x = azar()
    return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * azar())
  }
  const hospitalesNulos: IntelHospital[] = []
  const seriesNulas = new Map<string, Record<string, number>>()
  for (let i = 0; i < 400; i++) {
    const nit = String(800000000 + i)
    hospitalesNulos.push(hospital(`n${i}`, nit, '68001', 10))
    const nivel = 3e8 * Math.exp(normal())
    seriesNulas.set(nit, Object.fromEntries(meses.map((mes, k) => [mes, Math.max(0, nivel * (k >= 6 ? 1.1 : 1) * (1 + 0.25 * normal()))])))
  }
  const nulo = analizarVariaciones({ hospitals: hospitalesNulos, series: seriesNulas, entidadesBase: new Map(), entidadesReciente: new Map(), ventanas, filtro: {}, minimoMensual: 0, conEjecutivo: false })
  for (const item of nulo.filas) {
    if (item.p === null) continue
    pruebasNulas++
    if (item.p < 0.05) menoresA5++
    if (item.confianza === 'alta') altasNulas++
    if (senalSube(item.senal) || senalBaja(item.senal)) senalesNulas++
  }
}
check(
  `sin cambios reales, p < 0,05 en ${((menoresA5 / pruebasNulas) * 100).toFixed(1)} % de ${pruebasNulas} IPS (≤ 5,5 %)`,
  pruebasNulas === 1200 && menoresA5 / pruebasNulas <= 0.055,
  { menoresA5, pruebasNulas }
)
check(`sin cambios reales, ${altasNulas} con confianza alta (≤ 3 de 1.200)`, altasNulas <= 3, { altasNulas })
check(
  `sin cambios reales, ${senalesNulas} marcadas como "sube" o "baja" (≤ 5 %: son indicios de confianza media; la vista por defecto solo muestra las de confianza alta)`,
  senalesNulas / pruebasNulas <= 0.05,
  { senalesNulas }
)


const todas = analizarVariaciones({
  hospitals,
  series,
  entidadesBase,
  entidadesReciente,
  nombresEntidades,
  ventanas,
  filtro: {},
  minimoMensual: 0,
  conEjecutivo: false,
})
check('con mínimo 0, la pequeña sí se lista', todas.filas.some(item => item.nit === NIT.pequena) && todas.resumen.pequenas === 0)
eq('entidadesDelCambio sin dirección → ninguna', entidadesDelCambio({ a: 1 }, { a: 2 }, 1, 0, {}), [])

// ---------------------------------------------------------------------------
console.log('\n4. Parámetros de la API')
// ---------------------------------------------------------------------------

const porDefecto = parseVariacionQuery(new URLSearchParams())
eq('por defecto: 6 meses contra los anteriores, mínimo 100 M al mes', porDefecto, { ok: true, value: { ventana: 6, comparacion: 'anterior', hasta: null, minimoMensual: 100_000_000 } })
check('ventana 5 → error', !parseVariacionQuery(new URLSearchParams('ventana=5')).ok)
check('comparar=otro → error', !parseVariacionQuery(new URLSearchParams('comparar=otro')).ok)
check('hasta=2026-13 → error', !parseVariacionQuery(new URLSearchParams('hasta=2026-13')).ok)
check('minimo=5 → error; minimo=0 y 1000000000 sí', !parseVariacionQuery(new URLSearchParams('minimo=5')).ok && parseVariacionQuery(new URLSearchParams('minimo=0')).ok && parseVariacionQuery(new URLSearchParams('minimo=1000000000')).ok)

// ---------------------------------------------------------------------------
console.log('\n5. Selector "Período"')
// ---------------------------------------------------------------------------

eq('últimos 3 meses', rangoDePeriodo('u3', DISPONIBLE), { desde: '2026-07', hasta: '2026-09' })
eq('últimos 6 meses', rangoDePeriodo('u6', DISPONIBLE), { desde: '2026-04', hasta: '2026-09' })
eq('últimos 12 meses', rangoDePeriodo('u12', DISPONIBLE), { desde: '2025-10', hasta: '2026-09' })
eq('todo lo cargado', rangoDePeriodo('todo', DISPONIBLE), { desde: '2025-04', hasta: '2026-09' })
eq('año 2025: desde abril (primer mes con datos)', rangoDePeriodo('2025', DISPONIBLE), { desde: '2025-04', hasta: '2025-12' })
eq('año 2026: hasta septiembre (último mes con datos)', rangoDePeriodo('2026', DISPONIBLE), { desde: '2026-01', hasta: '2026-09' })
check('un año sin datos y "personalizado" → null', rangoDePeriodo('2024', DISPONIBLE) === null && rangoDePeriodo('personalizado', DISPONIBLE) === null)
eq('últimos 12 con solo 5 meses cargados: desde el primero', rangoDePeriodo('u12', { min: '2026-05', max: '2026-09' }), { desde: '2026-05', hasta: '2026-09' })
eq('los años, del más reciente', aniosDisponibles(DISPONIBLE), [2026, 2025])
const opciones = opcionesPeriodo(DISPONIBLE)
eq(
  'las opciones dicen su rango',
  opciones.map(opcion => opcion.etiqueta),
  [
    'Últimos 3 meses (jul–sep 2026)',
    'Últimos 6 meses (abr–sep 2026)',
    'Últimos 12 meses (oct 2025 – sep 2026)',
    'Todo lo cargado (abr 2025 – sep 2026)',
    'Año 2026 (ene–sep 2026)',
    'Año 2025 (abr–dic 2025)',
    'Personalizado…',
  ]
)
eq('el rango por defecto de la API (12 meses) se ve como "Últimos 12 meses"', periodoDeRango('2025-10', '2026-09', DISPONIBLE), 'u12')
eq('un rango cualquiera se ve como "Personalizado"', periodoDeRango('2025-05', '2026-01', DISPONIBLE), 'personalizado')
eq(
  '2025: enero a marzo sin datos (apagados)',
  mesesDelAnio(2025, DISPONIBLE).map(mes => mes.habilitado),
  [false, false, false, true, true, true, true, true, true, true, true, true]
)
eq('2026: octubre a diciembre apagados', mesesDelAnio(2026, DISPONIBLE).slice(8).map(mes => mes.habilitado), [true, false, false, false])
check('un mes fuera se lleva al más cercano con datos', ajustarAlDisponible('2024-01', DISPONIBLE) === '2025-04' && ajustarAlDisponible('2027-01', DISPONIBLE) === '2026-09' && ajustarAlDisponible('2025-08', DISPONIBLE) === '2025-08')

console.log('\n6. Nombres cortos de entidades')
eq('NUEVA EPS', nombreCortoEntidad('NUEVA EMPRESA PROMOTORA DE SALUD SA - NUEVA EPS SA'), 'NUEVA EPS')
eq('COOSALUD EPS', nombreCortoEntidad('COOSALUD ENTIDAD PROMOTORA DE SALUD SA'), 'COOSALUD EPS')
eq('EMSSANAR', nombreCortoEntidad('EMSSANAR SAS'), 'EMSSANAR')
eq('S.A.S. con puntos', nombreCortoEntidad('CLINICA EJEMPLO S.A.S.'), 'CLINICA EJEMPLO')
eq('un municipio queda igual', nombreCortoEntidad('ALCALDIA MUNICIPIO DE CUCUTA'), 'ALCALDIA MUNICIPIO DE CUCUTA')
eq('una palabra que termina en "sa" no se corta', nombreCortoEntidad('MUNICIPIO DE BARRANCABERMEJA ROSA'), 'MUNICIPIO DE BARRANCABERMEJA ROSA')

console.log(`\nResultado: ${passed} OK, ${failed} con fallo`)
process.exit(failed > 0 ? 1 : 0)
