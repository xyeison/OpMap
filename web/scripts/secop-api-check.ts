/**
 * Fase 5 · Pruebas puras de la API de compras públicas (SECOP), sin red ni base de datos.
 *
 * Cubre: NIT de empresa (DV de la DIAN, 9/10 dígitos, guion), líneas de producto (normalización, rótulos,
 * orden, "Sin clasificar"), ficha de IPS (ventana de 24 meses, histórico por línea, años sin compras en 0,
 * sin clasificar y atípicos aparte, proveedores con marca de vigilado, médicos y empresas de especialistas
 * aparte y sin documento, paginación y filtros de contratos, enlaces seguros), SECOP I (valor adjudicado del
 * dataset intacto; reparto del valor del proceso SOLO en los estimados del Integrado; estimados contados
 * aparte en el resumen), entidad de compra pública (marca manual → REPS → contratos), ranking por hospital /
 * proveedor / zona / ejecutivo con reparto por camas entre sedes del NIT, filtros de línea (ortopédicas,
 * todas, sin clasificar) y departamento, ámbito "todas", tabla proveedor × hospital, proveedor (dónde
 * vende), parámetros, CSV y panel de fuentes (semáforo, horario cron en hora de Colombia, próxima carga).
 *
 * Uso (desde web/): npx tsx scripts/secop-api-check.ts      Código de salida 1 si alguna prueba falla.
 */
import type { IntelHospital } from '../lib/adres-intelligence'
import {
  aggregateSecopRanking,
  buildSecopCsv,
  csvCell,
  describeCron,
  dvNit,
  especialidadLabel,
  fuenteSemaforo,
  lineaLabel,
  mergeFuentes,
  normalizeLinea,
  normalizeNitEmpresa,
  parseSecopRankingQuery,
  proveedorKey,
  repartirProcesosSecopI,
  resolverCompraPublica,
  safeUrl,
  summarizeHospitalSecop,
  summarizeProveedorSecop,
  ventanaMeses,
  type SecopContrato,
  type SecopFact,
} from '../lib/compras-publicas'

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

