/**
 * Equipo (Entrega 2, spec docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): pruebas PURAS de
 * lib/equipo.ts, sin red ni Supabase. Quién ve a quién (dirección y administrador a todos; cada líder a sí misma y a los
 * Ejecutivos Comerciales de sus líneas; Paola solo como Ejecutiva para la líder de Sustitutos), anticipación de una
 * cita, cadenas de "otra fecha" y cumplimiento del plan, dónde está cada persona, el rastro del día y el rendimiento
 * del periodo con el reparto por línea.
 *
 * Uso (desde web/): npx tsx scripts/equipo-check.ts   (va dentro de npm run test)
 */
import {
  anticipacionDias,
  cadenasDeCitas,
  cumplimientoDelPlan,
  dondeEsta,
  personasVisibles,
  rastroDelDia,
  resumenPorCiudad,
  soloComoEjecutivo,
  type CitaEquipo,
  type PersonaEquipo,
  type Ubicacion,
  type VisitaEquipo,
} from '../lib/equipo'

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
const ids = (personas: readonly PersonaEquipo[]) => personas.map(p => p.userId).sort()

// ---------------------------------------------------------------------------------------------
// Datos: el equipo del ejemplo del dueño
// ---------------------------------------------------------------------------------------------
const TRAUMA = 'l-trauma'
const SUSTITUTOS = 'l-sustitutos'
const DEPORTIVA = 'l-deportiva'
const OSTEO = 'l-osteo'
const COLUMNA = 'l-columna'

type PersonaParcial = Partial<PersonaEquipo> & Pick<PersonaEquipo, 'userId' | 'nombre' | 'papel'>
const persona = (p: PersonaParcial): PersonaEquipo => ({
  executiveId: null,
  kamId: null,
  zona: null,
  municipio: null,
  lineasEc: [],
  lineasLider: [],
  activa: true,
  ...p,
})
const LAURA = { id: 'u-laura', role: 'commercial_director' }
const ADMIN = { id: 'u-admin', role: 'admin' }
const PAOLA = persona({ userId: 'u-paola', nombre: 'Paola', papel: 'lider_y_ejecutivo', executiveId: 'e-paola', kamId: 'k-bga', zona: 'Bucaramanga', municipio: '68001', lineasEc: [SUSTITUTOS], lineasLider: [TRAUMA] })
const LUCIA = persona({ userId: 'u-lucia', nombre: 'Lucía', papel: 'lider', lineasLider: [DEPORTIVA] })
const SOFIA = persona({ userId: 'u-sofia', nombre: 'Sofía', papel: 'lider', lineasLider: [SUSTITUTOS] })
const ANA = persona({ userId: 'u-ana', nombre: 'Ana', papel: 'ejecutivo', executiveId: 'e-ana', kamId: 'k-bog', zona: 'Bogotá Norte', municipio: '11001', lineasEc: [OSTEO, COLUMNA] })
const BERTA = persona({ userId: 'u-berta', nombre: 'Berta', papel: 'ejecutivo', executiveId: 'e-berta', kamId: 'k-cuc', zona: 'Cúcuta', municipio: '54001', lineasEc: [TRAUMA, SUSTITUTOS] })
const CARLA = persona({ userId: 'u-carla', nombre: 'Carla', papel: 'ejecutivo', executiveId: 'e-carla', lineasEc: [OSTEO], activa: false })
const TODAS = [PAOLA, LUCIA, SOFIA, ANA, BERTA, CARLA]

