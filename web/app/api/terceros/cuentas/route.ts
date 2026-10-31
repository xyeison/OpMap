// /api/terceros/cuentas — lista (terceros:view; filtros q, clase, cliente, municipio, activo) y creación con su
// sede principal (terceros:create). Contrato: docs/fases/fase6-visitas-f1-terceros.md. Una cuenta por
// identificación: si ya existe, 409 con { existente: { id, nombre } }, también si el número es el de una cuenta NIT
// escrito como CC u "otro" (o al revés). La identificación de una persona (CC, CE, PA, otro) solo sale con
// terceros:manage, y por GET un número solo busca NIT: la búsqueda de documentos va por POST
// /api/terceros/cuentas/buscar (el documento no queda en la URL).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { geocodificarDireccion, textoGeocodificacion, type ResultadoGeocodificacion } from '@/lib/google-geocode'
import { MENSAJE_DIRECCION_CONSULTORIO, busquedaCuentasSchema, cuentaCreateSchema, faltaDireccionDeConsultorio } from '@/lib/terceros-schemas'
import { ocultarIdentificacionCuenta } from '@/lib/terceros'
import { listarCuentas } from '../_lib/listas'
import {
  CUENTA_REPETIDA,
  MUNICIPIO_NO_EXISTE,
  cuentaEquivalente,
  cuentaPorIdentificacion,
  errorInterno,
  esViolacionUnica,
  municipioParaUbicar,
  puedeAdministrar,
  respuestaRepsRepetido,
  sedePorRepsCode,
} from '../_lib/terceros-server'

export const dynamic = 'force-dynamic'

// GET /api/terceros/cuentas?q=&clase=&cliente=&municipio=&activo=&page=
// q: nombre (todas las palabras, sin importar tildes) o, si es un número, el NIT (solo NIT, para todos: un documento
// de persona no se busca por la URL; la interfaz usa POST /api/terceros/cuentas/buscar). municipio (código DANE):
// cuentas con al menos una sede ACTIVA en esa ciudad. 50 por página.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const parsed = busquedaCuentasSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

  try {
    return NextResponse.json(await listarCuentas(auth.user, parsed.data, { buscarDocumentos: false }))
  } catch (error) {
    return errorInterno('GET /api/terceros/cuentas', error, 'Error al cargar las cuentas')
  }
}

