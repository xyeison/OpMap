import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'contract_manager') {
      return NextResponse.json({ error: 'Sin permisos para eliminar contratos' }, { status: 403 })
    }

    const contractId = params.id

    const { error } = await supabase
      .from('hospital_contracts')
      .delete()
      .eq('id', contractId)

    if (error) {
      console.error('Error deleting contract:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Contrato eliminado exitosamente' })
  } catch (error) {
    console.error('Error in DELETE /api/contracts/[id]:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'contract_manager') {
      return NextResponse.json({ error: 'Sin permisos para editar contratos' }, { status: 403 })
    }

    const contractId = params.id
    const body = await request.json()

    const { data, error } = await supabase
      .from('hospital_contracts')
      .update(body)
      .eq('id', contractId)
      .select()
      .single()

    if (error) {
      console.error('Error updating contract:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/contracts/[id]:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}