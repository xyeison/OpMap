/**
 * Equipo (Entrega 2): pruebas de las rutas /api/equipo/* SIN red, con un PostgREST falso de solo lectura
 * (scripts/lib/fake-postgrest.ts) y el reloj fijo. Cubre: sesión y permiso (401/403), quién ve a quién (dirección,
 * administrador, líder; Paola solo como Ejecutiva para la líder de Sustitutos), Hoy con el texto fijo y el resumen,
 * el día de una persona (rastro y siguiente), 404 fuera del alcance, VMO y anuladas fuera, y la privacidad: nunca
 * transcripción, GPS, distancia ni documento o teléfono de un médico.
 *
 * Uso (desde web/): npx tsx scripts/equipo-api-check.ts   (va dentro de npm run test)
 */
import { NextRequest } from 'next/server'

for (const key of ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SESSION_SECRET']) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
const FAKE_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
process.env.SESSION_SECRET = 'secreto-de-prueba-equipo-api-check-0123456789abcdefghijklmnopqrstuvwxyz'

// Reloj falso: martes 20 de octubre de 2026, 11:15 en Bogotá
const RealDate = Date
let ahoraMs = RealDate.parse('2026-10-20T16:15:00.000Z')
class RelojDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(ahoraMs)
    else super(...(args as [number, number, number, number, number, number, number]))
  }
  static now(): number {
    return ahoraMs
  }
}
globalThis.Date = RelojDate as unknown as DateConstructor
function fijarAhora(isoUtc: string) {
  ahoraMs = RealDate.parse(isoUtc)
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
let fetchHandler: FetchHandler | null = null
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (!fetchHandler) throw new Error('equipo-api-check: la red está prohibida en estas pruebas')
  return fetchHandler(input, init)
}) as typeof fetch
const moduleLogs: string[] = []
console.error = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
}

