// GET /api/terceros/subtipos (terceros:view) — subtipos de visita institucional VIGENTES hoy (hora de Colombia):
// vigente_desde <= hoy y (vigente_hasta nulo o >= hoy), por orden. Un subtipo se apaga cerrando su rango, nunca
// se borra. Contrato: docs/fases/fase6-visitas-f1-terceros.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { SubtipoRow } from '@/lib/terceros'
import { errorInterno, hoyEnBogota } from '../_lib/terceros-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  try {
    const { data, error } = await supabaseAdmin
      .from('subtipos_institucionales')
      .select('id, codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta')
      .order('orden', { ascending: true })
      .order('codigo', { ascending: true })
      .range(0, 999)
    if (error) throw error
    const hoy = hoyEnBogota()
    const items = ((data || []) as SubtipoRow[]).filter(
      subtipo => subtipo.vigente_desde <= hoy && (subtipo.vigente_hasta === null || subtipo.vigente_hasta >= hoy)
    )
    return NextResponse.json({ items })
  } catch (error) {
    return errorInterno('GET /api/terceros/subtipos', error, 'Error al cargar los subtipos')
  }
}
