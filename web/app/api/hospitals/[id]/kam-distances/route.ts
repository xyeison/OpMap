import { NextRequest, NextResponse } from 'next/server'
import { zoneDisplayName } from '@/lib/zone-names'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { isUuid, serverError } from '../../../_lib/api-error'
import { readBogotaConfig } from '../../../_lib/bogota-config'
import { bogotaDistanceAggregate, isBogotaCellArea } from '@/lib/bogota-admin'

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
          area_id,
          max_travel_time,
          active
        )
      `)
      .eq('hospital_id', hospitalId)
      .eq('kams.active', true)
      .order('travel_time', { ascending: true })

    if (error) return serverError('hospitals/[id]/kam-distances GET', error, 'Error al cargar las distancias')

    // Bogotá hacia afuera (PR 3): para una IPS fuera de Bogotá las celdas de Bogotá compiten como UNA
    // ciudad con el tope único de bogota_config; la ficha muestra la fila agregada "Bogotá" (mejor tiempo
    // entre sus celdas) y ese tope en vez del max_travel_time de cada celda.
    const [{ data: hospital }, bogotaConfig] = await Promise.all([
      supabaseAdmin.from('hospitals').select('department_id').eq('id', hospitalId).maybeSingle(),
      readBogotaConfig().catch(() => null),
    ])
    const bogotaMax = bogotaConfig?.config.max_travel_minutes ?? null

    const formattedDistances = (distances || []).map((d: any) => ({
      kam_id: d.kam_id,
      kam_name: zoneDisplayName(d.kams?.name) || 'Zona desconocida',
      area_id: d.kams?.area_id ?? null,
      travel_time: d.travel_time, // En segundos
      distance: d.distance,
      max_travel_time: d.kams?.max_travel_time || 240,
      is_bogota_cell: isBogotaCellArea(d.kams?.area_id),
    }))

    const bogota = bogotaDistanceAggregate(formattedDistances, hospital?.department_id ?? null, bogotaMax)
    if (bogota) {
      // Hacia afuera manda el tope único de Bogotá, no el de cada celda
      for (const row of formattedDistances) {
        if (row.is_bogota_cell) row.max_travel_time = bogota.max_travel_minutes
      }
    }

    return NextResponse.json({ distances: formattedDistances, total: formattedDistances.length, bogota })
  } catch (error) {
    return serverError('hospitals/[id]/kam-distances GET', error)
  }
}
