import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { isUuid, serverError } from '../../_lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:view')
  if (!auth.ok) return auth.response

  try {
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
        return serverError('visits/imports GET', fallbackResult.error, 'Error al cargar las importaciones')
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

// Con el importador de VMO deshabilitado (decisión del dueño 2026-10-12), borrar una importación destruiría para
// siempre parte del histórico de VMO (ya no se puede volver a importar). Ver app/api/visits/import/route.ts.
const VMO_IMPORT_DELETE_ENABLED = false

export async function DELETE(request: NextRequest) {
  // visits:manage = admin y data_manager (sales_manager no tiene visits:view en permissions.ts)
  const auth = await requirePermission(request, 'visits:manage')
  if (!auth.ok) return auth.response
  if (!VMO_IMPORT_DELETE_ENABLED) {
    return NextResponse.json(
      { error: 'Borrar importaciones de VMO está deshabilitado: el histórico ya no se puede volver a importar.' },
      { status: 410 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('id')

    if (!isUuid(importId)) {
      return NextResponse.json({ error: 'ID de importación requerido' }, { status: 400 })
    }

    // Eliminar las visitas asociadas a esta importación
    const { error: visitsError } = await supabase
      .from('visits')
      .delete()
      .eq('import_id', importId)

    if (visitsError) {
      return serverError('visits/imports DELETE (visitas)', visitsError, 'Error al eliminar las visitas')
    }

    // Eliminar el registro de importación
    const { data: deletedImports, error: importError } = await supabase
      .from('visit_imports')
      .delete()
      .eq('id', importId)
      .select('id')

    if (importError) {
      return serverError('visits/imports DELETE (registro)', importError, 'Error al eliminar la importación')
    }
    if (!deletedImports || deletedImports.length === 0) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
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