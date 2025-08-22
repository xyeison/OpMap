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

    const { visits, month, year, filename } = await request.json()

    // Crear registro de importación primero
    const { data: importRecord, error: importError } = await supabase
      .from('visit_imports')
      .insert({
        filename,
        month,
        year,
        total_records: visits.length,
        successful_records: 0, // Se actualizará al final
        failed_records: 0, // Se actualizará al final
        imported_by: user.id
      })
      .select()
      .single()

    if (importError) {
      console.error('Error creando registro de importación:', importError)
      // Si ya existe una importación para este mes/año
      if (importError.code === '23505') {
        return NextResponse.json(
          { error: `Ya existe una importación para ${month}/${year}. Elimínela primero.` },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'Error al crear registro de importación' },
        { status: 500 }
      )
    }

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
      .delete()
      .gte('visit_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('visit_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)

    if (deleteError) {
      console.error('Error deleting old visits:', deleteError)
    }

    // Procesar cada visita
    for (const visit of visits) {
      try {
        // Validar que la visita tenga una fecha válida
        if (!visit.visit_date) {
          console.error('Visita sin fecha:', visit)
          errors.push(`Error: Visita sin fecha válida para KAM ${visit.kam_name}`)
          failedVisits.push(visit)
          continue
        }

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
            kam_id: visit.kam_id,
            kam_name: visit.kam_name,
            visit_type: visit.visit_type,
            contact_type: visit.contact_type,
            lat: visit.lat,
            lng: visit.lng,
            visit_date: visit.visit_date,
            hospital_id: nearestHospital,
            imported_by: user.id,
            import_id: importRecord.id
          })

        if (insertError) {
          console.error('Error insertando visita individual:', insertError)
          if (insertError.code === '42501') {
            errors.push(`Error de permisos RLS en tabla visits. Ejecute el script SQL para desactivar RLS.`)
          } else {
            errors.push(`Error insertando visita: ${insertError.message}`)
          }
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

    // Actualizar el registro de importación con los resultados finales
    const { error: updateError } = await supabase
      .from('visit_imports')
      .update({
        successful_records: successfulCount,
        failed_records: failedVisits.length
      })
      .eq('id', importRecord.id)

    if (updateError) {
      console.error('Error actualizando registro de importación:', updateError)
    }

    console.log('Importación completada:', {
      import_id: importRecord.id,
      total: visits.length,
      exitosos: successfulCount,
      fallidos: failedVisits.length
    })

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

// DELETE endpoint para eliminar una importación específica
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

    // Obtener el ID de importación
    const url = new URL(request.url)
    const importId = url.searchParams.get('importId')

    if (!importId) {
      return NextResponse.json(
        { error: 'ID de importación requerido' },
        { status: 400 }
      )
    }

    // Eliminar las visitas asociadas a esta importación
    const { error: deleteVisitsError } = await supabase
      .from('visits')
      .delete()
      .eq('import_id', importId)

    if (deleteVisitsError) {
      console.error('Error eliminando visitas:', deleteVisitsError)
      throw deleteVisitsError
    }

    // Eliminar el registro de importación
    const { error: deleteImportError } = await supabase
      .from('visit_imports')
      .delete()
      .eq('id', importId)

    if (deleteImportError) {
      console.error('Error eliminando registro de importación:', deleteImportError)
      throw deleteImportError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Error al eliminar las visitas' },
      { status: 500 }
    )
  }
}