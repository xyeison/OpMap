import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { CORREDORES, gruposPorDefecto, DEFAULT_BOGOTA_K, DEFAULT_BOGOTA_MAX_TRAVEL_MINUTES, type Corredor } from '@/lib/bogota-corredores'
import { validateBogotaConfigInput } from '@/lib/bogota-admin'
import { badJson, readJsonBody, serverError } from '../../_lib/api-error'
import { loadBogotaCells, readBogotaConfig } from '../../_lib/bogota-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/kams/bogota-config — configuración "Bogotá hacia afuera" (k celdas, celda por corredor,
// tope único), las celdas activas de Bogotá y cuántos departamentos/municipios tiene cada corredor.
// Solo admin (permiso kams:bogota-config).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:bogota-config')
  if (!auth.ok) return auth.response

  try {
    const [saved, cells, corredoresRes] = await Promise.all([
      readBogotaConfig(),
      loadBogotaCells(),
      supabaseAdmin.from('bogota_corredores').select('municipality_code, corredor').range(0, 4999),
    ])
    if (corredoresRes.error) throw corredoresRes.error

    const resumenCorredores = Object.fromEntries(
      CORREDORES.map(c => [c, { departamentos: 0, municipios: 0 }])
    ) as Record<Corredor, { departamentos: number; municipios: number }>
    for (const row of corredoresRes.data || []) {
      const entry = resumenCorredores[row.corredor as Corredor]
      if (!entry) continue
      if (row.municipality_code) entry.municipios++
      else entry.departamentos++
    }

    let updatedByName: string | null = null
    if (saved?.updated_by) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('full_name, email')
        .eq('id', saved.updated_by)
        .maybeSingle()
      updatedByName = user?.full_name || user?.email || null
    }

    return NextResponse.json({
      config: saved?.config ?? null,
      updated_at: saved?.updated_at ?? null,
      updated_by_name: updatedByName,
      // Configuración inicial aprobada (k = 4: Norte → Chapinero, Occidente → Engativá, Sur → Kennedy,
      // Oriente → San Cristóbal), por si la fila no existe todavía
      por_defecto: {
        k: DEFAULT_BOGOTA_K,
        max_travel_minutes: DEFAULT_BOGOTA_MAX_TRAVEL_MINUTES,
        grupos: gruposPorDefecto(DEFAULT_BOGOTA_K, cells),
      },
      celdas: cells,
      corredores: resumenCorredores,
    })
  } catch (error) {
    return serverError('kams/bogota-config GET', error, 'Error al cargar la configuración de Bogotá')
  }
}

// PUT /api/kams/bogota-config — body { k, max_travel_minutes, grupos }. Valida k (1-4), el tope (60-600
// min) y que cada corredor apunte a una celda ACTIVA de Bogotá con la agrupación de k. NO recalcula:
// los cambios aplican al próximo recálculo de asignaciones.
export async function PUT(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:bogota-config')
  if (!auth.ok) return auth.response

  const body = await readJsonBody(request)
  if (body === undefined) return badJson()

  try {
    const cells = await loadBogotaCells()
    const validation = validateBogotaConfigInput(body, new Set(cells.map(c => c.id)))
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors.join(' '), errors: validation.errors }, { status: 400 })
    }
    const { k, max_travel_minutes, grupos } = validation.value

    const { data, error } = await supabaseAdmin
      .from('bogota_config')
      .upsert(
        { id: 1, k, max_travel_minutes, grupos, updated_by: auth.user.id, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select('k, max_travel_minutes, grupos, updated_at')
      .single()
    if (error) throw error

    return NextResponse.json({
      success: true,
      config: { k: data.k, max_travel_minutes: data.max_travel_minutes, grupos: data.grupos },
      updated_at: data.updated_at,
      recalculated: false,
      message: 'Configuración de Bogotá guardada. Los cambios aplican al próximo recálculo de asignaciones.',
    })
  } catch (error) {
    return serverError('kams/bogota-config PUT', error, 'Error al guardar la configuración de Bogotá')
  }
}
