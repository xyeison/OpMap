/**
 * Traspaso de un Ejecutivo Comercial: pruebas puras de lib/traspaso.ts (vista previa = espejo de
 * ejecutivas_traspasar), lib/traspaso-schemas.ts y del permiso executives:transfer. SIN red ni Supabase.
 * Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md (decisiones 1 a 10 y criterios de aceptación).
 *
 * Uso (desde web/): npx tsx scripts/traspaso-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import type { z } from 'zod'
import {
  DIAS_ATRAS_MAX,
  MENSAJE_BAJA_SIN_DESTINO,
  MENSAJE_BAJA_TODAS,
  MENSAJE_USUARIO_SIN_BAJA,
  ROLES_USUARIO_DESACTIVABLES,
  TIPOS_DESTINO,
  VALORES_TIPO_DESTINO,
  errorFechaTraspaso,
  etiquetaAnexoFinal,
  etiquetaRazon,
  etiquetaTipoDestino,
  excepcionVigente,
  fechaMinimaTraspaso,
  finDeOrigen,
  desdeDeDestino,
  hastaDeCierre,
  leerResumenTraspaso,
  nombreVacante,
  parametroTraspaso,
  planearTraspaso,
  razonUsuarioNoSeDesactiva,
  type AjusteTraspaso,
  type CoberturaTraspaso,
  type DatosTraspaso,
  type EjecutivaTraspaso,
  type ExcepcionTraspaso,
  type TraspasoInput,
  type UsuarioTraspaso,
  type VisitanteTraspaso,
  type VistaPreviaTraspaso,
} from '../lib/traspaso'
import { contratarSchema, destinoSchema, traspasoSchema } from '../lib/traspaso-schemas'
import { hasPermission, rolePermissions, type Role } from '../lib/permissions'
import { EXECUTIVE_ACCOUNT_ROLE } from '../lib/executive-accounts'
import { avisoCoberturaDe, leerRespuestaTraspaso } from '../app/executives/traspaso-ui'

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

const codigos = (lista: Array<{ codigo: string }>) => lista.map(item => item.codigo)
const tieneError = (plan: VistaPreviaTraspaso, codigo: string) => plan.errores.some(error => error.codigo === codigo)
const tieneAviso = (plan: VistaPreviaTraspaso, codigo: string) => plan.avisos.some(aviso => aviso.codigo === codigo)
const linea = (plan: VistaPreviaTraspaso, lineId: string) => plan.lineas.find(item => item.line_id === lineId)

/** uuid legible para las pruebas. */
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ---------------------------------------------------------------------------------------------
// Escenario base (criterio 1): A con 2 líneas, 3 zonas, 1 ajuste manual, nombre de territorio y 5 médicos
// ---------------------------------------------------------------------------------------------

const HOY = '2026-10-12'
const AYER = '2026-10-11'

// Líneas (en orden de sort_order)
const L_RA = u(101) // Reemplazo articular
const L_COL = u(102) // Columna
const L_PO = u(103) // PerOssal

// Zonas
const Z_BAQ = u(201)
const Z_BOG = u(202)
const Z_CTG = u(203)
const Z_SM = u(204)
const Z_MED = u(205)

// Personas
const A = u(301) // entrega: Barranquilla, RA + Columna, con usuario
const B = u(302) // Medellín (otra ciudad), PerOssal
const C = u(303) // Bogotá, Columna
const D = u(304) // Cartagena, RA (vacante existente)
const E = u(305) // Barranquilla, RA, INACTIVA (no cuenta como residente)
const F = u(306) // Barranquilla (misma ciudad que A), PerOssal
const H = u(307) // Bogotá, PerOssal (recibir Columna en Bogotá → conflicto con C)
const SIN_LINEAS = u(308) // activa sin líneas
const INACTIVA = u(309) // inactiva con líneas
const SIN_ZONA = u(310) // activa sin zona base

// Médicos
const M1 = u(401)
const M2 = u(402)
const M3 = u(403)
const M4 = u(404)
const M5 = u(405)
const M6 = u(406)

const U_A = u(501)
const U_DIRECTORA = u(502)

/** El usuario de OpMap de A: de Ejecutivo Comercial (sales_manager), activo. */
const usuariosBase: UsuarioTraspaso[] = [{ id: U_A, role: 'sales_manager', active: true }]

const ejecutivasBase: EjecutivaTraspaso[] = [
  { id: A, full_name: 'Ana Ruiz', email: 'ana@vg.co', status: 'active', base_kam_id: Z_BAQ, user_id: U_A, lines: [L_RA, L_COL], color: '#d62728', started_at: '2025-03-01' },
  { id: B, full_name: 'Beatriz Gómez', email: 'bea@vg.co', status: 'active', base_kam_id: Z_MED, user_id: null, lines: [L_PO], color: '#2ca02c', started_at: '2025-06-01' },
  { id: C, full_name: 'Carla Díaz', email: null, status: 'active', base_kam_id: Z_BOG, user_id: null, lines: [L_COL] },
  { id: D, full_name: 'Nueva Cartagena', email: null, status: 'placeholder', base_kam_id: Z_CTG, user_id: null, lines: [L_RA] },
  { id: E, full_name: 'Elena Mora', email: 'elena@vg.co', status: 'inactive', base_kam_id: Z_BAQ, user_id: null, lines: [L_RA] },
  { id: F, full_name: 'Fabiola Paz', email: null, status: 'active', base_kam_id: Z_BAQ, user_id: null, lines: [L_PO] },
  { id: H, full_name: 'Helena Ríos', email: null, status: 'active', base_kam_id: Z_BOG, user_id: null, lines: [L_PO] },
  { id: SIN_LINEAS, full_name: 'Sofía Sin Líneas', email: null, status: 'active', base_kam_id: Z_SM, user_id: null, lines: [] },
  { id: INACTIVA, full_name: 'Inés Ida', email: null, status: 'inactive', base_kam_id: Z_SM, user_id: null, lines: [L_PO] },
  { id: SIN_ZONA, full_name: 'Zoe Sin Zona', email: null, status: 'active', base_kam_id: null, user_id: null, lines: [L_PO] },
]

const lineasCatalogo = [
  { id: L_RA, name: 'Reemplazo articular', code: 'RA' },
  { id: L_COL, name: 'Columna', code: 'COL' },
  { id: L_PO, name: 'PerOssal', code: 'PO' },
]

const zonasCatalogo = [
  { id: Z_BAQ, name: 'KAM Barranquilla' },
  { id: Z_BOG, name: 'KAM Bogotá' },
  { id: Z_CTG, name: 'Cartagena' },
  { id: Z_SM, name: 'Santa Marta' },
  { id: Z_MED, name: 'Medellín' },
]

// 3 zonas de A: RA Barranquilla (local), Columna Barranquilla (local), Columna Santa Marta (manual)
const coberturaBase: CoberturaTraspaso[] = [
  { line_id: L_RA, kam_id: Z_BAQ, executive_id: A, kind: 'local' },
  { line_id: L_RA, kam_id: Z_CTG, executive_id: D, kind: 'local' },
  { line_id: L_RA, kam_id: Z_SM, executive_id: null, kind: 'vacant' },
  { line_id: L_COL, kam_id: Z_BAQ, executive_id: A, kind: 'local' },
  { line_id: L_COL, kam_id: Z_SM, executive_id: A, kind: 'manual' },
  { line_id: L_COL, kam_id: Z_BOG, executive_id: C, kind: 'local' },
  { line_id: L_COL, kam_id: Z_CTG, executive_id: A, kind: 'conflict' }, // conflicto: no es territorio de A
]

const ajustesBase: AjusteTraspaso[] = [
  { id: u(601), line_id: L_COL, kam_id: Z_SM, executive_id: A, reason: 'Santa Marta la atiende Ana', active: true },
  { id: u(602), line_id: L_RA, kam_id: Z_SM, executive_id: A, reason: 'Viejo, ya inactivo', active: false },
  { id: u(603), line_id: L_COL, kam_id: Z_MED, executive_id: C, reason: 'De otra persona', active: true },
]

const nombresBase = [
  { line_id: L_RA, executive_id: A, name: 'Caribe Norte' },
  { line_id: L_COL, executive_id: C, name: 'Capital' },
]

