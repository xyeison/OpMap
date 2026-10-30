import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/app/api/_lib/api-error'
import { siaFecha } from '@/lib/sia-observa/normalizar'
import { detectados } from '../_lib/sia-server'
import { responder } from '../_lib/responder'

// GET /api/sia/detectados?linea=&kam_id=&desde=&hasta= — bandeja /contracts/detectados: contratos de SIA y SECOP de las
// líneas que aún no están en Contratos (sin descartados). contracts:edit.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response
  const p = request.nextUrl.searchParams
  const linea = p.get('linea')
  const kamId = p.get('kam_id')
  return responder('detectados', () =>
    detectados(getSupabaseAdmin(), {
      linea: linea && /^[a-z_]{3,30}$/.test(linea) ? linea : null,
      kamId: isUuid(kamId) ? kamId : null,
      desde: siaFecha(p.get('desde')),
      hasta: siaFecha(p.get('hasta')),
    })
  )
}