import { fakePostgrest, type Fila, type Tablas } from './lib/fake-postgrest'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { tieneClaves, type FormaApi } from '../../mobile/lib/claves-api'
import { GET as personas } from '../app/api/equipo/personas/route'
import { GET as hoy } from '../app/api/equipo/hoy/route'
import { GET as personaDia } from '../app/api/equipo/persona/[id]/route'
import { TEXTO_FIJO_EQUIPO } from '../lib/reporte-visitas'

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    print(`  FALLA ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`)
  }
}
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const ok = (forma: FormaApi, body: unknown) => tieneClaves(body, forma)

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------
const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`
const LAURA = id('00000000', 1)
const ADMIN = id('00000000', 2)
const PAOLA = id('00000000', 3)
const LUCIA = id('00000000', 4)
const SOFIA = id('00000000', 5)
const ANA = id('00000000', 6)
const BERTA = id('00000000', 7)
const VIEWER = id('00000000', 8)
const CARLA = id('00000000', 9) // inactiva
const TRAUMA = id('10000000', 1)
const SUSTITUTOS = id('10000000', 2)
const DEPORTIVA = id('10000000', 3)
const OSTEO = id('10000000', 4)
const COLUMNA = id('10000000', 5)
const K_BOG = id('20000000', 1)
const K_BGA = id('20000000', 2)
const K_CUC = id('20000000', 3)
const E_PAOLA = id('30000000', 1)
const E_ANA = id('30000000', 2)
const E_BERTA = id('30000000', 3)
const E_CARLA = id('30000000', 4)
const E_VACANTE = id('30000000', 5)
const C1 = id('40000000', 1)
const S1 = id('50000000', 1)
const S2 = id('50000000', 2)
const M1 = id('60000000', 1)
const M2 = id('60000000', 2)
const DOCUMENTO = '987654321'
const TELEFONO = '3001234567'
const SECRETO = 'TRANSCRIPCION-SECRETA'

const usuario = (uid: string, role: string, nombre: string, active = true): Fila => ({ id: uid, email: `${nombre.toLowerCase()}@test.local`, full_name: nombre, role, active, password: `hash-${uid}` })
const visita = (v: Partial<Fila> & { id: string; user_id: string | null; checked_in_at: string }): Fila => ({
  source: 'app',
  executive_id: null,
  tipo: 'medica',
  subtipo_id: null,
  subtipo_codigo: null,
  medico_id: M1,
  cuenta_id: null,
  sede_id: S1,
  contacto_id: null,
  modalidad: 'presencial',
  medio: null,
  efectiva: true,
  failure_reason: null,
  reported_at: v.checked_in_at,
  distance_m: 50,
  gps_accuracy_m: 12,
  lat: 4.7,
  lng: -74.05,
  conclusion: 'Conclusión privada',
  compromisos: null,
  next_step_date: null,
  transcript: SECRETO,
  input_mode: 'toques',
  out_of_territory: false,
  visit_date: v.checked_in_at.slice(0, 10),
  deleted_at: null,
  agenda_id: null,
  agendada: false,
  marcas: [],
  en_sitio: true,
  medico_no_listado: null,
  motivo_codigo: null,
  foto_path: null,
  kam_id: null,
  vmo_id: null,
  ...v,
})
const citaFila = (c: Partial<Fila> & { id: string; user_id: string; fecha: string; estado: string }): Fila => ({
  executive_id: null,
  hora: '10:00',
  tipo: 'medica',
  medico_id: M1,
  cuenta_id: null,
  subtipo_id: null,
  sede_id: S1,
  nota: null,
  visita_id: null,
  cancelada_at: null,
  cancelada_motivo: null,
  created_at: '2026-10-13T15:00:00Z',
  motivo_codigo: null,
  no_realizada_at: null,
  no_realizada_motivo: null,
  eliminada_at: null,
  eliminada_por: null,
  viene_de: null,
  ...c,
})

function datos(): Tablas {
  return {
    users: [
      usuario(LAURA, 'commercial_director', 'Laura'),
      usuario(ADMIN, 'admin', 'Admin'),
      usuario(PAOLA, 'line_leader', 'Paola'),
      usuario(LUCIA, 'line_leader', 'Lucía'),
      usuario(SOFIA, 'line_leader', 'Sofía'),
      usuario(ANA, 'sales_manager', 'Ana'),
      usuario(BERTA, 'sales_manager', 'Berta'),
      usuario(VIEWER, 'viewer', 'Viewer'),
      usuario(CARLA, 'sales_manager', 'Carla', false),
    ],
    business_lines: [
      { id: TRAUMA, code: 'trauma', name: 'Trauma', leader_user_id: PAOLA, active: true },
      { id: SUSTITUTOS, code: 'sustitutos', name: 'Sustitutos óseos', leader_user_id: SOFIA, active: true },
      { id: DEPORTIVA, code: 'deportiva', name: 'Medicina deportiva', leader_user_id: LUCIA, active: true },
      { id: OSTEO, code: 'osteo', name: 'Osteosíntesis', leader_user_id: null, active: true },
      { id: COLUMNA, code: 'columna', name: 'Columna', leader_user_id: null, active: true },
    ],
    kams: [
      { id: K_BOG, name: 'KAM Bogotá Norte', area_id: '11001', active: true },
      { id: K_BGA, name: 'KAM Bucaramanga', area_id: '68001', active: true },
      { id: K_CUC, name: 'KAM Cúcuta', area_id: '54001', active: true },
    ],
    executives: [
      { id: E_PAOLA, full_name: 'Paola Ejecutiva', status: 'active', user_id: PAOLA, base_kam_id: K_BGA, started_at: null, left_at: null },
      { id: E_ANA, full_name: 'Ana Ejecutiva', status: 'active', user_id: ANA, base_kam_id: K_BOG, started_at: null, left_at: null },
      { id: E_BERTA, full_name: 'Berta Ejecutiva', status: 'active', user_id: BERTA, base_kam_id: K_CUC, started_at: null, left_at: null },
      { id: E_CARLA, full_name: 'Carla Ejecutiva', status: 'inactive', user_id: CARLA, base_kam_id: K_BOG, started_at: null, left_at: '2026-10-10' },
      { id: E_VACANTE, full_name: 'Vacante · Cali', status: 'placeholder', user_id: null, base_kam_id: K_BOG, started_at: null, left_at: null },
    ],
    executive_lines: [
      { executive_id: E_PAOLA, line_id: SUSTITUTOS },
      { executive_id: E_ANA, line_id: OSTEO },
      { executive_id: E_ANA, line_id: COLUMNA },
      { executive_id: E_BERTA, line_id: TRAUMA },
      { executive_id: E_BERTA, line_id: SUSTITUTOS },
      { executive_id: E_CARLA, line_id: OSTEO },
      { executive_id: E_VACANTE, line_id: OSTEO },
    ],
    municipalities: [
      { code: '11001', name: 'Bogotá' },
      { code: '68001', name: 'Bucaramanga' },
      { code: '54001', name: 'Cúcuta' },
      { code: '25754', name: 'Soacha' },
    ],
    cuentas: [{ id: C1, nombre: 'Clínica Norte SAS', activo: true }],
    sedes: [
      { id: S1, nombre: 'Clínica Norte', cuenta_id: C1, ciudad: null, municipality_id: '11001', lat: 4.7, lng: -74.05, hospital_id: null, ubicacion_confirmada: true, activo: true },
      { id: S2, nombre: 'Hospital Soacha', cuenta_id: C1, ciudad: null, municipality_id: '25754', lat: 4.58, lng: -74.21, hospital_id: null, ubicacion_confirmada: true, activo: true },
    ],
    medicos: [
      { id: M1, nombre: 'Dr. Uno', especialidades: ['ortopedia'], municipality_id: '11001', tipo_documento: 'CC', numero_documento: DOCUMENTO, telefono: TELEFONO, email: 'uno@privado.test', activo: true },
      { id: M2, nombre: 'Dra. Dos', especialidades: ['ortopedia'], municipality_id: '25754', tipo_documento: 'CC', numero_documento: '111222333', telefono: null, email: null, activo: true },
    ],
    visits: [
      // Ana: una suelta a las 07:50 en Soacha y la de la cita a las 10:40 en Bogotá (la última presencial manda)
      visita({ id: id('70000000', 1), user_id: ANA, executive_id: E_ANA, checked_in_at: '2026-10-20T12:50:00Z', sede_id: S2, medico_id: M2, kam_id: K_BOG }),
      visita({ id: id('70000000', 2), user_id: ANA, executive_id: E_ANA, checked_in_at: '2026-10-20T15:40:00Z', agenda_id: id('80000000', 1), agendada: true, marcas: ['lejos_de_ips'], en_sitio: false, kam_id: K_BOG }),
      // Anulada a las 11:00 (no cuenta) y de VMO (no cuenta)
      visita({ id: id('70000000', 3), user_id: ANA, executive_id: E_ANA, checked_in_at: '2026-10-20T16:00:00Z', deleted_at: '2026-10-20T16:05:00Z', kam_id: K_BOG }),
      visita({ id: id('70000000', 4), user_id: null, executive_id: E_ANA, checked_in_at: '2026-10-20T16:10:00Z', source: 'vmo_import', vmo_id: 123456, kam_id: K_BOG }),
      // Paola: como Ejecutiva a las 08:00 (Sustitutos) y como líder a las 09:00 en Soacha (Trauma)
      visita({ id: id('70000000', 5), user_id: PAOLA, executive_id: E_PAOLA, checked_in_at: '2026-10-20T13:00:00Z', kam_id: K_BGA }),
      visita({ id: id('70000000', 6), user_id: PAOLA, executive_id: null, checked_in_at: '2026-10-20T14:00:00Z', sede_id: S2, medico_id: M2 }),
      // Carla (inactiva): una del 2 de octubre
      visita({ id: id('70000000', 7), user_id: CARLA, executive_id: E_CARLA, checked_in_at: '2026-10-02T14:00:00Z', kam_id: K_BOG }),
    ],
    visit_lines: [
      { visit_id: id('70000000', 1), line_id: OSTEO },
      { visit_id: id('70000000', 2), line_id: OSTEO },
      { visit_id: id('70000000', 2), line_id: COLUMNA },
      { visit_id: id('70000000', 3), line_id: OSTEO },
      { visit_id: id('70000000', 5), line_id: SUSTITUTOS },
      { visit_id: id('70000000', 6), line_id: TRAUMA },
      { visit_id: id('70000000', 7), line_id: OSTEO },
    ],
    visitas_agenda: [
      citaFila({ id: id('80000000', 1), user_id: ANA, executive_id: E_ANA, fecha: '2026-10-20', hora: '10:30', estado: 'hecha', visita_id: id('70000000', 2), created_at: '2026-10-13T15:00:00Z' }),
      citaFila({ id: id('80000000', 2), user_id: ANA, executive_id: E_ANA, fecha: '2026-10-20', hora: '15:00', estado: 'pendiente', medico_id: M2, sede_id: S2, created_at: '2026-10-19T15:00:00Z' }),
      citaFila({ id: id('80000000', 3), user_id: ANA, executive_id: E_ANA, fecha: '2026-10-21', hora: '09:00', estado: 'pendiente', created_at: '2026-10-10T15:00:00Z' }),
      citaFila({ id: id('80000000', 4), user_id: ANA, executive_id: E_ANA, fecha: '2026-10-23', hora: '09:00', estado: 'pendiente', created_at: '2026-10-10T15:00:00Z' }),
      citaFila({ id: id('80000000', 5), user_id: PAOLA, executive_id: null, fecha: '2026-10-20', hora: '14:00', estado: 'pendiente', medico_id: M2, sede_id: S2 }),
      citaFila({ id: id('80000000', 6), user_id: ANA, executive_id: E_ANA, fecha: '2026-10-20', hora: '16:00', estado: 'eliminada', eliminada_at: '2026-10-19T15:00:00Z' }),
    ],
    dias_libres: [{ id: id('90000000', 1), executive_id: E_BERTA, fecha: '2026-10-20', fraccion: 1, motivo: 'vacaciones', estado: 'aprobado' }],
    calendario: [{ id: id('a0000000', 1), fecha: '2026-10-12', alcance: 'nacional', municipality_id: null, tipo: 'no_habil', nombre: 'Día de la raza', origen: 'calculado', anulado_at: null }],
  }
}

const fake = fakePostgrest(FAKE_SUPABASE_URL, datos())
fetchHandler = fake.handler

const cookieDe = (uid: string) => `${SESSION_COOKIE_NAME}=${encodeURIComponent(signSession(uid, passwordVersion(`hash-${uid}`)))}`
type Handler = (request: NextRequest, context: { params: { id: string } }) => Promise<Response>
async function pedir(handler: Handler, path: string, uid: string | null, idRuta = '') {
  const request = new NextRequest(`http://localhost:3000${path}`, { headers: uid ? { cookie: cookieDe(uid) } : {} })
  const response = await handler(request, { params: { id: idRuta } })
  const text = await response.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body, text }
}
const PRIVADO = [SECRETO, 'gps_accuracy_m', 'distance_m', '"lat"', '"lng"', DOCUMENTO, TELEFONO, 'uno@privado.test', 'Conclusión privada', 'conclusion']
const sinPrivado = (text: string) => PRIVADO.every(p => !text.includes(p))

