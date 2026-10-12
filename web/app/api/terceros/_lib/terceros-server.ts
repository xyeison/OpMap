// Utilidades de servidor para /api/terceros/** (carpeta "_lib": Next.js no la expone como ruta).
// Contrato: docs/fases/fase6-visitas-f1-terceros.md (sección "API"). Todo con supabaseAdmin (service_role).
//
// Privacidad: el documento del médico (tipo_documento, numero_documento) y la identificación de una cuenta que
// es una persona (CC, CE, PA, otro) solo salen con terceros:manage. Las consultas de listas NUNCA seleccionan el
// documento del médico; el detalle lo selecciona solo si quien pide puede administrar.
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/auth-server'
import { hasPermission } from '@/lib/permissions'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows, jsonError } from '@/app/api/kams/_lib/kam-shared'
import { todayInBogota } from '@/app/api/executives/_lib/executive-shared'
import {
  avisoVisitante,
  nitsEquivalentes,
  normalizarIdentificacion,
  numerosEquivalentesANit,
  type EspecialidadMedico,
  type MedicoDetalle,
  type MedicoListItem,
  type MedicoSedeResumen,
  type RolMedicoSede,
  type TipoDocMedico,
  type VisitanteResumen,
} from '@/lib/terceros'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Error de PostgREST / PostgreSQL tal como lo devuelve supabase-js. */
export type ErrorBase = { code?: string; message?: string; details?: string | null; hint?: string | null }

type Pagina<T> = { data: T[] | null; error: { message: string } | null }

/** Fecha de hoy (AAAA-MM-DD) en hora de Colombia. */
export const hoyEnBogota = todayInBogota

/** ¿Puede administrar terceros (editar, desactivar, ver documentos, marcar cliente)? */
export function puedeAdministrar(user: Pick<SessionUser, 'role'>): boolean {
  return hasPermission(user.role, 'terceros:manage')
}

/**
 * ¿Gestiona los visitantes de TODAS las líneas? Solo admin y dirección comercial. Cualquier otro rol con
 * visitantes:manage (hoy line_leader) queda limitado a las líneas donde business_lines.leader_user_id es él.
 */
export function gestionaTodasLasLineas(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === 'admin' || user.role === 'commercial_director'
}

/** Id de un segmento de la ruta en minúsculas, o null si no es un UUID. */
export function idDeRuta(valor: string | null | undefined): string | null {
  if (!valor || !UUID_RE.test(valor)) return null
  return valor.toLowerCase()
}

// ---------------------------------------------------------------------------------------------
// Búsquedas (?q=)
// ---------------------------------------------------------------------------------------------

