/**
 * Equipo (Entrega 2, docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md): lo que /api/equipo/* lee de la
 * base y cómo lo arma para lib/equipo.ts (las reglas puras). Solo lectura, con supabase-admin (no-store), sin Google.
 *
 * Privacidad (spec): de una visita se leen solo las columnas que Equipo necesita; nunca transcript, foto_path,
 * gps_accuracy_m, distance_m, lat/lng, conclusion ni compromisos; de un médico solo el nombre; de una sede, el nombre
 * y el municipio.
 */
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/auth-server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { zoneDisplayName } from '@/lib/zone-names'
import { municipioDeZona, type TipoVisita } from '@/lib/visits-rules'
import type { EstadoCita, MotivoCierre } from '@/lib/agenda-ciclo'
import { fetchAllRows, jsonError } from '@/app/api/kams/_lib/kam-shared'
import { leerPorIds } from '@/app/api/terceros/_lib/terceros-server'
import { leerCalendario } from '@/app/api/config-visitas/_lib/visitas-server'
import {
  personasVisibles,
  type AlcanceEquipo,
  type CitaEquipo,
  type PasoRastro,
  type PersonaEquipo,
  type Ubicacion,
  type VisitaEquipo,
} from '@/lib/equipo'
import type { MarcaVisita, Modalidad, PasoRastroItem, PersonaEquipoItem, UbicacionItem } from '@/lib/reporte-visitas'

// ---------------------------------------------------------------------------------------------
// Quién pregunta y a quién ve
// ---------------------------------------------------------------------------------------------

export interface ContextoEquipo {
  user: SessionUser
  /** Todas las personas de campo (activas e inactivas con líneas), para "ya no está". */
  personas: PersonaEquipo[]
  /** A quién ve hoy (activas). */
  alcance: AlcanceEquipo
  /** A quién vería si todas estuvieran activas (para el rendimiento de quien ya no está). */
  alcanceConInactivas: AlcanceEquipo
  /** Catálogo de líneas activas: id → nombre. */
  lineas: Map<string, string>
}

export type EquipoResult = { ok: true; contexto: ContextoEquipo } | { ok: false; response: NextResponse }

interface UsuarioFila {
  id: string
  full_name: string | null
  email: string | null
  role: string
  active: boolean | null
}
interface EjecutivaFila {
  id: string
  user_id: string | null
  status: string
  base_kam_id: string | null
}
interface LineaFila {
  id: string
  name: string
  leader_user_id: string | null
  active: boolean
}

