import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { isUuid, serverError } from '../../../_lib/api-error'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const hospitalId = params.id
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    // Distancias de este hospital a los KAMs activos (hospital_kam_distances, en segundos)
    const { data: distances, error } = await supabaseAdmin
      .from('hospital_kam_distances')
      .select(`
        kam_id,
        travel_time,
        distance,
        kams!inner (
          id,
          name,
          max_travel_time,
          active
        )
      `)
      .eq('hospital_id', hospitalId)
      .eq('kams.active', true)
      .order('travel_time', { ascending: true })

    if (error) return serverError('hospitals/[id]/kam-distances GET', error, 'Error al cargar las distancias')

    const formattedDistances = (distances || []).map((d: any) => ({
      kam_id: d.kam_id,
      kam_name: d.kams?.name || 'KAM Desconocido',
      travel_time: d.travel_time, // En segundos
      distance: d.distance,
      max_travel_time: d.kams?.max_travel_time || 240,
    }))

    return NextResponse.json({ distances: formattedDistances, total: formattedDistances.length })
  } catch (error) {
    return serverError('hospitals/[id]/kam-distances GET', error)
  }
}
