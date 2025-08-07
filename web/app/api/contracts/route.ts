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
    console.log('Contracts API - Usuario autenticado:', user)
    
    if (!user) {
      console.log('Contracts API - No hay usuario autenticado')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    console.log('Contracts API - Rol del usuario:', user.role)
    if (user.role !== 'admin' && user.role !== 'contract_manager' && user.role !== 'sales_manager') {
      console.log('Contracts API - Usuario sin permisos. Rol:', user.role)
      return NextResponse.json({ error: 'Sin permisos para ver contratos' }, { status: 403 })
    }

    // Obtener contratos con información del hospital
    const { data: contractsData, error } = await supabase
      .from('hospital_contracts')
      .select(`
        *,
        hospitals (
          id,
          name,
          code,
          municipality_id,
          department_id
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading contracts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Obtener KAMs para cada hospital
    const contractsWithKams = await Promise.all(
      (contractsData || []).map(async (contract) => {
        const { data: assignment } = await supabase
          .from('assignments')
          .select('kam_id')
          .eq('hospital_id', contract.hospital_id)
          .single()

        if (assignment?.kam_id) {
          const { data: kam } = await supabase
            .from('kams')
            .select('name')
            .eq('id', assignment.kam_id)
            .single()
          
          return {
            ...contract,
            hospital: contract.hospitals,
            kam: kam
          }
        }

        return {
          ...contract,
          hospital: contract.hospitals,
          kam: null
        }
      })
    )

    return NextResponse.json(contractsWithKams)
  } catch (error) {
    console.error('Error in GET /api/contracts:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'contract_manager') {
      return NextResponse.json({ error: 'Sin permisos para crear contratos' }, { status: 403 })
    }

    const body = await request.json()
    
    const { data, error } = await supabase
      .from('hospital_contracts')
      .insert({
        ...body,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contract:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/contracts:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}