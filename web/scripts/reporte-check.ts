/**
 * Fase 8 · F3 reporte de visitas y voz: pruebas PURAS de lib/reporte-visitas.ts y lib/reporte-visitas-schemas.ts,
 * y de la sesión del teléfono (portador) y el CORS de desarrollo (lib/auth-server.ts, middleware.ts,
 * /api/auth/login, /api/auth/logout, /api/auth/me) contra un Supabase FALSO en memoria. SIN red ni Supabase real.
 * Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md (secciones "Código puro", "Sesión del teléfono
 * y CORS" y "Verificación").
 *
 * Cubre: Haversine con casos conocidos (Bogotá–Medellín ≈ 240 km; dos puntos a 500 m) y los MISMOS enteros que la 0830
 * exige a visitas_distancia_m (334, 801, 194, 500, 238673, 0; leídos del archivo de la migración) en la web y en la app
 * (mobile/lib/geo.ts da lo mismo que la web en esos casos y en 500 pares); fechas en Bogotá
 * (medianoche UTC frente a Bogotá); validarVisita en todos los casos del contrato (dentro y fuera del radio con el
 * mensaje, sede sin coordenadas, telefónica sin habilitar, con tope y con medio ajeno, tope por médico, perfil,
 * líneas ajenas, ayer, institucional sin subtipo, contacto de otra cuenta, out_of_territory); cumplimientoMes con
 * pesos y vigencias (Compras 1 en octubre y 0,5 desde noviembre: octubre no cambia); compromisosVencidos;
 * sedesCercanas (orden y tope); normalizarPropuesta descarta ids ajenos y nunca deja documentos; esquemas zod con
 * límites; portador (cookie frente a bearer; bearer fuera de /api rechazado; pv viejo rechazado); login móvil sin
 * Set-Cookie; /api/auth/me con la ejecutiva enlazada; logout con portador 200; CORS solo en desarrollo (en
 * producción ninguna cabecera); los límites de intentos del login (10 por IP y minuto, 5 fallos por email en 15
 * minutos) son los mismos con cliente móvil y sin él (429 con Retry-After, sin token ni cookie).
 *
 * Uso (desde web/): npx tsx scripts/reporte-check.ts   (va dentro de npm run test)
 * Código de salida 1 si alguna prueba falla.
 */
import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { passwordVersion, SESSION_COOKIE_NAME, signSession } from '../lib/session'
import { ejecutivaEnlazada, esRutaApi, getUserFromRequest, readBearer, readSessionToken } from '../lib/auth-server'
import { middleware } from '../middleware'
import { POST as login } from '../app/api/auth/login/route'
import { POST as logout } from '../app/api/auth/logout/route'
import { POST as sesionApp } from '../app/api/auth/sesion-app/route'
import { GET as me } from '../app/api/auth/me/route'
import { GENERAL_POR_DEFECTO, MENSAJE_SIN_EJECUTIVA, type ConteoVigencia, type GeneralVigencia } from '../lib/visits-rules'
import { haversineM as haversineMovil } from '../../mobile/lib/geo'
import {
  ESTADOS_CITA,
  HERRAMIENTA_CAMPOS,
  MAX_DIAS_CONSULTA_AGENDA,
  MENSAJE_CITA_AJENA,
  MENSAJE_CITA_CANCELADA,
  MENSAJE_CITA_DIA_LIBRE,
  MENSAJE_CITA_OTRA_CUENTA,
  MENSAJE_CITA_OTRO_DIA,
  MENSAJE_CITA_OTRO_MEDICO,
  MENSAJE_CITA_OTRO_TIPO,
  MENSAJE_CITA_PASADA,
  MENSAJE_CITA_YA_HECHA,
  MENSAJE_HORA_OBLIGATORIA,
  PROMPT_CAMPOS,
  citaAnticipada,
  citaCancelable,
  citaParaVincular,
  cuentasAgenda,
  distanciaACita,
  esDiaLibreCompleto,
  esquemaCampos,
  horaCorta,
  mensajeCampos,
  mensajeFechaCita,
  nombreDiaSemana,
  normalizarCampos,
  ordenarCitas,
  rangoConsultaAgenda,
  revisarCitaElegida,
  visitaQueRetomaCita,
  type VisitaParaRetomar,
  vinculoDeVisita,
  type CitaItem,
  type CitaVinculo,
  type VisitaParaVinculo,
  AUDIO_MAX_BYTES,
  MENSAJE_CONTACTO_OTRA_CUENTA,
  MENSAJE_LINEAS_AJENAS,
  MENSAJE_MEDICO_NO_EXISTE,
  MENSAJE_REPORTE_ANTES_DE_LLEGADA,
  MENSAJE_LLEGADA_FUTURA,
  MENSAJE_REPORTE_FUTURO,
  MENSAJE_PROXIMA_ANTES_DE_VISITA,
  MENSAJE_REINTENTO_ANTES_DE_VISITA,
  MENSAJE_CUENTA_INACTIVA,
  MENSAJE_CONTACTO_INACTIVO,
  MAX_M_SEDE_APP_AL_MUNICIPIO,
  LIMITES_VOZ,
  TOLERANCIA_RELOJ_SEGUNDOS,
  MENSAJE_SEDE_NO_DE_LA_CUENTA,
  MENSAJE_SEDE_NO_DEL_MEDICO,
  MENSAJE_SEDE_SIN_UBICACION,
  MENSAJE_SIN_ZONA,
  MENSAJE_SOLO_HOY,
  MENSAJE_SUBTIPO_NO_VIGENTE,
  MENSAJE_TELEFONICA_NO_HABILITADA,
  MENSAJE_TOPE_MEDICO,
  NUMERO_OMITIDO,
  PROMPT_PROPUESTA,
  RADIO_TIERRA_M,
  TERMINOS_VG,
  compromisosVencidos,
  contextoDictado,
  cumplimientoMes,
  duracionAudioSegundos,
  esAudioPermitido,
  esHoyBogota,
  esInstanteIso,
  esquemaPropuesta,
  fechaBogota,
  finDelDiaBogota,
  haversineM,
  horaBogota,
  mensajeFueraDeRadio,
  mensajeMedio,
  mensajePerfil,
  mensajeTopeTelefonicas,
  normalizarPropuesta,
  numerosDesdeCumplimiento,
  ocultarNumerosLargos,
  radioEfectivo,
  resumenHoy,
  revisarLimite,
  sedeAppConfirmada,
  mismoPrestador,
  sedesCercanas,
  telefonicaEfectiva,
  textoDistancia,
  validarVisita,
  valorReporte,
  visitaEditable,
  vocabularioVG,
  type ConfigContexto,
  type ContextoResponse,
  type ContextoValidacion,
  type PropuestaCruda,
  type VisitaCreate,
  type VisitaDeHoy,
  MENSAJE_CONTACTO_OBLIGATORIO,
} from '../lib/reporte-visitas'
import { MENSAJE_CANCELAR_SIN_MOTIVO, MENSAJE_CITA_CERRADA } from '../lib/agenda-ciclo'
import { MENSAJE_CITA_OTRO_PAPEL } from '../lib/persona-campo'
import {
  agendaQuerySchema,
  camposDictadoSchema,
  camposSchema,
  citaCancelarSchema,
  citaCreateSchema,
  anularSchema,
  audioMetaSchema,
  contextoQuerySchema,
  loginMovilSchema,
  numerosQuerySchema,
  proponerSchema,
  propuestaSchema,
  visitaCreateSchema,
  visitaUpdateSchema,
  visitasQuerySchema,
} from '../lib/reporte-visitas-schemas'

for (const key of ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'SESSION_SECRET']) {
  delete process.env[key]
}
process.env.GOOGLE_ROUTES_DISABLED = 'true'
const FAKE_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_URL = FAKE_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba'
process.env.SESSION_SECRET = 'secreto-de-prueba-reporte-check-0123456789abcdefghijklmnopqrstuvwxyz'

// Los console.error de las rutas se recogen aquí para no ensuciar la salida.
const moduleLogs: string[] = []
console.error = (...args: unknown[]) => {
  moduleLogs.push(args.map(arg => (arg instanceof Error ? `${arg.name}: ${arg.message}` : typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' '))
}

// ---------------------------------------------------------------------------
// Mini marco de pruebas
// ---------------------------------------------------------------------------

const print = (line = '') => process.stdout.write(`${line}\n`)
let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++
    print(`  OK    ${name}`)
  } else {
    failed++
    const texto = detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail)
    print(`  FALLA ${name}${texto ? ` -> ${texto.slice(0, 700)}` : ''}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 600)}`)
  }
}

const seccion = (titulo: string) => print(`\n${titulo}`)

/** Primer mensaje de zod para un campo (o el primero de todos). */
function mensajeZod(resultado: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }, campo?: string): string | null {
  if (resultado.success || !resultado.error) return null
  const issue = campo ? resultado.error.issues.find(i => i.path.join('.') === campo) : resultado.error.issues[0]
  return issue?.message ?? null
}

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const EJEC = 'aaaaaaaa-0000-4000-8000-000000000001'
const L1 = 'bbbbbbbb-0000-4000-8000-000000000001'
const L2 = 'bbbbbbbb-0000-4000-8000-000000000002'
const L_AJENA = 'bbbbbbbb-0000-4000-8000-000000000009'
const SEDE1 = 'cccccccc-0000-4000-8000-000000000001'
const SEDE2 = 'cccccccc-0000-4000-8000-000000000002'
const SEDE_SIN_GPS = 'cccccccc-0000-4000-8000-000000000003'
const CUENTA1 = 'dddddddd-0000-4000-8000-000000000001'
const CUENTA2 = 'dddddddd-0000-4000-8000-000000000002'
const CUENTA3 = 'dddddddd-0000-4000-8000-000000000003'
const MED1 = 'eeeeeeee-0000-4000-8000-000000000001'
const MED_AJENO = 'eeeeeeee-0000-4000-8000-000000000002'
const SUB_COMPRAS = 'ffffffff-0000-4000-8000-000000000001'
const SUB_QUIMICO = 'ffffffff-0000-4000-8000-000000000002'
const SUB_PROGRAMACION = 'ffffffff-0000-4000-8000-000000000003'
const CONT1 = '99999999-0000-4000-8000-000000000001'
const CLIENT_ID = '12345678-1234-4123-8123-123456789abc'

/** Clínica Norte (Bogotá). */
const SEDE_PUNTO = { lat: 4.7110, lng: -74.0721 }
const BOGOTA = { lat: 4.711, lng: -74.0721 }
const MEDELLIN = { lat: 6.2442, lng: -75.5812 }
/** Grados de latitud por metro (sobre el radio del contrato). */
const GRADOS_POR_METRO = 180 / (Math.PI * RADIO_TIERRA_M)
const aMetrosAlNorte = (punto: { lat: number; lng: number }, metros: number) => ({ lat: punto.lat + metros * GRADOS_POR_METRO, lng: punto.lng })

const HOY = '2026-10-13'
/** 10:42 en Bogotá del 13 de octubre. */
const AHORA = new Date('2026-10-13T15:42:00.000Z')

const contextoBase = (): ContextoValidacion => ({
  ejecutiva: { id: EJEC, activa: true, con_zona: true, lineas: [L1, L2] },
  sede: { id: SEDE1, nombre: 'Clínica Norte', cuenta_id: CUENTA1, lat: SEDE_PUNTO.lat, lng: SEDE_PUNTO.lng },
  medico: { id: MED1, nombre: 'Dr. Pérez', activo: true, sede_ids: [SEDE1], es_visitante: true },
  subtipo: { id: SUB_COMPRAS, codigo: 'compras', vigente_desde: '2026-10-12', vigente_hasta: null },
  contacto: { id: CONT1, cuenta_id: CUENTA1 },
})

const configBase = (): ConfigContexto => ({
  radio_m: 500,
  telefonica: { habilitada: false, tope_dia: 1, medios: ['llamada', 'videollamada'] },
  tope_visitas_medico_dia: 1,
  perfil: ['medica', 'institucional'],
})

const cuerpoMedica = (extra: Record<string, unknown> = {}) => ({
  client_id: CLIENT_ID,
  tipo: 'medica',
  medico_id: MED1,
  sede_id: SEDE1,
  modalidad: 'presencial',
  ...aMetrosAlNorte(SEDE_PUNTO, 120),
  gps_accuracy_m: 8,
  efectiva: true,
  checked_in_at: '2026-10-13T10:40:00-05:00',
  reported_at: '2026-10-13T10:42:00-05:00',
  conclusion: 'Le mostré PerOssal',
  input_mode: 'voz',
  lineas: [L1],
  ...extra,
})

const cuerpoInstitucional = (extra: Record<string, unknown> = {}) =>
  cuerpoMedica({ tipo: 'institucional', medico_id: undefined, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, contacto_id: CONT1, ...extra })

const parsear = (cuerpo: Record<string, unknown>): VisitaCreate => visitaCreateSchema.parse(cuerpo)

const validar = (datos: VisitaCreate, cambios: { contexto?: Partial<ContextoValidacion>; config?: Partial<ConfigContexto>; visitasDeHoy?: VisitaDeHoy[] } = {}) =>
  validarVisita({
    datos,
    contexto: { ...contextoBase(), ...cambios.contexto },
    config: { ...configBase(), ...cambios.config },
    hoy: HOY,
    ahora: AHORA,
    visitasDeHoy: cambios.visitasDeHoy ?? [],
  })

const mensajes = (resultado: { errores: { campo: string; mensaje: string }[] }) => resultado.errores.map(e => e.mensaje)

/** Casos exactos de distancia: los mismos puntos y enteros que la 0830 (8.2) y mobile/scripts/movil-check.ts. */
const CASOS_HAVERSINE: { a: { lat: number; lng: number }; b: { lat: number; lng: number }; m: number }[] = [
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.603, lng: -74.08 }, m: 334 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.6072, lng: -74.08 }, m: 801 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.601234, lng: -74.081234 }, m: 194 },
  { a: { lat: 4.6, lng: -74.08 }, b: { lat: 4.6045, lng: -74.08 }, m: 500 },
  { a: { lat: 4.711, lng: -74.0721 }, b: { lat: 6.2442, lng: -75.5812 }, m: 238673 },
  { a: { lat: 6.2442, lng: -75.5812 }, b: { lat: 4.711, lng: -74.0721 }, m: 238673 },
  { a: { lat: 4.711, lng: -74.0721 }, b: { lat: 4.711, lng: -74.0721 }, m: 0 },
]

/** Lee del archivo de la migración 0830 los casos `visitas_distancia_m(lat1, lng1, lat2, lng2) <> metros`. */
function casosHaversineDeLa0830(): typeof CASOS_HAVERSINE {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/2026-10-13_0830_visitas_app.sql'), 'utf8')
  const patron = /visitas_distancia_m\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*<>\s*(\d+)/g
  return Array.from(sql.matchAll(patron), ([, lat1, lng1, lat2, lng2, metros]) => ({
    a: { lat: Number(lat1), lng: Number(lng1) },
    b: { lat: Number(lat2), lng: Number(lng2) },
    m: Number(metros),
  }))
}

// ---------------------------------------------------------------------------
// 1. Haversine
// ---------------------------------------------------------------------------

seccion('1. Haversine (metros enteros, radio 6371008.8 m)')
{
  const bogotaMedellin = haversineM(BOGOTA, MEDELLIN)
  check('Bogotá–Medellín ≈ 240 km', bogotaMedellin > 235_000 && bogotaMedellin < 245_000, bogotaMedellin)
  check('es simétrica', haversineM(MEDELLIN, BOGOTA) === bogotaMedellin)
  check('mismo punto → 0', haversineM(BOGOTA, BOGOTA) === 0)
  const quinientos = haversineM(SEDE_PUNTO, aMetrosAlNorte(SEDE_PUNTO, 500))
  check('dos puntos a 500 m → 500 (±1)', Math.abs(quinientos - 500) <= 1, quinientos)
  const ochocientos = haversineM(SEDE_PUNTO, aMetrosAlNorte(SEDE_PUNTO, 800))
  check('dos puntos a 800 m → 800 (±1)', Math.abs(ochocientos - 800) <= 1, ochocientos)
  check('devuelve entero', Number.isInteger(haversineM(SEDE_PUNTO, { lat: 4.7123456, lng: -74.0712345 })))
  check('al este también mide (≈ 1 km a 0,009° de longitud en el ecuador)', Math.abs(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0.009 }) - 1001) <= 1)
  check('textoDistancia: 350 m y 2,4 km', textoDistancia(350) === '350 m' && textoDistancia(2400) === '2,4 km')

  // Paridad EXACTA con la base: los mismos puntos y los mismos enteros que el bloque DO de la 0830 (8.2) exige a
  // visitas_distancia_m. La lista se lee del propio archivo de la migración (si alguien cambia una cifra allá o aquí,
  // esto falla) y además está escrita aquí y en mobile/scripts/movil-check.ts con las mismas cifras.
  const deLa0830 = casosHaversineDeLa0830()
  check('la 0830 trae los 7 casos exactos de distancia (334, 801, 194, 500, 238673 ida y vuelta, 0)', deLa0830.length === CASOS_HAVERSINE.length, deLa0830)
  check(
    'los casos de la 0830 son los de esta prueba (mismos puntos, mismas cifras, mismo orden)',
    JSON.stringify(deLa0830) === JSON.stringify(CASOS_HAVERSINE),
    { sql: deLa0830, ts: CASOS_HAVERSINE }
  )
  for (const caso of CASOS_HAVERSINE) {
    const metros = haversineM(caso.a, caso.b)
    check(`haversineM(${caso.a.lat}, ${caso.a.lng} → ${caso.b.lat}, ${caso.b.lng}) = ${caso.m} exactos, como visitas_distancia_m`, metros === caso.m, metros)
  }
  const ecuador = haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 0.009 })
  check('0,009° de longitud en el ecuador: entre 1000 y 1002 (el mismo rango que la 0830)', ecuador >= 1000 && ecuador <= 1002, ecuador)
  // La de la app (mobile/lib/geo.ts) da exactamente lo mismo: los casos de la 0830 y 500 pares por Colombia.
  let semilla = 20261013
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647 // Park–Miller: exacto en double
  const pares = Array.from({ length: 500 }, () => {
    const a = { lat: -4.2 + azar() * 16.6, lng: -79 + azar() * 12.3 }
    return { a, b: { lat: a.lat + (azar() - 0.5) * (azar() < 0.5 ? 0.02 : 4), lng: a.lng + (azar() - 0.5) * (azar() < 0.5 ? 0.02 : 4) } }
  })
  const distintos = [...CASOS_HAVERSINE, ...pares].filter(({ a, b }) => haversineM(a, b) !== haversineMovil(a, b))
  check('la Haversine de la app (mobile/lib/geo.ts) da los mismos enteros que la del servidor (507 pares)', distintos.length === 0, distintos.slice(0, 3))
}

// ---------------------------------------------------------------------------
// 2. Fechas en Bogotá
// ---------------------------------------------------------------------------

seccion('2. Fechas en Bogotá (UTC−5)')
{
  check('03:30 UTC del 14 es el 13 en Bogotá', fechaBogota('2026-10-14T03:30:00Z') === '2026-10-13')
  check('05:00 UTC del 13 es la medianoche del 13 en Bogotá', fechaBogota('2026-10-13T05:00:00Z') === '2026-10-13')
  check('04:59:59 UTC del 13 todavía es el 12 en Bogotá', fechaBogota('2026-10-13T04:59:59Z') === '2026-10-12')
  check('medianoche UTC del 13 es el 12 en Bogotá', fechaBogota('2026-10-13T00:00:00+00:00') === '2026-10-12')
  check('23:30 −05:00 del 13 es el 13', fechaBogota('2026-10-13T23:30:00-05:00') === '2026-10-13')
  check('acepta Date', fechaBogota(new Date('2026-10-14T03:30:00Z')) === '2026-10-13')
  check('horaBogota 15:42Z → 10:42', horaBogota('2026-10-13T15:42:00Z') === '10:42')
  check('esHoyBogota: 03:30 UTC del 14 es hoy si ahora son las 02:00 UTC del 14', esHoyBogota('2026-10-14T03:30:00Z', new Date('2026-10-14T02:00:00Z')))
  check('esHoyBogota: pero no si ya son las 05:00 UTC del 14 (el 14 en Bogotá)', !esHoyBogota('2026-10-14T03:30:00Z', new Date('2026-10-14T05:00:00Z')))
  check('esHoyBogota: instante inválido → false', !esHoyBogota('ayer', AHORA))
  check('esInstanteIso acepta zona Z, ±HH:MM y milisegundos', esInstanteIso('2026-10-13T10:42:00-05:00') && esInstanteIso('2026-10-13T15:42:00Z') && esInstanteIso('2026-10-13T15:42:00.123Z') && esInstanteIso('2026-10-13T15:42-0500'))
  check('esInstanteIso rechaza fecha sola, hora sin zona y basura', !esInstanteIso('2026-10-13') && !esInstanteIso('2026-10-13T10:42:00') && !esInstanteIso('x') && !esInstanteIso(null))
  check('finDelDiaBogota: 23:59:59.999 del 13 en Bogotá = 04:59:59.999Z del 14', finDelDiaBogota('2026-10-13').toISOString() === '2026-10-14T04:59:59.999Z')
  let lanza = false
  try {
    fechaBogota('no es fecha')
  } catch {
    lanza = true
  }
  check('fechaBogota lanza con un instante inválido', lanza)
}

