// /api/terceros/medicos/[id] — detalle (terceros:view; el documento solo con terceros:manage) y edición
// (terceros:manage: el documento se puede corregir, nunca quitar). Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { medicoUpdateSchema } from '@/lib/terceros-schemas'
import {
  MEDICO_REPETIDO,
  MUNICIPIO_NO_EXISTE,
  cargarMedicoDetalle,
  errorInterno,
  esViolacionUnica,
  idDeRuta,
  medicoPorDocumento,
  mensajeRegla,
  nombreMunicipio,
  puedeAdministrar,
} from '../../_lib/terceros-server'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

// GET /api/terceros/medicos/[id] — médico con ciudad, sedes (principal primero) y visitantes: los vigentes y,
// como historia, los terminados (con hasta). Las listas solo traen los vigentes.
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)

  try {
    const medico = await cargarMedicoDetalle(medicoId, puedeAdministrar(auth.user))
    if (!medico) return jsonError('Médico no encontrado', 404)
    return NextResponse.json({ medico })
  } catch (error) {
    return errorInterno('GET /api/terceros/medicos/[id]', error, 'Error al cargar el médico')
  }
}

// PATCH /api/terceros/medicos/[id] — nombre, especialidades, municipio, teléfono, correo, notas, activo y la
// corrección del documento (tipo y número juntos). Reactivar un médico sin sedes lo rechaza la base (400).
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:manage')
  if (!auth.ok) return auth.response

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)

  try {
    const parsed = medicoUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin.from('medicos').select('id').eq('id', medicoId).limit(1)
    if (actualError) throw actualError
    if (!actualData || actualData.length === 0) return jsonError('Médico no encontrado', 404)

    if (input.tipo_documento !== undefined && input.numero_documento !== undefined) {
      const otro = await medicoPorDocumento(input.tipo_documento, input.numero_documento, medicoId)
      if (otro) return jsonError(`${MEDICO_REPETIDO}: ${otro.nombre}`, 409, { existente: otro })
    }
    if (input.municipality_id !== undefined && !(await nombreMunicipio(input.municipality_id))) {
      return jsonError(MUNICIPIO_NO_EXISTE, 400)
    }

    const cambios: Record<string, unknown> = {}
    if (input.tipo_documento !== undefined && input.numero_documento !== undefined) {
      cambios.tipo_documento = input.tipo_documento
      cambios.numero_documento = input.numero_documento
    }
    if (input.nombre !== undefined) cambios.nombre = input.nombre
    if (input.especialidades !== undefined) cambios.especialidades = input.especialidades
    if (input.municipality_id !== undefined) cambios.municipality_id = input.municipality_id
    if (input.telefono !== undefined) cambios.telefono = input.telefono
    if (input.email !== undefined) cambios.email = input.email
    if (input.notas !== undefined) cambios.notas = input.notas
    if (input.activo !== undefined) cambios.activo = input.activo

    const { data, error } = await supabaseAdmin.from('medicos').update(cambios).eq('id', medicoId).select('id')
    if (error) {
      if (esViolacionUnica(error)) {
        const otro =
          input.tipo_documento !== undefined && input.numero_documento !== undefined
            ? await medicoPorDocumento(input.tipo_documento, input.numero_documento, medicoId)
            : null
        return jsonError(MEDICO_REPETIDO, 409, otro ? { existente: otro } : {})
      }
      if (error.code === '23514') return jsonError(mensajeRegla(error, 'Los datos del médico no son válidos'), 400)
      throw error
    }
    if (!data || data.length === 0) return jsonError('Médico no encontrado', 404)

    const medico = await cargarMedicoDetalle(medicoId, true)
    return NextResponse.json({ medico })
  } catch (error) {
    return errorInterno('PATCH /api/terceros/medicos/[id]', error, 'Error al guardar el médico')
  }
}