/** Todas las personas de campo: usuarios con líneas de Ejecutivo Comercial (activo o inactivo) o líneas que lideran. */
export async function cargarPersonasEquipo(): Promise<{ personas: PersonaEquipo[]; lineas: LineaFila[] }> {
  const [usuarios, ejecutivas, lineas] = await Promise.all([
    fetchAllRows<UsuarioFila>((from, to) => supabaseAdmin.from('users').select('id, full_name, email, role, active').order('id').range(from, to)),
    fetchAllRows<EjecutivaFila>((from, to) =>
      supabaseAdmin.from('executives').select('id, user_id, status, base_kam_id').not('user_id', 'is', null).in('status', ['active', 'inactive']).order('id').range(from, to)
    ),
    fetchAllRows<LineaFila>((from, to) => supabaseAdmin.from('business_lines').select('id, name, leader_user_id, active').order('id').range(from, to)),
  ])
  const activasPorId = new Map(lineas.filter(l => l.active).map(l => [l.id, l]))
  const vinculos = await leerPorIds<{ executive_id: string; line_id: string }>(
    ejecutivas.map(e => e.id),
    (trozo, from, to) => supabaseAdmin.from('executive_lines').select('executive_id, line_id').in('executive_id', trozo).order('line_id').range(from, to)
  )
  const zonas = await leerPorIds<{ id: string; name: string | null; area_id: string | null }>(
    ejecutivas.map(e => e.base_kam_id).filter((k): k is string => !!k),
    (trozo, from, to) => supabaseAdmin.from('kams').select('id, name, area_id').in('id', trozo).order('id').range(from, to)
  )
  const zonaPorId = new Map(zonas.map(z => [z.id, z]))
  // Una persona tiene como mucho un Ejecutivo Comercial activo; si solo tiene inactivos, el más reciente (orden por id).
  const ejecutivaDe = new Map<string, EjecutivaFila>()
  for (const e of ejecutivas) {
    if (!e.user_id) continue
    const actual = ejecutivaDe.get(e.user_id)
    if (!actual || (actual.status !== 'active' && e.status === 'active')) ejecutivaDe.set(e.user_id, e)
  }
  const personas: PersonaEquipo[] = []
  for (const u of usuarios) {
    if (u.role === 'commercial_director') continue
    const e = ejecutivaDe.get(u.id) ?? null
    const lineasEc = e ? vinculos.filter(v => v.executive_id === e.id && activasPorId.has(v.line_id)).map(v => v.line_id).sort() : []
    const lineasLider = lineas.filter(l => l.active && l.leader_user_id === u.id).map(l => l.id).sort()
    if (lineasEc.length === 0 && lineasLider.length === 0) continue
    const zona = e?.base_kam_id ? zonaPorId.get(e.base_kam_id) : undefined
    personas.push({
      userId: u.id,
      nombre: u.full_name || u.email || 'Usuario',
      papel: lineasLider.length === 0 ? 'ejecutivo' : lineasEc.length === 0 ? 'lider' : 'lider_y_ejecutivo',
      executiveId: e?.id ?? null,
      kamId: e?.base_kam_id ?? null,
      zona: zona ? zoneDisplayName(zona.name) || 'Zona' : null,
      municipio: zona ? municipioDeZona(zona.area_id) : null,
      lineasEc,
      lineasLider,
      activa: u.active === true && (e === null || e.status === 'active'),
    })
  }
  return { personas, lineas }
}

/** Sesión y team:view (401/403), las personas de campo y a quién ve quien pregunta. */
export async function requireEquipo(request: Request, contexto: string): Promise<EquipoResult> {
  const auth = await requirePermission(request, 'team:view')
  if (!auth.ok) return auth
  try {
    const { personas, lineas } = await cargarPersonasEquipo()
    const lidera = lineas.filter(l => l.active && l.leader_user_id === auth.user.id).map(l => l.id)
    return {
      ok: true,
      contexto: {
        user: auth.user,
        personas,
        alcance: personasVisibles(auth.user, personas, lidera),
        alcanceConInactivas: personasVisibles(auth.user, personas.map(p => ({ ...p, activa: true })), lidera),
        lineas: new Map(lineas.filter(l => l.active).map(l => [l.id, l.name])),
      },
    }
  } catch (error) {
    console.error(`${contexto}: no se pudo cargar el equipo:`, error instanceof Error ? error.message : error)
    return { ok: false, response: jsonError('Error al cargar el equipo', 500) }
  }
}

export function personaItem(p: PersonaEquipo, alcance: AlcanceEquipo, lineas: Map<string, string>): PersonaEquipoItem {
  const nombreDe = (id: string) => lineas.get(id) ?? 'Línea'
  const items = [
    ...p.lineasEc.map(id => ({ id, nombre: nombreDe(id), como: 'ejecutivo' as const })),
    ...p.lineasLider.filter(id => !p.lineasEc.includes(id)).map(id => ({ id, nombre: nombreDe(id), como: 'lider' as const })),
  ].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
  return {
    user_id: p.userId,
    nombre: p.nombre,
    papel: p.papel,
    executive_id: p.executiveId,
    zona: p.zona,
    lineas: items,
    solo_como_ejecutivo: alcance.soloComoEjecutivo.has(p.userId),
    activa: p.activa,
  }
}

