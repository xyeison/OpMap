import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: contract, error } = await supabase
      .from('hospital_contracts')
      .select(`
        *,
        hospital:hospitals(
          id,
          name,
          municipality_name,
          department_name
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Error fetching contract:', error)
      return NextResponse.json(
        { error: 'Error al obtener contrato' },
        { status: 500 }
      )
    }

    if (!contract) {
      return NextResponse.json(
        { error: 'Contrato no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(contract)
  } catch (error) {
    console.error('Error in GET /api/contracts/[id]:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

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
    
    // Remove fields that don't exist in the database table
    const { hospital, hospitals, kam, ...contractData } = body
    
    // Clean up proveedor_id - convert empty strings to null
    const cleanedBody = {
      ...contractData,
      proveedor_id: contractData.proveedor_id && contractData.proveedor_id !== '' ? contractData.proveedor_id : null
    }

    const { data, error } = await supabase
      .from('hospital_contracts')
      .update(cleanedBody)
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