// 5 médicos abiertos de A (RA: M1, M2; Columna: M3, M4, M5 — M5 asignado hoy) y uno ya terminado
const visitantesBase: VisitanteTraspaso[] = [
  { id: u(701), medico_id: M1, medico_nombre: 'Arias', medico_activo: true, executive_id: A, line_id: L_RA, municipality_id: '08001', desde: '2026-09-01', hasta: null },
  { id: u(702), medico_id: M2, medico_nombre: 'Bernal', medico_activo: true, executive_id: A, line_id: L_RA, municipality_id: null, desde: '2026-09-01', hasta: null },
  { id: u(703), medico_id: M3, medico_nombre: 'Castro', medico_activo: true, executive_id: A, line_id: L_COL, municipality_id: '08001', desde: '2026-09-15', hasta: null },
  { id: u(704), medico_id: M4, medico_nombre: 'Duarte', medico_activo: true, executive_id: A, line_id: L_COL, municipality_id: '47001', desde: '2026-09-15', hasta: null },
  { id: u(705), medico_id: M5, medico_nombre: 'Estrada', medico_activo: true, executive_id: A, line_id: L_COL, municipality_id: null, desde: HOY, hasta: null },
  { id: u(706), medico_id: M6, medico_nombre: 'Fuentes', medico_activo: true, executive_id: A, line_id: L_RA, municipality_id: null, desde: '2026-08-01', hasta: '2026-08-31' },
]

const excepcionesBase: ExcepcionTraspaso[] = [
  // De A: vigentes hoy → 1 persona + 1 meta; una vencida, una anulada y una futura no cuentan
  { tabla: 'config_personas', id: u(801), executive_id: A, vigente_desde: '2026-10-01', vigente_hasta: null },
  { tabla: 'config_metas', id: u(802), executive_id: A, tipo: 'medica', subtipo_id: null, vigente_desde: '2026-10-01', vigente_hasta: '2026-12-31' },
  { tabla: 'config_metas', id: u(803), executive_id: A, tipo: 'institucional', subtipo_id: null, vigente_desde: '2026-01-01', vigente_hasta: '2026-09-30' },
  { tabla: 'config_metas', id: u(804), executive_id: A, tipo: 'institucional', subtipo_id: null, vigente_desde: '2026-10-01', vigente_hasta: null, anulado_at: '2026-10-05T10:00:00Z' },
  { tabla: 'config_metas', id: u(805), executive_id: A, tipo: 'institucional', subtipo_id: u(901), vigente_desde: '2026-11-01', vigente_hasta: null },
  // De B: su propio perfil vigente (se reemplaza si se copian las de A)
  { tabla: 'config_personas', id: u(806), executive_id: B, vigente_desde: '2026-10-01', vigente_hasta: null },
]

function input(parcial: Partial<TraspasoInput> & Pick<TraspasoInput, 'destino'>): TraspasoInput {
  return {
    lineas: null,
    fecha: null,
    dar_de_baja: false,
    desactivar_usuario: false,
    copiar_excepciones: false,
    guardar_anexo_final: true,
    motivo: null,
    ...parcial,
  }
}

function datos(entrada: TraspasoInput, cambios: Partial<DatosTraspaso> = {}): DatosTraspaso {
  return {
    hoy: HOY,
    origen_id: A,
    input: entrada,
    ejecutivas: ejecutivasBase,
    lineas: lineasCatalogo,
    zonas: zonasCatalogo,
    cobertura: coberturaBase,
    ajustes: ajustesBase,
    nombres: nombresBase,
    visitantes: visitantesBase,
    excepciones: excepcionesBase,
    usuarios: usuariosBase,
    solicitante_id: U_DIRECTORA,
    ...cambios,
  }
}

const TODOS_LOS_MENSAJES: string[] = []
function planear(d: DatosTraspaso): VistaPreviaTraspaso {
  const plan = planearTraspaso(d)
  TODOS_LOS_MENSAJES.push(...plan.errores.map(error => error.mensaje), ...plan.avisos.map(aviso => aviso.mensaje))
  return plan
}

// ---------------------------------------------------------------------------------------------
console.log('1. Constantes y piezas puras')
eq('tipos de destino', VALORES_TIPO_DESTINO, ['existente', 'nueva', 'vacante', 'nadie'])
check('todo tipo de destino tiene etiqueta sin "KAM"', TIPOS_DESTINO.every(t => t.etiqueta.trim() && !/kam/i.test(t.etiqueta)))
eq('etiqueta de "vacante"', etiquetaTipoDestino('vacante'), 'Una vacante')
eq('etiqueta de razón conocida', etiquetaRazon('ya_lo_visita').startsWith('Quien recibe ya visita'), true)
eq('etiqueta de razón desconocida = la razón', etiquetaRazon('otra_cosa'), 'otra_cosa')
eq('días atrás máximo', DIAS_ATRAS_MAX, 90)
eq('fecha mínima = hoy − 90', fechaMinimaTraspaso(HOY), '2026-07-14')
eq('fin de quien entrega = F − 1', finDeOrigen(HOY), AYER)
eq('fin de quien entrega cruza mes', finDeOrigen('2026-03-01'), '2026-02-28')
eq('cierre de asignación vieja = F − 1', hastaDeCierre('2026-09-01', HOY), AYER)
eq('cierre de asignación creada en F = su desde (CHECK hasta >= desde)', hastaDeCierre(HOY, HOY), HOY)
eq('cierre de asignación creada después de F − 1 = su desde', hastaDeCierre('2026-10-05', '2026-10-03'), '2026-10-05')
eq('quien recibe lo tiene desde F si la asignación es anterior', desdeDeDestino('2026-09-01', HOY), HOY)
eq('quien recibe nunca lo tiene antes de que existiera la asignación (fecha pasada)', desdeDeDestino('2026-10-05', '2026-10-01'), '2026-10-05')
eq('el traspaso solo desactiva usuarios de Ejecutivo Comercial', [...ROLES_USUARIO_DESACTIVABLES].sort(), ['sales_manager', 'user'])
check('el rol de las cuentas de Ejecutivo Comercial es desactivable', ROLES_USUARIO_DESACTIVABLES.includes(EXECUTIVE_ACCOUNT_ROLE))
eq('usuario de Ejecutivo Comercial activo: se desactiva', razonUsuarioNoSeDesactiva(U_A, usuariosBase[0], U_DIRECTORA), null)
eq('rol básico (user): también', razonUsuarioNoSeDesactiva(U_A, { id: U_A, role: 'user', active: true }, null), null)
eq('sin usuario', razonUsuarioNoSeDesactiva(null, null, U_DIRECTORA), 'sin_usuario')
for (const rol of ['admin', 'line_leader', 'commercial_director', 'data_manager', 'hr', 'viewer', 'contract_manager']) {
  eq(`rol ${rol}: no se desactiva desde el traspaso`, razonUsuarioNoSeDesactiva(U_A, { id: U_A, role: rol, active: true }, U_DIRECTORA), 'rol')
}
eq('el propio usuario de quien hace el traspaso nunca', razonUsuarioNoSeDesactiva(U_A, usuariosBase[0], U_A), 'propio')
eq('ya inactivo', razonUsuarioNoSeDesactiva(U_A, { id: U_A, role: 'sales_manager', active: false }, U_DIRECTORA), 'ya_inactivo')
eq('sin la fila del usuario no se adivina su rol', razonUsuarioNoSeDesactiva(U_A, null, U_DIRECTORA), 'no_encontrado')
eq('etiqueta del anexo final', etiquetaAnexoFinal(HOY), 'Final 2026-10-12 (traspaso)')
eq('nombre de vacante sin el prefijo de zona', nombreVacante('KAM Barranquilla'), 'Vacante · Barranquilla')
eq('nombre de vacante sin zona', nombreVacante(null), 'Vacante')
eq('fecha hoy vale', errorFechaTraspaso(HOY, HOY), null)
eq('fecha hoy − 90 vale', errorFechaTraspaso('2026-07-14', HOY), null)
check('fecha hoy − 91 no vale', (errorFechaTraspaso('2026-07-13', HOY) ?? '').includes('hasta 90 días atrás'))
check('fecha mañana no vale', (errorFechaTraspaso('2026-10-13', HOY) ?? '').includes('posterior a hoy'))
check('fecha inexistente no vale', (errorFechaTraspaso('2026-02-30', HOY) ?? '').includes('AAAA-MM-DD'))
check('excepción vigente en su primer día', excepcionVigente(excepcionesBase[0], '2026-10-01'))
check('excepción no vigente antes de empezar', !excepcionVigente(excepcionesBase[0], '2026-09-30'))
check('excepción vigente en su último día', excepcionVigente(excepcionesBase[1], '2026-12-31'))
check('excepción anulada no rige', !excepcionVigente(excepcionesBase[3], HOY))

