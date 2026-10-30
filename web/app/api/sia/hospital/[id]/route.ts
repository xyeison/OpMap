import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { contratosDeHospital } from '../../_lib/sia-server'
import { responder } from '../../_lib/responder'

// GET /api/sia/hospital/[id] — contratos de SIA Observa del NIT de la IPS (tarjeta "Contratos SIA" de la ficha). contracts:view.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'IPS no encontrada' }, { status: 404 })
  return responder('hospital', () => contratosDeHospital(getSupabaseAdmin(), params.id))
}
