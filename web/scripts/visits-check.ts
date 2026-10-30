/**
 * Fase 7 · F2 Configuración y calendario: pruebas puras de lib/visits-rules.ts, lib/visits-config-schemas.ts y
 * de los permisos y el rol de recursos humanos en lib/permissions.ts. SIN red ni Supabase.
 * Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "Código puro" y "Verificación").
 *
 * Uso (desde web/): npx tsx scripts/visits-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import type { z } from 'zod'
import {
  puedeAprobarseASiMismo,
  CONTEO_SEMILLA,
  DIAS_ADELANTE_DIA_LIBRE,
  DIAS_ATRAS_MIS_DIAS_LIBRES,
  GENERAL_POR_DEFECTO,
  MAX_IDS_REVISION,
  MENSAJE_HASTA_ANTES_DE_DESDE,
  MENSAJE_MOTIVO_CIERRE_PASADO,
  MENSAJE_MOTIVO_PASADO,
  MENSAJE_VALOR_ANULADO,
  MENSAJE_VALOR_NO_EXISTE,
  METAS_SEMILLA,
  MOTIVO_VUELVE_ANTERIOR,
  PERFIL_POR_DEFECTO,
  VALORES_PARAMETRO_GENERAL,
  claveConfig,
  configPersonaVigente,
  consultaMisDiasLibres,
  cuotaPeriodo,
  diaSemanaIso,
  ejecutivaPuedeAnular,
  enLotes,
  esFechaIso,
  estadoInicialDiaLibre,
  festivosColombia,
  fraccionHabil,
  fraccionLibre,
  fraccionPorAprobar,
  generalVigente,
  generalesVigentes,
  hoyBogota,
  limitesMes,
  mensajeSuperposicion,
  mesDe,
  mesesAfectados,
  metaDiaria,
  municipioDeZona,
  nombreMotivoDiaLibre,
  pascua,
  pestanasCalendario,
  planearCambio,
  planearCierre,
  puedeRegistrarDiaLibre,
  rangoFechas,
  resolverDiaHabil,
  resolverMeta,
  resumenCuotaTipo,
  revisarDiaLibre,
  ritmo,
  rolPuedeAprobar,
  seSuperponen,
  subtiposConMetaPropia,
  sumarDias,
  textoLimiteRegistro,
  valorVigente,
  valorVisita,
  venceRegistroDiaLibre,
  type ConteoCampos,
  type ConteoVigencia,
  type DiaCalendarioEntrada,
  type DiaLibreEntrada,
  type GeneralVigencia,
  type MetaVigencia,
  type PersonaCuota,
  type PersonaVigencia,
  type PlanCambio,
  type Vigencia,
} from '../lib/visits-rules'
import {
  anularSchema,
  calendarioDiaCreateSchema,
  cambioConfigSchema,
  cargarFestivosSchema,
  cerrarConfigSchema,
  consultaCalendarioSchema,
  consultaDiasLibresSchema,
  diaLibreCreateSchema,
  diaLibrePorOtraSchema,
  mesSchema,
  revisarDiasLibresSchema,
  subtipoCreateSchema,
  subtipoUpdateSchema,
  valorGeneralSchemas,
} from '../lib/visits-config-schemas'
import {
  PERMISOS_CALENDARIO,
  PERMISOS_CONFIGURACION,
  getAllowedRoutes,
  getNavigationMenu,
  getRoleTitle,
  hasPermission,
  type Permission,
  type Role,
} from '../lib/permissions'
import { roleSchema } from '../lib/user-schemas'

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

type Resultado = z.SafeParseReturnType<unknown, unknown>

/** La validación pasa; devuelve los datos para seguir comprobando. */
function valido<T>(name: string, result: z.SafeParseReturnType<unknown, T>): T | undefined {
  check(name, result.success, result.success ? undefined : result.error.issues)
  return result.success ? result.data : undefined
}

/** La validación falla y el PRIMER mensaje (el que muestra la UI) contiene el texto esperado. */
function invalido(name: string, result: Resultado, mensaje: string) {
  const primero = result.success ? null : result.error.issues[0]?.message ?? ''
  check(name, primero !== null && primero.includes(mensaje), { primero, esperado: mensaje })
}

const EJ = '3f2504e0-4f89-11d3-9a0c-0305e82c3301' // la ejecutiva de las pruebas
const EJ_2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const KAM = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' // su zona (Medellín)
const KAM_2 = '9b2c5e1a-0d4f-4c7e-8a1b-2f3e4d5c6b7a'
const COMPRAS = 'a1a1a1a1-0000-4000-8000-000000000001'
const PROGRAMACION = 'a1a1a1a1-0000-4000-8000-000000000004'
const MEDELLIN = '05001'
const BOGOTA = '11001'
const HOY = '2026-10-12' // lunes festivo: el día de las decisiones

