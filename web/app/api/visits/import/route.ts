import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getUserFromRequest } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    console.log('Usuario intentando importar:', { 
      email: user?.email, 
      role: user?.role,
      id: user?.id 
    })
    
    if (!user || !['admin', 'data_manager'].includes(user.role)) {
      console.log('Acceso denegado. Rol actual:', user?.role)
      return NextResponse.json(
        { error: `No autorizado para importar visitas. Tu rol: ${user?.role || 'no autenticado'}` },
        { status: 403 }
      )
    }

    const { visits, month, year, filename, importBatch } = await request.json()

    if (!visits || visits.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron visitas para importar' },
        { status: 400 }
      )
    }

    // Comenzar transacción
    const errors: string[] = []
    let successfulCount = 0
    const failedVisits: any[] = []

    // Eliminar visitas previas del mismo mes/año si existen
    const { error: deleteError } = await supabase
      .from('visits')
      .update({ deleted_at: new Date().toISOString() })
      .gte('visit_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('visit_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
      .is('deleted_at', null)

    if (deleteError) {
      console.error('Error marking old visits as deleted:', deleteError)
    }

    // Procesar cada visita
    for (const visit of visits) {
      try {
        // Intentar encontrar el hospital más cercano
        const { data: nearestHospital } = await supabase
          .rpc('find_nearest_hospital', {
            visit_lat: visit.lat,
            visit_lng: visit.lng,
            max_distance_km: 5
          })

        // Insertar la visita
        const { error: insertError } = await supabase
          .from('visits')
          .insert({
            ...visit,
            hospital_id: nearestHospital,
            imported_by: user.id
          })

        if (insertError) {
          errors.push(`Error insertando visita: ${insertError.message}`)
          failedVisits.push(visit)
        } else {
          successfulCount++
        }
      } catch (error) {
        console.error('Error processing visit:', error)
        errors.push(`Error procesando visita: ${error}`)
        failedVisits.push(visit)
      }
    }

    // Registrar la importación
    const { error: importError } = await supabase
      .from('visit_imports')
      .insert({
        import_batch: importBatch,
        filename,
        month,
        year,
        total_records: visits.length,
        successful_records: successfulCount,
        failed_records: failedVisits.length,
        error_details: errors.length > 0 ? { errors, failedVisits } : null,
        imported_by: user.id
      })

    if (importError) {
      console.error('Error registering import:', importError)
    }

    return NextResponse.json({
      success: true,
      successful: successfulCount,
      failed: failedVisits.length,
      errors: errors.slice(0, 10) // Limitar errores mostrados
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Error al procesar la importación' },
      { status: 500 }
    )
  }
}

// DELETE endpoint para eliminar importaciones
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user || !['admin', 'data_manager'].includes(user.role)) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar visitas' },
        { status: 403 }
      )
    }

    // Obtener el importBatch del path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const importBatch = pathParts[pathParts.length - 1]

    if (!importBatch) {
      return NextResponse.json(
        { error: 'ID de importación no proporcionado' },
        { status: 400 }
      )
    }

    // Marcar las visitas como eliminadas (soft delete)
    const { error: deleteVisitsError } = await supabase
      .from('visits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('import_batch', importBatch)

    if (deleteVisitsError) {
      throw deleteVisitsError
    }

    // Marcar la importación como eliminada
    const { error: deleteImportError } = await supabase
      .from('visit_imports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('import_batch', importBatch)

    if (deleteImportError) {
      throw deleteImportError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la importación' },
      { status: 500 }
    )
  }
}