// ---------------------------------------------------------------------------
// 3. Radio y telefónica efectivos
// ---------------------------------------------------------------------------

seccion('3. radioEfectivo y telefonicaEfectiva')
{
  check('sin fila de persona: radio general 500', radioEfectivo(GENERAL_POR_DEFECTO, null) === 500)
  check('con radio propio 800 → 800', radioEfectivo(GENERAL_POR_DEFECTO, { radio_m: 800 }) === 800)
  check('radio propio NULL → general', radioEfectivo(GENERAL_POR_DEFECTO, { radio_m: null }) === 500)
  const sinFila = telefonicaEfectiva(GENERAL_POR_DEFECTO, null)
  check('sin fila: telefónica no habilitada, tope 1, medios generales', !sinFila.habilitada && sinFila.tope_dia === 1 && sinFila.medios.join(',') === 'llamada,videollamada')
  const conFila = telefonicaEfectiva(GENERAL_POR_DEFECTO, { telefonica_habilitada: true, tope_telefonicas_dia: 3 })
  check('con fila: habilitada y tope propio 3', conFila.habilitada && conFila.tope_dia === 3)
  check('tope propio NULL → tope general', telefonicaEfectiva(GENERAL_POR_DEFECTO, { telefonica_habilitada: true, tope_telefonicas_dia: null }).tope_dia === 1)
  check('los medios son copia (no el arreglo de la config)', conFila.medios !== GENERAL_POR_DEFECTO.telefonicas.medios)
}

// ---------------------------------------------------------------------------
// 4. validarVisita (espejo de visitas_registrar, pasos 2 a 7)
// ---------------------------------------------------------------------------

seccion('4. validarVisita')
{
  const dentro = validar(parsear(cuerpoMedica()))
  check('médica presencial a 120 m: ok, distance_m ≈ 120, dentro del territorio', dentro.ok && dentro.distance_m !== null && Math.abs(dentro.distance_m - 120) <= 1 && !dentro.out_of_territory, dentro)

  const lejos = validar(parsear(cuerpoMedica(aMetrosAlNorte(SEDE_PUNTO, 800))))
  const mensajeLejos = lejos.errores.find(e => e.campo === 'lat')?.mensaje ?? ''
  check(
    'presencial a 800 m: rechazada con "Estás a N m de <sede>; el radio es R m"',
    !lejos.ok && lejos.distance_m !== null && Math.abs(lejos.distance_m - 800) <= 1 && mensajeLejos === mensajeFueraDeRadio(lejos.distance_m, 'Clínica Norte', 500) && mensajeLejos.endsWith('m de Clínica Norte; el radio es 500 m'),
    lejos
  )
  check('a 800 m con radio propio de 1000 m: ok', validar(parsear(cuerpoMedica(aMetrosAlNorte(SEDE_PUNTO, 800))), { config: { radio_m: 1000 } }).ok)
  check('justo en el radio (500 m) pasa; a 501 no', validar(parsear(cuerpoMedica(aMetrosAlNorte(SEDE_PUNTO, 500)))).ok && !validar(parsear(cuerpoMedica(aMetrosAlNorte(SEDE_PUNTO, 502)))).ok)

  const sinGps = validar(parsear(cuerpoMedica({ sede_id: SEDE_SIN_GPS })), {
    contexto: {
      sede: { id: SEDE_SIN_GPS, nombre: 'Consultorio Pérez', cuenta_id: CUENTA1, lat: null, lng: null },
      medico: { id: MED1, nombre: 'Dr. Pérez', activo: true, sede_ids: [SEDE1, SEDE_SIN_GPS], es_visitante: true },
    },
  })
  check('sede sin coordenadas: presencial rechazada con el mensaje de la decisión 6', !sinGps.ok && mensajes(sinGps).includes(MENSAJE_SEDE_SIN_UBICACION) && sinGps.distance_m === null)
  const sinGpsTelefonica = validar(parsear(cuerpoMedica({ sede_id: SEDE_SIN_GPS, modalidad: 'telefonica', medio: 'llamada', lat: undefined, lng: undefined })), {
    contexto: {
      sede: { id: SEDE_SIN_GPS, nombre: 'Consultorio Pérez', cuenta_id: CUENTA1, lat: null, lng: null },
      medico: { id: MED1, nombre: 'Dr. Pérez', activo: true, sede_ids: [SEDE1, SEDE_SIN_GPS], es_visitante: true },
    },
    config: { telefonica: { habilitada: true, tope_dia: 1, medios: ['llamada', 'videollamada'] } },
  })
  check('sede sin coordenadas: telefónica sí', sinGpsTelefonica.ok && sinGpsTelefonica.distance_m === null, sinGpsTelefonica)

  const telefonica = (extra: Record<string, unknown> = {}) => parsear(cuerpoMedica({ modalidad: 'telefonica', medio: 'llamada', lat: undefined, lng: undefined, ...extra }))
  const noHabilitada = validar(telefonica())
  check('telefónica sin habilitar: rechazada', !noHabilitada.ok && mensajes(noHabilitada).includes(MENSAJE_TELEFONICA_NO_HABILITADA))
  const habilitada = { telefonica: { habilitada: true, tope_dia: 1, medios: ['llamada', 'videollamada'] as ('llamada' | 'videollamada')[] } }
  check('telefónica habilitada: ok, sin distancia', validar(telefonica(), { config: habilitada }).ok && validar(telefonica(), { config: habilitada }).distance_m === null)
  const conTope = validar(telefonica(), { config: habilitada, visitasDeHoy: [{ medico_id: MED_AJENO, modalidad: 'telefonica', efectiva: true }] })
  check('telefónica con el tope del día lleno (1 de 1): rechazada', !conTope.ok && mensajes(conTope).includes(mensajeTopeTelefonicas(1)), conTope)
  check('una telefónica NO efectiva de hoy no gasta el tope', validar(telefonica(), { config: habilitada, visitasDeHoy: [{ medico_id: MED_AJENO, modalidad: 'telefonica', efectiva: false }] }).ok)
  const medioAjeno = validar(telefonica({ medio: 'videollamada' }), { config: { telefonica: { habilitada: true, tope_dia: 2, medios: ['llamada'] } } })
  check('telefónica con medio fuera de los vigentes: rechazada', !medioAjeno.ok && mensajes(medioAjeno).includes(mensajeMedio(['llamada'])))
  check('mensajeTopeTelefonicas en plural', mensajeTopeTelefonicas(2).includes('2 visitas telefónicas'))

  const topeMedico = validar(parsear(cuerpoMedica()), { visitasDeHoy: [{ medico_id: MED1, modalidad: 'presencial', efectiva: true }] })
  check('tope por médico: segunda efectiva al mismo médico hoy → rechazada', !topeMedico.ok && mensajes(topeMedico).includes(MENSAJE_TOPE_MEDICO))
  check('tope por médico: una telefónica efectiva al médico cuenta igual', !validar(parsear(cuerpoMedica()), { visitasDeHoy: [{ medico_id: MED1, modalidad: 'telefonica', efectiva: true }] }).ok)
  check('tope por médico: una NO efectiva de hoy no cuenta', validar(parsear(cuerpoMedica()), { visitasDeHoy: [{ medico_id: MED1, modalidad: 'presencial', efectiva: false }] }).ok)
  check(
    'tope por médico: la nueva no efectiva no choca con el tope',
    validar(parsear(cuerpoMedica({ efectiva: false, failure_reason: 'No estaba' })), { visitasDeHoy: [{ medico_id: MED1, modalidad: 'presencial', efectiva: true }] }).ok
  )
  check(
    'reintento de la MISMA visita (mismo client_id ya en visitasDeHoy): no choca con su propio tope',
    validar(parsear(cuerpoMedica()), { visitasDeHoy: [{ client_id: CLIENT_ID, medico_id: MED1, modalidad: 'presencial', efectiva: true }] }).ok
  )
  check(
    'una visita de hoy con OTRO client_id sí cuenta para el tope',
    !validar(parsear(cuerpoMedica()), { visitasDeHoy: [{ client_id: '12345678-1234-4123-8123-000000000000', medico_id: MED1, modalidad: 'presencial', efectiva: true }] }).ok
  )
  check('tope por médico 2: la segunda pasa', validar(parsear(cuerpoMedica()), { config: { tope_visitas_medico_dia: 2 }, visitasDeHoy: [{ medico_id: MED1, modalidad: 'presencial', efectiva: true }] }).ok)

  const perfil = validar(parsear(cuerpoMedica()), { config: { perfil: ['institucional'] } })
  check('perfil solo institucional → "Tu perfil no incluye visitas médicas"', !perfil.ok && mensajes(perfil).includes(mensajePerfil('medica')) && mensajePerfil('medica') === 'Tu perfil no incluye visitas médicas')
  check('perfil solo médica → institucional rechazada', mensajes(validar(parsear(cuerpoInstitucional()), { config: { perfil: ['medica'] } })).includes(mensajePerfil('institucional')))

  const lineasAjenas = validar(parsear(cuerpoMedica({ lineas: [L1, L_AJENA] })))
  check('líneas ajenas: rechazada', !lineasAjenas.ok && mensajes(lineasAjenas).includes(MENSAJE_LINEAS_AJENAS))

  const ayer = validar(parsear(cuerpoMedica({ checked_in_at: '2026-10-12T10:40:00-05:00', reported_at: '2026-10-12T10:42:00-05:00' })))
  check('ayer: "Solo se reportan visitas del mismo día"', !ayer.ok && mensajes(ayer).includes(MENSAJE_SOLO_HOY) && MENSAJE_SOLO_HOY === 'Solo se reportan visitas del mismo día')
  check('hoy a las 00:30 UTC del 14 (19:30 en Bogotá del 13) sí es hoy', validar(parsear(cuerpoMedica({ checked_in_at: '2026-10-14T00:30:00Z', reported_at: '2026-10-14T00:31:00Z' })), {}).errores.every(e => e.mensaje !== MENSAJE_SOLO_HOY))
  // AHORA = 10:42 en Bogotá. visitas_registrar acepta hasta 5 minutos de adelanto (c_tolerancia) y rechaza más.
  check('reloj del teléfono adelantado 4 minutos (10:46, hoy en Bogotá): pasa, como en la base', validar(parsear(cuerpoMedica({ checked_in_at: '2026-10-13T10:46:00-05:00', reported_at: '2026-10-13T10:47:00-05:00' }))).ok)
  const adelantado = validar(parsear(cuerpoMedica({ checked_in_at: '2026-10-13T11:30:00-05:00', reported_at: '2026-10-13T11:31:00-05:00' })))
  check(
    'reloj del teléfono adelantado 48 minutos (hoy en Bogotá): "La hora de llegada está en el futuro", como la base',
    !adelantado.ok && mensajes(adelantado).includes(MENSAJE_LLEGADA_FUTURA) && !mensajes(adelantado).includes(MENSAJE_SOLO_HOY) && TOLERANCIA_RELOJ_SEGUNDOS === 300,
    adelantado
  )
  check('reloj del teléfono en mañana (Bogotá): "Solo se reportan visitas del mismo día"', mensajes(validar(parsear(cuerpoMedica({ checked_in_at: '2026-10-14T08:00:00-05:00', reported_at: '2026-10-14T08:01:00-05:00' })))).includes(MENSAJE_SOLO_HOY))
  const reporteAntes = validar({ ...parsear(cuerpoMedica()), reported_at: '2026-10-13T10:30:00-05:00' } as VisitaCreate)
  check('reported_at antes de checked_in_at: rechazada', !reporteAntes.ok && mensajes(reporteAntes).includes(MENSAJE_REPORTE_ANTES_DE_LLEGADA))

  const institucional = validar(parsear(cuerpoInstitucional()))
  check('institucional con subtipo vigente y contacto de la cuenta: ok, sin out_of_territory', institucional.ok && !institucional.out_of_territory, institucional)
  const sinSubtipo = validar(parsear(cuerpoInstitucional()), { contexto: { subtipo: null } })
  check('institucional con subtipo que no existe: rechazada', !sinSubtipo.ok && mensajes(sinSubtipo).includes(MENSAJE_SUBTIPO_NO_VIGENTE))
  const subtipoVencido = validar(parsear(cuerpoInstitucional()), { contexto: { subtipo: { id: SUB_COMPRAS, codigo: 'compras', vigente_desde: '2026-01-01', vigente_hasta: '2026-10-01' } } })
  check('institucional con subtipo ya cerrado: rechazada', !subtipoVencido.ok && mensajes(subtipoVencido).includes(MENSAJE_SUBTIPO_NO_VIGENTE))
  check('institucional sin subtipo_id: lo frena el esquema', !visitaCreateSchema.safeParse(cuerpoInstitucional({ subtipo_id: undefined })).success)
  const contactoAjeno = validar(parsear(cuerpoInstitucional()), { contexto: { contacto: { id: CONT1, cuenta_id: CUENTA2 } } })
  check('contacto de otra cuenta: rechazada', !contactoAjeno.ok && mensajes(contactoAjeno).includes(MENSAJE_CONTACTO_OTRA_CUENTA))
  // Dueño, 2026-10-30: la institucional siempre con contacto. Lo exige validarVisita y no el esquema: la idempotencia por
  // client_id va entre los dos, y una institucional sin contacto guardada antes de la regla vuelve como repetida.
  const sinContactoEsquema = visitaCreateSchema.safeParse(cuerpoInstitucional({ contacto_id: null }))
  const sinContacto = sinContactoEsquema.success ? validar(sinContactoEsquema.data, { contexto: { contacto: null } }) : null
  check(
    'institucional sin contacto: el esquema la deja pasar y validarVisita la frena en contacto_id con MENSAJE_CONTACTO_OBLIGATORIO',
    sinContactoEsquema.success && !!sinContacto && !sinContacto.ok && sinContacto.errores.some(e => e.campo === 'contacto_id' && e.mensaje === MENSAJE_CONTACTO_OBLIGATORIO),
    sinContacto?.errores ?? (sinContactoEsquema.success ? null : sinContactoEsquema.error.issues)
  )
  check('la médica no pide contacto', visitaCreateSchema.safeParse(cuerpoMedica({ contacto_id: null })).success && validar(parsear(cuerpoMedica())).ok)
  const sedeAjena = validar(parsear(cuerpoInstitucional({ cuenta_id: CUENTA2 })))
  check('sede que no es de la cuenta: rechazada', !sedeAjena.ok && mensajes(sedeAjena).includes(MENSAJE_SEDE_NO_DE_LA_CUENTA))

  const fuera = validar(parsear(cuerpoMedica()), { contexto: { medico: { id: MED1, nombre: 'Dr. Pérez', activo: true, sede_ids: [SEDE1], es_visitante: false } } })
  check('médico del que no es visitante: ok y out_of_territory = true', fuera.ok && fuera.out_of_territory)
  const inactivo = validar(parsear(cuerpoMedica()), { contexto: { medico: { id: MED1, nombre: 'Dr. Pérez', activo: false, sede_ids: [SEDE1], es_visitante: true } } })
  check('médico inactivo: rechazada', !inactivo.ok && mensajes(inactivo).includes(MENSAJE_MEDICO_NO_EXISTE))
  check('médico que no existe (otro id): rechazada', mensajes(validar(parsear(cuerpoMedica({ medico_id: MED_AJENO })))).includes(MENSAJE_MEDICO_NO_EXISTE))
  const sedeNoDelMedico = validar(parsear(cuerpoMedica()), { contexto: { medico: { id: MED1, nombre: 'Dr. Pérez', activo: true, sede_ids: [SEDE2], es_visitante: true } } })
  check('sede donde el médico no atiende: rechazada', !sedeNoDelMedico.ok && mensajes(sedeNoDelMedico).includes(MENSAJE_SEDE_NO_DEL_MEDICO))

  check('ejecutiva inactiva: rechazada con el mensaje de F2', mensajes(validar(parsear(cuerpoMedica()), { contexto: { ejecutiva: { id: EJEC, activa: false, con_zona: true, lineas: [L1] } } })).includes(MENSAJE_SIN_EJECUTIVA))
  check('ejecutiva sin zona base: rechazada', mensajes(validar(parsear(cuerpoMedica()), { contexto: { ejecutiva: { id: EJEC, activa: true, con_zona: false, lineas: [L1] } } })).includes(MENSAJE_SIN_ZONA))

  const varios = validar(parsear(cuerpoMedica({ ...aMetrosAlNorte(SEDE_PUNTO, 800), lineas: [L_AJENA] })))
  check('devuelve TODOS los errores (lejos + líneas ajenas)', varios.errores.length === 2 && varios.errores.map(e => e.campo).sort().join(',') === 'lat,lineas', varios)
  check('validarVisita no muta los datos', (() => {
    const datos = parsear(cuerpoMedica())
    const copia = JSON.stringify(datos)
    validar(datos)
    return JSON.stringify(datos) === copia
  })())

  // 0850: la visita es de la persona (user_id), con o sin Ejecutivo Comercial.
  const USUARIO = 'abababab-0000-4000-8000-000000000001'
  check('visitaEditable: solo app, de la persona (user_id), no anulada y de hoy', visitaEditable({ source: 'app', user_id: USUARIO, visit_date: HOY, deleted_at: null }, USUARIO, HOY) && !visitaEditable({ source: 'vmo_import', user_id: USUARIO, visit_date: HOY, deleted_at: null }, USUARIO, HOY) && !visitaEditable({ source: 'app', user_id: USUARIO, visit_date: '2026-10-12', deleted_at: null }, USUARIO, HOY) && !visitaEditable({ source: 'app', user_id: USUARIO, visit_date: HOY, deleted_at: '2026-10-13T16:00:00Z' }, USUARIO, HOY) && !visitaEditable({ source: 'app', user_id: 'otra', visit_date: HOY, deleted_at: null }, USUARIO, HOY))

  // Hallazgos del verificador (2026-10-14): reported_at en el futuro, fechas antes de la visita, cuenta y contacto inactivos.
  const reporteFuturo = validar({ ...parsear(cuerpoMedica()), reported_at: '2026-10-13T10:48:00-05:00' } as VisitaCreate)
  check(
    'reported_at 6 minutos en el futuro (llegada bien): "La hora del reporte está en el futuro", como la base',
    !reporteFuturo.ok && mensajes(reporteFuturo).includes(MENSAJE_REPORTE_FUTURO) && !mensajes(reporteFuturo).includes(MENSAJE_LLEGADA_FUTURA),
    reporteFuturo
  )
  check('reported_at 4 minutos adelante: pasa (tolerancia de 5 minutos)', validar({ ...parsear(cuerpoMedica()), reported_at: '2026-10-13T10:46:00-05:00' } as VisitaCreate).ok)
  const proximaAyer = validar(parsear(cuerpoMedica({ next_step_date: '2026-10-12' })))
  check(
    'next_step_date anterior a la visita ("el lunes" mal resuelto un martes): rechazada; nunca nace como compromiso vencido',
    !proximaAyer.ok && proximaAyer.errores.some(e => e.campo === 'next_step_date' && e.mensaje === MENSAJE_PROXIMA_ANTES_DE_VISITA),
    proximaAyer
  )
  check('next_step_date el mismo día de la visita o después: ok', validar(parsear(cuerpoMedica({ next_step_date: HOY }))).ok && validar(parsear(cuerpoMedica({ next_step_date: '2026-10-19' }))).ok)
  const reintentoAyer = validar(parsear(cuerpoMedica({ efectiva: false, failure_reason: 'No estaba', retry_date: '2026-10-01' })))
  check('retry_date anterior a la visita: rechazada', !reintentoAyer.ok && reintentoAyer.errores.some(e => e.campo === 'retry_date' && e.mensaje === MENSAJE_REINTENTO_ANTES_DE_VISITA), reintentoAyer)
  check('retry_date de una efectiva se descarta (no se valida)', validar(parsear(cuerpoMedica({ retry_date: '2026-10-01' }))).ok)
  const cuentaInactivaMedica = validar(parsear(cuerpoMedica()), { contexto: { sede: { ...contextoBase().sede!, cuenta_activa: false } } })
  check('médica en una sede de cuenta inactiva: rechazada', !cuentaInactivaMedica.ok && cuentaInactivaMedica.errores.some(e => e.campo === 'sede_id' && e.mensaje === MENSAJE_CUENTA_INACTIVA), cuentaInactivaMedica)
  const cuentaInactivaInst = validar(parsear(cuerpoInstitucional()), { contexto: { sede: { ...contextoBase().sede!, cuenta_activa: false } } })
  check('institucional en una cuenta inactiva: rechazada (campo cuenta_id)', !cuentaInactivaInst.ok && cuentaInactivaInst.errores.some(e => e.campo === 'cuenta_id' && e.mensaje === MENSAJE_CUENTA_INACTIVA), cuentaInactivaInst)
  check('cuenta activa (o sin el dato): pasa', validar(parsear(cuerpoInstitucional()), { contexto: { sede: { ...contextoBase().sede!, cuenta_activa: true } } }).ok && validar(parsear(cuerpoInstitucional())).ok)
  const contactoInactivo = validar(parsear(cuerpoInstitucional()), { contexto: { contacto: { id: CONT1, cuenta_id: CUENTA1, activo: false } } })
  check('contacto dado de baja: rechazada con "Ese contacto está inactivo"', !contactoInactivo.ok && mensajes(contactoInactivo).includes(MENSAJE_CONTACTO_INACTIVO), contactoInactivo)

}