function section(title: string) {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Hospital A (NIT 800000001) con dos sedes: 300 y 100 camas, en zonas distintas y departamentos distintos.
// Hospital B (NIT 800000002) con una sede sin camas. C (NIT 899999999) no es IPS de OpMap.
function hospital(partial: Partial<IntelHospital> & Pick<IntelHospital, 'id' | 'name' | 'code'>): IntelHospital {
  return {
    municipality_id: null,
    municipality_name: null,
    department_id: null,
    department_name: null,
    beds: null,
    kam_id: null,
    zone_name: null,
    executive: null,
    coverage_kind: null,
    ...partial,
  }
}

const HOSPITALS: IntelHospital[] = [
  hospital({ id: 'h-a1', name: 'ESE Hospital A sede norte', code: '800000001-1', beds: 300, department_id: '08', department_name: 'Atlántico', municipality_name: 'Barranquilla', kam_id: 'z1', zone_name: 'Atlántico y Magdalena', executive: { id: 'e1', full_name: 'Ana Pérez', color: '#2a78d6' }, coverage_kind: 'local' }),
  hospital({ id: 'h-a2', name: 'ESE Hospital A sede sur', code: '800000001-1', beds: 100, department_id: '13', department_name: 'Bolívar', municipality_name: 'Cartagena', kam_id: 'z2', zone_name: 'Bolívar', executive: null, coverage_kind: 'vacant' }),
  hospital({ id: 'h-b', name: 'Hospital B', code: '8000000021', beds: null, department_id: '08', department_name: 'Atlántico', municipality_name: 'Soledad', kam_id: 'z1', zone_name: 'Atlántico y Magdalena', executive: { id: 'e1', full_name: 'Ana Pérez', color: '#2a78d6' }, coverage_kind: 'local' }),
  hospital({ id: 'h-x', name: 'Clínica sin NIT', code: 'ABC', beds: 50, department_id: '08' }),
]

function fact(partial: Partial<SecopFact> & Pick<SecopFact, 'nit_entidad' | 'valor'>): SecopFact {
  return {
    nombre_entidad: null,
    proveedor_key: 'nit:900000001',
    proveedor_nit: '900000001',
    proveedor_nombre: 'Prov Uno SAS',
    es_persona: false,
    especialidad: null,
    linea: 'trauma',
    fecha: '2026-01-15',
    contratos: 1,
    ...partial,
  }
}

const FACTS: SecopFact[] = [
  fact({ nit_entidad: '800000001', valor: 1000, linea: 'trauma', fecha: '2026-03-01' }),
  fact({ nit_entidad: '800000001', valor: 400, linea: 'reemplazo', fecha: '2025-06-01', proveedor_key: 'nit:900000002', proveedor_nit: '900000002', proveedor_nombre: 'Prov Dos SA' }),
  fact({ nit_entidad: '800000002', valor: 600, linea: 'columna', fecha: '2026-02-10', proveedor_key: 'nit:900000002', proveedor_nit: '900000002', proveedor_nombre: 'Prov Dos SA' }),
  fact({ nit_entidad: '899999999', valor: 5000, linea: 'trauma', fecha: '2026-04-01', nombre_entidad: 'Gobernación X' }),
  fact({ nit_entidad: '800000001', valor: 50, es_persona: true, proveedor_key: 'persona:abc', proveedor_nit: null, proveedor_nombre: 'Dr. Juan Ruiz', especialidad: 'Ortopedia', linea: null }),
  fact({ nit_entidad: '800000002', valor: 30, es_persona: true, proveedor_key: 'persona:def', proveedor_nit: null, proveedor_nombre: 'Dra. Luz Mora', especialidad: 'Neurocirugía', linea: null }),
  // Valor atípico (error de digitación): no suma.
  fact({ nit_entidad: '800000002', valor: 1e12, atipico: true }),
  // Proveedor vigilado sin línea ortopédica detectada: fuera del total por defecto.
  fact({ nit_entidad: '800000001', valor: 250, linea: 'no_clasificado', proveedor_key: 'nit:900000002', proveedor_nit: '900000002', proveedor_nombre: 'Prov Dos SA', fecha: '2026-05-01' }),
  // Empresa de especialistas (servicio, no material).
  fact({ nit_entidad: '800000001', valor: 80, es_servicio: true, especialidad: 'ortopedia', linea: 'no_clasificado', proveedor_key: 'nit:900000009', proveedor_nit: '900000009', proveedor_nombre: 'Ortopedistas Asociados SAS' }),
]

const VIGILADOS = new Set(['900000002'])

// ---------------------------------------------------------------------------
section('NIT de empresa')
eq('dvNit(800197268) = 4 (DIAN)', dvNit('800197268'), 4)
eq('dvNit(890903938) = 8', dvNit('890903938'), 8)
eq('dvNit(899999068) = 1', dvNit('899999068'), 1)
eq('9 dígitos tal cual', normalizeNitEmpresa('890102768'), { ok: true, nit: '890102768' })
eq('10 dígitos con DV válido → 9', normalizeNitEmpresa('8909039388'), { ok: true, nit: '890903938' })
eq('con puntos y guion', normalizeNitEmpresa('890.903.938-8'), { ok: true, nit: '890903938' })
check('DV que no corresponde → error', !normalizeNitEmpresa('890903938-5').ok)
check('10 dígitos sin DV válido → error', !normalizeNitEmpresa('8909039385').ok)
check('8 dígitos → error', !normalizeNitEmpresa('12345678').ok)
check('letras → error', !normalizeNitEmpresa('ABC123456').ok)
check('vacío → error', !normalizeNitEmpresa('').ok)
check('número → acepta', normalizeNitEmpresa(890102768).ok)

section('Líneas de producto')
eq('código canónico', normalizeLinea('trauma'), 'trauma')
eq('rótulo con tildes → código', normalizeLinea('Neurocirugía'), 'neurocirugia')
eq('alias reemplazo_articular', normalizeLinea('Reemplazo articular'), 'reemplazo')
eq('alias osteosíntesis', normalizeLinea('Osteosíntesis'), 'trauma')
eq('vacía → null', normalizeLinea('  '), null)
eq('desconocida se conserva', normalizeLinea('dental'), 'dental')
eq('otros_implantes de la carga → otros', normalizeLinea('otros_implantes'), 'otros')
eq('no_clasificado se conserva', normalizeLinea('no_clasificado'), 'no_clasificado')
eq('rótulo', lineaLabel('deportiva'), 'Medicina deportiva')
eq('rótulo de null', lineaLabel(null), 'Sin clasificar')
eq('rótulo de no_clasificado', lineaLabel('no_clasificado'), 'Sin clasificar')
eq('especialidad', [especialidadLabel('neurocirugia'), especialidadLabel('deportiva'), especialidadLabel(null)], ['Neurocirugía', 'Medicina deportiva', null])
eq('proveedorKey empresa', proveedorKey({ nit: '900000001', personaHash: null, nombre: 'X', esPersona: false }), 'nit:900000001')
eq('proveedorKey persona usa hash', proveedorKey({ nit: '12345', personaHash: 'h1', nombre: 'Juan', esPersona: true }), 'persona:h1')
eq('proveedorKey sin documento por nombre', proveedorKey({ nit: null, personaHash: null, nombre: ' Ortopédicos  S.A.S ', esPersona: false }), 'nombre:ORTOPEDICOS S A S')

section('Ventana y enlaces')
eq('ventana de 24 meses', ventanaMeses('2026-10-11', 24), { desde: '2024-11-01', hasta: '2026-10-11' })
eq('url https', safeUrl('https://community.secop.gov.co/Public/Tendering/x?a=1'), 'https://community.secop.gov.co/Public/Tendering/x?a=1')
eq('url javascript: → null', safeUrl('javascript:alert(1)'), null)
eq('url vacía → null', safeUrl(''), null)

// ---------------------------------------------------------------------------
section('Ficha de IPS')
function contrato(id: string, partial: Partial<SecopContrato> & Pick<SecopContrato, 'valor'>): SecopContrato {
  return {
    ...fact({ nit_entidad: '800000001', valor: partial.valor }),
    id,
    fuente: 'SECOP II',
    objeto: 'Suministro de material de osteosíntesis',
    estado: 'En ejecución',
    modalidad: null,
    url: 'https://community.secop.gov.co/x',
    ...partial,
    estimado: partial.estimado ?? false,
  }
}
const CONTRATOS: SecopContrato[] = [
  contrato('c1', { valor: 1000, linea: 'trauma', fecha: '2026-03-01' }),
  contrato('c2', { valor: 400, linea: 'reemplazo', fecha: '2025-06-01', proveedor_key: 'nit:900000002', proveedor_nit: '900000002', proveedor_nombre: 'Prov Dos SA' }),
  contrato('c3', { valor: 700, linea: 'trauma', fecha: '2021-05-20' }), // fuera de la ventana
  contrato('c4', { valor: 200, linea: null, fecha: '2026-09-30', proveedor_key: 'nit:900000002', proveedor_nit: '900000002', proveedor_nombre: 'Prov Dos SA', url: 'javascript:x' }),
  contrato('m1', { valor: 50, es_persona: true, proveedor_key: 'persona:abc', proveedor_nit: null, proveedor_nombre: 'Dr. Juan Ruiz', especialidad: 'Ortopedia', linea: null, fecha: '2026-01-10' }),
  contrato('m2', { valor: 60, es_persona: true, proveedor_key: 'persona:abc', proveedor_nit: null, proveedor_nombre: 'Dr. Juan Ruiz', especialidad: 'Ortopedia', linea: null, fecha: '2026-05-10' }),
  contrato('m3', { valor: 70, es_persona: true, proveedor_key: 'persona:def', proveedor_nit: null, proveedor_nombre: 'Dra. Luz Mora', especialidad: 'Neurocirugía', linea: null, fecha: '2025-01-10' }),
  contrato('a1', { valor: 9e13, atipico: true, linea: 'trauma', fecha: '2026-02-01' }), // fuera de escala: no suma
  contrato('a2', { valor: 800, atipico: true, linea: 'trauma', fecha: '2026-06-01' }), // p99 de la entidad: suma
  contrato('s1', { valor: 300, es_servicio: true, especialidad: 'ortopedia', linea: 'no_clasificado', proveedor_key: 'nit:900000009', proveedor_nit: '900000009', proveedor_nombre: 'Ortopedistas Asociados SAS', fecha: '2024-12-01' }),
]
const ficha = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', pageSize: 3 })
eq('total ventana: ortopédico, sin médicos, sin fuera de escala, con el atípico p99, sin 2021', ficha.totales.valorVentana, 2200)
eq('contratos ventana', ficha.totales.contratosVentana, 3)
eq('total histórico ortopédico', ficha.totales.valorTotal, 2900)
eq('primera y última fecha ortopédica', [ficha.totales.primeraFecha, ficha.totales.ultimaFecha], ['2021-05-20', '2026-06-01'])
eq('sin clasificar aparte', [ficha.totales.valorSinClasificar, ficha.totales.contratosSinClasificar], [200, 1])
eq('fuera de escala aparte; el atípico p99 suma y se cuenta', [ficha.totales.fueraEscala, ficha.totales.valorFueraEscala, ficha.totales.atipicos], [1, 9e13, 1])
eq('médicos y empresas de especialistas', [ficha.totales.medicos, ficha.totales.contratosMedicos], [3, 4])
eq(
  'por línea en orden del catálogo, sin clasificar al final y sin sumar',
  ficha.porLinea.map(l => [l.linea, l.orto, l.valorVentana, l.valorTotal, l.contratosTotal]),
  [
    ['trauma', true, 1800, 2500, 3],
    ['reemplazo', true, 400, 400, 1],
    ['no_clasificado', false, 200, 200, 1],
  ]
)
eq('años con huecos en 0 (solo ortopédico)', ficha.anual.map(a => [a.anio, a.total]), [[2021, 700], [2022, 0], [2023, 0], [2024, 0], [2025, 400], [2026, 1800]])
eq('2026 por línea', ficha.anual.find(a => a.anio === 2026)?.lineas, { trauma: 1800 })
eq('proveedores por valor ortopédico con vigilado', ficha.proveedores.map(p => [p.nit, p.valor, p.valorSinClasificar, p.contratos, p.vigilado, p.valorVentana]), [
  ['900000001', 2500, 0, 3, false, 1800],
  ['900000002', 400, 200, 2, true, 400],
])
eq('líneas del proveedor 2', ficha.proveedores[1].lineas, ['reemplazo', 'no_clasificado'])
check('la empresa de especialistas no es proveedor de material', !ficha.proveedores.some(p => p.nit === '900000009'))
eq('médicos por nº de contratos con especialidad', ficha.medicos.map(m => [m.nombre, m.empresa, m.especialidad, m.contratos, m.ultimaFecha]), [
  ['Dr. Juan Ruiz', false, 'Ortopedia', 2, '2026-05-10'],
  ['Dra. Luz Mora', false, 'Neurocirugía', 1, '2025-01-10'],
  ['Ortopedistas Asociados SAS', true, 'ortopedia', 1, '2024-12-01'],
])
check('ningún médico expone documento', ficha.medicos.filter(m => !m.empresa).every(m => !/\d{6,}/.test(m.key.replace('persona:', ''))))
eq('paginación: 10 contratos en páginas de 3', [ficha.contratos.total, ficha.contratos.pages, ficha.contratos.rows.length], [10, 4, 3])
eq('orden por fecha descendente', ficha.contratos.rows.map(r => r.id), ['c4', 'a2', 'm2'])
eq('url peligrosa se anula', ficha.contratos.rows[0].url, null)
eq('contrato sin línea → sin clasificar', ficha.contratos.rows[0].linea, 'no_clasificado')
eq('atípico p99: marcado, no fuera de escala', [ficha.contratos.rows[1].atipico, ficha.contratos.rows[1].fueraEscala], [true, false])
eq('contrato de médico sin NIT ni línea', [ficha.contratos.rows[2].esPersona, ficha.contratos.rows[2].esServicio, ficha.contratos.rows[2].proveedorNit, ficha.contratos.rows[2].linea, ficha.contratos.rows[2].especialidad], [true, true, null, null, 'Ortopedia'])
const pagina3 = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', pageSize: 3, page: 3 })
eq('página 3', pagina3.contratos.rows.map(r => r.id), ['c2', 'm3', 's1'])
eq('la empresa de especialistas se lista con su NIT', [pagina3.contratos.rows[2].esServicio, pagina3.contratos.rows[2].esPersona, pagina3.contratos.rows[2].proveedorNit], [true, false, '900000009'])
const pagina99 = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', pageSize: 3, page: 99 })
eq('página fuera de rango → última', [pagina99.contratos.page, pagina99.contratos.rows.map(r => r.id)], [4, ['c3']])
const soloMedicos = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', lineaContratos: 'medicos' })
eq('filtro de contratos: médicos y especialistas', soloMedicos.contratos.rows.map(r => r.id), ['m2', 'm1', 'm3', 's1'])
const soloTrauma = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', lineaContratos: 'trauma' })
eq('filtro de contratos: trauma lista también los atípicos (el resumen no cambia)', [soloTrauma.contratos.rows.map(r => r.id), soloTrauma.totales.valorTotal], [['a2', 'c1', 'a1', 'c3'], 2900])
const soloAtipicos = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', lineaContratos: 'atipicos' })
eq('filtro de contratos: atípicos (p99 y fuera de escala)', soloAtipicos.contratos.rows.map(r => [r.id, r.atipico, r.fueraEscala]), [
  ['a2', true, false],
  ['a1', true, true],
])
const soloSinClasificar = summarizeHospitalSecop({ contratos: CONTRATOS, vigilados: VIGILADOS, hoy: '2026-10-11', lineaContratos: 'no_clasificado' })
eq('filtro de contratos: sin clasificar (sin la empresa de especialistas)', soloSinClasificar.contratos.rows.map(r => r.id), ['c4'])
section('SECOP I: valor adjudicado (dataset) intacto; el valor del proceso se reparte SOLO en los estimados (Integrado)')
const repartidos = repartirProcesosSecopI([
  // Integrado SECOP I sin equivalente en el dataset (constancia '21-4-1', de 2021: la marca no mira la fecha):
  // estimado → el valor del proceso se reparte.
  contrato('p1', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', estimado: true, proveedor_key: 'nit:900000001' }),
  contrato('p2', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', estimado: true, proveedor_key: 'nit:900000002' }),
  contrato('p3', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', estimado: true, proveedor_key: 'persona:abc', es_persona: true }),
  contrato('p4', { valor: 500, origen: 'SECOPI', numero_contrato: '21-4-1', estimado: true }), // otro valor: contrato propio
  contrato('p5', { valor: 900, origen: 'SECOPII', numero_contrato: '21-4-1' }), // SECOP II: no se reparte
  contrato('p6', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', estimado: true, nit_entidad: '800000002' }), // otra entidad
  contrato('p7', { valor: 900, origen: 'SECOPI', numero_contrato: null, estimado: true }), // sin constancia
  // Dataset SECOP I (f789-7hwg): valor ADJUDICADO por contratista. Misma constancia y valor que p1-p3, pero no
  // es estimado: no se reparte ni cuenta para el reparto de los estimados. valor_proceso viene de la columna.
  contrato('p8', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', fuente: 'SECOP I', valor_proceso: 2000, proveedor_key: 'nit:900000001' }),
  contrato('p9', { valor: 900, origen: 'SECOPI', numero_contrato: '21-4-1', fuente: 'SECOP I', valor_proceso: 2000, proveedor_key: 'nit:900000002' }),
])
eq('se reparte por partes iguales SOLO entre filas estimadas con la misma entidad, constancia y valor', repartidos.map(c => [c.id, c.valor, c.valor_proceso ?? null, c.contratistas_proceso ?? 1]), [
  ['p1', 300, 900, 3],
  ['p2', 300, 900, 3],
  ['p3', 300, 900, 3],
  ['p4', 500, null, 1],
  ['p5', 900, null, 1],
  ['p6', 900, null, 1],
  ['p7', 900, null, 1],
  ['p8', 900, 2000, 1],
  ['p9', 900, 2000, 1],
])
eq('la suma del proceso repartido es el valor publicado una vez', repartidos.slice(0, 3).reduce((acc, c) => acc + c.valor, 0), 900)
const dosEstimados = repartirProcesosSecopI([
  contrato('e1', { valor: 1000, origen: 'SECOPI', numero_contrato: '17-1-1', estimado: true, proveedor_key: 'nit:900000001' }),
  contrato('e2', { valor: 1000, origen: 'SECOPI', numero_contrato: '17-1-1', estimado: true, proveedor_key: 'nit:900000002' }),
])
eq('dos contratos iguales con estimado = true → mitad cada uno, con el valor del proceso guardado', dosEstimados.map(c => [c.valor, c.valor_proceso, c.contratistas_proceso]), [
  [500, 1000, 2],
  [500, 1000, 2],
])
const dosReales = repartirProcesosSecopI([
  contrato('r1', { valor: 1000, origen: 'SECOPI', numero_contrato: '17-1-1', estimado: false, proveedor_key: 'nit:900000001' }),
  contrato('r2', { valor: 1000, origen: 'SECOPI', numero_contrato: '17-1-1', estimado: false, proveedor_key: 'nit:900000002' }),
])
eq('los mismos con estimado = false quedan intactos aunque el origen sea SECOPI (ya no se reparte por origen)', dosReales.map(c => [c.valor, c.valor_proceso ?? null, c.contratistas_proceso ?? 1]), [
  [1000, null, 1],
  [1000, null, 1],
])
const estimadoConProceso = repartirProcesosSecopI([
  contrato('e3', { valor: 600, origen: 'SECOPI', numero_contrato: '16-1-1', estimado: true, valor_proceso: 700, proveedor_key: 'nit:900000001' }),
  contrato('e4', { valor: 600, origen: 'SECOPI', numero_contrato: '16-1-1', estimado: true, valor_proceso: 700, proveedor_key: 'nit:900000002' }),
])
eq('si la base ya trae valor_proceso, el reparto lo respeta', estimadoConProceso.map(c => [c.valor, c.valor_proceso]), [[300, 700], [300, 700]])

const fichaRepartida = summarizeHospitalSecop({ contratos: repartidos.filter(c => c.nit_entidad === '800000001'), vigilados: VIGILADOS, hoy: '2026-10-11' })
const filaRepartida = fichaRepartida.contratos.rows.find(r => r.id === 'p1')
eq('la ficha muestra la parte, el valor del proceso y la marca estimado', [filaRepartida?.valor, filaRepartida?.valorProceso, filaRepartida?.contratistasProceso, filaRepartida?.estimado], [300, 900, 3, true])
const filaAdjudicada = fichaRepartida.contratos.rows.find(r => r.id === 'p8')
eq('contrato del dataset SECOP I: adjudicado, valor del proceso como dato, sin reparto ni marca', [filaAdjudicada?.valor, filaAdjudicada?.valorProceso, filaAdjudicada?.contratistasProceso, filaAdjudicada?.estimado, filaAdjudicada?.fuente], [900, 2000, 1, false, 'SECOP I'])
// p1, p2, p3 (300 c/u), p4 (500) y p7 (900) son estimados y SUMAN; p5, p8 y p9 (900 c/u) no lo son.
eq('resumen: estimados contados aparte y SUMADOS en el total histórico', [fichaRepartida.estimados, fichaRepartida.totales.valorTotal, fichaRepartida.totales.contratosTotal], [{ contratos: 5, valor: 2300 }, 5000, 8])
const estimadosQueNoEntran = summarizeHospitalSecop({
  contratos: [
    contrato('x1', { valor: 9e13, estimado: true, linea: 'trauma' }), // fuera de escala: no suma → tampoco cuenta como estimado del total
    contrato('x2', { valor: 100, estimado: true, linea: 'no_clasificado' }), // sin clasificar: fuera del total
    contrato('x3', { valor: 50, estimado: true, es_persona: true, proveedor_key: 'persona:abc', proveedor_nit: null, proveedor_nombre: 'Dr. Juan Ruiz', especialidad: 'Ortopedia', linea: null }), // médico
    contrato('x4', { valor: 400, estimado: true, linea: 'columna' }),
  ],
  vigilados: VIGILADOS,
  hoy: '2026-10-11',
})
eq('estimados: solo los que entran en el total ortopédico (ni fuera de escala, ni sin clasificar, ni médicos)', [estimadosQueNoEntran.estimados, estimadosQueNoEntran.totales.valorTotal, estimadosQueNoEntran.totales.fueraEscala], [{ contratos: 1, valor: 400 }, 400, 1])
eq('sin estimados → 0', ficha.estimados, { contratos: 0, valor: 0 })
// La marca `estimado` la pone la vista por fuente (Integrado SECOP I sin fila secop1 de la constancia), NO por
// fecha: un estimado de 2021 cuenta como estimado y un adjudicado real del dataset SECOP I de 2016 no. Por eso
// la UI no debe etiquetar los estimados como "antes de 2018" (revisión 2026-10-12).
const estimadoSinFecha = summarizeHospitalSecop({
  contratos: [
    contrato('f1', { valor: 100, origen: 'SECOPI', estimado: true, linea: 'trauma', fecha: '2021-06-15' }),
    contrato('f2', { valor: 200, origen: 'SECOPI', estimado: false, fuente: 'SECOP I', valor_proceso: 250, linea: 'trauma', fecha: '2016-03-01' }),
  ],
  vigilados: VIGILADOS,
  hoy: '2026-10-11',
})
eq(
  'la marca estimado no depende de la fecha: estimado de 2021 cuenta; adjudicado real de 2016 no',
  [estimadoSinFecha.estimados, estimadoSinFecha.contratos.rows.map(r => [r.id, r.fecha, r.estimado])],
  [{ contratos: 1, valor: 100 }, [['f1', '2021-06-15', true], ['f2', '2016-03-01', false]]],
)

section('Compra pública (SECOP): marca manual → REPS → contratos')
eq('manual true manda aunque el REPS diga Privada y no haya contratos', resolverCompraPublica(true, 'Privada', 0), { publica: true, origen: 'manual' })
eq('manual false manda aunque el REPS diga Pública y haya contratos', resolverCompraPublica(false, 'Pública', 12), { publica: false, origen: 'manual' })
eq('sin marca: REPS Pública', resolverCompraPublica(null, 'Pública', 0), { publica: true, origen: 'reps' })
eq('sin marca: REPS Mixta', resolverCompraPublica(null, 'Mixta', 0), { publica: true, origen: 'reps' })
eq('sin marca: la naturaleza sin tilde o en mayúsculas también vale', resolverCompraPublica(null, 'PUBLICA', 0), { publica: true, origen: 'reps' })
eq('sin marca y REPS Privada: manda que el NIT tenga contratos', resolverCompraPublica(null, 'Privada', 3), { publica: true, origen: 'contratos' })
eq('sin marca ni REPS: contratos', resolverCompraPublica(undefined, null, 1), { publica: true, origen: 'contratos' })
eq('sin marca, REPS Privada y sin contratos → ninguno', resolverCompraPublica(null, 'Privada', 0), { publica: false, origen: 'ninguno' })
eq('sin marca, sin REPS ni contratos → ninguno', resolverCompraPublica(null, null, 0), { publica: false, origen: 'ninguno' })

const conPersonaProveedora = summarizeHospitalSecop({
  contratos: [contrato('p1', { valor: 500, es_persona: true, proveedor_key: 'persona:zzz', proveedor_nit: null, proveedor_nombre: 'Pedro Gómez', especialidad: null, linea: 'trauma', fecha: '2026-04-01' })],
  vigilados: VIGILADOS,
  hoy: '2026-10-11',
})
eq('persona natural con línea = proveedor de material, no médico', [conPersonaProveedora.totales.valorTotal, conPersonaProveedora.proveedores.map(p => [p.key, p.nit]), conPersonaProveedora.medicos.length, conPersonaProveedora.contratos.rows[0].esServicio], [500, [['persona:zzz', null]], 0, false])
const vacia = summarizeHospitalSecop({ contratos: [], vigilados: VIGILADOS, hoy: '2026-10-11' })
eq('sin contratos', [vacia.totales.valorTotal, vacia.anual.length, vacia.contratos.pages, vacia.contratos.rows.length], [0, 0, 1, 0])

// ---------------------------------------------------------------------------
section('Ranking')
const porHospital = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'hospital', filter: {}, vigilados: VIGILADOS, withExecutive: true })
eq('kpis: solo entidades de OpMap y sin médicos', [porHospital.kpis.valor, porHospital.kpis.contratos, porHospital.kpis.entidades, porHospital.kpis.proveedores], [2000, 3, 2, 2])
eq('kpis: vigilados', [porHospital.kpis.valorVigilados, porHospital.kpis.vigiladosPct], [1000, 50])
eq('kpis: médicos y empresas de especialistas aparte', [porHospital.kpis.medicos, porHospital.kpis.contratosMedicos], [3, 3])
eq('kpis: fuera de escala aparte', [porHospital.kpis.fueraEscala, porHospital.kpis.valorFueraEscala], [1, 1e12])
const conAtipicoP99 = aggregateSecopRanking({ facts: [fact({ nit_entidad: '800000002', valor: 900, atipico: true })], hospitals: HOSPITALS, group: 'hospital', filter: {}, vigilados: VIGILADOS, withExecutive: false })
eq('atípico p99 (valor normal) sí suma', [conAtipicoP99.kpis.valor, conAtipicoP99.kpis.fueraEscala], [900, 0])
const grupoFuera = aggregateSecopRanking({
  facts: [
    fact({ nit_entidad: '800000002', valor: 2e11, contratos: 2, fuera_escala: true }),
    fact({ nit_entidad: '800000002', valor: 6e10, contratos: 2, fuera_escala: false }),
  ],
  hospitals: HOSPITALS,
  group: 'hospital',
  filter: {},
  vigilados: VIGILADOS,
  withExecutive: false,
})
eq('hechos agregados: manda la marca fuera_escala de la base, no la suma del grupo', [grupoFuera.kpis.valor, grupoFuera.kpis.contratos, grupoFuera.kpis.fueraEscala], [6e10, 2, 2])
eq('filas por NIT con la sede de más camas', porHospital.rows.map(r => [r.nit, r.label, r.valor, r.pct, r.sedes, r.hospital_id]), [
  ['800000001', 'ESE Hospital A sede norte', 1400, 70, 2, 'h-a1'],
  ['800000002', 'Hospital B', 600, 30, 1, 'h-b'],
])
eq('ejecutivo de la sede principal', [porHospital.rows[0].ejecutivo, porHospital.rows[0].ejecutivo_color], ['Ana Pérez', '#2a78d6'])
eq('principal proveedor del hospital A', porHospital.rows[0].top_proveedor, 'Prov Uno SAS')
eq('valor por línea del hospital A', porHospital.rows[0].lineas, { trauma: 1000, reemplazo: 400 })
eq('por línea antes del filtro (incluye sin clasificar, que no suma)', porHospital.porLinea.map(l => [l.linea, l.orto, l.valor]), [
  ['trauma', true, 1000],
  ['reemplazo', true, 400],
  ['columna', true, 600],
  ['no_clasificado', false, 250],
])
const lineaTodas = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'proveedor', filter: { linea: 'todas' }, vigilados: VIGILADOS, withExecutive: false })
eq('linea=todas suma sin clasificar', [lineaTodas.kpis.valor, lineaTodas.rows.find(r => r.nit === '900000002')?.lineas], [2250, { reemplazo: 400, columna: 600, no_clasificado: 250 }])
const lineaSin = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'hospital', filter: { linea: 'no_clasificado' }, vigilados: VIGILADOS, withExecutive: false })
eq('linea=no_clasificado solo eso', [lineaSin.kpis.valor, lineaSin.rows.map(r => r.nit)], [250, ['800000001']])

