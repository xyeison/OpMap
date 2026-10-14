// Importación mensual de visitas de VMO (POST /api/visits/import), fuera de la ruta para poder probarla aunque la ruta
// esté DESHABILITADA (VMO_IMPORT_ENABLED = false en app/api/visits/import/route.ts: decisión del dueño 2026-10-12,
// docs/decisiones/2026-10-12-app-de-visita.md; reactivarla es decisión suya). Lo que la hace segura junto a las
// visitas de la app (migración 0830): el reemplazo del mes borra SOLO las importadas (source = 'vmo_import'; antes de
// la 0830 la columna no existe y no hay visitas de la app: se borra como siempre) y, si el borrado falla, no se inserta
// nada (si no, quedarían visitas duplicadas). Pruebas: web/scripts/reporte-api-check.ts.
// Contrato: docs/fases/fase8-visitas-f3-f4-reporte-y-app-movil.md ("Rutas viejas que tocan visits").
import { NextResponse } from 'next/server'
import { zoneDisplayName } from '@/lib/zone-names'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { badJson, isUuid, serverError } from '../../_lib/api-error'
import { esColumnaInexistente } from './visitas-mapa'

export const MAX_VISITS_PER_IMPORT = 20000

/** Primer día del mes y primer día del mes siguiente (AAAA-MM-DD): el rango [start, end) del mes. */
export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end }
}

/**
 * Borra las visitas IMPORTADAS de VMO del rango [start, end) (source = 'vmo_import'). Las de la app no se tocan nunca
 * (además, el disparador visits_app_sin_borrar de la 0830 haría fallar todo el borrado). Sin la 0830 (la columna
 * source no existe) borra el mes completo, como antes: entonces no hay visitas de la app.
 */
export async function borrarImportadasDelMes(start: string, end: string): Promise<{ error: unknown | null }> {
  const borrar = (soloVmo: boolean) => {
    let consulta = supabaseAdmin.from('visits').delete().gte('visit_date', start).lt('visit_date', end)
    if (soloVmo) consulta = consulta.eq('source', 'vmo_import')
    return consulta
  }
  const { error } = await borrar(true)
  if (error && esColumnaInexistente(error)) return { error: (await borrar(false)).error ?? null }
  return { error: error ?? null }
}

/** Importa las visitas de un mes (el cuerpo de POST /api/visits/import) a nombre de `userId`. */
export async function importarMesVmo(body: unknown, userId: string): Promise<NextResponse> {
  if (!body || typeof body !== 'object') return badJson()
  const cuerpo = body as { visits?: unknown; month?: unknown; year?: unknown; filename?: unknown }

  const month = Number(cuerpo.month)
  const year = Number(cuerpo.year)
  const filename = typeof cuerpo.filename === 'string' ? cuerpo.filename.slice(0, 255) : 'importacion'
  const visits = Array.isArray(cuerpo.visits) ? (cuerpo.visits as any[]) : null

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
      imported_by: userId,
    })
    .select()
    .single()

  if (importError) {
    if ((importError as { code?: string }).code === '23505') {
      return NextResponse.json({ error: `Ya existe una importación para ${month}/${year}. Elimínela primero.` }, { status: 400 })
    }
    return serverError('visits/import (registro)', importError, 'Error al crear registro de importación')
  }

  // Eliminar las visitas importadas del mismo mes (huérfanas: no puede existir otra importación del mes). Si el
  // borrado falla, no se importa nada y se quita el registro de importación recién creado.
  const { start, end } = monthRange(year, month)
  const { error: deleteError } = await borrarImportadasDelMes(start, end)
  if (deleteError) {
    await supabaseAdmin.from('visit_imports').delete().eq('id', importRecord.id)
    return serverError('visits/import (borrar visitas previas)', deleteError, 'No se pudieron reemplazar las visitas del mes: no se importó nada')
  }

  const errors: string[] = []
  let successfulCount = 0
  let failedCount = 0

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
        imported_by: userId,
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
    usuario: userId,
  })

  return NextResponse.json({
    success: true,
    successful: successfulCount,
    failed: failedCount,
    errors: errors.slice(0, 10),
  })
}