// ---------------------------------------------------------------------------
// 5. Hoy y Mis números
// ---------------------------------------------------------------------------

seccion('5. compromisosVencidos, resumenHoy y cumplimientoMes')
{
  const vencidos = compromisosVencidos(
    [
      { id: 'a', fecha: '2026-10-01', medico_id: MED1, cuenta_id: null, con: 'Dr. Pérez', next_step_date: '2026-10-08' },
      { id: 'b', fecha: '2026-10-10', medico_id: MED1, cuenta_id: null, con: 'Dr. Pérez', next_step_date: null },
      { id: 'c', fecha: '2026-10-02', medico_id: null, cuenta_id: CUENTA1, con: 'Clínica Norte', next_step_date: '2026-10-05' },
      { id: 'd', fecha: '2026-10-05', medico_id: MED_AJENO, cuenta_id: null, con: 'Dr. Gómez', next_step_date: '2026-10-20' },
      { id: 'e', fecha: '2026-10-06', medico_id: null, cuenta_id: CUENTA2, con: 'EPS Sur', next_step_date: HOY },
      { id: 'f', fecha: '2026-09-20', medico_id: null, cuenta_id: CUENTA3, con: 'EPS Norte', next_step_date: '2026-09-30' },
      { id: 'h', fecha: '2026-09-15', medico_id: null, cuenta_id: CUENTA2, con: 'EPS Sur', next_step_date: '2026-09-25' },
    ],
    HOY
  )
  check('vencidos: la del compromiso del 30-sep y la del 5-oct; no las que ya tuvieron visita posterior (a, h) ni las futuras ni la de hoy', vencidos.map(v => v.visita_id).join(',') === 'f,c', vencidos)
  check('vencidos: forma { visita_id, fecha, con, next_step_date }', vencidos[1].con === 'Clínica Norte' && vencidos[1].fecha === '2026-10-02' && vencidos[1].next_step_date === '2026-10-05')
  check('vencidos: una visita posterior a la misma CUENTA también lo cierra', compromisosVencidos([{ id: 'f', fecha: '2026-09-20', medico_id: null, cuenta_id: CUENTA2, con: 'EPS Sur', next_step_date: '2026-09-30' }, { id: 'g', fecha: '2026-10-01', medico_id: null, cuenta_id: CUENTA2, con: 'EPS Sur', next_step_date: null }], HOY).length === 0)

  const resumen = resumenHoy(
    [
      { tipo: 'medica', modalidad: 'presencial', efectiva: true, cuenta_para: 'medica', peso: 1 },
      { tipo: 'medica', modalidad: 'telefonica', efectiva: true },
      { tipo: 'institucional', modalidad: 'presencial', efectiva: true, cuenta_para: 'institucional', peso: 0.5 },
      { tipo: 'institucional', modalidad: 'presencial', efectiva: true, cuenta_para: null, peso: 0 },
      { tipo: 'medica', modalidad: 'presencial', efectiva: false },
    ],
    { medica: 2, institucional: 1 }
  )
  check('resumenHoy: hechas { medicas 2, institucionales 2, telefonicas 1, no_efectivas 1 }', JSON.stringify(resumen.hechas) === JSON.stringify({ medicas: 2, institucionales: 2, telefonicas: 1, no_efectivas: 1 }), resumen)
  check('resumenHoy: valor con pesos { medica 2, institucional 0,5 } y meta del día no cumplida', resumen.valor.medica === 2 && resumen.valor.institucional === 0.5 && !resumen.cuota_dia_ok)
  check('resumenHoy: con meta institucional 0,5 la cuota del día está ok', resumenHoy([{ tipo: 'medica', modalidad: 'presencial', efectiva: true }, { tipo: 'medica', modalidad: 'presencial', efectiva: true }, { tipo: 'institucional', modalidad: 'presencial', efectiva: true, cuenta_para: 'institucional', peso: 0.5 }], { medica: 2, institucional: 0.5 }).cuota_dia_ok)
  check('resumenHoy sin visitas y metas 0: ok', resumenHoy([], { medica: 0, institucional: 0 }).cuota_dia_ok)

  const conteo: ConteoVigencia[] = [
    { id: 'c1', subtipo_id: SUB_COMPRAS, modo: 'suma_institucional', peso: 1, vigente_desde: '2026-10-12', vigente_hasta: '2026-10-31' },
    { id: 'c2', subtipo_id: SUB_COMPRAS, modo: 'suma_institucional', peso: 0.5, vigente_desde: '2026-11-01', vigente_hasta: null },
    { id: 'c3', subtipo_id: SUB_PROGRAMACION, modo: 'meta_propia', peso: 1, vigente_desde: '2026-10-12', vigente_hasta: null },
    { id: 'c4', subtipo_id: SUB_QUIMICO, modo: 'seguimiento', peso: 1, vigente_desde: '2026-10-12', vigente_hasta: null },
  ]
  const cuota = { medica: { cuota: 72 }, institucional: { cuota: 10 }, subtipos: [{ subtipo_id: SUB_PROGRAMACION, nombre: 'Programación', cuota: 4 }] }
  const octubre = cumplimientoMes({
    visitas: [
      { fecha: '2026-10-13', tipo: 'medica', subtipo_id: null, efectiva: true, modalidad: 'presencial' },
      { fecha: '2026-10-13', tipo: 'medica', subtipo_id: null, efectiva: true, modalidad: 'telefonica' },
      { fecha: '2026-10-14', tipo: 'medica', subtipo_id: null, efectiva: true, modalidad: 'presencial', out_of_territory: true },
      { fecha: '2026-10-14', tipo: 'medica', subtipo_id: null, efectiva: false, modalidad: 'presencial' },
      { fecha: '2026-10-20', tipo: 'institucional', subtipo_id: SUB_COMPRAS, efectiva: true, modalidad: 'presencial' },
      { fecha: '2026-10-28', tipo: 'institucional', subtipo_id: SUB_COMPRAS, efectiva: true, modalidad: 'presencial' },
      { fecha: '2026-10-28', tipo: 'institucional', subtipo_id: SUB_PROGRAMACION, efectiva: true, modalidad: 'presencial' },
      { fecha: '2026-10-28', tipo: 'institucional', subtipo_id: SUB_QUIMICO, efectiva: true, modalidad: 'presencial' },
    ],
    conteo,
    cuota,
    dias: [
      { fecha: '2026-10-13', habil: 1, libre: 0 },
      { fecha: '2026-10-14', habil: 1, libre: 0 },
      { fecha: '2026-10-15', habil: 1, libre: 0 },
      { fecha: '2026-10-16', habil: 1, libre: 1 },
      { fecha: '2026-10-17', habil: 0, libre: 0 },
      { fecha: '2026-10-19', habil: 1, libre: 0 },
    ],
    hoy: '2026-10-17',
  })
  check('octubre: médica 3 de 72 → 0,04', octubre.medica.hechas === 3 && octubre.medica.cuota === 72 && octubre.medica.cumplimiento === 0.04, octubre.medica)
  check('octubre: Compras peso 1 → institucional 2 de 10 → 0,2 (químico "seguimiento" no suma)', octubre.institucional.hechas === 2 && octubre.institucional.cumplimiento === 0.2, octubre.institucional)
  check('octubre: Programación con meta propia 1 de 4 → 0,25', octubre.subtipos.length === 1 && octubre.subtipos[0].hechas === 1 && octubre.subtipos[0].cumplimiento === 0.25, octubre.subtipos)
  check('octubre: telefónicas 1, no efectivas 1, fuera de territorio 1', octubre.telefonicas === 1 && octubre.no_efectivas === 1 && octubre.fuera_de_territorio === 1)
  check('octubre: 1 día hábil sin visitas (el 15; el 16 es libre, el 17 no es hábil y el 19 es futuro)', octubre.dias_sin_visitas === 1, octubre.dias_sin_visitas)

  const noviembre = cumplimientoMes({
    visitas: [
      { fecha: '2026-11-03', tipo: 'institucional', subtipo_id: SUB_COMPRAS, efectiva: true },
      { fecha: '2026-11-04', tipo: 'institucional', subtipo_id: SUB_COMPRAS, efectiva: true },
    ],
    conteo,
    cuota: { medica: { cuota: 0 }, institucional: { cuota: 10 }, subtipos: [] },
  })
  check('noviembre: Compras peso 0,5 → dos visitas suman 1 → 0,1; octubre no cambió', noviembre.institucional.hechas === 1 && noviembre.institucional.cumplimiento === 0.1 && octubre.institucional.hechas === 2)
  check('cuota 0 → cumplimiento null y días sin visitas 0 sin `dias`', noviembre.medica.cumplimiento === null && noviembre.dias_sin_visitas === 0)

  const numeros = numerosDesdeCumplimiento('2026-10', { mes: '2026-10' } as never, octubre)
  check('numerosDesdeCumplimiento arma NumerosResponse', numeros.hechas.medica === 3 && numeros.cumplimiento.institucional === 0.2 && numeros.hechas.subtipos[0].hechas === 1 && numeros.cumplimiento.subtipos[0].cumplimiento === 0.25 && numeros.dias_habiles_sin_visitas === 1 && numeros.fuera_de_territorio === 1)
}


// ---------------------------------------------------------------------------
// 5b. Cuánto vale una visita (valorReporte): sede por confirmar y peso de la telefónica
// ---------------------------------------------------------------------------

seccion('5b. valorReporte: sede por confirmar (decisión 9 del dueño) y peso de la telefónica (config_general)')
{
  const conteo: ConteoVigencia[] = [{ id: 'c1', subtipo_id: SUB_COMPRAS, modo: 'suma_institucional', peso: 1, vigente_desde: '2026-10-12', vigente_hasta: null }]
  // Telefónicas: peso 1 hasta el 31 de octubre; la directora registra 0,5 desde el 1 de noviembre.
  const general = [
    { id: 'g1', parametro: 'telefonicas', valor: { tope_dia: 1, peso: 1, medios: ['llamada', 'videollamada'] }, vigente_desde: '2026-10-12', vigente_hasta: '2026-10-31', anulado_at: null },
    { id: 'g2', parametro: 'telefonicas', valor: { tope_dia: 1, peso: 0.5, medios: ['llamada', 'videollamada'] }, vigente_desde: '2026-11-01', vigente_hasta: null, anulado_at: null },
  ] as unknown as GeneralVigencia[]
  const base = { conteo, general, tipo: 'medica' as const, subtipo_id: null, efectiva: true }

  const porConfirmar = valorReporte({ ...base, fecha: '2026-10-13', modalidad: 'presencial', sede_confirmada: false })
  check('efectiva en una sede por confirmar: no suma todavía (meta null, peso 0) y queda marcada', porConfirmar.meta === null && porConfirmar.peso === 0 && porConfirmar.sede_por_confirmar, porConfirmar)
  const confirmada = valorReporte({ ...base, fecha: '2026-10-13', modalidad: 'presencial', sede_confirmada: true })
  check('la misma visita con la sede ya confirmada: suma a la médica con peso 1 (se mira la sede al contar)', confirmada.meta === 'medica' && confirmada.peso === 1 && !confirmada.sede_por_confirmar)
  check('sin el dato de la sede (undefined o null): cuenta como confirmada', valorReporte({ ...base, fecha: '2026-10-13' }).meta === 'medica' && valorReporte({ ...base, fecha: '2026-10-13', sede_confirmada: null }).peso === 1)
  check('no efectiva en sede por confirmar: no suma y NO cuenta como "por confirmar"', !valorReporte({ ...base, efectiva: false, fecha: '2026-10-13', sede_confirmada: false }).sede_por_confirmar)
  check('telefónica en octubre (peso 1): 1', valorReporte({ ...base, fecha: '2026-10-20', modalidad: 'telefonica' }).peso === 1)
  check('telefónica en noviembre (peso 0,5 vigente desde el 1): 0,5', valorReporte({ ...base, fecha: '2026-11-03', modalidad: 'telefonica' }).peso === 0.5)
  check('presencial en noviembre: 1 (el peso es solo de la telefónica)', valorReporte({ ...base, fecha: '2026-11-03', modalidad: 'presencial' }).peso === 1)
  check(
    'institucional de compras telefónica en noviembre: peso del conteo × peso de la telefónica (1 × 0,5)',
    valorReporte({ ...base, tipo: 'institucional', subtipo_id: SUB_COMPRAS, fecha: '2026-11-03', modalidad: 'telefonica' }).peso === 0.5
  )
  check('sin configuración general: la telefónica vale 1 (GENERAL_POR_DEFECTO)', valorReporte({ ...base, general: [], fecha: '2026-11-03', modalidad: 'telefonica' }).peso === 1 && GENERAL_POR_DEFECTO.telefonicas.peso === 1)

  // El escenario del verificador: 120 presenciales y 20 telefónicas en noviembre con peso 0,5 → 130, no 140.
  const noviembre = cumplimientoMes({
    visitas: [
      ...Array.from({ length: 120 }, () => ({ fecha: '2026-11-03', tipo: 'medica' as const, subtipo_id: null, efectiva: true, modalidad: 'presencial' as const })),
      ...Array.from({ length: 20 }, () => ({ fecha: '2026-11-04', tipo: 'medica' as const, subtipo_id: null, efectiva: true, modalidad: 'telefonica' as const })),
    ],
    conteo,
    general,
    cuota: { medica: { cuota: 130 }, institucional: { cuota: 0 }, subtipos: [] },
  })
  check('Mis números: 120 presenciales + 20 telefónicas × 0,5 = 130 hechas y cumplimiento 1', noviembre.medica.hechas === 130 && noviembre.medica.cumplimiento === 1 && noviembre.telefonicas === 20, noviembre.medica)

  const conSedeNueva = cumplimientoMes({
    visitas: [
      { fecha: '2026-10-13', tipo: 'medica', subtipo_id: null, efectiva: true, modalidad: 'presencial', sede_confirmada: true },
      ...Array.from({ length: 6 }, () => ({ fecha: '2026-10-14', tipo: 'medica' as const, subtipo_id: null, efectiva: true, modalidad: 'presencial' as const, sede_confirmada: false })),
      { fecha: '2026-10-14', tipo: 'institucional', subtipo_id: SUB_COMPRAS, efectiva: true, modalidad: 'presencial', sede_confirmada: false },
    ],
    conteo,
    general,
    cuota: { medica: { cuota: 72 }, institucional: { cuota: 10 }, subtipos: [] },
  })
  check(
    'el consultorio creado con el GPS propio (6 visitas, sin confirmar): no suman; solo la de la sede confirmada',
    conSedeNueva.medica.hechas === 1 && conSedeNueva.institucional.hechas === 0 && conSedeNueva.sede_por_confirmar === 7,
    conSedeNueva
  )
  check('numerosDesdeCumplimiento lleva sede_por_confirmar', numerosDesdeCumplimiento('2026-10', { mes: '2026-10' } as never, conSedeNueva).sede_por_confirmar === 7)
  const hoyResumen = resumenHoy(
    [true, false].map(confirmadaSede => {
      const valor = valorReporte({ ...base, fecha: '2026-10-13', modalidad: 'presencial', sede_confirmada: confirmadaSede })
      return { tipo: 'medica' as const, modalidad: 'presencial' as const, efectiva: true, cuenta_para: valor.meta, peso: valor.peso }
    }),
    { medica: 2, institucional: 0 }
  )
  check('Hoy: la de la sede por confirmar no completa la meta del día (cuota_dia_ok false con 1 de 2 que suman)', !hoyResumen.cuota_dia_ok && hoyResumen.valor.medica === 1, hoyResumen)
}

// ---------------------------------------------------------------------------
// 6. Sedes cercanas
// ---------------------------------------------------------------------------

seccion('6. sedesCercanas')
{
  const sedes = [
    { id: 'lejos', nombre: 'Lejos', ...aMetrosAlNorte(SEDE_PUNTO, 1500) },
    { id: 'a900', nombre: 'A 900', ...aMetrosAlNorte(SEDE_PUNTO, 900) },
    { id: 'a100', nombre: 'A 100', ...aMetrosAlNorte(SEDE_PUNTO, 100) },
    { id: 'sin', nombre: 'Sin ubicar', lat: null, lng: null },
    { id: 'a300', nombre: 'A 300', ...aMetrosAlNorte(SEDE_PUNTO, 300) },
  ]
  const cerca = sedesCercanas(sedes, SEDE_PUNTO)
  check('a menos de 1 km, de la más cercana a la más lejana, sin las que no tienen coordenadas', cerca.map(s => s.id).join(',') === 'a100,a300,a900', cerca.map(s => s.id))
  check('cada una trae distancia_m entera', cerca.every(s => Number.isInteger(s.distancia_m)) && Math.abs(cerca[0].distancia_m - 100) <= 1)
  check('tope `max` = 2', sedesCercanas(sedes, SEDE_PUNTO, 1000, 2).map(s => s.id).join(',') === 'a100,a300')
  check('maxM 2000 incluye la de 1,5 km', sedesCercanas(sedes, SEDE_PUNTO, 2000).length === 4)
  check('no muta las sedes de entrada', !('distancia_m' in sedes[2]))
}

// ---------------------------------------------------------------------------
// 7. Voz: vocabulario, prompt, contexto y normalización
// ---------------------------------------------------------------------------

const contextoRespuesta = (): ContextoResponse => ({
  ejecutiva: { id: EJEC, nombre: 'Ana Pérez', zona: 'Bogotá Norte', municipio: '11001', lineas: [{ id: L1, code: 'ORT', name: 'Ortopedia' }, { id: L2, code: 'NEU', name: 'Neurocirugía' }] },
  persona: { user_id: 'abababab-0000-4000-8000-000000000001', nombre: 'Ana Pérez', rol: 'ejecutivo', executive_id: EJEC, lineas: [{ id: L1, nombre: 'Ortopedia', como: 'ejecutivo' }, { id: L2, nombre: 'Neurocirugía', como: 'ejecutivo' }] },
  hoy: { fecha: HOY, meta: { medica: 6, institucional: 1 }, hechas: { medicas: 0, institucionales: 0, telefonicas: 0, no_efectivas: 0 }, cuota_dia_ok: false },
  config: configBase(),
  sedes_cerca: [
    { id: SEDE1, nombre: 'Clínica Norte', cuenta_id: CUENTA1, cuenta_nombre: 'Clínica X', cuenta_clase: 'clinica', ciudad: 'Bogotá', lat: SEDE_PUNTO.lat, lng: SEDE_PUNTO.lng, distancia_m: 120, hospital_id: null, ubicacion_confirmada: true },
    { id: SEDE2, nombre: 'Clínica X sede sur', cuenta_id: CUENTA1, cuenta_nombre: 'Clínica X', cuenta_clase: 'clinica', ciudad: 'Bogotá', lat: 4.6, lng: -74.1, distancia_m: 800, hospital_id: null, ubicacion_confirmada: true },
  ],
  mis_medicos: [{ id: MED1, nombre: 'Dr. Pérez', especialidades: ['ortopedia'], municipality_id: '11001', lineas: [L1], sedes: [{ id: SEDE1, nombre: 'Clínica Norte', cuenta_nombre: 'Clínica X', distancia_m: 120 }] }],
  contactos: [{ id: CONT1, cuenta_id: CUENTA1, sede_id: SEDE1, nombre: 'Marta', cargo_texto: 'Jefe de compras', rol: 'compras' }],
  subtipos: [
    { id: SUB_COMPRAS, codigo: 'compras', nombre: 'Compras', roles_sugeridos: ['compras'] },
    { id: SUB_QUIMICO, codigo: 'quimico_farmaceutico', nombre: 'Químico farmacéutico', roles_sugeridos: ['quimico_farmaceutico'] },
  ],
  compromisos_vencidos: [],
  voz: { transcribir: false, proponer: false },
  agenda_hoy: [],
})

