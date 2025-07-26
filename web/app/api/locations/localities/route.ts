import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Localidades de Bogotá
const BOGOTA_LOCALITIES = [
  { id: '11001001', name: 'Usaquén' },
  { id: '11001002', name: 'Chapinero' },
  { id: '11001003', name: 'Santa Fe' },
  { id: '11001004', name: 'San Cristóbal' },
  { id: '11001005', name: 'Usme' },
  { id: '11001006', name: 'Tunjuelito' },
  { id: '11001007', name: 'Bosa' },
  { id: '11001008', name: 'Kennedy' },
  { id: '11001009', name: 'Fontibón' },
  { id: '11001010', name: 'Engativá' },
  { id: '11001011', name: 'Suba' },
  { id: '11001012', name: 'Barrios Unidos' },
  { id: '11001013', name: 'Teusaquillo' },
  { id: '11001014', name: 'Los Mártires' },
  { id: '11001015', name: 'Antonio Nariño' },
  { id: '11001016', name: 'Puente Aranda' },
  { id: '11001017', name: 'La Candelaria' },
  { id: '11001018', name: 'Rafael Uribe Uribe' },
  { id: '11001019', name: 'Ciudad Bolívar' },
  { id: '11001020', name: 'Sumapaz' }
]

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const municipalityId = searchParams.get('municipalityId')

    if (!municipalityId) {
      return NextResponse.json({ error: 'municipalityId es requerido' }, { status: 400 })
    }

    // Por ahora solo Bogotá tiene localidades
    if (municipalityId === '11001') {
      return NextResponse.json(BOGOTA_LOCALITIES)
    }

    // Para otros municipios, retornar array vacío
    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching localities:', error)
    return NextResponse.json({ error: 'Error al obtener localidades' }, { status: 500 })
  }
}