// ---------------------------------------------------------------------------------------------
console.log('1. Fechas (texto ISO, Bogotá UTC−5)')
eq('sumarDias +1 cruza el mes', sumarDias('2026-10-31', 1), '2026-11-01')
eq('sumarDias −1 cruza el año', sumarDias('2027-01-01', -1), '2026-12-31')
eq('sumarDias 29 de febrero bisiesto', sumarDias('2028-02-28', 1), '2028-02-29')
eq('diaSemanaIso: 2026-10-12 es lunes (1)', diaSemanaIso('2026-10-12'), 1)
eq('diaSemanaIso: 2026-10-17 es sábado (6)', diaSemanaIso('2026-10-17'), 6)
eq('diaSemanaIso: 2026-10-18 es domingo (7)', diaSemanaIso('2026-10-18'), 7)
eq('rangoFechas incluye los dos extremos', rangoFechas('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
eq('rangoFechas al revés → []', rangoFechas('2026-10-12', '2026-10-11'), [])
eq('hoyBogota: 04:59 UTC todavía es el día anterior', hoyBogota(new Date('2026-10-12T04:59:59Z')), '2026-10-11')
eq('hoyBogota: 05:00 UTC ya es el día', hoyBogota(new Date('2026-10-12T05:00:00Z')), '2026-10-12')
eq('hoyBogota: 23:30 de Bogotá (04:30 UTC del día siguiente)', hoyBogota(new Date('2026-10-13T04:30:00Z')), '2026-10-12')
eq('mesDe', mesDe('2026-10-12'), '2026-10')
eq('limitesMes de febrero de 2027 (28 días)', limitesMes('2027-02'), { desde: '2027-02-01', hasta: '2027-02-28' })
eq('limitesMes de febrero de 2028 (bisiesto)', limitesMes('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' })
eq('limitesMes de diciembre', limitesMes('2026-12'), { desde: '2026-12-01', hasta: '2026-12-31' })
check('esFechaIso: 2026-02-30 no existe', !esFechaIso('2026-02-30'))
check('esFechaIso: 2026-10-12 sí', esFechaIso('2026-10-12'))
check('esFechaIso: sin ceros no', !esFechaIso('2026-1-5'))

// ---------------------------------------------------------------------------------------------
console.log('2. Pascua (algoritmo gregoriano anónimo) contra fechas conocidas')
const pascuas: [number, string][] = [
  [2024, '2024-03-31'],
  [2025, '2025-04-20'],
  [2026, '2026-04-05'],
  [2027, '2027-03-28'],
  [2028, '2028-04-16'],
  [2029, '2029-04-01'],
  [2030, '2030-04-21'],
]
for (const [anio, fecha] of pascuas) eq(`Pascua ${anio}`, pascua(anio), fecha)
for (const [anio] of pascuas) check(`Pascua ${anio} cae en domingo`, diaSemanaIso(pascua(anio)) === 7)

// ---------------------------------------------------------------------------------------------
console.log('3. Festivos de Colombia (Ley 51 de 1983): la lista literal del contrato')
const esperados2026 = ['01-01', '01-12', '03-23', '04-02', '04-03', '05-01', '05-18', '06-08', '06-15', '06-29', '07-20', '08-07', '08-17', '10-12', '11-02', '11-16', '12-08', '12-25'].map(d => `2026-${d}`)
const esperados2027 = ['01-01', '01-11', '03-22', '03-25', '03-26', '05-01', '05-10', '05-31', '06-07', '07-05', '07-20', '08-07', '08-16', '10-18', '11-01', '11-15', '12-08', '12-25'].map(d => `2027-${d}`)
const f2026 = festivosColombia(2026)
const f2027 = festivosColombia(2027)
eq('2026: exactamente las 18 fechas esperadas, en orden', f2026.map(f => f.fecha), esperados2026)
eq('2027: exactamente las 18 fechas esperadas, en orden', f2027.map(f => f.fecha), esperados2027)
check('2026: el 2 de noviembre es festivo (Todos los Santos trasladado)', f2026.some(f => f.fecha === '2026-11-02' && f.nombre === 'Todos los Santos'))
check('2026: el 13 de julio NO es festivo', !f2026.some(f => f.fecha === '2026-07-13'))
check('2026: hoy (12 de octubre) es el Día de la Raza', f2026.some(f => f.fecha === '2026-10-12' && f.nombre === 'Día de la Raza'))
eq('2026: nombres exactos (los mismos de la función SQL)', f2026.map(f => f.nombre), [
  'Año Nuevo',
  'Día de los Reyes Magos',
  'Día de San José',
  'Jueves Santo',
  'Viernes Santo',
  'Día del Trabajo',
  'Ascensión del Señor',
  'Corpus Christi',
  'Sagrado Corazón de Jesús',
  'San Pedro y San Pablo',
  'Día de la Independencia',
  'Batalla de Boyacá',
  'Asunción de la Virgen',
  'Día de la Raza',
  'Todos los Santos',
  'Independencia de Cartagena',
  'Inmaculada Concepción',
  'Navidad',
])
check('2027: Jueves y Viernes Santo el 25 y 26 de marzo', f2027.some(f => f.fecha === '2027-03-25' && f.nombre === 'Jueves Santo') && f2027.some(f => f.fecha === '2027-03-26' && f.nombre === 'Viernes Santo'))
check('2027: San Pedro y San Pablo (29 de junio, martes) pasa al lunes 5 de julio', f2027.some(f => f.fecha === '2027-07-05' && f.nombre === 'San Pedro y San Pablo'))
let todosBien = true
for (let anio = 2020; anio <= 2100; anio++) {
  const lista = festivosColombia(anio)
  const trasladados = lista.filter(f => !['Año Nuevo', 'Día del Trabajo', 'Día de la Independencia', 'Batalla de Boyacá', 'Inmaculada Concepción', 'Navidad', 'Jueves Santo', 'Viernes Santo'].includes(f.nombre))
  if (lista.length !== 18 || !lista.every(f => f.fecha.startsWith(`${anio}-`)) || !trasladados.every(f => diaSemanaIso(f.fecha) === 1)) todosBien = false
}
check('2020 a 2100: siempre 18, todos del año y los trasladados en lunes', todosBien)
const f2038 = festivosColombia(2038).filter(f => f.fecha === '2038-07-05').map(f => f.nombre)
eq('2038: Sagrado Corazón y San Pedro caen el mismo lunes (la lista trae los dos, como la SQL)', f2038, ['Sagrado Corazón de Jesús', 'San Pedro y San Pablo'])

/** Filas nacionales de calendario, como las carga calendario_cargar_festivos. */
const nacionales = (...anios: number[]): DiaCalendarioEntrada[] =>
  anios.flatMap(anio =>
    festivosColombia(anio).map(f => ({ fecha: f.fecha, alcance: 'nacional' as const, municipality_id: null, tipo: 'no_habil' as const, nombre: f.nombre }))
  )

// ---------------------------------------------------------------------------------------------
console.log('4. Vigencias: valor vigente y superposición')
const vA: Vigencia = { id: 'a', vigente_desde: '2026-10-12', vigente_hasta: '2026-10-31', anulado_at: null }
const vB: Vigencia = { id: 'b', vigente_desde: '2026-11-01', vigente_hasta: null, anulado_at: null }
const vAnulada: Vigencia = { id: 'x', vigente_desde: '2026-10-20', vigente_hasta: null, anulado_at: '2026-10-12T15:00:00Z' }
eq('valorVigente el 31 de octubre → a', valorVigente([vA, vB, vAnulada], '2026-10-31')?.id, 'a')
eq('valorVigente el 1 de noviembre → b', valorVigente([vA, vB, vAnulada], '2026-11-01')?.id, 'b')
eq('valorVigente antes de todo → null', valorVigente([vA, vB], '2026-10-11'), null)
eq('valorVigente ignora las anuladas', valorVigente([vAnulada], '2026-10-25'), null)
eq(
  'valorVigente con dos que rigen (no debería pasar) → la de inicio más reciente',
  valorVigente([{ id: 'v', vigente_desde: '2026-01-01', vigente_hasta: null }, { id: 'n', vigente_desde: '2026-06-01', vigente_hasta: null }], '2026-07-01')?.id,
  'n'
)
check('seSuperponen: consecutivos no', !seSuperponen(vA, vB))
check('seSuperponen: comparten un día sí', seSuperponen(vA, { vigente_desde: '2026-10-31', vigente_hasta: '2026-11-05' }))
check('seSuperponen: dos abiertos sí', seSuperponen(vB, { vigente_desde: '2027-01-01', vigente_hasta: null }))
check('seSuperponen: una anulada no choca', !seSuperponen(vA, vAnulada))

// ---------------------------------------------------------------------------------------------
console.log('5. planearCambio: espejo de los pasos 3 a 6 de config_registrar')
const abierta: Vigencia = { id: 'abierta', vigente_desde: HOY, vigente_hasta: null, anulado_at: null }
eq('valor temporal: corta, crea la continuación y rige hasta "hasta"', planearCambio([abierta], { desde: '2026-11-01', hasta: '2026-11-30' }, HOY), {
  anular: [],
  cortar: [{ id: 'abierta', vigente_hasta: '2026-10-31' }],
  continuar: [{ deId: 'abierta', vigente_desde: '2026-12-01', vigente_hasta: null }],
  hastaEfectivo: '2026-11-30',
  error: null,
  requiereMotivo: false,
} satisfies PlanCambio)
eq('mismo día: anula la que empieza ese día (no la corta)', planearCambio([abierta], { desde: HOY }, HOY), {
  anular: ['abierta'],
  cortar: [],
  continuar: [],
  hastaEfectivo: null,
  error: null,
  requiereMotivo: false,
} satisfies PlanCambio)
eq(
  'mismo día y temporal: anula y continúa el valor anulado después',
  planearCambio([{ id: 'p', vigente_desde: '2026-10-20', vigente_hasta: null }], { desde: '2026-10-20', hasta: '2026-10-25' }, HOY),
  { anular: ['p'], cortar: [], continuar: [{ deId: 'p', vigente_desde: '2026-10-26', vigente_hasta: null }], hastaEfectivo: '2026-10-25', error: null, requiereMotivo: false } satisfies PlanCambio
)
eq(
  'la cortada terminaba antes de "hasta": sin continuación',
  planearCambio([{ id: 'c', vigente_desde: HOY, vigente_hasta: '2026-11-15' }], { desde: '2026-11-01', hasta: '2026-11-30' }, HOY),
  { anular: [], cortar: [{ id: 'c', vigente_hasta: '2026-10-31' }], continuar: [], hastaEfectivo: '2026-11-30', error: null, requiereMotivo: false } satisfies PlanCambio
)
eq('sin "hasta" y con un valor futuro: rige hasta el día anterior a ese valor', planearCambio([vA, vB], { desde: '2026-10-20' }, HOY), {
  anular: [],
  cortar: [{ id: 'a', vigente_hasta: '2026-10-19' }],
  continuar: [],
  hastaEfectivo: '2026-10-31',
  error: null,
  requiereMotivo: false,
} satisfies PlanCambio)
eq('un rango que se superpone con un valor futuro se rechaza (con su fecha) y no hace nada', planearCambio([vA, vB], { desde: '2026-10-20', hasta: '2026-11-10' }, HOY), {
  anular: [],
  cortar: [],
  continuar: [],
  hastaEfectivo: null,
  error: 'El rango se superpone con un valor que empieza el 2026-11-01',
  requiereMotivo: false,
} satisfies PlanCambio)
eq('mensajeSuperposicion', mensajeSuperposicion('2026-11-01'), 'El rango se superpone con un valor que empieza el 2026-11-01')
eq('"hasta" antes de "desde" se rechaza', planearCambio([abierta], { desde: '2026-11-10', hasta: '2026-11-01' }, HOY).error, MENSAJE_HASTA_ANTES_DE_DESDE)
eq('las anuladas no cuentan (ni se cortan ni chocan)', planearCambio([vAnulada], { desde: '2026-10-25', hasta: '2026-10-30' }, HOY), {
  anular: [],
  cortar: [],
  continuar: [],
  hastaEfectivo: '2026-10-30',
  error: null,
  requiereMotivo: false,
} satisfies PlanCambio)
eq('sin filas: rige abierto', planearCambio([], { desde: HOY }, HOY).hastaEfectivo, null)

console.log('5b. Corregir el pasado: motivo obligatorio y meses que se recalculan')
const pasadoSinMotivo = planearCambio([abierta], { desde: '2026-08-15', motivo: '' }, HOY)
eq('pasado sin motivo → se rechaza', pasadoSinMotivo.error, MENSAJE_MOTIVO_PASADO)
eq('pasado con motivo corto (4) → se rechaza', planearCambio([abierta], { desde: '2026-08-15', motivo: ' abcd ' }, HOY).error, MENSAJE_MOTIVO_PASADO)
eq('pasado con motivo null → se rechaza', planearCambio([abierta], { desde: '2026-08-15', motivo: null }, HOY).error, MENSAJE_MOTIVO_PASADO)
const pasadoVistaPrevia = planearCambio([abierta], { desde: '2026-08-15' }, HOY)
check('vista previa sin la clave motivo: muestra el plan y avisa que pide motivo', pasadoVistaPrevia.error === null && pasadoVistaPrevia.requiereMotivo)
const pasadoConMotivo = planearCambio([abierta], { desde: '2026-08-15', motivo: 'Corrección acordada con la directora' }, HOY)
eq('pasado con motivo: rige hasta el día anterior al valor siguiente', pasadoConMotivo, {
  anular: [],
  cortar: [],
  continuar: [],
  hastaEfectivo: '2026-10-11',
  error: null,
  requiereMotivo: true,
} satisfies PlanCambio)
eq('mesesAfectados del cambio anterior: agosto, septiembre y octubre', mesesAfectados('2026-08-15', pasadoConMotivo.hastaEfectivo, HOY), ['2026-08', '2026-09', '2026-10'])
eq('mesesAfectados abierto hasta hoy', mesesAfectados('2026-08-15', null, HOY), ['2026-08', '2026-09', '2026-10'])
eq('mesesAfectados de un valor temporal en el pasado', mesesAfectados('2026-08-15', '2026-09-10', HOY), ['2026-08', '2026-09'])
eq('mesesAfectados que cruza el año', mesesAfectados('2025-12-20', null, '2026-01-05'), ['2025-12', '2026-01'])
eq('mesesAfectados desde hoy → ninguno', mesesAfectados(HOY, null, HOY), [])
eq('mesesAfectados en el futuro → ninguno', mesesAfectados('2026-11-01', '2026-11-30', HOY), [])
check('empezar hoy no pide motivo', !planearCambio([abierta], { desde: HOY, motivo: '' }, HOY).requiereMotivo)

console.log('5c. planearCierre: espejo de config_cerrar')
eq('cerrar una abierta en el futuro', planearCierre(abierta, { hasta: '2026-12-31' }, HOY), { accion: 'cerrar', vigente_hasta: '2026-12-31', requiereMotivo: false, error: null, restaura: null })
eq('cerrar antes de su inicio → la anula', planearCierre(vB, { hasta: '2026-10-31' }, HOY), { accion: 'anular', vigente_hasta: null, requiereMotivo: false, error: null, restaura: null })
eq('cerrar después de su fin → nada', planearCierre(vA, { hasta: '2026-11-15' }, HOY).accion, 'nada')
eq('cerrar en el pasado sin motivo → error (mensaje de config_cerrar)', planearCierre(abierta, { hasta: '2026-10-11', motivo: '' }, '2026-10-20').error, MENSAJE_MOTIVO_CIERRE_PASADO)
eq('… el texto es el de la base', MENSAJE_MOTIVO_CIERRE_PASADO, 'Para cerrar o anular un valor en el pasado hace falta un motivo')
check('cerrar en el pasado con motivo → se cierra', planearCierre(abierta, { hasta: '2026-10-15', motivo: 'Se acordó terminarlo el 15' }, '2026-10-20').accion === 'cerrar')
eq('cerrar una anulada → error', planearCierre(vAnulada, { hasta: '2026-12-31' }, HOY).error, MENSAJE_VALOR_ANULADO)
eq('cerrar una que no existe → error', planearCierre(null, { hasta: '2026-12-31' }, HOY).error, MENSAJE_VALOR_NO_EXISTE)
eq('mensajes iguales a los de config_registrar y config_cerrar', [MENSAJE_MOTIVO_PASADO, MENSAJE_VALOR_NO_EXISTE, MENSAJE_VALOR_ANULADO], ['Para cambiar el pasado hace falta un motivo', 'No existe ese valor de configuración', 'Ese valor de configuración ya está anulado'])

console.log('5d. claveConfig: la misma expresión que la columna generada')
eq('meta general', claveConfig('config_metas', { scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null }), 'general:-:medica:-')
eq('meta de zona (uuid en minúsculas)', claveConfig('config_metas', { scope: 'zona', kam_id: KAM.toUpperCase(), tipo: 'institucional', subtipo_id: COMPRAS }), `zona:${KAM}:institucional:${COMPRAS}`)
eq('meta de ejecutiva', claveConfig('config_metas', { scope: 'ejecutiva', executive_id: EJ, tipo: 'medica' }), `ejecutiva:${EJ}:medica:-`)
eq('conteo', claveConfig('config_conteo', { subtipo_id: COMPRAS }), COMPRAS)
eq('general', claveConfig('config_general', { parametro: 'plazo_gracia_horas' }), 'plazo_gracia_horas')
eq('personas', claveConfig('config_personas', { executive_id: EJ }), EJ)

// ---------------------------------------------------------------------------------------------
// Base de datos de mentira para encadenar cambios: aplica un plan como lo haría config_registrar.
type FilaConteo = ConteoVigencia & { id: string }
let secuencia = 0
function registrarConteo(
  filas: FilaConteo[],
  valores: ConteoCampos,
  cambio: { desde: string; hasta?: string | null; motivo?: string | null },
  hoy: string
): { filas: FilaConteo[]; plan: PlanCambio } {
  const plan = planearCambio(
    filas.filter(f => f.subtipo_id === valores.subtipo_id),
    cambio,
    hoy
  )
  if (plan.error) return { filas, plan }
  const nuevas: FilaConteo[] = filas.map(fila => {
    if (plan.anular.includes(fila.id)) return { ...fila, anulado_at: `${hoy}T12:00:00Z` }
    const corte = plan.cortar.find(c => c.id === fila.id)
    return corte ? { ...fila, vigente_hasta: corte.vigente_hasta } : fila
  })
  for (const c of plan.continuar) {
    const origen = filas.find(f => f.id === c.deId) as FilaConteo
    nuevas.push({ ...origen, id: `cont-${++secuencia}`, vigente_desde: c.vigente_desde, vigente_hasta: c.vigente_hasta, anulado_at: null })
  }
  nuevas.push({ ...valores, id: `nueva-${++secuencia}`, vigente_desde: cambio.desde, vigente_hasta: plan.hastaEfectivo, anulado_at: null })
  return { filas: nuevas, plan }
}
function sinSuperposiciones(filas: FilaConteo[]): boolean {
  for (let i = 0; i < filas.length; i++) {
    for (let j = i + 1; j < filas.length; j++) {
      if (filas[i].subtipo_id === filas[j].subtipo_id && seSuperponen(filas[i], filas[j])) return false
    }
  }
  return true
}

console.log('6. Conteo: qué suma y con qué peso, según la fila vigente en la fecha de la visita')
const conteoSemilla: FilaConteo[] = [
  { id: 'c-compras', subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 1, vigente_desde: HOY, vigente_hasta: null, anulado_at: null },
  { id: 'c-prog', subtipo_id: PROGRAMACION, modo: 'suma_institucional', peso: 1, vigente_desde: HOY, vigente_hasta: null, anulado_at: null },
]
const seguimiento = registrarConteo(conteoSemilla, { subtipo_id: PROGRAMACION, modo: 'seguimiento', peso: 1 }, { desde: '2026-10-15' }, HOY)
check('Programación "solo seguimiento" desde el 15: no pide motivo (es futuro)', seguimiento.plan.error === null && !seguimiento.plan.requiereMotivo)
eq('… la del 14 suma a la institucional con peso 1', valorVisita({ conteo: seguimiento.filas, fecha: '2026-10-14', tipo: 'institucional', subtipoId: PROGRAMACION }), { meta: 'institucional', subtipoId: PROGRAMACION, peso: 1 })
eq('… la del 15 no suma (peso 0)', valorVisita({ conteo: seguimiento.filas, fecha: '2026-10-15', tipo: 'institucional', subtipoId: PROGRAMACION }), { meta: null, subtipoId: PROGRAMACION, peso: 0 })
check('… y no quedan rangos superpuestos', sinSuperposiciones(seguimiento.filas))

const medioPeso = registrarConteo(conteoSemilla, { subtipo_id: PROGRAMACION, modo: 'suma_institucional', peso: 0.5 }, { desde: '2026-10-13' }, HOY)
const dosVisitas = [1, 2].reduce(total => total + valorVisita({ conteo: medioPeso.filas, fecha: '2026-10-20', tipo: 'institucional', subtipoId: PROGRAMACION }).peso, 0)
eq('Programación con peso 0,5: dos visitas suman 1', dosVisitas, 1)

const comprasNoviembre = registrarConteo(conteoSemilla, { subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 0.5 }, { desde: '2026-11-01' }, HOY)
const pesoOctubreAntes = rangoFechas('2026-10-12', '2026-10-31').map(fecha => valorVisita({ conteo: conteoSemilla, fecha, tipo: 'institucional', subtipoId: COMPRAS }).peso)
const pesoOctubreDespues = rangoFechas('2026-10-12', '2026-10-31').map(fecha => valorVisita({ conteo: comprasNoviembre.filas, fecha, tipo: 'institucional', subtipoId: COMPRAS }).peso)
eq('Compras peso 1 hasta el 31 de octubre y 0,5 desde el 1 de noviembre: octubre no cambia', pesoOctubreDespues, pesoOctubreAntes)
eq('… el corte queda en el 31 de octubre', comprasNoviembre.plan.cortar, [{ id: 'c-compras', vigente_hasta: '2026-10-31' }])
eq('… noviembre usa 0,5', valorVisita({ conteo: comprasNoviembre.filas, fecha: '2026-11-05', tipo: 'institucional', subtipoId: COMPRAS }).peso, 0.5)
eq('… sin meses que recalcular', mesesAfectados('2026-11-01', comprasNoviembre.plan.hastaEfectivo, HOY), [])
const choque = registrarConteo(comprasNoviembre.filas, { subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 2 }, { desde: '2026-10-20', hasta: '2026-11-10' }, HOY)
eq('un rango que se superpone con el valor de noviembre se rechaza', choque.plan.error, 'El rango se superpone con un valor que empieza el 2026-11-01')
eq('… y las filas quedan iguales', choque.filas.length, comprasNoviembre.filas.length)
const temporal = registrarConteo(conteoSemilla, { subtipo_id: COMPRAS, modo: 'meta_propia', peso: 1 }, { desde: '2026-11-01', hasta: '2026-11-30' }, HOY)
eq('valor temporal: en noviembre es meta propia', valorVisita({ conteo: temporal.filas, fecha: '2026-11-15', tipo: 'institucional', subtipoId: COMPRAS }).meta, 'subtipo')
eq('… y en diciembre vuelve el valor anterior', valorVisita({ conteo: temporal.filas, fecha: '2026-12-01', tipo: 'institucional', subtipoId: COMPRAS }), { meta: 'institucional', subtipoId: COMPRAS, peso: 1 })
check('… sin superposiciones', sinSuperposiciones(temporal.filas))
eq('visita médica: meta médica, peso 1', valorVisita({ conteo: [], fecha: HOY, tipo: 'medica' }), { meta: 'medica', subtipoId: null, peso: 1 })
eq('institucional de un subtipo sin fila de conteo: no suma', valorVisita({ conteo: conteoSemilla, fecha: HOY, tipo: 'institucional', subtipoId: EJ_2 }), { meta: null, subtipoId: EJ_2, peso: 0 })
eq('institucional antes de que rija el conteo: no suma', valorVisita({ conteo: conteoSemilla, fecha: '2026-10-11', tipo: 'institucional', subtipoId: COMPRAS }).peso, 0)
eq('semilla de conteo (por código)', CONTEO_SEMILLA, { compras: 'suma_institucional', autorizaciones: 'suma_institucional', quimico_farmaceutico: 'seguimiento', programacion: 'seguimiento', otro: 'seguimiento' })

// ---------------------------------------------------------------------------------------------
console.log('7. Configuración general y por persona')
eq('parámetros generales (los 9 del contrato)', VALORES_PARAMETRO_GENERAL, ['radio_presencial_m', 'plazo_gracia_horas', 'dias_habiles_semana', 'tope_visitas_medico_dia', 'telefonicas', 'aprobacion_dias_libres', 'motivos_dia_libre', 'primer_mes_factor', 'alertas_mezcla'])
eq('sin filas → la semilla (plazo 24 horas)', generalVigente([], 'plazo_gracia_horas', HOY), 24)
eq('semilla: lunes a viernes hábiles', GENERAL_POR_DEFECTO.dias_habiles_semana, { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 0, '7': 0 })
eq('semilla: 8 motivos de día libre', GENERAL_POR_DEFECTO.motivos_dia_libre.map(m => m.codigo), ['vacaciones', 'incapacidad', 'cita_medica', 'capacitacion', 'congreso', 'acompanamiento_cirugia', 'administrativo', 'otro'])
eq('semilla de metas: médica 6 y institucional 1 al día', METAS_SEMILLA.map(m => `${m.tipo}:${m.periodo}:${m.cantidad}`), ['medica:dia:6', 'institucional:dia:1'])
const plazo48: GeneralVigencia[] = [
  { id: 'g1', parametro: 'plazo_gracia_horas', valor: 24, vigente_desde: HOY, vigente_hasta: '2026-10-19' },
  { id: 'g2', parametro: 'plazo_gracia_horas', valor: 48, vigente_desde: '2026-10-20', vigente_hasta: null },
]
eq('plazo vigente el 19 → 24', generalVigente(plazo48, 'plazo_gracia_horas', '2026-10-19'), 24)
eq('plazo vigente el 20 → 48', generalVigente(plazo48, 'plazo_gracia_horas', '2026-10-20'), 48)
eq('generalesVigentes completa con la semilla lo que no tiene fila', generalesVigentes(plazo48, '2026-10-20').radio_presencial_m, 500)
eq('nombreMotivoDiaLibre', nombreMotivoDiaLibre(GENERAL_POR_DEFECTO.motivos_dia_libre, 'cita_medica'), 'Cita médica')
eq('nombreMotivoDiaLibre de un código que ya no está → el código', nombreMotivoDiaLibre(GENERAL_POR_DEFECTO.motivos_dia_libre, 'licencia'), 'licencia')
eq('persona sin configuración: médica e institucional, sin telefónica, radio y tope generales', configPersonaVigente([], [], EJ, HOY), {
  id: null,
  perfil: ['medica', 'institucional'],
  telefonicaHabilitada: false,
  topeTelefonicasDia: 1,
  radioM: 500,
})
eq('PERFIL_POR_DEFECTO', PERFIL_POR_DEFECTO, ['medica', 'institucional'])
const configLinda: PersonaVigencia[] = [
  { id: 'p1', executive_id: EJ, perfil: ['institucional'], telefonica_habilitada: true, tope_telefonicas_dia: null, radio_m: 800, vigente_desde: HOY, vigente_hasta: null },
]
eq('persona con fila: lo suyo y el tope general donde dejó NULL', configPersonaVigente(configLinda, [], EJ, HOY), {
  id: 'p1',
  perfil: ['institucional'],
  telefonicaHabilitada: true,
  topeTelefonicasDia: 1,
  radioM: 800,
})
eq('la fila de otra persona no aplica', configPersonaVigente(configLinda, [], EJ_2, HOY).id, null)

// ---------------------------------------------------------------------------------------------
console.log('8. Metas: ejecutiva > zona > general; diaria y semanal')
const DESDE_PRUEBAS = '2026-01-01' // las metas de las pruebas rigen desde antes de octubre
const meta = (id: string, campos: Omit<MetaVigencia, 'id' | 'vigente_desde' | 'vigente_hasta'>, desde = DESDE_PRUEBAS, hasta: string | null = null): MetaVigencia => ({
  ...campos,
  id,
  vigente_desde: desde,
  vigente_hasta: hasta,
})
const metaGeneralMedica = meta('m-gen-med', { scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 6 })
const metaGeneralInst = meta('m-gen-inst', { scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: null, periodo: 'dia', cantidad: 1 })
const metaZonaMedica = meta('m-zona', { scope: 'zona', kam_id: KAM, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 6 })
const metaLindaMedica = meta('m-linda', { scope: 'ejecutiva', kam_id: null, executive_id: EJ, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 4 })
const metasBase = [metaGeneralMedica, metaGeneralInst]
const metas72 = [...metasBase, metaZonaMedica, metaLindaMedica]
eq('excepción de la persona primero', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ, kamId: KAM, tipo: 'medica' }), { cantidad: 4, periodo: 'dia', origen: 'ejecutiva', id: 'm-linda' })
eq('sin excepción → la de su zona', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ_2, kamId: KAM, tipo: 'medica' }).origen, 'zona')
eq('otra zona → la general', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ_2, kamId: KAM_2, tipo: 'medica' }).origen, 'general')
eq('sin zona → la general', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ_2, kamId: null, tipo: 'medica' }).origen, 'general')
eq('institucional sin subtipo → la general de 1', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ, kamId: KAM, tipo: 'institucional' }).cantidad, 1)
eq('subtipo sin meta propia → cantidad 0, origen null', resolverMeta({ metas: metas72, fecha: '2027-02-10', executiveId: EJ, kamId: KAM, tipo: 'institucional', subtipoId: COMPRAS }), { cantidad: 0, periodo: 'dia', origen: null, id: null })
eq('excepción vencida → vuelve la de la zona', resolverMeta({ metas: [metaZonaMedica, meta('m-temp', { ...metaLindaMedica, cantidad: 3 }, DESDE_PRUEBAS, '2027-01-31')], fecha: '2027-02-10', executiveId: EJ, kamId: KAM, tipo: 'medica' }).origen, 'zona')
eq('meta semanal 10 con lunes a viernes: 2 por día', metaDiaria({ cantidad: 10, periodo: 'semana' }, GENERAL_POR_DEFECTO.dias_habiles_semana), 2)
eq('meta semanal 11 con sábado de medio día: 11 ÷ 5,5 = 2', metaDiaria({ cantidad: 11, periodo: 'semana' }, { ...GENERAL_POR_DEFECTO.dias_habiles_semana, '6': 0.5 }), 2)
eq('meta diaria tal cual', metaDiaria({ cantidad: 6, periodo: 'dia' }, GENERAL_POR_DEFECTO.dias_habiles_semana), 6)
eq('semana sin días hábiles → 0', metaDiaria({ cantidad: 10, periodo: 'semana' }, { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 }), 0)