/** Texto de ?q= sin espacios de más (máx. 100 caracteres); '' si no viene. */
export function leerTexto(valor: string | null | undefined, max = 100): string {
  return (valor ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

/** Escapa los comodines de LIKE/ILIKE (\, %, _) para comparar el texto tal cual. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, caracter => `\\${caracter}`)
}

/**
 * Patrón ILIKE "contiene" de UNA palabra, sin importar tildes: cada vocal (con o sin tilde) pasa a "_"
 * (una letra cualquiera), así "clinica" encuentra "Clínica" y "perez" encuentra "Pérez". Los comodines que
 * escriba la persona se escapan. null si la palabra queda vacía.
 */
export function patronPalabra(palabra: string): string | null {
  const minuscula = palabra.toLowerCase()
  if (!minuscula) return null
  let patron = ''
  for (const caracter of Array.from(minuscula)) {
    if (/[aeiouáéíóúàèìòùäëïöüâêîôû]/.test(caracter)) patron += '_'
    else patron += escaparLike(caracter)
  }
  return `%${patron}%`
}

/** Patrones ILIKE (uno por palabra, máx. 5) para filtrar un nombre que contenga TODAS las palabras. */
export function patronesDeBusqueda(q: string): string[] {
  return q
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .map(patronPalabra)
    .filter((patron): patron is string => Boolean(patron))
}

/**
 * Si la búsqueda parece un número de identificación (solo dígitos, puntos, espacios y guiones; 3 o más dígitos),
 * el prefijo a buscar: el NIT con su DV pasa a 9 dígitos; si no, los dígitos tal cual. null si no es un número.
 */
export function busquedaNumerica(q: string): string | null {
  if (!/^[\d.\s-]+$/.test(q)) return null
  const digitos = q.replace(/\D/g, '')
  if (digitos.length < 3) return null
  if (digitos.length === 10) return normalizarIdentificacion('NIT', q) ?? digitos
  return digitos
}

/** Si la búsqueda parece un documento (letras y números con al menos un dígito), normalizado; si no, null. */
export function busquedaDocumento(q: string): string | null {
  if (!/\d/.test(q) || !/^[0-9A-Za-z.\s-]+$/.test(q)) return null
  const limpio = q.replace(/[\s.-]+/g, '').toUpperCase()
  return limpio.length >= 3 ? limpio : null
}

// ---------------------------------------------------------------------------------------------
// Lecturas por lotes (URL corta y límite de 1.000 filas de PostgREST)
// ---------------------------------------------------------------------------------------------

export function enTrozos<T>(lista: readonly T[], tamano = 150): T[][] {
  const trozos: T[][] = []
  for (let i = 0; i < lista.length; i += tamano) trozos.push(lista.slice(i, i + tamano))
  return trozos
}

/**
 * Lee todas las filas de una consulta filtrada por una lista de ids: en trozos de 150 ids (para no pasar el
 * largo de URL) y páginas de 1.000 (límite de PostgREST). La consulta debe tener un orden estable y usar
 * .range(from, to).
 */
export async function leerPorIds<T>(
  ids: Iterable<string>,
  build: (trozo: string[], from: number, to: number) => PromiseLike<Pagina<T>>
): Promise<T[]> {
  const unicos = Array.from(new Set(Array.from(ids).filter(Boolean)))
  const filas: T[] = []
  for (const trozo of enTrozos(unicos)) {
    filas.push(...(await fetchAllRows<T>((from, to) => build(trozo, from, to))))
  }
  return filas
}

// ---------------------------------------------------------------------------------------------
// Municipios
// ---------------------------------------------------------------------------------------------

/** Nombre de cada municipio (código DANE de 5 dígitos → nombre). */
export async function nombresMunicipios(codigos: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const validos = Array.from(codigos).filter((codigo): codigo is string => typeof codigo === 'string' && /^\d{5}$/.test(codigo))
  const filas = await leerPorIds<{ code: string; name: string | null }>(validos, (trozo, from, to) =>
    supabaseAdmin.from('municipalities').select('code, name').in('code', trozo).order('code').range(from, to)
  )
  const nombres = new Map<string, string>()
  for (const fila of filas) if (fila.name) nombres.set(fila.code, fila.name)
  return nombres
}

/** Nombre del municipio, o null si el código no existe en municipalities. */
export async function nombreMunicipio(codigo: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('municipalities').select('code, name').eq('code', codigo).limit(1)
  if (error) throw error
  const fila = data && data.length > 0 ? (data[0] as { code: string; name: string | null }) : null
  return fila ? fila.name ?? fila.code : null
}

export const MUNICIPIO_NO_EXISTE = 'El municipio elegido no existe'

// ---------------------------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------------------------

/** ¿Es una violación de unicidad (23505), opcionalmente de esa restricción? */
export function esViolacionUnica(error: ErrorBase | null | undefined, restriccion?: string): boolean {
  if (!error || error.code !== '23505') return false
  if (!restriccion) return true
  return `${error.message ?? ''} ${error.details ?? ''}`.includes(restriccion)
}

/** Mensaje de una regla de negocio de la base (23514) para la UI; los CHECK genéricos usan el mensaje dado. */
export function mensajeRegla(error: ErrorBase | null | undefined, porDefecto: string): string {
  const texto = error?.message ?? ''
  if (!texto || /violates|constraint|null value/i.test(texto)) return porDefecto
  return texto
}

function faltaMigracion(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { code, message } = error as ErrorBase
  if (code && ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(code)) return true
  return typeof message === 'string' && /Could not find the (table|function)|relation .* does not exist/i.test(message)
}

/** Registra el error y responde 500 (o 503 si la migración 0800 aún no está aplicada). */
export function errorInterno(contexto: string, error: unknown, mensaje = 'Error interno del servidor'): NextResponse {
  console.error(`Error en ${contexto}:`, error)
  if (faltaMigracion(error)) {
    return jsonError('Los terceros aún no están disponibles: falta aplicar la migración 0800 en la base de datos', 503)
  }
  return jsonError(mensaje, 500)
}

// ---------------------------------------------------------------------------------------------
// Existentes (para responder 409 con { existente })
// ---------------------------------------------------------------------------------------------

export async function cuentaPorIdentificacion(tipo: string, numero: string): Promise<{ id: string; nombre: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('cuentas')
    .select('id, nombre')
    .eq('tipo_identificacion', tipo)
    .eq('numero_identificacion', numero)
    .limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as { id: string; nombre: string }) : null
}

/**
 * Cuenta con la que una nueva repetiría la identificación aunque traiga otro tipo (regla del dueño: una cuenta por
 * identificación, no se repite el NIT). Tipo que no es NIT (CC, CE, PA, otro): la cuenta NIT de ese número (9
 * dígitos, o 10 con el DV del NIT al final; nitsEquivalentes), con `nit`. NIT: una cuenta de otro tipo con ese NIT
 * solo o con su DV pegado (numerosEquivalentesANit), con `nit` null (su número puede ser un documento protegido:
 * no se repite en el mensaje). null si no hay.
 */
export async function cuentaEquivalente(
  tipo: string,
  numero: string
): Promise<{ id: string; nombre: string; nit: string | null } | null> {
  if (tipo === 'NIT') {
    const numeros = numerosEquivalentesANit(numero)
    if (numeros.length === 0) return null
    const { data, error } = await supabaseAdmin
      .from('cuentas')
      .select('id, nombre')
      .neq('tipo_identificacion', 'NIT')
      .in('numero_identificacion', numeros)
      .order('id')
      .limit(1)
    if (error) throw error
    const fila = data && data.length > 0 ? (data[0] as { id: string; nombre: string }) : null
    return fila ? { id: fila.id, nombre: fila.nombre, nit: null } : null
  }
  const nits = nitsEquivalentes(tipo, numero)
  if (nits.length === 0) return null
  const { data, error } = await supabaseAdmin
    .from('cuentas')
    .select('id, nombre, numero_identificacion')
    .eq('tipo_identificacion', 'NIT')
    .in('numero_identificacion', nits)
    .order('id')
    .limit(1)
  if (error) throw error
  const fila = data && data.length > 0 ? (data[0] as { id: string; nombre: string; numero_identificacion: string }) : null
  return fila ? { id: fila.id, nombre: fila.nombre, nit: fila.numero_identificacion } : null
}

export async function sedePorRepsCode(
  repsCode: string,
  excluirId?: string
): Promise<{ id: string; nombre: string; cuenta_id: string } | null> {
  let consulta = supabaseAdmin.from('sedes').select('id, nombre, cuenta_id').eq('reps_code', repsCode).limit(1)
  if (excluirId) consulta = consulta.neq('id', excluirId)
  const { data, error } = await consulta
  if (error) throw error
  return data && data.length > 0 ? (data[0] as { id: string; nombre: string; cuenta_id: string }) : null
}

export async function medicoPorDocumento(
  tipo: string,
  numero: string,
  excluirId?: string
): Promise<{ id: string; nombre: string } | null> {
  let consulta = supabaseAdmin
    .from('medicos')
    .select('id, nombre')
    .eq('tipo_documento', tipo)
    .eq('numero_documento', numero)
    .limit(1)
  if (excluirId) consulta = consulta.neq('id', excluirId)
  const { data, error } = await consulta
  if (error) throw error
  return data && data.length > 0 ? (data[0] as { id: string; nombre: string }) : null
}

export const MEDICO_REPETIDO = 'Ya existe un médico con ese documento'
export const CUENTA_REPETIDA = 'Ya existe una cuenta con esa identificación'
export const REPS_REPETIDO = 'Ya existe una sede con ese código de habilitación'

/** 409 con la sede que ya tiene ese código de habilitación (y el nombre de su cuenta). */
export async function respuestaRepsRepetido(repsCode: string, excluirId?: string): Promise<NextResponse> {
  const sede = await sedePorRepsCode(repsCode, excluirId)
  if (!sede) return jsonError(REPS_REPETIDO, 409)
  const { data } = await supabaseAdmin.from('cuentas').select('nombre').eq('id', sede.cuenta_id).limit(1)
  const cuentaNombre = data && data.length > 0 ? String((data[0] as { nombre: string }).nombre) : null
  return jsonError(`${REPS_REPETIDO}: ${sede.nombre}${cuentaNombre ? ` (${cuentaNombre})` : ''}`, 409, {
    existente: { id: sede.id, nombre: sede.nombre, cuenta_id: sede.cuenta_id, cuenta_nombre: cuentaNombre },
  })
}

// ---------------------------------------------------------------------------------------------
// Médicos: sedes, visitantes y ciudad (listas y detalle)
// ---------------------------------------------------------------------------------------------

/** Columnas de una lista de médicos: NUNCA el documento. */
export const COLUMNAS_MEDICO_LISTA = 'id, nombre, especialidades, municipality_id, activo'
/** Columnas del detalle sin documento. */
const COLUMNAS_MEDICO_DETALLE =
  'id, nombre, especialidades, municipality_id, telefono, email, notas, activo, created_by, created_at, updated_at'
const COLUMNAS_DOCUMENTO = 'tipo_documento, numero_documento'

export interface MedicoBase {
  id: string
  nombre: string
  especialidades: EspecialidadMedico[]
  municipality_id: string
  activo: boolean
}

interface RelacionesMedicos {
  sedes: Map<string, MedicoSedeResumen[]>
  visitantes: Map<string, VisitanteResumen[]>
  ciudades: Map<string, string>
}

const compararTexto = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })

