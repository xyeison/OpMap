import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import { mergeFuentes, type FuentesResponse } from '@/lib/compras-publicas'
import { SECOP_MISSING_MESSAGE, isMissingRelationError, loadFuentesEstado } from '@/app/api/secop/_lib/secop-server'
import { FUENTES_CATALOGO } from './_lib/catalogo'

export const dynamic = 'force-dynamic'

// GET /api/fuentes — estado de cada fuente de datos (fuentes_estado + catálogo: frecuencia, cómo se
// actualiza, si admite "Actualizar ahora"). Solo admin (fuentes:manage).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'fuentes:manage')
  if (!auth.ok) return auth.response
  try {
    const estados = await loadFuentesEstado()
    const body: FuentesResponse = {
      fuentes: mergeFuentes(FUENTES_CATALOGO, estados),
      cronConfigurado: Boolean(process.env.CRON_SECRET),
      ahora: new Date().toISOString(),
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('fuentes GET', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('fuentes GET', error, 'Error al cargar el estado de las fuentes')
  }
}