// ---------------------------------------------------------------------------------------------
console.log('9. Calendario: ciudad > empresa > festivo nacional > día de la semana')
const semana = GENERAL_POR_DEFECTO.dias_habiles_semana
const cal2026 = nacionales(2026)
eq('martes normal → 1', fraccionHabil({ fecha: '2026-10-13', diasHabilesSemana: semana, calendario: cal2026, municipio: MEDELLIN }), 1)
eq('sábado → 0', fraccionHabil({ fecha: '2026-10-17', diasHabilesSemana: semana, calendario: cal2026, municipio: MEDELLIN }), 0)
eq('festivo en lunes → 0, decide el festivo nacional', resolverDiaHabil({ fecha: HOY, diasHabilesSemana: semana, calendario: cal2026, municipio: MEDELLIN }), { fraccion: 0, fuente: 'nacional', nombre: 'Día de la Raza' })
const empresaSabado: DiaCalendarioEntrada = { fecha: '2026-10-17', alcance: 'empresa', municipality_id: null, tipo: 'habil', nombre: 'Jornada de inventario' }
eq('día hábil de empresa en sábado → 1', fraccionHabil({ fecha: '2026-10-17', diasHabilesSemana: semana, calendario: [...cal2026, empresaSabado], municipio: MEDELLIN }), 1)
const empresaFestivo: DiaCalendarioEntrada = { fecha: HOY, alcance: 'empresa', municipality_id: null, tipo: 'habil', nombre: 'Se trabaja el festivo' }
eq('día hábil de empresa sobre un festivo → 1 (empresa manda)', fraccionHabil({ fecha: HOY, diasHabilesSemana: semana, calendario: [...cal2026, empresaFestivo], municipio: MEDELLIN }), 1)
const ciudadNoHabil: DiaCalendarioEntrada = { fecha: HOY, alcance: 'ciudad', municipality_id: MEDELLIN, tipo: 'no_habil', nombre: 'Día cívico' }
eq('día no hábil de ciudad sobre uno hábil de empresa → 0 (ciudad manda)', fraccionHabil({ fecha: HOY, diasHabilesSemana: semana, calendario: [...cal2026, empresaFestivo, ciudadNoHabil], municipio: MEDELLIN }), 0)
eq('… para otra ciudad no aplica (queda la empresa) → 1', fraccionHabil({ fecha: HOY, diasHabilesSemana: semana, calendario: [...cal2026, empresaFestivo, ciudadNoHabil], municipio: BOGOTA }), 1)
eq('… sin municipio tampoco aplica', fraccionHabil({ fecha: HOY, diasHabilesSemana: semana, calendario: [empresaFestivo, ciudadNoHabil], municipio: null }), 1)
eq('un día anulado no cuenta', fraccionHabil({ fecha: '2026-10-17', diasHabilesSemana: semana, calendario: [{ ...empresaSabado, anulado_at: '2026-10-12T10:00:00Z' }], municipio: MEDELLIN }), 0)
eq('sábado de medio día según la semana → 0,5', fraccionHabil({ fecha: '2026-10-17', diasHabilesSemana: { ...semana, '6': 0.5 }, calendario: [], municipio: null }), 0.5)
eq('municipioDeZona: Medellín', municipioDeZona('05001'), '05001')
eq('municipioDeZona: celda de Bogotá (Chapinero) → 11001', municipioDeZona('1100102'), '11001')
eq('municipioDeZona: vacío → null', municipioDeZona(null), null)