// ---------------------------------------------------------------------------------------------
console.log('2. Criterio 1: baja de A a una persona nueva')
{
  const entrada = input({
    destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'laura@vg.co' },
    dar_de_baja: true,
    desactivar_usuario: true,
  })
  const original = JSON.stringify(datos(entrada))
  const d = datos(entrada)
  const plan = planear(d)
  check('sin errores', plan.ok, plan.errores)
  eq('no modifica las filas recibidas (no escribe nada)', JSON.stringify(d), original)
  eq('fecha por defecto = hoy', plan.fecha, HOY)
  eq('fin de A = ayer', plan.fin_origen, AYER)
  eq('se traspasan todas las líneas (resumen en orden de id, como la función SQL)', plan.resumen.lineas, [L_RA, L_COL])
  eq('el plan por línea va en el orden del catálogo', plan.lineas.map(l => l.line_id), [L_RA, L_COL])
  eq('la nueva se crea con la zona base de A', [plan.destino.se_crea, plan.destino.base_kam_id, plan.destino.base_kam_name], [true, Z_BAQ, 'Barranquilla'])
  eq('la nueva queda activa desde la fecha', [plan.destino.status_despues, plan.destino.started_at], ['active', HOY])
  eq('con baja, la nueva hereda el color de A (el mapa no cambia de color)', plan.destino.color, '#d62728')
  check('el aviso de la persona nueva dice que conserva el color', plan.avisos.some(a => a.codigo === 'se_crea_destino' && a.mensaje.includes('Conserva el color de Ana Ruiz')))
  eq('la nueva suma las 2 líneas', plan.destino.lineas_sumadas, [L_RA, L_COL])
  eq('destino_id aún no existe en la vista previa', plan.resumen.destino_id, null)
  eq('nombre y email de la nueva', [plan.destino.full_name, plan.destino.email], ['Laura Pérez', 'laura@vg.co'])
  eq('zonas de A por línea (solo local|reach|manual)', plan.lineas.map(l => l.zonas.map(z => `${z.kam_name}:${z.kind}`)), [
    ['Barranquilla:local'],
    ['Barranquilla:local', 'Santa Marta:manual'],
  ])
  eq('el ajuste manual activo pasa a la nueva', plan.resumen.ajustes_movidos, 1)
  eq('ningún ajuste se desactiva sin reemplazo', plan.resumen.ajustes_desactivados, 0)
  eq('el ajuste movido rige (no queda sin efecto)', linea(plan, L_COL)?.ajustes_mover.map(a => a.queda_sin_efecto), [false])
  eq('el nombre del territorio se copia', [plan.resumen.nombres_copiados, linea(plan, L_RA)?.nombre_territorio.se_copia], [1, true])
  eq('los 5 médicos pasan a la nueva', plan.resumen.visitantes_movidos, 5)
  eq('ninguno solo terminado ni omitido', [plan.resumen.visitantes_terminados, plan.resumen.omitidos.length], [0, 0])
  eq('el visitante ya terminado no cuenta', plan.lineas.flatMap(l => l.medicos_mover.map(m => m.medico_id)).includes(M6), false)
  eq('asignaciones de A terminan el día anterior', linea(plan, L_RA)?.medicos_mover.map(m => m.hasta_origen), [AYER, AYER])
  eq('la asignada hoy termina hoy (no antes de su inicio)', linea(plan, L_COL)?.medicos_mover.find(m => m.medico_id === M5)?.hasta_origen, HOY)
  eq('quien recibe los tiene desde la fecha', plan.lineas.flatMap(l => l.medicos_mover.map(m => m.desde_destino)), [HOY, HOY, HOY, HOY, HOY])
  eq('médicos ordenados por nombre', linea(plan, L_COL)?.medicos_mover.map(m => m.medico_nombre), ['Castro', 'Duarte', 'Estrada'])
  eq('A queda inactiva, sin líneas, left_at = F − 1', [plan.origen?.status_despues, plan.origen?.lineas_despues, plan.origen?.left_at_despues], ['inactive', [], AYER])
  eq('se desactiva su usuario', plan.desactivar_usuario, true)
  check('aviso: el usuario se desactiva', tieneAviso(plan, 'usuario_se_desactiva'))
  eq('anexo final en las 2 líneas con la etiqueta', plan.lineas.map(l => l.anexo_final), [
    { tiene_territorio: true, se_guarda: true, etiqueta: 'Final 2026-10-12 (traspaso)' },
    { tiene_territorio: true, se_guarda: true, etiqueta: 'Final 2026-10-12 (traspaso)' },
  ])
  eq('aviso de anexo final por línea', plan.avisos.filter(a => a.codigo === 'anexo_final').map(a => a.line_id), [L_RA, L_COL])
  check('aviso: se crea la persona nueva', tieneAviso(plan, 'se_crea_destino'))
  check('sin conflicto: E vive en Barranquilla con RA pero está inactiva', !tieneAviso(plan, 'conflicto'))
  check('sin aviso de otra ciudad (hereda la zona de A)', !tieneAviso(plan, 'otra_ciudad'))
  eq('excepciones no se copian por defecto', plan.resumen.excepciones_copiadas, 0)
  check('aviso: A tiene excepciones que no se copian', tieneAviso(plan, 'excepciones_no_copiadas'))
  // La vista previa cuenta exactamente lo que se mueve
  const totalMedicos = plan.lineas.reduce((s, l) => s + l.medicos_mover.length + l.medicos_terminar.length + l.medicos_omitidos.length, 0)
  eq('médicos de las listas = abiertos de A en esas líneas', totalMedicos, visitantesBase.filter(v => v.hasta === null).length)
  eq(
    'resumen = suma de las listas (movidos + terminados + omitidos ya_lo_visita)',
    plan.resumen.visitantes_movidos + plan.resumen.visitantes_terminados + plan.resumen.omitidos.filter(o => o.razon === 'ya_lo_visita').length,
    totalMedicos
  )
}

// ---------------------------------------------------------------------------------------------
console.log('3. Criterio 2: A se queda y pierde Columna hacia B (ya existe, otra ciudad)')
{
  const plan = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL] })))
  check('sin errores', plan.ok, plan.errores)
  eq('solo Columna', plan.resumen.lineas, [L_COL])
  eq('B conserva su zona y suma Columna', [plan.destino.se_crea, plan.destino.base_kam_id, plan.destino.lineas_sumadas], [false, Z_MED, [L_COL]])
  eq('B conserva su color', plan.destino.color, '#2ca02c')
  const vacanteSinBaja = planear(datos(input({ destino: { tipo: 'vacante' }, lineas: [L_COL] })))
  eq('sin baja, la vacante no hereda el color (A lo sigue usando: no hay dos iguales)', vacanteSinBaja.destino.color, null)
  check('sin baja, el aviso no promete el color', !vacanteSinBaja.avisos.some(a => a.mensaje.includes('Conserva el color')))
  const nuevaSinBaja = planear(datos(input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: null }, lineas: [L_COL] })))
  eq('sin baja, la persona nueva tampoco', nuevaSinBaja.destino.color, null)
  eq('destino_id = B', plan.resumen.destino_id, B)
  eq('B recibe los 3 médicos de A en Columna', linea(plan, L_COL)?.medicos_mover.map(m => m.medico_id), [M3, M4, M5])
  eq('B recibe el ajuste de Columna', plan.resumen.ajustes_movidos, 1)
  eq('A conserva RA (y sus médicos de RA no están en el plan)', [plan.origen?.lineas_despues, plan.lineas.length], [[L_RA], 1])
  eq('A sigue activa, sin left_at', [plan.origen?.status_despues, plan.origen?.left_at_despues], ['active', null])
  eq('sin baja no se desactiva el usuario', plan.desactivar_usuario, false)
  check('sin avisos de usuario', !tieneAviso(plan, 'usuario_se_desactiva') && !tieneAviso(plan, 'usuario_sigue_activo'))
  check('aviso: B vive en otra ciudad', tieneAviso(plan, 'otra_ciudad'))
  check('el aviso de otra ciudad nombra la ciudad de B', plan.avisos.some(a => a.codigo === 'otra_ciudad' && a.mensaje.includes('Medellín')))
  check(
    'aviso de otra ciudad en plural concordado (2 zonas)',
    plan.avisos.some(a => a.codigo === 'otra_ciudad' && a.mensaje.includes('las 2 zonas de Ana Ruiz en Columna las decide la cobertura recalculada; pueden quedar'))
  )
  const unaZona = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_RA] })))
  check(
    'aviso de otra ciudad en singular (1 zona), sin "1 la zona"',
    unaZona.avisos.some(a => a.codigo === 'otra_ciudad' && a.mensaje.includes('la zona de Ana Ruiz en Reemplazo articular la decide la cobertura recalculada; puede quedar')) &&
      !unaZona.avisos.some(a => /\b1 la zona/.test(a.mensaje)),
    unaZona.avisos
  )
  check('sin conflicto en Medellín', !tieneAviso(plan, 'conflicto'))
  eq('nada en Columna que copiar de nombre (A no tiene)', plan.resumen.nombres_copiados, 0)
  eq('anexo final solo de Columna', plan.lineas.map(l => l.anexo_final.se_guarda), [true])
}

