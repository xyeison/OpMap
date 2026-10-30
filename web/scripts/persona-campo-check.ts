/**
 * Actividades de campo · F1a (migración 0850): pruebas PURAS de lib/persona-campo.ts (quién es quién), espejo de
 * persona_lineas, persona_de_campo, ejecutivo_de_la_visita, medico_de_lineas y del "como qué" de agenda_crear. SIN red
 * ni Supabase: solo lee el archivo de la 0850 para comprobar que los mensajes son los mismos que lanza la base.
 * Spec: docs/specs/2026-10-15-actividades-de-campo.md ("Quién es quién", A1, A2, C1, C9, C12 y los criterios de F1a).
 *
 * Cubre: lineasParaReportar (unión de las de Ejecutivo Comercial y las de líder; Ejecutivo Comercial inactivo o
 * vacante no cuenta; línea inactiva no cuenta; usuario inactivo y dirección comercial sin líneas); personaDeCampo
 * (sales_manager sin Ejecutivo Comercial → MENSAJE_SIN_LINEAS; la directora → MENSAJE_DIRECCION_NO_REPORTA aunque
 * lidere una línea; Ejecutivo Comercial sin zona → MENSAJE_SIN_ZONA; rol ejecutivo, lider y lider_y_ejecutivo);
 * ejecutivoDeLaVisita (Paola: Trauma → null, Sustitutos → el suyo, las dos → el suyo); visitaSumaALaCuota (con
 * Ejecutivo Comercial solo lo suyo como Ejecutivo Comercial; una líder sin él, todo); ejecutivoDeLaCita (por defecto
 * como Ejecutiva; como líder → null; líder sin Ejecutivo Comercial como Ejecutiva → error; Ejecutiva sin líneas de
 * líder como líder → error); medicoDeLineas (visitante en la línea, sí; visitante de un Ejecutivo Comercial de la línea
 * en otra línea, sí; vencido, futuro, de otra línea y de otro Ejecutivo Comercial o de uno inactivo, no); permisos de la
 * dirección comercial (sin visits:report, con calendar:manage); los mensajes están en la 0850.
 *
 * Uso (desde web/): npx tsx scripts/persona-campo-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  MENSAJE_CAMBIO_DE_PAPEL,
  MENSAJE_CITA_OTRO_PAPEL,
  MENSAJE_COMO_NO_VALIDO,
  MENSAJE_DIRECCION_NO_REPORTA,
  MENSAJE_EJECUTIVA_AJENA,
  MENSAJE_EJECUTIVO_EN_VMO,
  MENSAJE_LINEA_AJENA,
  MENSAJE_MEDICO_AJENO,
  MENSAJE_SIN_LINEAS,
  MENSAJE_SIN_LINEAS_LIDER,
  MENSAJE_SIN_ZONA,
  appSoloLideres,
  comoDeLaApp,
  ejecutivoDeLaCita,
  ejecutivoDeLaVisita,
  lineasDeLaApp,
  lineasDelMedico,
  lineasParaReportar,
  medicoDeLineas,
  personaDeCampo,
  rolDePersona,
  visitaSumaALaCuota,
  type EjecutivaCampo,
  type LineaCampo,
  type UsuarioCampo,
  type VisitanteMedico,
} from '../lib/persona-campo'
import { MENSAJE_SIN_EJECUTIVA } from '../lib/visits-rules'
import { hasPermission, rolePermissions } from '../lib/permissions'

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
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------------------------
// Datos: las líneas y personas del ejemplo del dueño (spec, "Quién es quién")
// ---------------------------------------------------------------------------------------------
const PAOLA = 'u-paola'
const LUCIA = 'u-lucia'
const ANA = 'u-ana'
const DIRECTORA = 'u-directora'
const GERENTE = 'u-gerente'

const TRAUMA = 'l-trauma' // la lidera Paola
const SUSTITUTOS = 'l-sustitutos' // Paola es su Ejecutiva Comercial
const DEPORTIVA = 'l-deportiva' // la lidera Lucía (sin Ejecutivo Comercial)
const ORTOPEDIA = 'l-ortopedia' // Ana, Ejecutiva Comercial
const COLUMNA = 'l-columna' // inactiva, la lideraba Lucía
const MAXILO = 'l-maxilo' // la lidera la directora (A1: igual no reporta)

const LINEAS: LineaCampo[] = [
  { id: TRAUMA, active: true, leader_user_id: PAOLA },
  { id: SUSTITUTOS, active: true, leader_user_id: null },
  { id: DEPORTIVA, active: true, leader_user_id: LUCIA },
  { id: ORTOPEDIA, active: true, leader_user_id: null },
  { id: COLUMNA, active: false, leader_user_id: LUCIA },
  { id: MAXILO, active: true, leader_user_id: DIRECTORA },
]
const usuario = (id: string, role: string, active: boolean | null = true): UsuarioCampo => ({ id, role, active })
const ec = (id: string, status: EjecutivaCampo['status'] = 'active', base_kam_id: string | null = 'kam-bga'): EjecutivaCampo => ({ id, status, base_kam_id })

const entradaPaola = { usuario: usuario(PAOLA, 'sales_manager'), ejecutiva: ec('e-paola'), lineasEjecutiva: [SUSTITUTOS], lineas: LINEAS }
const entradaLucia = { usuario: usuario(LUCIA, 'sales_manager'), ejecutiva: null, lineasEjecutiva: [], lineas: LINEAS }
const entradaAna = { usuario: usuario(ANA, 'sales_manager'), ejecutiva: ec('e-ana'), lineasEjecutiva: [ORTOPEDIA], lineas: LINEAS }

// ---------------------------------------------------------------------------------------------
console.log('\n1. lineasParaReportar (espejo de persona_lineas)')
check('Paola: la unión de sus líneas de Ejecutiva Comercial (Sustitutos) y de líder (Trauma), ordenada', igual(lineasParaReportar(entradaPaola), { ec: [SUSTITUTOS], lider: [TRAUMA], todas: [SUSTITUTOS, TRAUMA].sort() }), lineasParaReportar(entradaPaola))
check('Lucía (líder sin Ejecutivo Comercial): solo Deportiva; Columna está inactiva y no cuenta', igual(lineasParaReportar(entradaLucia), { ec: [], lider: [DEPORTIVA], todas: [DEPORTIVA] }), lineasParaReportar(entradaLucia))
check('Ana (Ejecutiva Comercial): solo sus executive_lines', igual(lineasParaReportar(entradaAna).todas, [ORTOPEDIA]))
check('líneas repetidas entre los dos papeles salen una vez', igual(lineasParaReportar({ ...entradaPaola, lineasEjecutiva: [TRAUMA, SUSTITUTOS, SUSTITUTOS] }).todas, [SUSTITUTOS, TRAUMA].sort()))
for (const status of ['inactive', 'placeholder'] as const) {
  check(`un Ejecutivo Comercial ${status} no aporta líneas (Paola queda solo como líder)`, igual(lineasParaReportar({ ...entradaPaola, ejecutiva: ec('e-paola', status) }), { ec: [], lider: [TRAUMA], todas: [TRAUMA] }))
}
check('usuario inactivo (o active null): ninguna línea', lineasParaReportar({ ...entradaPaola, usuario: usuario(PAOLA, 'sales_manager', false) }).todas.length === 0 && lineasParaReportar({ ...entradaPaola, usuario: usuario(PAOLA, 'sales_manager', null) }).todas.length === 0)
check('la dirección comercial: ninguna línea aunque lidere Maxilofacial (A1)', lineasParaReportar({ usuario: usuario(DIRECTORA, 'commercial_director'), ejecutiva: null, lineasEjecutiva: [], lineas: LINEAS }).todas.length === 0)

console.log('\n2. personaDeCampo (espejo de persona_de_campo) y rolDePersona')
const gerente = personaDeCampo({ usuario: usuario(GERENTE, 'sales_manager'), ejecutiva: null, lineasEjecutiva: [], lineas: LINEAS })
check(`un sales_manager sin Ejecutivo Comercial ni líneas → "${MENSAJE_SIN_LINEAS}"`, !gerente.ok && gerente.error === MENSAJE_SIN_LINEAS, gerente)
const directora = personaDeCampo({ usuario: usuario(DIRECTORA, 'commercial_director'), ejecutiva: null, lineasEjecutiva: [], lineas: LINEAS })
check(`la directora → "${MENSAJE_DIRECCION_NO_REPORTA}" aunque sea líder de una línea`, !directora.ok && directora.error === MENSAJE_DIRECCION_NO_REPORTA, directora)
const directoraConEc = personaDeCampo({ usuario: usuario(DIRECTORA, 'commercial_director'), ejecutiva: ec('e-dir'), lineasEjecutiva: [ORTOPEDIA], lineas: LINEAS })
check('la directora, aun enlazada con un Ejecutivo Comercial, no agenda ni reporta', !directoraConEc.ok && directoraConEc.error === MENSAJE_DIRECCION_NO_REPORTA)
const paola = personaDeCampo(entradaPaola)
check('Paola: lider_y_ejecutivo, con su Ejecutivo Comercial y su zona', paola.ok && paola.persona.rol === 'lider_y_ejecutivo' && paola.persona.executiveId === 'e-paola' && paola.persona.kamId === 'kam-bga' && igual(paola.persona.lineasEc, [SUSTITUTOS]) && igual(paola.persona.lineasLider, [TRAUMA]), paola)
const lucia = personaDeCampo(entradaLucia)
check('Lucía: lider, sin Ejecutivo Comercial ni zona', lucia.ok && lucia.persona.rol === 'lider' && lucia.persona.executiveId === null && lucia.persona.kamId === null, lucia)
const ana = personaDeCampo(entradaAna)
check('Ana: ejecutivo', ana.ok && ana.persona.rol === 'ejecutivo' && ana.persona.executiveId === 'e-ana')
const sinZona = personaDeCampo({ ...entradaAna, ejecutiva: ec('e-ana', 'active', null) })
check(`Ejecutivo Comercial activo sin zona base → "${MENSAJE_SIN_ZONA}"`, !sinZona.ok && sinZona.error === MENSAJE_SIN_ZONA, sinZona)
const paolaInactiva = personaDeCampo({ ...entradaPaola, ejecutiva: ec('e-paola', 'inactive', null) })
check('Paola con su Ejecutivo Comercial inactivo (y sin zona): sigue como líder, sin Ejecutivo Comercial', paolaInactiva.ok && paolaInactiva.persona.rol === 'lider' && paolaInactiva.persona.executiveId === null, paolaInactiva)
check('rolDePersona: sin líneas null; solo EC ejecutivo; solo líder lider; las dos lider_y_ejecutivo', rolDePersona([], []) === null && rolDePersona(['a'], []) === 'ejecutivo' && rolDePersona([], ['b']) === 'lider' && rolDePersona(['a'], ['b']) === 'lider_y_ejecutivo')

console.log('\n3. ejecutivoDeLaVisita (espejo de ejecutivo_de_la_visita) y ejecutivoDeLaCita (C12)')
if (!paola.ok || !lucia.ok || !ana.ok) throw new Error('las personas de ejemplo deben resolver')
check('Paola: una visita de Trauma (líder) → null', ejecutivoDeLaVisita(paola.persona, [TRAUMA]) === null)
check('Paola: una de Sustitutos (Ejecutiva) → el suyo', ejecutivoDeLaVisita(paola.persona, [SUSTITUTOS]) === 'e-paola')
check('Paola: una con las dos → el suyo (alguna línea es suya como Ejecutiva)', ejecutivoDeLaVisita(paola.persona, [TRAUMA, SUSTITUTOS]) === 'e-paola')
check('Lucía: siempre null', ejecutivoDeLaVisita(lucia.persona, [DEPORTIVA]) === null)
check('Ana: el suyo', ejecutivoDeLaVisita(ana.persona, [ORTOPEDIA]) === 'e-ana')
// visitaSumaALaCuota (C4, A13): la regla con la que el contexto, Mis números y cuenta_para dicen lo mismo.
check('Paola: su visita como Ejecutiva suma a la cuota; la de líder (sin Ejecutivo Comercial) no', visitaSumaALaCuota(paola.persona, { executive_id: 'e-paola' }) && !visitaSumaALaCuota(paola.persona, { executive_id: null }))
check('Ana: una visita con otro Ejecutivo Comercial (de antes de un traspaso) no suma a la suya', !visitaSumaALaCuota(ana.persona, { executive_id: 'e-otra' }))
check('Lucía (líder sin Ejecutivo Comercial, sin cuota): sus visitas cuentan como hechas', visitaSumaALaCuota(lucia.persona, { executive_id: null }))
check('Paola: por defecto la cita es como Ejecutiva, con su Ejecutivo Comercial', igual(ejecutivoDeLaCita(paola.persona), { ok: true, como: 'ejecutivo', executiveId: 'e-paola' }))
check('Paola: como líder → sin Ejecutivo Comercial', igual(ejecutivoDeLaCita(paola.persona, 'lider'), { ok: true, como: 'lider', executiveId: null }))
check('Lucía: por defecto como líder', igual(ejecutivoDeLaCita(lucia.persona), { ok: true, como: 'lider', executiveId: null }))
check(`Lucía como Ejecutiva (no lo es) → "${MENSAJE_SIN_EJECUTIVA}"`, igual(ejecutivoDeLaCita(lucia.persona, 'ejecutivo'), { ok: false, error: MENSAJE_SIN_EJECUTIVA }))
check(`Ana como líder (no lidera nada) → "${MENSAJE_SIN_LINEAS_LIDER}"`, igual(ejecutivoDeLaCita(ana.persona, 'lider'), { ok: false, error: MENSAJE_SIN_LINEAS_LIDER }))

console.log('\n4. medicoDeLineas (C9, espejo de medico_de_lineas)')
const HOY = '2026-10-15'
const BERTA = 'e-berta' // Ejecutiva Comercial activa de Ortopedia y Deportiva
const VIEJA = 'e-vieja' // inactiva, tenía Trauma
const lineasActivas = new Map<string, string[]>([
  [BERTA, [ORTOPEDIA, DEPORTIVA]],
  ['e-ana', [ORTOPEDIA]],
])
const v = (medico_id: string, executive_id: string, line_id: string, desde = '2026-01-01', hasta: string | null = null): VisitanteMedico => ({ medico_id, executive_id, line_id, desde, hasta })
const VISITANTES: VisitanteMedico[] = [
  v('m-en-linea', 'e-ana', DEPORTIVA), // visitante en la línea (aunque Ana no tenga Deportiva)
  v('m-de-berta', BERTA, ORTOPEDIA), // su visitante es de Ortopedia, pero Berta (activa) tiene Deportiva
  v('m-vencido', 'e-ana', DEPORTIVA, '2026-01-01', '2026-10-14'),
  v('m-futuro', 'e-ana', DEPORTIVA, '2026-10-16'),
  v('m-ajeno', 'e-ana', ORTOPEDIA), // de otra línea y de otro Ejecutivo Comercial (Ana no tiene Deportiva)
  v('m-de-vieja', VIEJA, ORTOPEDIA), // visitante inactiva: sus líneas no cuentan
  v('m-hasta-hoy', 'e-ana', DEPORTIVA, '2026-01-01', HOY),
]
const deDeportiva = (medico: string) => medicoDeLineas(medico, [DEPORTIVA], VISITANTES, lineasActivas, HOY)
check('visitante vigente en la línea → sí', deDeportiva('m-en-linea'))
check('visitante de un Ejecutivo Comercial activo con la línea, aunque en otra línea → sí', deDeportiva('m-de-berta'))
check('visitante vencido → no; el que empieza mañana → no; el que vence hoy → sí', !deDeportiva('m-vencido') && !deDeportiva('m-futuro') && deDeportiva('m-hasta-hoy'))
check('de otra línea y de otro Ejecutivo Comercial → no', !deDeportiva('m-ajeno'))
check('visitante de un Ejecutivo Comercial inactivo en otra línea → no (sus líneas no cuentan)', !medicoDeLineas('m-de-vieja', [TRAUMA], VISITANTES, lineasActivas, HOY))
check('sin visitantes → no', !deDeportiva('m-sin-visitante'))
check('con varias líneas basta una', medicoDeLineas('m-ajeno', [TRAUMA, ORTOPEDIA], VISITANTES, lineasActivas, HOY))
check('lineasDelMedico: la del visitante más las del Ejecutivo Comercial activo', igual([...lineasDelMedico('m-de-berta', VISITANTES, lineasActivas, HOY)].sort(), [DEPORTIVA, ORTOPEDIA].sort()))

console.log('\n5. Permisos de la dirección comercial (A1)')
check('commercial_director no tiene visits:report', !hasPermission('commercial_director', 'visits:report'))
check('commercial_director sí tiene calendar:manage y visits:view', hasPermission('commercial_director', 'calendar:manage') && hasPermission('commercial_director', 'visits:view'))
check('sales_manager y line_leader (las líderes) siguen con visits:report', hasPermission('sales_manager', 'visits:report') && hasPermission('line_leader', 'visits:report'))
check('ningún otro permiso de la dirección se perdió (sigue con visits:config)', rolePermissions.commercial_director.includes('visits:config'))

console.log('\n6. Los mensajes son los mismos que lanza la 0850')
const SQL = readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '2026-10-15_0850_persona_de_campo_y_agenda.sql'), 'utf8')
const mensajes = {
  MENSAJE_SIN_LINEAS,
  MENSAJE_DIRECCION_NO_REPORTA,
  MENSAJE_LINEA_AJENA,
  MENSAJE_MEDICO_AJENO,
  MENSAJE_SIN_ZONA,
  MENSAJE_SIN_LINEAS_LIDER,
  MENSAJE_EJECUTIVA_AJENA,
  MENSAJE_CAMBIO_DE_PAPEL,
  MENSAJE_CITA_OTRO_PAPEL,
  MENSAJE_COMO_NO_VALIDO,
  MENSAJE_SIN_EJECUTIVA,
}
const faltan = Object.entries(mensajes).filter(([, texto]) => !SQL.includes(texto.replace(/'/g, "''"))).map(([nombre]) => nombre)
check('cada mensaje de lib/persona-campo.ts está, letra por letra, en la 0850', faltan.length === 0, faltan)

console.log('\n7. La app de campo es solo para las líderes (dueño, 2026-10-30): los Ejecutivos Comerciales van por VMO')
check(
  'appSoloLideres: sin APP_CAMPO_EJECUTIVOS (producción), sí; con "true" (sin importar mayúsculas ni espacios), no; con otra cosa, sí',
  appSoloLideres({}) && appSoloLideres({ APP_CAMPO_EJECUTIVOS: '' }) && appSoloLideres({ APP_CAMPO_EJECUTIVOS: 'false' }) && appSoloLideres({ APP_CAMPO_EJECUTIVOS: '1' }) && !appSoloLideres({ APP_CAMPO_EJECUTIVOS: 'true' }) && !appSoloLideres({ APP_CAMPO_EJECUTIVOS: ' TRUE ' })
)
const soloEc = { ec: [ORTOPEDIA], lider: [], todas: [ORTOPEDIA] }
const dosPapeles = { ec: [ORTOPEDIA], lider: [TRAUMA], todas: [ORTOPEDIA, TRAUMA].sort() }
const soloLider = { ec: [], lider: [TRAUMA], todas: [TRAUMA] }
const ninguna = { ec: [], lider: [], todas: [] }
check('quien solo es Ejecutivo Comercial → MENSAJE_EJECUTIVO_EN_VMO', igual(lineasDeLaApp(soloEc, true), { ok: false, error: MENSAJE_EJECUTIVO_EN_VMO }))
check('Paola (los dos papeles) → solo sus líneas de líder, sin las de Ejecutivo Comercial', igual(lineasDeLaApp(dosPapeles, true), { ok: true, ec: [], lider: [TRAUMA], todas: [TRAUMA] }))
check('una líder sigue igual; sin ninguna línea sigue sin líneas (rolDePersona da null: MENSAJE_SIN_LINEAS)', igual(lineasDeLaApp(soloLider, true), { ok: true, ...soloLider }) && igual(lineasDeLaApp(ninguna, true), { ok: true, ...ninguna }) && rolDePersona([], []) === null)
check('con los Ejecutivos Comerciales adentro (soloLideres false), todo como antes', [soloEc, dosPapeles, soloLider, ninguna].every(lineas => igual(lineasDeLaApp(lineas, false), { ok: true, ...lineas })))
// Una línea que lidera y que también es de su Ejecutivo Comercial: la base haría la visita de Ejecutiva (ejecutivo_de_la_visita)
const cruceUnica = { ec: [ORTOPEDIA, TRAUMA].sort(), lider: [TRAUMA], todas: [ORTOPEDIA, TRAUMA].sort() }
const cruceConOtra = { ec: [TRAUMA], lider: [DEPORTIVA, TRAUMA].sort(), todas: [DEPORTIVA, TRAUMA].sort() }
check('una línea que lidera y que también es de su Ejecutivo Comercial no cuenta como de líder: si es la única → MENSAJE_EJECUTIVO_EN_VMO', igual(lineasDeLaApp(cruceUnica, true), { ok: false, error: MENSAJE_EJECUTIVO_EN_VMO }))
check('...y si lidera otra, entra solo con esa', igual(lineasDeLaApp(cruceConOtra, true), { ok: true, ec: [], lider: [DEPORTIVA], todas: [DEPORTIVA] }))
check(
  'comoDeLaApp: solo para líderes, sin "como" o como líder → lider; "como ejecutivo" → MENSAJE_EJECUTIVO_EN_VMO',
  igual(comoDeLaApp(null, true), { ok: true, como: 'lider' }) && igual(comoDeLaApp(undefined, true), { ok: true, como: 'lider' }) && igual(comoDeLaApp('lider', true), { ok: true, como: 'lider' }) && igual(comoDeLaApp('ejecutivo', true), { ok: false, error: MENSAJE_EJECUTIVO_EN_VMO })
)
check('comoDeLaApp con los Ejecutivos Comerciales adentro: el que llegó, o null (decide la base, C12)', igual(comoDeLaApp(null, false), { ok: true, como: null }) && igual(comoDeLaApp('ejecutivo', false), { ok: true, como: 'ejecutivo' }) && igual(comoDeLaApp('lider', false), { ok: true, como: 'lider' }))

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
