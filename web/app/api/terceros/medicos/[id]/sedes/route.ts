// /api/terceros/medicos/[id]/sedes — vincula una sede más al médico (terceros:create) o la desvincula
// (terceros:manage). Un médico nunca queda sin sede: quitar la última responde 400 (y la base también lo
// impide al cerrar la transacción). Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { medicoSedeCreateSchema } from '@/lib/terceros-schemas'
import type { MedicoSedeRow } from '@/lib/terceros'
import {
  cargarMedicoDetalle,
  errorInterno,
  esViolacionUnica,
  idDeRuta,
  leerMedico,
  mensajeRegla,
  puedeAdministrar,
} from '../../../_lib/terceros-server'

type Params = { params: { id: string } }

const SIN_SEDE = 'El médico debe quedar con al menos una sede donde atiende: vincula otra antes de quitar esta'

async function sedesDelMedico(medicoId: string): Promise<MedicoSedeRow[]> {
  const { data, error } = await supabaseAdmin
    .from('medico_sedes')
    .select('medico_id, sede_id, rol, principal, created_at')
    .eq('medico_id', medicoId)
    .order('created_at', { ascending: true })
    .order('sede_id', { ascending: true })
    .range(0, 999)
  if (error) throw error
  return (data || []) as MedicoSedeRow[]
}

// POST — { sede_id, rol: 'consultorio' | 'atiende', principal? }. principal: true la vuelve la principal.
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)

  try {
    const parsed = medicoSedeCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    if (!(await leerMedico(medicoId))) return jsonError('Médico no encontrado', 404)

    const { data: sedeData, error: sedeError } = await supabaseAdmin
      .from('sedes')
      .select('id, activo')
      .eq('id', input.sede_id)
      .limit(1)
    if (sedeError) throw sedeError
    const sede = sedeData && sedeData.length > 0 ? (sedeData[0] as { id: string; activo: boolean }) : null
    if (!sede) return jsonError('La sede elegida no existe', 400)
    if (!sede.activo) return jsonError('La sede elegida está inactiva', 400)

    const actuales = await sedesDelMedico(medicoId)
    if (actuales.some(vinculo => vinculo.sede_id === input.sede_id)) {
      return jsonError('El médico ya está vinculado a esa sede', 409)
    }
    const hayPrincipal = actuales.some(vinculo => vinculo.principal)
    const principal = input.principal === true || !hayPrincipal

    // Nueva principal: primero se quita la marca a la anterior (índice único de una principal por médico).
    let principalAnterior: string | null = null
    if (principal && hayPrincipal) {
      const { data: anterior, error: anteriorError } = await supabaseAdmin
        .from('medico_sedes')
        .update({ principal: false })
        .eq('medico_id', medicoId)
        .eq('principal', true)
        .select('sede_id')
      if (anteriorError) throw anteriorError
      principalAnterior = anterior && anterior.length > 0 ? String((anterior[0] as { sede_id: string }).sede_id) : null
    }

    const { error } = await supabaseAdmin
      .from('medico_sedes')
      .insert({ medico_id: medicoId, sede_id: input.sede_id, rol: input.rol, principal, created_by: auth.user.id })
      .select('sede_id')
    if (error) {
      if (principalAnterior) {
        const { error: restaurarError } = await supabaseAdmin
          .from('medico_sedes')
          .update({ principal: true })
          .eq('medico_id', medicoId)
          .eq('sede_id', principalAnterior)
        if (restaurarError) console.error('No se pudo restaurar la sede principal del médico', medicoId, restaurarError)
      }
      if (esViolacionUnica(error)) return jsonError('El médico ya está vinculado a esa sede', 409)
      if (error.code === '23503') return jsonError('La sede elegida no existe', 400)
      if (error.code === '23514') return jsonError(mensajeRegla(error, 'Datos de la sede no válidos'), 400)
      throw error
    }

    const medico = await cargarMedicoDetalle(medicoId, puedeAdministrar(auth.user))
    return NextResponse.json({ medico }, { status: 201 })
  } catch (error) {
    return errorInterno('POST /api/terceros/medicos/[id]/sedes', error, 'Error al vincular la sede')
  }
}

// DELETE ?sede_id= — desvincula la sede. Si era la principal, la principal pasa a la sede más antigua que quede.
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:manage')
  if (!auth.ok) return auth.response

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)
  const sedeId = idDeRuta(request.nextUrl.searchParams.get('sede_id'))
  if (!sedeId) return jsonError('Indica la sede a desvincular (sede_id)', 400)

  try {
    if (!(await leerMedico(medicoId))) return jsonError('Médico no encontrado', 404)

    const actuales = await sedesDelMedico(medicoId)
    const vinculo = actuales.find(fila => fila.sede_id === sedeId)
    if (!vinculo) return jsonError('El médico no está vinculado a esa sede', 404)
    if (actuales.length <= 1) return jsonError(SIN_SEDE, 400)

    const { data, error } = await supabaseAdmin
      .from('medico_sedes')
      .delete()
      .eq('medico_id', medicoId)
      .eq('sede_id', sedeId)
      .select('sede_id')
    if (error) {
      if (error.code === '23514') return jsonError(SIN_SEDE, 400)
      throw error
    }
    if (!data || data.length === 0) return jsonError('El médico no está vinculado a esa sede', 404)

    if (vinculo.principal) {
      const siguiente = actuales.find(fila => fila.sede_id !== sedeId)
      if (siguiente) {
        const { error: principalError } = await supabaseAdmin
          .from('medico_sedes')
          .update({ principal: true })
          .eq('medico_id', medicoId)
          .eq('sede_id', siguiente.sede_id)
        if (principalError) console.error('No se pudo marcar la nueva sede principal del médico', medicoId, principalError)
      }
    }

    const medico = await cargarMedicoDetalle(medicoId, true)
    return NextResponse.json({ medico })
  } catch (error) {
    return errorInterno('DELETE /api/terceros/medicos/[id]/sedes', error, 'Error al desvincular la sede')
  }
}