const deptoBolivar = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'hospital', filter: { departamento: '13' }, vigilados: VIGILADOS, withExecutive: false })
eq('filtro departamento: solo la parte de la sede sur (100/400 camas)', deptoBolivar.rows.map(r => [r.nit, r.valor]), [['800000001', 350]])
eq('filtro departamento: kpi', deptoBolivar.kpis.valor, 350)

const lineaTrauma = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'hospital', filter: { linea: 'Trauma y osteosíntesis' }, vigilados: VIGILADOS, withExecutive: false })
eq('filtro de línea por rótulo', [lineaTrauma.kpis.valor, lineaTrauma.rows.map(r => r.nit)], [1000, ['800000001']])

const porProveedor = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'proveedor', filter: {}, vigilados: VIGILADOS, withExecutive: false })
eq('proveedores (ámbito IPS); empate de valor: más contratos primero', porProveedor.rows.map(r => [r.nit, r.valor, r.contratos, r.entidades, r.vigilado]), [
  ['900000002', 1000, 2, 2, true],
  ['900000001', 1000, 1, 1, false],
])
const todas = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'proveedor', filter: { departamento: '13' }, vigilados: VIGILADOS, withExecutive: false, ambito: 'todas' })
eq('ámbito todas: incluye entidades que no son IPS e ignora departamento', [todas.kpis.valor, todas.rows[0].nit, todas.rows[0].valor, todas.rows[0].top_entidad], [7000, '900000001', 6000, 'Gobernación X'])
eq('ámbito todas: sin tabla proveedor × hospital', todas.pares.length, 0)
const todasEnHospital = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'hospital', filter: {}, vigilados: VIGILADOS, withExecutive: false, ambito: 'todas' })
eq('ámbito todas solo aplica a proveedor', todasEnHospital.kpis.valor, 2000)