// ---------------------------------------------------------------------------------------------
// Visitas y citas reducidas (sin GPS, transcripción ni documentos)
// ---------------------------------------------------------------------------------------------

interface VisitaFilaMinima {
  id: string
  user_id: string | null
  executive_id: string | null
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  sede_id: string | null
  modalidad: Modalidad
  efectiva: boolean
  failure_reason: string | null
  checked_in_at: string
  visit_date: string
  agenda_id: string | null
  agendada: boolean | null
  marcas: MarcaVisita[] | null
  motivo_codigo: string | null
  medico_no_listado: { nombre?: string | null } | null
}
const COLUMNAS_VISITA_EQUIPO =
  'id, user_id, executive_id, tipo, medico_id, cuenta_id, sede_id, modalidad, efectiva, failure_reason, checked_in_at, visit_date, agenda_id, agendada, marcas, motivo_codigo, medico_no_listado'

interface CitaFilaMinima {
  id: string
  user_id: string
  executive_id: string | null
  fecha: string
  hora: string | null
  tipo: TipoVisita
  medico_id: string | null
  cuenta_id: string | null
  sede_id: string
  estado: EstadoCita
  visita_id: string | null
  created_at: string
  motivo_codigo: MotivoCierre | null
  no_realizada_motivo: string | null
  viene_de: string | null
}
const COLUMNAS_CITA_EQUIPO = 'id, user_id, executive_id, fecha, hora, tipo, medico_id, cuenta_id, sede_id, estado, visita_id, created_at, motivo_codigo, no_realizada_motivo, viene_de'

interface Nombres {
  sedes: Map<string, { nombre: string; municipioId: string | null; municipioNombre: string | null }>
  medicos: Map<string, string>
  cuentas: Map<string, string>
}

async function nombresDe(sedeIds: Iterable<string | null>, medicoIds: Iterable<string | null>, cuentaIds: Iterable<string | null>): Promise<Nombres> {
  const limpiar = (ids: Iterable<string | null>) => Array.from(new Set(Array.from(ids).filter((x): x is string => !!x)))
  const [sedes, medicos, cuentas] = await Promise.all([
    leerPorIds<{ id: string; nombre: string; ciudad: string | null; municipality_id: string | null }>(limpiar(sedeIds), (trozo, from, to) =>
      supabaseAdmin.from('sedes').select('id, nombre, ciudad, municipality_id').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ id: string; nombre: string }>(limpiar(medicoIds), (trozo, from, to) => supabaseAdmin.from('medicos').select('id, nombre').in('id', trozo).order('id').range(from, to)),
    leerPorIds<{ id: string; nombre: string }>(limpiar(cuentaIds), (trozo, from, to) => supabaseAdmin.from('cuentas').select('id, nombre').in('id', trozo).order('id').range(from, to)),
  ])
  const municipios = await leerPorIds<{ code: string; name: string }>(
    limpiar(sedes.map(s => s.municipality_id)),
    (trozo, from, to) => supabaseAdmin.from('municipalities').select('code, name').in('code', trozo).order('code').range(from, to)
  )
  const municipioNombre = new Map(municipios.map(m => [m.code, m.name]))
  return {
    sedes: new Map(sedes.map(s => [s.id, { nombre: s.nombre, municipioId: s.municipality_id, municipioNombre: s.municipality_id ? (municipioNombre.get(s.municipality_id) ?? s.ciudad ?? null) : (s.ciudad ?? null) }])),
    medicos: new Map(medicos.map(m => [m.id, m.nombre])),
    cuentas: new Map(cuentas.map(c => [c.id, c.nombre])),
  }
}

