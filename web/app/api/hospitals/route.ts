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

    // Obtener hospitales activos
    const { data: hospitals, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
      .order('name')

    if (hospitalsError) {
      console.error('Error loading hospitals:', hospitalsError)
      return NextResponse.json({ error: hospitalsError.message }, { status: 500 })
    }

    // Obtener asignaciones con KAMs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        hospital_id,
        kam_id,
        kams!inner (
          id,
          name
        )
      `)

    if (assignmentsError) {
      console.error('Error loading assignments:', assignmentsError)
      // Continuar sin asignaciones si hay error
    }

    // Crear mapa de hospital_id -> kam_name
    const kamMap = new Map()
    assignments?.forEach((a: any) => {
      if (a.kams && typeof a.kams === 'object' && 'name' in a.kams) {
        kamMap.set(a.hospital_id, a.kams.name)
      }
    })

    // Combinar datos
    const hospitalsWithKam = hospitals?.map(h => ({
      ...h,
      assigned_kam_name: kamMap.get(h.id) || null
    }))

    return NextResponse.json(hospitalsWithKam || [])
  } catch (error) {
    console.error('Error in GET /api/hospitals:', error)
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

    const body = await request.json()
    
    const { data, error } = await supabase
      .from('hospitals')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Error creating hospital:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/hospitals:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}