const porZona = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'zona', filter: {}, vigilados: VIGILADOS, withExecutive: false })
eq('zonas con reparto por camas (A: 75 % / 25 %)', porZona.rows.map(r => [r.label, r.valor, r.contratos, r.hospitales]), [
  ['Atlántico y Magdalena', 1650, 3, 2],
  ['Bolívar', 350, 2, 1],
])
eq('la suma de zonas es el total (no duplica)', porZona.rows.reduce((acc, r) => acc + r.valor, 0), porZona.kpis.valor)

const porEjecutivo = aggregateSecopRanking({ facts: FACTS, hospitals: HOSPITALS, group: 'ejecutivo', filter: {}, vigilados: VIGILADOS, withExecutive: true })
eq('ejecutivos: cubierta y vacante', porEjecutivo.rows.map(r => [r.label, r.valor, r.zonas]), [
  ['Ana Pérez', 1650, ['Atlántico y Magdalena']],
  ['Vacante', 350, ['Bolívar']],
])

eq('pares proveedor × hospital', porHospital.pares.map(p => [p.proveedor_nit, p.nit_entidad, p.valor, p.vigilado]), [
  ['900000001', '800000001', 1000, false],
  ['900000002', '800000002', 600, true],
  ['900000002', '800000001', 400, true],
])

