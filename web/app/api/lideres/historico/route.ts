import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { readJsonBody, serverError } from '../../_lib/api-error'
import { leerHistoricoTracker, procesarCargaTracker } from '../_lib/historico-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Histórico del Excel "Tracker Líderes" (dueño, 2026-10-29, docs/decisiones/2026-10-29-historico-tracker-lideres.md).
// GET: la última carga y sus filas. POST: la página /lideres manda lo que leyó del Excel (sin nombres de médicos ni
// observaciones); { confirmar: false } da la vista previa y { confirmar: true } reemplaza el histórico.
// Permiso lideres:seguimiento (admin y dirección comercial).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'lideres:seguimiento')
  if (!auth.ok) return auth.response
  try {
    return await leerHistoricoTracker()
  } catch (error) {
    return serverError('lideres/historico GET', error, 'Error al leer el histórico de las líderes')
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'lideres:seguimiento')
  if (!auth.ok) return auth.response
  try {
    return await procesarCargaTracker(await readJsonBody(request), auth.user.id)
  } catch (error) {
    return serverError('lideres/historico POST', error, 'Error al procesar el Excel de las líderes')
  }
}