/** Visitas de la app (no anuladas, no VMO) de esas personas con visit_date en [desde, hasta], y las citas de [desde, hasta]. */
export async function visitasYCitasEquipo(userIds: readonly string[], desde: string, hasta: string): Promise<{ visitas: VisitaEquipo[]; citas: CitaEquipo[] }> {
  if (userIds.length === 0) return { visitas: [], citas: [] }
  const [visitas, citasRango] = await Promise.all([
    leerPorIds<VisitaFilaMinima>(userIds, (trozo, from, to) =>
      supabaseAdmin.from('visits').select(COLUMNAS_VISITA_EQUIPO).in('user_id', trozo).eq('source', 'app').is('deleted_at', null).gte('visit_date', desde).lte('visit_date', hasta).order('id').range(from, to)
    ),
    leerPorIds<CitaFilaMinima>(userIds, (trozo, from, to) =>
      supabaseAdmin.from('visitas_agenda').select(COLUMNAS_CITA_EQUIPO).in('user_id', trozo).neq('estado', 'eliminada').gte('fecha', desde).lte('fecha', hasta).order('id').range(from, to)
    ),
  ])
  // Los orígenes de "otra fecha" que quedaron fuera del rango (para "viene de la cita del …")
  const cargadas = new Set(citasRango.map(c => c.id))
  const faltan = citasRango.map(c => c.viene_de).filter((x): x is string => !!x && !cargadas.has(x))
  const origenes = await leerPorIds<CitaFilaMinima>(faltan, (trozo, from, to) => supabaseAdmin.from('visitas_agenda').select(COLUMNAS_CITA_EQUIPO).in('id', trozo).order('id').range(from, to))
  const citas = [...citasRango, ...origenes]
  const lineasDeVisita = await leerPorIds<{ visit_id: string; line_id: string }>(
    visitas.map(v => v.id),
    (trozo, from, to) => supabaseAdmin.from('visit_lines').select('visit_id, line_id').in('visit_id', trozo).order('line_id').range(from, to)
  )
  const nombres = await nombresDe([...visitas.map(v => v.sede_id), ...citas.map(c => c.sede_id)], [...visitas.map(v => v.medico_id), ...citas.map(c => c.medico_id)], [...visitas.map(v => v.cuenta_id), ...citas.map(c => c.cuenta_id)])
  const sede = (id: string | null) => (id ? nombres.sedes.get(id) : undefined)
  return {
    visitas: visitas
      .filter((v): v is VisitaFilaMinima & { user_id: string } => !!v.user_id)
      .map(v => ({
        id: v.id,
        userId: v.user_id,
        executiveId: v.executive_id,
        fecha: v.visit_date,
        checkedInAt: v.checked_in_at,
        tipo: v.tipo,
        modalidad: v.modalidad,
        efectiva: v.efectiva,
        motivoCodigo: v.motivo_codigo ?? null,
        failureReason: v.failure_reason,
        medicoId: v.medico_id,
        medicoNombre: v.medico_id ? (nombres.medicos.get(v.medico_id) ?? null) : null,
        cuentaId: v.cuenta_id,
        cuentaNombre: v.cuenta_id ? (nombres.cuentas.get(v.cuenta_id) ?? null) : null,
        sedeId: v.sede_id,
        sedeNombre: sede(v.sede_id)?.nombre ?? null,
        municipioId: sede(v.sede_id)?.municipioId ?? null,
        municipioNombre: sede(v.sede_id)?.municipioNombre ?? null,
        lineas: lineasDeVisita.filter(l => l.visit_id === v.id).map(l => l.line_id),
        agendaId: v.agenda_id,
        agendada: v.agendada === true,
        marcas: Array.isArray(v.marcas) ? v.marcas : [],
        medicoNoListado: v.medico_no_listado?.nombre ?? null,
      })),
    citas: citas.map(c => ({
      id: c.id,
      userId: c.user_id,
      executiveId: c.executive_id,
      fecha: c.fecha,
      hora: c.hora ? c.hora.slice(0, 5) : null,
      createdAt: c.created_at,
      tipo: c.tipo,
      estado: c.estado,
      vieneDe: c.viene_de,
      visitaId: c.visita_id,
      motivoCodigo: c.motivo_codigo,
      noRealizadaMotivo: c.no_realizada_motivo,
      medicoId: c.medico_id,
      medicoNombre: c.medico_id ? (nombres.medicos.get(c.medico_id) ?? null) : null,
      cuentaId: c.cuenta_id,
      cuentaNombre: c.cuenta_id ? (nombres.cuentas.get(c.cuenta_id) ?? null) : null,
      sedeId: c.sede_id,
      sedeNombre: sede(c.sede_id)?.nombre ?? 'Sede',
      municipioId: sede(c.sede_id)?.municipioId ?? null,
      municipioNombre: sede(c.sede_id)?.municipioNombre ?? null,
    })),
  }
}

