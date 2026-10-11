import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { LINE_CODE_RE, findAccessibleLine, loadCoverageResponse } from '@/lib/coverage'
import type { CoverageResponse } from '@/lib/types/coverage'

// GET /api/coverage?line=<code> — cobertura de una línea: por cada zona activa, quién la cubre
// (local / alcance / ajuste manual / vacante / conflicto), minutos, equipo y nota.
// 403 si la línea no está entre las de GET /api/me/lines del usuario (o no existe).
export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  const code = (request.nextUrl.searchParams.get('line') || '').trim().toLowerCase()
  if (!code) return jsonError('Falta el parámetro line (código de la línea)', 400)
  if (!LINE_CODE_RE.test(code)) return jsonError('Código de línea no válido', 400)

  try {
    const access = await findAccessibleLine(auth.user, code)
    if (!access) return jsonError('No tienes acceso a esta línea', 403)

    const body: CoverageResponse = await loadCoverageResponse(access.line)
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/coverage:', error)
    return jsonError('Error al cargar la cobertura', 500)
  }
}