// ---------------------------------------------------------------------------------------------
console.log('10. Días libres: fracción, plazo de gracia y estados')
const libres: DiaLibreEntrada[] = [
  { executive_id: EJ, fecha: '2026-10-13', fraccion: 1, estado: 'aprobado' },
  { executive_id: EJ, fecha: '2026-10-14', fraccion: 0.5, estado: 'registrado' },
  { executive_id: EJ, fecha: '2026-10-15', fraccion: 1, estado: 'por_aprobar' },
  { executive_id: EJ, fecha: '2026-10-16', fraccion: 1, estado: 'rechazado' },
  { executive_id: EJ, fecha: '2026-10-16', fraccion: 1, estado: 'anulado' },
]
eq('aprobado cuenta 1', fraccionLibre(libres, '2026-10-13'), 1)
eq('medio día registrado cuenta 0,5', fraccionLibre(libres, '2026-10-14'), 0.5)
eq('por aprobar no cuenta como libre', fraccionLibre(libres, '2026-10-15'), 0)
eq('… pero sale como por aprobar', fraccionPorAprobar(libres, '2026-10-15'), 1)
eq('rechazado y anulado no cuentan', fraccionLibre(libres, '2026-10-16'), 0)

// Día libre del martes 13 de octubre: termina el miércoles 14 a las 00:00 de Bogotá (05:00 UTC).
const finDelDia = new Date('2026-10-14T05:00:00Z').getTime()
const a30Horas = new Date(finDelDia + 30 * 60 * 60 * 1000)
const con24 = puedeRegistrarDiaLibre({ fecha: '2026-10-13', ahora: a30Horas, plazoHoras: 24 })
check('plazo de 24 horas: 30 horas después de terminar el día se rechaza', !con24.ok)
check('… y el error dice hasta cuándo se podía (miércoles 23:59)', (con24.error ?? '').includes('2026-10-14 a las 23:59'), con24.error)
check('plazo de 48 horas: 30 horas después se permite', puedeRegistrarDiaLibre({ fecha: '2026-10-13', ahora: a30Horas, plazoHoras: 48 }).ok)
eq('venceRegistroDiaLibre (24 h): jueves 00:00 de Bogotá', venceRegistroDiaLibre('2026-10-13', 24).toISOString(), '2026-10-15T05:00:00.000Z')
eq('textoLimiteRegistro', textoLimiteRegistro(venceRegistroDiaLibre('2026-10-13', 24)), '2026-10-14 a las 23:59')
check('el lunes festivo se registra hasta el martes 23:59 (ok a las 23:59)', puedeRegistrarDiaLibre({ fecha: HOY, ahora: new Date('2026-10-14T04:59:00Z'), plazoHoras: 24 }).ok)
check('… y no el miércoles 00:00', !puedeRegistrarDiaLibre({ fecha: HOY, ahora: new Date('2026-10-14T05:00:00Z'), plazoHoras: 24 }).ok)
check('plazo 0: el mismo día sí (hasta las 23:59)', puedeRegistrarDiaLibre({ fecha: HOY, ahora: new Date('2026-10-13T04:00:00Z'), plazoHoras: 0 }).ok)
check('registrar con anticipación (diciembre) se permite', puedeRegistrarDiaLibre({ fecha: '2026-12-24', ahora: new Date('2026-10-12T15:00:00Z'), plazoHoras: 24 }).ok)
const muyLejos = puedeRegistrarDiaLibre({ fecha: '2027-12-31', ahora: new Date('2026-10-12T15:00:00Z'), plazoHoras: 24 })
check('más de 366 días hacia adelante se rechaza', !muyLejos.ok && (muyLejos.error ?? '').includes('2027-10-13'), muyLejos.error)
check('fecha no válida se rechaza', !puedeRegistrarDiaLibre({ fecha: '2026-02-30', ahora: new Date(), plazoHoras: 24 }).ok)
eq('con aprobación nace por aprobar', estadoInicialDiaLibre(true), 'por_aprobar')
eq('sin aprobación nace registrado', estadoInicialDiaLibre(false), 'registrado')
eq('aprobar desde por aprobar', revisarDiaLibre('por_aprobar', 'aprobar'), { ok: true, estado: 'aprobado' })
eq('rechazar desde por aprobar', revisarDiaLibre('por_aprobar', 'rechazar'), { ok: true, estado: 'rechazado' })
check('aprobar un registrado → se omite con razón', !revisarDiaLibre('registrado', 'aprobar').ok)
check('rechazar un aprobado → se omite', !revisarDiaLibre('aprobado', 'rechazar').ok)
eq('anular un aprobado', revisarDiaLibre('aprobado', 'anular'), { ok: true, estado: 'anulado' })
eq('anular un registrado', revisarDiaLibre('registrado', 'anular'), { ok: true, estado: 'anulado' })
check('anular un rechazado → se omite', !revisarDiaLibre('rechazado', 'anular').ok)
check('la ejecutiva anula el suyo por aprobar aunque sea pasado', ejecutivaPuedeAnular({ estado: 'por_aprobar', fecha: '2026-10-01' }, HOY))
check('… el aprobado de hoy sí', ejecutivaPuedeAnular({ estado: 'aprobado', fecha: HOY }, HOY))
check('… el aprobado de ayer no', !ejecutivaPuedeAnular({ estado: 'aprobado', fecha: '2026-10-11' }, HOY))
check('… un rechazado no', !ejecutivaPuedeAnular({ estado: 'rechazado', fecha: '2026-10-20' }, HOY))
const aprobacion = GENERAL_POR_DEFECTO.aprobacion_dias_libres
check('aprueban: la directora y recursos humanos (semilla)', rolPuedeAprobar('commercial_director', aprobacion) && rolPuedeAprobar('hr', aprobacion))
check('admin siempre aprueba, aunque no esté en la lista', rolPuedeAprobar('admin', { requiere: true, aprueban: [] }))
check('si solo aprueba recursos humanos, la directora no', !rolPuedeAprobar('commercial_director', { requiere: true, aprueban: ['hr'] }))
check('el líder de línea no aprueba', !rolPuedeAprobar('line_leader', aprobacion))

// ---------------------------------------------------------------------------------------------
console.log('11. Cuota del periodo y ritmo')
const linda: PersonaCuota = { executiveId: EJ, kamId: KAM, municipio: MEDELLIN, startedAt: '2024-01-15', leftAt: null }
const otraDeLaZona: PersonaCuota = { ...linda, executiveId: EJ_2 }
const feb2027 = limitesMes('2027-02') // lunes 1 a domingo 28: 20 días hábiles, sin festivos
const cal = nacionales(2026, 2027)
const base = { ...feb2027, metas: metas72, personas: [] as PersonaVigencia[], general: [] as GeneralVigencia[], calendario: cal, diasLibres: [] as DiaLibreEntrada[] }
const dosLibres: DiaLibreEntrada[] = [
  { executive_id: EJ, fecha: '2027-02-03', fraccion: 1, estado: 'aprobado' },
  { executive_id: EJ, fecha: '2027-02-04', fraccion: 1, estado: 'aprobado' },
]
const c72 = cuotaPeriodo({ ...base, hoy: '2027-02-12', persona: linda, tipo: 'medica', diasLibres: dosLibres })
eq('meta de zona 6 y excepción de 4, 20 días hábiles y 2 libres aprobados: cuota 72', c72.cuota, 72)
eq('… 20 días hábiles y 2 libres', [c72.diasHabiles, c72.diasLibres], [20, 2])
eq('… al día hábil 10 (viernes 12) van 10 transcurridos', c72.diasHabilesTranscurridos, 10)
eq('… y quedan 10 días hábiles por delante (los libres ya pasaron)', c72.diasHabilesPorDelante, 10)
// Revisión 2026-10-15: los días libres que VIENEN no son días para visitar ("Te faltan …: X por día hábil").
const conLibresQueVienen = cuotaPeriodo({
  ...base,
  hoy: '2027-02-12',
  persona: linda,
  tipo: 'medica',
  diasLibres: [...dosLibres, { executive_id: EJ, fecha: '2027-02-17', fraccion: 1, estado: 'aprobado' }, { executive_id: EJ, fecha: '2027-02-19', fraccion: 0.5, estado: 'aprobado' }, { executive_id: EJ, fecha: '2027-02-22', fraccion: 1, estado: 'por_aprobar' }],
})
eq('… con un libre aprobado el 17 y medio el 19 por delante: 8,5 días por delante (el por aprobar no resta)', conLibresQueVienen.diasHabilesPorDelante, 8.5)
eq('… hábiles y transcurridos no cambian (diasHabiles sigue contando los libres)', [conLibresQueVienen.diasHabiles, conLibresQueVienen.diasHabilesTranscurridos], [20, 10])
eq('… ritmo 50 %', ritmo(c72.diasHabilesTranscurridos, c72.diasHabiles), 0.5)
eq('… meta de hoy 4, de la excepción', [c72.metaDiaHoy, c72.origenMeta, c72.aplicaPerfil], [4, 'ejecutiva', true])
eq('… resumen para la API', resumenCuotaTipo(c72), { cuota: 72, meta_dia_hoy: 4, origen: 'ejecutiva', aplica: true })
eq('… porDia trae los 28 días', c72.porDia.length, 28)
eq('… un día libre no aporta', c72.porDia.find(d => d.fecha === '2027-02-03')?.aporte, 0)
eq('otra de la zona, sin excepción ni días libres: 6 × 20 = 120 (meta de zona)', [cuotaPeriodo({ ...base, persona: otraDeLaZona, tipo: 'medica' }).cuota, cuotaPeriodo({ ...base, persona: otraDeLaZona, tipo: 'medica' }).origenMeta], [120, 'zona'])
eq('los días libres de otra persona no le restan', cuotaPeriodo({ ...base, persona: otraDeLaZona, tipo: 'medica', diasLibres: dosLibres }).cuota, 120)
eq('ritmo sin días hábiles → 0', ritmo(0, 0), 0)
eq('ritmo nunca pasa de 1', ritmo(25, 20), 1)

const civico: DiaCalendarioEntrada = { fecha: '2027-02-10', alcance: 'ciudad', municipality_id: MEDELLIN, tipo: 'no_habil', nombre: 'Día cívico de Medellín' }
const enMedellin = cuotaPeriodo({ ...base, calendario: [...cal, civico], persona: otraDeLaZona, tipo: 'medica' })
const enBogota = cuotaPeriodo({ ...base, calendario: [...cal, civico], persona: { ...otraDeLaZona, municipio: BOGOTA }, tipo: 'medica' })
eq('festivo de ciudad: a quien trabaja en Medellín le quita un día hábil', enMedellin.diasHabiles, 19)
eq('… a quien trabaja en Bogotá no', enBogota.diasHabiles, 20)
eq('… y el día dice de dónde sale', [enMedellin.porDia.find(d => d.fecha === '2027-02-10')?.fuente, enMedellin.porDia.find(d => d.fecha === '2027-02-10')?.nombreDia], ['ciudad', 'Día cívico de Medellín'])

const soloInstitucional: PersonaVigencia[] = [
  { id: 'p-inst', executive_id: EJ, perfil: ['institucional'], telefonica_habilitada: false, tope_telefonicas_dia: null, radio_m: null, vigente_desde: DESDE_PRUEBAS, vigente_hasta: null },
]
const medicaSoloInst = cuotaPeriodo({ ...base, personas: soloInstitucional, persona: linda, tipo: 'medica' })
eq('perfil solo institucional: cuota médica 0 y no aplica', [medicaSoloInst.cuota, medicaSoloInst.metaDiaHoy, medicaSoloInst.aplicaPerfil], [0, 0, false])
eq('… la institucional sí: 1 × 20 = 20', cuotaPeriodo({ ...base, personas: soloInstitucional, persona: linda, tipo: 'institucional' }).cuota, 20)
eq('… y los días hábiles siguen siendo 20 (son de su calendario)', medicaSoloInst.diasHabiles, 20)
const cambiaPerfil: PersonaVigencia[] = [{ ...soloInstitucional[0], vigente_desde: '2027-02-15' }]
const medicaCambia = cuotaPeriodo({ ...base, hoy: '2027-02-20', personas: cambiaPerfil, persona: otraDeLaZona, tipo: 'medica' })
check('… otra persona: la fila de perfil de Linda no le aplica', medicaCambia.cuota === 120)
const lindaCambia = cuotaPeriodo({ ...base, metas: metasBase, hoy: '2027-02-20', personas: cambiaPerfil, persona: linda, tipo: 'medica' })
eq('perfil que pasa a solo institucional el 15: la médica cuenta 10 días (6 × 10 = 60)', [lindaCambia.cuota, lindaCambia.aplicaPerfil], [60, false])

