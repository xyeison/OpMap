import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { nitFromCode } from '@/lib/reps-match'
import { badJson, isUuid, readJsonBody, serverError, validationError } from '../../../_lib/api-error'
import { repsLinkSchema } from '../../../_lib/hospital-schemas'
import {
  afterRepsLinkChange,
  evaluateHospitals,
  HOSPITAL_REPS_SELECT,
  isPrincipalSede,
  isRepsCodeConflict,
  latestRepsCut,
  loadSede,
  resolveRepsLink,
  type HospitalRepsRow,
} from '../../../_lib/reps'

// Fase 3 · Sede del REPS de una IPS (ficha, sección "Sede REPS").
// GET  (hospitals:view): sede vinculada + candidatas del mismo NIT ordenadas y evaluación en vivo
//      (lib/reps-match.ts), con la sugerida si la IPS es ambigua.
// PATCH (hospitals:edit): { reps_code } vincula (valida que la sede exista y esté libre);
//      { reps_code: null } desvincula. Registra el cambio en hospital_history (action 'edited') y deja
//      los servicios y la capacidad del REPS de la IPS con los de la sede nueva (o sin dato).
// Ninguna de las dos llama a Google ni recalcula asignaciones.

async function loadHospital(hospitalId: string): Promise<HospitalRepsRow | null> {
  const { data, error } = await supabaseAdmin.from('hospitals').select(HOSPITAL_REPS_SELECT).eq('id', hospitalId).maybeSingle()
  if (error) throw error
  return (data as HospitalRepsRow | null) ?? null
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    const hospital = await loadHospital(params.id)
    if (!hospital) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })

    const [evaluation, cut, linkedSede] = await Promise.all([
      evaluateHospitals([hospital]),
      latestRepsCut(),
      hospital.reps_code ? loadSede(hospital.reps_code) : Promise.resolve(null),
    ])
    const result = evaluation.results.get(hospital.id) ?? null
    const sedeByCode = new Map(evaluation.sedes.map(sede => [sede.codigo_habilitacion, sede]))

    const candidates = (result?.candidates ?? []).map(candidate => {
      const sede = sedeByCode.get(candidate.codigo_habilitacion)
      const linked = evaluation.linked.get(candidate.codigo_habilitacion)
      return {
        codigo_habilitacion: candidate.codigo_habilitacion,
        nombre_sede: candidate.nombre_sede,
        municipio_sede: candidate.municipio_sede,
        municipio_sede_nombre: sede?.municipio_sede_nombre ?? null,
        direccion_sede: sede?.direccion_sede ?? null,
        same_municipality: candidate.same_municipality,
        score: candidate.score,
        principal: sede ? isPrincipalSede(sede) : false,
        linked_hospital: linked && linked.id !== hospital.id ? linked : null,
      }
    })

    return NextResponse.json({
      hospital,
      sede: linkedSede,
      orphan: Boolean(hospital.reps_code) && !linkedSede,
      evaluation: result
        ? {
            status: result.status,
            method: result.method,
            reason: result.reason,
            suggested_code: result.suggested_code,
          }
        : null,
      candidates,
      cut,
    })
  } catch (error) {
    return serverError('hospitals/[id]/reps-link GET', error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    if (!isUuid(params.id)) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })

    const body = await readJsonBody(request)
    if (body === undefined) return badJson()
    const parsed = repsLinkSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const hospital = await loadHospital(params.id)
    if (!hospital) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })

    const repsCode = parsed.data.reps_code
    if (repsCode !== null && repsCode === hospital.reps_code) {
      return NextResponse.json({ hospital, warnings: [], unchanged: true })
    }

    const resolution = await resolveRepsLink({
      repsCode,
      hospitalId: hospital.id,
      nit: hospital.nit ?? nitFromCode(hospital.code),
      municipalityId: hospital.municipality_id,
    })
    if (!resolution.ok) return NextResponse.json({ error: resolution.error }, { status: resolution.status })

    const { data, error } = await supabaseAdmin
      .from('hospitals')
      .update(resolution.fields)
      .eq('id', hospital.id)
      .select(HOSPITAL_REPS_SELECT)
      .maybeSingle()
    if (error) {
      if (isRepsCodeConflict(error)) {
        return NextResponse.json({ error: `La sede ${repsCode} ya está vinculada a otra IPS` }, { status: 409 })
      }
      return serverError('hospitals/[id]/reps-link PATCH', error, 'Error al vincular la sede del REPS')
    }
    if (!data) return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })

    const warnings = [
      ...resolution.warnings,
      ...(await afterRepsLinkChange({
        route: 'hospitals/[id]/reps-link PATCH',
        hospitalId: hospital.id,
        userId: auth.user.id,
        active: hospital.active === true,
        before: { reps_code: hospital.reps_code, reps_match_status: hospital.reps_match_status },
        after: resolution.fields,
        sedeName: resolution.sede?.nombre_sede ?? null,
      })),
    ]

    return NextResponse.json({ hospital: data, sede: resolution.sede, warnings })
  } catch (error) {
    return serverError('hospitals/[id]/reps-link PATCH', error)
  }
}
