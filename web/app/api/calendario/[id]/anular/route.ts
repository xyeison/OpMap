// POST /api/calendario/[id]/anular (calendar:manage) — { motivo } anula un día del calendario (festivo nacional,
// de empresa o de ciudad). Nunca se borra: queda con quién, cuándo y por qué; anular libera la fecha para poner
// otro día. 404 si no existe; 409 si ya estaba anulado; 400 sin motivo (5 caracteres o más). 200 { dia }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { anularSchema } from '@/lib/visits-config-schemas'
import type { CalendarioDia, CalendarioDiaItem } from '@/lib/visits-rules'
import {
  COLUMNAS_CALENDARIO,
  ahora,
  errorVisitas,
  idDeRuta,
  nombresMunicipios,
  respuestaErrorBase,
} from '../../../config-visitas/_lib/visitas-server'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'calendar:manage')
  if (!auth.ok) return auth.response

  const id = idDeRuta(params.id)
  if (!id) return jsonError('ID de día no válido', 400)

  try {
    const parsed = anularSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('calendario')
      .select('id, anulado_at')
      .eq('id', id)
      .limit(1)
    if (actualError) throw actualError
    const actual = actualData && actualData.length > 0 ? (actualData[0] as { id: string; anulado_at: string | null }) : null
    if (!actual) return jsonError('Día del calendario no encontrado', 404)
    if (actual.anulado_at) return jsonError('Ese día del calendario ya estaba anulado', 409)

    const { data, error } = await supabaseAdmin
      .from('calendario')
      .update({ anulado_at: ahora().toISOString(), anulado_por: auth.user.id, anulado_motivo: parsed.data.motivo })
      .eq('id', id)
      .is('anulado_at', null)
      .select(COLUMNAS_CALENDARIO)
    if (error) {
      const traducido = respuestaErrorBase(error, 'No se pudo anular ese día')
      if (traducido) return traducido
      throw error
    }
    const dia = (data || [])[0] as unknown as CalendarioDia | undefined
    if (!dia) return jsonError('Ese día del calendario ya estaba anulado', 409)

    const ciudades = await nombresMunicipios([dia.municipality_id])
    const item: CalendarioDiaItem = {
      id: dia.id,
      fecha: dia.fecha,
      alcance: dia.alcance,
      municipality_id: dia.municipality_id,
      ciudad: dia.municipality_id ? ciudades.get(dia.municipality_id) ?? dia.municipality_id : null,
      tipo: dia.tipo,
      nombre: dia.nombre,
      origen: dia.origen,
      anulado_at: dia.anulado_at,
    }
    return NextResponse.json({ dia: item })
  } catch (error) {
    return errorVisitas('POST /api/calendario/[id]/anular', error, 'Error al anular el día del calendario')
  }
}
