import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import {
  MunicipalityTableMissingError,
  recomputeAndSaveMunicipalityZones,
} from '@/lib/municipality-coverage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/municipality-coverage/recompute — recalcula municipality_zone con lo que ya hay en la
// caché municipality_travel_times (equivale a `scripts/fase2b-municipios.ts --assign`).
// NO llama a Google Maps: los pares que falten quedan como 'pending'.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'municipalities:recompute') // solo admin (lib/permissions.ts)
  if (!auth.ok) return auth.response

  try {
    const { rows } = await recomputeAndSaveMunicipalityZones()
    return NextResponse.json({ rows })
  } catch (error) {
    if (error instanceof MunicipalityTableMissingError) {
      console.error('POST /api/municipality-coverage/recompute:', error.message)
      return jsonError('Falta aplicar la migración de municipios (Fase 2b)', 503)
    }
    console.error('Error en POST /api/municipality-coverage/recompute:', error)
    return jsonError('Error al recalcular los municipios', 500)
  }
}
