import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import {
  distanceMatrix,
  googleRoutesDisabled,
  MAX_ORIGINS,
} from '../../_lib/google-distance-matrix'
import {
  eligibleKamsForHospital,
  hasValidKamArea,
  isBaseTerritory,
  loadAdjacency,
  type EligibilityKam,
} from '../../_lib/kam-eligibility'
import {
  bogotaSectorCell,
  competeForHospital,
  isBogotaKam,
  loadBogotaRule,
  type BogotaAssignmentDetail,
  type BogotaSectorDetail,
} from '@/lib/opmap-algorithm-simplified'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Asigna una IPS recién creada (o sin asignación) a su KAM siguiendo las reglas del algoritmo:
//   0. asignación forzada del territorio, 0b. IPS de Bogotá: la celda del sector (corredor) de su localidad
//   (bogotaSectorCell, 2026-10-28), 1. territorio base, 2. competencia por tiempo real entre KAMs elegibles
//   (mismo departamento / adyacentes N1-N2 / regla Bogotá), con las mismas funciones que el recálculo completo
//   (competeForHospital, incluida "Bogotá como una ciudad" por corredores).
// Las coordenadas y el territorio se leen SIEMPRE de public.hospitals (se ignora lo que mande el
// cliente). Los tiempos se leen/escriben en hospital_kam_distances en SEGUNDOS, y solo se llama a
// Google para los pares que faltan, en una petición con hasta 25 orígenes.
// La regla de mayoría por camas de Bogotá la aplica el siguiente recálculo completo.

