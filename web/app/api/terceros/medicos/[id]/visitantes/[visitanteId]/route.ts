// PATCH /api/terceros/medicos/[id]/visitantes/[visitanteId] (visitantes:manage) — { hasta } termina la asignación.
// Nunca se borra: la fila queda como historia (desde → hasta). Desde el 2026-10-29 lo hacen el administrador y la
// dirección comercial; quien tenga visitantes:manage sin ver todas las líneas solo termina los de las suyas (403). hasta va de desde a hoy (hora de Colombia). Contrato:
// docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { visitanteUpdateSchema } from '@/lib/terceros-schemas'
import type { VisitanteRow } from '@/lib/terceros'
import {
  cargarMedicoDetalle,
  errorInterno,
  gestionaTodasLasLineas,
  hoyEnBogota,
  idDeRuta,
  puedeAdministrar,
} from '../../../../_lib/terceros-server'

type Params = { params: { id: string; visitanteId: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'visitantes:manage')
  if (!auth.ok) return auth.response
  const user = auth.user

  const medicoId = idDeRuta(params.id)
  if (!medicoId) return jsonError('ID de médico no válido', 400)
  const visitanteId = idDeRuta(params.visitanteId)
  if (!visitanteId) return jsonError('ID de visitante no válido', 400)

  try {
    const parsed = visitanteUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const { hasta } = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('medico_visitantes')
      .select('id, medico_id, line_id, desde, hasta')
      .eq('id', visitanteId)
      .eq('medico_id', medicoId)
      .limit(1)
    if (actualError) throw actualError
    const actual =
      actualData && actualData.length > 0
        ? (actualData[0] as Pick<VisitanteRow, 'id' | 'medico_id' | 'line_id' | 'desde' | 'hasta'>)
        : null
    if (!actual) return jsonError('Visitante no encontrado', 404)

    if (!gestionaTodasLasLineas(user)) {
      const { data: lineaData, error: lineaError } = await supabaseAdmin
        .from('business_lines')
        .select('id, leader_user_id')
        .eq('id', actual.line_id)
        .limit(1)
      if (lineaError) throw lineaError
      const linea = lineaData && lineaData.length > 0 ? (lineaData[0] as { id: string; leader_user_id: string | null }) : null
      if (!linea || linea.leader_user_id !== user.id) {
        return jsonError('Solo puedes terminar visitantes de las líneas que lideras', 403)
      }
    }

    if (actual.hasta !== null) return jsonError(`La asignación ya estaba terminada (${actual.hasta})`, 409)
    if (hasta < actual.desde) return jsonError(`La fecha de fin no puede ser anterior al inicio (${actual.desde})`, 400)
    const hoy = hoyEnBogota()
    if (hasta > hoy) return jsonError(`La fecha de fin no puede ser posterior a hoy (${hoy})`, 400)

    const { data, error } = await supabaseAdmin
      .from('medico_visitantes')
      .update({ hasta })
      .eq('id', visitanteId)
      .is('hasta', null)
      .select('*')
    if (error) {
      if (error.code === '23514') return jsonError(`La fecha de fin no puede ser anterior al inicio (${actual.desde})`, 400)
      throw error
    }
    if (!data || data.length === 0) return jsonError('La asignación ya estaba terminada', 409)

    const medico = await cargarMedicoDetalle(medicoId, puedeAdministrar(user))
    return NextResponse.json({ visitante: data[0] as VisitanteRow, medico })
  } catch (error) {
    return errorInterno('PATCH /api/terceros/medicos/[id]/visitantes/[visitanteId]', error, 'Error al terminar el visitante')
  }
}
