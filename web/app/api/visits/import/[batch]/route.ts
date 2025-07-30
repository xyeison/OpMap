import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getUserFromRequest } from '@/lib/auth-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { batch: string } }
) {
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

    const importBatch = params.batch

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