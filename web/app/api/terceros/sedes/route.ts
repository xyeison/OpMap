// /api/terceros/sedes — buscador de sedes para vincular médicos (terceros:view) y nueva sede de una cuenta
// (terceros:create). Contrato: docs/fases/fase6-visitas-f1-terceros.md. Las sedes nuevas NO entran a hospitals
// (no mueven zonas, mapa ni rutas de Google).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { sedeCreateSchema } from '@/lib/terceros-schemas'
import { type SedeBusquedaItem } from '@/lib/terceros'
import {
  MUNICIPIO_NO_EXISTE,
  busquedaNumerica,
  errorInterno,
  esViolacionUnica,
  leerPorIds,
  leerTexto,
  nombreMunicipio,
  patronesDeBusqueda,
  respuestaRepsRepetido,
  sedePorRepsCode,
} from '../_lib/terceros-server'

export const dynamic = 'force-dynamic'

/** Resultados del buscador (no es una lista paginada: se afina escribiendo). */
const MAX_RESULTADOS = 50

type SedeEncontrada = {
  id: string
  nombre: string
  cuenta_id: string
  ciudad: string | null
  reps_code: string | null
  municipality_id: string | null
}

// GET /api/terceros/sedes?q=&municipio= — sedes ACTIVAS de cuentas activas. q busca en el nombre de la sede y en
// el de su cuenta (todas las palabras, sin importar tildes) o, si es un número, por código de habilitación.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const q = leerTexto(params.get('q'))
  const municipio = leerTexto(params.get('municipio'))
  if (municipio && !/^\d{5}$/.test(municipio)) return jsonError('Municipio no válido: usa el código DANE de 5 dígitos', 400)

  const columnas = 'id, nombre, cuenta_id, ciudad, reps_code, municipality_id'
  const base = () => {
    let consulta = supabaseAdmin.from('sedes').select(columnas).eq('activo', true)
    if (municipio) consulta = consulta.eq('municipality_id', municipio)
    return consulta
  }

  try {
    const encontradas = new Map<string, SedeEncontrada>()
    const agregar = (filas: unknown[] | null) => {
      for (const fila of (filas || []) as SedeEncontrada[]) encontradas.set(fila.id, fila)
    }

    const numero = q ? busquedaNumerica(q) : null
    if (numero) {
      const { data, error } = await base().like('reps_code', `${numero}%`).order('nombre').limit(MAX_RESULTADOS)
      if (error) throw error
      agregar(data)
    } else {
      const patrones = q ? patronesDeBusqueda(q) : []
      // 1) por nombre de la sede
      let porNombre = base()
      for (const patron of patrones) porNombre = porNombre.ilike('nombre', patron)
      const { data, error } = await porNombre.order('nombre').limit(MAX_RESULTADOS)
      if (error) throw error
      agregar(data)

      // 2) por nombre de la cuenta (una clínica con varias sedes)
      if (patrones.length > 0 && encontradas.size < MAX_RESULTADOS) {
        let cuentasConsulta = supabaseAdmin.from('cuentas').select('id').eq('activo', true)
        for (const patron of patrones) cuentasConsulta = cuentasConsulta.ilike('nombre', patron)
        const { data: cuentas, error: cuentasError } = await cuentasConsulta.order('nombre').limit(MAX_RESULTADOS)
        if (cuentasError) throw cuentasError
        const ids = (cuentas || []).map(cuenta => String((cuenta as { id: string }).id))
        if (ids.length > 0) {
          const { data: sedesCuenta, error: sedesError } = await base()
            .in('cuenta_id', ids)
            .order('nombre')
            .limit(MAX_RESULTADOS)
          if (sedesError) throw sedesError
          agregar(sedesCuenta)
        }
      }
    }

    // Cuenta de cada sede: fuera las de cuentas inactivas
    const sedes = Array.from(encontradas.values())
    const cuentas = await leerPorIds<{ id: string; nombre: string; activo: boolean }>(
      sedes.map(sede => sede.cuenta_id),
      (trozo, from, to) =>
        supabaseAdmin.from('cuentas').select('id, nombre, activo').in('id', trozo).order('id').range(from, to)
    )
    const cuentaPorId = new Map(cuentas.map(cuenta => [cuenta.id, cuenta]))
    const items: SedeBusquedaItem[] = sedes
      .filter(sede => cuentaPorId.get(sede.cuenta_id)?.activo)
      .map(sede => ({
        id: sede.id,
        nombre: sede.nombre,
        cuenta_id: sede.cuenta_id,
        cuenta_nombre: cuentaPorId.get(sede.cuenta_id)?.nombre ?? '',
        ciudad: sede.ciudad,
        reps_code: sede.reps_code,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
      .slice(0, MAX_RESULTADOS)

    return NextResponse.json({ items })
  } catch (error) {
    return errorInterno('GET /api/terceros/sedes', error, 'Error al buscar sedes')
  }
}

// POST /api/terceros/sedes — nueva sede de una cuenta: origen 'manual', ubicación sin confirmar. 409 con
// { existente } si el código de habilitación ya es de otra sede. Si la cuenta no tiene sede principal, esta lo es.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response

  try {
    const parsed = sedeCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: cuentaData, error: cuentaError } = await supabaseAdmin
      .from('cuentas')
      .select('id, activo')
      .eq('id', input.cuenta_id)
      .limit(1)
    if (cuentaError) throw cuentaError
    const cuenta = cuentaData && cuentaData.length > 0 ? (cuentaData[0] as { id: string; activo: boolean }) : null
    if (!cuenta) return jsonError('La cuenta elegida no existe', 400)
    if (!cuenta.activo) return jsonError('La cuenta está inactiva: actívala antes de añadirle sedes', 400)

    if (input.reps_code && (await sedePorRepsCode(input.reps_code))) return respuestaRepsRepetido(input.reps_code)
    const municipio = await nombreMunicipio(input.municipality_id)
    if (!municipio) return jsonError(MUNICIPIO_NO_EXISTE, 400)

    const { data: principalData, error: principalError } = await supabaseAdmin
      .from('sedes')
      .select('id')
      .eq('cuenta_id', input.cuenta_id)
      .eq('es_principal', true)
      .limit(1)
    if (principalError) throw principalError
    const sinPrincipal = !principalData || principalData.length === 0

    const { data, error } = await supabaseAdmin
      .from('sedes')
      .insert({
        cuenta_id: input.cuenta_id,
        nombre: input.nombre,
        es_principal: sinPrincipal,
        reps_code: input.reps_code ?? null,
        direccion: input.direccion ?? null,
        municipality_id: input.municipality_id,
        ciudad: input.ciudad ?? municipio,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        ubicacion_confirmada: false,
        origen: 'manual',
        created_by: auth.user.id,
      })
      .select('*')
    if (error) {
      if (esViolacionUnica(error, 'sedes_reps_code_key') && input.reps_code) return respuestaRepsRepetido(input.reps_code)
      if (error.code === '23514') return jsonError('Los datos de la sede no son válidos', 400)
      throw error
    }
    const sede = (data || [])[0] as { id: string } | undefined
    if (!sede) return jsonError('No se pudo crear la sede', 500)
    return NextResponse.json({ id: sede.id, sede }, { status: 201 })
  } catch (error) {
    return errorInterno('POST /api/terceros/sedes', error, 'Error al crear la sede')
  }
}
