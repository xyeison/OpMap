import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Primero intentar con la vista, si no existe usar la tabla directamente
    let { data, error } = await supabase
      .from('visit_imports_summary')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error) {
      console.error('Vista visit_imports_summary no encontrada, intentando con tabla visit_imports:', error)
      
      // Fallback: Si la vista no existe, intentar con la tabla directamente
      const fallbackResult = await supabase
        .from('visit_imports')
        .select(`
          *,
          imported_by_user:users!imported_by (
            full_name
          )
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
      
      if (fallbackResult.error) {
        console.error('Error loading visit imports from table:', fallbackResult.error)
        // Si tampoco existe la tabla, devolver array vacío
        if (fallbackResult.error.code === '42P01') {
          console.log('Tabla visit_imports no existe aún')
          return NextResponse.json([])
        }
        return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 })
      }
      
      // Formatear los datos del fallback para que coincidan con la estructura esperada
      data = fallbackResult.data?.map(imp => ({
        ...imp,
        imported_by_name: imp.imported_by_user?.full_name || 'Usuario',
        month_name: `${new Date(2000, imp.month - 1, 1).toLocaleString('es', { month: 'long' }).charAt(0).toUpperCase() + 
                     new Date(2000, imp.month - 1, 1).toLocaleString('es', { month: 'long' }).slice(1)} ${imp.year}`,
        current_visits: imp.successful_records || 0,
        kams_count: 0,
        original_total: imp.total_records,
        original_successful: imp.successful_records,
        original_failed: imp.failed_records
      })) || []
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in GET /api/visits/imports:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos - solo admin o sales_manager
    if (user.role !== 'admin' && user.role !== 'sales_manager' && user.role !== 'data_manager') {
      return NextResponse.json({ error: 'Sin permisos para eliminar importaciones' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('id')

    if (!importId) {
      return NextResponse.json({ error: 'ID de importación requerido' }, { status: 400 })
    }

    // Eliminar las visitas asociadas a esta importación
    const { error: visitsError } = await supabase
      .from('visits')
      .delete()
      .eq('import_id', importId)

    if (visitsError) {
      console.error('Error deleting visits:', visitsError)
      return NextResponse.json({ error: visitsError.message }, { status: 500 })
    }

    // Eliminar el registro de importación
    const { error: importError } = await supabase
      .from('visit_imports')
      .delete()
      .eq('id', importId)

    if (importError) {
      console.error('Error deleting import record:', importError)
      return NextResponse.json({ error: importError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/visits/imports:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}