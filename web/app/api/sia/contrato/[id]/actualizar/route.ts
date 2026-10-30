import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { pedirActualizacion } from '../../../_lib/sia-server'
import { responder } from '../../../_lib/responder'

// POST /api/sia/contrato/[id]/actualizar — "Actualizar desde SIA": marca el contrato para que la próxima carga del equipo
// del dueño relea su ficha (Vercel no llega a SIA). No cambia el contrato. contracts:edit.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
  return responder('actualizar', () => pedirActualizacion(getSupabaseAdmin(), params.id))
}
