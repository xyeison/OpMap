import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { annexFileName, buildAnnexCsv, buildTerritory } from '@/lib/territory'
import { readLineAndExecutive } from '../_lib/territory-route'

export const dynamic = 'force-dynamic'

// GET /api/territory/export?line=<code>&executive=<id>&annex=a|b — Anexo A (IPS) o B (municipios)
// en CSV para Excel en español: UTF-8 con BOM, separador ";" y saltos CRLF.
// Mismas reglas de acceso que GET /api/territory.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'territory:view')
  if (!auth.ok) return auth.response

  const annex = (request.nextUrl.searchParams.get('annex') || '').trim().toLowerCase()
  if (annex !== 'a' && annex !== 'b') return jsonError('El parámetro annex debe ser "a" o "b"', 400)

  try {
    const parsed = await readLineAndExecutive(request, auth.user, { requireExecutive: true })
    if (!parsed.ok) return parsed.response

    const territory = await buildTerritory(parsed.access.line.id, parsed.executiveId!)
    if (!territory) return jsonError('El Ejecutivo Comercial no lleva esta línea', 404)

    const csv = buildAnnexCsv(territory, annex)
    const fileName = annexFileName(territory, annex)
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
        'X-Content-Hash': territory.content_hash,
      },
    })
  } catch (error) {
    console.error('Error en GET /api/territory/export:', error)
    return jsonError('Error al exportar el anexo', 500)
  }
}
