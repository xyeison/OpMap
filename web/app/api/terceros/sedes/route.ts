// /api/terceros/sedes — buscador de sedes para vincular médicos (terceros:view) y nueva sede de una cuenta
// (terceros:create). Contrato: docs/fases/fase6-visitas-f1-terceros.md. Las sedes nuevas NO entran a hospitals
// (no mueven zonas, mapa ni rutas de Google).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { sedeCreateSchema } from '@/lib/terceros-schemas'
import { type SedeBusquedaItem } from '@/lib/terceros'
import { sedeAppConfirmada } from '@/lib/reporte-visitas'
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

/**
 * ¿El código de habilitación confirma la sede nueva de la app? Debe estar en el REPS (reps_sedes) con alguno de esos
 * municipios, ser del mismo prestador que la cuenta (reps_sedes.nit = cuentas.numero_identificacion) Y el GPS del
 * sitio debe quedar cerca del centro de ESE municipio (sedeAppConfirmada de lib/reporte-visitas.ts): el municipio lo
 * elige la ejecutiva y los códigos del REPS son públicos, así que sin el NIT y la distancia bastaría un código de
 * cualquier IPS de la ciudad para confirmar una sede creada desde la casa. Si la tabla no está o una consulta falla, no
 * cruza (la sede queda por confirmar: nunca se confirma a ciegas).
 */
async function repsConfirmaSede(
  repsCode: string,
  municipios: readonly (string | null | undefined)[],
  punto: { lat: number; lng: number } | null,
  identificacionCuenta: string | null
): Promise<boolean> {
  const validos = municipios.filter((codigo): codigo is string => typeof codigo === 'string' && /^\d{5}$/.test(codigo))
  if (validos.length === 0 || !punto || !identificacionCuenta) return false
  const { data, error } = await supabaseAdmin
    .from('reps_sedes')
    .select('codigo_habilitacion, municipio_sede, nit')
    .eq('codigo_habilitacion', repsCode)
    .limit(1)
  if (error) {
    console.error('POST /api/terceros/sedes: no se pudo cruzar el código de habilitación con el REPS:', error.message)
    return false
  }
  const filaReps = data && data.length > 0 ? (data[0] as { municipio_sede: string | null; nit: string | null }) : null
  const municipioReps = filaReps?.municipio_sede ?? null
  if (!municipioReps || !validos.includes(municipioReps)) return false
  const { data: centroData, error: centroError } = await supabaseAdmin.from('municipalities').select('code, lat, lng').eq('code', municipioReps).limit(1)
  if (centroError) {
    console.error('POST /api/terceros/sedes: no se pudo leer el centro del municipio del REPS:', centroError.message)
    return false
  }
  const centro = centroData && centroData.length > 0 ? (centroData[0] as { lat: number | string | null; lng: number | string | null }) : null
  const lat = centro?.lat === null || centro?.lat === undefined ? null : Number(centro.lat)
  const lng = centro?.lng === null || centro?.lng === undefined ? null : Number(centro.lng)
  return sedeAppConfirmada({
    municipio_reps: municipioReps,
    municipios_aceptados: validos,
    punto,
    centro_municipio: lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    nit_reps: filaReps?.nit ?? null,
    identificacion_cuenta: identificacionCuenta,
  })
}

// POST /api/terceros/sedes — nueva sede de una cuenta. origen 'manual' (por defecto): ubicación sin confirmar.
// origen 'gps_app' (app de visita, decisión 14 de docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md): con lat y
// lng del sitio; nace con ubicacion_confirmada = true solo si trae un código de habilitación del REPS que cruza con el
// municipio de la sede o con el de la sede principal de la cuenta, es del mismo prestador (NIT del REPS = número de
// identificación de la cuenta) Y el GPS queda a menos de 20 km del centro de ese municipio; si no, la confirma data manager (y sus visitas no suman hasta entonces). gps_accuracy_m se valida pero no
// se guarda (sedes no tiene esa columna). 409 con { existente } si el código de habilitación ya es de otra sede. Si
// la cuenta no tiene sede principal, esta lo es.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response

  try {
    const parsed = sedeCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: cuentaData, error: cuentaError } = await supabaseAdmin
      .from('cuentas')
      .select('id, activo, numero_identificacion')
      .eq('id', input.cuenta_id)
      .limit(1)
    if (cuentaError) throw cuentaError
    const cuenta =
      cuentaData && cuentaData.length > 0 ? (cuentaData[0] as { id: string; activo: boolean; numero_identificacion: string | null }) : null
    if (!cuenta) return jsonError('La cuenta elegida no existe', 400)
    if (!cuenta.activo) return jsonError('La cuenta está inactiva: actívala antes de añadirle sedes', 400)

    if (input.reps_code && (await sedePorRepsCode(input.reps_code))) return respuestaRepsRepetido(input.reps_code)
    const municipio = await nombreMunicipio(input.municipality_id)
    if (!municipio) return jsonError(MUNICIPIO_NO_EXISTE, 400)

    const { data: principalData, error: principalError } = await supabaseAdmin
      .from('sedes')
      .select('id, municipality_id')
      .eq('cuenta_id', input.cuenta_id)
      .eq('es_principal', true)
      .limit(1)
    if (principalError) throw principalError
    const sinPrincipal = !principalData || principalData.length === 0
    const municipioPrincipal = sinPrincipal ? null : (principalData[0] as { municipality_id: string | null }).municipality_id

    // Decisión 14: solo una sede del GPS de la app con código del REPS que cruza con el municipio nace confirmada.
    const origen = input.origen === 'gps_app' ? 'gps_app' : 'manual'
    const puntoApp = input.lat !== undefined && input.lat !== null && input.lng !== undefined && input.lng !== null ? { lat: input.lat, lng: input.lng } : null
    const ubicacionConfirmada =
      origen === 'gps_app' && Boolean(input.reps_code)
        ? await repsConfirmaSede(input.reps_code as string, [input.municipality_id, municipioPrincipal], puntoApp, cuenta.numero_identificacion ?? null)
        : false

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
        ubicacion_confirmada: ubicacionConfirmada,
        origen,
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