// ---------------------------------------------------------------------------------------------
console.log('4. Criterio 3: quien recibe ya visita al médico por la misma línea y ciudad')
{
  const visitantes: VisitanteTraspaso[] = [
    ...visitantesBase,
    // B ya visita a M3 por Columna en 08001 (abierta) → omitido
    { id: u(711), medico_id: M3, medico_nombre: 'Castro', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: '08001', desde: '2026-10-01', hasta: null },
    // B visita a M4 por Columna pero en otra ciudad (sin ciudad) → no es duplicado
    { id: u(712), medico_id: M4, medico_nombre: 'Duarte', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: null, desde: '2026-10-01', hasta: null },
    // B visitó a M5 por Columna sin ciudad, ya terminada → no es duplicado
    { id: u(713), medico_id: M5, medico_nombre: 'Estrada', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: null, desde: '2026-09-01', hasta: '2026-09-30' },
    // B visita a M1 pero por otra línea → no aplica a Columna
    { id: u(714), medico_id: M1, medico_nombre: 'Arias', medico_activo: true, executive_id: B, line_id: L_PO, municipality_id: '08001', desde: '2026-10-01', hasta: null },
  ]
  const plan = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL] }), { visitantes }))
  check('sin errores', plan.ok, plan.errores)
  eq('omitido con razón', plan.resumen.omitidos, [{ medico_id: M3, razon: 'ya_lo_visita' }])
  eq('se mueven los otros dos', linea(plan, L_COL)?.medicos_mover.map(m => m.medico_id), [M4, M5])
  eq('el omitido igual se termina a A el día anterior', linea(plan, L_COL)?.medicos_omitidos.map(m => m.hasta_origen), [AYER])
  eq('conteo: 2 movidos, 0 solo terminados, 1 omitido', [plan.resumen.visitantes_movidos, plan.resumen.visitantes_terminados, plan.resumen.omitidos.length], [2, 0, 1])
}

// ---------------------------------------------------------------------------------------------
console.log('5. Médico inactivo: solo se termina')
{
  const visitantes = visitantesBase.map(v => (v.medico_id === M2 ? { ...v, medico_activo: false } : v))
  const plan = planear(datos(input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: null }, dar_de_baja: true, desactivar_usuario: true }), { visitantes }))
  check('sin errores', plan.ok, plan.errores)
  eq('M2 solo se termina, con razón', linea(plan, L_RA)?.medicos_terminar.map(m => [m.medico_id, m.razon]), [[M2, 'medico_inactivo']])
  eq('M2 no se crea para la nueva', linea(plan, L_RA)?.medicos_mover.map(m => m.medico_id), [M1])
  eq('conteo: 4 movidos, 1 terminado', [plan.resumen.visitantes_movidos, plan.resumen.visitantes_terminados], [4, 1])
  eq('el inactivo también sale en omitidos con su razón (igual que la 0820)', plan.resumen.omitidos, [{ medico_id: M2, razon: 'medico_inactivo' }])
  eq('en el plan por línea va en "solo se terminan", no en omitidos', linea(plan, L_RA)?.medicos_omitidos.length, 0)
}

// ---------------------------------------------------------------------------------------------
console.log('5b. Espejo de ejecutivas_traspasar: orden del resumen y baja con líneas que ya no lleva')
{
  // Catálogo en otro orden que los id: el plan sigue el catálogo; resumen.lineas, el orden de id (como la función)
  const catalogoAlReves = [...lineasCatalogo].reverse()
  const alReves = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true }), { lineas: catalogoAlReves }))
  check('sin errores', alReves.ok, alReves.errores)
  eq('plan por línea en el orden del catálogo', alReves.lineas.map(l => l.line_id), [L_COL, L_RA])
  eq('resumen.lineas en orden de id (ORDER BY line_id de la función)', alReves.resumen.lineas, [L_RA, L_COL])

  // Omitidos mezclados: el orden es el del bucle SQL (línea, médico, ciudad sin ciudad primero, asignación)
  const M4_SIN_CIUDAD = u(720)
  const visitantes: VisitanteTraspaso[] = [
    ...visitantesBase.map(v => (v.medico_id === M1 || v.medico_id === M2 ? { ...v, medico_activo: false } : v)),
    { id: M4_SIN_CIUDAD, medico_id: M4, medico_nombre: 'Duarte', medico_activo: true, executive_id: A, line_id: L_COL, municipality_id: null, desde: '2026-09-15', hasta: null },
    { id: u(721), medico_id: M3, medico_nombre: 'Castro', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: '08001', desde: '2026-10-01', hasta: null },
    { id: u(722), medico_id: M4, medico_nombre: 'Duarte', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: '47001', desde: '2026-10-01', hasta: null },
    { id: u(723), medico_id: M4, medico_nombre: 'Duarte', medico_activo: true, executive_id: B, line_id: L_COL, municipality_id: null, desde: '2026-10-01', hasta: null },
  ]
  const mezcla = planear(datos(input({ destino: { tipo: 'existente', id: B } }), { visitantes }))
  check('sin errores', mezcla.ok, mezcla.errores)
  eq('omitidos en el orden de la función, con su razón', mezcla.resumen.omitidos, [
    { medico_id: M1, razon: 'medico_inactivo' },
    { medico_id: M2, razon: 'medico_inactivo' },
    { medico_id: M3, razon: 'ya_lo_visita' },
    { medico_id: M4, razon: 'ya_lo_visita' },
    { medico_id: M4, razon: 'ya_lo_visita' },
  ])
  eq('plan de Columna: las tres asignaciones que B ya visita (cada una con su ciudad) son omitidas', linea(mezcla, L_COL)?.medicos_omitidos.map(m => m.visitante_id).sort(), [u(703), u(704), M4_SIN_CIUDAD].sort())
  eq('conteo: 1 movido (M5), 2 terminados (inactivos), 3 omitidos ya_lo_visita', [
    mezcla.resumen.visitantes_movidos,
    mezcla.resumen.visitantes_terminados,
    mezcla.resumen.omitidos.filter(o => o.razon === 'ya_lo_visita').length,
  ], [1, 2, 3])
  eq('movidos + terminados + omitidos ya_lo_visita = abiertas de A en esas líneas', 1 + 2 + 3, visitantes.filter(v => v.executive_id === A && v.hasta === null).length)

  // Con baja, una asignación abierta en una línea que A ya no lleva la termina el disparador: cuenta en terminados
  const huerfana: VisitanteTraspaso = { id: u(730), medico_id: M6, medico_nombre: 'Fuentes', medico_activo: true, executive_id: A, line_id: L_PO, municipality_id: null, desde: '2026-09-01', hasta: null }
  const conHuerfana = [...visitantesBase, huerfana]
  const baja = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true }), { visitantes: conHuerfana }))
  check('sin errores', baja.ok, baja.errores)
  eq('baja: la de PerOssal (que A no lleva) cuenta en terminados', [baja.resumen.visitantes_movidos, baja.resumen.visitantes_terminados, baja.resumen.omitidos.length], [5, 1, 0])
  check('baja: aviso de asignaciones en líneas que ya no lleva', tieneAviso(baja, 'visitantes_sin_linea'))
  check('baja: no entra en el plan por línea (PerOssal no se traspasa)', baja.lineas.every(l => l.line_id !== L_PO))
  const sinBaja = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL] }), { visitantes: conHuerfana }))
  eq('sin baja no se toca ni se cuenta', [sinBaja.resumen.visitantes_terminados, tieneAviso(sinBaja, 'visitantes_sin_linea')], [0, false])
}

