import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, requireUser } from '@/lib/require-role'
import { badJson, fetchAllRows, readJsonBody, serverError, validationError } from '../_lib/api-error'
import { createHospitalSchema } from '../_lib/hospital-schemas'
import { refreshHospitalZone, zoneRefreshResponse } from '../_lib/hospital-routes'

// POST calcula los tiempos de viaje que falten (Google) y recalcula zonas: ver app/api/_lib/hospital-routes.ts
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    // Todos los hospitales (activos e inactivos), paginando para no truncar a 1.000 filas
    const { data: hospitals, error: hospitalsError } = await fetchAllRows<any>((from, to) =>
      supabaseAdmin.from('hospitals').select('*').order('name').order('id').range(from, to)
    )
    if (hospitalsError) return serverError('hospitals GET', hospitalsError, 'Error al cargar hospitales')

    const { data: assignments, error: assignmentsError } = await fetchAllRows<any>((from, to) =>
      supabaseAdmin
        .from('assignments')
        .select(`
          hospital_id,
          kam_id,
          kams!inner (
            id,
            name
          )
        `)
        .order('id')
        .range(from, to)
    )
    if (assignmentsError) {
      // Se continúa sin nombres de KAM
      console.error('Error cargando asignaciones:', assignmentsError)
    }

    const kamMap = new Map<string, string>()
    assignments.forEach((a: any) => {
      if (a.kams && typeof a.kams === 'object' && 'name' in a.kams) {
        kamMap.set(a.hospital_id, a.kams.name)
      }
    })

    const hospitalsWithKam = hospitals.map(h => ({
      ...h,
      assigned_kam_name: kamMap.get(h.id) || null,
    }))

    return NextResponse.json(hospitalsWithKam)
  } catch (error) {
    return serverError('hospitals GET', error)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    const body = await readJsonBody(request)
    if (body === undefined) return badJson()

    const parsed = createHospitalSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe un hospital con ese código' }, { status: 409 })
      }
      return serverError('hospitals POST', error, 'Error al crear el hospital')
    }

    // La IPS ya está guardada. Si está activa: tiempos que falten → recálculo completo → municipios.
    // refreshHospitalZone no lanza: cualquier fallo vuelve como aviso en `warnings`.
    const zone = data.active === true ? await refreshHospitalZone(data.id, { actorId: auth.user.id }) : null

    return NextResponse.json({ ...data, warnings: zone?.warnings ?? [], zone: zoneRefreshResponse(zone) })
  } catch (error) {
    return serverError('hospitals POST', error)
  }
}