const semanal = [meta('m-sem', { scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'semana', cantidad: 10 })]
const cSemanal = cuotaPeriodo({ ...base, metas: semanal, persona: linda, tipo: 'medica' })
eq('meta semanal 10 con lunes a viernes: 2 por día, 40 en febrero', [cSemanal.metaDiaHoy, cSemanal.cuota], [2, 40])

const nueva: PersonaCuota = { ...linda, executiveId: EJ_2, startedAt: '2027-02-01' }
eq('primer mes al 50 %: 6 × 20 × 0,5 = 60', cuotaPeriodo({ ...base, metas: metasBase, persona: nueva, tipo: 'medica' }).cuota, 60)
eq('… y la meta de hoy también va al 50 %', cuotaPeriodo({ ...base, metas: metasBase, hoy: '2027-02-10', persona: nueva, tipo: 'medica' }).metaDiaHoy, 3)
eq('… el mes siguiente ya va completo (marzo de 2027: 20 hábiles con 3 festivos)', cuotaPeriodo({ ...limitesMes('2027-03'), metas: metasBase, personas: [], general: [], calendario: cal, diasLibres: [], persona: nueva, tipo: 'medica' }).cuota, 120)
const factor80: GeneralVigencia[] = [{ id: 'g-f', parametro: 'primer_mes_factor', valor: 0.8, vigente_desde: '2027-01-01', vigente_hasta: null }]
eq('… con el factor configurado en 0,8 desde enero: 96', cuotaPeriodo({ ...base, metas: metasBase, general: factor80, persona: nueva, tipo: 'medica' }).cuota, 96)

const medioDia: DiaLibreEntrada[] = [{ executive_id: EJ, fecha: '2027-02-05', fraccion: 0.5, estado: 'aprobado' }]
const cMedio = cuotaPeriodo({ ...base, metas: metasBase, persona: linda, tipo: 'medica', diasLibres: medioDia })
eq('medio día libre resta 0,5: 6 × 19,5 = 117', [cMedio.cuota, cMedio.diasLibres], [117, 0.5])
const porAprobar: DiaLibreEntrada[] = [{ executive_id: EJ, fecha: '2027-02-05', fraccion: 1, estado: 'por_aprobar' }]
const cPorAprobar = cuotaPeriodo({ ...base, metas: metasBase, persona: linda, tipo: 'medica', diasLibres: porAprobar })
eq('un día por aprobar no resta y sale en diasPorAprobar', [cPorAprobar.cuota, cPorAprobar.diasLibres, cPorAprobar.diasPorAprobar], [120, 0, 1])
const libreEnSabado: DiaLibreEntrada[] = [{ executive_id: EJ, fecha: '2027-02-06', fraccion: 1, estado: 'aprobado' }]
eq('un día libre en un día no hábil no cuenta', cuotaPeriodo({ ...base, metas: metasBase, persona: linda, tipo: 'medica', diasLibres: libreEnSabado }).diasLibres, 0)

const oct2026 = limitesMes('2026-10')
const baseOct = { ...oct2026, metas: metasBase, personas: [] as PersonaVigencia[], general: [] as GeneralVigencia[], calendario: cal, diasLibres: [] as DiaLibreEntrada[] }
const cOct = cuotaPeriodo({ ...baseOct, persona: linda, tipo: 'medica' })
eq('mes con festivo en lunes (octubre de 2026): 22 días de semana − 12 de octubre = 21 hábiles', cOct.diasHabiles, 21)
eq('… el 12 no aporta y lo explica el festivo', [cOct.porDia.find(d => d.fecha === HOY)?.aporte, cOct.porDia.find(d => d.fecha === HOY)?.nombreDia], [0, 'Día de la Raza'])
eq('día hábil de empresa en sábado: 22 hábiles y 6 más de cuota', [cuotaPeriodo({ ...baseOct, calendario: [...cal, empresaSabado], persona: linda, tipo: 'medica' }).diasHabiles, cuotaPeriodo({ ...baseOct, calendario: [...cal, empresaSabado], persona: linda, tipo: 'medica' }).cuota], [22, 132])
const sabadoMedio: GeneralVigencia[] = [{ id: 'g-s', parametro: 'dias_habiles_semana', valor: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 0.5, '7': 0 }, vigente_desde: '2027-02-01', vigente_hasta: null }]
eq('sábados de medio día desde febrero: 20 + 4 × 0,5 = 22 hábiles, cuota 132', [cuotaPeriodo({ ...base, metas: metasBase, general: sabadoMedio, persona: linda, tipo: 'medica' }).diasHabiles, cuotaPeriodo({ ...base, metas: metasBase, general: sabadoMedio, persona: linda, tipo: 'medica' }).cuota], [22, 132])

const entraMitad: PersonaCuota = { ...linda, executiveId: EJ_2, startedAt: '2026-10-20' }
const cEntra = cuotaPeriodo({ ...baseOct, persona: entraMitad, tipo: 'medica' })
eq('persona que entra el 20 de octubre: 9 hábiles, primer mes al 50 % → 27', [cEntra.diasHabiles, cEntra.cuota], [9, 27])
eq('… los días antes de entrar no están activos', cEntra.porDia.find(d => d.fecha === '2026-10-19')?.activo, false)
const sale: PersonaCuota = { ...linda, executiveId: EJ_2, startedAt: '2025-01-01', leftAt: '2026-10-16' }
const cSale = cuotaPeriodo({ ...baseOct, hoy: '2026-10-20', persona: sale, tipo: 'medica' })
eq('persona que sale el 16 de octubre: 11 hábiles → 66', [cSale.diasHabiles, cSale.cuota], [11, 66])
eq('… y después de salir su meta de hoy es 0', cSale.metaDiaHoy, 0)
const sinZona: PersonaCuota = { executiveId: EJ_2, kamId: null, municipio: null, startedAt: '2024-01-01', leftAt: null }
const cSinZona = cuotaPeriodo({ ...base, metas: [...metasBase, meta('m-z4', { ...metaZonaMedica, cantidad: 4 })], calendario: [...cal, civico], persona: sinZona, tipo: 'medica' })
eq('ejecutiva sin zona: meta general (6), sin días de ciudad: 120', [cSinZona.cuota, cSinZona.origenMeta, cSinZona.diasHabiles], [120, 'general', 20])
const sinMetas = cuotaPeriodo({ ...base, metas: [], persona: linda, tipo: 'medica' })
eq('sin ninguna meta: cuota 0 y origen null', [sinMetas.cuota, sinMetas.origenMeta], [0, null])
const startedNull = cuotaPeriodo({ ...base, metas: metasBase, persona: { ...linda, startedAt: null }, tipo: 'medica' })
eq('sin fecha de entrada: activa todo el periodo y sin factor de primer mes', startedNull.cuota, 120)

// Subtipo con meta propia desde el 15 de febrero (2 al día).
const metaProg = meta('m-prog', { scope: 'general', kam_id: null, executive_id: null, tipo: 'institucional', subtipo_id: PROGRAMACION, periodo: 'dia', cantidad: 2 })
const conteoProg: ConteoVigencia[] = [
  { id: 'cp1', subtipo_id: PROGRAMACION, modo: 'seguimiento', peso: 1, vigente_desde: HOY, vigente_hasta: '2027-02-14' },
  { id: 'cp2', subtipo_id: PROGRAMACION, modo: 'meta_propia', peso: 1, vigente_desde: '2027-02-15', vigente_hasta: null },
]
eq('subtipo con meta propia desde el 15: solo cuentan esos días (2 × 10 = 20)', cuotaPeriodo({ ...base, metas: [...metasBase, metaProg], conteo: conteoProg, persona: linda, tipo: 'institucional', subtipoId: PROGRAMACION }).cuota, 20)
eq('… sin pasar el conteo cuenta el mes entero (2 × 20 = 40)', cuotaPeriodo({ ...base, metas: [...metasBase, metaProg], persona: linda, tipo: 'institucional', subtipoId: PROGRAMACION }).cuota, 40)
eq('subtiposConMetaPropia en febrero → programación', subtiposConMetaPropia(conteoProg, feb2027.desde, feb2027.hasta), [PROGRAMACION])
eq('subtiposConMetaPropia en enero → ninguno', subtiposConMetaPropia(conteoProg, '2027-01-01', '2027-01-31'), [])

