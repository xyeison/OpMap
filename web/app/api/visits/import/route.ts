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
            imported_by: user.id
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

    // Ya no registramos en visit_imports porque la tabla fue eliminada
    console.log('Importación completada:', {
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

// DELETE endpoint para eliminar visitas de un mes/año específico
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

    // Obtener mes y año de los parámetros
    const url = new URL(request.url)
    const month = url.searchParams.get('month')
    const year = url.searchParams.get('year')

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Mes y año son requeridos' },
        { status: 400 }
      )
    }

    // Eliminar las visitas del mes/año especificado
    const { error: deleteError } = await supabase
      .from('visits')
      .delete()
      .gte('visit_date', `${year}-${String(month).padStart(2, '0')}-01`)
      .lt('visit_date', `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`)

    if (deleteError) {
      throw deleteError
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