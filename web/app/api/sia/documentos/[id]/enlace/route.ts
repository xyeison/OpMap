import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { enlaceDocumento } from '../../../_lib/sia-server'
import { responder } from '../../../_lib/responder'

// POST /api/sia/documentos/[id]/enlace — enlace firmado de 10 minutos al PDF copiado en el bucket privado contratos-sia.
// Solo documentos con estado descargado (los demás se abren en SIA). contracts:view.
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  return responder('enlace', () => enlaceDocumento(getSupabaseAdmin(), params.id))
}