seccion('7. Voz: vocabularioVG, PROMPT_PROPUESTA, contextoDictado, normalizarPropuesta')
{
  const vocabulario = vocabularioVG([{ name: 'Ortopedia' }, 'Neurocirugía'], [{ nombre: 'Compras' }, 'Químico farmacéutico'])
  check('vocabularioVG nombra líneas, subtipos y los términos de VG', vocabulario.includes('Ortopedia') && vocabulario.includes('Neurocirugía') && vocabulario.includes('Compras') && vocabulario.includes('PerOssal') && vocabulario.includes('tornillo canulado') && vocabulario.includes('reemplazo') && vocabulario.includes('codificar'))
  check('vocabularioVG es corto (≤ 900 caracteres) y en español', vocabulario.length <= 900 && vocabulario.includes('español'))
  check('TERMINOS_VG trae los del contrato', ['PerOssal', 'tornillo canulado', 'reemplazo', 'codificar'].every(t => (TERMINOS_VG as readonly string[]).includes(t)))
  check('PROMPT_PROPUESTA prohíbe inventar terceros y documentos y exige ids del contexto', PROMPT_PROPUESTA.includes('proponer_visitas') && /nunca inventes terceros/i.test(PROMPT_PROPUESTA) && /documento/i.test(PROMPT_PROPUESTA) && /ids que estén en el contexto/i.test(PROMPT_PROPUESTA))
  check('PROMPT_PROPUESTA sin "KAM", "representante" ni "panel"', !/KAM|representante|panel/i.test(PROMPT_PROPUESTA))
  check('esquemaPropuesta: objeto cerrado con visitas (máximo 10) y aviso', esquemaPropuesta.type === 'object' && esquemaPropuesta.additionalProperties === false && esquemaPropuesta.properties.visitas.maxItems === 10 && esquemaPropuesta.required.includes('aviso'))
  check('esquemaPropuesta: cada visita exige todos sus campos y ninguno es un documento', esquemaPropuesta.properties.visitas.items.required.length === Object.keys(esquemaPropuesta.properties.visitas.items.properties).length && !JSON.stringify(esquemaPropuesta).includes('documento'))

  const contextoConExtras = { ...contextoRespuesta(), mis_medicos: [{ ...contextoRespuesta().mis_medicos[0], numero_documento: '1234567', tipo_documento: 'CC' }], contactos: [{ ...contextoRespuesta().contactos[0], telefono: '3001234567' }] } as unknown as ContextoResponse
  const dictado = contextoDictado(contextoConExtras, '10:42')
  const dictadoTexto = JSON.stringify(dictado)
  check('contextoDictado: fecha, hora, ejecutiva con líneas, sedes, médicos, contactos y subtipos', dictado.fecha === HOY && dictado.hora === '10:42' && dictado.ejecutiva.lineas.length === 2 && dictado.sedes.length === 2 && dictado.medicos.length === 1 && dictado.contactos.length === 1 && dictado.subtipos.length === 2)
  check('contextoDictado NUNCA deja documentos ni teléfonos aunque vengan en la entrada', !dictadoTexto.includes('1234567') && !dictadoTexto.includes('documento') && !dictadoTexto.includes('telefono') && !dictadoTexto.includes('3001234567'))
  check('contextoDictado: la sede trae cuenta y distancia; el médico sus sedes', dictado.sedes[0].cuenta === 'Clínica X' && dictado.sedes[0].distancia_m === 120 && dictado.medicos[0].sedes[0].id === SEDE1)

  const crudaBase = (extra: Partial<PropuestaCruda['visitas'][number]> & Record<string, unknown> = {}): PropuestaCruda['visitas'][number] => ({
    tipo: 'medica',
    subtipo_codigo: null,
    medico_id: null,
    medico_nombre_dicho: null,
    sugerir_crear_medico: false,
    cuenta_id: null,
    sede_id: null,
    contacto_id: null,
    contacto_nombre_dicho: null,
    lineas: [],
    efectiva: true,
    failure_reason: null,
    conclusion: null,
    compromisos: null,
    next_step_date: null,
    modalidad_sugerida: 'presencial',
    confianza: 0.8,
    preguntas: [],
    ...extra,
  })
  const propuesta = normalizarPropuesta(
    {
      visitas: [
        crudaBase({ medico_id: MED1, sede_id: SEDE1, lineas: [L1, L_AJENA, L1], conclusion: '  Enviará   un caso ', compromisos: 'La otra semana', next_step_date: '2026-10-20', confianza: 0.9 }),
        crudaBase({ medico_id: MED_AJENO, medico_nombre_dicho: 'Dr. Gómez', sede_id: SEDE1, confianza: 1.7, next_step_date: 'mañana', preguntas: ['¿Gómez de ortopedia?', '¿En la sede norte?', '¿Otra?'], numero_documento: '79123456' }),
        crudaBase({ tipo: 'institucional', subtipo_codigo: 'compras', cuenta_id: CUENTA1, sede_id: SEDE2, contacto_id: CONT1, conclusion: 'Van a cotizar', efectiva: false, failure_reason: 'No estaba la jefe' }),
        crudaBase({ tipo: 'institucional', subtipo_codigo: 'inventado', cuenta_id: 'otra-cuenta', sede_id: 'otra-sede', contacto_id: 'otro', contacto_nombre_dicho: 'Marta', medico_id: MED1 }),
        crudaBase({ tipo: 'institucional', subtipo_codigo: 'quimico_farmaceutico', contacto_id: CONT1, efectiva: false }),
      ],
      aviso: '  Un médico no cruzó ',
    },
    contextoRespuesta()
  )
  const [v1, v2, v3, v4, v5] = propuesta.visitas
  check('propuesta 1: médico y sede del contexto se conservan; líneas ajenas y repetidas fuera', v1.medico_id === MED1 && v1.sede_id === SEDE1 && v1.lineas.join(',') === L1 && !v1.sugerir_crear_medico && v1.subtipo_id === null && v1.cuenta_id === null, v1)
  check('propuesta 1: textos limpios, próxima reunión válida y confianza 0,9', v1.conclusion === 'Enviará un caso' && v1.compromisos === 'La otra semana' && v1.next_step_date === '2026-10-20' && v1.confianza === 0.9)
  check('propuesta 2: médico que no cruza → medico_id null, nombre dicho y sugerir_crear_medico', v2.medico_id === null && v2.medico_nombre_dicho === 'Dr. Gómez' && v2.sugerir_crear_medico && v2.sede_id === SEDE1, v2)
  check('propuesta 2: confianza acotada a 1, fecha inválida → null, máximo 2 preguntas', v2.confianza === 1 && v2.next_step_date === null && v2.preguntas.length === 2)
  check('propuesta 3: institucional con subtipo (código → id), cuenta, sede y contacto del contexto', v3.subtipo_codigo === 'compras' && v3.subtipo_id === SUB_COMPRAS && v3.cuenta_id === CUENTA1 && v3.sede_id === SEDE2 && v3.contacto_id === CONT1 && v3.medico_id === null, v3)
  check('propuesta 3: no efectiva conserva el motivo', !v3.efectiva && v3.failure_reason === 'No estaba la jefe')
  check('propuesta 4: subtipo, cuenta, sede y contacto ajenos → null; el médico no aplica en institucional; queda el nombre dicho', v4.subtipo_id === null && v4.subtipo_codigo === null && v4.cuenta_id === null && v4.sede_id === null && v4.contacto_id === null && v4.contacto_nombre_dicho === 'Marta' && v4.medico_id === null, v4)
  check('propuesta 5: el contacto fija la cuenta; con dos sedes de la cuenta no adivina la sede; no efectiva sin motivo → null', v5.cuenta_id === CUENTA1 && v5.sede_id === null && v5.contacto_id === CONT1 && v5.subtipo_id === SUB_QUIMICO && v5.failure_reason === null, v5)
  check('la propuesta normalizada NUNCA deja documentos (ni la clave de más de la entrada)', !JSON.stringify(propuesta).includes('79123456') && !JSON.stringify(propuesta).includes('documento'))
  check('aviso limpio', propuesta.aviso === 'Un médico no cruzó')
  check('ocultarNumerosLargos: cédula con puntos, teléfono con espacios y cédula junta → ocultos', ocultarNumerosLargos('CC 79.123.456, cel 300 123 4567 y 1020304050') === `CC ${NUMERO_OMITIDO}, cel ${NUMERO_OMITIDO} y ${NUMERO_OMITIDO}`)
  check('ocultarNumerosLargos: fechas AAAA-MM-DD, cantidades cortas y "6 placas" quedan', ocultarNumerosLargos('El 2026-10-20 pide 6 placas y 12 tornillos (ref 4501)') === 'El 2026-10-20 pide 6 placas y 12 tornillos (ref 4501)')
  const conDocumentos = normalizarPropuesta(
    {
      visitas: [
        crudaBase({ medico_nombre_dicho: 'Dr. Gómez 79123456', conclusion: 'Su cédula es 79.123.456 y su celular 3001234567', compromisos: 'Llamarlo al 300 123 4567', preguntas: ['¿Es la CC 1020304050?'] }),
        crudaBase({ tipo: 'institucional', subtipo_codigo: 'compras', contacto_nombre_dicho: 'Marta 3101234567', efectiva: false, failure_reason: 'No estaba; dejé el 3001234567' }),
      ],
      aviso: 'Revisa el 79123456',
    },
    contextoRespuesta()
  )
  const textosLibres = [
    conDocumentos.aviso,
    ...conDocumentos.visitas.flatMap(v => [v.medico_nombre_dicho, v.contacto_nombre_dicho, v.conclusion, v.compromisos, v.failure_reason, ...v.preguntas]),
  ].join(' | ')
  check('normalizarPropuesta: ningún número de 7+ dígitos sobrevive en nombres, textos, preguntas ni aviso', !/\d{7,}/.test(textosLibres.replace(/[ .-]/g, '')) && !JSON.stringify(conDocumentos).includes('79.123.456') && !JSON.stringify(conDocumentos).includes('300 123 4567') && !JSON.stringify(conDocumentos).includes('3001234567'), textosLibres)
  check('normalizarPropuesta: nombres sin dígitos ("Dr. Gómez", "Marta")', conDocumentos.visitas[0].medico_nombre_dicho === 'Dr. Gómez' && conDocumentos.visitas[1].contacto_nombre_dicho === 'Marta', conDocumentos.visitas.map(v => [v.medico_nombre_dicho, v.contacto_nombre_dicho]))
  check('normalizarPropuesta: el texto se conserva alrededor del número omitido', conDocumentos.visitas[0].conclusion === `Su cédula es ${NUMERO_OMITIDO} y su celular ${NUMERO_OMITIDO}` && conDocumentos.visitas[1].failure_reason === `No estaba; dejé el ${NUMERO_OMITIDO}`, conDocumentos.visitas[0].conclusion)
  const unaLinea = normalizarPropuesta({ visitas: [crudaBase({ medico_id: MED1 })], aviso: null }, { ...contextoRespuesta(), ejecutiva: { ...contextoRespuesta().ejecutiva, lineas: [{ id: L1, code: 'ORT', name: 'Ortopedia' }] } })
  check('sin líneas dichas y una sola línea de la ejecutiva: esa; médico con una sede → esa sede', unaLinea.visitas[0].lineas.join(',') === L1 && unaLinea.visitas[0].sede_id === SEDE1)
  check('más de 10 visitas: se recortan a 10', normalizarPropuesta({ visitas: Array.from({ length: 12 }, () => crudaBase()), aviso: null }, contextoRespuesta()).visitas.length === 10)

  const cruda = propuestaSchema.safeParse({ visitas: [{ tipo: 'medica', medico_id: MED1, documento: '123', confianza: 0.5 }], aviso: null })
  check('propuestaSchema tolera campos ausentes, completa valores y descarta claves de más', cruda.success && cruda.data.visitas[0].lineas.length === 0 && cruda.data.visitas[0].efectiva && cruda.data.visitas[0].modalidad_sugerida === 'presencial' && !JSON.stringify(cruda.data).includes('123'), cruda.success ? cruda.data : cruda.error.issues)
  check('propuestaSchema rechaza 11 visitas', !propuestaSchema.safeParse({ visitas: Array.from({ length: 11 }, () => ({ tipo: 'medica' })), aviso: null }).success)
  check('propuestaSchema rechaza un tipo desconocido', !propuestaSchema.safeParse({ visitas: [{ tipo: 'otra' }], aviso: null }).success)
  check('esAudioPermitido: m4a, webm con codecs y mp4 sí; png no; por extensión si no hay MIME', esAudioPermitido('audio/m4a') && esAudioPermitido('audio/webm;codecs=opus') && esAudioPermitido('audio/mp4') && !esAudioPermitido('image/png') && esAudioPermitido(null, 'grabacion.M4A') && !esAudioPermitido('', 'nota.txt'))
  check('AUDIO_MAX_BYTES = 25 MB', AUDIO_MAX_BYTES === 26214400)
  const fechas = normalizarPropuesta(
    { visitas: [crudaBase({ medico_id: MED1, next_step_date: '2026-10-12' }), crudaBase({ medico_id: MED1, next_step_date: HOY }), crudaBase({ medico_id: MED1, next_step_date: '2026-10-19' })], aviso: null },
    contextoRespuesta()
  )
  check(
    'normalizarPropuesta: una próxima reunión ANTERIOR a hoy (el lunes mal resuelto un martes) se descarta; hoy o después se conserva',
    fechas.visitas[0].next_step_date === null && fechas.visitas[1].next_step_date === HOY && fechas.visitas[2].next_step_date === '2026-10-19',
    fechas.visitas.map(v => v.next_step_date)
  )
}

// ---------------------------------------------------------------------------
// 8. Esquemas zod
// ---------------------------------------------------------------------------

seccion('8. Esquemas zod (mensajes en español, límites)')
{
  const telefonicaConGps = visitaCreateSchema.safeParse(cuerpoMedica({ modalidad: 'telefonica', medio: 'llamada', gps_accuracy_m: 9 }))
  check(
    'telefónica con el GPS del teléfono: lat, lng y gps_accuracy_m quedan en null (privacidad: nunca se guarda dónde estaba)',
    telefonicaConGps.success && telefonicaConGps.data.lat === null && telefonicaConGps.data.lng === null && telefonicaConGps.data.gps_accuracy_m === null,
    telefonicaConGps.success ? telefonicaConGps.data : telefonicaConGps.error.issues
  )
  const presencialConGps = visitaCreateSchema.safeParse(cuerpoMedica())
  check('presencial: conserva lat, lng y la precisión', presencialConGps.success && presencialConGps.data.lat !== null && presencialConGps.data.gps_accuracy_m === 8)
  const ok = visitaCreateSchema.safeParse(cuerpoMedica({ executive_id: 'colado', kam_id: 'colado', cuenta_id: CUENTA1, medio: 'llamada' }))
  check('visitaCreateSchema: médica presencial válida; claves de más fuera; cuenta_id y medio en null por el tipo y la modalidad', ok.success && !('executive_id' in ok.data) && !('kam_id' in ok.data) && ok.data.cuenta_id === null && ok.data.medio === null && ok.data.tipo === 'medica' && ok.data.modalidad === 'presencial', ok.success ? ok.data : ok.error.issues)
  check('visitaCreateSchema: lat como texto "4,7110" se acepta', visitaCreateSchema.safeParse(cuerpoMedica({ lat: '4,7110', lng: '-74.0721' })).success)
  const sinMedico = visitaCreateSchema.safeParse(cuerpoMedica({ medico_id: undefined }))
  check('médica sin medico_id → "Elige el médico"', !sinMedico.success && mensajeZod(sinMedico, 'medico_id') === 'Elige el médico')
  const sinSubtipo = visitaCreateSchema.safeParse(cuerpoInstitucional({ subtipo_id: null }))
  check('institucional sin subtipo → mensaje en subtipo_id', !sinSubtipo.success && mensajeZod(sinSubtipo, 'subtipo_id') === 'Elige el subtipo de la visita institucional')
  check('institucional sin cuenta → "Elige la cuenta"', mensajeZod(visitaCreateSchema.safeParse(cuerpoInstitucional({ cuenta_id: undefined })), 'cuenta_id') === 'Elige la cuenta')
  const sinGps = visitaCreateSchema.safeParse(cuerpoMedica({ lat: undefined, lng: undefined }))
  check('presencial sin lat/lng → mensaje en lat', !sinGps.success && mensajeZod(sinGps, 'lat') === 'La ubicación del teléfono es obligatoria en una visita presencial')
  check('presencial con lat sin lng → "Manda latitud y longitud juntas" (en lng)', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ lng: undefined })), 'lng') === 'Manda latitud y longitud juntas')
  const sinMedio = visitaCreateSchema.safeParse(cuerpoMedica({ modalidad: 'telefonica', lat: undefined, lng: undefined }))
  check('telefónica sin medio → mensaje en medio', !sinMedio.success && mensajeZod(sinMedio, 'medio') === 'Indica el medio: llamada o videollamada')
  const telefonicaOk = visitaCreateSchema.safeParse(cuerpoMedica({ modalidad: 'telefonica', medio: 'videollamada', lat: undefined, lng: undefined }))
  check('telefónica con medio y sin GPS: válida, lat/lng null', telefonicaOk.success && telefonicaOk.data.modalidad === 'telefonica' && telefonicaOk.data.lat === null && telefonicaOk.data.medio === 'videollamada')
  check('medio desconocido → mensaje', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ modalidad: 'telefonica', medio: 'whatsapp', lat: undefined, lng: undefined })), 'medio') === 'Medio no válido: llamada o videollamada')
  const noEfectiva = visitaCreateSchema.safeParse(cuerpoMedica({ efectiva: false }))
  check('no efectiva sin failure_reason → mensaje', !noEfectiva.success && (mensajeZod(noEfectiva, 'failure_reason') ?? '').startsWith('Indica el motivo'))
  const noEfectivaOk = visitaCreateSchema.safeParse(cuerpoMedica({ efectiva: false, failure_reason: 'No estaba', retry_date: '2026-10-20' }))
  check('no efectiva con motivo y fecha de reintento: válida', noEfectivaOk.success && noEfectivaOk.data.failure_reason === 'No estaba' && noEfectivaOk.data.retry_date === '2026-10-20')
  const efectivaConMotivo = visitaCreateSchema.safeParse(cuerpoMedica({ failure_reason: 'sobra' }))
  check('efectiva con failure_reason: se descarta (null)', efectivaConMotivo.success && efectivaConMotivo.data.failure_reason === null)
  check('failure_reason de 301 caracteres → error', !visitaCreateSchema.safeParse(cuerpoMedica({ efectiva: false, failure_reason: 'x'.repeat(301) })).success)
  check('lineas vacías → mensaje', (mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ lineas: [] })), 'lineas') ?? '').startsWith('Elige al menos una línea'))
  check('11 líneas → error', !visitaCreateSchema.safeParse(cuerpoMedica({ lineas: Array.from({ length: 11 }, (_, i) => `bbbbbbbb-0000-4000-8000-0000000000${String(i + 10)}`) })).success)
  check('líneas repetidas → "Hay líneas repetidas"', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ lineas: [L1, L1] })), 'lineas') === 'Hay líneas repetidas')
  check('línea con id no uuid → "Línea no válida"', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ lineas: ['ortopedia'] })), 'lineas.0') === 'Línea no válida')
  check('transcript de 8001 → error; de 8000 → ok', !visitaCreateSchema.safeParse(cuerpoMedica({ transcript: 'a'.repeat(8001) })).success && visitaCreateSchema.safeParse(cuerpoMedica({ transcript: 'a'.repeat(8000) })).success)
  check('conclusion de 2001 → error', !visitaCreateSchema.safeParse(cuerpoMedica({ conclusion: 'a'.repeat(2001) })).success)
  check('compromisos de 2001 → error', !visitaCreateSchema.safeParse(cuerpoMedica({ compromisos: 'a'.repeat(2001) })).success)
  check('checked_in_at sin zona → error', !visitaCreateSchema.safeParse(cuerpoMedica({ checked_in_at: '2026-10-13T10:40:00' })).success)
  check('reported_at anterior a checked_in_at → error en reported_at', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ reported_at: '2026-10-13T10:30:00-05:00' })), 'reported_at') === 'La hora del reporte no puede ser anterior a la de llegada')
  check('client_id que no es uuid → error', !visitaCreateSchema.safeParse(cuerpoMedica({ client_id: 'visita-1' })).success)
  check('next_step_date inválida → mensaje de fecha', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ next_step_date: '20/10/2026' })), 'next_step_date') === 'Fecha no válida: usa AAAA-MM-DD')
  check('tipo desconocido → mensaje', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ tipo: 'social' })), 'tipo') === 'Tipo de visita no válido: medica o institucional')
  check('input_mode desconocido → mensaje', mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ input_mode: 'web' })), 'input_mode') === 'Modo de entrada no válido: voz o toques')
  check('cuerpo que no es objeto → mensaje', mensajeZod(visitaCreateSchema.safeParse('hola')) === 'Datos no válidos: se esperaba un objeto JSON')
  check('gps_accuracy_m decimal → entero', visitaCreateSchema.parse(cuerpoMedica({ gps_accuracy_m: 12.6 })).gps_accuracy_m === 13)

  check('visitaUpdateSchema: {} → "No hay campos para corregir"', mensajeZod(visitaUpdateSchema.safeParse({})) === 'No hay campos para corregir')
  check('visitaUpdateSchema: efectiva false sin motivo → error', (mensajeZod(visitaUpdateSchema.safeParse({ efectiva: false }), 'failure_reason') ?? '').startsWith('Indica el motivo'))
  const update = visitaUpdateSchema.safeParse({ conclusion: '  Quedó  en llamar ', lineas: [L2], colado: 1 })
  check('visitaUpdateSchema: solo los campos enviados, limpios', update.success && JSON.stringify(update.data) === JSON.stringify({ conclusion: 'Quedó en llamar', lineas: [L2] }), update.success ? update.data : update.error.issues)
  check('visitaUpdateSchema: next_step_date null para borrarla', JSON.stringify(visitaUpdateSchema.parse({ next_step_date: null })) === JSON.stringify({ next_step_date: null }))

  check('anularSchema: motivo corto → mensaje', mensajeZod(anularSchema.safeParse({ motivo: 'abc' }), 'motivo') === 'Escribe el motivo (al menos 5 caracteres)')
  check('anularSchema: motivo válido se limpia', anularSchema.parse({ motivo: '  Me equivoqué   de médico ' }).motivo === 'Me equivoqué de médico')
  check('anularSchema: 301 caracteres → error', !anularSchema.safeParse({ motivo: 'a'.repeat(301) }).success)

  check('proponerSchema: transcript vacío → error', !proponerSchema.safeParse({ transcript: '   ', hora: '2026-10-13T10:42:00-05:00' }).success)
  check('proponerSchema: 8001 caracteres → error', !proponerSchema.safeParse({ transcript: 'a'.repeat(8001), hora: '2026-10-13T10:42:00-05:00' }).success)
  check('proponerSchema: lat sin lng → error', !proponerSchema.safeParse({ transcript: 'hola', lat: 4.7, hora: '2026-10-13T10:42:00-05:00' }).success)
  check('proponerSchema: hora sin zona → error', !proponerSchema.safeParse({ transcript: 'hola', hora: '2026-10-13T10:42:00' }).success)
  const proponerOk = proponerSchema.safeParse({ transcript: 'Estuve con el doctor Pérez', lat: '4,7110', lng: '-74.0721', precision: 9.4, hora: '2026-10-13T10:42:00-05:00' })
  check('proponerSchema: válido con GPS como texto y precisión redondeada', proponerOk.success && proponerOk.data.lat === 4.711 && proponerOk.data.precision === 9)

  const contextoOk = contextoQuerySchema.safeParse({ lat: '4,7110', lng: '-74.0721', precision: '12.6' })
  check('contextoQuerySchema: lat/lng/precision como texto → números (precisión entera)', contextoOk.success && contextoOk.data.lat === 4.711 && contextoOk.data.lng === -74.0721 && contextoOk.data.precision === 13)
  check('contextoQuerySchema: solo lat → error', !contextoQuerySchema.safeParse({ lat: '4.7' }).success)
  check('contextoQuerySchema: lat 95 → mensaje', mensajeZod(contextoQuerySchema.safeParse({ lat: 95, lng: 0 }), 'lat') === 'Latitud no válida (−90 a 90)')
  const contextoVacio = contextoQuerySchema.safeParse({ lat: null, lng: null, precision: null })
  check('contextoQuerySchema: sin GPS → nulls', contextoVacio.success && contextoVacio.data.lat === null && contextoVacio.data.lng === null && contextoVacio.data.precision === null)

  check('numerosQuerySchema: 2026-13 → error; null → null; 2026-10 ok', !numerosQuerySchema.safeParse({ mes: '2026-13' }).success && numerosQuerySchema.parse({ mes: null }).mes === null && numerosQuerySchema.parse({ mes: ' 2026-10 ' }).mes === '2026-10')
  check('visitasQuerySchema: fecha inválida → error; vacía → null', !visitasQuerySchema.safeParse({ fecha: '13/10/2026' }).success && visitasQuerySchema.parse({ fecha: '' }).fecha === null)
  check('audioMetaSchema: 181 s → error; 120 s ok', !audioMetaSchema.safeParse({ duracion_s: 181 }).success && audioMetaSchema.parse({ duracion_s: '120' }).duracion_s === 120)

  const loginOk = loginMovilSchema.safeParse({ email: ' Ana@Test.local ', password: 'secreta', cliente: 'movil' })
  check('loginMovilSchema: email normalizado y cliente movil', loginOk.success && loginOk.data.email === 'ana@test.local' && loginOk.data.cliente === 'movil')
  check('loginMovilSchema: cliente web → mensaje', mensajeZod(loginMovilSchema.safeParse({ email: 'a@b.co', password: 'x', cliente: 'web' }), 'cliente') === "El cliente de la app es 'movil' o 'campo-web'")
  check('loginMovilSchema: sin contraseña → mensaje', mensajeZod(loginMovilSchema.safeParse({ email: 'a@b.co', cliente: 'movil' }), 'password') === 'Escribe tu contraseña')
}


