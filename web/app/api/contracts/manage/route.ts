import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// IMPORTANTE: Este endpoint usa service role para bypass RLS
// Solo para resolver problemas de RLS en hospital_contracts

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const hospitalId = searchParams.get('hospital_id')
    
    if (!hospitalId) {
      return NextResponse.json({ error: 'hospital_id is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contracts:', error)
      throw error
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Error in GET /api/contracts/manage:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contracts', details: error?.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validar campos requeridos
    if (!body.hospital_id || !body.contract_number || !body.contract_value) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calcular duration_months
    const startDate = new Date(body.start_date)
    const endDate = new Date(body.end_date)
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth())
    const durationMonths = Math.max(1, Math.round(monthsDiff))

    const contractData = {
      hospital_id: body.hospital_id,
      contract_number: body.contract_number,
      contract_type: body.contract_type || 'capita',
      contracting_model: body.contracting_model || 'contratacion_directa',
      contract_value: body.contract_value,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_months: durationMonths,
      current_provider: body.provider || body.current_provider || 'Proveedor',
      provider: body.provider || null,
      description: body.description || null,
      active: body.active !== undefined ? body.active : true
    }

    console.log('Creating contract with data:', contractData)

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .insert(contractData)
      .select()

    if (error) {
      console.error('Error creating contract:', error)
      throw error
    }

    return NextResponse.json(data?.[0] || {})
  } catch (error: any) {
    console.error('Error in POST /api/contracts/manage:', error)
    return NextResponse.json(
      { error: 'Failed to create contract', details: error?.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    
    if (!body.id) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      )
    }

    // Calcular duration_months
    const startDate = new Date(body.start_date)
    const endDate = new Date(body.end_date)
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth())
    const durationMonths = Math.max(1, Math.round(monthsDiff))

    const updateData = {
      contract_number: body.contract_number,
      contract_type: body.contract_type,
      contracting_model: body.contracting_model || 'contratacion_directa',
      contract_value: body.contract_value,
      start_date: body.start_date,
      end_date: body.end_date,
      duration_months: durationMonths,
      provider: body.provider,
      current_provider: body.provider || body.current_provider || 'Proveedor',
      description: body.description,
      active: body.active
    }

    console.log('Updating contract with data:', updateData)

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .update(updateData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('Error updating contract:', error)
      throw error
    }

    return NextResponse.json(data?.[0] || {})
  } catch (error: any) {
    console.error('Error in PUT /api/contracts/manage:', error)
    return NextResponse.json(
      { error: 'Failed to update contract', details: error?.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('hospital_contracts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting contract:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/contracts/manage:', error)
    return NextResponse.json(
      { error: 'Failed to delete contract', details: error?.message },
      { status: 500 }
    )
  }
}