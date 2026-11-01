/**
 * Empresas y papeles (capa 1): pruebas puras de lib/empresas-reglas.ts. SIN red ni Supabase.
 *
 * Reglas: lo que una persona puede hacer es la SUMA de sus papeles en la empresa activa; la empresa activa sale de la
 * columna, del claim o de la primera por código; una línea tiene a lo sumo una líder nacional o varias por Zonas sin
 * solaparse; la semilla en TypeScript espeja la semilla SQL.
 *
 * Uso (desde web/): npx tsx scripts/empresas-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import {
  EMPRESA_MEDIX_ID,
  EMPRESA_VG_ID,
  MENSAJE_LIDER_NACIONAL_UNICO,
  MENSAJE_LIDER_ZONAS_SOLAPADAS,
  ORDEN_PAPELES,
  cacheLiderDe,
  cacheRolDe,
  confirmacionDeQuitarEjecutivo,
  empresaActivaDe,
  papelMasAlto,
  papelesDeSemilla,
  tienePermiso,
  tienePermisoDe,
  tituloDePapeles,
  validarLiderDeLinea,
  type Empresa,
} from '../lib/empresas-reglas'
import { getRoleTitle, hasPermission, rolePermissions, type Permission, type Role } from '../lib/permissions'

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

const p = (papel: Role) => ({ papel })

// ---------------------------------------------------------------------------------------------
console.log('\n1. Reglas puras')

console.log('\n1.1 papelMasAlto')
eq('lista vacía → user', papelMasAlto([]), 'user')
eq('líder de negocio gana al ejecutivo comercial', papelMasAlto([p('sales_manager'), p('line_leader')]), 'line_leader')
eq('admin al final gana', papelMasAlto([p('sales_manager'), p('line_leader'), p('admin')]), 'admin')
eq('admin al principio gana', papelMasAlto([p('admin'), p('sales_manager')]), 'admin')
eq('admin en medio gana', papelMasAlto([p('line_leader'), p('admin'), p('commercial_director')]), 'admin')
eq('el orden de la lista no cambia el resultado', papelMasAlto([p('line_leader'), p('sales_manager')]), 'line_leader')
check('ORDEN_PAPELES empieza por admin', ORDEN_PAPELES[0] === 'admin', ORDEN_PAPELES)
check('ORDEN_PAPELES no repite papeles', new Set(ORDEN_PAPELES).size === ORDEN_PAPELES.length)

console.log('\n1.2 tienePermiso (suma de papeles)')
check('líder de negocio NO tiene executives:lines', tienePermiso([p('line_leader')], 'executives:lines') === false)
check('líder de negocio SÍ tiene campo:app', tienePermiso([p('line_leader')], 'campo:app') === true)
check(
  'líder + ejecutivo comercial suman visits:report',
  tienePermiso([p('line_leader'), p('sales_manager')], 'visits:report') === true
)
check('sin papeles no hay map:view', tienePermiso([], 'map:view') === false)
check('admin lo puede todo (campo:app)', tienePermiso([p('admin')], 'campo:app') === true)
check('un papel que no lo trae no lo da', tienePermiso([p('viewer')], 'executives:lines') === false)

console.log('\n1.3 empresaActivaDe')
const vg: Empresa = { id: EMPRESA_VG_ID, codigo: 'vg', nombre: 'VG Medical', nombre_corto: 'VG', activa: true }
const medix: Empresa = { id: EMPRESA_MEDIX_ID, codigo: 'medix', nombre: 'Medix', nombre_corto: 'Medix', activa: true }
const ajena: Empresa = { id: 'a0000000-0000-4000-8000-0000000000ff', codigo: 'zz', nombre: 'Ajena', nombre_corto: 'Ajena', activa: true }
eq('sin columna ni claim y solo VG → VG', empresaActivaDe({ empresaActivaId: null, claimEmp: null, empresas: [vg] }), vg)
eq(
  'sin columna ni claim y VG + Medix → VG',
  empresaActivaDe({ empresaActivaId: null, claimEmp: null, empresas: [vg, medix] }),
  vg
)
eq(
  'la primera es por código aunque lleguen desordenadas',
  empresaActivaDe({ empresaActivaId: null, claimEmp: null, empresas: [medix, vg] }),
  vg
)
eq(
  'la columna manda sobre el claim',
  empresaActivaDe({ empresaActivaId: EMPRESA_MEDIX_ID, claimEmp: EMPRESA_VG_ID, empresas: [vg, medix] }),
  medix
)
eq(
  'columna null y claim de Medix → Medix',
  empresaActivaDe({ empresaActivaId: null, claimEmp: EMPRESA_MEDIX_ID, empresas: [vg, medix] }),
  medix
)
eq(
  'claim de una empresa que no está en la lista → la primera',
  empresaActivaDe({ empresaActivaId: null, claimEmp: ajena.id, empresas: [vg, medix] }),
  vg
)
eq(
  'columna de una empresa que no está en la lista cae al claim',
  empresaActivaDe({ empresaActivaId: ajena.id, claimEmp: EMPRESA_MEDIX_ID, empresas: [vg, medix] }),
  medix
)
eq(
  'sin VG en la lista, la primera es la menor por código',
  empresaActivaDe({ empresaActivaId: null, claimEmp: null, empresas: [ajena, medix] }),
  medix
)
eq('lista vacía → null', empresaActivaDe({ empresaActivaId: EMPRESA_VG_ID, claimEmp: EMPRESA_VG_ID, empresas: [] }), null)
{
  const entrada = [medix, vg]
  empresaActivaDe({ empresaActivaId: null, claimEmp: null, empresas: entrada })
  eq('no modifica la lista de entrada', entrada.map(e => e.codigo), ['medix', 'vg'])
}

console.log('\n1.4 validarLiderDeLinea')
eq('sin otras líderes y nacional → ok', validarLiderDeLinea([], { user_id: 'u1', kam_ids: [] }), { ok: true })
eq(
  'ya hay una nacional y entra otra nacional',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: [] }], { user_id: 'u2', kam_ids: [] }),
  { ok: false, error: MENSAJE_LIDER_NACIONAL_UNICO }
)
eq(
  'ya hay una nacional y entra una por Zonas',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: [] }], { user_id: 'u2', kam_ids: ['A'] }),
  { ok: false, error: MENSAJE_LIDER_NACIONAL_UNICO }
)
eq(
  'Zonas distintas → ok',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: ['A'] }], { user_id: 'u2', kam_ids: ['B'] }),
  { ok: true }
)
eq(
  'Zona repetida → solapadas',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: ['A', 'B'] }], { user_id: 'u2', kam_ids: ['B'] }),
  { ok: false, error: MENSAJE_LIDER_ZONAS_SOLAPADAS }
)
eq(
  'no cabe una nacional junto a una por Zonas',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: ['A'] }], { user_id: 'u2', kam_ids: [] }),
  { ok: false, error: MENSAJE_LIDER_NACIONAL_UNICO }
)
eq(
  'las filas del mismo usuario no cuentan (nacional)',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: [] }], { user_id: 'u1', kam_ids: [] }),
  { ok: true }
)
eq(
  'las filas del mismo usuario no cuentan (Zonas)',
  validarLiderDeLinea([{ user_id: 'u1', kam_ids: ['A'] }], { user_id: 'u1', kam_ids: ['A', 'B'] }),
  { ok: true }
)
check('los tres mensajes están en español y no dicen "Vacante" ni "KAM"',
  [MENSAJE_LIDER_NACIONAL_UNICO, MENSAJE_LIDER_ZONAS_SOLAPADAS].every(m => !/vacante|kam/i.test(m))
)

console.log('\n1.5 cacheRolDe y cacheLiderDe')
eq('cacheRolDe([]) → user', cacheRolDe([]), 'user')
eq('cacheRolDe con líder y ejecutivo → líder', cacheRolDe([p('sales_manager'), p('line_leader')]), 'line_leader')
eq('cacheLiderDe con la nacional → su usuario', cacheLiderDe([{ user_id: 'u1', kam_ids: [] }]), 'u1')
eq('cacheLiderDe solo por Zonas → null', cacheLiderDe([{ user_id: 'u1', kam_ids: ['A'] }, { user_id: 'u2', kam_ids: ['B'] }]), null)
eq('cacheLiderDe sin nadie → null', cacheLiderDe([]), null)
eq(
  'cacheLiderDe con nacional y por Zonas → la nacional',
  cacheLiderDe([{ user_id: 'u1', kam_ids: ['A'] }, { user_id: 'u2', kam_ids: [] }]),
  'u2'
)

console.log('\n1.6 papelesDeSemilla (espejo de la semilla SQL)')
const user = (id: string, role: Role, active = true) => ({ id, role, active })
const filasDe = (r: ReturnType<typeof papelesDeSemilla>) => (r.ok ? r.filas : [])
{
  const r = papelesDeSemilla([user('u1', 'sales_manager')], [])
  eq('sales_manager activo → 1 fila en VG', filasDe(r), [{ user_id: 'u1', empresa_id: EMPRESA_VG_ID, papel: 'sales_manager', line_id: null }])
}
{
  const r = papelesDeSemilla([user('u1', 'admin')], [])
  const empresas = filasDe(r).map(f => f.empresa_id).sort()
  eq('admin → 2 filas (VG y Medix)', empresas, [EMPRESA_VG_ID, EMPRESA_MEDIX_ID].sort())
  check('las 2 filas del admin son admin', filasDe(r).every(f => f.papel === 'admin' && f.line_id === null))
}
{
  const r = papelesDeSemilla([user('u1', 'commercial_director')], [])
  eq('commercial_director → 2 filas', filasDe(r).length, 2)
}
{
  const r = papelesDeSemilla([user('u1', 'sales_manager', false), user('u2', 'admin', false)], [])
  check('usuarios inactivos → ok y 0 filas', r.ok && r.filas.length === 0, r)
}
{
  const r = papelesDeSemilla([user('u1', 'line_leader')], [{ id: 'L1', leader_user_id: 'u1' }, { id: 'L2', leader_user_id: 'u1' }])
  const filas = filasDe(r)
  eq('line_leader con dos líneas → 2 filas', filas.length, 2)
  check('las 2 filas son line_leader en VG, con su línea', filas.every(f => f.papel === 'line_leader' && f.empresa_id === EMPRESA_VG_ID && f.line_id !== null))
  eq('con las líneas L1 y L2', filas.map(f => f.line_id).sort(), ['L1', 'L2'])
  check('ninguna fila line_leader sin línea', !filas.some(f => f.papel === 'line_leader' && f.line_id === null))
}
{
  const r = papelesDeSemilla([user('u1', 'line_leader')], [])
  eq('line_leader activo sin línea → error con el conteo', r, { ok: false, error: 'Hay 1 líderes de negocio activos sin línea' })
}
{
  const r = papelesDeSemilla([user('u1', 'line_leader'), user('u2', 'line_leader'), user('u3', 'line_leader')], [{ id: 'L1', leader_user_id: 'u1' }])
  eq('el conteo es de líderes sin línea (2)', r, { ok: false, error: 'Hay 2 líderes de negocio activos sin línea' })
}
{
  const r = papelesDeSemilla([user('u1', 'line_leader', false)], [])
  check('line_leader inactivo sin línea no estorba', r.ok && r.filas.length === 0, r)
}
{
  const r = papelesDeSemilla([user('u1', 'commercial_director')], [{ id: 'L1', leader_user_id: 'u1' }])
  const filas = filasDe(r)
  eq('director que además lidera una línea → 3 filas', filas.length, 3)
  eq('2 del director y 1 de líder', [filas.filter(f => f.papel === 'commercial_director').length, filas.filter(f => f.papel === 'line_leader').length], [2, 1])
}
{
  const r = papelesDeSemilla([user('u1', 'sales_manager', false)], [{ id: 'L1', leader_user_id: 'u1' }])
  check('línea cuyo líder está inactivo no produce fila', r.ok && r.filas.length === 0, r)
}
{
  const r = papelesDeSemilla([], [{ id: 'L1', leader_user_id: 'fantasma' }, { id: 'L2', leader_user_id: null }])
  check('línea cuyo líder no existe, o sin líder, no produce fila', r.ok && r.filas.length === 0, r)
}

console.log('\n1.7 tituloDePapeles')
eq('lista vacía → texto vacío', tituloDePapeles([]), '')
eq(
  'líder y ejecutivo comercial, de mayor a menor',
  tituloDePapeles([p('sales_manager'), p('line_leader')]),
  `${getRoleTitle('line_leader')} · ${getRoleTitle('sales_manager')}`
)
eq('el título de la líder es Líder de negocio', getRoleTitle('line_leader'), 'Líder de negocio')
eq('sin repetir', tituloDePapeles([p('line_leader'), p('line_leader')]), 'Líder de negocio')
eq('un solo papel', tituloDePapeles([p('admin')]), 'Administrador')

console.log('\n1.8 Ida y vuelta: semilla → cacheRolDe = el role de hoy')
{
  // Filas de ejemplo como las de producción: admin, director, líder con dos líneas, ejecutiva, viewer, hr, un inactivo
  // y una ejecutiva (sales_manager) que figura como leader_user_id de una línea (el caso documentado)
  const usuarios = [
    user('admin1', 'admin'),
    user('dir1', 'commercial_director'),
    user('lider1', 'line_leader'),
    user('ejec1', 'sales_manager'),
    user('ver1', 'viewer'),
    user('hr1', 'hr'),
    user('inact1', 'contract_manager', false),
    user('ejecLider', 'sales_manager'),
  ]
  const lineas = [
    { id: 'L1', leader_user_id: 'lider1' },
    { id: 'L2', leader_user_id: 'lider1' },
    { id: 'L3', leader_user_id: 'ejecLider' },
    { id: 'L4', leader_user_id: null },
  ]
  const r = papelesDeSemilla(usuarios, lineas)
  check('la semilla de ejemplo se puede sembrar', r.ok, r)
  const filas = filasDe(r)
  const cacheDe = (id: string) => cacheRolDe(filas.filter(f => f.user_id === id && f.empresa_id === EMPRESA_VG_ID))
  for (const u of usuarios.filter(x => x.active && x.id !== 'ejecLider')) {
    eq(`${u.id} (${u.role}): cacheRolDe de sus filas de VG = su role de hoy`, cacheDe(u.id), u.role)
  }
  eq('el inactivo no recibe filas (su role se queda como está)', filas.filter(f => f.user_id === 'inact1').length, 0)
  // Caso documentado: quien lidera una línea sin ser line_leader recibe ADEMÁS line_leader de esa línea, y como
  // line_leader está por encima de sales_manager su caché sube de 'sales_manager' a 'line_leader'
  eq(
    'ejecLider recibe sales_manager y line_leader (L3) en VG',
    filas.filter(f => f.user_id === 'ejecLider').map(f => `${f.papel}|${f.line_id ?? ''}`).sort(),
    ['line_leader|L3', 'sales_manager|']
  )
  eq('ejecLider: su caché SUBE a line_leader (más alto que sales_manager)', cacheDe('ejecLider'), 'line_leader')
  check(
    'line_leader está por encima de sales_manager en ORDEN_PAPELES',
    ORDEN_PAPELES.indexOf('line_leader') < ORDEN_PAPELES.indexOf('sales_manager')
  )
  // El director que lidera una línea recibe también line_leader, pero su caché no cambia (director es más alto)
  const conDirLider = papelesDeSemilla(usuarios, [...lineas, { id: 'L5', leader_user_id: 'dir1' }])
  eq(
    'director que lidera una línea: su caché sigue siendo commercial_director',
    cacheRolDe(filasDe(conDirLider).filter(f => f.user_id === 'dir1' && f.empresa_id === EMPRESA_VG_ID)),
    'commercial_director'
  )
}

console.log('\n1.9 tienePermisoDe = hasPermission (un papel) y suma (lista)')
{
  const roles = Object.keys(rolePermissions) as Role[]
  const permisos = Array.from(new Set(Object.values(rolePermissions).flat())) as Permission[]
  let iguales = 0
  const distintos: string[] = []
  for (const r of roles) {
    for (const permiso of permisos) {
      const esperado = hasPermission(r, permiso)
      if (tienePermisoDe(r, permiso) !== esperado) distintos.push(`${r}:${permiso} (rol)`)
      else iguales++
      if (tienePermisoDe([{ papel: r }], permiso) !== esperado) distintos.push(`${r}:${permiso} (lista)`)
      else iguales++
    }
  }
  check(`para cada rol y permiso, rol y [{papel: rol}] deciden como hasPermission (${iguales} casos)`, distintos.length === 0, distintos.slice(0, 5))
  check('[] no concede nada (map:view)', tienePermisoDe([], 'map:view') === false)
  check('[] no concede ningún permiso', permisos.every(pm => tienePermisoDe([], pm) === false))
  check('undefined → como hasPermission(undefined)', tienePermisoDe(undefined, 'map:view') === hasPermission(undefined, 'map:view'))
}

console.log('\n1.10 confirmacionDeQuitarEjecutivo (texto de /users al quitar Ejecutivo Comercial)')
eq('líneas y visitantes', confirmacionDeQuitarEjecutivo({ lineas: 2, visitantes: 3 }), 'Se pierden 2 líneas en Zonas y terminan 3 visitantes')
eq('solo líneas', confirmacionDeQuitarEjecutivo({ lineas: 1, visitantes: 0 }), 'Se pierden 1 líneas en Zonas y terminan 0 visitantes')
eq('0 y 0 → sin confirmación (null)', confirmacionDeQuitarEjecutivo({ lineas: 0, visitantes: 0 }), null)
eq('las asignaciones no cuentan para el texto', confirmacionDeQuitarEjecutivo({ lineas: 0, visitantes: 0, asignaciones: 4 } as { lineas: number; visitantes: number }), null)
eq('sin afectados → null', confirmacionDeQuitarEjecutivo(undefined), null)
check('el texto no dice "Vacante" ni "KAM"', !/vacante|kam/i.test(confirmacionDeQuitarEjecutivo({ lineas: 1, visitantes: 1 }) ?? ''))

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