// ---------------------------------------------------------------------------
// 8b. Sede nueva de la app: el código del REPS solo confirma cerca de su municipio
// ---------------------------------------------------------------------------

seccion('8b. sedeAppConfirmada: código del REPS que cruza, del mismo prestador Y GPS a menos de 20 km del centro del municipio')
{
  const MEDELLIN_CENTRO = { lat: 6.2442, lng: -75.5812 }
  const BOGOTA_CASA = { lat: 4.711, lng: -74.0721 }
  /** El código es del mismo prestador que la cuenta (NIT del REPS = número de identificación de la cuenta). */
  const MISMO = { nit_reps: '890900286', identificacion_cuenta: '890900286' }
  check('el código de Medellín con el GPS de una casa en Bogotá (≈ 240 km): NO se confirma', !sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: BOGOTA_CASA, centro_municipio: MEDELLIN_CENTRO }))
  check('el mismo código con el GPS en Medellín (a 1 km del centro): se confirma', sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: aMetrosAlNorte(MEDELLIN_CENTRO, 1000), centro_municipio: MEDELLIN_CENTRO }))
  check('a 19 km sí; a 21 km no (tope MAX_M_SEDE_APP_AL_MUNICIPIO = 20 km)', MAX_M_SEDE_APP_AL_MUNICIPIO === 20_000 && sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: aMetrosAlNorte(MEDELLIN_CENTRO, 19_000), centro_municipio: MEDELLIN_CENTRO }) && !sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: aMetrosAlNorte(MEDELLIN_CENTRO, 21_000), centro_municipio: MEDELLIN_CENTRO }))
  check('el municipio del REPS no es el de la sede ni el de la principal: no', !sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['11001', null], punto: MEDELLIN_CENTRO, centro_municipio: MEDELLIN_CENTRO }))
  check('código que no está en el REPS, sin GPS o sin centro del municipio: no (nunca a ciegas)', !sedeAppConfirmada({ ...MISMO, municipio_reps: null, municipios_aceptados: ['05001'], punto: MEDELLIN_CENTRO, centro_municipio: MEDELLIN_CENTRO }) && !sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: null, centro_municipio: MEDELLIN_CENTRO }) && !sedeAppConfirmada({ ...MISMO, municipio_reps: '05001', municipios_aceptados: ['05001'], punto: MEDELLIN_CENTRO, centro_municipio: null }))
  const EN_MEDELLIN = { municipio_reps: '05001', municipios_aceptados: ['05001'], punto: aMetrosAlNorte(MEDELLIN_CENTRO, 1000), centro_municipio: MEDELLIN_CENTRO }
  check(
    'un código público de OTRO prestador de la misma ciudad, con el GPS bien: NO se confirma (no basta el municipio)',
    !sedeAppConfirmada({ ...EN_MEDELLIN, nit_reps: '800058016', identificacion_cuenta: '890900286' })
  )
  check(
    'sin el NIT del REPS o sin el número de la cuenta: no (nunca a ciegas)',
    !sedeAppConfirmada({ ...EN_MEDELLIN, nit_reps: null, identificacion_cuenta: '890900286' }) && !sedeAppConfirmada({ ...EN_MEDELLIN, nit_reps: '890900286', identificacion_cuenta: null })
  )
  check(
    'mismoPrestador: solo dígitos y sin ceros a la izquierda (puntos, guiones y relleno del REPS no estorban)',
    mismoPrestador('890.900.286', '890900286') && mismoPrestador('0890900286', '890900286') && !mismoPrestador('890900286', '890900287') && !mismoPrestador('', '') && !mismoPrestador('00', '0')
  )
}

// ---------------------------------------------------------------------------
// 8c. Duración del audio leída del archivo y límite de frecuencia de la voz
// ---------------------------------------------------------------------------

/** Caja MP4: tamaño (4) + tipo (4) + contenido. */
function cajaMp4(tipo: string, contenido: Uint8Array): Uint8Array {
  const caja = new Uint8Array(8 + contenido.length)
  new DataView(caja.buffer).setUint32(0, caja.length)
  for (let i = 0; i < 4; i++) caja[4 + i] = tipo.charCodeAt(i)
  caja.set(contenido, 8)
  return caja
}
const unir = (...partes: Uint8Array[]) => {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const parte of partes) {
    total.set(parte, i)
    i += parte.length
  }
  return total
}
/** mvhd versión 0 (escala y duración de 32 bits) o 1 (duración de 64 bits). */
function mvhd(version: 0 | 1, escala: number, duracion: number): Uint8Array {
  const cuerpo = new Uint8Array(version === 0 ? 100 : 112)
  const vista = new DataView(cuerpo.buffer)
  cuerpo[0] = version
  if (version === 0) {
    vista.setUint32(12, escala)
    vista.setUint32(16, duracion)
  } else {
    vista.setUint32(20, escala)
    vista.setUint32(24, Math.floor(duracion / 0x100000000))
    vista.setUint32(28, duracion % 0x100000000)
  }
  return cajaMp4('mvhd', cuerpo)
}
const ftyp = cajaMp4('ftyp', new TextEncoder().encode('M4A \u0000\u0000\u0000\u0000isommp42'))

/** Elemento EBML: id (con su marca), tamaño (vint de 8 bytes, o desconocido) y contenido. */
function ebml(id: number[], contenido: Uint8Array | null, desconocido = false): Uint8Array {
  const tamano = new Uint8Array(8)
  tamano[0] = 0x01
  if (desconocido) tamano.fill(0xff, 1)
  else new DataView(tamano.buffer).setUint32(4, contenido?.length ?? 0)
  return unir(new Uint8Array(id), tamano, contenido ?? new Uint8Array(0))
}
const uintEbml = (valor: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, valor)
  return b
}
const bloque = (relativoMs: number) => {
  const b = new Uint8Array(4 + 20)
  b[0] = 0x81 // pista 1
  new DataView(b.buffer).setInt16(1, relativoMs)
  return ebml([0xa3], b)
}
const cabeceraEbml = ebml([0x1a, 0x45, 0xdf, 0xa3], new TextEncoder().encode('webm'))

seccion('8c. duracionAudioSegundos (m4a/mp4 y webm) y revisarLimite (voz por persona)')
{
  check('m4a: mvhd versión 0, escala 44100 y 200 s → 200', duracionAudioSegundos(unir(ftyp, cajaMp4('moov', mvhd(0, 44100, 44100 * 200)))) === 200)
  check('m4a: con el mdat (audio) ANTES del moov, como graba el teléfono → 42,5', duracionAudioSegundos(unir(ftyp, cajaMp4('mdat', new Uint8Array(50_000)), cajaMp4('moov', mvhd(0, 1000, 42_500)))) === 42.5)
  check('mp4: mvhd versión 1 (64 bits) → 3600', duracionAudioSegundos(unir(ftyp, cajaMp4('moov', unir(cajaMp4('free', new Uint8Array(3)), mvhd(1, 1000, 3_600_000))))) === 3600)
  check('mp4 sin moov, con duración 0 o cortado: null (nunca lanza)', duracionAudioSegundos(unir(ftyp, cajaMp4('mdat', new Uint8Array(10)))) === null && duracionAudioSegundos(unir(ftyp, cajaMp4('moov', mvhd(0, 1000, 0)))) === null && duracionAudioSegundos(unir(ftyp, cajaMp4('moov', mvhd(0, 1000, 5000))).slice(0, 50)) === null)
  const duracion = new Uint8Array(8)
  new DataView(duracion.buffer).setFloat64(0, 95_500)
  const webmConDuracion = unir(cabeceraEbml, ebml([0x18, 0x53, 0x80, 0x67], unir(ebml([0x15, 0x49, 0xa9, 0x66], unir(ebml([0x2a, 0xd7, 0xb1], uintEbml(1_000_000)), ebml([0x44, 0x89], duracion))))))
  check('webm con Info › Duration (95 500 ms) → 95,5', duracionAudioSegundos(webmConDuracion) === 95.5)
  // MediaRecorder del navegador: Segment y Cluster de tamaño desconocido y SIN Duration → el último bloque.
  const cluster = (tiempo: number, relativos: number[]) => unir(ebml([0x1f, 0x43, 0xb6, 0x75], null, true), ebml([0xe7], uintEbml(tiempo)), ...relativos.map(bloque))
  const webmVivo = unir(cabeceraEbml, ebml([0x18, 0x53, 0x80, 0x67], null, true), ebml([0x15, 0x49, 0xa9, 0x66], ebml([0x2a, 0xd7, 0xb1], uintEbml(1_000_000))), cluster(0, [0, 20, 32_000]), cluster(32_700, [0, 20, 30_000]), cluster(185_000, [0, 1_500]))
  check('webm de MediaRecorder (sin Duration, Cluster de tamaño desconocido): el último bloque → 186,5 s', duracionAudioSegundos(webmVivo) === 186.5, duracionAudioSegundos(webmVivo))
  check('webm cortado a la mitad: lo que alcanza a leer, sin lanzar', (duracionAudioSegundos(webmVivo.slice(0, Math.floor(webmVivo.length / 2))) ?? 0) < 186.5)
  check('otro formato o basura: null', duracionAudioSegundos(new Uint8Array(4096).fill(7)) === null && duracionAudioSegundos(new Uint8Array(0)) === null && duracionAudioSegundos(new TextEncoder().encode('RIFF....WAVEfmt ')) === null)

  const t0 = Date.parse('2026-10-13T15:42:00Z')
  const seis = Array.from({ length: 6 }, (_, i) => t0 + i * 1000)
  const lleno = revisarLimite(seis, t0 + 6000, LIMITES_VOZ.transcribir)
  check('transcribir: 6 en el mismo minuto → la 7.ª no (429) y dice en cuántos segundos volver', !lleno.permitido && lleno.reintentar_en_s === 54, lleno)
  check('transcribir: un minuto después de la primera, sí', revisarLimite(seis, t0 + 60_001, LIMITES_VOZ.transcribir).permitido)
  const hora = Array.from({ length: 40 }, (_, i) => t0 + i * 61_000)
  check('transcribir: 40 en la hora (espaciadas) → la 41.ª no', !revisarLimite(hora, t0 + 40 * 61_000, LIMITES_VOZ.transcribir).permitido)
  check('revisarLimite olvida lo de hace más de una hora', revisarLimite(hora, t0 + 4 * 3_600_000, LIMITES_VOZ.transcribir).vigentes.length === 0)
  check('proponer: 10 por minuto', revisarLimite(Array.from({ length: 9 }, () => t0), t0, LIMITES_VOZ.proponer).permitido && !revisarLimite(Array.from({ length: 10 }, () => t0), t0, LIMITES_VOZ.proponer).permitido)
  const horaLlena = revisarLimite(hora, t0 + 40 * 61_000, LIMITES_VOZ.transcribir)
  check('transcribir: la 41.ª de la hora dice volver cuando la primera sale de la hora (3600 − 2440 = 1160 s)', !horaLlena.permitido && horaLlena.reintentar_en_s === 1160, horaLlena.reintentar_en_s)
  const sesenta = Array.from({ length: 60 }, (_, i) => t0 + i * 50_000) // a lo sumo 2 en un minuto
  check('proponer: 59 en la hora pasan (espaciadas 50 s)', revisarLimite(sesenta.slice(0, 59), t0 + 59 * 50_000, LIMITES_VOZ.proponer).permitido)
  const proponerLleno = revisarLimite(sesenta, t0 + 60 * 50_000, LIMITES_VOZ.proponer)
  check('proponer: 60 por hora → la 61.ª no, y vuelve en 600 s (3600 − 3000)', !proponerLleno.permitido && proponerLleno.reintentar_en_s === 600, proponerLleno)
  check('proponer: una hora después de la primera, sí', revisarLimite(sesenta, t0 + 3_600_000, LIMITES_VOZ.proponer).permitido)
  check('LIMITES_VOZ: los del contrato (transcribir 6/min y 40/h; proponer 10/min y 60/h)', JSON.stringify(LIMITES_VOZ) === JSON.stringify({ transcribir: [{ ventana_ms: 60_000, maximo: 6 }, { ventana_ms: 3_600_000, maximo: 40 }], proponer: [{ ventana_ms: 60_000, maximo: 10 }, { ventana_ms: 3_600_000, maximo: 60 }] }))
}

// ---------------------------------------------------------------------------
// 10. Agenda (F4.1, migración 0840): ventana, vínculo, "agendada", indicador y dictado por campo
// ---------------------------------------------------------------------------

