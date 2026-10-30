import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'
import { leerHistoricoTracker } from '../_lib/historico-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Histórico del Excel "Tracker Líderes" (dueño, 2026-10-29, docs/decisiones/2026-10-29-historico-tracker-lideres.md).
// GET: la última carga y sus filas, para /lideres. Permiso lideres:seguimiento (admin y dirección comercial).
// Sin POST desde el 2026-10-30 (dueño): el Excel ya no se sube desde la página; el histórico se carga una sola vez con
// scripts/lideres-historico-cargar.ts (procesarCargaTracker de ../_lib/historico-server.ts) y lo nuevo las líderes lo
// planean y lo reportan en la app.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'lideres:seguimiento')
  if (!auth.ok) return auth.response
  try {
    return await leerHistoricoTracker()
  } catch (error) {
    return serverError('lideres/historico GET', error, 'Error al leer el histórico de las líderes')
  }
}
