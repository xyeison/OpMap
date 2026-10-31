// GET /api/empresas: las empresas activas, por código, como { id, codigo, nombre_corto } (capa 1 de empresas,
// docs/specs/2026-10-31-empresas-papeles-y-asignaciones.md). Basta con tener sesión. Sin la 0960 (la tabla no existe,
// previews de Vercel) responde { empresas: [] } y no 500.
import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/require-role'
import { empresaMovil, listarEmpresas } from '@/lib/empresas'
import type { EmpresaMovil } from '@/lib/reporte-visitas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const empresas: EmpresaMovil[] = (await listarEmpresas()).map(empresaMovil)
    return NextResponse.json({ empresas }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/empresas:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
