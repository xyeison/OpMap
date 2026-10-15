import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { resolveUserLines } from '@/lib/coverage'
import type { MeLinesResponse } from '@/lib/types/coverage'
import { medirRuta } from '../_lib/tiempos'

// GET /api/me/lines — líneas de negocio que el usuario puede ver en el mapa y en /lines.
//  - admin, commercial_director, data_manager, viewer (map:all-lines) → todas, role 'all', canSeeAll.
//  - líder de línea → las que lidera (role 'leader').
//  - ejecutiva enlazada a su usuario → sus líneas (role 'executive'). Se unen con las anteriores.
// Tiempos (spec 2026-10-15): Server-Timing (auth, lineas, total) y la línea [tiempos] sin contenido (_lib/tiempos.ts).
export async function GET(request: NextRequest) {
  return medirRuta('GET /api/me/lines', async t => {
    const auth = await t.fase('auth', () => requireUser(request))
    if (!auth.ok) return auth.response

    try {
      const body: MeLinesResponse = await t.fase('lineas', () => resolveUserLines(auth.user))
      return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('Error en GET /api/me/lines:', error)
      return jsonError('Error al cargar tus líneas', 500)
    }
  })
}