seccion('10. Agenda (F4.1): ventana de fechas, días libres, cancelable y hora')
{
  check('ESTADOS_CITA (0850): pendiente, hecha, no_realizada, cancelada y eliminada', ESTADOS_CITA.map(e => e.valor).join(',') === 'pendiente,hecha,no_realizada,cancelada,eliminada')
  check('mensajeFechaCita (0850, A4): ayer no; hoy, mañana, hoy + 30, hoy + 31 y hoy + 400 sí (sin tope hacia adelante)', mensajeFechaCita('2026-10-12', HOY) === MENSAJE_CITA_PASADA && mensajeFechaCita(HOY, HOY) === null && mensajeFechaCita('2026-10-14', HOY) === null && mensajeFechaCita('2026-11-12', HOY) === null && mensajeFechaCita('2026-11-13', HOY) === null && mensajeFechaCita('2027-11-17', HOY) === null)
  check('mensajeFechaCita: fecha no válida', mensajeFechaCita('2026-13-40', HOY) !== null && mensajeFechaCita('mañana', HOY) !== null)
  const libres = [
    { fecha: '2026-10-20', fraccion: 1, estado: 'registrado' },
    { fecha: '2026-10-21', fraccion: 1, estado: 'aprobado' },
    { fecha: '2026-10-22', fraccion: 0.5, estado: 'registrado' },
    { fecha: '2026-10-23', fraccion: 1, estado: 'por_aprobar' },
    { fecha: '2026-10-26', fraccion: 1, estado: 'rechazado' },
    { fecha: '2026-10-27', fraccion: 1, estado: 'anulado' },
  ]
  check('día libre de día completo registrado o aprobado: no se agenda', mensajeFechaCita('2026-10-20', HOY, libres) === MENSAJE_CITA_DIA_LIBRE && mensajeFechaCita('2026-10-21', HOY, libres) === MENSAJE_CITA_DIA_LIBRE)
  check('medio día, por aprobar, rechazado o anulado: sí se agenda', ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27'].every(fecha => mensajeFechaCita(fecha, HOY, libres) === null && !esDiaLibreCompleto(libres, fecha)))
  check('festivo (el 12 de octubre es festivo en 2026 pero ya pasó; el 2 de noviembre lo es y está en la ventana): sí se agenda', mensajeFechaCita('2026-11-02', HOY, libres) === null)
  check('citaCancelable: pendiente de hoy o futura sí; de ayer, hecha o cancelada no', citaCancelable({ estado: 'pendiente', fecha: HOY }, HOY) && citaCancelable({ estado: 'pendiente', fecha: '2026-10-30' }, HOY) && !citaCancelable({ estado: 'pendiente', fecha: '2026-10-12' }, HOY) && !citaCancelable({ estado: 'hecha', fecha: HOY }, HOY) && !citaCancelable({ estado: 'cancelada', fecha: '2026-10-30' }, HOY))
  check('horaCorta: "09:30", "09:30:00" (PostgreSQL) → "09:30"; "9:30", "24:00" y texto no', horaCorta('09:30') === '09:30' && horaCorta('09:30:00') === '09:30' && horaCorta('23:59:59.5') === '23:59' && horaCorta('9:30') === null && horaCorta('24:00') === null && horaCorta('mañana') === null && horaCorta(null) === null)
  const rango = (desde: string | null, hasta: string | null) => rangoConsultaAgenda({ desde, hasta }, HOY)
  check('rangoConsultaAgenda: sin fechas hoy a hoy + 7; solo desde, desde + 7; solo hasta, de hoy a hasta', JSON.stringify(rango(null, null)) === JSON.stringify({ desde: HOY, hasta: '2026-10-20', error: null }) && rango('2026-10-15', null).hasta === '2026-10-22' && rango(null, '2026-10-30').desde === HOY)
  check(`rangoConsultaAgenda: ${MAX_DIAS_CONSULTA_AGENDA} días sí, 32 no; hasta antes de desde no`, rango('2026-10-01', '2026-10-31').error === null && rango('2026-10-01', '2026-11-01').error !== null && rango('2026-10-20', '2026-10-19').error !== null && rango(null, '2026-10-12').error !== null)
}

seccion('10b. Vínculo con la visita y "agendada" (decisiones 6 y 7)')
{
  const EJEC_B = 'aaaaaaaa-0000-4000-8000-000000000002'
  // 0850: el vínculo es por persona (user_id) y con el mismo papel (executive_id).
  const USUARIO = 'abababab-0000-4000-8000-000000000001'
  const USUARIO_B = 'abababab-0000-4000-8000-000000000002'
  const cita = (extra: Partial<CitaVinculo>): CitaVinculo => ({
    id: 'c0000000-0000-4000-8000-000000000000',
    user_id: USUARIO,
    executive_id: EJEC,
    fecha: HOY,
    hora: null,
    tipo: 'medica',
    medico_id: MED1,
    cuenta_id: null,
    subtipo_id: null,
    estado: 'pendiente',
    created_at: '2026-10-12T15:00:00.000Z',
    ...extra,
  })
  const medica: VisitaParaVinculo = { user_id: USUARIO, executive_id: EJEC, fecha: HOY, tipo: 'medica', medico_id: MED1, cuenta_id: null, subtipo_id: null }
  const institucional: VisitaParaVinculo = { user_id: USUARIO, executive_id: EJEC, fecha: HOY, tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_QUIMICO }

  // Medianoche: Bogotá es UTC−5. 23:30 del 12 en Bogotá = 04:30Z del 13 (antes del día de la visita); 00:30 del 13 = 05:30Z.
  check('citaAnticipada: creada ayer (Bogotá) → agendada; creada hoy → no', citaAnticipada('2026-10-12T15:00:00.000Z', HOY) && !citaAnticipada('2026-10-13T12:00:00.000Z', HOY))
  check('citaAnticipada: a las 23:30 del día anterior en Bogotá (04:30Z del día) SÍ cuenta; a las 00:30 de ese día (05:30Z) NO', citaAnticipada('2026-10-13T04:30:00.000Z', HOY) && !citaAnticipada('2026-10-13T05:30:00.000Z', HOY) && !citaAnticipada('2026-10-13T00:30:00-05:00', HOY))
  check('citaAnticipada: instante no válido → no', !citaAnticipada('ayer', HOY))

  const una = cita({ id: 'c1' })
  check('vínculo automático: la pendiente de ese día con el mismo médico', citaParaVincular([una], medica)?.id === 'c1')
  const noSirven = [
    cita({ id: 'otro-dia', fecha: '2026-10-14' }),
    cita({ id: 'cancelada', estado: 'cancelada' }),
    cita({ id: 'hecha', estado: 'hecha' }),
    cita({ id: 'ajena', user_id: USUARIO_B, executive_id: EJEC_B }),
    cita({ id: 'otro-papel', executive_id: null }),
    cita({ id: 'no-se-hizo', estado: 'no_realizada' }),
    cita({ id: 'eliminada', estado: 'eliminada' }),
    cita({ id: 'otro-medico', medico_id: MED_AJENO }),
    cita({ id: 'institucional', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS }),
  ]
  check('vínculo automático: ni de otro día, ni cancelada, ni hecha, ni ajena, ni del otro papel, ni cerrada, ni eliminada, ni de otro médico, ni de otro tipo → no agendada', citaParaVincular(noSirven, medica) === null && vinculoDeVisita({ citas: noSirven, visita: medica, agenda_id: null }).agendada === false)
  const inst = [
    cita({ id: 'i-compras-8', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, hora: '08:00' }),
    cita({ id: 'i-quimico-10', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_QUIMICO, hora: '10:00' }),
    cita({ id: 'i-otra-cuenta', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA2, subtipo_id: SUB_QUIMICO, hora: '07:00' }),
  ]
  check('institucional: la misma cuenta, prefiriendo el mismo subtipo aunque su hora sea más tarde', citaParaVincular(inst, institucional)?.id === 'i-quimico-10')
  check('institucional: con otro subtipo, la de la cuenta más temprana', citaParaVincular(inst, { ...institucional, subtipo_id: SUB_PROGRAMACION })?.id === 'i-compras-8')
  const empates = [
    cita({ id: 'b-sin-hora', hora: null, created_at: '2026-10-01T10:00:00Z' }),
    cita({ id: 'b-10', hora: '10:00', created_at: '2026-10-05T10:00:00Z' }),
    cita({ id: 'a-10', hora: '10:00', created_at: '2026-10-05T10:00:00Z' }),
    cita({ id: 'c-10-antes', hora: '10:00', created_at: '2026-10-02T10:00:00Z' }),
  ]
  check('entre varias: hora más temprana (sin hora al final), luego la creada primero, luego por id (el ORDER BY de la 0840)', citaParaVincular(empates, medica)?.id === 'c-10-antes' && citaParaVincular(empates.slice(0, 3), medica)?.id === 'a-10' && citaParaVincular(empates.slice(0, 1), medica)?.id === 'b-sin-hora')

  check('revisarCitaElegida: la buena sirve', revisarCitaElegida(una, medica) === null && revisarCitaElegida(inst[0], institucional) === null)
  const casos: [string, CitaVinculo | null, VisitaParaVinculo, string][] = [
    ['inexistente', null, medica, MENSAJE_CITA_AJENA],
    ['de otra persona', cita({ user_id: USUARIO_B, executive_id: EJEC_B }), medica, MENSAJE_CITA_AJENA],
    ['eliminada por error (0850)', cita({ estado: 'eliminada' }), medica, MENSAJE_CITA_AJENA],
    ['cancelada', cita({ estado: 'cancelada' }), medica, MENSAJE_CITA_CANCELADA],
    ['que no se hizo (0850)', cita({ estado: 'no_realizada' }), medica, MENSAJE_CITA_CERRADA],
    ['del otro papel: cita como líder y visita como Ejecutivo Comercial (0850, C12)', cita({ executive_id: null }), medica, MENSAJE_CITA_OTRO_PAPEL],
    ['ya hecha', cita({ estado: 'hecha' }), medica, MENSAJE_CITA_YA_HECHA],
    ['de otro día', cita({ fecha: '2026-10-14' }), medica, MENSAJE_CITA_OTRO_DIA],
    ['de otro tipo', cita({}), institucional, MENSAJE_CITA_OTRO_TIPO],
    ['con otro médico', cita({ medico_id: MED_AJENO }), medica, MENSAJE_CITA_OTRO_MEDICO],
    ['con otra cuenta', inst[2], institucional, MENSAJE_CITA_OTRA_CUENTA],
  ]
  for (const [nombre, laCita, visita, mensaje] of casos) check(`revisarCitaElegida: ${nombre} → "${mensaje}"`, revisarCitaElegida(laCita, visita) === mensaje)

  const elegida = vinculoDeVisita({ citas: [una, cita({ id: 'hoy', created_at: '2026-10-13T14:00:00Z' })], visita: medica, agenda_id: 'hoy' })
  check('vinculoDeVisita con agenda_id: esa cita; creada hoy → vinculada pero NO agendada', elegida.cita?.id === 'hoy' && elegida.agendada === false && elegida.error === null)
  check('vinculoDeVisita con agenda_id creada ayer: agendada', vinculoDeVisita({ citas: [una], visita: medica, agenda_id: 'c1' }).agendada === true)
  check('vinculoDeVisita con agenda_id que no sirve: el error y nada vinculado', JSON.stringify(vinculoDeVisita({ citas: [una], visita: medica, agenda_id: 'otra' })) === JSON.stringify({ cita: null, agendada: false, error: MENSAJE_CITA_AJENA, relevo: null }))
  check('vinculoDeVisita sin agenda_id: la automática (creada ayer → agendada)', vinculoDeVisita({ citas: [una], visita: medica, agenda_id: null }).cita?.id === 'c1' && vinculoDeVisita({ citas: [una], visita: medica, agenda_id: null }).agendada)

  // Relevo (hallazgo del verificador): cita creada ayer con el Dr. A; a las 9:15 una no efectiva la cumple; a las 14:00
  // la efectiva con el mismo médico la toma y cuenta como agendada; la no efectiva la suelta.
  const cumplidaNoEfectiva = cita({ id: 'c-ne', estado: 'hecha', visita_id: 'v-no-efectiva', cumplida_por_no_efectiva: true })
  const efectiva: VisitaParaVinculo = { ...medica, efectiva: true }
  const noEfectiva: VisitaParaVinculo = { ...medica, efectiva: false }
  const relevo = vinculoDeVisita({ citas: [cumplidaNoEfectiva], visita: efectiva, agenda_id: null })
  check('relevo automático: la efectiva toma la cita que cumplió la no efectiva y cuenta como agendada', relevo.cita?.id === 'c-ne' && relevo.agendada && relevo.relevo === 'v-no-efectiva', relevo)
  check('relevo: otra no efectiva no la toma (queda no agendada)', vinculoDeVisita({ citas: [cumplidaNoEfectiva], visita: noEfectiva, agenda_id: null }).cita === null)
  check('relevo: sin saber si es efectiva, no hay relevo', citaParaVincular([cumplidaNoEfectiva], medica) === null)
  check('relevo: la que cumplió una EFECTIVA no se toma', citaParaVincular([cita({ id: 'c-ef', estado: 'hecha', visita_id: 'v-ef', cumplida_por_no_efectiva: false })], efectiva) === null)
  check('relevo con agenda_id: la efectiva sí; la no efectiva → "ya tiene su visita"', revisarCitaElegida(cumplidaNoEfectiva, efectiva) === null && revisarCitaElegida(cumplidaNoEfectiva, noEfectiva) === MENSAJE_CITA_YA_HECHA)
  const relevoElegido = vinculoDeVisita({ citas: [cumplidaNoEfectiva], visita: efectiva, agenda_id: 'c-ne' })
  check('relevo con agenda_id: vinculada, agendada y suelta la no efectiva', relevoElegido.cita?.id === 'c-ne' && relevoElegido.agendada && relevoElegido.relevo === 'v-no-efectiva' && relevoElegido.error === null)
  check('relevo institucional: a igual subtipo (aquí ninguno coincide), la pendiente va antes que el relevo aunque sea más tarde', citaParaVincular([
    cita({ id: 'i-relevo', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, hora: '07:00', estado: 'hecha', visita_id: 'v-ne', cumplida_por_no_efectiva: true }),
    cita({ id: 'i-pendiente', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_QUIMICO, hora: '11:00' }),
  ], { ...institucional, subtipo_id: SUB_PROGRAMACION, efectiva: true })?.id === 'i-pendiente')
  check('relevo institucional: el mismo subtipo manda (toma la de compras que falló antes que la del químico pendiente)', citaParaVincular([
    cita({ id: 'i-relevo', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, estado: 'hecha', visita_id: 'v-ne', cumplida_por_no_efectiva: true }),
    cita({ id: 'i-pendiente', tipo: 'institucional', medico_id: null, cuenta_id: CUENTA1, subtipo_id: SUB_QUIMICO }),
  ], { ...institucional, subtipo_id: SUB_COMPRAS, efectiva: true })?.id === 'i-relevo')
  check('pendiente sin relevo: la no efectiva también cumple la cita (decisión 7)', vinculoDeVisita({ citas: [una], visita: noEfectiva, agenda_id: null }).cita?.id === 'c1' && vinculoDeVisita({ citas: [una], visita: noEfectiva, agenda_id: null }).relevo === null)

  // Anular (espejo de visitas_anular): la cita pasa a otra visita suya del día sin cita (la efectiva primero) o vuelve a pendiente.
  const visitaDia = (extra: Partial<VisitaParaRetomar>): VisitaParaRetomar => ({
    id: 'v', user_id: USUARIO, executive_id: EJEC, fecha: HOY, tipo: 'medica', medico_id: MED1, cuenta_id: null, subtipo_id: null, efectiva: false,
    checked_in_at: '2026-10-13T14:15:00Z', agenda_id: null, anulada: false, ...extra,
  })
  const citaM = cita({ id: 'c-m', estado: 'hecha', visita_id: 'v-ef' })
  const delDia = [
    visitaDia({ id: 'v-ef', efectiva: true, agenda_id: 'c-m', checked_in_at: '2026-10-13T19:00:00Z' }),
    visitaDia({ id: 'v-ne', efectiva: false, checked_in_at: '2026-10-13T14:15:00Z' }),
    visitaDia({ id: 'v-otro-medico', efectiva: true, medico_id: MED_AJENO }),
    visitaDia({ id: 'v-anulada', efectiva: true, anulada: true }),
    visitaDia({ id: 'v-ajena', efectiva: true, user_id: USUARIO_B, executive_id: EJEC_B }),
    visitaDia({ id: 'v-otro-papel', efectiva: true, executive_id: null }),
    visitaDia({ id: 'v-otro-dia', efectiva: true, fecha: '2026-10-12' }),
  ]
  check('anular la efectiva del relevo: la cita vuelve a la no efectiva', visitaQueRetomaCita(citaM, 'v-ef', delDia)?.id === 'v-ne')
  check('anular: entre varias sin cita, la efectiva primero', visitaQueRetomaCita(citaM, 'v-ef', [...delDia, visitaDia({ id: 'v-ef2', efectiva: true, checked_in_at: '2026-10-13T20:00:00Z' })])?.id === 'v-ef2')
  check('anular: sin otra visita del mismo médico, de ella, de ese día y sin anular → la cita vuelve a pendiente', visitaQueRetomaCita(citaM, 'v-ef', delDia.filter(v => v.id !== 'v-ne')) === null)
  check('anular: una visita que ya cumple otra cita no la retoma', visitaQueRetomaCita(citaM, 'v-ef', [visitaDia({ id: 'v-con-cita', efectiva: true, agenda_id: 'otra-cita' })]) === null)
}

seccion('10c. Indicador de Mis números (decisión 8): porcentaje de agendadas y cumplimiento de la agenda')
{
  const visitas = [
    { efectiva: true, agendada: true },
    { efectiva: true, agendada: true },
    { efectiva: true, agendada: true },
    { efectiva: true, agendada: false },
    // La no efectiva cumple su cita pero no suma a las efectivas.
    { efectiva: false, agendada: true },
  ]
  const citas = [
    { fecha: '2026-10-05', estado: 'hecha' as const },
    { fecha: '2026-10-06', estado: 'hecha' as const },
    { fecha: '2026-10-07', estado: 'pendiente' as const }, // no la cumplió
    { fecha: '2026-10-08', estado: 'cancelada' as const }, // no cuenta
    { fecha: HOY, estado: 'pendiente' as const }, // de hoy: cuenta
    { fecha: '2026-10-20', estado: 'pendiente' as const }, // futura: no cuenta
  ]
  const r = cuentasAgenda({ visitas, citas, hoy: HOY })
  check('efectivas 4, agendadas 3 → porcentaje 0,75', r.efectivas === 4 && r.efectivas_agendadas === 3 && r.porcentaje_agendadas === 0.75, r)
  check('citas hasta hoy sin canceladas 4, hechas 2 → cumplimiento 0,5', r.citas_hasta_hoy === 4 && r.citas_hechas === 2 && r.cumplimiento === 0.5, r)
  const vacio = cuentasAgenda({ visitas: [], citas: [], hoy: HOY })
  check('sin visitas ni citas: razones en null (no 0 %)', vacio.porcentaje_agendadas === null && vacio.cumplimiento === null && vacio.efectivas === 0 && vacio.citas_hasta_hoy === 0)
  check('redondeo a 2 decimales (1 de 3 → 0,33)', cuentasAgenda({ visitas: [{ efectiva: true, agendada: true }, { efectiva: true, agendada: false }, { efectiva: true, agendada: false }], citas: [], hoy: HOY }).porcentaje_agendadas === 0.33)
  const cuotaVacia = { mes: '2026-10' } as unknown as Parameters<typeof numerosDesdeCumplimiento>[1]
  const conAgenda = numerosDesdeCumplimiento('2026-10', cuotaVacia, cumplimientoMes({ visitas: [], conteo: [], cuota: { medica: { cuota: 0 }, institucional: { cuota: 0 }, subtipos: [] } }), r)
  check('numerosDesdeCumplimiento: el bloque agenda (o null si no hay 0840)', conAgenda.agenda === r && numerosDesdeCumplimiento('2026-10', cuotaVacia, cumplimientoMes({ visitas: [], conteo: [], cuota: { medica: { cuota: 0 }, institucional: { cuota: 0 }, subtipos: [] } })).agenda === null)
}

seccion('10d. Distancia y orden de las citas (Reportar: la más cercana primero)')
{
  const lejos = aMetrosAlNorte(SEDE_PUNTO, 800)
  check('distanciaACita: con punto, metros y si está en el radio', JSON.stringify(distanciaACita(SEDE_PUNTO, aMetrosAlNorte(SEDE_PUNTO, 120), 500)) === JSON.stringify({ distancia_m: 120, dentro_del_radio: true }) && distanciaACita(lejos, SEDE_PUNTO, 500).dentro_del_radio === false)
  check('distanciaACita: sin punto o sede sin coordenadas → null', distanciaACita(SEDE_PUNTO, null, 500).distancia_m === null && distanciaACita({ lat: null, lng: null }, SEDE_PUNTO, 500).dentro_del_radio === null)
  const item = (id: string, extra: Partial<CitaItem>): CitaItem => ({
    id,
    fecha: HOY,
    hora: null,
    tipo: 'medica',
    medico: { id: MED1, nombre: 'Dr. Pérez' },
    cuenta: null,
    subtipo: null,
    sede: { id: SEDE1, nombre: 'Clínica Norte', cuenta_id: CUENTA1, cuenta_nombre: 'Clínica X', lat: SEDE_PUNTO.lat, lng: SEDE_PUNTO.lng, ubicacion_confirmada: true },
    nota: null,
    estado: 'pendiente',
    visita_id: null,
    distancia_m: null,
    dentro_del_radio: null,
    anticipada: true,
    cancelable: true,
    motivo_codigo: null,
    no_realizada_at: null,
    no_realizada_motivo: null,
    viene_de: null,
    viene_de_fecha: null,
    viene_de_estado: null,
    sucesora_id: null,
    como: 'ejecutivo',
    estado_visible: 'programada',
    ...extra,
  })
  const citas = [item('a', { distancia_m: 900, hora: '08:00' }), item('b', { distancia_m: 120, hora: '11:00' }), item('c', { distancia_m: null, hora: '07:00' }), item('d', { fecha: '2026-10-12', distancia_m: 5 })]
  check('con punto: por fecha y la más cercana primero (sin distancia al final)', ordenarCitas(citas, { porDistancia: true }).map(c => c.id).join('') === 'dbac')
  check('sin punto: por fecha y hora (sin hora al final)', ordenarCitas(citas).map(c => c.id).join('') === 'dcab')
}

seccion('10e. Esquemas de la agenda y del dictado por campo')
{
  const medica = { fecha: '2026-10-14', hora: '09:30', tipo: 'medica', medico_id: MED1, cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, sede_id: SEDE1, nota: '  Llevar   muestras ' }
  const r = citaCreateSchema.safeParse(medica)
  check('citaCreateSchema: médica válida; lo que no aplica (cuenta, subtipo) queda en null; la nota limpia', r.success && r.data.tipo === 'medica' && r.data.medico_id === MED1 && r.data.cuenta_id === null && r.data.subtipo_id === null && r.data.nota === 'Llevar muestras' && r.data.hora === '09:30', r.success ? r.data : r.error.issues)
  const inst = citaCreateSchema.safeParse({ fecha: '2026-10-14', hora: '11:00', tipo: 'institucional', cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, medico_id: MED1, sede_id: SEDE1 })
  check('citaCreateSchema: institucional con hora y sin nota → nota null; el médico no aplica', inst.success && inst.data.medico_id === null && inst.data.hora === '11:00' && inst.data.nota === null && inst.data.cuenta_id === CUENTA1, inst.success ? inst.data : inst.error.issues)
  check('citaCreateSchema: hora con segundos → HH:MM', citaCreateSchema.safeParse({ ...medica, hora: '14:05:00' }).success && citaCreateSchema.parse({ ...medica, hora: '14:05:00' }).hora === '14:05')
  // Decisión del dueño 2026-10-15: la cita nueva lleva hora siempre (la base sigue aceptando NULL para las viejas).
  const { hora: _sinHora, ...medicaSinHora } = medica
  const sinHora = [
    ['sin la clave hora', medicaSinHora],
    ["con hora ''", { ...medica, hora: '' }],
    ["con hora '   '", { ...medica, hora: '   ' }],
    ['con hora null', { ...medica, hora: null }],
    ['institucional sin hora', { fecha: '2026-10-14', tipo: 'institucional', cuenta_id: CUENTA1, subtipo_id: SUB_COMPRAS, sede_id: SEDE1 }],
  ] as const
  for (const [nombre, cuerpoSinHora] of sinHora) {
    const resultado = citaCreateSchema.safeParse(cuerpoSinHora)
    check(`citaCreateSchema rechaza la cita ${nombre}: error en hora "${MENSAJE_HORA_OBLIGATORIA}"`, !resultado.success && mensajeZod(resultado, 'hora') === MENSAJE_HORA_OBLIGATORIA, resultado.success ? resultado.data : resultado.error.issues)
  }
  check('MENSAJE_HORA_OBLIGATORIA = "Elige la hora de la cita" (el mismo texto de la app)', MENSAJE_HORA_OBLIGATORIA === 'Elige la hora de la cita')
  check(
    'citaCreateSchema: una hora que no es HH:MM (número, 24:00) da el mensaje de formato, no el de obligatoria',
    mensajeZod(citaCreateSchema.safeParse({ ...medica, hora: 930 }), 'hora') === 'Hora no válida: usa HH:MM (de 00:00 a 23:59)' && mensajeZod(citaCreateSchema.safeParse({ ...medica, hora: '24:00' }), 'hora') === 'Hora no válida: usa HH:MM (de 00:00 a 23:59)'
  )
  check('citaCreateSchema rechaza: médica sin médico, institucional sin subtipo, hora 24:00 o 9:30, fecha no válida, sin sede, nota de 301', ['medico_id', 'subtipo_id', 'hora', 'hora', 'fecha', 'sede_id', 'nota'].every((campo, i) => {
    const cuerpos = [
      { ...medica, medico_id: null },
      { fecha: '2026-10-14', hora: '11:00', tipo: 'institucional', cuenta_id: CUENTA1, sede_id: SEDE1 },
      { ...medica, hora: '24:00' },
      { ...medica, hora: '9:30' },
      { ...medica, fecha: '14/10/2026' },
      { ...medica, sede_id: undefined },
      { ...medica, nota: 'x'.repeat(301) },
    ]
    return mensajeZod(citaCreateSchema.safeParse(cuerpos[i]), campo) !== null
  }))
  // 0850 (A8): cancelar exige motivo. Sin código y con texto = 'otro' (lo que manda la app de hoy).
  const sinNada = citaCancelarSchema.safeParse({})
  check('citaCancelarSchema (0850): cuerpo vacío → 400 "Elige o escribe el motivo de la cancelación"', !sinNada.success && sinNada.error.issues[0]?.message === MENSAJE_CANCELAR_SIN_MOTIVO, sinNada.success ? sinNada.data : sinNada.error.issues)
  check('citaCancelarSchema: solo el texto (la app de hoy) → motivo limpio con código otro', JSON.stringify(citaCancelarSchema.parse({ motivo: '  Viaja  ' })) === JSON.stringify({ motivo: 'Viaja', motivo_codigo: 'otro' }))
  check('citaCancelarSchema: un código sin texto sí; con otro y texto corto, 301 caracteres, salida o un código raro no', citaCancelarSchema.parse({ motivo_codigo: 'cliente' }).motivo_codigo === 'cliente' && citaCancelarSchema.parse({ motivo_codigo: 'cliente' }).motivo === null && !citaCancelarSchema.safeParse({ motivo: 'ab' }).success && !citaCancelarSchema.safeParse({ motivo: 'x'.repeat(301) }).success && !citaCancelarSchema.safeParse({ motivo_codigo: 'salida', motivo: 'Se fue' }).success && !citaCancelarSchema.safeParse({ motivo_codigo: 'raro' }).success)
  check('agendaQuerySchema: fechas opcionales, canceladas=true; hasta antes de desde o 32 días no', agendaQuerySchema.safeParse({ desde: null, hasta: null, canceladas: null }).success && agendaQuerySchema.parse({ desde: '2026-10-13', hasta: null, canceladas: 'true' }).canceladas === true && !agendaQuerySchema.safeParse({ desde: '2026-10-20', hasta: '2026-10-13' }).success && !agendaQuerySchema.safeParse({ desde: '2026-10-01', hasta: '2026-11-01' }).success && !agendaQuerySchema.safeParse({ desde: 'ayer' }).success)
  const conCita = visitaCreateSchema.safeParse(cuerpoMedica({ agenda_id: '  C0000000-0000-4000-8000-0000000000AA ' }))
  check('visitaCreateSchema: agenda_id opcional (ausente → null; uuid en minúsculas; no uuid → error)', conCita.success && conCita.data.agenda_id === 'c0000000-0000-4000-8000-0000000000aa' && visitaCreateSchema.parse(cuerpoMedica()).agenda_id === null && mensajeZod(visitaCreateSchema.safeParse(cuerpoMedica({ agenda_id: 'xyz' })), 'agenda_id') !== null)
  check('proponerSchema: cita_id opcional', proponerSchema.safeParse({ transcript: 'Hola', hora: '2026-10-13T10:41:00-05:00', cita_id: SEDE1 }).success && proponerSchema.parse({ transcript: 'Hola', hora: '2026-10-13T10:41:00-05:00' }).cita_id === null && !proponerSchema.safeParse({ transcript: 'Hola', hora: '2026-10-13T10:41:00-05:00', cita_id: 'x' }).success)
  check('camposDictadoSchema: texto 1..8000 y tipo; vacío o tipo no válido → error', camposDictadoSchema.safeParse({ transcript: ' Le mostré la placa ', tipo: 'medica' }).success && !camposDictadoSchema.safeParse({ transcript: '   ', tipo: 'medica' }).success && !camposDictadoSchema.safeParse({ transcript: 'x', tipo: 'otra' }).success && !camposDictadoSchema.safeParse({ transcript: 'x'.repeat(8001), tipo: 'medica' }).success)
  const crudos = camposSchema.safeParse({ conclusion: ' Le gustó ', compromisos: null, extra: 'x' })
  check('camposSchema tolera nulos, ausentes y claves de más', crudos.success && crudos.data.conclusion === 'Le gustó' && crudos.data.compromisos === null && crudos.data.next_step_date === null && !('extra' in crudos.data), crudos.success ? crudos.data : crudos.error.issues)
}

seccion('10f. Dictado por campo (decisión 9): reparto normalizado, prompt y contexto de proponer con la agenda')
{
  const n = normalizarCampos({ conclusion: '  Le gustó   el tornillo canulado; su cédula es 79.123.456 ', compromisos: 'Enviar muestra;  llamarlo al 3001234567', next_step_date: '2026-10-20' }, HOY)
  check('normalizarCampos: textos limpios y sin números largos (documentos ni teléfonos)', n.conclusion === `Le gustó el tornillo canulado; su cédula es ${NUMERO_OMITIDO}` && n.compromisos === `Enviar muestra; llamarlo al ${NUMERO_OMITIDO}` && n.next_step_date === '2026-10-20', n)
  check('normalizarCampos: próxima reunión anterior a hoy o no válida → null; hoy sí', normalizarCampos({ conclusion: null, compromisos: null, next_step_date: '2026-10-12' }, HOY).next_step_date === null && normalizarCampos({ next_step_date: 'el jueves' }, HOY).next_step_date === null && normalizarCampos({ next_step_date: HOY }, HOY).next_step_date === HOY)
  check('normalizarCampos: vacío o nulo → todo null', JSON.stringify(normalizarCampos(null, HOY)) === JSON.stringify({ conclusion: null, compromisos: null, next_step_date: null }) && normalizarCampos({ conclusion: '   ' }, HOY).conclusion === null)
  check('normalizarCampos: textos acotados a 2000', (normalizarCampos({ conclusion: 'a'.repeat(2500) }, HOY).conclusion ?? '').length === 2000)
  const mensaje = mensajeCampos({ transcript: 'Le gustó la placa', tipo: 'institucional', hoy: HOY })
  check('mensajeCampos: la fecha de hoy con su día (martes), el tipo y el dictado', mensaje.includes(`HOY: ${HOY} (martes)`) && mensaje.includes('institucional') && mensaje.includes('Le gustó la placa') && mensaje.includes(HERRAMIENTA_CAMPOS.name) && nombreDiaSemana('2026-10-18') === 'domingo')
  check('PROMPT_CAMPOS: solo la herramienta, no inventa, sin documentos ni teléfonos; sin "KAM", "representante" ni "panel"', PROMPT_CAMPOS.includes('repartir_campos') && /no agregues nada/i.test(PROMPT_CAMPOS) && /documento/i.test(PROMPT_CAMPOS) && !/KAM|representante|panel/i.test(PROMPT_CAMPOS))
  check('esquemaCampos: objeto cerrado con los 3 campos requeridos', esquemaCampos.additionalProperties === false && esquemaCampos.required.join(',') === 'conclusion,compromisos,next_step_date' && Object.keys(esquemaCampos.properties).length === 3)
  check('PROMPT_PROPUESTA: regla de la agenda (cita_elegida) sin "KAM", "representante" ni "panel"', PROMPT_PROPUESTA.includes('cita_elegida') && !/KAM|representante|panel/i.test(PROMPT_PROPUESTA))

  // La agenda en el contexto de proponer: solo las pendientes; cita_elegida solo si es una de ellas.
  const MED_CITA = 'eeeeeeee-0000-4000-8000-000000000077' // no está en "mis médicos"
  const SEDE_LEJOS = 'cccccccc-0000-4000-8000-000000000077' // a más de 1 km (no está en sedes_cerca)
  const citaBase = (id: string, extra: Partial<CitaItem>): CitaItem => ({
    id, fecha: HOY, hora: '09:00', tipo: 'medica', medico: { id: MED_CITA, nombre: 'Dra. Ríos' }, cuenta: null, subtipo: null,
    sede: { id: SEDE_LEJOS, nombre: 'Clínica Sur', cuenta_id: CUENTA2, cuenta_nombre: 'Clínica Sur S.A.', lat: 4.6, lng: -74.1, ubicacion_confirmada: true },
    nota: 'Llevar muestras 3001234567', estado: 'pendiente', visita_id: null, distancia_m: 2400, dentro_del_radio: false, anticipada: true, cancelable: true,
    motivo_codigo: null, no_realizada_at: null, no_realizada_motivo: null, viene_de: null, viene_de_fecha: null, viene_de_estado: null, sucesora_id: null, como: 'ejecutivo', estado_visible: 'programada', ...extra,
  })
  const agenda = [
    citaBase('cita-1', {}),
    citaBase('cita-hecha', { estado: 'hecha', visita_id: 'v1', medico: { id: MED1, nombre: 'Dr. Pérez' } }),
    citaBase('cita-inst', { tipo: 'institucional', medico: null, cuenta: { id: CUENTA2, nombre: 'Clínica Sur S.A.' }, subtipo: { id: SUB_COMPRAS, codigo: 'compras', nombre: 'Compras' } }),
  ]
  const contexto = { ...contextoRespuesta(), agenda_hoy: agenda }
  const dictado = contextoDictado(contexto, '10:42', 'cita-1')
  check('contextoDictado: la agenda trae solo las pendientes, con quién, sede y subtipo; cita_elegida', dictado.agenda.map(c => c.id).join(',') === 'cita-1,cita-inst' && dictado.agenda[0].con === 'Dra. Ríos' && dictado.agenda[0].sede_id === SEDE_LEJOS && dictado.agenda[1].subtipo_codigo === 'compras' && dictado.cita_elegida === 'cita-1')
  check('contextoDictado: cita_elegida que no es una pendiente de hoy → null; sin agenda → []', contextoDictado(contexto, null, 'cita-hecha').cita_elegida === null && contextoDictado(contextoRespuesta()).agenda.length === 0 && contextoDictado(contextoRespuesta()).cita_elegida === null)
  check('contextoDictado: nunca la nota de la cita (ni el teléfono que traiga)', !JSON.stringify(dictado).includes('3001234567') && !JSON.stringify(dictado).includes('Llevar muestras'))
  const propuesta = normalizarPropuesta(
    {
      visitas: [
        { tipo: 'medica', subtipo_codigo: null, medico_id: MED_CITA, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: null, sede_id: SEDE_LEJOS, contacto_id: null, contacto_nombre_dicho: null, lineas: [L1], efectiva: true, failure_reason: null, conclusion: 'Bien', compromisos: null, next_step_date: null, modalidad_sugerida: 'presencial', confianza: 0.9, preguntas: [] },
        { tipo: 'institucional', subtipo_codigo: 'compras', medico_id: null, medico_nombre_dicho: null, sugerir_crear_medico: false, cuenta_id: CUENTA2, sede_id: SEDE_LEJOS, contacto_id: null, contacto_nombre_dicho: null, lineas: [L1], efectiva: true, failure_reason: null, conclusion: null, compromisos: null, next_step_date: null, modalidad_sugerida: 'presencial', confianza: 0.8, preguntas: [] },
      ],
      aviso: null,
    },
    contexto
  )
  check('normalizarPropuesta: el médico y la sede de una cita pendiente valen aunque no estén en "mis médicos" ni a menos de 1 km', propuesta.visitas[0].medico_id === MED_CITA && propuesta.visitas[0].sede_id === SEDE_LEJOS && !propuesta.visitas[0].sugerir_crear_medico, propuesta.visitas[0])
  check('normalizarPropuesta: la cuenta y la sede de una cita institucional pendiente también', propuesta.visitas[1].cuenta_id === CUENTA2 && propuesta.visitas[1].sede_id === SEDE_LEJOS && propuesta.visitas[1].subtipo_id === SUB_COMPRAS, propuesta.visitas[1])
  const sinAgenda = normalizarPropuesta({ visitas: [{ ...propuesta.visitas[0], medico_id: MED_CITA }], aviso: null }, contextoRespuesta())
  check('normalizarPropuesta: sin la cita, ese médico no vale (como antes)', sinAgenda.visitas[0].medico_id === null)
}

// ---------------------------------------------------------------------------
// 9. Sesión del teléfono (portador) y CORS, con un Supabase falso
// ---------------------------------------------------------------------------

const USUARIO_ANA = '11111111-1111-4111-8111-111111111111'
const USUARIO_VIEWER = '22222222-2222-4222-8222-222222222222'
// sesion-app (revisión 2026-10-30): solo las líderes (campo:app); el administrador y una líder inactiva no
const USUARIO_LIDER = '44444444-4444-4444-8444-444444444444'
const USUARIO_ADMIN = '55555555-5555-4555-8555-555555555555'
const USUARIO_INACTIVA = '66666666-6666-4666-8666-666666666666'
const KAM1 = '33333333-3333-4333-8333-333333333333'
const CLAVE_ANA = 'Clave-de-prueba-123'
const HASH_ANA = bcrypt.hashSync(CLAVE_ANA, 4)

type Fila = Record<string, unknown>
const tablas: Record<string, Fila[]> = {
  users: [
    { id: USUARIO_ANA, email: 'ana@test.local', full_name: 'Ana Pérez', role: 'sales_manager', active: true, created_at: '2026-10-01T00:00:00Z', password: HASH_ANA },
    { id: USUARIO_VIEWER, email: 'viewer@test.local', full_name: 'Viewer', role: 'viewer', active: true, created_at: '2026-10-01T00:00:00Z', password: 'hash-viewer' },
    { id: USUARIO_LIDER, email: 'lider@test.local', full_name: 'Lucía Líder', role: 'line_leader', active: true, created_at: '2026-10-01T00:00:00Z', password: 'hash-lider' },
    { id: USUARIO_ADMIN, email: 'admin@test.local', full_name: 'Admin', role: 'admin', active: true, created_at: '2026-10-01T00:00:00Z', password: 'hash-admin' },
    { id: USUARIO_INACTIVA, email: 'inactiva@test.local', full_name: 'Inés Inactiva', role: 'line_leader', active: false, created_at: '2026-10-01T00:00:00Z', password: 'hash-inactiva' },
  ],
  executives: [
    { id: EJEC, full_name: 'Ana Pérez', status: 'active', user_id: USUARIO_ANA, base_kam_id: KAM1 },
    { id: 'aaaaaaaa-0000-4000-8000-000000000099', full_name: 'Ex Ana', status: 'inactive', user_id: USUARIO_ANA, base_kam_id: KAM1 },
  ],
  kams: [{ id: KAM1, name: 'KAM Bogotá Norte', area_id: '1100101' }],
}
const peticiones: { method: string; table: string }[] = []
const CONTROL = new Set(['select', 'order', 'limit', 'offset'])

function coincide(fila: Fila, params: URLSearchParams): boolean {
  for (const [clave, crudo] of Array.from(params.entries())) {
    if (CONTROL.has(clave)) continue
    const valor = fila[clave] === null || fila[clave] === undefined ? 'null' : String(fila[clave])
    if (crudo.startsWith('eq.')) {
      if (valor !== crudo.slice(3)) return false
    } else if (crudo.startsWith('neq.')) {
      if (valor === crudo.slice(4)) return false
    } else if (crudo.startsWith('in.(') && crudo.endsWith(')')) {
      if (!crudo.slice(4, -1).split(',').map(o => o.replace(/^"|"$/g, '')).includes(valor)) return false
    } else if (crudo === 'is.null') {
      if (valor !== 'null') return false
    } else {
      throw new Error(`Supabase falso: filtro no soportado ${clave}=${crudo}`)
    }
  }
  return true
}

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const url = new URL(href)
  if (url.origin !== FAKE_SUPABASE_URL) throw new Error(`reporte-check: la red está prohibida en estas pruebas (${url.origin})`)
  const method = (init?.method || 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  peticiones.push({ method, table })
  const store = (tablas[table] = tablas[table] ?? [])
  const quiereObjeto = (new Headers(init?.headers).get('accept') || '').includes('vnd.pgrst.object')
  let filas: Fila[]
  if (method === 'GET') {
    filas = store.filter(fila => coincide(fila, url.searchParams))
    const orden = url.searchParams.get('order')
    if (orden) {
      const [columna, direccion] = orden.split(',')[0].split('.')
      filas = [...filas].sort((a, b) => String(a[columna] ?? '').localeCompare(String(b[columna] ?? '')) * (direccion === 'desc' ? -1 : 1))
    }
    const limite = url.searchParams.get('limit')
    if (limite !== null) filas = filas.slice(0, Number(limite))
  } else if (method === 'PATCH') {
    const body = init?.body ? (JSON.parse(String(init.body)) as Fila) : {}
    filas = store.filter(fila => coincide(fila, url.searchParams))
    filas.forEach(fila => Object.assign(fila, body))
  } else {
    throw new Error(`Supabase falso: método no soportado ${method}`)
  }
  if (quiereObjeto) {
    if (filas.length !== 1) return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406)
    return json(filas[0])
  }
  return json(filas)
}) as typeof fetch