const agregados = aggregateSecopRanking({
  facts: [fact({ nit_entidad: '800000002', valor: 900, contratos: 3 })],
  hospitals: HOSPITALS,
  group: 'hospital',
  filter: {},
  vigilados: VIGILADOS,
  withExecutive: false,
})
eq('hechos agregados suman su nº de contratos', [agregados.kpis.contratos, agregados.rows[0].contratos], [3, 3])
const vacio = aggregateSecopRanking({ facts: [], hospitals: HOSPITALS, group: 'zona', filter: {}, vigilados: VIGILADOS, withExecutive: false })
eq('sin hechos', [vacio.kpis.valor, vacio.kpis.vigiladosPct, vacio.rows.length], [0, null, 0])

// ---------------------------------------------------------------------------
section('Proveedor')
const prov = summarizeProveedorSecop({ nit: '900000001', facts: FACTS, hospitals: HOSPITALS, vigilados: VIGILADOS })
eq('totales del proveedor (incluye entidades que no son IPS)', [prov.total, prov.contratos, prov.totalIps, prov.vigilado, prov.nombre], [6000, 2, 1000, false, 'Prov Uno SAS'])
eq('entidades: la que no es IPS va marcada', prov.entidades.map(e => [e.nit, e.nombre, e.esIps, e.valor, e.hospital_id]), [
  ['899999999', 'Gobernación X', false, 5000, null],
  ['800000001', 'ESE Hospital A sede norte', true, 1000, 'h-a1'],
])
eq('por año', prov.anual.map(a => [a.anio, a.total]), [[2026, 6000]])
eq('años por entidad', prov.entidades[1].anios, { '2026': 1000 })
const prov2 = summarizeProveedorSecop({ nit: '900000002', facts: FACTS, hospitals: HOSPITALS, vigilados: VIGILADOS })
eq('proveedor vigilado: todo su material, sin clasificar incluido', [prov2.vigilado, prov2.total, prov2.totalOrto, prov2.porLinea.map(l => l.linea)], [true, 1250, 1000, ['reemplazo', 'columna', 'no_clasificado']])
eq('proveedor: fuera de escala aparte', prov.fueraEscala, 1)
const provServicio = summarizeProveedorSecop({ nit: '900000009', facts: FACTS, hospitals: HOSPITALS, vigilados: VIGILADOS })
eq('empresa de especialistas: sin ventas de material', [provServicio.total, provServicio.contratos], [0, 0])

