import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const hospitalId = params.id

    // Obtener datos del hospital
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .single()

    if (hospitalError || !hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    // Obtener municipio
    const { data: municipality } = await supabase
      .from('municipalities')
      .select('name')
      .eq('code', hospital.municipality_id)
      .single()

    // Obtener departamento
    const { data: department } = await supabase
      .from('departments')
      .select('name')
      .eq('code', hospital.department_id)
      .single()

    // Obtener asignación y KAM
    const { data: assignment } = await supabase
      .from('assignments')
      .select('kam_id')
      .eq('hospital_id', hospitalId)
      .single()

    let kam = null
    let kamMunicipalityName = null

    if (assignment?.kam_id) {
      const { data: kamData } = await supabase
        .from('kams')
        .select('*')
        .eq('id', assignment.kam_id)
        .single()

      kam = kamData

      if (kamData) {
        const { data: kamMunicipality } = await supabase
          .from('municipalities')
          .select('name')
          .eq('code', kamData.area_id)
          .single()

        kamMunicipalityName = kamMunicipality?.name
      }
    }

    // Obtener estadísticas de contratos
    const { data: contracts } = await supabase
      .from('hospital_contracts')
      .select('contract_value')
      .eq('hospital_id', hospitalId)
      .eq('active', true)

    const contractStats = {
      activeCount: contracts?.length || 0,
      totalValue: contracts?.reduce((sum, contract) => sum + (contract.contract_value || 0), 0) || 0
    }

    // Obtener historial de cambios
    const { data: history } = await supabase
      .from('hospital_history')
      .select(`
        *,
        users!hospital_history_user_id_fkey (
          full_name,
          email
        )
      `)
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      hospital,
      municipalityName: municipality?.name,
      departmentName: department?.name,
      kam,
      kamMunicipalityName,
      contractStats,
      history: history || []
    })
  } catch (error) {
    console.error('Error in GET /api/hospitals/[id]:', error)
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

    const hospitalId = params.id
    const body = await request.json()

    const { data, error } = await supabase
      .from('hospitals')
      .update(body)
      .eq('id', hospitalId)
      .select()
      .single()

    if (error) {
      console.error('Error updating hospital:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PUT /api/hospitals/[id]:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const hospitalId = params.id
    const body = await request.json()

    // Actualizar solo los campos proporcionados
    const updateData: any = {}
    
    if (body.documents_url !== undefined) {
      updateData.documents_url = body.documents_url
    }
    
    if (body.doctors !== undefined) {
      updateData.doctors = body.doctors
    }

    const { data, error } = await supabase
      .from('hospitals')
      .update(updateData)
      .eq('id', hospitalId)
      .select()
      .single()

    if (error) {
      console.error('Error updating hospital:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/hospitals/[id]:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}