// /api/terceros/cuentas/[id] — detalle con sedes y contactos (terceros:view) y edición (terceros:manage).
// Contrato: docs/fases/fase6-visitas-f1-terceros.md. La identificación no se edita (una cuenta por identificación).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { cuentaUpdateSchema } from '@/lib/terceros-schemas'
import { errorModalidad, ocultarIdentificacionCuenta, type ContactoRow, type CuentaDetalle, type CuentaRow, type SedeRow } from '@/lib/terceros'
import { errorInterno, idDeRuta, leerPorIds, puedeAdministrar } from '../../_lib/terceros-server'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/terceros/cuentas/[id] — { cuenta, sedes (principal primero), contactos }.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const cuentaId = idDeRuta(params.id)
  if (!cuentaId) return jsonError('ID de cuenta no válido', 400)

  try {
    const { data, error } = await supabaseAdmin.from('cuentas').select('*').eq('id', cuentaId).limit(1)
    if (error) throw error
    const cuenta = data && data.length > 0 ? (data[0] as CuentaRow) : null
    if (!cuenta) return jsonError('Cuenta no encontrada', 404)

    const [sedes, contactos] = await Promise.all([
      leerPorIds<SedeRow>([cuentaId], (trozo, from, to) =>
        supabaseAdmin.from('sedes').select('*').in('cuenta_id', trozo).order('id').range(from, to)
      ),
      leerPorIds<ContactoRow>([cuentaId], (trozo, from, to) =>
        supabaseAdmin.from('contactos').select('*').in('cuenta_id', trozo).order('id').range(from, to)
      ),
    ])
    const comparar = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' })
    sedes.sort(
      (a, b) =>
        Number(b.es_principal) - Number(a.es_principal) || Number(b.activo) - Number(a.activo) || comparar(a.nombre, b.nombre)
    )
    contactos.sort((a, b) => Number(b.activo) - Number(a.activo) || comparar(a.nombre, b.nombre))

    const body: CuentaDetalle = {
      cuenta: ocultarIdentificacionCuenta(cuenta as CuentaDetalle['cuenta'], puedeAdministrar(auth.user)),
      sedes,
      contactos,
    }
    return NextResponse.json(body)
  } catch (error) {
    return errorInterno('GET /api/terceros/cuentas/[id]', error, 'Error al cargar la cuenta')
  }
}

// PATCH /api/terceros/cuentas/[id] — nombre, clase, es_cliente, codigo_prestador, modalidad (solo EPS), notas, activo.
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:manage')
  if (!auth.ok) return auth.response

  const cuentaId = idDeRuta(params.id)
  if (!cuentaId) return jsonError('ID de cuenta no válido', 400)

  try {
    const parsed = cuentaUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('cuentas')
      .select('id, clase, modalidad_facturacion')
      .eq('id', cuentaId)
      .limit(1)
    if (actualError) throw actualError
    const actual = actualData && actualData.length > 0 ? (actualData[0] as Pick<CuentaRow, 'id' | 'clase' | 'modalidad_facturacion'>) : null
    if (!actual) return jsonError('Cuenta no encontrada', 404)

    // Modalidad sin clase: se comprueba con la clase guardada (solo una EPS tiene modalidad).
    const claseFinal = input.clase ?? actual.clase
    const modalidadFinal = input.modalidad_facturacion !== undefined ? input.modalidad_facturacion : actual.modalidad_facturacion
    const errorDeModalidad = errorModalidad(claseFinal, modalidadFinal)
    if (errorDeModalidad) return jsonError(errorDeModalidad, 400)

    const cambios: Record<string, unknown> = {}
    if (input.nombre !== undefined) cambios.nombre = input.nombre
    if (input.clase !== undefined) cambios.clase = input.clase
    if (input.es_cliente !== undefined) cambios.es_cliente = input.es_cliente
    if (input.codigo_prestador !== undefined) cambios.codigo_prestador = input.codigo_prestador
    if (input.modalidad_facturacion !== undefined) cambios.modalidad_facturacion = input.modalidad_facturacion
    if (input.notas !== undefined) cambios.notas = input.notas
    if (input.activo !== undefined) cambios.activo = input.activo

    const { data, error } = await supabaseAdmin.from('cuentas').update(cambios).eq('id', cuentaId).select('*')
    if (error) {
      if (error.code === '23514') return jsonError('Los datos de la cuenta no son válidos', 400)
      throw error
    }
    if (!data || data.length === 0) return jsonError('Cuenta no encontrada', 404)
    return NextResponse.json({ cuenta: data[0] as CuentaRow })
  } catch (error) {
    return errorInterno('PATCH /api/terceros/cuentas/[id]', error, 'Error al guardar la cuenta')
  }
}