// ---------------------------------------------------------------------------
section('Parámetros')
const hoy = '2026-10-11'
const def = parseSecopRankingQuery(new URLSearchParams(''), hoy)
eq('por defecto: hospital, 24 meses hasta el mes actual', def.ok ? def.value : def, { group: 'hospital', linea: null, line: null, departamento: null, desde: '2024-11', hasta: '2026-10', ambito: 'ips' })
const conHasta = parseSecopRankingQuery(new URLSearchParams('hasta=2025-06'), hoy)
eq('solo hasta: 24 meses hacia atrás', conHasta.ok ? [conHasta.value.desde, conHasta.value.hasta] : conHasta, ['2023-07', '2025-06'])
check('ejecutivo sin line → error', !parseSecopRankingQuery(new URLSearchParams('group=ejecutivo'), hoy).ok)
check('ejecutivo con line → ok', parseSecopRankingQuery(new URLSearchParams('group=ejecutivo&line=perossal'), hoy).ok)
check('group inválido → error', !parseSecopRankingQuery(new URLSearchParams('group=eps'), hoy).ok)
check('mes mal formado → error', !parseSecopRankingQuery(new URLSearchParams('desde=2025-13'), hoy).ok)
check('desde > hasta → error', !parseSecopRankingQuery(new URLSearchParams('desde=2026-05&hasta=2026-01'), hoy).ok)
check('desde antes de 2005 → error', !parseSecopRankingQuery(new URLSearchParams('desde=2004-12&hasta=2006-01'), hoy).ok)
check('departamento mal formado → error', !parseSecopRankingQuery(new URLSearchParams('departamento=8'), hoy).ok)
check('ámbito inválido → error', !parseSecopRankingQuery(new URLSearchParams('ambito=x'), hoy).ok)
const ambitoHosp = parseSecopRankingQuery(new URLSearchParams('group=hospital&ambito=todas'), hoy)
eq('ámbito todas solo para proveedor', ambitoHosp.ok ? ambitoHosp.value.ambito : ambitoHosp, 'ips')
const lineaRot = parseSecopRankingQuery(new URLSearchParams('linea=Reemplazo%20articular'), hoy)
eq('linea por rótulo', lineaRot.ok ? lineaRot.value.linea : lineaRot, 'reemplazo')
const lineaT = parseSecopRankingQuery(new URLSearchParams('linea=todas'), hoy)
eq('linea=todas', lineaT.ok ? lineaT.value.linea : lineaT, 'todas')
const lineaNC = parseSecopRankingQuery(new URLSearchParams('linea=no_clasificado'), hoy)
eq('linea=no_clasificado', lineaNC.ok ? lineaNC.value.linea : lineaNC, 'no_clasificado')
check('linea desconocida → error', !parseSecopRankingQuery(new URLSearchParams('linea=dental'), hoy).ok)

