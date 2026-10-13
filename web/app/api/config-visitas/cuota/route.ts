// GET /api/config-visitas/cuota?executive_id=&mes=AAAA-MM (visits:config o daysoff:approve) — la cuota del mes de un
// Ejecutivo Comercial, igual que /api/me/cuota pero para cualquier persona (vista previa en /configuracion →
// Personas). Sin mes: el mes de hoy. 404 si la persona no existe. Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { mesSchema } from '@/lib/visits-config-schemas'
import { mesDe } from '@/lib/visits-rules'
import {
  UUID_RE,
  calcularCuota,
  cargarPersona,
  errorVisitas,
  hoyActual,
  requireAlgunPermiso,
} from '../_lib/visitas-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAlgunPermiso(request, ['visits:config', 'daysoff:approve'])
  if (!auth.ok) return auth.response

  const parametros = request.nextUrl.searchParams
  const executiveId = (parametros.get('executive_id') ?? '').trim().toLowerCase()
  if (!UUID_RE.test(executiveId)) return jsonError('Elige el Ejecutivo Comercial', 400)
  const hoy = hoyActual()
  const mesTexto = parametros.get('mes')
  const mes = mesSchema.safeParse(mesTexto && mesTexto.trim() ? mesTexto : mesDe(hoy))
  if (!mes.success) return jsonError(zodMessage(mes.error), 400)

  try {
    const persona = await cargarPersona(executiveId)
    if (!persona) return jsonError('Ejecutivo Comercial no encontrado', 404)
    return NextResponse.json(await calcularCuota(persona, mes.data, hoy), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorVisitas('GET /api/config-visitas/cuota', error, 'Error al calcular la cuota')
  }
}