// ---------------------------------------------------------------------------------------------
console.log('12. Esquemas zod: parámetros generales')
const g = valorGeneralSchemas
eq('radio 50 y 5000 pasan', [g.radio_presencial_m.safeParse(50).success, g.radio_presencial_m.safeParse(5000).success], [true, true])
invalido('radio 49 → 400', g.radio_presencial_m.safeParse(49), 'entre 50 y 5000')
invalido('radio 5001 → 400', g.radio_presencial_m.safeParse(5001), 'entre 50 y 5000')
invalido('radio con decimales → 400', g.radio_presencial_m.safeParse(500.5), 'entero')
eq('radio escrito como texto "800" → 800', g.radio_presencial_m.safeParse('800').success && g.radio_presencial_m.parse('800'), 800)
eq('plazo 0 y 720 pasan', [g.plazo_gracia_horas.safeParse(0).success, g.plazo_gracia_horas.safeParse(720).success], [true, true])
invalido('plazo 721 → 400', g.plazo_gracia_horas.safeParse(721), 'entre 0 y 720')
valido('días hábiles de la semilla', g.dias_habiles_semana.safeParse(GENERAL_POR_DEFECTO.dias_habiles_semana))
eq('días hábiles con "0,5" en texto', g.dias_habiles_semana.safeParse({ ...GENERAL_POR_DEFECTO.dias_habiles_semana, '6': '0,5' }).success && g.dias_habiles_semana.parse({ ...GENERAL_POR_DEFECTO.dias_habiles_semana, '6': '0,5' })['6'], 0.5)
invalido('días hábiles con 0,3 → 400', g.dias_habiles_semana.safeParse({ ...GENERAL_POR_DEFECTO.dias_habiles_semana, '1': 0.3 }), '0, 0,5 o 1')
invalido('días hábiles sin el domingo → 400', g.dias_habiles_semana.safeParse({ '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 0 }), 'lunes a domingo')
invalido('días hábiles con una clave "8" → 400', g.dias_habiles_semana.safeParse({ ...GENERAL_POR_DEFECTO.dias_habiles_semana, '8': 1 }), '"1" (lunes) a "7" (domingo)')
invalido('días hábiles todos en 0 → 400', g.dias_habiles_semana.safeParse({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0 }), 'Al menos un día')
eq('tope por médico 1 y 10 pasan', [g.tope_visitas_medico_dia.safeParse(1).success, g.tope_visitas_medico_dia.safeParse(10).success], [true, true])
invalido('tope por médico 0 → 400', g.tope_visitas_medico_dia.safeParse(0), 'entre 1 y 10')
invalido('tope por médico 11 → 400', g.tope_visitas_medico_dia.safeParse(11), 'entre 1 y 10')
valido('telefónicas de la semilla', g.telefonicas.safeParse(GENERAL_POR_DEFECTO.telefonicas))
eq('telefónicas: medios repetidos se dejan una vez', g.telefonicas.parse({ tope_dia: 2, peso: 0.5, medios: ['llamada', 'llamada'] }), { tope_dia: 2, peso: 0.5, medios: ['llamada'] })
invalido('telefónicas sin medios → 400', g.telefonicas.safeParse({ tope_dia: 1, peso: 1, medios: [] }), 'al menos un medio')
invalido('telefónicas con fax → 400', g.telefonicas.safeParse({ tope_dia: 1, peso: 1, medios: ['fax'] }), 'Medio no válido')
invalido('telefónicas con peso 0 → 400', g.telefonicas.safeParse({ tope_dia: 1, peso: 0, medios: ['llamada'] }), 'mayor que 0')
invalido('telefónicas con peso 10,5 → 400', g.telefonicas.safeParse({ tope_dia: 1, peso: 10.5, medios: ['llamada'] }), 'hasta 10')
invalido('telefónicas con tope 21 → 400', g.telefonicas.safeParse({ tope_dia: 21, peso: 1, medios: ['llamada'] }), 'entre 0 y 20')
valido('aprobación de la semilla', g.aprobacion_dias_libres.safeParse(GENERAL_POR_DEFECTO.aprobacion_dias_libres))
valido('aprobación sin aprobadores (solo admin)', g.aprobacion_dias_libres.safeParse({ requiere: true, aprueban: [] }))
invalido('aprobación por admin en la lista → 400 (admin siempre puede)', g.aprobacion_dias_libres.safeParse({ requiere: true, aprueban: ['admin'] }), 'admin siempre puede')
invalido('aprobación sin "requiere" → 400', g.aprobacion_dias_libres.safeParse({ aprueban: ['hr'] }), 'requieren aprobación')
valido('motivos de la semilla', g.motivos_dia_libre.safeParse(GENERAL_POR_DEFECTO.motivos_dia_libre))
invalido('motivos con código repetido → 400', g.motivos_dia_libre.safeParse([{ codigo: 'otro', nombre: 'Otro' }, { codigo: 'otro', nombre: 'Otra cosa' }]), 'repetidos')
invalido('motivos vacíos → 400', g.motivos_dia_libre.safeParse([]), 'al menos un motivo')
invalido('31 motivos → 400', g.motivos_dia_libre.safeParse(Array.from({ length: 31 }, (_, i) => ({ codigo: `m_${'a'.repeat(i + 1)}`, nombre: `Motivo ${i}` }))), 'Como máximo 30')
invalido('motivo con mayúsculas en el código → 400', g.motivos_dia_libre.safeParse([{ codigo: 'Vacaciones', nombre: 'Vacaciones' }]), 'minúsculas')
invalido('motivo con nombre de 1 letra → 400', g.motivos_dia_libre.safeParse([{ codigo: 'x_y', nombre: 'X' }]), 'al menos 2 letras')
eq('factor del primer mes 0 y 1 pasan', [g.primer_mes_factor.safeParse(0).success, g.primer_mes_factor.safeParse(1).success], [true, true])
invalido('factor 1,2 → 400', g.primer_mes_factor.safeParse(1.2), 'entre 0 y 1')
valido('alertas de mezcla vacías', g.alertas_mezcla.safeParse({}))
invalido('alertas de mezcla con texto → 400', g.alertas_mezcla.safeParse({ medica: 'mucho' }), 'umbral')

console.log('12b. Esquemas zod: cambios de configuración')
const cambioMeta = valido(
  'meta de zona válida (cantidad redondeada a 2 decimales)',
  cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'zona', kam_id: KAM.toUpperCase(), tipo: 'medica', periodo: 'dia', cantidad: '5,555' }, desde: '2026-11-01', hasta: '', motivo: '  ' })
)
eq('… valores limpios y hasta/motivo vacíos → null', cambioMeta, {
  tabla: 'config_metas',
  valores: { scope: 'zona', kam_id: KAM, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad: 5.56 },
  desde: '2026-11-01',
  hasta: null,
  motivo: null,
})
eq('meta 0 y 100 pasan', [0, 100].map(c => cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', tipo: 'medica', periodo: 'dia', cantidad: c }, desde: HOY }).success), [true, true])
invalido('meta 100,01 → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', tipo: 'medica', periodo: 'dia', cantidad: 100.01 }, desde: HOY }), 'entre 0 y 100')
invalido('meta −1 → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', tipo: 'medica', periodo: 'dia', cantidad: -1 }, desde: HOY }), 'entre 0 y 100')
invalido('meta general con zona → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', kam_id: KAM, tipo: 'medica', periodo: 'dia', cantidad: 6 }, desde: HOY }), 'no lleva zona')
invalido('meta de zona sin zona → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'zona', tipo: 'medica', periodo: 'dia', cantidad: 6 }, desde: HOY }), 'Elige la zona')
invalido('meta de ejecutiva con zona → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'ejecutiva', executive_id: EJ, kam_id: KAM, tipo: 'medica', periodo: 'dia', cantidad: 4 }, desde: HOY }), 'no lleva zona')
invalido('meta médica con subtipo → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', tipo: 'medica', subtipo_id: COMPRAS, periodo: 'dia', cantidad: 1 }, desde: HOY }), 'Solo las metas institucionales')
invalido('meta con periodo "mes" → 400', cambioConfigSchema.safeParse({ tabla: 'config_metas', valores: { scope: 'general', tipo: 'medica', periodo: 'mes', cantidad: 1 }, desde: HOY }), 'Periodo no válido')
eq('conteo sin peso → peso 1', cambioConfigSchema.parse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'seguimiento' }, desde: HOY }).valores, { subtipo_id: COMPRAS, modo: 'seguimiento', peso: 1 })
invalido('conteo con peso 0 → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 0 }, desde: HOY }), 'mayor que 0')
invalido('conteo con peso 0,001 (se redondea a 0) → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 0.001 }, desde: HOY }), 'mayor que 0')
invalido('conteo con peso 11 → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 11 }, desde: HOY }), 'hasta 10')
invalido('conteo con modo "duplica" → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'duplica', peso: 1 }, desde: HOY }), 'Modo no válido')
eq('general: plazo 48 válido', cambioConfigSchema.parse({ tabla: 'config_general', valores: { parametro: 'plazo_gracia_horas', valor: 48 }, desde: HOY }).valores, { parametro: 'plazo_gracia_horas', valor: 48 })
const generalMal = cambioConfigSchema.safeParse({ tabla: 'config_general', valores: { parametro: 'plazo_gracia_horas', valor: 1000 }, desde: HOY })
invalido('general: plazo 1000 → 400 con el mensaje del parámetro', generalMal, 'entre 0 y 720')
eq('… en la ruta valores.valor', generalMal.success ? null : generalMal.error.issues[0].path, ['valores', 'valor'])
invalido('general: parámetro desconocido → 400', cambioConfigSchema.safeParse({ tabla: 'config_general', valores: { parametro: 'color', valor: 1 }, desde: HOY }), 'Parámetro general no válido')
invalido('general: sin valor → 400', cambioConfigSchema.safeParse({ tabla: 'config_general', valores: { parametro: 'radio_presencial_m' }, desde: HOY }), 'entre 50 y 5000')
eq('personas: perfil ordenado y sin repetidos, NULL donde no viene', cambioConfigSchema.parse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: ['institucional', 'medica', 'medica'] }, desde: HOY }).valores, {
  executive_id: EJ,
  perfil: ['medica', 'institucional'],
  telefonica_habilitada: false,
  tope_telefonicas_dia: null,
  radio_m: null,
})
invalido('personas: perfil vacío → 400', cambioConfigSchema.safeParse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: [] }, desde: HOY }), 'al menos un perfil')
invalido('personas: perfil "gerente" → 400', cambioConfigSchema.safeParse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: ['gerente'] }, desde: HOY }), 'Perfil no válido')
invalido('personas: tope 21 → 400', cambioConfigSchema.safeParse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: ['medica'], tope_telefonicas_dia: 21 }, desde: HOY }), 'entre 0 y 20')
invalido('personas: radio 49 → 400', cambioConfigSchema.safeParse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: ['medica'], radio_m: 49 }, desde: HOY }), 'entre 50 y 5000')
eq('personas: radio "" → null', cambioConfigSchema.parse({ tabla: 'config_personas', valores: { executive_id: EJ, perfil: ['medica'], radio_m: '' }, desde: HOY }).valores, { executive_id: EJ, perfil: ['medica'], telefonica_habilitada: false, tope_telefonicas_dia: null, radio_m: null })
invalido('tabla desconocida → 400 en español', cambioConfigSchema.safeParse({ tabla: 'users', valores: {}, desde: HOY }), 'Elige qué se configura')
invalido('cuerpo que no es objeto → 400', cambioConfigSchema.safeParse('hola'), 'objeto JSON')
invalido('"hasta" antes de "desde" → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'seguimiento' }, desde: '2026-11-10', hasta: '2026-11-01' }), 'no puede ser anterior')
invalido('"desde" que no existe → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', valores: { subtipo_id: COMPRAS, modo: 'seguimiento' }, desde: '2026-02-30' }), 'Fecha no válida')
invalido('sin valores → 400', cambioConfigSchema.safeParse({ tabla: 'config_conteo', desde: HOY }), 'Faltan los valores')
eq('cerrar: válido', cerrarConfigSchema.parse({ tabla: 'config_metas', id: EJ, hasta: '2026-12-31' }), { tabla: 'config_metas', id: EJ, hasta: '2026-12-31', motivo: null })
invalido('cerrar: tabla desconocida → 400', cerrarConfigSchema.safeParse({ tabla: 'x', id: EJ, hasta: HOY }), 'Elige qué se configura')

