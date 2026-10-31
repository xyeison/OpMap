// Listas de cuentas y médicos de /terceros (carpeta "_lib": Next.js no la expone como ruta), compartidas por
// GET /api/terceros/{cuentas,medicos}?… (filtros en la URL) y POST /api/terceros/{cuentas,medicos}/buscar (filtros
// en el cuerpo). Contrato: docs/fases/fase6-visitas-f1-terceros.md.
//
// Privacidad: un documento de persona (la cédula de un médico, la CC/CE/PA de una cuenta) solo se busca por POST
// (opción buscarDocumentos, y solo con terceros:manage): en una URL quedaría en los logs de peticiones de Vercel y
// del proxy, que puede leer quien no tiene terceros:manage. Por GET, un número solo busca NIT (que es público) y
// en médicos solo se busca por nombre. Las respuestas nunca traen el documento del médico.
import type { SessionUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '@/app/api/kams/_lib/kam-shared'
import type { BusquedaCuentas, BusquedaMedicos } from '@/lib/terceros-schemas'
import {
  TERCEROS_POR_PAGINA,
  ocultarIdentificacionCuenta,
  type CuentaListItem,
  type MedicoListItem,
  type Pagina,
} from '@/lib/terceros'
import {
  COLUMNAS_MEDICO_LISTA,
  busquedaDocumento,
  busquedaNumerica,
  cargarRelacionesMedicos,
  ejecutivosDelUsuario,
  escaparLike,
  leerPorIds,
  medicoListItem,
  patronesDeBusqueda,
  puedeAdministrar,
  type MedicoBase,
} from './terceros-server'

export interface OpcionesLista {
  /** true solo en POST .../buscar: con terceros:manage, un número busca también documentos de persona. */
  buscarDocumentos: boolean
}

// ---------------------------------------------------------------------------------------------
// Cuentas
// ---------------------------------------------------------------------------------------------

const COLUMNAS_CUENTA_LISTA =
  'id, nombre, clase, es_cliente, tipo_identificacion, numero_identificacion, modalidad_facturacion, activo'

type FilaCuenta = Omit<CuentaListItem, 'sedes' | 'numero_identificacion'> & { numero_identificacion: string }

const compararCuentas = (a: FilaCuenta, b: FilaCuenta) =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * q: nombre (todas las palabras, sin importar tildes) o, si es un número, la identificación: solo NIT, salvo por
 * POST con terceros:manage (también CC/CE/PA/otro). municipio (código DANE): cuentas con al menos una sede ACTIVA
 * en esa ciudad (el filtro "ciudad" de /terceros). 50 por página. La identificación de una persona solo sale con
 * terceros:manage.
 */
export async function listarCuentas(
  user: Pick<SessionUser, 'papeles'>,
  filtros: BusquedaCuentas,
  opciones: OpcionesLista
): Promise<Pagina<CuentaListItem>> {
  const administra = puedeAdministrar(user)
  const conDocumentos = opciones.buscarDocumentos && administra
  const { q, clase, cliente, municipio, activo, page } = filtros
  const desde = (page - 1) * TERCEROS_POR_PAGINA

  const consulta = (contar: boolean) => {
    let c = supabaseAdmin.from('cuentas').select(COLUMNAS_CUENTA_LISTA, contar ? { count: 'exact' } : undefined)
    if (q) {
      const numero = busquedaNumerica(q)
      if (numero) {
        c = c.like('numero_identificacion', `${numero}%`)
        if (!conDocumentos) c = c.eq('tipo_identificacion', 'NIT')
      } else {
        for (const patron of patronesDeBusqueda(q)) c = c.ilike('nombre', patron)
      }
    }
    if (clase) c = c.eq('clase', clase)
    if (cliente !== undefined) c = c.eq('es_cliente', cliente)
    if (activo !== undefined) c = c.eq('activo', activo)
    return c
  }

  let filas: FilaCuenta[]
  let total: number

  if (municipio) {
    // Cuentas con alguna sede activa en el municipio: pocas por ciudad; se leen por lotes y se pagina aquí.
    const enMunicipio = await fetchAllRows<{ cuenta_id: string }>((from, to) =>
      supabaseAdmin
        .from('sedes')
        .select('cuenta_id')
        .eq('municipality_id', municipio)
        .eq('activo', true)
        .order('id')
        .range(from, to)
    )
    const todas = await leerPorIds<FilaCuenta>(
      enMunicipio.map(sede => sede.cuenta_id),
      (trozo, from, to) => consulta(false).in('id', trozo).order('id').range(from, to)
    )
    todas.sort(compararCuentas)
    total = todas.length
    filas = todas.slice(desde, desde + TERCEROS_POR_PAGINA)
  } else {
    const { data, error, count } = await consulta(true)
      .order('nombre', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + TERCEROS_POR_PAGINA - 1)
    if (error) throw error
    filas = (data || []) as unknown as FilaCuenta[]
    total = count ?? filas.length
  }

  // Sedes activas de cada cuenta de la página
  const sedes = await leerPorIds<{ id: string; cuenta_id: string }>(
    filas.map(fila => fila.id),
    (trozo, from, to) =>
      supabaseAdmin.from('sedes').select('id, cuenta_id').in('cuenta_id', trozo).eq('activo', true).order('id').range(from, to)
  )
  const sedesPorCuenta = new Map<string, number>()
  for (const sede of sedes) sedesPorCuenta.set(sede.cuenta_id, (sedesPorCuenta.get(sede.cuenta_id) ?? 0) + 1)

  const items: CuentaListItem[] = filas.map(fila => {
    const visible = ocultarIdentificacionCuenta(fila, administra)
    return {
      id: fila.id,
      nombre: fila.nombre,
      clase: fila.clase,
      es_cliente: fila.es_cliente,
      tipo_identificacion: fila.tipo_identificacion,
      numero_identificacion: visible.numero_identificacion,
      modalidad_facturacion: fila.modalidad_facturacion,
      sedes: sedesPorCuenta.get(fila.id) ?? 0,
      activo: fila.activo,
    }
  })
  return { items, total, page }
}

// ---------------------------------------------------------------------------------------------
// Médicos
// ---------------------------------------------------------------------------------------------

const compararMedicos = (a: MedicoBase, b: MedicoBase) =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * q: nombre (todas las palabras, sin importar tildes); por POST con terceros:manage, un texto con dígitos busca
 * el documento. visitante=me: solo los médicos de los que el usuario (su Ejecutivo Comercial enlazado) es
 * visitante vigente. Nunca lleva el documento. 50 por página.
 */
export async function listarMedicos(
  user: Pick<SessionUser, 'id' | 'papeles'>,
  filtros: BusquedaMedicos,
  opciones: OpcionesLista
): Promise<Pagina<MedicoListItem>> {
  const { q, municipio, visitante, activo, page } = filtros
  const desde = (page - 1) * TERCEROS_POR_PAGINA
  const vacia: Pagina<MedicoListItem> = { items: [], total: 0, page }

  const documento = q && opciones.buscarDocumentos && puedeAdministrar(user) ? busquedaDocumento(q) : null
  const consulta = (contar: boolean) => {
    let c = supabaseAdmin.from('medicos').select(COLUMNAS_MEDICO_LISTA, contar ? { count: 'exact' } : undefined)
    if (documento) {
      c = c.like('numero_documento', `${escaparLike(documento)}%`)
    } else if (q) {
      for (const patron of patronesDeBusqueda(q)) c = c.ilike('nombre', patron)
    }
    if (municipio) c = c.eq('municipality_id', municipio)
    if (activo !== undefined) c = c.eq('activo', activo)
    return c
  }

  let filas: MedicoBase[]
  let total: number

  if (visitante === 'me') {
    const ejecutivos = await ejecutivosDelUsuario(user.id)
    if (ejecutivos.length === 0) return vacia
    const visitas = await leerPorIds<{ id: string; medico_id: string }>(ejecutivos, (trozo, from, to) =>
      supabaseAdmin
        .from('medico_visitantes')
        .select('id, medico_id')
        .in('executive_id', trozo)
        .is('hasta', null)
        .order('id')
        .range(from, to)
    )
    if (visitas.length === 0) return vacia
    // Pueden ser cientos: se leen por lotes con los demás filtros y se pagina aquí.
    const todos = await leerPorIds<MedicoBase>(
      visitas.map(visita => visita.medico_id),
      (trozo, from, to) => consulta(false).in('id', trozo).order('id').range(from, to)
    )
    todos.sort(compararMedicos)
    total = todos.length
    filas = todos.slice(desde, desde + TERCEROS_POR_PAGINA)
  } else {
    const { data, error, count } = await consulta(true)
      .order('nombre', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + TERCEROS_POR_PAGINA - 1)
    if (error) throw error
    filas = (data || []) as unknown as MedicoBase[]
    total = count ?? filas.length
  }

  const relaciones = await cargarRelacionesMedicos(filas)
  return { items: filas.map(fila => medicoListItem(fila, relaciones)), total, page }
}