/**
 * Sedes (con su cuenta), visitantes (con nombre del Ejecutivo Comercial y de la línea) y ciudad de cada médico.
 * Unas pocas consultas por lotes, sin importar cuántos médicos sean. Visitantes: solo los VIGENTES (hasta IS
 * NULL), salvo con conTerminados (el detalle): entonces también las asignaciones terminadas, como historia
 * (vigentes primero; las terminadas, de la más reciente a la más vieja). Cada vigente trae `aviso` si ya no
 * cumple la regla con la que se asignó (Ejecutivo Comercial inactivo, sin esa línea o línea inactiva): nada se
 * cierra solo, se avisa.
 */
export async function cargarRelacionesMedicos(
  medicos: readonly MedicoBase[],
  opciones: { conTerminados?: boolean } = {}
): Promise<RelacionesMedicos> {
  const ids = medicos.map(medico => medico.id)
  const relaciones: RelacionesMedicos = { sedes: new Map(), visitantes: new Map(), ciudades: new Map() }
  if (ids.length === 0) return relaciones

  type Vinculo = { medico_id: string; sede_id: string; rol: RolMedicoSede; principal: boolean }
  type Sede = {
    id: string
    nombre: string
    cuenta_id: string
    ciudad: string | null
    municipality_id: string | null
    reps_code: string | null
  }
  type Visitante = {
    id: string
    medico_id: string
    executive_id: string
    line_id: string
    municipality_id: string | null
    desde: string
    hasta: string | null
  }

  const [vinculos, visitantes] = await Promise.all([
    leerPorIds<Vinculo>(ids, (trozo, from, to) =>
      supabaseAdmin
        .from('medico_sedes')
        .select('medico_id, sede_id, rol, principal')
        .in('medico_id', trozo)
        .order('medico_id')
        .order('sede_id')
        .range(from, to)
    ),
    leerPorIds<Visitante>(ids, (trozo, from, to) => {
      const consulta = supabaseAdmin
        .from('medico_visitantes')
        .select('id, medico_id, executive_id, line_id, municipality_id, desde, hasta')
        .in('medico_id', trozo)
      return (opciones.conTerminados ? consulta : consulta.is('hasta', null)).order('id').range(from, to)
    }),
  ])

  const sedes = await leerPorIds<Sede>(
    vinculos.map(vinculo => vinculo.sede_id),
    (trozo, from, to) =>
      supabaseAdmin
        .from('sedes')
        .select('id, nombre, cuenta_id, ciudad, municipality_id, reps_code')
        .in('id', trozo)
        .order('id')
        .range(from, to)
  )
  const vigentes = visitantes.filter(visitante => !visitante.hasta)
  const [cuentas, ejecutivos, lineas, lineasQueLlevan, ciudades] = await Promise.all([
    leerPorIds<{ id: string; nombre: string }>(
      sedes.map(sede => sede.cuenta_id),
      (trozo, from, to) => supabaseAdmin.from('cuentas').select('id, nombre').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ id: string; full_name: string; status: string | null }>(
      visitantes.map(visitante => visitante.executive_id),
      (trozo, from, to) =>
        supabaseAdmin.from('executives').select('id, full_name, status').in('id', trozo).order('id').range(from, to)
    ),
    leerPorIds<{ id: string; name: string; active: boolean | null }>(
      visitantes.map(visitante => visitante.line_id),
      (trozo, from, to) =>
        supabaseAdmin.from('business_lines').select('id, name, active').in('id', trozo).order('id').range(from, to)
    ),
    // Líneas que llevan HOY los Ejecutivos Comerciales de las asignaciones vigentes (para el aviso).
    leerPorIds<{ executive_id: string; line_id: string }>(
      vigentes.map(visitante => visitante.executive_id),
      (trozo, from, to) =>
        supabaseAdmin
          .from('executive_lines')
          .select('executive_id, line_id')
          .in('executive_id', trozo)
          .order('executive_id')
          .order('line_id')
          .range(from, to)
    ),
    nombresMunicipios([
      ...medicos.map(medico => medico.municipality_id),
      ...visitantes.map(visitante => visitante.municipality_id),
      ...sedes.filter(sede => !sede.ciudad).map(sede => sede.municipality_id),
    ]),
  ])

  relaciones.ciudades = ciudades
  const sedePorId = new Map(sedes.map(sede => [sede.id, sede]))
  const cuentaPorId = new Map(cuentas.map(cuenta => [cuenta.id, cuenta.nombre]))
  const ejecutivoPorId = new Map(ejecutivos.map(ejecutivo => [ejecutivo.id, ejecutivo]))
  const lineaPorId = new Map(lineas.map(linea => [linea.id, linea]))
  const llevaLinea = new Set(lineasQueLlevan.map(fila => `${fila.executive_id}|${fila.line_id}`))

  for (const vinculo of vinculos) {
    const sede = sedePorId.get(vinculo.sede_id)
    const resumen: MedicoSedeResumen = {
      id: vinculo.sede_id,
      nombre: sede?.nombre ?? 'Sede sin nombre',
      rol: vinculo.rol,
      principal: vinculo.principal,
      cuenta_id: sede?.cuenta_id,
      cuenta_nombre: sede ? cuentaPorId.get(sede.cuenta_id) : undefined,
      ciudad: sede ? sede.ciudad ?? (sede.municipality_id ? ciudades.get(sede.municipality_id) ?? null : null) : null,
      reps_code: sede?.reps_code ?? null,
    }
    const lista = relaciones.sedes.get(vinculo.medico_id) ?? []
    lista.push(resumen)
    relaciones.sedes.set(vinculo.medico_id, lista)
  }
  relaciones.sedes.forEach(lista =>
    lista.sort((a, b) => Number(Boolean(b.principal)) - Number(Boolean(a.principal)) || compararTexto(a.nombre, b.nombre))
  )

  for (const visitante of visitantes) {
    const ejecutivo = ejecutivoPorId.get(visitante.executive_id)
    const linea = lineaPorId.get(visitante.line_id)
    const resumen: VisitanteResumen = {
      id: visitante.id,
      executive_id: visitante.executive_id,
      executive: ejecutivo?.full_name ?? 'Ejecutivo Comercial',
      line_id: visitante.line_id,
      line: linea?.name ?? 'Línea',
      municipality_id: visitante.municipality_id,
      ciudad: visitante.municipality_id ? ciudades.get(visitante.municipality_id) ?? null : null,
      desde: visitante.desde,
      hasta: visitante.hasta,
      aviso: avisoVisitante(visitante, ejecutivo, linea, llevaLinea.has(`${visitante.executive_id}|${visitante.line_id}`)),
    }
    const lista = relaciones.visitantes.get(visitante.medico_id) ?? []
    lista.push(resumen)
    relaciones.visitantes.set(visitante.medico_id, lista)
  }
  relaciones.visitantes.forEach(lista =>
    lista.sort(
      (a, b) =>
        Number(Boolean(a.hasta)) - Number(Boolean(b.hasta)) ||
        (b.hasta ?? '').localeCompare(a.hasta ?? '') ||
        compararTexto(a.line, b.line) ||
        compararTexto(a.executive, b.executive)
    )
  )

  return relaciones
}