// POST /api/terceros/cuentas — crea la cuenta con su sede principal (origen 'manual', ubicación sin confirmar).
// Marcar cliente o modalidad de facturación es de terceros:manage. Si la sede principal no se puede guardar,
// la cuenta recién creada se borra (PostgREST no tiene transacciones): no quedan cuentas sin sede.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response
  const user = auth.user

  try {
    const parsed = cuentaCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    if (!puedeAdministrar(user) && (input.es_cliente === true || (input.modalidad_facturacion ?? null) !== null)) {
      return jsonError('Solo quien administra terceros puede marcar la cuenta como cliente o su modalidad de facturación', 403)
    }

    const previa = await cuentaPorIdentificacion(input.tipo_identificacion, input.numero_identificacion)
    if (previa) return jsonError(`${CUENTA_REPETIDA}: ${previa.nombre}`, 409, { existente: previa })
    // El mismo número con otro tipo: el NIT de una empresa escrito como CC u "otro" (con o sin su DV), o un NIT
    // que ya está como CC u "otro". Una cuenta por identificación: no se repite el NIT cambiando el tipo.
    const equivalente = await cuentaEquivalente(input.tipo_identificacion, input.numero_identificacion)
    if (equivalente) {
      const mensaje = equivalente.nit
        ? `Ya existe una cuenta con el NIT ${equivalente.nit}: ${equivalente.nombre}. Si es la misma, usa esa cuenta`
        : `${CUENTA_REPETIDA}: ${equivalente.nombre}`
      return jsonError(mensaje, 409, { existente: { id: equivalente.id, nombre: equivalente.nombre } })
    }

    const sede = input.sede
    // Después del 409 (una cuenta que ya existe se reutiliza sin escribir nada): el consultorio nuevo lleva su dirección.
    if (faltaDireccionDeConsultorio(input)) return jsonError(MENSAJE_DIRECCION_CONSULTORIO, 400)
    if (sede.reps_code && (await sedePorRepsCode(sede.reps_code))) return respuestaRepsRepetido(sede.reps_code)
    const datosMunicipio = await municipioParaUbicar(sede.municipality_id)
    if (!datosMunicipio) return jsonError(MUNICIPIO_NO_EXISTE, 400)
    const municipio = datosMunicipio.nombre

    // El consultorio de un médico (dueño, 2026-10-31; docs/decisiones/2026-10-31-consultorio-por-direccion.md): sin el
    // GPS del sitio, su dirección se geocodifica con Google (una petición, 0,005 USD) y las coordenadas se guardan SOLO
    // con certeza; si no, queda "sin ubicar" con su dirección. Con GPS no se llama a Google. Nunca se inventa un punto.
    let geocodificacion: ResultadoGeocodificacion | null = null
    let lat = sede.lat ?? null
    let lng = sede.lng ?? null
    if (input.clase === 'consultorio' && lat === null && lng === null && sede.direccion) {
      geocodificacion = await geocodificarDireccion({ direccion: sede.direccion, municipio, departamento: datosMunicipio.departamento, centro: datosMunicipio.centro })
      if (geocodificacion.ubicada) {
        lat = geocodificacion.lat
        lng = geocodificacion.lng
      } else {
        console.info(`[terceros] consultorio sin ubicar por dirección: ${geocodificacion.motivo}${geocodificacion.detalle ? ` (${geocodificacion.detalle})` : ''}`)
      }
    }

    const { data: cuentaData, error: cuentaError } = await supabaseAdmin
      .from('cuentas')
      .insert({
        nombre: input.nombre,
        clase: input.clase,
        es_cliente: input.es_cliente ?? false,
        tipo_identificacion: input.tipo_identificacion,
        numero_identificacion: input.numero_identificacion,
        codigo_prestador: input.codigo_prestador ?? null,
        modalidad_facturacion: input.modalidad_facturacion ?? null,
        notas: input.notas ?? null,
        origen: 'manual',
        created_by: user.id,
      })
      .select('*')
    if (cuentaError) {
      if (esViolacionUnica(cuentaError, 'cuentas_identificacion_key')) {
        const existente = await cuentaPorIdentificacion(input.tipo_identificacion, input.numero_identificacion)
        return jsonError(CUENTA_REPETIDA, 409, existente ? { existente } : {})
      }
      if (cuentaError.code === '23514') return jsonError('Los datos de la cuenta no son válidos', 400)
      throw cuentaError
    }
    const cuenta = (cuentaData || [])[0] as { id: string; nombre: string } | undefined
    if (!cuenta) return jsonError('No se pudo crear la cuenta', 500)

    const { data: sedeData, error: sedeError } = await supabaseAdmin
      .from('sedes')
      .insert({
        cuenta_id: cuenta.id,
        nombre: sede.nombre,
        es_principal: true,
        reps_code: sede.reps_code ?? null,
        direccion: sede.direccion ?? null,
        municipality_id: sede.municipality_id,
        ciudad: sede.ciudad ?? municipio,
        lat,
        lng,
        ubicacion_confirmada: false,
        origen: 'manual',
        created_by: user.id,
      })
      .select('*')
    if (sedeError || !sedeData || sedeData.length === 0) {
      // Sin sede principal la cuenta no se queda: se deshace a mano.
      const { error: borrarError } = await supabaseAdmin.from('cuentas').delete().eq('id', cuenta.id)
      if (borrarError) console.error('No se pudo deshacer la cuenta sin sede', cuenta.id, borrarError)
      if (sedeError && esViolacionUnica(sedeError, 'sedes_reps_code_key') && sede.reps_code) {
        return respuestaRepsRepetido(sede.reps_code)
      }
      if (sedeError?.code === '23514') return jsonError('Los datos de la sede principal no son válidos', 400)
      return errorInterno('POST /api/terceros/cuentas (sede principal)', sedeError, 'No se pudo crear la sede principal')
    }

    const creada = ocultarIdentificacionCuenta(
      cuentaData[0] as { tipo_identificacion: string; numero_identificacion: string | null },
      puedeAdministrar(user)
    )
    return NextResponse.json(
      {
        id: cuenta.id,
        cuenta: creada,
        sede: sedeData[0],
        // Solo cuando se intentó ubicar por dirección (consultorio sin GPS): qué pasó, para decírselo a quien lo creó.
        ...(geocodificacion
          ? { geocodificacion: { ubicada: geocodificacion.ubicada, motivo: geocodificacion.ubicada ? null : geocodificacion.motivo, texto: textoGeocodificacion(geocodificacion) } }
          : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    return errorInterno('POST /api/terceros/cuentas', error, 'Error al crear la cuenta')
  }
}
