// GET /api/equipo/personas (team:view): las personas que ve quien pregunta (dirección y administrador: todas; una líder:
// ella y los Ejecutivos Comerciales de sus líneas, a Paola solo como Ejecutiva) y el catálogo de líneas para el filtro.
// Spec: docs/specs/2026-10-31-equipo-en-la-app-y-ejecutivos-de-vuelta.md (Entrega 2).
import { NextRequest, NextResponse } from 'next/server'
import type { EquipoPersonasResponse } from '@/lib/reporte-visitas'
import { personaItem, requireEquipo } from '../_lib/equipo-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireEquipo(request, 'GET /api/equipo/personas')
  if (!auth.ok) return auth.response
  const { alcance, lineas } = auth.contexto
  const respuesta: EquipoPersonasResponse = {
    personas: alcance.personas.map(p => personaItem(p, alcance, lineas)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
    lineas: [...lineas.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
  }
  return NextResponse.json(respuesta, { headers: { 'Cache-Control': 'no-store' } })
}