async function main() {
  print('\n1. Sesión y permiso')
  {
    const sin = await pedir(personas, '/api/equipo/personas', null)
    const viewer = await pedir(personas, '/api/equipo/personas', VIEWER)
    const ana = await pedir(hoy, '/api/equipo/hoy?fecha=2026-10-20', ANA)
    const anaDia = await pedir(personaDia, `/api/equipo/persona/${ANA}?fecha=2026-10-20`, ANA, ANA)
    check('sin sesión → 401; viewer → 403; un Ejecutivo Comercial → 403 en hoy y en persona', sin.status === 401 && viewer.status === 403 && ana.status === 403 && anaDia.status === 403, { sin: sin.status, viewer: viewer.status, ana: ana.status, anaDia: anaDia.status })
  }

  print('\n2. GET /api/equipo/personas: quién ve a quién')
  {
    const laura = await pedir(personas, '/api/equipo/personas', LAURA)
    const nombres = (r: { body: any }) => (r.body?.personas ?? []).map((p: any) => p.nombre).sort()
    check('la dirección ve a Paola, Lucía, Sofía, Ana y Berta (sin la vacante ni Carla), con el catálogo de líneas', laura.status === 200 && ok('equipoPersonas', laura.body) && igual(nombres(laura), ['Ana', 'Berta', 'Lucía', 'Paola', 'Sofía']) && laura.body.lineas.length === 5, { status: laura.status, nombres: nombres(laura), body: laura.body })
    const paolaItem = laura.body?.personas?.find((p: any) => p.user_id === PAOLA)
    check('Paola para la dirección: lider_y_ejecutivo, Zona Bucaramanga, Sustitutos "como ejecutivo" y Trauma "como líder", no solo como Ejecutiva', paolaItem?.papel === 'lider_y_ejecutivo' && paolaItem.zona === 'Bucaramanga' && paolaItem.solo_como_ejecutivo === false && igual(paolaItem.lineas.map((l: any) => `${l.nombre}:${l.como}`).sort(), ['Sustitutos óseos:ejecutivo', 'Trauma:lider']), paolaItem)
    const admin = await pedir(personas, '/api/equipo/personas', ADMIN)
    check('el administrador ve lo mismo', admin.status === 200 && igual(nombres(admin), nombres(laura)))
    const paola = await pedir(personas, '/api/equipo/personas', PAOLA)
    check('Paola (líder de Trauma) ve a Paola y Berta', paola.status === 200 && igual(nombres(paola), ['Berta', 'Paola']), nombres(paola))
    const sofia = await pedir(personas, '/api/equipo/personas', SOFIA)
    const paolaParaSofia = sofia.body?.personas?.find((p: any) => p.user_id === PAOLA)
    check('Sofía (líder de Sustitutos) ve a Sofía, Berta y Paola solo como Ejecutiva', sofia.status === 200 && igual(nombres(sofia), ['Berta', 'Paola', 'Sofía']) && paolaParaSofia?.solo_como_ejecutivo === true, { nombres: nombres(sofia), paola: paolaParaSofia })
    const lucia = await pedir(personas, '/api/equipo/personas', LUCIA)
    check('Lucía (sin Ejecutivos en su línea) se ve solo a sí misma', igual(nombres(lucia), ['Lucía']))
    check('nada privado en personas', sinPrivado(laura.text))
  }

  print('\n3. GET /api/equipo/hoy: dónde está cada persona')
  {
    const laura = await pedir(hoy, '/api/equipo/hoy?fecha=2026-10-20', LAURA)
    const donde = (r: { body: any }, uid: string) => r.body?.personas?.find((p: any) => p.persona.user_id === uid)?.donde
    check('forma y texto fijo', laura.status === 200 && ok('equipoHoy', laura.body) && laura.body.texto_fijo === TEXTO_FIJO_EQUIPO && laura.body.fecha === '2026-10-20', laura.body)
    check(
      'Ana: reportado a las 10:40 en Clínica Norte, Bogotá, hace 35 min, con la marca lejos_de_ips (la anulada de las 11:00 y la de VMO no cuentan)',
      igual(donde(laura, ANA), { caso: 'reportado', fuente: 'reportado', hora: '10:40', sede: 'Clínica Norte', municipio: 'Bogotá', hace_min: 35, marcas: ['lejos_de_ips'] }),
      donde(laura, ANA)
    )
    check('Paola para la dirección: su última presencial es la de las 09:00 como líder, en Hospital Soacha', donde(laura, PAOLA)?.hora === '09:00' && donde(laura, PAOLA)?.municipio === 'Soacha', donde(laura, PAOLA))
    check('Berta: día libre; Lucía y Sofía: sin nada', donde(laura, BERTA)?.caso === 'dia_libre' && donde(laura, LUCIA)?.caso === 'sin_nada' && donde(laura, SOFIA)?.caso === 'sin_nada')
    check('resumen: Bogotá 1 · Soacha 1 · sin reporte ni plan 2', igual(laura.body.resumen, { ciudades: [{ nombre: 'Bogotá', personas: 1 }, { nombre: 'Soacha', personas: 1 }], sin_nada: 2 }), laura.body.resumen)
    const sofia = await pedir(hoy, '/api/equipo/hoy?fecha=2026-10-20', SOFIA)
    check('Paola para Sofía: solo lo que hizo como Ejecutiva: reportado hace rato a las 08:00 (195 min)', igual(donde(sofia, PAOLA), { caso: 'reportado_hace_rato', fuente: 'reportado', hora: '08:00', sede: 'Clínica Norte', municipio: 'Bogotá', hace_min: 195, marcas: [] }), donde(sofia, PAOLA))
    const ayer = await pedir(hoy, '/api/equipo/hoy?fecha=2026-10-19', LAURA)
    check('otro día: todos sin nada y sin "hace"', ayer.status === 200 && ayer.body.personas.every((p: any) => p.donde.caso === 'sin_nada' && p.donde.hace_min === null))
    const mala = await pedir(hoy, '/api/equipo/hoy?fecha=20-10-2026', LAURA)
    const sinFecha = await pedir(hoy, '/api/equipo/hoy', LAURA)
    check('fecha inválida → 400; sin fecha → hoy (reloj falso)', mala.status === 400 && sinFecha.status === 200 && sinFecha.body.fecha === '2026-10-20')
    check('nada privado en hoy', sinPrivado(laura.text) && sinPrivado(sofia.text))
  }

  print('\n4. GET /api/equipo/persona/[id]: el día de una persona')
  {
    const ana = await pedir(personaDia, `/api/equipo/persona/${ANA}?fecha=2026-10-20`, LAURA, ANA)
    const resumen = (ana.body?.rastro ?? []).map((p: any) => `${p.hora ?? '--'} ${p.estado} ${p.con_quien ?? ''}`.trim())
    check('forma: persona, donde, rastro y siguiente', ana.status === 200 && ok('equipoPersonaDia', ana.body) && ana.body.persona.user_id === ANA && ana.body.donde.hora === '10:40', ana.body)
    check('rastro de Ana por hora: 07:50 hecha (suelta), 10:30 hecha con su cita (una sola vez), 15:00 programada; la eliminada no sale', igual(resumen, ['07:50 hecha Dra. Dos', '10:30 hecha Dr. Uno', '15:00 programada Dra. Dos']), resumen)
    const hecha = ana.body?.rastro?.[1]
    check('la hecha: anticipación 7, líneas Osteosíntesis y Columna (nombres), marca lejos_de_ips, con los dos ids', hecha?.anticipacion_dias === 7 && igual(hecha.lineas, ['Columna', 'Osteosíntesis']) && igual(hecha.marcas, ['lejos_de_ips']) && hecha.visita_id === id('70000000', 2) && hecha.cita_id === id('80000000', 1), hecha)
    const siguiente = (ana.body?.siguiente ?? []).map((p: any) => `${p.fecha} ${p.hora}`)
    check('siguiente: lo de hoy que falta (15:00) y los dos días que vienen (21), no la del 23', igual(siguiente, ['2026-10-20 15:00', '2026-10-21 09:00']), siguiente)
    const paolaSofia = await pedir(personaDia, `/api/equipo/persona/${PAOLA}?fecha=2026-10-20`, SOFIA, PAOLA)
    check('Paola para Sofía: solo los pasos como Ejecutiva (08:00), sin la cita de las 14:00 como líder', paolaSofia.status === 200 && igual((paolaSofia.body.rastro ?? []).map((p: any) => p.hora), ['08:00']) && paolaSofia.body.siguiente.length === 0, paolaSofia.body?.rastro)
    const luciaParaPaola = await pedir(personaDia, `/api/equipo/persona/${LUCIA}?fecha=2026-10-20`, PAOLA, LUCIA)
    const nadie = await pedir(personaDia, `/api/equipo/persona/${id('00000000', 99)}?fecha=2026-10-20`, LAURA, id('00000000', 99))
    const carla = await pedir(personaDia, `/api/equipo/persona/${CARLA}?fecha=2026-10-02`, LAURA, CARLA)
    check('fuera del alcance → 404 (Lucía para Paola, un id inexistente y Carla inactiva para la dirección)', luciaParaPaola.status === 404 && nadie.status === 404 && carla.status === 404, { lucia: luciaParaPaola.status, nadie: nadie.status, carla: carla.status })
    check('nada privado en el día de una persona', sinPrivado(ana.text) && sinPrivado(paolaSofia.text))
  }

  check('nada salió a la red salvo al Supabase falso', fake.externas.length === 0, fake.externas)
  print(`\nequipo-api-check: ${passed} OK, ${failed} fallas`)
  if (moduleLogs.length > 0) print(`(mensajes de las rutas recogidos: ${moduleLogs.length})`)
  if (failed > 0) process.exit(1)
}

main().catch(error => {
  print(`equipo-api-check: error inesperado ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  process.exit(1)
})
void fijarAhora
