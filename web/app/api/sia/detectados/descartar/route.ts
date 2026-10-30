import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { badJson, isUuid, readJsonBody } from '@/app/api/_lib/api-error'
import { descartarDetectado } from '../../_lib/sia-server'
import { responder } from '../../_lib/responder'

// POST /api/sia/detectados/descartar { sia_id | secop_id, motivo } — saca un contrato de la bandeja con su motivo.
// El de SIA queda descartado en sia_contratos; el de SECOP, en secop_descartes_bandeja (secop_contratos no cambia). contracts:edit.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response
  const body = (await readJsonBody(request)) as { sia_id?: unknown; secop_id?: unknown; motivo?: unknown } | undefined
  if (!body || typeof body !== 'object') return badJson()
  if (!isUuid(body.sia_id) && !isUuid(body.secop_id)) return NextResponse.json({ error: 'sia_id o secop_id es requerido' }, { status: 400 })
  return responder('descartar', () =>
    descartarDetectado(getSupabaseAdmin(), { siaId: isUuid(body.sia_id) ? body.sia_id : null, secopId: isUuid(body.secop_id) ? body.secop_id : null, motivo: String(body.motivo ?? '') }, auth.user.id)
  )
}
