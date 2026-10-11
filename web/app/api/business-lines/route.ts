import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import type { BusinessLinesResponse } from '@/lib/types/lines'
import { loadBusinessLines } from './_lib/line-shared'

// GET /api/business-lines — líneas de negocio (activas e inactivas) con líder y matriz de zonas.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'lines:view')
  if (!auth.ok) return auth.response

  try {
    const lines = await loadBusinessLines()
    const body: BusinessLinesResponse = { lines }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en GET /api/business-lines:', error)
    return jsonError('Error al cargar las líneas de negocio', 500)
  }
}
