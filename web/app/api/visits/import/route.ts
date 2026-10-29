import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { hoyBogota } from '@/lib/visits-rules'
import { readJsonBody, serverError } from '../../_lib/api-error'
import { importarVisitasVmo } from '../_lib/importar-vmo'

export const runtime = 'nodejs'
export const maxDuration = 60

// Importación de visitas de VMO para el mapa de calor (puente temporal, dueño 2026-10-29,
// docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md): la página /visits lee el Excel de VMO › Visitas en el
// navegador y manda por lotes solo las visitas efectivas con coordenadas (lib/vmo-visitas.ts). Servidor con
// service_role. Permiso: visits:manage (admin, data_manager).
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response

  try {
    return await importarVisitasVmo(await readJsonBody(request), auth.user.id, hoyBogota())
  } catch (error) {
    return serverError('visits/import POST', error, 'Error al importar las visitas de VMO')
  }
}