// ---------------------------------------------------------------------------------------------
console.log('6. Criterio 4: "nadie" al quitar una línea; con baja se rechaza')
{
  const plan = planear(datos(input({ destino: { tipo: 'nadie' }, lineas: [L_COL] })))
  check('sin errores', plan.ok, plan.errores)
  eq('los médicos de Columna quedan sin visitante (terminados)', linea(plan, L_COL)?.medicos_terminar.map(m => [m.medico_id, m.razon]), [
    [M3, 'sin_destino'],
    [M4, 'sin_destino'],
    [M5, 'sin_destino'],
  ])
  eq('nada se mueve', [plan.resumen.visitantes_movidos, plan.resumen.ajustes_movidos, plan.resumen.nombres_copiados], [0, 0, 0])
  eq('los ajustes se desactivan', [plan.resumen.ajustes_desactivados, linea(plan, L_COL)?.ajustes_desactivar.map(a => a.override_id)], [1, [u(601)]])
  eq('3 terminados', plan.resumen.visitantes_terminados, 3)
  eq('sin destino', [plan.destino.id, plan.destino.lineas_sumadas, plan.resumen.destino_id], [null, [], null])
  check('aviso: las zonas las decide la cobertura recalculada', tieneAviso(plan, 'zonas_sin_ejecutiva'))
  check(
    'aviso de "nadie" concordado: "las 2 zonas … las decide"',
    plan.avisos.some(a => a.codigo === 'zonas_sin_ejecutiva' && a.mensaje.includes('Nadie recibe Columna: las 2 zonas de Ana Ruiz en Columna las decide'))
  )
  eq('A conserva RA', plan.origen?.lineas_despues, [L_RA])
  eq('excepciones: nada que copiar con "nadie"', plan.resumen.excepciones_copiadas, 0)

  const conBaja = planear(datos(input({ destino: { tipo: 'nadie' }, dar_de_baja: true, desactivar_usuario: true })))
  check('con baja, "nadie" se rechaza', !conBaja.ok && tieneError(conBaja, 'baja_sin_destino'))
  check('mensaje de "nadie" con baja', conBaja.errores.some(e => e.mensaje === MENSAJE_BAJA_SIN_DESTINO))
}

// ---------------------------------------------------------------------------------------------
console.log('7. Fechas límite (decisión 1)')
{
  const destino = { tipo: 'existente' as const, id: B }
  const hace10 = planear(datos(input({ destino, lineas: [L_COL], fecha: '2026-10-02' })))
  check('10 días atrás vale', hace10.ok, hace10.errores)
  eq('fin de A = F − 1', hace10.fin_origen, '2026-10-01')
  eq('cierres: F − 1 o su desde si empezó después', linea(hace10, L_COL)?.medicos_mover.map(m => m.hasta_origen), ['2026-10-01', '2026-10-01', HOY])
  eq(
    'quien recibe: desde F, o desde que existía la asignación si empezó después (nunca antes)',
    linea(hace10, L_COL)?.medicos_mover.map(m => m.desde_destino),
    ['2026-10-02', '2026-10-02', HOY]
  )
  check('sin aviso de ingreso: B ingresó antes de la fecha', !tieneAviso(hace10, 'fecha_antes_de_ingreso'))
  const antesIngresoOrigen = planear(
    datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true, fecha: '2026-09-30' }), {
      ejecutivas: ejecutivasBase.map(e => (e.id === A ? { ...e, started_at: '2026-10-05' } : e)),
    })
  )
  check(
    'baja con fecha anterior al ingreso de A: aviso (su último día quedaría antes de su ingreso), sin rechazar',
    antesIngresoOrigen.ok && antesIngresoOrigen.avisos.some(a => a.codigo === 'fecha_antes_de_ingreso' && a.mensaje.includes('Ana Ruiz ingresó el 2026-10-05')),
    antesIngresoOrigen.avisos
  )
  const antesIngresoDestino = planear(
    datos(input({ destino, lineas: [L_COL], fecha: '2026-10-02' }), {
      ejecutivas: ejecutivasBase.map(e => (e.id === B ? { ...e, started_at: '2026-10-08' } : e)),
    })
  )
  check(
    'quien recibe ingresó después de la fecha: aviso',
    antesIngresoDestino.avisos.some(a => a.codigo === 'fecha_antes_de_ingreso' && a.mensaje.includes('Beatriz Gómez ingresó el 2026-10-08')),
    antesIngresoDestino.avisos
  )
  eq('etiqueta del anexo con la fecha del traspaso', linea(hace10, L_COL)?.anexo_final.etiqueta, 'Final 2026-10-02 (traspaso)')
  check('hoy − 90 vale', planear(datos(input({ destino, lineas: [L_COL], fecha: '2026-07-14' }))).ok)
  const muyAtras = planear(datos(input({ destino, lineas: [L_COL], fecha: '2026-07-13' })))
  check('hoy − 91 se rechaza', !muyAtras.ok && tieneError(muyAtras, 'fecha_muy_atras'), muyAtras.errores)
  const futura = planear(datos(input({ destino, lineas: [L_COL], fecha: '2026-10-13' })))
  check('mañana se rechaza (no se programan traspasos)', !futura.ok && tieneError(futura, 'fecha_futura'), futura.errores)
  const rara = planear(datos(input({ destino, lineas: [L_COL], fecha: '2026-13-01' })))
  check('fecha inexistente se rechaza', !rara.ok && tieneError(rara, 'fecha_invalida'), rara.errores)
  eq('con fecha inexistente el plan se calcula con hoy', rara.fecha, HOY)
  const bajaAtras = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true, fecha: '2026-09-30' })))
  eq('baja con fecha pasada: left_at = F − 1', bajaAtras.origen?.left_at_despues, '2026-09-29')
}

// ---------------------------------------------------------------------------------------------
console.log('8. Criterio 5 (parte pura): baja a una vacante')
{
  const plan = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true })))
  check('sin errores', plan.ok, plan.errores)
  eq('la vacante se crea con la zona de A', [plan.destino.full_name, plan.destino.base_kam_id, plan.destino.status_despues], ['Vacante · Barranquilla', Z_BAQ, 'placeholder'])
  eq('la vacante no tiene fecha de ingreso ni email', [plan.destino.started_at, plan.destino.email], [null, null])
  eq('con baja, la vacante hereda el color de A', plan.destino.color, '#d62728')
  eq('guarda todo lo de A', [plan.resumen.ajustes_movidos, plan.resumen.nombres_copiados, plan.resumen.visitantes_movidos], [1, 1, 5])
  check('aviso: usar «Contratar»', plan.avisos.some(a => a.codigo === 'se_crea_destino' && a.mensaje.includes('Contratar')))
}

