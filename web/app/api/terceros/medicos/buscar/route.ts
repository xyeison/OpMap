// POST /api/terceros/medicos/buscar (terceros:view) — la lista de médicos con los filtros en el CUERPO:
// { q?, municipio?, visitante?: 'me', activo?, page? } → la misma respuesta que GET /api/terceros/medicos
// ({ items, total, page }, nunca con documento). La usa la interfaz para que lo que se escribe en el buscador no
// quede en la URL ni en los logs de peticiones. Solo aquí, y solo con terceros:manage, un texto con dígitos busca el
// documento del médico. Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { busquedaMedicosSchema } from '@/lib/terceros-schemas'
import { listarMedicos } from '../../_lib/listas'
import { errorInterno } from '../../_lib/terceros-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const parsed = busquedaMedicosSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

  try {
    return NextResponse.json(await listarMedicos(auth.user, parsed.data, { buscarDocumentos: true }))
  } catch (error) {
    return errorInterno('POST /api/terceros/medicos/buscar', error, 'Error al cargar los médicos')
  }
}
