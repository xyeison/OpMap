import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '@/app/api/_lib/api-error'
import type { FuenteActualizarResponse } from '@/lib/compras-publicas'
import { isMissingRelationError, SECOP_MISSING_MESSAGE } from '@/app/api/secop/_lib/secop-server'
import { FUENTES_CATALOGO } from '../../_lib/catalogo'
import { PRESUPUESTO_MS, runFuenteManual } from '../../_lib/runner'

export const dynamic = 'force-dynamic'
// La ronda dura como máximo PRESUPUESTO_MS (50 s); Vercel la corta a los 60 s.
export const maxDuration = 60

// POST /api/fuentes/[fuente]/actualizar — "Actualizar ahora" del panel Fuentes de datos (solo admin,
// fuentes:manage). Corre UNA ronda de la carga ligera con el mismo código del cron y un presupuesto de
// 50 s; devuelve {ok, terminado, estado, filas, mensaje}. Si terminado=false, la UI vuelve a llamar y la
// carga sigue desde su cursor. Las cargas pesadas (ADRES) no se corren aquí (409).
export async function POST(request: NextRequest, { params }: { params: { fuente: string } }) {
  const auth = await requirePermission(request, 'fuentes:manage')
  if (!auth.ok) return auth.response

  const fuente = String(params?.fuente || '')
  const item = FUENTES_CATALOGO.find(entry => entry.fuente === fuente)
  if (!item) return NextResponse.json({ error: 'Fuente desconocida' }, { status: 404 })
  if (!item.manual) return NextResponse.json({ error: `${item.nombre} es una carga pesada: se corre en GitHub Actions, no desde aquí` }, { status: 409 })

  const started = Date.now()
  try {
    const result = await runFuenteManual(fuente, PRESUPUESTO_MS)
    if (!result) return NextResponse.json({ error: `${item.nombre} aún no tiene carga automática instalada` }, { status: 501 })
    const body: FuenteActualizarResponse = { fuente, ...result, duracionMs: Date.now() - started }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingRelationError(error)) return serverError('fuentes/actualizar POST', error, SECOP_MISSING_MESSAGE, 503)
    return serverError('fuentes/actualizar POST', error, `No se pudo actualizar ${item.nombre}`)
  }
}