type Kam = EligibilityKam & { participates_in_assignment: boolean | null }

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'hospitals:edit')
  if (!auth.ok) return auth.response

  try {
    const body = (await readJsonBody(request)) as { hospitalId?: unknown } | undefined
    if (!body || typeof body !== 'object') return badJson()

    const hospitalId = body.hospitalId
    if (!isUuid(hospitalId)) {
      return NextResponse.json({ error: 'hospitalId es requerido' }, { status: 400 })
    }

    // 1. Validaciones previas a cualquier llamada a Google
    const { data: hospital, error: hospitalError } = await supabaseAdmin
      .from('hospitals')
      .select('id, name, lat, lng, municipality_id, department_id, locality_id, active')
      .eq('id', hospitalId)
      .maybeSingle()

    if (hospitalError) return serverError('assign-to-kam (hospital)', hospitalError)
    if (!hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }
    if (hospital.active !== true) {
      return NextResponse.json({ error: 'El hospital está inactivo' }, { status: 409 })
    }
    if (hospital.lat === null || hospital.lng === null) {
      return NextResponse.json({ error: 'El hospital no tiene coordenadas' }, { status: 422 })
    }

    const { data: existingAssignment, error: existingError } = await supabaseAdmin
      .from('assignments')
      .select('id')
      .eq('hospital_id', hospitalId)
      .maybeSingle()

    if (existingError) return serverError('assign-to-kam (asignación existente)', existingError)
    if (existingAssignment) {
      return NextResponse.json({ error: 'El hospital ya tiene un Ejecutivo Comercial asignado' }, { status: 409 })
    }

    // KAMs que participan en la asignación territorial (mismo criterio que el algoritmo)
    const { data: kamsData, error: kamsError } = await supabaseAdmin
      .from('kams')
      .select('id, name, area_id, lat, lng, enable_level2, max_travel_time, priority, participates_in_assignment')
      .eq('active', true)
      .eq('participates_in_assignment', true)
      .order('name')

    if (kamsError) return serverError('assign-to-kam (kams)', kamsError)
    // area_id === '11001' es una configuración inválida (mismo criterio que el algoritmo)
    const kams = ((kamsData || []) as Kam[]).filter(kam => {
      if (hasValidKamArea(kam)) return true
      console.warn(`assign-to-kam: KAM ${kam.id} excluido por area_id inválido (${kam.area_id})`)
      return false
    })
    if (kams.length === 0) {
      return NextResponse.json({ error: 'No hay zonas activas disponibles' }, { status: 422 })
    }

    const insertAssignment = async (row: {
      kam_id: string
      travel_time: number | null
      assignment_type: string
      is_base_territory: boolean
      detail?: BogotaAssignmentDetail | BogotaSectorDetail
    }) => {
      const { error } = await supabaseAdmin.from('assignments').insert({
        hospital_id: hospitalId,
        ...row,
        assigned_at: new Date().toISOString(),
      })
      return error
    }

    const respondInsertError = (error: { code?: string } | null, context: string) => {
      if (error?.code === '23505') {
        return NextResponse.json({ error: 'El hospital ya tiene un Ejecutivo Comercial asignado' }, { status: 409 })
      }
      return serverError(context, error, 'Error al guardar la asignación')
    }

    // 2. Asignación forzada del territorio (localidad o municipio)
    const territoryId = hospital.locality_id || hospital.municipality_id
    const { data: forced, error: forcedError } = await supabaseAdmin
      .from('forced_assignments')
      .select('kam_id, territory_name')
      .eq('territory_id', territoryId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (forcedError) return serverError('assign-to-kam (forzadas)', forcedError)

    const forcedKam = forced ? kams.find(k => k.id === forced.kam_id) : undefined
    if (forcedKam) {
      const { data: distanceRow } = await supabaseAdmin
        .from('hospital_kam_distances')
        .select('travel_time')
        .eq('hospital_id', hospitalId)
        .eq('kam_id', forcedKam.id)
        .maybeSingle()
      const travelTime = distanceRow?.travel_time ?? 0

      const insertError = await insertAssignment({
        kam_id: forcedKam.id,
        travel_time: travelTime,
        assignment_type: 'forced',
        is_base_territory: false,
      })
      if (insertError) return respondInsertError(insertError, 'assign-to-kam (insert forzada)')

      return NextResponse.json({
        success: true,
        kamId: forcedKam.id,
        kamName: forcedKam.name,
        travelTime,
        travelTimeMinutes: Math.round(travelTime / 60),
        isBaseTerritory: false,
        assignmentType: 'forced',
        googleElements: 0,
      })
    }

    // 2b. Bogotá por sectores: la celda del corredor de la localidad, antes del territorio base y sin minutos (la
    // sector manda aunque en la localidad viva la celda de otro sector). Tiempo real si ya existe.
    const { rule: bogotaRule } = await loadBogotaRule()
    const sector = bogotaSectorCell(hospital, bogotaRule, new Set(kams.filter(isBogotaKam).map(kam => kam.id)), () => null)
    const sectorKam = sector ? kams.find(k => k.id === sector.kam_id) : undefined
    if (sector && sectorKam) {
      const { data: distanceRow, error: distanceError } = await supabaseAdmin
        .from('hospital_kam_distances')
        .select('travel_time')
        .eq('hospital_id', hospitalId)
        .eq('kam_id', sectorKam.id)
        .maybeSingle()
      if (distanceError) return serverError('assign-to-kam (distancia del sector)', distanceError)
      const travelTime: number | null = distanceRow?.travel_time ?? null

      const insertError = await insertAssignment({
        kam_id: sectorKam.id,
        travel_time: travelTime,
        assignment_type: 'bogota_corredor',
        is_base_territory: false,
        detail: sector.detail,
      })
      if (insertError) return respondInsertError(insertError, 'assign-to-kam (insert sector de Bogotá)')

      return NextResponse.json({
        success: true,
        kamId: sectorKam.id,
        kamName: sectorKam.name,
        travelTime,
        travelTimeMinutes: travelTime === null ? null : Math.round(travelTime / 60),
        isBaseTerritory: false,
        assignmentType: 'bogota_corredor',
        googleElements: 0,
      })
    }

    // 3. Territorio base (orden por nombre para que sea determinista)
    const baseKam = kams.find(k => isBaseTerritory(k, hospital))
    if (baseKam) {
      const insertError = await insertAssignment({
        kam_id: baseKam.id,
        travel_time: 0,
        assignment_type: 'base_territory',
        is_base_territory: true,
      })
      if (insertError) return respondInsertError(insertError, 'assign-to-kam (insert base)')

      return NextResponse.json({
        success: true,
        kamId: baseKam.id,
        kamName: baseKam.name,
        travelTime: 0,
        travelTimeMinutes: 0,
        isBaseTerritory: true,
        assignmentType: 'base_territory',
        googleElements: 0,
      })
    }

    // 4. Departamentos excluidos: el algoritmo no les hace asignación competitiva
    const { data: department, error: departmentError } = await supabaseAdmin
      .from('departments')
      .select('excluded')
      .eq('code', hospital.department_id)
      .maybeSingle()
    if (departmentError) return serverError('assign-to-kam (departamento)', departmentError)
    if (department?.excluded) {
      return NextResponse.json(
        { error: 'El hospital está en un departamento excluido del análisis; queda sin asignar' },
        { status: 422 }
      )
    }

    // 5. Competencia: solo KAMs elegibles por geografía
    const adjacency = await loadAdjacency(supabaseAdmin)
    const candidates = eligibleKamsForHospital(kams, hospital, adjacency)
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: 'Ninguna zona puede competir por este hospital según la matriz de adyacencia' },
        { status: 422 }
      )
    }

    // Tiempos ya calculados (segundos)
    const { data: knownRows, error: knownError } = await supabaseAdmin
      .from('hospital_kam_distances')
      .select('kam_id, travel_time')
      .eq('hospital_id', hospitalId)
      .in('kam_id', candidates.map(k => k.id))
    if (knownError) return serverError('assign-to-kam (distancias)', knownError)

    const times = new Map<string, number>()
    for (const row of knownRows || []) {
      if (row.travel_time !== null) times.set(row.kam_id, row.travel_time)
    }

    // Pares que faltan: una petición a Google con hasta 25 orígenes (KAMs) y 1 destino (IPS)
    const missing = candidates.filter(k => !times.has(k.id))
    let googleElements = 0

    if (missing.length > 0) {
      if (googleRoutesDisabled()) {
        return NextResponse.json(
          { error: 'El cálculo de rutas con Google está deshabilitado temporalmente' },
          { status: 503 }
        )
      }

      const destination = { lat: Number(hospital.lat), lng: Number(hospital.lng) }
      const upserts: Record<string, unknown>[] = []

      for (let i = 0; i < missing.length; i += MAX_ORIGINS) {
        const chunk = missing.slice(i, i + MAX_ORIGINS)
        const matrix = await distanceMatrix(
          chunk.map(k => ({ lat: Number(k.lat), lng: Number(k.lng) })),
          [destination]
        )
        googleElements += matrix.elementsBilled
        if (!matrix.ok) continue

        chunk.forEach((kam, index) => {
          const element = matrix.rows[index]?.[0]
          if (element?.ok && element.durationSeconds !== null) {
            times.set(kam.id, element.durationSeconds)
            const now = new Date().toISOString()
            upserts.push({
              hospital_id: hospitalId,
              kam_id: kam.id,
              travel_time: element.durationSeconds, // SEGUNDOS
              distance: element.distanceKm,
              source: 'google_maps',
              calculated_at: now,
              updated_at: now,
            })
          }
        })
      }

      console.info(
        `[google-distance-matrix] assign-to-kam hospital=${hospitalId} usuario=${auth.user.id} elementos=${googleElements}`
      )

      if (upserts.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('hospital_kam_distances')
          .upsert(upserts, { onConflict: 'hospital_id,kam_id' })
        if (upsertError) {
          // Se continúa con la asignación: los tiempos ya están en memoria
          console.error('assign-to-kam: error guardando hospital_kam_distances', upsertError)
        }
      }
    }

    // 6. Mejor zona con la MISMA regla que el recálculo completo (competeForHospital): menor tiempo
    // dentro del tope; empate -> mayor prioridad; Bogotá compite como una ciudad hacia afuera y la
    // celda la decide el corredor cuando hay configuración (bogota_config + bogota_corredores).
    const outcome = competeForHospital(
      hospital,
      kams.map(kam => ({ ...kam, max_travel_time: kam.max_travel_time ?? 240, priority: kam.priority ?? 0 })),
      adjacency,
      kamId => times.get(kamId) ?? null,
      bogotaRule
    )
    const bestKam = outcome ? kams.find(k => k.id === outcome.kam_id) ?? null : null

    if (!outcome || !bestKam) {
      return NextResponse.json(
        {
          error: 'No se encontró ninguna zona dentro de su tiempo máximo de viaje',
          googleElements,
        },
        { status: 422 }
      )
    }
    const bestTime = outcome.travel_time // SEGUNDOS

    const insertError = await insertAssignment({
      kam_id: bestKam.id,
      travel_time: bestTime, // SEGUNDOS
      assignment_type: outcome.assignment_type,
      is_base_territory: false,
      ...(outcome.detail ? { detail: outcome.detail } : {}),
    })
    if (insertError) return respondInsertError(insertError, 'assign-to-kam (insert competitiva)')

    return NextResponse.json({
      success: true,
      kamId: bestKam.id,
      kamName: bestKam.name,
      travelTime: bestTime,
      travelTimeMinutes: Math.round(bestTime / 60),
      isBaseTerritory: false,
      assignmentType: outcome.assignment_type,
      googleElements,
    })
  } catch (error) {
    return serverError('assign-to-kam', error)
  }
}
