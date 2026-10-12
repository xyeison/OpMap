import { NextRequest, NextResponse } from 'next/server'
import { zoneDisplayName } from '@/lib/zone-names'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'

export const runtime = 'nodejs'
export const maxDuration = 60

// Importación mensual de visitas (app/visits). Servidor con service_role (R2-M-04: antes usaba
// el cliente de rutas de @supabase/auth-helpers, que sin sesión de Supabase Auth actúa como anon
// y fallaría con RLS).
// Permiso: visits:manage (admin, data_manager).

const MAX_VISITS_PER_IMPORT = 20000

function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end }
}

// Importador de VMO DESHABILITADO (decisión del dueño 2026-10-12, docs/decisiones/2026-10-12-app-de-visita.md):
// VMO se apaga y las visitas nuevas se reportan desde la app de visita. Además, este importador borra TODAS
// las visitas del mes antes de insertar (sin distinguir fuente) y se llevaría las de la app. Para reactivarlo
// habría que limitar el borrado a source = 'vmo_import' (columna de la migración 0800) y poner esto en true.
const VMO_IMPORT_ENABLED = false

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response
  if (!VMO_IMPORT_ENABLED) {
    return NextResponse.json(
      { error: 'La importación de visitas de VMO está deshabilitada: las visitas nuevas se reportan desde la app de visita.' },
      { status: 410 },
    )
  }
  const user = auth.user

  try {
    const body = (await readJsonBody(request)) as
      | { visits?: unknown; month?: unknown; year?: unknown; filename?: unknown }
      | undefined
    if (!body || typeof body !== 'object') return badJson()

    const month = Number(body.month)
    const year = Number(body.year)
    const filename = typeof body.filename === 'string' ? body.filename.slice(0, 255) : 'importacion'
    const visits = Array.isArray(body.visits) ? (body.visits as any[]) : null

    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: 'Mes o año inválido' }, { status: 400 })
    }
    if (!visits || visits.length === 0) {
      return NextResponse.json({ error: 'No se encontraron visitas para importar' }, { status: 400 })
    }
    if (visits.length > MAX_VISITS_PER_IMPORT) {
      return NextResponse.json({ error: 'Demasiadas visitas en una sola importación' }, { status: 400 })
    }

    // Registro de importación (UNIQUE(month, year))
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('visit_imports')
      .insert({
        filename,
        month,
        year,
        total_records: visits.length,
        successful_records: 0,
        failed_records: 0,
        imported_by: user.id,
      })
      .select()
      .single()

    if (importError) {
      if ((importError as { code?: string }).code === '23505') {
        return NextResponse.json(
          { error: `Ya existe una importación para ${month}/${year}. Elimínela primero.` },
          { status: 400 }
        )
      }
      return serverError('visits/import (registro)', importError, 'Error al crear registro de importación')
    }

    const errors: string[] = []
    let successfulCount = 0
    let failedCount = 0

    // Eliminar visitas previas del mismo mes (huérfanas: no puede existir otra importación del mes)
    const { start, end } = monthRange(year, month)
    const { error: deleteError } = await supabaseAdmin
      .from('visits')
      .delete()
      .gte('visit_date', start)
      .lt('visit_date', end)

    if (deleteError) {
      console.error('visits/import: error borrando visitas previas', deleteError)
    }

    for (const visit of visits) {
      try {
        if (!visit || typeof visit !== 'object' || !visit.visit_date) {
          errors.push(`Visita sin fecha válida para Ejecutivo Comercial ${zoneDisplayName(visit?.kam_name)}`.trim())
          failedCount++
          continue
        }

        const lat = Number(visit.lat)
        const lng = Number(visit.lng)

        // Hospital más cercano (RPC con service_role)
        const { data: nearestHospital, error: rpcError } = await supabaseAdmin.rpc('find_nearest_hospital', {
          visit_lat: lat,
          visit_lng: lng,
          max_distance_km: 5,
        })
        if (rpcError) console.error('visits/import: error en find_nearest_hospital', rpcError)

        const { error: insertError } = await supabaseAdmin.from('visits').insert({
          kam_id: isUuid(visit.kam_id) ? visit.kam_id : null,
          kam_name: visit.kam_name,
          visit_type: visit.visit_type,
          contact_type: visit.contact_type,
          lat,
          lng,
          visit_date: visit.visit_date,
          hospital_id: isUuid(nearestHospital) ? nearestHospital : null,
          imported_by: user.id,
          import_id: importRecord.id,
        })

        if (insertError) {
          console.error('visits/import: error insertando visita', insertError)
          errors.push(`No se pudo insertar la visita de ${zoneDisplayName(visit.kam_name) || 'Ejecutivo Comercial'} del ${visit.visit_date}`)
          failedCount++
        } else {
          successfulCount++
        }
      } catch (error) {
        console.error('visits/import: error procesando visita', error)
        errors.push('Error procesando una visita')
        failedCount++
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('visit_imports')
      .update({ successful_records: successfulCount, failed_records: failedCount })
      .eq('id', importRecord.id)

    if (updateError) {
      console.error('visits/import: error actualizando registro de importación', updateError)
    }

    console.info('visits/import completada', {
      import_id: importRecord.id,
      total: visits.length,
      exitosos: successfulCount,
      fallidos: failedCount,
      usuario: user.id,
    })

    return NextResponse.json({
      success: true,
      successful: successfulCount,
      failed: failedCount,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    return serverError('visits/import POST', error, 'Error al procesar la importación')
  }
}

// DELETE: eliminar una importación concreta y sus visitas
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response

  try {
    const importId = new URL(request.url).searchParams.get('importId')
    if (!isUuid(importId)) {
      return NextResponse.json({ error: 'ID de importación requerido' }, { status: 400 })
    }

    const { error: deleteVisitsError } = await supabaseAdmin.from('visits').delete().eq('import_id', importId)
    if (deleteVisitsError) return serverError('visits/import DELETE (visitas)', deleteVisitsError, 'Error al eliminar las visitas')

    const { data: deletedImports, error: deleteImportError } = await supabaseAdmin
      .from('visit_imports')
      .delete()
      .eq('id', importId)
      .select('id')

    if (deleteImportError) {
      return serverError('visits/import DELETE (registro)', deleteImportError, 'Error al eliminar las visitas')
    }
    if (!deletedImports || deletedImports.length === 0) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return serverError('visits/import DELETE', error, 'Error al eliminar las visitas')
  }
}
