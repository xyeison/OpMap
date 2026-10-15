// POST /api/me/dias-libres/[id]/anular (visits:report) — la ejecutiva anula SU día libre: en 'por_aprobar' siempre;
// en 'registrado' o 'aprobado' solo si la fecha es hoy o después (ejecutivaPuedeAnular, lógica pura). Queda
// motivo_revision = 'Anulado por la ejecutiva'. El día de otra persona responde 404. 200 { dia }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
// Tiempos (spec 2026-10-15): Server-Timing (auth, db, total) y la línea [tiempos] sin contenido (me/_lib/tiempos.ts).
import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  MOTIVO_ANULADO_POR_EJECUTIVA,
  ejecutivaPuedeAnular,
  etiquetaEstadoDiaLibre,
  hoyBogota,
  type DiaLibre,
} from '@/lib/visits-rules'
import {
  COLUMNAS_DIA_LIBRE,
  ahora,
  armarDiasLibres,
  errorVisitas,
  idDeRuta,
  leerGeneral,
  requireEjecutiva,
  respuestaErrorBase,
} from '../../../../config-visitas/_lib/visitas-server'
import { medirRuta } from '../../../_lib/tiempos'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  return medirRuta('POST /api/me/dias-libres/:id/anular', async t => {
    const auth = await t.fase('auth', () => requireEjecutiva(request, 'POST /api/me/dias-libres/[id]/anular'))
    if (!auth.ok) return auth.response
    const { persona } = auth

    const id = idDeRuta(params.id)
    if (!id) return jsonError('ID de día libre no válido', 400)

    try {
      const { data: actualData, error: actualError } = await t.fase('db', () =>
        supabaseAdmin.from('dias_libres').select(COLUMNAS_DIA_LIBRE).eq('id', id).eq('executive_id', persona.id).limit(1)
      )
      if (actualError) throw actualError
      const actual = actualData && actualData.length > 0 ? (actualData[0] as unknown as DiaLibre) : null
      if (!actual) return jsonError('Día libre no encontrado', 404)

      const instante = ahora()
      const hoy = hoyBogota(instante)
      if (actual.estado === 'rechazado' || actual.estado === 'anulado') {
        return jsonError(`Ese día libre ya está ${etiquetaEstadoDiaLibre(actual.estado).toLowerCase()}`, 409)
      }
      if (!ejecutivaPuedeAnular(actual, hoy)) {
        return jsonError(
          `Solo puedes anular un día ${etiquetaEstadoDiaLibre(actual.estado).toLowerCase()} si es de hoy en adelante; pide a quien aprueba que lo anule`,
          400
        )
      }

      const { data, error } = await t.fase('db', () =>
        supabaseAdmin
          .from('dias_libres')
          .update({
            estado: 'anulado',
            revisado_por: auth.user.id,
            revisado_at: instante.toISOString(),
            motivo_revision: MOTIVO_ANULADO_POR_EJECUTIVA,
          })
          .eq('id', id)
          .eq('executive_id', persona.id)
          .eq('estado', actual.estado)
          .select(COLUMNAS_DIA_LIBRE)
      )
      if (error) {
        const traducido = respuestaErrorBase(error, 'No se pudo anular el día libre')
        if (traducido) return traducido
        throw error
      }
      const fila = (data || [])[0] as unknown as DiaLibre | undefined
      if (!fila) return jsonError('El día libre cambió mientras tanto: vuelve a cargar la lista', 409)

      const [dia] = await t.fase('db', async () => armarDiasLibres([fila], await leerGeneral(), hoy, new Map([[persona.id, persona]])))
      return NextResponse.json({ dia })
    } catch (error) {
      return errorVisitas('POST /api/me/dias-libres/[id]/anular', error, 'Error al anular el día libre')
    }
  })
}
