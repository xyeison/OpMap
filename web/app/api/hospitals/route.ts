import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission, requireUser } from '@/lib/require-role'
import { badJson, fetchAllRows, readJsonBody, serverError, validationError } from '../_lib/api-error'
import { createHospitalSchema } from '../_lib/hospital-schemas'
import { PENDING_ASSIGNMENT_WARNING } from '../_lib/pending-assignment'
import { isRepsCodeConflict, resolveRepsLink } from '../_lib/reps'
import { nitFromCode } from '@/lib/reps-match'

// POST solo guarda la IPS: NO llama a Google ni recalcula el territorio. Si queda activa entra en la cola
// de pendientes (app/api/_lib/pending-assignment.ts) y se asigna con "Calcular rutas y asignar pendientes".

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

    // Fase 3: con reps_code, la sede debe existir en reps_sedes y estar libre; la IPS nace 'matched'
    const { reps_code: repsCode, ...insertData } = parsed.data
    let repsWarnings: string[] = []
    if (repsCode) {
      const resolution = await resolveRepsLink({
        repsCode,
        hospitalId: null,
        nit: nitFromCode(insertData.code),
        municipalityId: insertData.municipality_id,
      })
      if (!resolution.ok) return NextResponse.json({ error: resolution.error }, { status: resolution.status })
      Object.assign(insertData, resolution.fields)
      repsWarnings = resolution.warnings
    }

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      if (isRepsCodeConflict(error)) {
        return NextResponse.json({ error: 'Esa sede del REPS ya está vinculada a otra IPS' }, { status: 409 })
      }
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Ya existe una IPS con ese código' }, { status: 409 })
      }
      return serverError('hospitals POST', error, 'Error al crear la IPS')
    }

    // Sin rutas ni recálculo aquí (pedido del dueño): una IPS activa queda pendiente hasta la acción masiva
    const pending = data.active === true
    const warnings = [...(pending ? [PENDING_ASSIGNMENT_WARNING] : []), ...repsWarnings]
    return NextResponse.json({ ...data, pending, warnings })
  } catch (error) {
    return serverError('hospitals POST', error)
  }
}