// ---------------------------------------------------------------------------------------------
console.log('9. Avisos de cobertura (decisión 3)')
{
  // H vive en Bogotá, donde C ya lleva Columna → conflicto
  const conflicto = planear(datos(input({ destino: { tipo: 'existente', id: H }, lineas: [L_COL] })))
  check('sin errores (el conflicto es un aviso)', conflicto.ok, conflicto.errores)
  const aviso = conflicto.avisos.find(a => a.codigo === 'conflicto')
  check('aviso de conflicto en Bogotá', aviso?.kam_id === Z_BOG && aviso?.line_id === L_COL, conflicto.avisos)
  check('el aviso nombra a quien ya vive ahí', Boolean(aviso?.mensaje.includes('Carla Díaz')))

  // F vive en Barranquilla como A → ni otra ciudad ni conflicto
  const mismaCiudad = planear(datos(input({ destino: { tipo: 'existente', id: F }, lineas: [L_COL] })))
  check('misma ciudad: sin aviso de otra ciudad', !tieneAviso(mismaCiudad, 'otra_ciudad'))
  check('misma ciudad: sin conflicto', !tieneAviso(mismaCiudad, 'conflicto'))

  // Ajuste de Santa Marta movido a B mientras alguien vive en Santa Marta con Columna → sin efecto
  const K = u(311)
  const conResidente = [
    ...ejecutivasBase,
    { id: K, full_name: 'Karen Ortiz', email: null, status: 'active' as const, base_kam_id: Z_SM, user_id: null, lines: [L_COL] },
  ]
  const sinEfecto = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL] }), { ejecutivas: conResidente }))
  eq('el ajuste se mueve pero queda sin efecto', linea(sinEfecto, L_COL)?.ajustes_mover.map(a => a.queda_sin_efecto), [true])
  check('aviso de ajuste sin efecto que nombra a la residente', sinEfecto.avisos.some(a => a.codigo === 'ajuste_sin_efecto' && a.mensaje.includes('Karen Ortiz')))
  // Si quien recibe vive en esa zona, el ajuste rige aunque haya otra residente
  const recibeK = planear(datos(input({ destino: { tipo: 'existente', id: K }, lineas: [L_COL] }), { ejecutivas: conResidente }))
  eq('quien recibe vive en la zona del ajuste: rige', linea(recibeK, L_COL)?.ajustes_mover.map(a => a.queda_sin_efecto), [false])
  eq('quien ya lleva la línea no la suma otra vez', [linea(recibeK, L_COL)?.destino_ya_la_lleva, recibeK.destino.lineas_sumadas], [true, []])

  // Quien recibe sin zona base
  const sinZona = planear(datos(input({ destino: { tipo: 'existente', id: SIN_ZONA }, lineas: [L_COL] })))
  check('aviso: sin zona base', tieneAviso(sinZona, 'sin_zona_base'))
  eq('sin zona base, el ajuste queda sin efecto', linea(sinZona, L_COL)?.ajustes_mover.map(a => a.queda_sin_efecto), [true])

  // Quitar todas las líneas sin baja
  const todas = planear(datos(input({ destino: { tipo: 'existente', id: B } })))
  check('quitar todas sin baja vale', todas.ok, todas.errores)
  check('aviso: A se queda sin líneas', tieneAviso(todas, 'origen_sin_lineas'))
}

// ---------------------------------------------------------------------------------------------
console.log('10. Errores (lo mismo que rechaza la función SQL)')
{
  const noLaLleva = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_PO] })))
  check('línea que A no lleva', !noLaLleva.ok && tieneError(noLaLleva, 'linea_no_la_lleva'), noLaLleva.errores)
  eq('la línea que no lleva no entra al plan', noLaLleva.lineas.length, 0)
  const bajaParcial = planear(datos(input({ destino: { tipo: 'vacante' }, lineas: [L_RA], dar_de_baja: true, desactivar_usuario: true })))
  check('baja con solo unas líneas', tieneError(bajaParcial, 'baja_todas') && bajaParcial.errores.some(e => e.mensaje === MENSAJE_BAJA_TODAS))
  eq('con baja el plan igual lleva todas', bajaParcial.resumen.lineas, [L_RA, L_COL])
  const bajaCompleta = planear(datos(input({ destino: { tipo: 'vacante' }, lineas: [L_COL, L_RA], dar_de_baja: true, desactivar_usuario: true })))
  check('baja con la lista completa (otro orden) vale', bajaCompleta.ok, bajaCompleta.errores)
  const inactiva = planear(datos(input({ destino: { tipo: 'existente', id: B } }), { origen_id: INACTIVA }))
  check('quien entrega está inactiva', tieneError(inactiva, 'origen_inactivo'))
  const noExiste = planear(datos(input({ destino: { tipo: 'existente', id: B } }), { origen_id: u(999) }))
  check('quien entrega no existe', tieneError(noExiste, 'origen_no_existe') && noExiste.origen === null)
  const sinLineas = planear(datos(input({ destino: { tipo: 'existente', id: B } }), { origen_id: SIN_LINEAS }))
  check('quien entrega no lleva líneas', tieneError(sinLineas, 'sin_lineas'))
  const mismo = planear(datos(input({ destino: { tipo: 'existente', id: A } })))
  check('quien recibe es la misma persona', tieneError(mismo, 'destino_es_origen'))
  eq('con la misma persona no hay omitidos falsos', mismo.resumen.omitidos.length, 0)
  const destinoInactivo = planear(datos(input({ destino: { tipo: 'existente', id: E } })))
  check('quien recibe está inactiva', tieneError(destinoInactivo, 'destino_inactivo'))
  const destinoNoExiste = planear(datos(input({ destino: { tipo: 'existente', id: u(998) } })))
  check('quien recibe no existe', tieneError(destinoNoExiste, 'destino_no_existe'))
  const sinNombre = planear(datos(input({ destino: { tipo: 'nueva', full_name: ' L ', email: null }, dar_de_baja: true, desactivar_usuario: true })))
  check('persona nueva sin nombre', tieneError(sinNombre, 'nombre_requerido'))
  const emailRepetido = planear(datos(input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'ANA@vg.co' }, dar_de_baja: true, desactivar_usuario: true })))
  check('email de la persona nueva ya en uso (aunque sea de quien se va)', tieneError(emailRepetido, 'email_en_uso'))
  const emailDeInactiva = planear(datos(input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'elena@vg.co' } , dar_de_baja: true, desactivar_usuario: true })))
  check('email de una inactiva también está en uso (único en executives)', tieneError(emailDeInactiva, 'email_en_uso'))
  const usuarioSinBaja = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL], desactivar_usuario: true })))
  check('desactivar usuario sin baja', tieneError(usuarioSinBaja, 'usuario_sin_baja') && usuarioSinBaja.desactivar_usuario === false)
  eq('códigos de un pedido con varios errores', codigos(planear(datos(input({ destino: { tipo: 'nadie' }, dar_de_baja: true, desactivar_usuario: true, fecha: '2026-12-01' }))).errores), [
    'fecha_futura',
    'baja_sin_destino',
  ])
}

