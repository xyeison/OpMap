import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET() {
  try {
    // Primero verificar qué columnas existen
    const { data: sample, error: sampleError } = await supabase
      .from('municipalities')
      .select('*')
      .limit(1)

    if (sampleError) {
      console.error('Error getting sample:', sampleError)
      throw sampleError
    }

    console.log('Municipality columns:', sample ? Object.keys(sample[0] || {}) : [])

    // Lista de departamentos de Colombia
    const colombianDepartments = [
      { id: '05', name: 'Antioquia' },
      { id: '08', name: 'Atlántico' },
      { id: '11', name: 'Bogotá D.C.' },
      { id: '13', name: 'Bolívar' },
      { id: '15', name: 'Boyacá' },
      { id: '17', name: 'Caldas' },
      { id: '18', name: 'Caquetá' },
      { id: '19', name: 'Cauca' },
      { id: '20', name: 'Cesar' },
      { id: '23', name: 'Córdoba' },
      { id: '25', name: 'Cundinamarca' },
      { id: '27', name: 'Chocó' },
      { id: '41', name: 'Huila' },
      { id: '44', name: 'La Guajira' },
      { id: '47', name: 'Magdalena' },
      { id: '50', name: 'Meta' },
      { id: '52', name: 'Nariño' },
      { id: '54', name: 'Norte de Santander' },
      { id: '63', name: 'Quindío' },
      { id: '66', name: 'Risaralda' },
      { id: '68', name: 'Santander' },
      { id: '70', name: 'Sucre' },
      { id: '73', name: 'Tolima' },
      { id: '76', name: 'Valle del Cauca' },
      { id: '81', name: 'Arauca' },
      { id: '85', name: 'Casanare' },
      { id: '86', name: 'Putumayo' },
      { id: '88', name: 'San Andrés y Providencia' },
      { id: '91', name: 'Amazonas' },
      { id: '94', name: 'Guainía' },
      { id: '95', name: 'Guaviare' },
      { id: '97', name: 'Vaupés' },
      { id: '99', name: 'Vichada' }
    ]

    return NextResponse.json(colombianDepartments)
  } catch (error) {
    console.error('Error in departments endpoint:', error)
    return NextResponse.json({ error: 'Error al obtener departamentos' }, { status: 500 })
  }
}