// ---------------------------------------------------------------------------
section('CSV')
eq('celda con fórmula se neutraliza', csvCell('=SUM(A1)'), "'=SUM(A1)")
eq('celda con ; entre comillas', csvCell('a;b'), '"a;b"')
eq('booleano', csvCell(true), 'Sí')
const csv = buildSecopCsv({ group: 'hospital', range: { desde: '2024-11', hasta: '2026-10' }, linea: null, line: null, ambito: 'ips', rows: porHospital.rows, pares: porHospital.pares })
check('CSV con BOM y CRLF', csv.startsWith('﻿') && csv.includes('\r\n'))
check('CSV con encabezado de hospital', csv.includes('IPS;NIT;Nombre en SECOP;Sedes en OpMap'))
check('CSV por defecto: 6 líneas ortopédicas, sin "Sin clasificar"', csv.includes('Otros implantes (COP)') && !csv.includes('Sin clasificar (COP)'))
const csvTodas = buildSecopCsv({ group: 'zona', range: { desde: '2024-11', hasta: '2026-10' }, linea: 'todas', line: null, ambito: 'ips', rows: porZona.rows, pares: [] })
check('CSV con linea=todas incluye "Sin clasificar"', csvTodas.includes('Sin clasificar (COP)') && csvTodas.startsWith('\ufeffFuente'))
check('CSV con sección proveedor × hospital', csv.includes('Proveedor × hospital'))
const csvProv = buildSecopCsv({ group: 'proveedor', range: { desde: '2024-11', hasta: '2026-10' }, linea: 'trauma', line: null, ambito: 'todas', rows: todas.rows, pares: [] })
check('CSV de proveedor con vigilado y solo la línea filtrada', csvProv.includes('Proveedor;NIT;Vigilado') && csvProv.includes('Trauma y osteosíntesis (COP)') && !csvProv.includes('Columna (COP)'))