// ---------------------------------------------------------------------------------------------
console.log('11. Usuario y excepciones (decisiones 8 y 9)')
{
  const sigueActivo = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: false })))
  eq('baja sin desactivar el usuario', sigueActivo.desactivar_usuario, false)
  check('aviso: su usuario sigue activo', tieneAviso(sigueActivo, 'usuario_sigue_activo'))
  const sinUsuario = planear(datos(input({ destino: { tipo: 'existente', id: B } , dar_de_baja: true, desactivar_usuario: true }), { origen_id: C }))
  eq('sin usuario no hay nada que desactivar', [sinUsuario.desactivar_usuario, tieneAviso(sinUsuario, 'usuario_se_desactiva')], [false, false])
  const bajaPedida = input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true })
  for (const [rol, titulo] of [
    ['admin', 'Administrador'],
    ['line_leader', 'Líder de negocio'],
    ['commercial_director', 'Director comercial'],
  ]) {
    const conRol = planear(datos(bajaPedida, { usuarios: [{ id: U_A, role: rol, active: true }] }))
    check(
      `usuario de A con rol ${rol}: no se desactiva y se avisa con el rol («${titulo}»)`,
      conRol.ok &&
        conRol.desactivar_usuario === false &&
        conRol.avisos.some(a => a.codigo === 'usuario_no_se_desactiva' && a.nivel === 'atencion' && a.mensaje.includes(`«${titulo}»`)),
      conRol.avisos
    )
  }
  const propio = planear(datos(bajaPedida, { solicitante_id: U_A }))
  check(
    'quien hace el traspaso es el usuario de A: no se desactiva a sí mismo',
    propio.desactivar_usuario === false && propio.avisos.some(a => a.codigo === 'usuario_no_se_desactiva' && a.mensaje.includes('es el tuyo')),
    propio.avisos
  )
  const yaInactivo = planear(datos(bajaPedida, { usuarios: [{ id: U_A, role: 'sales_manager', active: false }] }))
  check(
    'usuario ya inactivo: nada que desactivar (aviso informativo)',
    yaInactivo.desactivar_usuario === false && yaInactivo.avisos.some(a => a.codigo === 'usuario_no_se_desactiva' && a.nivel === 'info'),
    yaInactivo.avisos
  )
  const sinFilaUsuario = planear(datos(bajaPedida, { usuarios: [] }))
  eq('sin la fila del usuario no se desactiva', sinFilaUsuario.desactivar_usuario, false)
  const rolBasico = planear(datos(bajaPedida, { usuarios: [{ id: U_A, role: 'user', active: true }] }))
  eq('rol básico (user): se desactiva', [rolBasico.desactivar_usuario, tieneAviso(rolBasico, 'usuario_se_desactiva')], [true, true])

  const copiaNueva = planear(datos(input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: null }, dar_de_baja: true, desactivar_usuario: true, copiar_excepciones: true })))
  eq('se copian solo las vigentes en la fecha (perfil + 1 meta)', copiaNueva.excepciones_a_copiar.map(e => e.id), [u(802), u(801)])
  eq('resumen: 2 excepciones copiadas', copiaNueva.resumen.excepciones_copiadas, 2)
  check('a una persona nueva no le reemplaza nada', !tieneAviso(copiaNueva, 'excepciones_reemplazan'))
  const copiaB = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL], copiar_excepciones: true })))
  eq('a B: el perfil de A reemplaza el suyo', copiaB.excepciones_a_copiar.map(e => [e.id, e.reemplaza_la_de_destino]), [
    [u(802), false],
    [u(801), true],
  ])
  check('aviso: B ya tiene excepciones propias', tieneAviso(copiaB, 'excepciones_reemplazan'))
  const fechaPasada = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true, copiar_excepciones: true, fecha: '2026-09-15' })))
  eq('vigentes en una fecha pasada: la meta institucional de entonces', fechaPasada.excepciones_a_copiar.map(e => e.id), [u(803)])
  const sinFilas = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true, copiar_excepciones: true }), { excepciones: undefined }))
  eq('sin filas de excepciones: 0', sinFilas.resumen.excepciones_copiadas, 0)
  const sinAnexo = planear(datos(input({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: true, guardar_anexo_final: false })))
  eq('sin guardar anexo final', sinAnexo.lineas.map(l => [l.anexo_final.tiene_territorio, l.anexo_final.se_guarda, l.anexo_final.etiqueta]), [
    [true, false, null],
    [true, false, null],
  ])
  check('sin aviso de anexo final', !tieneAviso(sinAnexo, 'anexo_final'))
  const sinTerritorio = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_RA] }), { cobertura: coberturaBase.filter(c => c.line_id !== L_RA) }))
  eq('sin territorio en la línea: no hay anexo final', linea(sinTerritorio, L_RA)?.anexo_final, { tiene_territorio: false, se_guarda: false, etiqueta: null })
  // Nombre del territorio: no se pisa el de quien recibe
  const recibeC = planear(datos(input({ destino: { tipo: 'existente', id: C }, lineas: [L_COL] }), { nombres: [...nombresBase, { line_id: L_COL, executive_id: A, name: 'Costa' }] }))
  eq('quien recibe ya tiene nombre: no se copia', linea(recibeC, L_COL)?.nombre_territorio, { origen: 'Costa', destino_actual: 'Capital', se_copia: false })
}

// ---------------------------------------------------------------------------------------------
console.log('12. Parámetro de la función SQL y lectura de su resumen')
{
  const entrada = input({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'laura@vg.co' }, dar_de_baja: true, desactivar_usuario: true, motivo: 'Renuncia' })
  eq('p para ejecutivas_traspasar (fecha resuelta, sin guardar_anexo_final)', parametroTraspaso(A, entrada, HOY), {
    origen_id: A,
    destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'laura@vg.co' },
    lineas: null,
    fecha: HOY,
    dar_de_baja: true,
    desactivar_usuario: true,
    copiar_excepciones: false,
    motivo: 'Renuncia',
  })
  eq('p con destino existente y líneas', parametroTraspaso(A, input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL], fecha: '2026-10-01' }), HOY).destino, { tipo: 'existente', id: B })
  eq('p sin baja nunca desactiva el usuario', parametroTraspaso(A, input({ destino: { tipo: 'nadie' }, desactivar_usuario: true }), HOY).desactivar_usuario, false)
  const resumen = leerResumenTraspaso({
    traspaso_id: u(1001),
    destino_id: B,
    lineas: [L_COL],
    ajustes_movidos: 1,
    ajustes_desactivados: '0',
    nombres_copiados: 0,
    visitantes_movidos: 2,
    visitantes_terminados: 0,
    omitidos: [{ medico_id: M3, razon: 'ya_lo_visita' }, { razon: 'sin_medico' }],
    excepciones_copiadas: 0,
  })
  eq('lee el resumen de la función', resumen, {
    traspaso_id: u(1001),
    destino_id: B,
    lineas: [L_COL],
    ajustes_movidos: 1,
    ajustes_desactivados: 0,
    nombres_copiados: 0,
    visitantes_movidos: 2,
    visitantes_terminados: 0,
    omitidos: [{ medico_id: M3, razon: 'ya_lo_visita' }],
    excepciones_copiadas: 0,
  })
  eq('sin traspaso_id no es un resumen', leerResumenTraspaso({ lineas: [] }), null)
  eq('null no es un resumen', leerResumenTraspaso(null), null)
  const plan = planear(datos(input({ destino: { tipo: 'existente', id: B }, lineas: [L_COL] })))
  const { traspaso_id: _sinId, ...previsto } = resumen ?? ({} as NonNullable<typeof resumen>)
  void _sinId
  eq('la vista previa tiene la misma forma que el resumen de la función', Object.keys(plan.resumen).sort(), Object.keys(previsto).sort())
}

// ---------------------------------------------------------------------------------------------
console.log('12b. Lectura de respuestas en la interfaz (traspaso-ui)')
{
  const respuesta = leerRespuestaTraspaso({
    resumen: {
      traspaso_id: u(1101), destino_id: B, lineas: [L_COL], ajustes_movidos: 0, ajustes_desactivados: 0, nombres_copiados: 0,
      visitantes_movidos: 0, visitantes_terminados: 0, omitidos: [], excepciones_copiadas: 0,
    },
    anexos_finales: [
      { line_id: L_COL, etiqueta: 'Final 2026-10-12 (traspaso)', snapshot_id: null, error: null, ya_existia: true },
      { line_id: L_RA, etiqueta: 'Final 2026-10-12 (traspaso)', snapshot_id: u(1102), error: null },
    ],
    cobertura_recalculada: true,
  })
  eq(
    'una versión del anexo que ya existía (409) se lee como guardada, no como error',
    respuesta?.anexos_finales.map(a => [a.ya_existia, a.error, a.snapshot_id]),
    [
      [true, null, null],
      [false, null, u(1102)],
    ]
  )
  const aviso = 'Se guardó, pero no se pudo recalcular la cobertura. Usa "Recalcular cobertura" en la cobertura de la línea.'
  eq('PATCH o DELETE con cobertura sin recalcular: la interfaz muestra el aviso', avisoCoberturaDe({ executive: { id: A }, cobertura_recalculada: false, aviso }), aviso)
  check('sin texto de aviso igual avisa', (avisoCoberturaDe({ executive: { id: A }, cobertura_recalculada: false }) ?? '').includes('Recalcular'))
  eq('recalculada: sin aviso', avisoCoberturaDe({ executive: { id: A }, cobertura_recalculada: true }), null)
  eq('cambio que no tocaba la cobertura: sin aviso', avisoCoberturaDe({ executive: { id: A } }), null)
  eq('respuesta rara: sin aviso', avisoCoberturaDe(null), null)
}

