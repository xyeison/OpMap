/**
 * Fase 6 · F1 Terceros: pruebas puras de lib/terceros.ts, lib/terceros-schemas.ts y de los permisos de
 * terceros en lib/permissions.ts. SIN red ni Supabase.
 *
 * Uso (desde web/): npx tsx scripts/terceros-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import type { z } from 'zod'
import {
  CLASES_CUENTA,
  ESPECIALIDADES,
  MODALIDADES_FACTURACION,
  ROLES_CONTACTO,
  ROLES_MEDICO_SEDE,
  SUBTIPOS_SEMILLA,
  TIPOS_DOC_MEDICO,
  TIPOS_ID_CUENTA,
  VALORES_CLASE_CUENTA,
  VALORES_ESPECIALIDAD,
  VALORES_ROL_CONTACTO,
  VALORES_TIPO_DOC_MEDICO,
  VALORES_TIPO_ID_CUENTA,
  avisoVisitante,
  errorModalidad,
  formaDeNit,
  etiquetaEspecialidad,
  etiquetaRolContacto,
  identificacionCuentaProtegida,
  leerPagina,
  nitsEquivalentes,
  nombresParecidos,
  normalizarIdentificacion,
  normalizarNombre,
  numerosEquivalentesANit,
  ocultarIdentificacionCuenta,
  rolDesdeCargo,
  sinDocumento,
  subtipoSugerido,
  traeDigitoVerificacion,
  validarIdentificacion,
  validarIdentificacionCuenta,
} from '../lib/terceros'
import { dvNit } from '../lib/secop'
import {
  busquedaCuentasSchema,
  busquedaMedicosSchema,
  contactoCreateSchema,
  contactoUpdateSchema,
  cuentaCreateSchema,
  cuentaUpdateSchema,
  esFechaValida,
  medicoCreateSchema,
  medicoUpdateSchema,
  medicoVerificarSchema,
  sedeCreateSchema,
  sedeUpdateSchema,
  visitanteCreateSchema,
  visitanteUpdateSchema,
} from '../lib/terceros-schemas'
import { getAllowedRoutes, getNavigationMenu, hasPermission, type Permission, type Role } from '../lib/permissions'

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

const UUID_A = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const UUID_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const UUID_C = '9b2c5e1a-0d4f-4c7e-8a1b-2f3e4d5c6b7a'

// ---------------------------------------------------------------------------------------------
console.log('1. Listas cerradas (las mismas de los CHECK de la migración 0800)')
eq('clases de cuenta', VALORES_CLASE_CUENTA, ['clinica', 'consultorio', 'eps', 'operador_logistico', 'otra'])
eq('tipos de identificación de cuenta', VALORES_TIPO_ID_CUENTA, ['NIT', 'CC', 'CE', 'PA', 'otro'])
eq('tipos de documento del médico', VALORES_TIPO_DOC_MEDICO, ['CC', 'CE', 'PA', 'PEP', 'PPT', 'otro'])
eq('especialidades', VALORES_ESPECIALIDAD, [
  'ortopedia',
  'neurocirugia',
  'columna',
  'deportiva',
  'maxilofacial',
  'fisiatria',
  'cirugia_general',
  'otra',
])
eq('roles de contacto', VALORES_ROL_CONTACTO, [
  'compras',
  'gerencia',
  'direccion_medica',
  'quimico_farmaceutico',
  'almacen_farmacia',
  'autorizaciones',
  'auditoria_medica',
  'programacion_cirugia',
  'quirofano',
  'esterilizacion',
  'instrumentacion',
  'cartera_facturacion',
  'otro',
])
const todasLasEtiquetas = [
  ...CLASES_CUENTA,
  ...TIPOS_ID_CUENTA,
  ...TIPOS_DOC_MEDICO,
  ...ESPECIALIDADES,
  ...ROLES_CONTACTO,
  ...ROLES_MEDICO_SEDE,
  ...MODALIDADES_FACTURACION,
].map(opcion => opcion.etiqueta)
check('toda opción tiene etiqueta', todasLasEtiquetas.every(etiqueta => etiqueta.trim().length > 0))
check('ninguna etiqueta dice "KAM"', todasLasEtiquetas.every(etiqueta => !/kam/i.test(etiqueta)))
eq('etiqueta de especialidad', etiquetaEspecialidad('neurocirugia'), 'Neurocirugía')
eq('etiqueta de rol', etiquetaRolContacto('quimico_farmaceutico'), 'Químico farmacéutico')
eq('etiqueta de un valor desconocido = el valor', etiquetaRolContacto('xyz'), 'xyz')
eq('semilla: 5 subtipos en orden', SUBTIPOS_SEMILLA.map(s => `${s.orden}:${s.codigo}`), [
  '1:compras',
  '2:quimico_farmaceutico',
  '3:autorizaciones',
  '4:programacion',
  '5:otro',
])
check(
  'semilla: roles sugeridos son roles de contacto',
  SUBTIPOS_SEMILLA.every(s => s.roles_sugeridos.every(rol => (VALORES_ROL_CONTACTO as readonly string[]).includes(rol)))
)
eq('semilla: programación', SUBTIPOS_SEMILLA[3].roles_sugeridos, ['programacion_cirugia', 'quirofano', 'esterilizacion', 'instrumentacion'])

// ---------------------------------------------------------------------------------------------
console.log('2. Identificaciones')
eq('NIT con puntos y DV', normalizarIdentificacion('NIT', '890.903.938-8'), '890903938')
eq('NIT con DV tras guion', normalizarIdentificacion('NIT', '890903938-8'), '890903938')
eq('NIT con DV pegado (10 dígitos)', normalizarIdentificacion('NIT', '8909039388'), '890903938')
eq('NIT con espacios y DV separado', normalizarIdentificacion('NIT', ' 890 903 938 - 8 '), '890903938')
eq('NIT sin DV', normalizarIdentificacion('NIT', '890903938'), '890903938')
eq('NIT como número', normalizarIdentificacion('NIT', 900294380), '900294380')
eq('NIT 900.294.380-1', normalizarIdentificacion('NIT', '900.294.380-1'), '900294380')
eq('NIT con DV 0', normalizarIdentificacion('NIT', '860529890-0'), '860529890')
eq('NIT con DV equivocado → null', normalizarIdentificacion('NIT', '890.903.938-7'), null)
const dvMalo = validarIdentificacion('NIT', '890903938-7')
check('el mensaje del DV dice cuál es', !dvMalo.ok && dvMalo.error.includes('es 8'), dvMalo)
eq('NIT con DV de dos cifras → null', normalizarIdentificacion('NIT', '800149384-10'), null)
eq('NIT de persona natural (8 dígitos) → null', normalizarIdentificacion('NIT', '12345678-9'), null)
const natural = validarIdentificacion('NIT', '12345678-9')
check('el mensaje sugiere la cédula', !natural.ok && natural.error.includes('cédula'), natural)
eq('NIT con letras → null', normalizarIdentificacion('NIT', '890903938A'), null)
eq('NIT vacío → null', normalizarIdentificacion('NIT', '  '), null)
eq('NIT null → null', normalizarIdentificacion('NIT', null), null)
eq('CC con puntos', normalizarIdentificacion('CC', '1.020.304.050'), '1020304050')
eq('CC con espacios', normalizarIdentificacion('CC', ' 79 123 456 '), '79123456')
eq('CC con guiones', normalizarIdentificacion('CC', '79-123-456'), '79123456')
eq('CC muy corta → null', normalizarIdentificacion('CC', '12'), null)
eq('CC de 11 dígitos → null', normalizarIdentificacion('CC', '12345678901'), null)
eq('CC con letras → null', normalizarIdentificacion('CC', 'AB123'), null)
eq('CE en mayúsculas sin signos', normalizarIdentificacion('CE', 'ce-123 456'), 'CE123456')
eq('pasaporte alfanumérico', normalizarIdentificacion('PA', 'ab.12345'), 'AB12345')
eq('PPT numérico', normalizarIdentificacion('PPT', '1234567'), '1234567')
eq('otro con Ñ → null', normalizarIdentificacion('otro', 'Ñ123'), null)
eq('tipo desconocido → null', normalizarIdentificacion('RUT', '890903938'), null)
const muestras: [string, string][] = [
  ['NIT', '890.903.938-8'],
  ['CC', '1.020.304.050'],
  ['CE', 'ce-123 456'],
  ['PA', 'ab.12345'],
  ['PEP', '123456789012345'],
]
check(
  'todo lo normalizado cumple el CHECK ^[0-9A-Z]{3,20}$',
  muestras.every(([tipo, numero]) => /^[0-9A-Z]{3,20}$/.test(normalizarIdentificacion(tipo, numero) ?? ''))
)

// ---------------------------------------------------------------------------------------------
console.log('2b. Una cuenta por identificación: el NIT no entra como CC u "otro" (regla del dueño)')
const DV_900 = dvNit('900123456') as number
const DV_MALO = (DV_900 + 1) % 10
eq('forma de NIT: 9 dígitos', formaDeNit('900123456'), '900123456')
eq('forma de NIT: con puntos', formaDeNit('900.123.456'), '900123456')
eq('forma de NIT: guion y DV correcto', formaDeNit(`900.123.456-${DV_900}`), '900123456')
eq('forma de NIT: guion y DV equivocado (el guion dice que es un DV)', formaDeNit(`900.123.456-${DV_MALO}`), '900123456')
eq('forma de NIT: 10 dígitos con el DV pegado', formaDeNit(`900123456${DV_900}`), '900123456')
eq('no es forma de NIT: 10 dígitos con un DV que no cuadra', formaDeNit(`900123456${DV_MALO}`), null)
eq('no es forma de NIT: cédula de 10 dígitos (empieza por 1)', formaDeNit('1020304050'), null)
eq('no es forma de NIT: cédula de 8 dígitos', formaDeNit('79123456'), null)
eq('no es forma de NIT: letras', formaDeNit('AB1234567'), null)
check('trae DV: "79.123.456-1"', traeDigitoVerificacion('79.123.456-1'))
check('trae DV: "900123456 - 7"', traeDigitoVerificacion('900123456 - 7'))
check('no trae DV: guiones de agrupar ("79-123-456")', !traeDigitoVerificacion('79-123-456'))
check('no trae DV: alfanumérico ("CE-123")', !traeDigitoVerificacion('CE-123'))
check('no trae DV: sin guion', !traeDigitoVerificacion('1020304050'))

const ccConDv = validarIdentificacionCuenta('CC', `900.123.456-${DV_900}`)
check('cuenta CC "900.123.456-DV" (el caso del hallazgo) → rechazada, sugiere NIT', !ccConDv.ok && ccConDv.error.includes('NIT'), ccConDv)
const ccPersonaConDv = validarIdentificacionCuenta('CC', '79.123.456-1')
check('cuenta CC con el NIT de una persona ("79.123.456-1") → rechazada (la cédula no lleva DV)', !ccPersonaConDv.ok, ccPersonaConDv)
check('cuenta CE con DV tras guion → rechazada', !validarIdentificacionCuenta('CE', '123456-7').ok)
const otroNit = validarIdentificacionCuenta('otro', '900123456')
check('cuenta "otro" con forma de NIT (9 dígitos) → rechazada, sugiere NIT', !otroNit.ok && otroNit.error.includes('NIT'), otroNit)
check('cuenta "otro" con NIT y DV pegado → rechazada', !validarIdentificacionCuenta('otro', `900123456${DV_900}`).ok)
check('cuenta "otro" con NIT, guion y DV → rechazada', !validarIdentificacionCuenta('otro', `900.123.456-${DV_900}`).ok)
eq('cuenta "otro" que no es NIT sigue entrando', validarIdentificacionCuenta('otro', 'RUC-20123456789'), { ok: true, valor: 'RUC20123456789' })
eq('cuenta CC de persona con puntos sigue entrando', validarIdentificacionCuenta('CC', '1.020.304.050'), { ok: true, valor: '1020304050' })
eq('cuenta CC de 9 dígitos entra (la API la compara con las cuentas NIT)', validarIdentificacionCuenta('CC', '900123456'), { ok: true, valor: '900123456' })
eq('cuenta NIT: igual que validarIdentificacion', validarIdentificacionCuenta('NIT', `900.123.456-${DV_900}`), { ok: true, valor: '900123456' })
check('cuenta NIT con DV equivocado sigue rechazada', !validarIdentificacionCuenta('NIT', `900123456-${DV_MALO}`).ok)
eq('el médico no cambia: CC con guiones de agrupar', normalizarIdentificacion('CC', '79-123-456'), '79123456')

eq('NIT equivalentes de una CC de 9 dígitos', nitsEquivalentes('CC', '900123456'), ['900123456'])
eq('NIT equivalentes de una CC = NIT + DV', nitsEquivalentes('CC', `900123456${DV_900}`), ['900123456'])
eq('NIT equivalentes de "otro" de 9 dígitos', nitsEquivalentes('otro', '900123456'), ['900123456'])
eq('una cédula de 10 dígitos no choca con ningún NIT', nitsEquivalentes('CC', '1020304050'), [])
eq('una cédula de 8 dígitos no choca con ningún NIT', nitsEquivalentes('CC', '79123456'), [])
eq('para el tipo NIT no hay equivalentes (su llave es la UNIQUE)', nitsEquivalentes('NIT', '900123456'), [])
eq('números con los que otra cuenta repetiría un NIT: solo y con su DV', numerosEquivalentesANit('900123456'), ['900123456', `900123456${DV_900}`])
eq('un NIT mal formado no tiene equivalentes', numerosEquivalentesANit('12345'), [])

invalido(
  'esquema de cuenta: CC "900.123.456-DV" → 400 con el mensaje del DV',
  cuentaCreateSchema.safeParse({
    nombre: 'Clínica X',
    clase: 'clinica',
    tipo_identificacion: 'CC',
    numero_identificacion: `900.123.456-${DV_900}`,
    sede: { municipality_id: '68001' },
  }),
  'dígito de verificación'
)
invalido(
  'esquema de cuenta: "otro" con forma de NIT → 400',
  cuentaCreateSchema.safeParse({
    nombre: 'Clínica X',
    clase: 'clinica',
    tipo_identificacion: 'otro',
    numero_identificacion: '900123456',
    sede: { municipality_id: '68001' },
  }),
  'forma de NIT'
)

// ---------------------------------------------------------------------------------------------
console.log('3. Nombres parecidos')
eq('sin Dra., tildes, mayúsculas ni guiones', normalizarNombre('  Dra. María José  PÉREZ-Gómez '), 'maria jose perez gomez')
eq('Ñ → n y sin Dr', normalizarNombre('Dr Juan Ñúñez'), 'juan nunez')
eq('Doctora también sale', normalizarNombre('Doctora Ana Ruiz'), 'ana ruiz')
eq('null → vacío', normalizarNombre(null), '')
check('nombre corto contenido en el largo', nombresParecidos('Juan Pérez', 'Dr. Juan Carlos Pérez Gómez'))
check('una letra de diferencia en palabra larga', nombresParecidos('Andrés Gómez', 'Andres Gomes'))
check('orden distinto', nombresParecidos('Pérez Juan', 'juan perez'))
check('con conectores', nombresParecidos('María de los Ángeles Ruiz', 'María Ruiz'))
check('repetir un apellido no cuenta doble', nombresParecidos('Carlos Ruiz', 'Carlos Ruiz Ruiz'))
check('iguales tras normalizar', nombresParecidos('Ana', 'ana'))
check('un solo nombre en común no basta', !nombresParecidos('Juan Pérez', 'Juan Gómez'))
check('un nombre suelto no se parece a uno completo', !nombresParecidos('Ana', 'Ana Pérez'))
check('palabras cortas no toleran errata (Luis ≠ Luisa)', !nombresParecidos('Luis Rojas', 'Luisa Rojas'))
check('vacío no se parece a nada', !nombresParecidos('', 'Juan Pérez'))
check('cada palabra del largo se usa una sola vez', !nombresParecidos('Gómez Gomes', 'Gómez Ruiz Pérez'))

// ---------------------------------------------------------------------------------------------
console.log('4. Rol del contacto por su cargo (cargos reales de VG)')
const cargos: [string, string][] = [
  ['Jefe de Compras', 'compras'],
  ['Programador De Cirugia', 'programacion_cirugia'],
  ['Coordinadora Sala de Cirugía', 'quirofano'],
  ['Químico Farmacéutico', 'quimico_farmaceutico'],
  ['Jefe de Almacén', 'almacen_farmacia'],
  ['Central de Esterilización', 'esterilizacion'],
  ['Director Científico', 'direccion_medica'],
  ['Auditora Médica', 'auditoria_medica'],
  ['Gerente', 'gerencia'],
  // Prioridades y variantes
  ['DIRECTORA MÉDICA', 'direccion_medica'],
  ['Subdirector científico', 'direccion_medica'],
  ['Director administrativo', 'gerencia'],
  ['Gerente de compras', 'compras'],
  ['Directora de compras', 'compras'],
  ['Jefe de programación de cirugía', 'programacion_cirugia'],
  ['Instrumentadora quirúrgica', 'instrumentacion'],
  ['Jefe de quirófano', 'quirofano'],
  ['Regente de farmacia', 'almacen_farmacia'],
  ['Directora de farmacia', 'almacen_farmacia'],
  ['Coordinadora de autorizaciones', 'autorizaciones'],
  ['Auditor médico de autorizaciones', 'auditoria_medica'],
  ['Analista de cartera', 'cartera_facturacion'],
  ['Facturador', 'cartera_facturacion'],
  ['Auditora de cuentas médicas', 'cartera_facturacion'],
  ['Representante legal', 'gerencia'],
  ['Secretaria', 'otro'],
  ['Enfermera jefe', 'otro'],
]
for (const [cargo, rol] of cargos) eq(`"${cargo}" → ${rol}`, rolDesdeCargo(cargo), rol)
eq('sin cargo → otro', rolDesdeCargo(''), 'otro')
eq('null → otro', rolDesdeCargo(null), 'otro')

// ---------------------------------------------------------------------------------------------
console.log('5. Subtipo sugerido por el rol')
eq('compras → compras', subtipoSugerido('compras'), 'compras')
eq('gerencia → compras', subtipoSugerido('gerencia'), 'compras')
eq('dirección médica → compras', subtipoSugerido('direccion_medica'), 'compras')
eq('almacén → químico farmacéutico', subtipoSugerido('almacen_farmacia'), 'quimico_farmaceutico')
eq('auditoría médica → autorizaciones', subtipoSugerido('auditoria_medica'), 'autorizaciones')
eq('esterilización → programación', subtipoSugerido('esterilizacion'), 'programacion')
eq('cartera (sin subtipo) → otro', subtipoSugerido('cartera_facturacion'), 'otro')
eq('otro → otro', subtipoSugerido('otro'), 'otro')
eq('sin rol → otro', subtipoSugerido(null), 'otro')
eq('cargo → rol → subtipo', subtipoSugerido(rolDesdeCargo('Coordinadora Sala de Cirugía')), 'programacion')
eq(
  'con subtipos propios gana el de menor orden',
  subtipoSugerido('compras', [
    { codigo: 'b', roles_sugeridos: ['compras'], orden: 2 },
    { codigo: 'a', roles_sugeridos: ['compras'], orden: 1 },
  ]),
  'a'
)
eq('subtipo apagado (no viene en la lista) → otro', subtipoSugerido('compras', [{ codigo: 'otro', roles_sugeridos: ['otro'], orden: 5 }]), 'otro')

// ---------------------------------------------------------------------------------------------
console.log('6. Privacidad y reglas de cuenta')
const medico = { id: UUID_A, nombre: 'Juan Pérez', tipo_documento: 'CC', numero_documento: '79123456' }
const publico = sinDocumento(medico)
check('sinDocumento quita tipo y número', !('tipo_documento' in publico) && !('numero_documento' in publico))
eq('sinDocumento conserva lo demás', publico, { id: UUID_A, nombre: 'Juan Pérez' })
check('sinDocumento no toca el original', medico.numero_documento === '79123456')
check('NIT no está protegido', !identificacionCuentaProtegida({ tipo_identificacion: 'NIT' }))
check('CC de consultorio está protegida', identificacionCuentaProtegida({ tipo_identificacion: 'CC' }))
const consultorio = { clase: 'consultorio', tipo_identificacion: 'CC', numero_identificacion: '79123456' }
eq('CC oculta sin terceros:manage', ocultarIdentificacionCuenta(consultorio, false).numero_identificacion, null)
eq('CC visible con terceros:manage', ocultarIdentificacionCuenta(consultorio, true).numero_identificacion, '79123456')
const clinica = { clase: 'clinica', tipo_identificacion: 'NIT', numero_identificacion: '890903938' }
eq('NIT visible sin terceros:manage', ocultarIdentificacionCuenta(clinica, false).numero_identificacion, '890903938')
eq('modalidad en EPS: bien', errorModalidad('eps', 'directa'), null)
check('modalidad en clínica: error', errorModalidad('clinica', 'via_clinica') !== null)
eq('sin modalidad: bien en cualquier clase', errorModalidad('clinica', null), null)
eq('página 3', leerPagina('3'), 3)
eq('página 0 → 1', leerPagina('0'), 1)
eq('página no numérica → 1', leerPagina('abc'), 1)
eq('página decimal → 1', leerPagina('2.5'), 1)
eq('sin página → 1', leerPagina(null), 1)

// ---------------------------------------------------------------------------------------------
console.log('7. Esquema de cuenta (con su sede principal)')
const cuentaBase = {
  nombre: '  Clínica   Chía ',
  clase: 'clinica',
  tipo_identificacion: 'NIT',
  numero_identificacion: '890.903.938-8',
  sede: { municipality_id: '25175', lat: 4.8612345678, lng: -74.0587654321, reps_code: '2517 5000 0101' },
  id: UUID_C,
  origen: 'hospitals',
  created_by: UUID_B,
}
const cuenta = valido('cuenta válida', cuentaCreateSchema.safeParse(cuentaBase))
eq('nombre sin espacios de más', cuenta?.nombre, 'Clínica Chía')
eq('NIT normalizado a 9 dígitos', cuenta?.numero_identificacion, '890903938')
eq('sede sin nombre toma el de la cuenta', cuenta?.sede.nombre, 'Clínica Chía')
eq('código de habilitación sin espacios', cuenta?.sede.reps_code, '251750000101')
eq('coordenadas a 6 decimales', [cuenta?.sede.lat, cuenta?.sede.lng], [4.861235, -74.058765])
check('descarta id, origen y created_by', cuenta !== undefined && !('id' in cuenta) && !('origen' in cuenta) && !('created_by' in cuenta))
valido('EPS con modalidad', cuentaCreateSchema.safeParse({ ...cuentaBase, clase: 'eps', modalidad_facturacion: 'via_clinica' }))
invalido(
  'modalidad en una clínica',
  cuentaCreateSchema.safeParse({ ...cuentaBase, modalidad_facturacion: 'directa' }),
  'solo aplica a una EPS'
)
invalido('modalidad desconocida', cuentaCreateSchema.safeParse({ ...cuentaBase, clase: 'eps', modalidad_facturacion: 'x' }), 'Modalidad no válida')
invalido('sin sede principal', cuentaCreateSchema.safeParse({ ...cuentaBase, sede: undefined }), 'Falta la sede principal')
invalido('sede sin municipio', cuentaCreateSchema.safeParse({ ...cuentaBase, sede: { nombre: 'Sede' } }), 'municipio de la sede principal')
invalido('NIT con DV equivocado', cuentaCreateSchema.safeParse({ ...cuentaBase, numero_identificacion: '890903938-7' }), 'dígito de verificación')
invalido('sin número de identificación', cuentaCreateSchema.safeParse({ ...cuentaBase, numero_identificacion: '' }), 'Escribe el número')
invalido('clase desconocida', cuentaCreateSchema.safeParse({ ...cuentaBase, clase: 'hospital' }), 'Clase no válida')
invalido('nombre de una letra', cuentaCreateSchema.safeParse({ ...cuentaBase, nombre: ' A ' }), 'al menos 2 letras')
invalido(
  'sede con latitud sin longitud',
  cuentaCreateSchema.safeParse({ ...cuentaBase, sede: { municipality_id: '25175', lat: 4.86 } }),
  'juntas'
)
invalido(
  'sede fuera de Colombia',
  cuentaCreateSchema.safeParse({ ...cuentaBase, sede: { municipality_id: '25175', lat: 40.4, lng: -3.7 } }),
  'fuera de Colombia'
)
invalido(
  'código de habilitación de 11 dígitos',
  cuentaCreateSchema.safeParse({ ...cuentaBase, sede: { municipality_id: '25175', reps_code: '25175000010' } }),
  '12 dígitos'
)
const consultorioCc = valido(
  'consultorio con cédula',
  cuentaCreateSchema.safeParse({
    ...cuentaBase,
    clase: 'consultorio',
    tipo_identificacion: 'CC',
    numero_identificacion: '79.123.456',
    codigo_prestador: '11001 23456',
  })
)
eq('cédula normalizada', consultorioCc?.numero_identificacion, '79123456')
eq('código de prestador sin espacios', consultorioCc?.codigo_prestador, '1100123456')

console.log('8. Esquema de edición de cuenta')
invalido('sin campos', cuentaUpdateSchema.safeParse({}), 'No hay campos')
invalido('la identificación no se edita', cuentaUpdateSchema.safeParse({ numero_identificacion: '900294380' }), 'No hay campos')
eq('pasar a clínica borra la modalidad', cuentaUpdateSchema.safeParse({ clase: 'clinica' }).data, { clase: 'clinica', modalidad_facturacion: null })
invalido('clínica con modalidad', cuentaUpdateSchema.safeParse({ clase: 'clinica', modalidad_facturacion: 'directa' }), 'solo aplica a una EPS')
valido('EPS con modalidad', cuentaUpdateSchema.safeParse({ clase: 'eps', modalidad_facturacion: 'directa' }))
valido('solo modalidad (la API la compara con la clase guardada)', cuentaUpdateSchema.safeParse({ modalidad_facturacion: 'directa' }))
eq('notas vacías → null', cuentaUpdateSchema.safeParse({ notas: '  ' }).data?.notas, null)
eq('marcar cliente', cuentaUpdateSchema.safeParse({ es_cliente: true }).data, { es_cliente: true })

console.log('9. Esquemas de sede')
const sedeBase = { cuenta_id: UUID_A.toUpperCase(), nombre: 'Consultorio 302', municipality_id: '05001', direccion: 'Cra 43A # 1-50' }
const sede = valido('sede válida', sedeCreateSchema.safeParse({ ...sedeBase, ubicacion_confirmada: true, origen: 'hospitals' }))
eq('cuenta_id en minúsculas', sede?.cuenta_id, UUID_A)
check('no acepta ubicacion_confirmada ni origen al crear', sede !== undefined && !('ubicacion_confirmada' in sede) && !('origen' in sede))
invalido('sin cuenta', sedeCreateSchema.safeParse({ ...sedeBase, cuenta_id: undefined }), 'Elige la cuenta')
invalido('sin municipio', sedeCreateSchema.safeParse({ ...sedeBase, municipality_id: undefined }), 'Elige el municipio')
invalido('municipio de 4 dígitos', sedeCreateSchema.safeParse({ ...sedeBase, municipality_id: '5001' }), '5 dígitos')
invalido('sin nombre', sedeCreateSchema.safeParse({ ...sedeBase, nombre: '' }), 'al menos 2 letras')
valido('marcar principal', sedeUpdateSchema.safeParse({ es_principal: true }))
invalido('desmarcar principal', sedeUpdateSchema.safeParse({ es_principal: false }), 'marca otra sede como principal')
valido('confirmar ubicación', sedeUpdateSchema.safeParse({ ubicacion_confirmada: true }))
eq('borrar coordenadas (las dos)', sedeUpdateSchema.safeParse({ lat: null, lng: null }).data, { lat: null, lng: null })
invalido('borrar solo una coordenada', sedeUpdateSchema.safeParse({ lat: null }), 'juntas')
invalido('sin campos', sedeUpdateSchema.safeParse({}), 'No hay campos')

// ---------------------------------------------------------------------------------------------
console.log('10. Esquema de médico (completo o no se crea)')
const medicoBase = {
  tipo_documento: 'CC',
  numero_documento: '79.123.456',
  nombre: ' Dr.  Juan Pérez ',
  especialidades: ['ortopedia', 'ortopedia', 'columna'],
  municipality_id: '11001',
  telefono: '+57 300 123 4567',
  email: 'Juan.Perez@Ejemplo.com',
  sedes: [
    { sede_id: UUID_A.toUpperCase(), rol: 'consultorio' },
    { sede_id: UUID_B, rol: 'atiende', principal: true },
  ],
  activo: false,
  created_by: UUID_C,
}
const nuevo = valido('médico completo', medicoCreateSchema.safeParse(medicoBase))
eq('documento normalizado', nuevo?.numero_documento, '79123456')
eq('nombre sin espacios de más', nuevo?.nombre, 'Dr. Juan Pérez')
eq('especialidades sin repetir', nuevo?.especialidades, ['ortopedia', 'columna'])
eq('sede_id en minúsculas', nuevo?.sedes.map(s => s.sede_id), [UUID_A, UUID_B])
eq('correo en minúsculas', nuevo?.email, 'juan.perez@ejemplo.com')
check('descarta activo y created_by', nuevo !== undefined && !('activo' in nuevo) && !('created_by' in nuevo))
invalido('médico sin sedes (lista vacía)', medicoCreateSchema.safeParse({ ...medicoBase, sedes: [] }), 'al menos una sede')
invalido('médico sin sedes (sin campo)', medicoCreateSchema.safeParse({ ...medicoBase, sedes: undefined }), 'al menos una sede')
invalido('médico sin número de documento', medicoCreateSchema.safeParse({ ...medicoBase, numero_documento: undefined }), 'número de documento')
invalido('médico con documento vacío', medicoCreateSchema.safeParse({ ...medicoBase, numero_documento: '   ' }), 'Escribe el número')
invalido('médico sin tipo de documento', medicoCreateSchema.safeParse({ ...medicoBase, tipo_documento: undefined }), 'tipo de documento')
invalido('cédula con letras', medicoCreateSchema.safeParse({ ...medicoBase, numero_documento: 'ABC123' }), 'solo lleva números')
invalido('especialidad fuera de la lista', medicoCreateSchema.safeParse({ ...medicoBase, especialidades: ['cardiologia'] }), 'elige una de la lista')
invalido('sin especialidades', medicoCreateSchema.safeParse({ ...medicoBase, especialidades: [] }), 'al menos una especialidad')
invalido('nombre de 2 letras', medicoCreateSchema.safeParse({ ...medicoBase, nombre: 'Jo' }), 'al menos 3 letras')
invalido('sin municipio', medicoCreateSchema.safeParse({ ...medicoBase, municipality_id: undefined }), 'municipio del médico')
invalido('municipio de 4 dígitos', medicoCreateSchema.safeParse({ ...medicoBase, municipality_id: '1100' }), '5 dígitos')
invalido(
  'sede repetida (aunque cambie mayúsculas)',
  medicoCreateSchema.safeParse({ ...medicoBase, sedes: [{ sede_id: UUID_A, rol: 'consultorio' }, { sede_id: UUID_A.toUpperCase(), rol: 'atiende' }] }),
  'sedes repetidas'
)
invalido('rol de sede desconocido', medicoCreateSchema.safeParse({ ...medicoBase, sedes: [{ sede_id: UUID_A, rol: 'opera' }] }), 'consultorio o atiende')
invalido('sede con id inválido', medicoCreateSchema.safeParse({ ...medicoBase, sedes: [{ sede_id: '123', rol: 'atiende' }] }), 'Sede no válida')
invalido(
  'dos sedes principales',
  medicoCreateSchema.safeParse({
    ...medicoBase,
    sedes: [
      { sede_id: UUID_A, rol: 'consultorio', principal: true },
      { sede_id: UUID_B, rol: 'atiende', principal: true },
    ],
  }),
  'Solo una sede puede ser la principal'
)
invalido('teléfono corto', medicoCreateSchema.safeParse({ ...medicoBase, telefono: '123' }), 'al menos 7 dígitos')
invalido('correo inválido', medicoCreateSchema.safeParse({ ...medicoBase, email: 'no-es-correo' }), 'Correo no válido')
eq('correo vacío → null', medicoCreateSchema.safeParse({ ...medicoBase, email: '' }).data?.email, null)
eq('pasaporte normalizado', medicoCreateSchema.safeParse({ ...medicoBase, tipo_documento: 'PA', numero_documento: 'ab-123 45' }).data?.numero_documento, 'AB12345')

console.log('11. Edición y verificación de médico')
valido('cambiar nombre', medicoUpdateSchema.safeParse({ nombre: 'Juan Carlos Pérez' }))
invalido('quitar el documento', medicoUpdateSchema.safeParse({ numero_documento: null }), 'no se puede quitar')
invalido('número sin tipo', medicoUpdateSchema.safeParse({ numero_documento: '79123456' }), 'tipo y el número juntos')
eq(
  'corregir documento (tipo y número)',
  medicoUpdateSchema.safeParse({ tipo_documento: 'CC', numero_documento: '79.123.457' }).data?.numero_documento,
  '79123457'
)
invalido('especialidad fuera de la lista', medicoUpdateSchema.safeParse({ especialidades: ['xx'] }), 'elige una de la lista')
invalido('sin campos', medicoUpdateSchema.safeParse({}), 'No hay campos')
const verificar = valido(
  'verificar con nombre',
  medicoVerificarSchema.safeParse({ tipo_documento: 'CC', numero_documento: '79 123 456', nombre: ' Juan   Pérez ' })
)
eq('verificar: documento normalizado', verificar?.numero_documento, '79123456')
eq('verificar: nombre limpio', verificar?.nombre, 'Juan Pérez')
eq('verificar sin nombre → null', medicoVerificarSchema.safeParse({ tipo_documento: 'CC', numero_documento: '79123456' }).data?.nombre, null)
invalido('verificar sin documento', medicoVerificarSchema.safeParse({ tipo_documento: 'CC' }), 'número de documento')
invalido('verificar con documento inválido', medicoVerificarSchema.safeParse({ tipo_documento: 'CC', numero_documento: '12' }), 'solo lleva números')

// ---------------------------------------------------------------------------------------------
console.log('12. Visitantes y contactos')
const visitante = valido('visitante sin ciudad', visitanteCreateSchema.safeParse({ executive_id: UUID_A.toUpperCase(), line_id: UUID_B }))
eq('visitante: ids en minúsculas y ciudad ausente', visitante, { executive_id: UUID_A, line_id: UUID_B, municipality_id: undefined })
eq('visitante con ciudad', visitanteCreateSchema.safeParse({ executive_id: UUID_A, line_id: UUID_B, municipality_id: '08001' }).data?.municipality_id, '08001')
eq('visitante con ciudad vacía → null', visitanteCreateSchema.safeParse({ executive_id: UUID_A, line_id: UUID_B, municipality_id: '' }).data?.municipality_id, null)
invalido('visitante sin ejecutivo', visitanteCreateSchema.safeParse({ line_id: UUID_B }), 'Ejecutivo Comercial')
invalido('visitante sin línea', visitanteCreateSchema.safeParse({ executive_id: UUID_A }), 'Elige la línea')
invalido('visitante con ciudad inválida', visitanteCreateSchema.safeParse({ executive_id: UUID_A, line_id: UUID_B, municipality_id: '123' }), '5 dígitos')
valido('terminar visitante', visitanteUpdateSchema.safeParse({ hasta: '2026-10-31' }))
invalido('fecha que no existe', visitanteUpdateSchema.safeParse({ hasta: '2026-02-30' }), 'Fecha no válida')
invalido('sin fecha', visitanteUpdateSchema.safeParse({}), 'fecha en que termina')
check('esFechaValida: bisiesto', esFechaValida('2028-02-29') && !esFechaValida('2027-02-29'))

const contactoBase = { cuenta_id: UUID_A, nombre: 'Ana Ruiz', cargo_texto: 'Jefe de Compras' }
eq('contacto: rol desde el cargo', contactoCreateSchema.safeParse(contactoBase).data?.rol, 'compras')
eq('contacto: rol elegido gana', contactoCreateSchema.safeParse({ ...contactoBase, rol: 'gerencia' }).data?.rol, 'gerencia')
eq('contacto sin cargo → otro', contactoCreateSchema.safeParse({ cuenta_id: UUID_A, nombre: 'Ana Ruiz' }).data?.rol, 'otro')
eq('contacto: sede vacía → null', contactoCreateSchema.safeParse({ ...contactoBase, sede_id: '' }).data?.sede_id, null)
eq('contacto: sede en minúsculas', contactoCreateSchema.safeParse({ ...contactoBase, sede_id: UUID_B.toUpperCase() }).data?.sede_id, UUID_B)
invalido('contacto con sede inválida', contactoCreateSchema.safeParse({ ...contactoBase, sede_id: 'abc' }), 'Sede no válida')
invalido('contacto con rol desconocido', contactoCreateSchema.safeParse({ ...contactoBase, rol: 'jefe' }), 'Rol de contacto no válido')
invalido('contacto sin nombre', contactoCreateSchema.safeParse({ cuenta_id: UUID_A }), 'nombre del contacto')
invalido('contacto sin cuenta', contactoCreateSchema.safeParse({ nombre: 'Ana Ruiz' }), 'cuenta del contacto')
eq('editar cargo no recalcula el rol', contactoUpdateSchema.safeParse({ cargo_texto: 'Gerente' }).data, { cargo_texto: 'Gerente' })
invalido('editar contacto sin campos', contactoUpdateSchema.safeParse({}), 'No hay campos')
invalido('cuerpo null', medicoCreateSchema.safeParse(null), 'se esperaba un objeto JSON')
invalido('cuerpo que no es objeto', cuentaCreateSchema.safeParse('hola'), 'se esperaba un objeto JSON')

// ---------------------------------------------------------------------------------------------
console.log('12b. Aviso de un visitante vigente que ya no cumple la regla (no se cierra solo)')
eq('ejecutiva activa que lleva la línea → sin aviso', avisoVisitante({ hasta: null }, { status: 'active' }, { active: true }, true), null)
eq('vacante (placeholder) que lleva la línea → sin aviso', avisoVisitante({ hasta: null }, { status: 'placeholder' }, { active: true }, true), null)
eq(
  'ya no lleva la línea → aviso',
  avisoVisitante({ hasta: null }, { status: 'active' }, { active: true }, false),
  'El Ejecutivo Comercial ya no lleva esta línea'
)
eq(
  'dada de baja (inactive) → aviso, aunque siga con la línea',
  avisoVisitante({ hasta: null }, { status: 'inactive' }, { active: true }, true),
  'El Ejecutivo Comercial está inactivo'
)
eq('línea desactivada → aviso', avisoVisitante({ hasta: null }, { status: 'active' }, { active: false }, true), 'La línea está inactiva')
eq('asignación terminada → nunca aviso (es historia)', avisoVisitante({ hasta: '2026-10-01' }, { status: 'inactive' }, { active: false }, false), null)
eq('sin datos de la ejecutiva ni de la línea → sin aviso', avisoVisitante({ hasta: null }, null, null, false), null)

// ---------------------------------------------------------------------------------------------
console.log('12c. Filtros de las listas (GET con texto en la URL y POST .../buscar con el cuerpo)')
const desdeUrl = busquedaCuentasSchema.safeParse(
  Object.fromEntries(new URLSearchParams('q=%20cl%C3%ADnica%20%20ejemplo%20&clase=clinica&cliente=false&municipio=68001&page=2'))
)
eq(
  'cuentas por URL: texto limpio, clase, cliente false, municipio y página',
  desdeUrl.success ? desdeUrl.data : desdeUrl.error.issues,
  { q: 'clínica ejemplo', clase: 'clinica', cliente: false, municipio: '68001', activo: undefined, page: 2 }
)
const desdeCuerpo = busquedaCuentasSchema.safeParse({ q: '1020304050', cliente: true, activo: 'no', page: 1 })
eq(
  'cuentas por cuerpo: booleanos de verdad y en texto',
  desdeCuerpo.success ? desdeCuerpo.data : desdeCuerpo.error.issues,
  { q: '1020304050', clase: undefined, cliente: true, municipio: undefined, activo: false, page: 1 }
)
eq('cuentas: cuerpo vacío → todo por defecto (página 1)', busquedaCuentasSchema.safeParse({}).success && busquedaCuentasSchema.parse({}).page, 1)
invalido('cuentas: clase fuera de la lista → 400', busquedaCuentasSchema.safeParse({ clase: 'hospital' }), 'Clase de cuenta no válida')
invalido('cuentas: cliente que no es sí/no → 400', busquedaCuentasSchema.safeParse({ cliente: 'tal vez' }), 'El filtro cliente debe ser true o false')
invalido('cuentas: municipio de 3 dígitos → 400', busquedaCuentasSchema.safeParse({ municipio: '680' }), 'Municipio no válido')
invalido('cuentas: municipio como número (05001 perdería el cero) → 400', busquedaCuentasSchema.safeParse({ municipio: 5001 }), 'Municipio no válido')
invalido('cuentas: el cuerpo debe ser un objeto', busquedaCuentasSchema.safeParse(null), 'objeto JSON')
eq('cuentas: página no válida → 1', busquedaCuentasSchema.parse({ page: 'x' }).page, 1)
eq('cuentas: búsqueda de más de 100 caracteres se corta', busquedaCuentasSchema.parse({ q: 'a'.repeat(150) }).q.length, 100)
eq('médicos: visitante=me', busquedaMedicosSchema.parse({ visitante: 'me' }).visitante, 'me')
invalido('médicos: visitante distinto de "me" → 400', busquedaMedicosSchema.safeParse({ visitante: 'todos' }), 'solo admite "me"')
eq('médicos: q vacío → ""', busquedaMedicosSchema.parse({ q: '   ' }).q, '')

// ---------------------------------------------------------------------------------------------
console.log('13. Permisos de terceros por rol (contrato F1)')
const matriz: [Role, Permission[], Permission[]][] = [
  ['admin', ['terceros:view', 'terceros:create', 'terceros:manage', 'visitantes:manage'], []],
  ['commercial_director', ['terceros:view', 'terceros:create', 'terceros:manage', 'visitantes:manage'], []],
  ['line_leader', ['terceros:view', 'terceros:create', 'visitantes:manage'], ['terceros:manage']],
  ['sales_manager', ['terceros:view', 'terceros:create'], ['terceros:manage', 'visitantes:manage']],
  ['data_manager', ['terceros:view', 'terceros:create', 'terceros:manage'], ['visitantes:manage']],
  ['viewer', ['terceros:view'], ['terceros:create', 'terceros:manage', 'visitantes:manage']],
  ['contract_manager', [], ['terceros:view', 'terceros:create', 'terceros:manage', 'visitantes:manage']],
  ['user', [], ['terceros:view', 'terceros:create', 'terceros:manage', 'visitantes:manage']],
]
for (const [rol, tiene, noTiene] of matriz) {
  check(`${rol}: tiene ${tiene.join(', ') || '(ninguno)'}`, tiene.every(permiso => hasPermission(rol, permiso)))
  check(`${rol}: no tiene ${noTiene.join(', ') || '(ninguno)'}`, noTiene.every(permiso => !hasPermission(rol, permiso)))
  const enMenu = getNavigationMenu(rol).some(item => item.href === '/terceros' && item.name === 'Terceros')
  const enRutas = getAllowedRoutes(rol).includes('/terceros')
  const debe = tiene.includes('terceros:view')
  check(`${rol}: menú "Terceros" y ruta /terceros ${debe ? 'sí' : 'no'}`, enMenu === debe && enRutas === debe)
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
