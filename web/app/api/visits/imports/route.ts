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

    // Obtener historial de importaciones (solo las no eliminadas)
    const { data, error } = await supabase
      .from('visit_imports')
      .select('*')
      .is('deleted_at', null)
      .order('imported_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error loading visit imports:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    const importBatch = searchParams.get('batch')

    if (!importBatch) {
      return NextResponse.json({ error: 'Batch ID requerido' }, { status: 400 })
    }

    // Marcar la importación como eliminada
    const { error: updateError } = await supabase
      .from('visit_imports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('import_batch', importBatch)

    if (updateError) {
      console.error('Error deleting import:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Marcar las visitas asociadas como eliminadas
    const { error: visitsError } = await supabase
      .from('visits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('import_batch', importBatch)

    if (visitsError) {
      console.error('Error deleting visits:', visitsError)
      return NextResponse.json({ error: visitsError.message }, { status: 500 })
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