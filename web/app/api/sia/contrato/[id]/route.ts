import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { siaDeHospitalContract } from '../../_lib/sia-server'
import { responder } from '../../_lib/responder'

// GET /api/sia/contrato/[id] — para un contrato de Contratos (hospital_contracts.id): su contrato de SIA, los documentos
// con su estado, la última lectura de la IA y las diferencias para aprobar. contracts:view.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
  return responder('contrato', () => siaDeHospitalContract(getSupabaseAdmin(), params.id))
}
