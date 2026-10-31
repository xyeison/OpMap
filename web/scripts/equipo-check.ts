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
  personasVisibles,
  soloComoEjecutivo,
  type CitaEquipo,
  type PersonaEquipo,
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

// ---------------------------------------------------------------------------------------------
console.log(`\n${passed} pruebas bien, ${failed} con falla`)
if (failed > 0) process.exit(1)
