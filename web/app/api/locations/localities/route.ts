import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-role'

// Localidades de Bogotá. Código de 7 dígitos (11001 + 2), el mismo de hospitals.locality_id,
// kams.area_id (1100102 = Chapinero) y public/geo/localidades.json. Antes se devolvían 8 dígitos
// ('11001002'), que nunca coincidían con ninguna zona: la IPS quedaba fuera de su territorio base y de
// la regla de mayoría de su localidad.
const BOGOTA_LOCALITIES = [
  { id: '1100101', name: 'Usaquén' },
  { id: '1100102', name: 'Chapinero' },
  { id: '1100103', name: 'Santa Fe' },
  { id: '1100104', name: 'San Cristóbal' },
  { id: '1100105', name: 'Usme' },
  { id: '1100106', name: 'Tunjuelito' },
  { id: '1100107', name: 'Bosa' },
  { id: '1100108', name: 'Kennedy' },
  { id: '1100109', name: 'Fontibón' },
  { id: '1100110', name: 'Engativá' },
  { id: '1100111', name: 'Suba' },
  { id: '1100112', name: 'Barrios Unidos' },
  { id: '1100113', name: 'Teusaquillo' },
  { id: '1100114', name: 'Los Mártires' },
  { id: '1100115', name: 'Antonio Nariño' },
  { id: '1100116', name: 'Puente Aranda' },
  { id: '1100117', name: 'La Candelaria' },
  { id: '1100118', name: 'Rafael Uribe Uribe' },
  { id: '1100119', name: 'Ciudad Bolívar' },
  { id: '1100120', name: 'Sumapaz' }
]

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

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