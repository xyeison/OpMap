import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { importablesDeHospital } from '../_lib/sia-server'
import { responder } from '../_lib/responder'

// GET /api/sia/importables?hospital_id= — contratos de SIA y SECOP de la IPS (24 meses) que aún no están en Contratos,
// para el botón "Importar desde SIA / SECOP" del formulario. contracts:edit.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response
  const hospitalId = request.nextUrl.searchParams.get('hospital_id')
  if (!isUuid(hospitalId)) return NextResponse.json({ error: 'hospital_id es requerido' }, { status: 400 })
  return responder('importables', () => importablesDeHospital(getSupabaseAdmin(), hospitalId))
}