const tokenDe = (userId: string, password = userId === USUARIO_ANA ? HASH_ANA : 'hash-viewer') => signSession(userId, passwordVersion(password))

function peticion(url: string, options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const headers: Record<string, string> = { ...(options.body === undefined ? {} : { 'content-type': 'application/json' }), ...options.headers }
  return new NextRequest(url, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) })
}

async function leer(response: Response): Promise<{ status: number; body: any; headers: Headers }> {
  const text = await response.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, body, headers: response.headers }
}

const CORS_HEADERS = ['access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods']
const sinCors = (headers: Headers) => CORS_HEADERS.every(nombre => headers.get(nombre) === null)

async function sesion() {
  seccion('9. Sesión del teléfono: cookie frente a portador (getUserFromRequest)')
  {
    const token = tokenDe(USUARIO_ANA)
    check('readBearer lee "Bearer <token>" (sin importar mayúsculas) y nada más', readBearer(peticion('http://localhost:3000/api/x', { headers: { authorization: `bearer ${token}` } })) === token && readBearer(peticion('http://localhost:3000/api/x', { headers: { authorization: `Token ${token}` } })) === null && readBearer(peticion('http://localhost:3000/api/x')) === null)
    check('esRutaApi: /api y /api/... sí; páginas y URL inválida no', esRutaApi('http://localhost:3000/api/me/contexto') && esRutaApi('http://localhost:3000/API') && !esRutaApi('http://localhost:3000/visits') && !esRutaApi('http://localhost:3000/apix') && !esRutaApi('no-es-url'))
    check('readSessionToken: la cookie manda; sin cookie el portador solo en /api', readSessionToken(peticion('http://localhost:3000/visits', { headers: { cookie: `${SESSION_COOKIE_NAME}=c1`, authorization: `Bearer ${token}` } })) === 'c1' && readSessionToken(peticion('http://localhost:3000/api/x', { headers: { authorization: `Bearer ${token}` } })) === token && readSessionToken(peticion('http://localhost:3000/visits', { headers: { authorization: `Bearer ${token}` } })) === null)

    const conCookie = await getUserFromRequest(peticion('http://localhost:3000/visits', { headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` } }))
    check('cookie en una página → usuario (como siempre)', conCookie?.id === USUARIO_ANA && conCookie.role === 'sales_manager' && !('password' in (conCookie as object)))
    const conPortador = await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { authorization: `Bearer ${token}` } }))
    check('portador en /api/* → usuario', conPortador?.id === USUARIO_ANA)
    check('portador en una página → rechazado', (await getUserFromRequest(peticion('http://localhost:3000/visits', { headers: { authorization: `Bearer ${token}` } }))) === null)
    check('portador con firma rota → rechazado', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { authorization: `Bearer ${token.slice(0, -2)}xx` } }))) === null)
    check('portador con pv viejo (contraseña cambiada) → rechazado', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { authorization: `Bearer ${signSession(USUARIO_ANA, passwordVersion('otra-contraseña'))}` } }))) === null)
    check('sin cookie ni portador → null', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto'))) === null)
    check('cookie vacía con portador válido en /api → usuario (cookie vacía = sin cookie)', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { cookie: `${SESSION_COOKIE_NAME}=`, authorization: `Bearer ${token}` } })))?.id === USUARIO_ANA)
    check('cookie inválida con portador válido → rechazado (la cookie manda)', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { cookie: `${SESSION_COOKIE_NAME}=basura`, authorization: `Bearer ${token}` } }))) === null)
    check('nada salió a la red salvo al Supabase falso', peticiones.every(p => p.table === 'users'))

    const ejecutiva = await ejecutivaEnlazada(USUARIO_ANA)
    check('ejecutivaEnlazada: la activa (no la inactiva), con la zona sin "KAM"', ejecutiva?.id === EJEC && ejecutiva.full_name === 'Ana Pérez' && ejecutiva.zona === 'Bogotá Norte', ejecutiva)
    check('ejecutivaEnlazada: usuario sin ejecutiva → null', (await ejecutivaEnlazada(USUARIO_VIEWER)) === null)
  }

  seccion('9b. Login móvil, /api/auth/me y logout con portador')
  {
    const movil = await leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: { email: ' Ana@test.local ', password: CLAVE_ANA, cliente: 'movil' } })))
    check('login { cliente: movil } → 200 con token, expira_at, usuario y ejecutiva', movil.status === 200 && typeof movil.body?.token === 'string' && movil.body.usuario?.id === USUARIO_ANA && movil.body.usuario.role === 'sales_manager' && movil.body.ejecutiva?.id === EJEC && movil.body.ejecutiva.zona === 'Bogotá Norte', movil.body)
    check('login móvil: sin Set-Cookie y sin contraseña ni email en el cuerpo', movil.headers.get('set-cookie') === null && !JSON.stringify(movil.body).includes('password') && !('email' in (movil.body?.usuario ?? {})))
    const expira = Date.parse(movil.body?.expira_at ?? '')
    check('login móvil: expira_at ≈ 7 días (ISO)', !Number.isNaN(expira) && Math.abs(expira - Date.now() - 7 * 24 * 3600 * 1000) < 60_000)
    check('el token del login móvil vale en /api/* (getUserFromRequest)', (await getUserFromRequest(peticion('http://localhost:3000/api/me/contexto', { headers: { authorization: `Bearer ${movil.body?.token}` } })))?.id === USUARIO_ANA)

    const yo = await leer(await me(peticion('http://localhost:3000/api/auth/me', { headers: { authorization: `Bearer ${movil.body?.token}` } })))
    check('GET /api/auth/me con portador → usuario (user, como la web) + ejecutiva enlazada (+ persona, 0850)', yo.status === 200 && yo.body?.user?.id === USUARIO_ANA && yo.body.user.email === 'ana@test.local' && yo.body.ejecutiva?.id === EJEC && yo.body.ejecutiva.full_name === 'Ana Pérez' && yo.body.ejecutiva.zona === 'Bogotá Norte' && 'persona' in yo.body, yo.body)
    check('GET /api/auth/me no deja pasar la contraseña', !JSON.stringify(yo.body).includes('password') && !JSON.stringify(yo.body).includes('$2'))
    const yoSin = await leer(await me(peticion('http://localhost:3000/api/auth/me')))
    check('GET /api/auth/me sin sesión → 401', yoSin.status === 401)
    const yoViewer = await leer(await me(peticion('http://localhost:3000/api/auth/me', { headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenDe(USUARIO_VIEWER))}` } })))
    check('GET /api/auth/me con cookie de un usuario sin ejecutiva → ejecutiva null', yoViewer.status === 200 && yoViewer.body?.user?.id === USUARIO_VIEWER && yoViewer.body.ejecutiva === null)

    const web = await leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: { email: 'ana@test.local', password: CLAVE_ANA } })))
    check('login sin cliente sigue igual: cookie de sesión y { user }', web.status === 200 && (web.headers.get('set-cookie') ?? '').includes(`${SESSION_COOKIE_NAME}=`) && web.body?.user?.id === USUARIO_ANA && web.body.token === undefined)
    const mal = await leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: { email: 'ana@test.local', password: 'otra', cliente: 'movil' } })))
    check('login móvil con contraseña incorrecta → 401 sin token', mal.status === 401 && mal.body?.token === undefined)
    const viewerMovil = await leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: { email: 'viewer@test.local', password: 'hash-viewer', cliente: 'movil' } })))
    check('login móvil de un usuario sin ejecutiva → ejecutiva null (y la contraseña heredada se migra a bcrypt)', viewerMovil.status === 200 && viewerMovil.body?.ejecutiva === null && String(tablas.users[1].password).startsWith('$2'), viewerMovil.body)
    const salir = await leer(await logout())
    check('POST /api/auth/logout con portador → 200', salir.status === 200)

    // Un solo ingreso para la web y la app de campo en el navegador (/campo, 2026-10-30)
    const campoWeb = await leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', body: { email: 'ana@test.local', password: CLAVE_ANA, cliente: 'campo-web' } })))
    check(
      "login { cliente: 'campo-web' } (la app en el navegador) → el cuerpo del móvil Y la cookie de la web: un solo ingreso",
      campoWeb.status === 200 && typeof campoWeb.body?.token === 'string' && campoWeb.body.usuario?.id === USUARIO_ANA && 'ejecutiva' in campoWeb.body && (campoWeb.headers.get('set-cookie') ?? '').includes(`${SESSION_COOKIE_NAME}=`),
      { status: campoWeb.status, cookie: campoWeb.headers.get('set-cookie'), cuerpo: campoWeb.body }
    )
    // La ruta lee `cliente` a mano (lo prueba el login de arriba); el contrato de la app es loginMovilSchema
    check('el contrato del login de la app (loginMovilSchema, el de mobile/lib/tipos.ts) acepta también campo-web', loginMovilSchema.safeParse({ email: 'a@b.co', password: 'x', cliente: 'campo-web' }).success)

    const cookieDe = (usuario: string, password: string) => `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenDe(usuario, password))}`
    const puenteDe = async (cookie: string, cabeceras: Record<string, string> = {}) =>
      leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST', headers: { cookie, origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin', ...cabeceras } })))
    const puente = await puenteDe(cookieDe(USUARIO_LIDER, 'hash-lider'))
    check(
      'POST /api/auth/sesion-app con la cookie de una líder → el mismo token de la cookie, expira_at, usuario y ejecutiva (la forma del login móvil)',
      puente.status === 200 && puente.body?.token === tokenDe(USUARIO_LIDER, 'hash-lider') && puente.body.usuario?.id === USUARIO_LIDER && puente.body.usuario.role === 'line_leader' && 'ejecutiva' in puente.body && puente.body.ejecutiva === null && !Number.isNaN(Date.parse(puente.body.expira_at ?? '')) && puente.headers.get('cache-control') === 'no-store',
      puente.body
    )
    check('sesion-app no deja pasar la contraseña ni el email', !JSON.stringify(puente.body).includes('password') && !('email' in (puente.body?.usuario ?? {})))
    const cookieAna = `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenDe(USUARIO_ANA))}`
    const deEjecutivo = await puenteDe(cookieAna)
    const deAdmin = await puenteDe(cookieDe(USUARIO_ADMIN, 'hash-admin'))
    check(
      'sesion-app solo para quien usa la app de campo (campo:app): un Ejecutivo Comercial o el administrador → 403 sin token (entran con su contraseña)',
      deEjecutivo.status === 403 && deAdmin.status === 403 && deEjecutivo.body?.token === undefined && deAdmin.body?.token === undefined,
      { ejecutivo: deEjecutivo.status, admin: deAdmin.status }
    )
    const inactiva = await puenteDe(cookieDe(USUARIO_INACTIVA, 'hash-inactiva'))
    const pvViejo = await puenteDe(cookieDe(USUARIO_LIDER, 'contraseña-anterior'))
    check('sesion-app con la cookie de una líder inactiva o de antes de cambiar la contraseña (pv viejo) → 401 sin token', inactiva.status === 401 && pvViejo.status === 401 && inactiva.body?.token === undefined && pvViejo.body?.token === undefined, { inactiva: inactiva.status, pvViejo: pvViejo.status })
    const mismoSitio = await puenteDe(cookieDe(USUARIO_LIDER, 'hash-lider'), { 'sec-fetch-site': 'same-site' })
    check('sesion-app desde otro subdominio del mismo sitio (Sec-Fetch-Site same-site) → 403 sin token', mismoSitio.status === 403 && mismoSitio.body?.token === undefined, mismoSitio.status)
    const soloPortador = await leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST', headers: { authorization: `Bearer ${tokenDe(USUARIO_ANA)}` } })))
    const sinNada = await leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST' })))
    check('sesion-app solo con portador o sin nada → 401 (no sirve para alargar un token)', soloPortador.status === 401 && sinNada.status === 401 && soloPortador.body?.token === undefined)
    const ajeno = await leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST', headers: { cookie: cookieAna, origin: 'http://evil.test' } })))
    const cruzado = await leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST', headers: { cookie: cookieAna, 'sec-fetch-site': 'cross-site' } })))
    check('sesion-app desde otro sitio (Origin ajeno o Sec-Fetch-Site cross-site) → 403 sin token', ajeno.status === 403 && cruzado.status === 403 && ajeno.body?.token === undefined && cruzado.body?.token === undefined)
    const cookieRota = await leer(await sesionApp(peticion('http://localhost:3000/api/auth/sesion-app', { method: 'POST', headers: { cookie: `${SESSION_COOKIE_NAME}=basura` } })))
    check('sesion-app con una cookie inválida → 401', cookieRota.status === 401)
  }

  seccion('9c. Middleware: portador en /api/*, CORS solo en desarrollo')
  {
    const token = tokenDe(USUARIO_ANA)
    const ORIGEN = 'http://localhost:8081'
    const preflight = await middleware(peticion('http://localhost:3000/api/me/contexto', { method: 'OPTIONS', headers: { origin: ORIGEN, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } }))
    check('desarrollo: OPTIONS desde localhost:8081 → 204 con las cabeceras CORS', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === ORIGEN && preflight.headers.get('access-control-allow-headers') === 'authorization, content-type' && preflight.headers.get('access-control-allow-methods') === 'GET, POST, PATCH, DELETE, OPTIONS' && (preflight.headers.get('vary') ?? '').includes('Origin'))
    const conPortador = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { origin: 'http://127.0.0.1:8081', authorization: `Bearer ${token}` } }))
    check('desarrollo: GET /api con portador válido → sigue (next) con CORS para 127.0.0.1:8081', conPortador.status === 200 && conPortador.headers.get('x-middleware-next') === '1' && conPortador.headers.get('access-control-allow-origin') === 'http://127.0.0.1:8081')
    const sinSesion = await leer(await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { origin: ORIGEN } })))
    check('desarrollo: GET /api sin sesión → 401 JSON con CORS (para que el navegador lo lea)', sinSesion.status === 401 && sinSesion.body?.error === 'No autorizado' && sinSesion.headers.get('access-control-allow-origin') === ORIGEN)
    const publico = await middleware(peticion('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: ORIGEN } }))
    check('desarrollo: ruta pública (/api/auth/login) también lleva CORS', publico.headers.get('x-middleware-next') === '1' && publico.headers.get('access-control-allow-origin') === ORIGEN)
    const ajeno = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { origin: 'http://evil.test', authorization: `Bearer ${token}` } }))
    check('desarrollo: otro origen → ninguna cabecera CORS', ajeno.headers.get('x-middleware-next') === '1' && sinCors(ajeno.headers))
    const preflightAjeno = await middleware(peticion('http://localhost:3000/api/me/contexto', { method: 'OPTIONS', headers: { origin: 'http://evil.test' } }))
    check('desarrollo: OPTIONS de otro origen no recibe 204 (sigue el flujo normal: 401)', preflightAjeno.status === 401 && sinCors(preflightAjeno.headers))
    const paginaPortador = await middleware(peticion('http://localhost:3000/visits', { headers: { authorization: `Bearer ${token}` } }))
    check('portador en una página → redirige al login (no vale fuera de /api)', paginaPortador.status === 307 && (paginaPortador.headers.get('location') ?? '').includes('/login?next=%2Fvisits'))
    const paginaCookie = await middleware(peticion('http://localhost:3000/visits', { headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` } }))
    check('cookie en una página → sigue', paginaCookie.headers.get('x-middleware-next') === '1')
    const cookieVacia = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { cookie: `${SESSION_COOKIE_NAME}=`, authorization: `Bearer ${token}` } }))
    check('cookie vacía con portador válido en /api → sigue (igual que getUserFromRequest)', cookieVacia.headers.get('x-middleware-next') === '1')
    const portadorRoto = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { authorization: `Bearer ${token.slice(0, -2)}xx` } }))
    check('portador con firma rota en /api → 401', portadorRoto.status === 401)
    const paginaConCors = await middleware(peticion('http://localhost:3000/visits', { headers: { origin: ORIGEN, cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` } }))
    check('las páginas nunca llevan CORS (solo /api/*)', sinCors(paginaConCors.headers))

    const entorno = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: 'production' })
    try {
      const preflightProd = await middleware(peticion('http://localhost:3000/api/me/contexto', { method: 'OPTIONS', headers: { origin: ORIGEN, 'access-control-request-method': 'GET' } }))
      check('producción: OPTIONS desde localhost:8081 no recibe 204 ni cabeceras CORS', preflightProd.status !== 204 && sinCors(preflightProd.headers))
      const portadorProd = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { origin: ORIGEN, authorization: `Bearer ${token}` } }))
      check('producción: el portador sigue valiendo en /api, sin ninguna cabecera CORS', portadorProd.headers.get('x-middleware-next') === '1' && sinCors(portadorProd.headers))
      const sinSesionProd = await middleware(peticion('http://localhost:3000/api/me/contexto', { headers: { origin: ORIGEN } }))
      check('producción: 401 sin cabeceras CORS', sinSesionProd.status === 401 && sinCors(sinSesionProd.headers))
    } finally {
      if (entorno === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV
      else Object.assign(process.env, { NODE_ENV: entorno })
    }
    // 0850: /api/auth/me lee además la persona de campo (sus líneas como Ejecutivo Comercial y las que lidera).
    check('nada salió a la red salvo al Supabase falso (users, executives, kams, executive_lines, business_lines)', peticiones.every(p => ['users', 'executives', 'kams', 'executive_lines', 'business_lines'].includes(p.table)))
  }

  seccion('9d. Login: los mismos límites de intentos con cliente móvil y sin él')
  {
    // Cada caso con su propia IP (x-real-ip) para que el límite por IP de un caso no tape el del otro.
    const intento = async (ip: string, cuerpo: Record<string, unknown>) =>
      leer(await login(peticion('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'x-real-ip': ip }, body: cuerpo })))
    const demasiados = (r: { status: number; body: any; headers: Headers }, maximo: number) => {
      const segundos = Number(r.headers.get('retry-after'))
      return (
        r.status === 429 &&
        /Demasiados intentos/.test(r.body?.error ?? '') &&
        Number.isInteger(segundos) && segundos >= 1 && segundos <= maximo &&
        !('token' in (r.body ?? {})) && r.headers.get('set-cookie') === null
      )
    }

    // Por IP: 10 intentos por minuto, cuenten como cuenten (aquí, cuerpos sin contraseña: 400), móvil y web mezclados.
    const porIp: number[] = []
    for (let i = 0; i < 10; i++) porIp.push((await intento('10.9.0.1', { email: `nadie${i}@test.local`, ...(i % 2 === 0 ? { cliente: 'movil' } : {}) })).status)
    const undecimoMovil = await intento('10.9.0.1', { email: 'ana@test.local', password: CLAVE_ANA, cliente: 'movil' })
    const undecimoWeb = await intento('10.9.0.1', { email: 'ana@test.local', password: CLAVE_ANA })
    check(
      'por IP: tras 10 intentos en el minuto (móvil y web), el siguiente —aun con la contraseña buena— es 429 con Retry-After ≤ 60 s, sin token ni cookie, con cliente móvil y sin él',
      porIp.every(st => st === 400) && demasiados(undecimoMovil, 60) && demasiados(undecimoWeb, 60),
      { porIp, movil: [undecimoMovil.status, undecimoMovil.headers.get('retry-after'), undecimoMovil.body], web: [undecimoWeb.status, undecimoWeb.headers.get('retry-after')] }
    )
    const otraIp = await intento('10.9.0.2', { email: 'ana@test.local', password: CLAVE_ANA, cliente: 'movil' })
    check('el límite es por IP: desde otra IP la misma cuenta entra (200 con token)', otraIp.status === 200 && typeof otraIp.body?.token === 'string', otraIp.status)

    // Por email: 5 contraseñas malas en 15 minutos (3 desde la app y 2 desde la web, cada una desde otra IP) bloquean la
    // cuenta para los dos: el sexto intento, con la contraseña buena, es 429 en el teléfono y en la web.
    const malas: number[] = []
    for (let i = 0; i < 5; i++) malas.push((await intento(`10.9.1.${i}`, { email: 'ana@test.local', password: `mala-${i}`, ...(i < 3 ? { cliente: 'movil' } : {}) })).status)
    const sextoMovil = await intento('10.9.1.10', { email: ' ANA@test.local ', password: CLAVE_ANA, cliente: 'movil' })
    const sextoWeb = await intento('10.9.1.11', { email: 'ana@test.local', password: CLAVE_ANA })
    check(
      'por email: 5 fallos (3 móvil + 2 web) → el sexto, con la contraseña buena, es 429 con Retry-After ≤ 15 min en el teléfono y en la web (el mismo contador; el email se normaliza)',
      malas.every(st => st === 401) && demasiados(sextoMovil, 900) && demasiados(sextoWeb, 900),
      { malas, movil: [sextoMovil.status, sextoMovil.headers.get('retry-after'), sextoMovil.body], web: [sextoWeb.status, sextoWeb.headers.get('retry-after')] }
    )
    const otraCuenta = await intento('10.9.1.12', { email: 'viewer@test.local', password: 'hash-viewer', cliente: 'movil' })
    check('el bloqueo es de esa cuenta: otra cuenta entra desde el teléfono', otraCuenta.status === 200 && typeof otraCuenta.body?.token === 'string', otraCuenta.status)
  }
}

sesion()
  .catch(error => {
    failed++
    print(`  FALLA excepción en las pruebas de sesión -> ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`)
    if (moduleLogs.length > 0) print(`        últimos mensajes: ${moduleLogs.slice(-3).join(' | ').slice(0, 600)}`)
  })
  .finally(() => {
    print(`\nreporte-check: ${passed} OK, ${failed} fallas`)
    if (failed > 0) process.exit(1)
  })