/** Elemento de la lista de médicos (sin documento). */
export function medicoListItem(medico: MedicoBase, relaciones: RelacionesMedicos): MedicoListItem {
  return {
    id: medico.id,
    nombre: medico.nombre,
    especialidades: medico.especialidades,
    municipality_id: medico.municipality_id,
    ciudad: relaciones.ciudades.get(medico.municipality_id) ?? null,
    sedes: relaciones.sedes.get(medico.id) ?? [],
    visitantes: relaciones.visitantes.get(medico.id) ?? [],
    activo: medico.activo,
  }
}

/**
 * Detalle de un médico. El documento (tipo y número) solo se SELECCIONA si conDocumento (terceros:manage):
 * sin ese permiso ni siquiera sale de la base. Trae los visitantes vigentes y los terminados (historia; los
 * terminados con hasta). null si no existe.
 */
export async function cargarMedicoDetalle(id: string, conDocumento: boolean): Promise<MedicoDetalle | null> {
  const columnas = conDocumento ? `${COLUMNAS_MEDICO_DETALLE}, ${COLUMNAS_DOCUMENTO}` : COLUMNAS_MEDICO_DETALLE
  const { data, error } = await supabaseAdmin.from('medicos').select(columnas).eq('id', id).limit(1)
  if (error) throw error
  if (!data || data.length === 0) return null
  const fila = data[0] as unknown as MedicoBase & {
    telefono: string | null
    email: string | null
    notas: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    tipo_documento?: TipoDocMedico
    numero_documento?: string
  }
  const relaciones = await cargarRelacionesMedicos([fila], { conTerminados: true })
  const detalle: MedicoDetalle = {
    id: fila.id,
    nombre: fila.nombre,
    especialidades: fila.especialidades,
    municipality_id: fila.municipality_id,
    telefono: fila.telefono,
    email: fila.email,
    notas: fila.notas,
    activo: fila.activo,
    created_by: fila.created_by,
    created_at: fila.created_at,
    updated_at: fila.updated_at,
    ciudad: relaciones.ciudades.get(fila.municipality_id) ?? null,
    sedes: relaciones.sedes.get(fila.id) ?? [],
    visitantes: relaciones.visitantes.get(fila.id) ?? [],
  }
  if (conDocumento) {
    detalle.tipo_documento = fila.tipo_documento
    detalle.numero_documento = fila.numero_documento
  }
  return detalle
}

/** true si el médico existe (con su estado). */
export async function leerMedico(id: string): Promise<{ id: string; nombre: string; activo: boolean } | null> {
  const { data, error } = await supabaseAdmin.from('medicos').select('id, nombre, activo').eq('id', id).limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as { id: string; nombre: string; activo: boolean }) : null
}

/** Ids de los Ejecutivos Comerciales enlazados con el usuario (executives.user_id). */
export async function ejecutivosDelUsuario(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('executives').select('id').eq('user_id', userId).limit(50)
  if (error) throw error
  return (data || []).map(fila => String((fila as { id: string }).id))
}
