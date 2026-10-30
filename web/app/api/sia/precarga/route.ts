import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { precargaFormulario } from '../_lib/sia-server'
import { responder } from '../_lib/responder'

// GET /api/sia/precarga?sia_id= | ?secop_id= — datos para precargar /contracts/new/edit (y los indicadores leídos por la
// IA, si hay). No escribe nada: la persona revisa y guarda. contracts:edit.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response
  const siaId = request.nextUrl.searchParams.get('sia_id')
  const secopId = request.nextUrl.searchParams.get('secop_id')
  if (!isUuid(siaId) && !isUuid(secopId)) return NextResponse.json({ error: 'sia_id o secop_id es requerido' }, { status: 400 })
  return responder('precarga', () => precargaFormulario(getSupabaseAdmin(), { siaId: isUuid(siaId) ? siaId : null, secopId: isUuid(secopId) ? secopId : null }))
}