// ---------------------------------------------------------------------------------------------
// Días libres y festivos
// ---------------------------------------------------------------------------------------------

/** Por userId, las fechas de día libre aprobado de día completo y las de festivo (nacional, empresa o de su ciudad). */
export async function diasEspeciales(personas: readonly PersonaEquipo[], desde: string, hasta: string): Promise<{ libres: Map<string, Set<string>>; festivos: Map<string, Set<string>> }> {
  const conEjecutiva = personas.filter(p => p.executiveId)
  const [diasLibres, calendario] = await Promise.all([
    leerPorIds<{ executive_id: string; fecha: string; fraccion: number | string; estado: string }>(
      conEjecutiva.map(p => p.executiveId as string),
      (trozo, from, to) => supabaseAdmin.from('dias_libres').select('executive_id, fecha, fraccion, estado').in('executive_id', trozo).eq('estado', 'aprobado').gte('fecha', desde).lte('fecha', hasta).order('fecha').range(from, to)
    ),
    leerCalendario(desde, hasta, { todasLasCiudades: true }),
  ])
  const libres = new Map<string, Set<string>>()
  for (const p of conEjecutiva) {
    const fechas = diasLibres.filter(d => d.executive_id === p.executiveId && Number(d.fraccion) >= 1).map(d => d.fecha)
    if (fechas.length > 0) libres.set(p.userId, new Set(fechas))
  }
  const festivos = new Map<string, Set<string>>()
  const generales = calendario.filter(d => d.tipo === 'no_habil' && d.alcance !== 'ciudad').map(d => d.fecha)
  for (const p of personas) {
    const deCiudad = p.municipio ? calendario.filter(d => d.tipo === 'no_habil' && d.alcance === 'ciudad' && d.municipality_id === p.municipio).map(d => d.fecha) : []
    const todas = new Set([...generales, ...deCiudad])
    if (todas.size > 0) festivos.set(p.userId, todas)
  }
  return { libres, festivos }
}

// ---------------------------------------------------------------------------------------------
// Formas de la API
// ---------------------------------------------------------------------------------------------

export function ubicacionItem(u: Ubicacion): UbicacionItem {
  return { caso: u.caso, fuente: u.fuente, hora: u.hora, sede: u.sedeNombre, municipio: u.municipioNombre, hace_min: u.haceMin, marcas: u.marcas }
}

export function pasoItem(p: PasoRastro, fecha: string, lineas: Map<string, string>): PasoRastroItem {
  return {
    fecha,
    hora: p.hora,
    tipo: p.tipo,
    modalidad: p.modalidad,
    con_quien: p.conQuien,
    sede: p.sedeNombre,
    municipio: p.municipioNombre,
    estado: p.estado,
    motivo: p.motivo,
    anticipacion_dias: p.anticipacionDias,
    viene_de_fecha: p.vieneDeFecha,
    lineas: p.lineas.map(id => lineas.get(id) ?? 'Línea').sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })),
    marcas: p.marcas,
    visita_id: p.visitaId,
    cita_id: p.citaId,
  }
}