// ---------------------------------------------------------------------------------------------
console.log('\n1. personasVisibles: quién ve a quién')
{
  const laura = personasVisibles(LAURA, TODAS, [])
  check('la dirección ve a todas las personas de campo activas (sin Carla, inactiva) y a nadie solo como Ejecutiva', igual(ids(laura.personas), ids([PAOLA, LUCIA, SOFIA, ANA, BERTA])) && laura.soloComoEjecutivo.size === 0, ids(laura.personas))
  const admin = personasVisibles(ADMIN, TODAS, [])
  check('el administrador, igual que la dirección', igual(ids(admin.personas), ids(laura.personas)) && admin.soloComoEjecutivo.size === 0)
  const paola = personasVisibles({ id: 'u-paola', role: 'line_leader' }, TODAS, [TRAUMA])
  check('Paola (líder de Trauma) se ve a sí misma entera y a Berta (Ejecutiva de Trauma)', igual(ids(paola.personas), ids([PAOLA, BERTA])) && paola.soloComoEjecutivo.size === 0, ids(paola.personas))
  const sofia = personasVisibles({ id: 'u-sofia', role: 'line_leader' }, TODAS, [SUSTITUTOS])
  check('Sofía (líder de Sustitutos) se ve a sí misma, a Berta y a Paola SOLO como Ejecutiva', igual(ids(sofia.personas), ids([SOFIA, BERTA, PAOLA])) && igual([...sofia.soloComoEjecutivo], ['u-paola']), { ids: ids(sofia.personas), solo: [...sofia.soloComoEjecutivo] })
  const ana = personasVisibles({ id: 'u-ana', role: 'sales_manager' }, TODAS, [])
  check('un Ejecutivo Comercial no ve a nadie', ana.personas.length === 0)
  const lucia = personasVisibles({ id: 'u-lucia', role: 'line_leader' }, TODAS, [DEPORTIVA])
  check('una líder sin Ejecutivos en su línea se ve solo a sí misma', igual(ids(lucia.personas), ['u-lucia']))
  const filas = [
    { userId: 'u-paola', executiveId: 'e-paola', que: 'sustitutos' },
    { userId: 'u-paola', executiveId: null, que: 'trauma como líder' },
    { userId: 'u-berta', executiveId: 'e-berta', que: 'berta' },
  ]
  check('soloComoEjecutivo deja de Paola solo lo que hizo con executive_id; lo de las demás, tal cual', igual(soloComoEjecutivo(filas, sofia).map(f => f.que), ['sustitutos', 'berta']) && igual(soloComoEjecutivo(filas, paola).map(f => f.que), ['sustitutos', 'trauma como líder', 'berta']))
}

// ---------------------------------------------------------------------------------------------
type CitaParcial = Partial<CitaEquipo> & Pick<CitaEquipo, 'id' | 'fecha' | 'estado'>
const cita = (c: CitaParcial): CitaEquipo => ({
  userId: 'u-ana',
  executiveId: 'e-ana',
  hora: '10:00',
  createdAt: '2026-10-01T15:00:00Z',
  tipo: 'medica',
  vieneDe: null,
  visitaId: null,
  motivoCodigo: null,
  noRealizadaMotivo: null,
  medicoId: 'm-1',
  medicoNombre: 'Dr. Uno',
  cuentaId: null,
  cuentaNombre: null,
  sedeId: 's-1',
  sedeNombre: 'Clínica Norte',
  municipioId: '11001',
  municipioNombre: 'Bogotá',
  ...c,
})
console.log('\n2. anticipación, cadenas de "otra fecha" y cumplimiento del plan')
{
  check('anticipacionDias: creada el 13 para el 20 → 7', anticipacionDias({ fecha: '2026-10-20', createdAt: '2026-10-13T15:00:00Z' }) === 7)
  check('anticipacionDias: creada el mismo día a las 23:30 de Bogotá (04:30Z del día siguiente) → 0', anticipacionDias({ fecha: '2026-10-20', createdAt: '2026-10-21T04:30:00Z' }) === 0)
  const A = cita({ id: 'A', fecha: '2026-10-05', estado: 'no_realizada', motivoCodigo: 'cliente' })
  const B = cita({ id: 'B', fecha: '2026-10-08', estado: 'hecha', vieneDe: 'A', visitaId: 'v-1', createdAt: '2026-10-05T20:00:00Z' })
  const C = cita({ id: 'C', fecha: '2026-10-12', estado: 'cancelada', vieneDe: 'B', motivoCodigo: 'prioridad' })
  const D = cita({ id: 'D', fecha: '2026-10-25', estado: 'pendiente' })
  const E = cita({ id: 'E', fecha: '2026-10-15', estado: 'cancelada', motivoCodigo: 'cliente' })
  const F = cita({ id: 'F', fecha: '2026-10-18', estado: 'pendiente' })
  const G = cita({ id: 'G', fecha: '2026-10-19', estado: 'hecha', visitaId: 'v-2' })
  const cadenas = cadenasDeCitas([C, D, A, B, E, F, G])
  check('cadenasDeCitas: A ← B ← C es una cadena en orden; D, E, F y G van solas; las cadenas, por la fecha de su primera cita', igual(cadenas.map(c => c.map(x => x.id)), [['A', 'B', 'C'], ['E'], ['F'], ['G'], ['D']]), cadenas.map(c => c.map(x => x.id)))
  const plan = cumplimientoDelPlan([C, D, A, B, E, F, G], '2026-10-20')
  check('cumplimientoDelPlan al 20: [A,B,C] última cancelada → 0; D futura → fuera; E cancelada → 0; F vencida sin cerrar → 0; G hecha → 1: 1 de 4', igual(plan, { programadas: 4, cumplidas: 1, ratio: 0.25 }), plan)
  const plan2 = cumplimientoDelPlan([A, B], '2026-10-20')
  check('la cadena [A no_realizada, B hecha] cuenta UNA vez y cumplida', igual(plan2, { programadas: 1, cumplidas: 1, ratio: 1 }), plan2)
  check('sin citas → ratio null', igual(cumplimientoDelPlan([], '2026-10-20'), { programadas: 0, cumplidas: 0, ratio: null }))
  const H = cita({ id: 'H', fecha: '2026-10-10', estado: 'no_realizada' })
  const I = cita({ id: 'I', fecha: '2026-10-28', estado: 'pendiente', vieneDe: 'H' })
  check('una cadena cuya última cita es futura y pendiente aún no cuenta', igual(cumplimientoDelPlan([H, I], '2026-10-20'), { programadas: 0, cumplidas: 0, ratio: null }))
}