// ---------------------------------------------------------------------------------------------
console.log('13. Esquema del traspaso (zod)')
{
  const completo = valido(
    'cuerpo completo',
    traspasoSchema.safeParse({
      destino: { tipo: 'existente', id: B.toUpperCase() },
      lineas: [L_COL],
      fecha: '2026-10-02',
      dar_de_baja: false,
      copiar_excepciones: true,
      guardar_anexo_final: false,
      motivo: '  Reparto de líneas  ',
      origen_id: u(999),
      status: 'inactive',
    })
  )
  eq('normaliza y descarta lo que no es del cuerpo', completo, {
    destino: { tipo: 'existente', id: B },
    lineas: [L_COL],
    fecha: '2026-10-02',
    dar_de_baja: false,
    desactivar_usuario: false,
    copiar_excepciones: true,
    guardar_anexo_final: false,
    motivo: 'Reparto de líneas',
  })
  const minimo = valido('cuerpo mínimo (vacante)', traspasoSchema.safeParse({ destino: { tipo: 'vacante' } }))
  eq('por defecto: todas las líneas, hoy, sin baja, no copiar, guardar anexo', minimo, {
    destino: { tipo: 'vacante' },
    lineas: null,
    fecha: null,
    dar_de_baja: false,
    desactivar_usuario: false,
    copiar_excepciones: false,
    guardar_anexo_final: true,
    motivo: null,
  })
  eq('con baja, desactivar el usuario por defecto', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, dar_de_baja: true }).data?.desactivar_usuario, true)
  eq('con baja se puede no desactivar', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, dar_de_baja: true, desactivar_usuario: false }).data?.desactivar_usuario, false)
  eq('lineas null = todas', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, lineas: null }).data?.lineas, null)
  eq('fecha "" = hoy (null)', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, fecha: '' }).data?.fecha, null)
  eq('motivo de solo espacios = null', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, motivo: '   ' }).data?.motivo, null)
  const nueva = valido(
    'persona nueva',
    traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: '  Laura   Pérez ', email: ' Laura@VG.co ' }, dar_de_baja: true })
  )
  eq('nombre sin espacios de más y email en minúsculas', nueva?.destino, { tipo: 'nueva', full_name: 'Laura Pérez', email: 'laura@vg.co' })
  eq('persona nueva sin email', traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: '' }, dar_de_baja: true }).data?.destino, {
    tipo: 'nueva',
    full_name: 'Laura Pérez',
    email: null,
  })
  eq('nombre de 120 caracteres vale', traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'x'.repeat(120) } }).success, true)
  invalido('nombre de 121 caracteres', traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'x'.repeat(121) } }), 'no puede superar 120')
  invalido('nombre de 1 letra', traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: ' L ' } }), 'al menos 2 letras')
  invalido('persona nueva sin nombre', traspasoSchema.safeParse({ destino: { tipo: 'nueva' } }), 'Escribe el nombre de la persona nueva')
  invalido('email no válido', traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: 'laura@' } }), 'Email no válido')
  // Mismo tope que la función SQL (length(email) > 254 → 22023): la vista previa no deja pasar lo que ella rechaza
  const email254 = `${'a'.repeat(254 - '@vg.co'.length)}@vg.co`
  check('email de 254 caracteres vale (tope de la 0820)', email254.length === 254 && traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: email254 }, dar_de_baja: true }).success)
  check('email de 255 caracteres no vale', !traspasoSchema.safeParse({ destino: { tipo: 'nueva', full_name: 'Laura Pérez', email: `a${email254}` }, dar_de_baja: true }).success)
  invalido('destino de tipo desconocido', traspasoSchema.safeParse({ destino: { tipo: 'jefe' } }), 'Elige quién recibe')
  invalido('sin destino', traspasoSchema.safeParse({ lineas: null }), 'Elige quién recibe')
  invalido('destino que no es objeto', destinoSchema.safeParse('vacante'), 'Elige quién recibe')
  invalido('persona existente sin id válido', traspasoSchema.safeParse({ destino: { tipo: 'existente', id: '123' } }), 'Elige la persona que recibe')
  invalido('lista de líneas vacía', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, lineas: [] }), 'Elige al menos una línea')
  invalido('líneas repetidas (sin importar mayúsculas)', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, lineas: [L_COL, L_COL.toUpperCase()] }), 'repetidas')
  invalido('línea no válida', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, lineas: ['columna'] }), 'Línea no válida')
  invalido('líneas que no son lista', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, lineas: L_COL }), 'deben ser una lista')
  invalido('fecha inexistente', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, fecha: '2026-02-30' }), 'AAAA-MM-DD')
  invalido('fecha con otro formato', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, fecha: '12/10/2026' }), 'AAAA-MM-DD')
  invalido('fecha que no es texto', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, fecha: 20261012 }), 'AAAA-MM-DD')
  eq('motivo de 300 caracteres vale', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, motivo: 'm'.repeat(300) }).success, true)
  invalido('motivo de 301 caracteres', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, motivo: 'm'.repeat(301) }), 'no puede superar 300')
  invalido('baja con "nadie" (400)', traspasoSchema.safeParse({ destino: { tipo: 'nadie' }, dar_de_baja: true }), MENSAJE_BAJA_SIN_DESTINO)
  eq('"nadie" sin baja vale', traspasoSchema.safeParse({ destino: { tipo: 'nadie' }, lineas: [L_COL] }).success, true)
  invalido('desactivar usuario sin baja', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, desactivar_usuario: true }), MENSAJE_USUARIO_SIN_BAJA)
  invalido('booleano como texto', traspasoSchema.safeParse({ destino: { tipo: 'vacante' }, dar_de_baja: 'si' }), 'verdadero o falso')
  invalido('cuerpo que no es objeto', traspasoSchema.safeParse('hola'), 'se esperaba un objeto JSON')
  invalido('cuerpo vacío', traspasoSchema.safeParse(undefined), 'se esperaba un objeto JSON')
}

// ---------------------------------------------------------------------------------------------
console.log('14. Esquema de contratar (zod)')
{
  const contratada = valido(
    'contratar con todo',
    contratarSchema.safeParse({ full_name: ' María  Celis ', email: 'Maria@VG.co', fecha_ingreso: '2026-10-12', status: 'active', user_id: u(1) })
  )
  eq('normaliza y descarta lo demás', contratada, { full_name: 'María Celis', email: 'maria@vg.co', fecha_ingreso: '2026-10-12' })
  eq('sin email ni fecha', contratarSchema.safeParse({ full_name: 'María Celis' }).data, { full_name: 'María Celis', email: null, fecha_ingreso: null })
  eq('email null', contratarSchema.safeParse({ full_name: 'María Celis', email: null }).data?.email, null)
  invalido('sin nombre', contratarSchema.safeParse({ email: 'maria@vg.co' }), 'Escribe el nombre de la persona contratada')
  invalido('nombre de 1 letra', contratarSchema.safeParse({ full_name: 'M' }), 'al menos 2 letras')
  invalido('nombre de 121 caracteres', contratarSchema.safeParse({ full_name: 'm'.repeat(121) }), 'no puede superar 120')
  invalido('email no válido', contratarSchema.safeParse({ full_name: 'María Celis', email: 'maria' }), 'Email no válido')
  invalido('fecha de ingreso inexistente', contratarSchema.safeParse({ full_name: 'María Celis', fecha_ingreso: '2026-04-31' }), 'Fecha de ingreso no válida')
  invalido('cuerpo que no es objeto', contratarSchema.safeParse(['María']), 'se esperaba un objeto JSON')
}

// ---------------------------------------------------------------------------------------------
console.log('15. Permiso executives:transfer (decisión 11)')
{
  const roles = Object.keys(rolePermissions) as Role[]
  const conPermiso = roles.filter(rol => hasPermission(rol, 'executives:transfer')).sort()
  eq('solo admin y commercial_director', conPermiso, ['admin', 'commercial_director'])
  check('admin lo tiene en su lista explícita', rolePermissions.admin.includes('executives:transfer'))
  for (const rol of ['data_manager', 'line_leader', 'viewer', 'sales_manager', 'hr', 'user', 'contract_manager'] as Role[]) {
    check(`${rol} no puede traspasar (403)`, !hasPermission(rol, 'executives:transfer'))
  }
  check('commercial_director también edita equipo, cobertura y visitantes', ['executives:edit', 'coverage:edit', 'visitantes:manage'].every(p => hasPermission('commercial_director', p as never)))
  check('sin rol no hay permiso', !hasPermission(undefined, 'executives:transfer'))
}

// ---------------------------------------------------------------------------------------------
console.log('16. Textos visibles')
check('se revisaron mensajes', TODOS_LOS_MENSAJES.length > 20, TODOS_LOS_MENSAJES.length)
check('ningún mensaje dice "KAM"', TODOS_LOS_MENSAJES.every(m => !/\bkam\b/i.test(m)), TODOS_LOS_MENSAJES.filter(m => /\bkam\b/i.test(m)))
check('ningún mensaje dice "panel"', TODOS_LOS_MENSAJES.every(m => !/panel/i.test(m)), TODOS_LOS_MENSAJES.filter(m => /panel/i.test(m)))
check('ningún mensaje vacío', TODOS_LOS_MENSAJES.every(m => m.trim().length > 0))

console.log(`\n${passed} pruebas ok, ${failed} fallas`)
if (failed > 0) process.exit(1)
