// POST /api/terceros/cuentas/buscar (terceros:view) — la lista de cuentas con los filtros en el CUERPO:
// { q?, clase?, cliente?, municipio?, activo?, page? } → la misma respuesta que GET /api/terceros/cuentas
// ({ items, total, page }). La usa la interfaz para que lo que se escribe en el buscador (un nombre, un NIT o, con
// terceros:manage, la cédula de una persona) no quede en la URL ni en los logs de peticiones. Solo aquí, y solo con
// terceros:manage, un número busca también la identificación de una persona (CC, CE, PA, otro).
// Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { busquedaCuentasSchema } from '@/lib/terceros-schemas'
import { listarCuentas } from '../../_lib/listas'
import { errorInterno } from '../../_lib/terceros-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const parsed = busquedaCuentasSchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

  try {
    return NextResponse.json(await listarCuentas(auth.user, parsed.data, { buscarDocumentos: true }))
  } catch (error) {
    return errorInterno('POST /api/terceros/cuentas/buscar', error, 'Error al cargar las cuentas')
  }
}
