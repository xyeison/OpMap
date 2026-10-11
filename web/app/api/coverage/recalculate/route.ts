import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { recomputeAndSaveCoverage } from '@/lib/coverage'
import type { CoverageRecalculateResponse } from '@/lib/types/coverage'

// POST /api/coverage/recalculate — recalcula la cobertura de TODAS las líneas y zonas activas.
// Es global, idempotente y barato (solo lee distancias ya guardadas, sin Google Maps), así que se
// permite a todo rol con coverage:edit: admin, commercial_director y line_leader.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'coverage:edit')
  if (!auth.ok) return auth.response

  try {
    const result = await recomputeAndSaveCoverage()
    const body: CoverageRecalculateResponse = { rows: result.rows }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en POST /api/coverage/recalculate:', error)
    return jsonError('Error al recalcular la cobertura', 500)
  }
}
