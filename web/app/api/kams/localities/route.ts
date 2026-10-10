import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BOGOTA_MUNICIPALITY_CODE, fetchAllRows } from '../_lib/kam-shared'

interface BogotaLocality {
  locality_id: string
  locality_name: string
  hospital_count: number
  lat: number | null
  lng: number | null
}

// GET /api/kams/localities — localidades de Bogotá (desde hospitals) para dar de alta un KAM en Bogotá (R2-A-01).
// lat/lng = centroide de las IPS de la localidad, que se usa como ubicación del KAM.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:edit')
  if (!auth.ok) return auth.response

  try {
    const rows = await fetchAllRows<{
      id: string
      locality_id: string | null
      locality_name: string | null
      lat: number | null
      lng: number | null
    }>((from, to) =>
      supabaseAdmin
        .from('hospitals')
        .select('id, locality_id, locality_name, lat, lng')
        .eq('municipality_id', BOGOTA_MUNICIPALITY_CODE)
        .not('locality_id', 'is', null)
        .order('id')
        .range(from, to)
    )

    const groups = new Map<
      string,
      { names: Map<string, number>; count: number; latSum: number; lngSum: number; coordCount: number }
    >()

    rows.forEach(row => {
      if (!row.locality_id) return
      const group = groups.get(row.locality_id) || {
        names: new Map<string, number>(),
        count: 0,
        latSum: 0,
        lngSum: 0,
        coordCount: 0,
      }
      group.count += 1
      if (row.locality_name) {
        group.names.set(row.locality_name, (group.names.get(row.locality_name) || 0) + 1)
      }
      if (row.lat !== null && row.lng !== null) {
        group.latSum += Number(row.lat)
        group.lngSum += Number(row.lng)
        group.coordCount += 1
      }
      groups.set(row.locality_id, group)
    })

    const localities: BogotaLocality[] = Array.from(groups.entries()).map(([localityId, group]) => {
      // Si una localidad tiene varios nombres en los datos, se usa el más frecuente
      const name =
        Array.from(group.names.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || `Localidad ${localityId}`
      return {
        locality_id: localityId,
        locality_name: name,
        hospital_count: group.count,
        lat: group.coordCount > 0 ? Math.round((group.latSum / group.coordCount) * 1e6) / 1e6 : null,
        lng: group.coordCount > 0 ? Math.round((group.lngSum / group.coordCount) * 1e6) / 1e6 : null,
      }
    })

    localities.sort((a, b) => a.locality_name.localeCompare(b.locality_name, 'es'))
    return NextResponse.json(localities)
  } catch (error) {
    console.error('Error en GET /api/kams/localities:', error)
    return NextResponse.json({ error: 'Error al cargar las localidades de Bogotá' }, { status: 500 })
  }
}
