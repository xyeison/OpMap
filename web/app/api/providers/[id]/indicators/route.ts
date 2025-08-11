import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const providerId = params.id

    // Obtener indicadores del proveedor
    const { data: indicators, error } = await supabase
      .from('proveedor_indicadores')
      .select('*')
      .eq('proveedor_id', providerId)
      .order('anio', { ascending: false })

    if (error) {
      console.error('Error loading indicators:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(indicators || [])
  } catch (error) {
    console.error('Error in GET /api/providers/[id]/indicators:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const providerId = params.id
    const body = await request.json()

    // Calcular indicadores derivados
    const indicatorData = {
      ...body,
      proveedor_id: providerId,
      // Los valores booleanos de cumplimiento se calculan aquí si es necesario
      cumple_liquidez: body.indice_liquidez >= 1.2,
      cumple_endeudamiento: body.indice_endeudamiento <= 0.7,
      cumple_cobertura: body.cobertura_intereses >= 1.5,
      cumple_todos_requisitos: 
        body.indice_liquidez >= 1.2 && 
        body.indice_endeudamiento <= 0.7 && 
        body.cobertura_intereses >= 1.5
    }

    const { data, error } = await supabase
      .from('proveedor_indicadores')
      .upsert(indicatorData, {
        onConflict: 'proveedor_id,anio'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving indicators:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/providers/[id]/indicators:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Alias para POST ya que usamos upsert
  return POST(request, { params })
}