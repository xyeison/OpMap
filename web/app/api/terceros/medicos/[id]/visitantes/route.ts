// POST /api/terceros/medicos/[id]/visitantes (visitantes:manage) — { executive_id, line_id, municipality_id? }.
// Varios Ejecutivos Comerciales por médico, cada uno por una línea (incluso dos de la misma línea en ciudades
// distintas). El líder de línea solo asigna en las líneas que lidera (403); el Ejecutivo Comercial debe llevar
// esa línea (executive_lines). Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { visitanteCreateSchema } from '@/lib/terceros-schemas'
import type { VisitanteRow } from '@/lib/terceros'
import {
  MUNICIPIO_NO_EXISTE,
  cargarMedicoDetalle,
  errorInterno,
  esViolacionUnica,
  gestionaTodasLasLineas,
  idDeRuta,
  leerMedico,
  nombreMunicipio,
  puedeAdministrar,
} from '../../../_lib/terceros-server'

type Params = { params: { id: string } }

const VISITANTE_REPETIDO = 'Ese Ejecutivo Comercial ya es visitante de este médico por esa línea en esa ciudad'

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'visitantes:manage')
  if (!auth.ok) return auth.response
  const user = auth.user

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)

  try {
    const parsed = visitanteCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data
    const municipio = input.municipality_id ?? null

    const medico = await leerMedico(medicoId)
    if (!medico) return jsonError('Médico no encontrado', 404)
    if (!medico.activo) return jsonError('El médico está inactivo: actívalo antes de asignarle visitantes', 400)

    const { data: lineaData, error: lineaError } = await supabaseAdmin
      .from('business_lines')
      .select('id, name, leader_user_id, active')
      .eq('id', input.line_id)
      .limit(1)
    if (lineaError) throw lineaError
    const linea =
      lineaData && lineaData.length > 0
        ? (lineaData[0] as { id: string; name: string; leader_user_id: string | null; active: boolean })
        : null
    if (!linea) return jsonError('La línea elegida no existe', 400)
    if (!gestionaTodasLasLineas(user) && linea.leader_user_id !== user.id) {
      return jsonError('Solo puedes asignar visitantes en las líneas que lideras', 403)
    }
    if (!linea.active) return jsonError('La línea elegida está inactiva', 400)

    const { data: ejecutivoData, error: ejecutivoError } = await supabaseAdmin
      .from('executives')
      .select('id, full_name, status')
      .eq('id', input.executive_id)
      .limit(1)
    if (ejecutivoError) throw ejecutivoError
    const ejecutivo =
      ejecutivoData && ejecutivoData.length > 0
        ? (ejecutivoData[0] as { id: string; full_name: string; status: string })
        : null
    if (!ejecutivo) return jsonError('El Ejecutivo Comercial elegido no existe', 400)
    if (ejecutivo.status === 'inactive') return jsonError('El Ejecutivo Comercial elegido está inactivo', 400)

    const { data: lleva, error: llevaError } = await supabaseAdmin
      .from('executive_lines')
      .select('executive_id')
      .eq('executive_id', input.executive_id)
      .eq('line_id', input.line_id)
      .limit(1)
    if (llevaError) throw llevaError
    if (!lleva || lleva.length === 0) {
      return jsonError(`${ejecutivo.full_name} no lleva la línea ${linea.name}: añádela en Ejecutivos Comerciales primero`, 400)
    }

    if (municipio && !(await nombreMunicipio(municipio))) return jsonError(MUNICIPIO_NO_EXISTE, 400)

    // Un visitante vigente (hasta IS NULL) por médico, ejecutivo, línea y ciudad.
    const { data: vigentes, error: vigentesError } = await supabaseAdmin
      .from('medico_visitantes')
      .select('id, municipality_id')
      .eq('medico_id', medicoId)
      .eq('executive_id', input.executive_id)
      .eq('line_id', input.line_id)
      .is('hasta', null)
      .range(0, 999)
    if (vigentesError) throw vigentesError
    const repetido = ((vigentes || []) as Array<{ id: string; municipality_id: string | null }>).find(
      fila => (fila.municipality_id ?? null) === municipio
    )
    if (repetido) return jsonError(VISITANTE_REPETIDO, 409, { existente: { id: repetido.id } })

    const { data, error } = await supabaseAdmin
      .from('medico_visitantes')
      .insert({
        medico_id: medicoId,
        executive_id: input.executive_id,
        line_id: input.line_id,
        municipality_id: municipio,
        created_by: user.id,
      })
      .select('*')
    if (error) {
      if (esViolacionUnica(error)) return jsonError(VISITANTE_REPETIDO, 409)
      if (error.code === '23503') return jsonError('El Ejecutivo Comercial o la línea no existen', 400)
      throw error
    }
    const visitante = (data || [])[0] as VisitanteRow | undefined
    if (!visitante) return jsonError('No se pudo asignar el visitante', 500)

    const detalle = await cargarMedicoDetalle(medicoId, puedeAdministrar(user))
    return NextResponse.json({ id: visitante.id, visitante, medico: detalle }, { status: 201 })
  } catch (error) {
    return errorInterno('POST /api/terceros/medicos/[id]/visitantes', error, 'Error al asignar el visitante')
  }
}