type VisitaParcial = Partial<VisitaEquipo> & Pick<VisitaEquipo, 'id' | 'checkedInAt'>
const visita = (v: VisitaParcial): VisitaEquipo => ({
  userId: 'u-ana',
  executiveId: 'e-ana',
  fecha: v.checkedInAt.slice(0, 10),
  tipo: 'medica',
  modalidad: 'presencial',
  efectiva: true,
  motivoCodigo: null,
  failureReason: null,
  medicoId: 'm-1',
  medicoNombre: 'Dr. Uno',
  cuentaId: null,
  cuentaNombre: null,
  sedeId: 's-1',
  sedeNombre: 'Clínica Norte',
  municipioId: '11001',
  municipioNombre: 'Bogotá',
  lineas: ['l-osteo'],
  agendaId: null,
  agendada: false,
  marcas: [],
  medicoNoListado: null,
  ...v,
})
console.log('\n3. dondeEsta y rastroDelDia')
{
  const FECHA = '2026-10-20'
  const AHORA = new Date('2026-10-20T16:15:00Z') // 11:15 en Bogotá
  const base = { fecha: FECHA, ahora: AHORA, diaLibre: false, festivo: false }
  const v1040 = visita({ id: 'v1', checkedInAt: '2026-10-20T15:40:00Z' }) // 10:40
  const v0750 = visita({ id: 'v2', checkedInAt: '2026-10-20T12:50:00Z', sedeNombre: 'Hospital Sur', municipioNombre: 'Soacha' }) // 07:50
  const tel = visita({ id: 'v3', checkedInAt: '2026-10-20T16:00:00Z', modalidad: 'telefonica', sedeNombre: null, municipioNombre: null })
  const c1130 = cita({ id: 'c1', fecha: FECHA, hora: '11:30', estado: 'pendiente', sedeNombre: 'Clínica Norte' })
  const c1300 = cita({ id: 'c2', fecha: FECHA, hora: '13:00', estado: 'pendiente' })
  const d = (u: Ubicacion) => ({ caso: u.caso, fuente: u.fuente, hora: u.hora, sede: u.sedeNombre, municipio: u.municipioNombre, hace: u.haceMin, marcas: u.marcas })
  check('día libre → dia_libre aunque haya visitas', dondeEsta({ ...base, diaLibre: true, visitas: [v1040], citas: [] }).caso === 'dia_libre')
  check('festivo sin nada → festivo; festivo con visita → reportado', dondeEsta({ ...base, festivo: true, visitas: [], citas: [] }).caso === 'festivo' && dondeEsta({ ...base, festivo: true, visitas: [v1040], citas: [] }).caso === 'reportado')
  check(
    'presencial a las 10:40 → reportado, hace 35 min, con sede y municipio',
    igual(d(dondeEsta({ ...base, visitas: [v1040], citas: [c1130] })), { caso: 'reportado', fuente: 'reportado', hora: '10:40', sede: 'Clínica Norte', municipio: 'Bogotá', hace: 35, marcas: [] }),
    d(dondeEsta({ ...base, visitas: [v1040], citas: [c1130] }))
  )
  check('una telefónica no ubica: con solo telefónica sigue a la cita de ahora', dondeEsta({ ...base, visitas: [tel], citas: [c1130] }).caso === 'planeado')
  check(
    'presencial a las 07:50 (3 h 25 antes) → reportado_hace_rato, hace 205 min, con su municipio',
    igual(d(dondeEsta({ ...base, visitas: [v0750], citas: [] })), { caso: 'reportado_hace_rato', fuente: 'reportado', hora: '07:50', sede: 'Hospital Sur', municipio: 'Soacha', hace: 205, marcas: [] })
  )
  check('la última presencial del día manda (10:40 sobre 07:50)', dondeEsta({ ...base, visitas: [v0750, v1040], citas: [] }).hora === '10:40')
  check(
    'sin visita y cita a las 11:30 (dentro de −30/+60 de 11:15) → planeado',
    igual(d(dondeEsta({ ...base, visitas: [], citas: [c1130] })), { caso: 'planeado', fuente: 'planeado', hora: '11:30', sede: 'Clínica Norte', municipio: 'Bogotá', hace: null, marcas: [] })
  )
  check('cita a las 13:00 (fuera de la ventana) → sin_nada', dondeEsta({ ...base, visitas: [], citas: [c1300] }).caso === 'sin_nada')
  check('una cita de ahora cerrada (hecha o cancelada) no ubica', dondeEsta({ ...base, visitas: [], citas: [{ ...c1130, estado: 'cancelada' }] }).caso === 'sin_nada')
  check('las marcas de la visita que ubica salen', igual(dondeEsta({ ...base, visitas: [{ ...v1040, marcas: ['lejos_de_ips', 'precision_baja'] }], citas: [] }).marcas, ['lejos_de_ips', 'precision_baja']))
  check('otro día (no hoy): la última presencial de ese día, sin "hace"', (() => { const u = dondeEsta({ ...base, fecha: '2026-10-19', ahora: AHORA, visitas: [visita({ id: 'v9', checkedInAt: '2026-10-19T20:00:00Z' })], citas: [] }); return u.caso === 'reportado' && u.haceMin === null && u.hora === '15:00' })())

  // Rastro del día
  const cHecha = cita({ id: 'cA', fecha: FECHA, hora: '09:00', estado: 'hecha', visitaId: 'vA', createdAt: '2026-10-13T15:00:00Z' })
  const vA = visita({ id: 'vA', checkedInAt: '2026-10-20T14:05:00Z', agendaId: 'cA', agendada: true, lineas: ['l-osteo', 'l-columna'] })
  const cNo = cita({ id: 'cB', fecha: FECHA, hora: '10:00', estado: 'no_realizada', motivoCodigo: 'cliente', noRealizadaMotivo: null, medicoNombre: 'Dra. Dos' })
  const vSuelta = visita({ id: 'vC', checkedInAt: '2026-10-20T15:40:00Z', efectiva: false, motivoCodigo: 'sin_tiempo', failureReason: 'No tenía tiempo', medicoNombre: 'Dr. Tres' })
  const cProg = cita({ id: 'cD', fecha: FECHA, hora: '11:30', estado: 'pendiente', medicoNombre: 'Dr. Cuatro' })
  const cAtras = cita({ id: 'cE', fecha: FECHA, hora: '09:30', estado: 'pendiente', medicoNombre: 'Dr. Cinco' })
  const cOtra = cita({ id: 'cF', fecha: FECHA, hora: '16:00', estado: 'pendiente', vieneDe: 'cX', medicoNombre: 'Dr. Seis', createdAt: '2026-10-19T15:00:00Z' })
  const cX = cita({ id: 'cX', fecha: '2026-10-19', hora: '16:00', estado: 'no_realizada', motivoCodigo: 'prioridad' })
  const cSinHora = cita({ id: 'cG', fecha: FECHA, hora: null, estado: 'pendiente', medicoNombre: 'Dr. Siete' })
  const rastro = rastroDelDia({ fecha: FECHA, ahora: AHORA, visitas: [vA, vSuelta], citas: [cHecha, cNo, cProg, cAtras, cOtra, cX, cSinHora] })
  const resumen = rastro.map(p => `${p.hora ?? '--'} ${p.estado} ${p.conQuien ?? ''}`.trim())
  check(
    'rastroDelDia: por hora; la cita hecha va con su visita (una sola vez), la no hecha con su motivo, la suelta como no_efectiva y sin anticipación, la pendiente pasada atrasada, la de otra fecha con viene_de; sin hora al final',
    igual(resumen, ['09:00 hecha Dr. Uno', '09:30 atrasada Dr. Cinco', '10:00 no_realizada Dra. Dos', '10:40 no_efectiva Dr. Tres', '11:30 programada Dr. Cuatro', '16:00 programada Dr. Seis', '-- programada Dr. Siete']),
    resumen
  )
  const hecha = rastro[0]
  const suelta = rastro.find(p => p.visitaId === 'vC')
  const otra = rastro.find(p => p.citaId === 'cF')
  const noHecha = rastro.find(p => p.citaId === 'cB')
  check('la hecha trae anticipación 7, las líneas de la visita y el id de las dos', hecha.anticipacionDias === 7 && igual(hecha.lineas, ['l-osteo', 'l-columna']) && hecha.visitaId === 'vA' && hecha.citaId === 'cA' && hecha.modalidad === 'presencial')
  check('la suelta: anticipación null (no planeada), motivo de la no efectiva, sin cita', suelta?.anticipacionDias === null && suelta?.motivo === 'sin_tiempo' && suelta?.citaId === null)
  check('la de otra fecha: viene_de_fecha 2026-10-19 y anticipación desde su propio created_at (1)', otra?.vieneDeFecha === '2026-10-19' && otra?.anticipacionDias === 1)
  check('la no hecha trae el motivo de cierre', noHecha?.motivo === 'cliente')
  check('la cita de otro día (cX) no entra en el rastro de hoy', !rastro.some(p => p.citaId === 'cX'))

  const ubicaciones: Ubicacion[] = [
    { caso: 'reportado', fuente: 'reportado', hora: '10:00', sedeNombre: 'a', municipioNombre: 'Cartagena', haceMin: 5, marcas: [] },
    { caso: 'reportado_hace_rato', fuente: 'reportado', hora: '07:00', sedeNombre: 'b', municipioNombre: 'Cartagena', haceMin: 250, marcas: [] },
    { caso: 'planeado', fuente: 'planeado', hora: '11:30', sedeNombre: 'c', municipioNombre: 'Bogotá', haceMin: null, marcas: [] },
    { caso: 'sin_nada', fuente: null, hora: null, sedeNombre: null, municipioNombre: null, haceMin: null, marcas: [] },
    { caso: 'dia_libre', fuente: null, hora: null, sedeNombre: null, municipioNombre: null, haceMin: null, marcas: [] },
  ]
  check('resumenPorCiudad: Cartagena 2, Bogotá 1 (más personas primero) y sin nada 1 (el día libre no cuenta como sin nada)', igual(resumenPorCiudad(ubicaciones), { ciudades: [{ nombre: 'Cartagena', personas: 2 }, { nombre: 'Bogotá', personas: 1 }], sinNada: 1 }), resumenPorCiudad(ubicaciones))
}

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
