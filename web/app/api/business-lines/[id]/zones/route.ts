import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE, lineZonesSchema } from '@/lib/fase1-schemas'
import type { LineZone, LineZoneRow, LineZonesResponse } from '@/lib/types/lines'
import { lineExists } from '../../_lib/line-shared'
import { hasPermission } from '@/lib/permissions'
import { isLineLeader } from '@/lib/coverage'

type Params = { params: { id: string } }

// PUT /api/business-lines/[id]/zones — reemplaza la matriz de zonas de la línea.
// Cada zona del cuerpo queda con su has_equipment; las zonas que no vengan se quitan de la línea.
// Orden: primero upsert y luego borrado de las sobrantes, para que la línea nunca quede vacía
// a mitad de la operación si algo falla.
// Fase 2: line_leader (lines:edit sin map:all-lines) solo edita la matriz de la línea que lidera.
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'lines:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de línea no válido', 400)
  const lineId = params.id.toLowerCase()

  try {
    const parsed = lineZonesSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const zones = parsed.data.zones

    if (!(await lineExists(lineId))) {
      return jsonError('Línea no encontrada', 404)
    }

    if (!hasPermission(auth.user.role, 'map:all-lines') && !(await isLineLeader(auth.user, lineId))) {
      return jsonError('Solo puedes editar la línea que lideras', 403)
    }

    const kamIds = zones.map(zone => zone.kam_id)

    // Todas las zonas deben existir (cada fila de kams es una zona)
    if (kamIds.length > 0) {
      const { data: kams, error: kamsError } = await supabaseAdmin.from('kams').select('id').in('id', kamIds)
      if (kamsError) throw kamsError
      if ((kams || []).length !== kamIds.length) {
        return jsonError('Alguna de las zonas indicadas no existe', 400)
      }

      const rows: LineZoneRow[] = zones.map(zone => ({
        line_id: lineId,
        kam_id: zone.kam_id,
        has_equipment: zone.has_equipment,
      }))
      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from('line_zones')
        .upsert(rows, { onConflict: 'line_id,kam_id' })
        .select('kam_id')

      if (upsertError) {
        if (upsertError.code === '23503') {
          return jsonError('Alguna de las zonas indicadas no existe', 400)
        }
        console.error('Error guardando zonas de la línea:', upsertError)
        return jsonError('Error al guardar las zonas de la línea', 500)
      }
      if (!upserted || upserted.length !== rows.length) {
        console.error('Upsert de line_zones incompleto', { esperadas: rows.length, guardadas: upserted?.length ?? 0 })
        return jsonError('Error al guardar las zonas de la línea', 500)
      }
    }

    // Quitar las zonas que ya no están en la matriz (los ids van validados como UUID)
    let deleteQuery = supabaseAdmin.from('line_zones').delete().eq('line_id', lineId)
    if (kamIds.length > 0) {
      deleteQuery = deleteQuery.not('kam_id', 'in', `(${kamIds.join(',')})`)
    }
    const { error: deleteError } = await deleteQuery.select('kam_id')
    if (deleteError) {
      console.error('Error quitando zonas de la línea:', deleteError)
      return jsonError('Error al guardar las zonas de la línea', 500)
    }

    // Devolver el estado final leído de la BD
    const { data: finalData, error: finalError } = await supabaseAdmin
      .from('line_zones')
      .select('kam_id, has_equipment')
      .eq('line_id', lineId)
      .order('kam_id', { ascending: true })
      .range(0, 9999)
    if (finalError) throw finalError

    const body: LineZonesResponse = { zones: (finalData || []) as LineZone[] }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en PUT /api/business-lines/[id]/zones:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
