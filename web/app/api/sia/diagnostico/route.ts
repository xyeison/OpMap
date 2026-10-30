import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { SIA_BASE_URL } from '@/lib/sia-observa/normalizar'
import { userAgentSia } from '@/lib/sia-observa/client'

// GET /api/sia/diagnostico — ¿SIA Observa responde desde Vercel? (punto 3.7.2 de docs/specs/2026-10-29-agente-sia-observa.md).
// UNA petición a la página de inicio, 15 s como máximo. Desde EE. UU. se espera que no (el portal corta conexiones de fuera de
// Colombia); si algún día responde, la carga podría correr en un cron. Solo admin (fuentes:manage).
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'fuentes:manage')
  if (!auth.ok) return auth.response
  const inicio = Date.now()
  try {
    const res = await fetch(`${SIA_BASE_URL}/Login.aspx?redirect=Inicio`, { headers: { 'User-Agent': userAgentSia() }, cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    return NextResponse.json({ responde: true, status: res.status, ms: Date.now() - inicio, region: process.env.VERCEL_REGION ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const causa = (error as { cause?: { code?: string } }).cause?.code ?? (error as Error).name
    return NextResponse.json({ responde: false, detalle: causa, ms: Date.now() - inicio, region: process.env.VERCEL_REGION ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
