// POST /api/calendario/festivos (calendar:manage) — { anio } carga los festivos nacionales de Colombia de ese año
// (Ley 51 de 1983) con la función calendario_cargar_festivos de la base: salta las fechas que ya tienen un día
// nacional, activo o anulado (una corrección de recursos humanos no se revive). 200 { insertados }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { cargarFestivosSchema } from '@/lib/visits-config-schemas'
import type { CargarFestivosResponse } from '@/lib/visits-rules'
import { errorVisitas, respuestaErrorBase } from '../../config-visitas/_lib/visitas-server'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'calendar:manage')
  if (!auth.ok) return auth.response

  try {
    const parsed = cargarFestivosSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    const { data, error } = await supabaseAdmin.rpc('calendario_cargar_festivos', {
      p_anio: parsed.data.anio,
      p_user: auth.user.id,
    })
    if (error) {
      const traducido = respuestaErrorBase(error, 'No se pudieron cargar los festivos de ese año')
      if (traducido) return traducido
      throw error
    }
    const respuesta: CargarFestivosResponse = { insertados: Number(data) || 0 }
    return NextResponse.json(respuesta)
  } catch (error) {
    return errorVisitas('POST /api/calendario/festivos', error, 'Error al cargar los festivos')
  }
}