// ---------------------------------------------------------------------------
section('Fuentes de datos')
const merged = mergeFuentes(
  [
    { fuente: 'secop_ii', nombre: 'SECOP II', frecuencia: 'Diaria', tipo: 'ligera', como: 'Vercel Cron', manual: true },
    { fuente: 'adres_identifica', nombre: 'ADRES', frecuencia: 'Mensual', tipo: 'pesada', como: 'GitHub Actions', manual: false },
  ],
  [
    { fuente: 'secop_ii', ultimo_ok: '2026-10-11T06:00:00Z', estado: 'ok', filas: 876 },
    { fuente: 'otra', estado: 'ok' },
  ]
)
eq('catálogo + estado + desconocidas al final', merged.map(f => [f.fuente, f.estado, f.filas, f.manual]), [
  ['secop_ii', 'ok', 876, true],
  ['adres_identifica', null, null, false],
  ['otra', 'ok', null, false],
])
const ahora = new Date('2026-10-11T12:00:00Z')
eq('semáforo ok', fuenteSemaforo({ estado: 'ok', ultimo_ok: '2026-10-11T06:00:00Z', ultimo_intento: null }, 1, ahora), 'ok')
eq('semáforo atrasada (3 días con periodo diario)', fuenteSemaforo({ estado: 'ok', ultimo_ok: '2026-10-08T06:00:00Z', ultimo_intento: null }, 1, ahora), 'atrasada')
eq('semáforo error', fuenteSemaforo({ estado: 'error', ultimo_ok: '2026-10-11T06:00:00Z', ultimo_intento: null }, 1, ahora), 'error')
eq('semáforo nunca', fuenteSemaforo({ estado: null, ultimo_ok: null, ultimo_intento: null }, 1, ahora), 'nunca')
eq('semáforo en curso (corriendo)', fuenteSemaforo({ estado: 'corriendo', ultimo_ok: '2026-10-01T06:00:00Z', ultimo_intento: null }, 1, ahora), 'en_curso')
eq('cron diario en hora de Colombia', describeCron('0 6 * * *'), 'Todos los días a la 1:00 a. m.')
eq('cron semanal', describeCron('0 7 * * 1'), 'Los lunes a las 2:00 a. m.')
eq('cron mensual', describeCron('0 7 3 * *'), 'El día 3 de cada mes a las 2:00 a. m.')
eq('cron que cruza la medianoche en Colombia', describeCron('30 3 * * 1'), 'Los domingos a las 10:30 p. m.')
eq('cron de tarde', describeCron('15 20 * * *'), 'Todos los días a las 3:15 p. m.')
eq('cron no reconocido', [describeCron('*/5 * * * *'), describeCron('0 6 1 1 *'), describeCron(null)], ['Cron */5 * * * * (UTC)', 'Cron 0 6 1 1 * (UTC)', null])
eq('cron mensual que cruza la medianoche el día 1', describeCron('0 2 1 * *'), 'El último día de cada mes a las 9:00 p. m.')
const conCron = mergeFuentes([{ fuente: 'secop_ii', nombre: 'SECOP II', frecuencia: 'Diaria', tipo: 'ligera', como: 'Vercel Cron', manual: true }], [{ fuente: 'secop_ii', nombre: 'SECOP II · Contratos', programacion: '0 6 * * *', ejecutor: 'vercel_cron', siguiente_programado: null }], ahora)
const mensual = mergeFuentes([{ fuente: 'reps_sedes', nombre: 'REPS', frecuencia: 'Mensual', tipo: 'ligera', como: 'Vercel Cron', manual: true }], [{ fuente: 'reps_sedes', programacion: '0 8 2 * *' }], ahora)
eq('merge: próxima mensual (el día 2 ya pasó)', [mensual[0].siguiente_programado, mensual[0].horario], ['2026-11-02T08:00:00.000Z', 'El día 2 de cada mes a las 3:00 a. m.'])
eq('merge: siguiente_programado guardado manda', mergeFuentes([], [{ fuente: 'x', programacion: '0 6 * * *', siguiente_programado: '2030-01-01T00:00:00Z' }], ahora)[0].siguiente_programado, '2030-01-01T00:00:00Z')
eq('merge: nombre de la tabla, horario y próxima calculada', [conCron[0].nombre, conCron[0].horario, conCron[0].siguiente_programado, conCron[0].ejecutor], ['SECOP II · Contratos', 'Todos los días a la 1:00 a. m.', '2026-10-12T06:00:00.000Z', 'vercel_cron'])

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`)
if (failed > 0) process.exit(1)
