import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { fetchAllRows, serverError } from '../../../_lib/api-error'
import { evaluateHospitals, HOSPITAL_REPS_SELECT, latestRepsCut, type HospitalRepsRow } from '../../../_lib/reps'

// Fase 3 · GET /api/hospitals/reps/summary (hospitals:view): página "Cruce REPS".
// Conteos por estado del cruce, corte del REPS cargado, IPS ambiguas / sin cruce / sin evaluar (con el
// motivo y la sede sugerida, evaluados en vivo) y vinculadas cuya sede está en otro municipio.

// Depende de la sesión (cookie): siempre dinámica, sin intento de render estático en el build
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'hospitals:view')
  if (!auth.ok) return auth.response

  try {
    const { data: hospitals, error } = await fetchAllRows<HospitalRepsRow>((from, to) =>
      supabaseAdmin
        .from('hospitals')
        .select(HOSPITAL_REPS_SELECT)
        .order('name')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{ data: HospitalRepsRow[] | null; error: unknown }>
    )
    if (error) return serverError('hospitals/reps/summary GET', error)

    const counts = { matched: 0, ambiguous: 0, unmatched: 0, not_evaluated: 0, total: hospitals.length }
    for (const hospital of hospitals) {
      if (hospital.reps_match_status === 'matched') counts.matched++
      else if (hospital.reps_match_status === 'ambiguous') counts.ambiguous++
      else if (hospital.reps_match_status === 'unmatched') counts.unmatched++
      else counts.not_evaluated++
    }

    const pendingRows = hospitals.filter(hospital => hospital.reps_match_status !== 'matched')
    const [cut, evaluation] = await Promise.all([latestRepsCut(), evaluateHospitals(pendingRows)])
    const sedeByCode = new Map(evaluation.sedes.map(sede => [sede.codigo_habilitacion, sede]))

    const pending = pendingRows.map(hospital => {
      const result = evaluation.results.get(hospital.id)
      const suggested = result?.suggested_code ? sedeByCode.get(result.suggested_code) : undefined
      return {
        id: hospital.id,
        name: hospital.name,
        code: hospital.code,
        nit: hospital.nit,
        municipality_name: hospital.municipality_name,
        locality_name: hospital.locality_name,
        active: hospital.active,
        status: hospital.reps_match_status,
        live_status: result?.status ?? null,
        reason: result?.reason ?? null,
        candidates: result?.candidates.length ?? 0,
        suggested: suggested ? { codigo_habilitacion: suggested.codigo_habilitacion, nombre_sede: suggested.nombre_sede } : null,
      }
    })

    // Vinculadas cuya sede está en otro municipio (dato a revisar en la IPS)
    const linkedRows = hospitals.filter(hospital => hospital.reps_code)
    const sedeMunicipality = new Map<string, { municipio_sede: string; municipio_sede_nombre: string | null }>()
    for (let from = 0; from < linkedRows.length; from += 200) {
      const chunk = linkedRows.slice(from, from + 200).map(hospital => hospital.reps_code as string)
      const { data, error: sedeError } = await supabaseAdmin
        .from('reps_sedes')
        .select('codigo_habilitacion, municipio_sede, municipio_sede_nombre')
        .in('codigo_habilitacion', chunk)
      if (sedeError) return serverError('hospitals/reps/summary GET (sedes)', sedeError)
      for (const row of data ?? []) {
        sedeMunicipality.set(row.codigo_habilitacion as string, {
          municipio_sede: row.municipio_sede as string,
          municipio_sede_nombre: (row.municipio_sede_nombre as string | null) ?? null,
        })
      }
    }
    const otherMunicipality = linkedRows
      .filter(hospital => {
        const sede = sedeMunicipality.get(hospital.reps_code as string)
        return sede && hospital.municipality_id && sede.municipio_sede !== hospital.municipality_id
      })
      .map(hospital => ({
        id: hospital.id,
        name: hospital.name,
        municipality_name: hospital.municipality_name,
        reps_code: hospital.reps_code,
        sede_municipality: sedeMunicipality.get(hospital.reps_code as string)?.municipio_sede_nombre ?? null,
      }))
    const orphans = linkedRows
      .filter(hospital => !sedeMunicipality.has(hospital.reps_code as string))
      .map(hospital => ({ id: hospital.id, name: hospital.name, reps_code: hospital.reps_code }))

    return NextResponse.json({ counts, cut, pending, otherMunicipality, orphans })
  } catch (error) {
    return serverError('hospitals/reps/summary GET', error)
  }
}
