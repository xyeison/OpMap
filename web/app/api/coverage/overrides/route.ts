import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import {
  canEditCoverageLine,
  coverageOverrideSchema,
  joinNamesEs,
  overrideBlockingResidents,
  recomputeAndSaveCoverage,
} from '@/lib/coverage'
import { zoneDisplayName } from '@/lib/zone-names'
import type { CoverageOverrideResponse, CoverageOverrideRow } from '@/lib/types/coverage'

const OVERRIDE_COLUMNS = 'id, line_id, kam_id, executive_id, reason, active'

type OverrideSelect = Pick<CoverageOverrideRow, 'id' | 'line_id' | 'kam_id' | 'executive_id' | 'reason' | 'active'>

// POST /api/coverage/overrides — ajuste manual de cobertura: (línea, zona) → ejecutiva, con motivo.
// Desactiva el ajuste activo anterior de esa (línea, zona) (queda como historial), guarda el nuevo
// con created_by y recalcula la cobertura. coverage:edit; line_leader solo en la línea que lidera.
// Regla del dueño (2026-10-11): solo se puede forzar a un Ejecutivo Comercial de otra ciudad cuando
// en la zona no hay nadie (activo o por contratar) con esa línea → 409. Si vive en la zona, se permite
// (sirve para resolver un conflicto entre residentes). El motor (lib/coverage.ts) aplica lo mismo.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'coverage:edit')
  if (!auth.ok) return auth.response
  const user = auth.user

  try {
    const parsed = coverageOverrideSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    if (!(await canEditCoverageLine(user, input.line_id))) {
      return jsonError('Solo puedes ajustar la cobertura de la línea que lideras', 403)
    }

    // Línea activa
    const { data: lineData, error: lineError } = await supabaseAdmin
      .from('business_lines')
      .select('id, name, active')
      .eq('id', input.line_id)
      .limit(1)
    if (lineError) throw lineError
    const line = lineData && lineData.length > 0 ? (lineData[0] as { id: string; name: string; active: boolean }) : null
    if (!line) return jsonError('Línea no encontrada', 404)
    if (!line.active) return jsonError('La línea está inactiva', 400)

    // Zona activa
    const { data: kamData, error: kamError } = await supabaseAdmin
      .from('kams')
      .select('id, name, active')
      .eq('id', input.kam_id)
      .limit(1)
    if (kamError) throw kamError
    const kam = kamData && kamData.length > 0 ? (kamData[0] as { id: string; name: string | null; active: boolean | null }) : null
    if (!kam) return jsonError('La zona no existe', 400)
    if (kam.active !== true) return jsonError('La zona está inactiva', 400)

    // Ejecutiva activa (o por contratar) que lleve la línea
    const { data: executiveData, error: executiveError } = await supabaseAdmin
      .from('executives')
      .select('id, status, base_kam_id')
      .eq('id', input.executive_id)
      .limit(1)
    if (executiveError) throw executiveError
    const executive = executiveData && executiveData.length > 0
      ? (executiveData[0] as { id: string; status: string; base_kam_id: string | null })
      : null
    if (!executive) return jsonError('El Ejecutivo Comercial no existe', 400)
    if (executive.status !== 'active' && executive.status !== 'placeholder') {
      return jsonError('El Ejecutivo Comercial está inactivo', 400)
    }
    if (!executive.base_kam_id) return jsonError('El Ejecutivo Comercial no tiene zona base', 400)

    const { data: linkData, error: linkError } = await supabaseAdmin
      .from('executive_lines')
      .select('line_id')
      .eq('executive_id', executive.id)
      .eq('line_id', input.line_id)
      .limit(1)
    if (linkError) throw linkError
    if (!linkData || linkData.length === 0) {
      return jsonError('El Ejecutivo Comercial no lleva esta línea; asígnasela primero en Ejecutivos Comerciales', 400)
    }

    // Regla del dueño: alguien de otra ciudad solo se fuerza si en la zona nadie lleva la línea
    if (executive.base_kam_id !== input.kam_id) {
      const { data: residentData, error: residentError } = await supabaseAdmin
        .from('executives')
        .select('id, full_name, base_kam_id')
        .eq('base_kam_id', input.kam_id)
        .in('status', ['active', 'placeholder'])
      if (residentError) throw residentError
      const residents = (residentData || []) as Array<{ id: string; full_name: string; base_kam_id: string | null }>

      let residentsWithLine: typeof residents = []
      if (residents.length > 0) {
        const { data: residentLinks, error: residentLinksError } = await supabaseAdmin
          .from('executive_lines')
          .select('executive_id')
          .eq('line_id', input.line_id)
          .in('executive_id', residents.map(resident => resident.id))
        if (residentLinksError) throw residentLinksError
        const withLine = new Set((residentLinks || []).map(row => row.executive_id as string))
        residentsWithLine = residents.filter(resident => withLine.has(resident.id))
      }

      const blockers = overrideBlockingResidents(executive, input.kam_id, residentsWithLine)
      if (blockers.length > 0) {
        const zoneName = zoneDisplayName(kam.name) || 'La zona'
        return jsonError(
          `No se puede forzar: ${zoneName} ya tiene a ${joinNamesEs(blockers.map(resident => resident.full_name))} ` +
            `con la línea ${line.name}. Solo se puede forzar a un Ejecutivo Comercial de otra ciudad cuando en la ` +
            'zona no hay nadie con esa línea.',
          409
        )
      }
    }

    // Ajuste activo anterior de (línea, zona): se desactiva antes de insertar (índice único parcial)
    const { data: previousData, error: previousError } = await supabaseAdmin
      .from('coverage_overrides')
      .select('id')
      .eq('line_id', input.line_id)
      .eq('kam_id', input.kam_id)
      .eq('active', true)
    if (previousError) throw previousError
    const previousIds = (previousData || []).map(row => row.id as string)

    if (previousIds.length > 0) {
      const { error: deactivateError } = await supabaseAdmin
        .from('coverage_overrides')
        .update({ active: false })
        .in('id', previousIds)
        .select('id')
      if (deactivateError) {
        console.error('Error desactivando el ajuste anterior:', deactivateError)
        return jsonError('Error al guardar el ajuste manual', 500)
      }
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('coverage_overrides')
      .insert({
        line_id: input.line_id,
        kam_id: input.kam_id,
        executive_id: input.executive_id,
        reason: input.reason,
        created_by: user.id,
        active: true,
      })
      .select(OVERRIDE_COLUMNS)

    const created = inserted && inserted.length > 0 ? (inserted[0] as OverrideSelect) : null
    if (insertError || !created) {
      // Devolver a su estado el ajuste anterior para no dejar la zona sin su asignación manual
      if (previousIds.length > 0) {
        const { error: restoreError } = await supabaseAdmin
          .from('coverage_overrides')
          .update({ active: true })
          .in('id', previousIds.slice(-1))
          .select('id')
        if (restoreError) console.error('Error restaurando el ajuste anterior:', restoreError)
      }
      if (insertError?.code === '23505') {
        return jsonError('Otro ajuste para esta zona se guardó al mismo tiempo; recarga e inténtalo de nuevo', 409)
      }
      if (insertError?.code === '23503') return jsonError('La línea, la zona o el Ejecutivo Comercial no existe', 400)
      console.error('Error creando el ajuste manual:', insertError || 'insert sin fila devuelta')
      return jsonError('Error al guardar el ajuste manual', 500)
    }

    let rows: number
    try {
      rows = (await recomputeAndSaveCoverage()).rows
    } catch (recomputeError) {
      console.error('Ajuste guardado pero falló el recálculo de cobertura:', recomputeError)
      return jsonError('El ajuste se guardó, pero no se pudo recalcular la cobertura. Usa "Recalcular cobertura".', 500)
    }

    const body: CoverageOverrideResponse = { override: created, rows }
    return NextResponse.json(body, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/coverage/overrides:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
