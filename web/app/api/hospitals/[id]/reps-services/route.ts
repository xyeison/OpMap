import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { isUuid, serverError } from '../../../_lib/api-error'

// GET /api/hospitals/[id]/reps-services (hospitals:view): servicios habilitados y capacidad instalada
// importados del REPS para la ficha de la IPS (components/HospitalRepsPanel.tsx). Solo lectura.

export const dynamic = 'force-dynamic'

const isUndefined = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null
  return e?.code === '42703' || e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|could not find the table/i.test(e?.message || '')
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID de hospital no válido' }, { status: 400 })

  try {
    const [hospitalRes, servicesRes, capacityRes] = await Promise.all([
      supabaseAdmin
        .from('hospitals')
        .select('quirofanos, reps_beds, service_flags, reps_services_count, reps_updated_at')
        .eq('id', params.id)
        .maybeSingle(),
      supabaseAdmin
        .from('hospital_services')
        .select('reps_code, service_code, service_name, group_name, complexity, modality, imported_at')
        .eq('hospital_id', params.id)
        .order('group_name', { ascending: true })
        .order('service_code', { ascending: true })
        .limit(2000),
      supabaseAdmin
        .from('hospital_capacity')
        .select('reps_code, group_name, concept, quantity, imported_at')
        .eq('hospital_id', params.id)
        .order('group_name', { ascending: true })
        .order('concept', { ascending: true })
        .limit(1000),
    ])

    // Migración 0620 sin aplicar: la ficha muestra "sin datos" en lugar de fallar
    if ([hospitalRes.error, servicesRes.error, capacityRes.error].some(e => e && isUndefined(e))) {
      return NextResponse.json({ available: false, summary: null, services: [], capacity: [] })
    }
    const failed = hospitalRes.error || servicesRes.error || capacityRes.error
    if (failed) return serverError('hospitals/[id]/reps-services GET', failed, 'Error al cargar los datos del REPS')
    if (!hospitalRes.data) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })

    return NextResponse.json({
      available: true,
      summary: hospitalRes.data,
      services: servicesRes.data || [],
      capacity: capacityRes.data || [],
    })
  } catch (error) {
    return serverError('hospitals/[id]/reps-services GET', error)
  }
}
