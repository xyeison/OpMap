import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const departmentId = searchParams.get('departmentId')

    if (!departmentId) {
      return NextResponse.json({ error: 'departmentId es requerido' }, { status: 400 })
    }

    // Primero obtener el department_id correcto (sin ceros iniciales para comparación)
    const deptId = departmentId.padStart(2, '0')
    
    const { data: municipalities, error } = await supabase
      .from('municipalities')
      .select('id, name')
      .like('id', `${deptId}%`) // Buscar municipios que empiecen con el código del departamento
      .order('name')

    if (error) throw error

    return NextResponse.json(municipalities || [])
  } catch (error) {
    console.error('Error fetching municipalities:', error)
    return NextResponse.json({ error: 'Error al obtener municipios' }, { status: 500 })
  }
}