console.log('12c. Esquemas zod: subtipos, calendario, días libres y consultas')
eq('subtipo: código en minúsculas, cargos sin repetir', subtipoCreateSchema.parse({ codigo: ' Esterilizacion ', nombre: 'Esterilización', para_que: 'Que validen el instrumental', roles_sugeridos: ['esterilizacion', 'esterilizacion'], orden: 6, vigente_desde: HOY }), {
  codigo: 'esterilizacion',
  nombre: 'Esterilización',
  para_que: 'Que validen el instrumental',
  roles_sugeridos: ['esterilizacion'],
  orden: 6,
  vigente_desde: HOY,
})
invalido('subtipo: código con tilde → 400', subtipoCreateSchema.safeParse({ codigo: 'programación', nombre: 'P', para_que: 'Algo útil', orden: 1, vigente_desde: HOY }), 'minúsculas sin tildes')
invalido('subtipo: cargo que no existe → 400', subtipoCreateSchema.safeParse({ codigo: 'nuevo', nombre: 'Nuevo', para_que: 'Algo útil', roles_sugeridos: ['jefe'], orden: 1, vigente_desde: HOY }), 'Cargo sugerido no válido')
invalido('subtipo: orden 1001 → 400', subtipoCreateSchema.safeParse({ codigo: 'nuevo', nombre: 'Nuevo', para_que: 'Algo útil', orden: 1001, vigente_desde: HOY }), 'entre 0 y 1000')
eq('subtipo: apagar con vigente_hasta', subtipoUpdateSchema.parse({ vigente_hasta: '2026-12-31' }), { vigente_hasta: '2026-12-31' })
invalido('subtipo: PATCH vacío → 400', subtipoUpdateSchema.safeParse({}), 'No hay campos')
eq('día de ciudad válido', calendarioDiaCreateSchema.parse({ fecha: '2026-11-20', alcance: 'ciudad', municipality_id: MEDELLIN, tipo: 'no_habil', nombre: ' Día  cívico ' }), { fecha: '2026-11-20', alcance: 'ciudad', municipality_id: MEDELLIN, tipo: 'no_habil', nombre: 'Día cívico' })
invalido('día de ciudad sin ciudad → 400', calendarioDiaCreateSchema.safeParse({ fecha: '2026-11-20', alcance: 'ciudad', tipo: 'no_habil', nombre: 'Día cívico' }), 'Elige la ciudad')
invalido('día de empresa con ciudad → 400', calendarioDiaCreateSchema.safeParse({ fecha: '2026-12-24', alcance: 'empresa', municipality_id: MEDELLIN, tipo: 'no_habil', nombre: 'Nochebuena' }), 'no lleva ciudad')
invalido('alcance nacional a mano → 400', calendarioDiaCreateSchema.safeParse({ fecha: '2026-12-24', alcance: 'nacional', tipo: 'no_habil', nombre: 'Nochebuena' }), 'Alcance no válido')
invalido('municipio de 4 dígitos → 400', calendarioDiaCreateSchema.safeParse({ fecha: '2026-11-20', alcance: 'ciudad', municipality_id: '5001', tipo: 'no_habil', nombre: 'Día cívico' }), 'código DANE')
eq('anular: motivo de 5 y de 300 pasan', [anularSchema.safeParse({ motivo: 'abcde' }).success, anularSchema.safeParse({ motivo: 'a'.repeat(300) }).success], [true, true])
invalido('anular: motivo de 4 → 400', anularSchema.safeParse({ motivo: ' abcd ' }), 'al menos 5')
invalido('anular: motivo de 301 → 400', anularSchema.safeParse({ motivo: 'a'.repeat(301) }), 'no puede superar 300')
eq('festivos: año 2020 y 2100 pasan, "2027" en texto también', [2020, 2100, '2027'].map(anio => cargarFestivosSchema.safeParse({ anio }).success), [true, true, true])
invalido('festivos: 2019 → 400', cargarFestivosSchema.safeParse({ anio: 2019 }), 'entre 2020 y 2100')
invalido('festivos: 2101 → 400', cargarFestivosSchema.safeParse({ anio: 2101 }), 'entre 2020 y 2100')
eq('día libre: medio día escrito "0,5"', diaLibreCreateSchema.parse({ fecha: '2026-10-20', fraccion: '0,5', motivo: 'cita_medica' }), { fecha: '2026-10-20', fraccion: 0.5, motivo: 'cita_medica', nota: null })
invalido('día libre: 0,25 → 400', diaLibreCreateSchema.safeParse({ fecha: '2026-10-20', fraccion: 0.25, motivo: 'otro' }), 'medio día')
invalido('día libre: sin motivo → 400', diaLibreCreateSchema.safeParse({ fecha: '2026-10-20', fraccion: 1 }), 'Elige el motivo')
invalido('día libre: nota de 501 → 400', diaLibreCreateSchema.safeParse({ fecha: '2026-10-20', fraccion: 1, motivo: 'otro', nota: 'n'.repeat(501) }), 'no puede superar 500')
valido('por otra persona: con justificación', diaLibrePorOtraSchema.safeParse({ executive_id: EJ, fecha: '2026-10-05', fraccion: 1, motivo: 'incapacidad', justificacion: 'La incapacidad llegó tarde' }))
invalido('por otra persona: sin ejecutiva → 400', diaLibrePorOtraSchema.safeParse({ fecha: '2026-10-05', fraccion: 1, motivo: 'incapacidad' }), 'Elige el Ejecutivo Comercial')
invalido('por otra persona: justificación de 3 → 400', diaLibrePorOtraSchema.safeParse({ executive_id: EJ, fecha: '2026-10-05', fraccion: 1, motivo: 'incapacidad', justificacion: 'ok!' }), 'al menos 5')
eq('revisar: aprobar sin motivo', revisarDiasLibresSchema.parse({ ids: [EJ, EJ_2], accion: 'aprobar' }), { ids: [EJ, EJ_2], accion: 'aprobar', motivo: null })
invalido('revisar: rechazar sin motivo → 400', revisarDiasLibresSchema.safeParse({ ids: [EJ], accion: 'rechazar' }), 'Escribe el motivo')
invalido('revisar: anular con motivo corto → 400', revisarDiasLibresSchema.safeParse({ ids: [EJ], accion: 'anular', motivo: 'no' }), 'Escribe el motivo')
invalido('revisar: sin ids → 400', revisarDiasLibresSchema.safeParse({ ids: [], accion: 'aprobar' }), 'Selecciona al menos')
invalido('revisar: 201 ids → 400', revisarDiasLibresSchema.safeParse({ ids: Array.from({ length: 201 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`), accion: 'aprobar' }), 'Como máximo 200')
invalido('revisar: ids repetidos → 400', revisarDiasLibresSchema.safeParse({ ids: [EJ, EJ.toUpperCase()], accion: 'aprobar' }), 'repetidos')
invalido('revisar: acción "borrar" → 400', revisarDiasLibresSchema.safeParse({ ids: [EJ], accion: 'borrar' }), 'Acción no válida')
eq('mes válido', mesSchema.safeParse('2026-10').success, true)
invalido('mes 13 → 400', mesSchema.safeParse('2026-13'), 'Mes no válido')
invalido('mes sin cero → 400', mesSchema.safeParse('2026-1'), 'Mes no válido')
valido('consulta de calendario de 400 días', consultaCalendarioSchema.safeParse({ desde: '2026-01-01', hasta: sumarDias('2026-01-01', 399) }))
invalido('consulta de calendario de 401 días → 400', consultaCalendarioSchema.safeParse({ desde: '2026-01-01', hasta: sumarDias('2026-01-01', 400) }), 'como máximo 400')
invalido('consulta de calendario al revés → 400', consultaCalendarioSchema.safeParse({ desde: '2026-02-01', hasta: '2026-01-01' }), 'no puede ser anterior a la inicial')
invalido('consulta de días libres con estado raro → 400', consultaDiasLibresSchema.safeParse({ estado: 'pendiente' }), 'Estado no válido')
eq('consulta de días libres vacía → todo null', consultaDiasLibresSchema.parse({}), { desde: null, hasta: null, estado: null, executive_id: null })

// ---------------------------------------------------------------------------------------------
console.log('12d. Cancelar o acortar un valor devuelve el que había antes (decisión 12; espejo de config_cerrar)')
// Base de mentira de UNA clave, como la dejan config_registrar (guarda anterior_id / anterior_hasta) y config_cerrar
// (planearCierre con las filas de la clave: anula o cierra y vuelve a regir el anterior).
type FilaSim<T> = Vigencia & { id: string; anulado_motivo?: string | null } & T
function claveSimulada<T extends object>(semilla: FilaSim<T>[]) {
  let filas: FilaSim<T>[] = semilla.map(f => ({ ...f }))
  let n = 0
  const registrar = (valores: T, cambio: { desde: string; hasta?: string | null; motivo?: string | null }, hoy: string) => {
    const plan = planearCambio(filas, cambio, hoy)
    if (plan.error) return { plan, id: null as string | null }
    const rige = filas.find(f => !f.anulado_at && f.vigente_desde <= cambio.desde && (f.vigente_hasta === null || f.vigente_hasta >= cambio.desde))
    const antes = filas
    filas = filas.map(f => {
      if (plan.anular.includes(f.id)) return { ...f, anulado_at: `${hoy}T12:00:00Z`, anulado_motivo: 'Reemplazado por un valor nuevo con la misma fecha de inicio' }
      const corte = plan.cortar.find(c => c.id === f.id)
      return corte ? { ...f, vigente_hasta: corte.vigente_hasta } : f
    })
    for (const c of plan.continuar) {
      const origen = antes.find(f => f.id === c.deId) as FilaSim<T>
      filas.push({ ...origen, id: `cont-${++n}`, vigente_desde: c.vigente_desde, vigente_hasta: c.vigente_hasta, anulado_at: null, anterior_id: null, anterior_hasta: null })
    }
    const id = `fila-${++n}`
    filas.push({ ...valores, id, vigente_desde: cambio.desde, vigente_hasta: plan.hastaEfectivo, anulado_at: null, anterior_id: rige?.id ?? null, anterior_hasta: rige ? rige.vigente_hasta : null } as FilaSim<T>)
    return { plan, id }
  }
  const cerrar = (id: string, cierre: { hasta: string; motivo?: string | null }, hoy: string) => {
    const fila = filas.find(f => f.id === id)
    const plan = planearCierre(fila, cierre, hoy, filas)
    if (plan.error || plan.accion === 'nada' || !fila) return plan
    filas = filas.map(f => (f.id !== id ? f : plan.accion === 'anular' ? { ...f, anulado_at: `${hoy}T12:00:00Z` } : { ...f, vigente_hasta: cierre.hasta }))
    const r = plan.restaura
    if (r?.accion === 'extender') filas = filas.map(f => (f.id === r.deId ? { ...f, vigente_hasta: r.hasta } : f))
    if (r?.accion === 'copiar') {
      const origen = filas.find(f => f.id === r.deId) as FilaSim<T>
      filas.push({ ...origen, id: `vuelve-${++n}`, vigente_desde: r.desde, vigente_hasta: r.hasta, anulado_at: null, anulado_motivo: null, anterior_id: null, anterior_hasta: null })
    }
    return plan
  }
  const sinHuecosNiChoques = () => {
    const activas = filas.filter(f => !f.anulado_at)
    return activas.every((a, i) => activas.every((b, j) => i === j || !seSuperponen(a, b)))
  }
  return { registrar, cerrar, sinHuecosNiChoques, get filas() { return filas } }
}
type CamposMeta = Omit<MetaVigencia, 'id' | 'vigente_desde' | 'vigente_hasta'>
const medicaGeneral = (cantidad: number): CamposMeta => ({ scope: 'general', kam_id: null, executive_id: null, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad })
const metaHoy = (filas: readonly MetaVigencia[], fecha: string, executiveId = EJ) =>
  resolverMeta({ metas: filas, fecha, executiveId, kamId: KAM, tipo: 'medica', subtipoId: null })

// El caso del hallazgo: rige 6 [12-10, abierta]; se programa 8 desde el 1 de noviembre y luego se cancela.
const metaGen = claveSimulada<CamposMeta>([{ id: 'm6', ...medicaGeneral(6), vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
const programada = metaGen.registrar(medicaGeneral(8), { desde: '2026-11-01' }, HOY)
eq('programar 8 desde noviembre corta el 6 al 31 de octubre y guarda cuál cortó', [metaGen.filas.find(f => f.id === 'm6')?.vigente_hasta, metaGen.filas.find(f => f.id === programada.id)?.anterior_id, metaGen.filas.find(f => f.id === programada.id)?.anterior_hasta], ['2026-10-31', 'm6', null])
const cancelada = metaGen.cerrar(programada.id as string, { hasta: HOY }, HOY)
eq('cancelarlo (hasta = hoy) lo anula y vuelve a regir el 6: se alarga desde el 1 de noviembre, sin fin', [cancelada.accion, cancelada.restaura], ['anular', { deId: 'm6', accion: 'extender', desde: '2026-11-01', hasta: null }])
eq('… resolverMeta del 3 de noviembre: 6 de toda la empresa (antes: 0, sin meta)', [metaHoy(metaGen.filas, '2026-11-03').cantidad, metaHoy(metaGen.filas, '2026-11-03').origen], [6, 'general'])
eq('… la cuota médica de noviembre no queda en 0 (6 × 19 días hábiles = 114)', cuotaPeriodo({ ...limitesMes('2026-11'), persona: { executiveId: EJ_2, kamId: KAM_2, municipio: MEDELLIN, startedAt: null, leftAt: null }, tipo: 'medica', metas: metaGen.filas, personas: [], general: [], calendario: nacionales(2026, 2026), diasLibres: [] }).cuota, 114)
check('… sin rangos superpuestos', metaGen.sinHuecosNiChoques())

// Acortar un valor temporal que ya tiene su continuación: el tramo que deja vuelve al valor anterior (copia).
const metaTemp = claveSimulada<CamposMeta>([{ id: 'a6', ...medicaGeneral(6), vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
const temporal8 = metaTemp.registrar(medicaGeneral(8), { desde: '2026-11-01', hasta: '2026-11-30' }, HOY)
const acortado = metaTemp.cerrar(temporal8.id as string, { hasta: '2026-11-15' }, HOY)
eq('acortar el 8 temporal (1 al 30 de nov) al 15: del 16 al 30 vuelve el 6 (copia hasta el fin que tenía el 8)', [acortado.accion, acortado.restaura], ['cerrar', { deId: 'a6', accion: 'copiar', desde: '2026-11-16', hasta: '2026-11-30' }])
eq('… el 10 de nov rige 8; el 20, 6; el 5 de dic, 6 (la continuación)', ['2026-11-10', '2026-11-20', '2026-12-05'].map(f => metaHoy(metaTemp.filas, f).cantidad), [8, 6, 6])
check('… sin huecos ni rangos superpuestos', metaTemp.sinHuecosNiChoques() && rangoFechas('2026-10-12', '2027-01-31').every(f => metaHoy(metaTemp.filas, f).origen === 'general'))

// Un valor registrado en un hueco (no cortó nada) no revive al que terminaba antes por su cuenta.
const excepcion = (cantidad: number): CamposMeta => ({ scope: 'ejecutiva', kam_id: null, executive_id: EJ, tipo: 'medica', subtipo_id: null, periodo: 'dia', cantidad })
const lindaTemp = claveSimulada<CamposMeta>([])
lindaTemp.registrar(excepcion(4), { desde: '2026-11-01', hasta: '2026-11-15' }, HOY)
const lindaDespues = lindaTemp.registrar(excepcion(3), { desde: '2026-11-16' }, HOY)
const lindaCancela = lindaTemp.cerrar(lindaDespues.id as string, { hasta: HOY }, HOY)
eq('excepción temporal de 4 (1 al 15 de nov) y otra de 3 desde el 16: cancelar la de 3 no alarga la de 4', [lindaCancela.accion, lindaCancela.restaura, lindaTemp.filas.find(f => f.cantidad === 4)?.vigente_hasta], ['anular', null, '2026-11-15'])
eq('… el 20 de noviembre rige la general (6), no el 4', [metaHoy([...lindaTemp.filas, metaGeneralMedica], '2026-11-20').cantidad, metaHoy([...lindaTemp.filas, metaGeneralMedica], '2026-11-20').origen], [6, 'general'])

// El que reemplazó a otro el mismo día: al cancelarlo vuelven los valores del reemplazado (copia).
const mismoDia = claveSimulada<CamposMeta>([{ id: 'b6', ...medicaGeneral(6), vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
const siete = mismoDia.registrar(medicaGeneral(7), { desde: '2026-11-01' }, HOY)
const nueve = mismoDia.registrar(medicaGeneral(9), { desde: '2026-11-01' }, HOY)
const cancelaNueve = mismoDia.cerrar(nueve.id as string, { hasta: HOY }, HOY)
eq('7 desde nov reemplazado el mismo día por 9; cancelar el 9 → vuelve el 7 (copia desde el 1 de nov)', [cancelaNueve.restaura?.deId === siete.id, cancelaNueve.restaura?.accion, metaHoy(mismoDia.filas, '2026-11-05').cantidad], [true, 'copiar', 7])

// En cadena: 6 abierto, 7 desde nov, 9 desde dic; se cancela el 7 y luego el 9 → vuelve el 6 sin fin.
const cadena = claveSimulada<CamposMeta>([{ id: 'c6', ...medicaGeneral(6), vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
const c7 = cadena.registrar(medicaGeneral(7), { desde: '2026-11-01' }, HOY)
const c9 = cadena.registrar(medicaGeneral(9), { desde: '2026-12-01' }, HOY)
cadena.cerrar(c7.id as string, { hasta: HOY }, HOY)
eq('cancelar el 7: el 6 se alarga hasta el 30 de nov (luego rige el 9)', cadena.filas.find(f => f.id === 'c6')?.vigente_hasta, '2026-11-30')
const cancela9 = cadena.cerrar(c9.id as string, { hasta: HOY }, HOY)
eq('cancelar después el 9: vuelve el 6 sin fin', [cancela9.restaura, metaHoy(cadena.filas, '2027-01-10').cantidad], [{ deId: 'c6', accion: 'extender', desde: '2026-12-01', hasta: null }, 6])

// El anterior era temporal: vuelve solo hasta donde regía antes (anterior_hasta); después, nada.
const corto = claveSimulada<CamposMeta>([{ id: 'z5', ...excepcion(5), vigente_desde: HOY, vigente_hasta: '2026-11-15', anulado_at: null }])
const tapa = corto.registrar(excepcion(2), { desde: '2026-11-01' }, HOY)
const quitaTapa = corto.cerrar(tapa.id as string, { hasta: HOY }, HOY)
eq('excepción de 5 hasta el 15 de nov tapada por 2 desde el 1 (abierta): al cancelar, el 5 vuelve solo hasta el 15', [quitaTapa.restaura, corto.filas.find(f => f.id === 'z5')?.vigente_hasta], [{ deId: 'z5', accion: 'extender', desde: '2026-11-01', hasta: '2026-11-15' }, '2026-11-15'])

// Qué cuenta (Compras) y General: lo mismo con conteo y parámetros.
const compras = claveSimulada<ConteoCampos>([{ id: 'cc', subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 1, vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
const comprasMedio = compras.registrar({ subtipo_id: COMPRAS, modo: 'suma_institucional', peso: 0.5 }, { desde: '2026-11-01' }, HOY)
compras.cerrar(comprasMedio.id as string, { hasta: HOY }, HOY)
eq('Compras peso 0,5 programado y cancelado: desde el 1 de nov sigue sumando a la institucional con peso 1 (antes: no sumaba)', valorVisita({ conteo: compras.filas, fecha: '2026-11-05', tipo: 'institucional', subtipoId: COMPRAS }), { meta: 'institucional', subtipoId: COMPRAS, peso: 1 })
type CamposGeneral = { parametro: GeneralVigencia['parametro']; valor: unknown }
const radio = claveSimulada<CamposGeneral>([{ id: 'r500', parametro: 'radio_presencial_m', valor: 500, vigente_desde: HOY, vigente_hasta: null, anulado_at: null }])
radio.registrar({ parametro: 'radio_presencial_m', valor: 300 }, { desde: '2026-10-20' }, HOY)
const radio400 = radio.registrar({ parametro: 'radio_presencial_m', valor: 400 }, { desde: '2026-11-01' }, HOY)
radio.cerrar(radio400.id as string, { hasta: HOY }, HOY)
eq('radio 300 desde el 20 de oct; 400 programado y cancelado → el 5 de nov rige 300 (no el 500 por defecto)', generalVigente(radio.filas as GeneralVigencia[], 'radio_presencial_m', '2026-11-05'), 300)
eq('planearCierre sin las filas de la clave: no calcula qué vuelve', planearCierre({ id: 'x1', vigente_desde: '2026-11-01', vigente_hasta: null, anterior_id: 'y', anterior_hasta: null }, { hasta: HOY }, HOY).restaura, null)
eq('MOTIVO_VUELVE_ANTERIOR', MOTIVO_VUELVE_ANTERIOR, 'Vuelve a regir el valor anterior')

// ---------------------------------------------------------------------------------------------
console.log('12e. Cuota de otros meses: "aplica" con el perfil de ese mes, no con el de hoy')
const soloInstDesde = (desde: string): PersonaVigencia[] => [
  { id: 'p-inst-2', executive_id: EJ, perfil: ['institucional'], telefonica_habilitada: false, tope_telefonicas_dia: null, radio_m: null, vigente_desde: desde, vigente_hasta: null },
]
const febBase = { ...limitesMes('2027-02'), metas: metasBase, general: [] as GeneralVigencia[], calendario: nacionales(2026, 2027), diasLibres: [] as DiaLibreEntrada[], persona: linda, tipo: 'medica' as const }
const mitad = cuotaPeriodo({ ...febBase, hoy: '2027-02-20', personas: soloInstDesde('2027-02-15') })
eq('perfil solo institucional desde el 15, hoy el 20: cuota 60, hoy no aplica, pero en el mes sí → la tarjeta la muestra', [mitad.cuota, mitad.aplicaPerfil, mitad.aplicaEnPeriodo, resumenCuotaTipo(mitad).aplica], [60, false, true, true])
const mesPasado = cuotaPeriodo({ ...febBase, hoy: '2027-03-10', personas: soloInstDesde('2027-03-01') })
eq('febrero visto en marzo, cuando ya perdió la médica: cuota 120 y aplica (antes la tarjeta la escondía)', [mesPasado.cuota, mesPasado.aplicaPerfil, resumenCuotaTipo(mesPasado).aplica], [120, false, true])
const mesFuturo = cuotaPeriodo({ ...limitesMes('2027-03'), metas: metasBase, general: [], calendario: nacionales(2026, 2027), diasLibres: [], persona: linda, tipo: 'medica', hoy: '2027-02-20', personas: soloInstDesde('2027-03-01') })
eq('marzo visto en febrero, con el cambio de perfil programado: cuota 0 y no aplica (aunque hoy sí)', [mesFuturo.cuota, mesFuturo.aplicaPerfil, resumenCuotaTipo(mesFuturo).aplica], [0, true, false])

// ---------------------------------------------------------------------------------------------
console.log('12f. Días libres: "Mis días libres" cubre todo lo registrable; revisión en lotes; pestañas de /calendario')
eq('se registra hasta 366 días adelante', DIAS_ADELANTE_DIA_LIBRE, 366)
const ahoraLunes = new Date('2026-10-12T15:00:00Z')
check('… el día 366 sí, el 367 no', puedeRegistrarDiaLibre({ fecha: sumarDias(HOY, 366), ahora: ahoraLunes, plazoHoras: 24 }).ok && !puedeRegistrarDiaLibre({ fecha: sumarDias(HOY, 367), ahora: ahoraLunes, plazoHoras: 24 }).ok)
const ventana = consultaMisDiasLibres(HOY)
eq('"Mis días libres" pide desde 90 días atrás y sin fin (nada registrable queda fuera de la lista)', ventana, { desde: sumarDias(HOY, -DIAS_ATRAS_MIS_DIAS_LIBRES) })
const ventanaValida = consultaDiasLibresSchema.safeParse(ventana)
check('… la API acepta esa consulta y no le pone fin', ventanaValida.success && ventanaValida.data.hasta === null)
eq('tope de la revisión en bloque: 200 por petición (igual al de la API)', MAX_IDS_REVISION, 200)
eq('450 seleccionados van en 3 lotes: 200, 200 y 50', enLotes(Array.from({ length: 450 }, (_, i) => i)).map(l => l.length), [200, 200, 50])
eq('… sin perder ni repetir ninguno', enLotes(Array.from({ length: 450 }, (_, i) => i)).flat(), Array.from({ length: 450 }, (_, i) => i))
check('… y cada lote pasa la validación de la API', enLotes(Array.from({ length: 450 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)).every(ids => revisarDiasLibresSchema.safeParse({ ids, accion: 'aprobar' }).success))
eq('lista vacía: ningún lote', enLotes([]), [])
eq('reporta y enlazada: Mis días libres primero, sin aviso', pestanasCalendario({ reporta: true, veDias: false, enlace: 'enlazado' }), { pestanas: ['mis', 'calendario'], avisoSinEjecutiva: false })
eq('reporta sin ejecutiva enlazada: sin Mis días libres y CON aviso', pestanasCalendario({ reporta: true, veDias: false, enlace: 'sin_ejecutiva' }), { pestanas: ['calendario'], avisoSinEjecutiva: true })
eq('directora sin ejecutiva: Días libres y Calendario, con aviso', pestanasCalendario({ reporta: true, veDias: true, enlace: 'sin_ejecutiva' }), { pestanas: ['dias-libres', 'calendario'], avisoSinEjecutiva: true })
eq('mientras se averigua el enlace: la pestaña sale (cargando), sin aviso', pestanasCalendario({ reporta: true, veDias: false, enlace: null }), { pestanas: ['mis', 'calendario'], avisoSinEjecutiva: false })
eq('recursos humanos (no reporta): sin aviso', pestanasCalendario({ reporta: false, veDias: true, enlace: 'sin_ejecutiva' }), { pestanas: ['dias-libres', 'calendario'], avisoSinEjecutiva: false })

// ---------------------------------------------------------------------------------------------
console.log('13. Permisos y rol de recursos humanos (contrato F2)')
const CINCO: Permission[] = ['visits:config', 'calendar:manage', 'daysoff:approve', 'daysoff:view', 'visits:report']
const matriz: [Role, Permission[], Permission[]][] = [
  ['admin', CINCO, []],
  // F1a (A1, 2026-10-15): la dirección comercial no agenda ni reporta: sin visits:report.
  ['commercial_director', ['visits:config', 'calendar:manage', 'daysoff:approve'], ['daysoff:view', 'visits:report']],
  ['hr', ['lines:view', 'executives:view', 'calendar:manage', 'daysoff:approve'], ['visits:config', 'daysoff:view', 'visits:report', 'map:view', 'dashboard:view', 'terceros:view', 'users:manage']],
  ['line_leader', ['daysoff:view', 'visits:report'], ['visits:config', 'calendar:manage', 'daysoff:approve']],
  ['sales_manager', ['visits:report'], ['visits:config', 'calendar:manage', 'daysoff:approve', 'daysoff:view']],
  ['data_manager', [], CINCO],
  ['contract_manager', [], CINCO],
  ['viewer', [], CINCO],
  ['user', [], CINCO],
]
for (const [rol, tiene, noTiene] of matriz) {
  check(`${rol}: tiene ${tiene.join(', ') || '(ninguno)'}`, tiene.every(permiso => hasPermission(rol, permiso)))
  check(`${rol}: no tiene ${noTiene.join(', ') || '(ninguno)'}`, noTiene.every(permiso => !hasPermission(rol, permiso)))
  const menu = getNavigationMenu(rol)
  const rutas = getAllowedRoutes(rol)
  // Desde 2026-10-14 Configuración también agrupa Municipios (territories:view) y Asignación (recalculate:*);
  // la sección Visitas sigue siendo solo de visits:config (scripts/menu-check.ts prueba las secciones).
  const config = PERMISOS_CONFIGURACION.some(permiso => hasPermission(rol, permiso))
  const calendario = PERMISOS_CALENDARIO.some(permiso => hasPermission(rol, permiso))
  // Desde el 2026-10-29 /configuracion sale como "Parámetros" dentro del grupo Configuración
  check(
    `${rol}: menú "Parámetros" (Configuración) y ruta /configuracion ${config ? 'sí' : 'no'}`,
    menu.some(item => item.href === '/configuracion' && item.name === 'Parámetros' && item.grupo === 'Configuración') === config && rutas.includes('/configuracion') === config
  )
  check(
    `${rol}: menú "Calendario" y ruta /calendario ${calendario ? 'sí' : 'no'}`,
    menu.some(item => item.href === '/calendario' && item.name === 'Calendario') === calendario && rutas.includes('/calendario') === calendario
  )
}
eq('PERMISOS_CALENDARIO', PERMISOS_CALENDARIO, ['calendar:manage', 'daysoff:approve', 'daysoff:view', 'visits:report'])
eq('getRoleTitle(hr) = "Recursos humanos"', getRoleTitle('hr'), 'Recursos humanos')
eq(
  'los cuatro perfiles del negocio (dueño, 2026-10-29)',
  (['admin', 'commercial_director', 'line_leader', 'sales_manager'] as Role[]).map(getRoleTitle),
  ['Administrador', 'Director comercial', 'Líder de negocio', 'Ejecutivo comercial']
)
check('el rol hr se acepta al crear o editar usuarios', roleSchema.safeParse('hr').success)
check('un rol inventado no', !roleSchema.safeParse('rrhh').success)
check('ningún texto visible del menú dice "KAM"', (['admin', 'commercial_director', 'hr', 'line_leader', 'sales_manager'] as Role[]).every(rol => getNavigationMenu(rol).every(item => !/kam/i.test(item.name))))

// Decisión del dueño 2026-10-13: el administrador sí puede aprobarse sus propios días libres; los demás no.
check('admin puede aprobarse sus propios días libres', puedeAprobarseASiMismo('admin'))
for (const rol of ['commercial_director', 'hr', 'line_leader', 'sales_manager', 'data_manager', 'viewer', 'user', null, undefined]) {
  check(`${String(rol)} no se aprueba a sí mismo`, !puedeAprobarseASiMismo(rol as string | null | undefined))
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
