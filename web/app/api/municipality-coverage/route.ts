import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { getMunicipalityCoverageCached, type MunicipalityCoverageResponse } from '@/lib/municipality-coverage'

export const dynamic = 'force-dynamic'

// GET /api/municipality-coverage — todos los municipios con su zona (Fase 2b):
//   kind 'ips' (con IPS objetivo: hay que visitar), 'reach' (de alcance por carretera, sin IPS hoy),
//   'out_of_reach' (la más cercana supera su tope), 'no_road' (sin acceso terrestre) o 'pending'.
// Lee municipality_zone (cacheado 60 s en memoria). Nunca llama a Google Maps.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    // computed_at = null → municipality_zone aún vacía o sin migración: filas calculadas en memoria
    // (con IPS + lo que haya en caché; el resto 'pending'), sin guardar.
    const { rows, computed_at }: MunicipalityCoverageResponse = await getMunicipalityCoverageCached()
    return NextResponse.json({ rows, computed_at }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/municipality-coverage:', error)
    return jsonError('Error al cargar los municipios', 500)
  }
}
