import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET() {
  try {
    // Obtener departamentos únicos de municipalities
    const { data: municipalities, error } = await supabase
      .from('municipalities')
      .select('department_id, department_name')
      .order('department_name')

    if (error) throw error

    // Crear lista única de departamentos
    const departmentsMap = new Map()
    municipalities?.forEach(m => {
      if (m.department_id && m.department_name) {
        departmentsMap.set(m.department_id, m.department_name)
      }
    })

    const departments = Array.from(departmentsMap, ([id, name]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json({ error: 'Error al obtener departamentos' }, { status: 500 })
  }
}