import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, fetchAllRows, isUuid, readJsonBody, serverError } from '../../_lib/api-error'
import {
  distanceMatrix,
  googleRoutesDisabled,
  MAX_DESTINATIONS,
} from '../../_lib/google-distance-matrix'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 segundos máximo

// Calcula con Google Distance Matrix los tiempos de pares {hospital_id, kam_id} y los guarda en
// hospital_kam_distances (SEGUNDOS). Seguridad (R2-C-01 / A-06):
//  - Sesión propia + permiso 'recalculate:complete' (admin): genera gasto en Google.
//  - Del cliente solo se leen hospital_id y kam_id; las coordenadas salen de hospitals/kams.
//  - Como mucho MAX_PAIRS_PER_REQUEST pares por petición (ventana batchStart, compatible con
//    components/RouteCalculator.tsx, que sigue batch.nextStart).
//  - Los pares que ya existen no se recalculan ni se sobrescriben salvo overwrite === true.
//  - Una llamada a Google por KAM con hasta 25 destinos.

const MAX_PAIRS_PER_REQUEST = 200
const MAX_LIST_LENGTH = 20000
const TIME_BUDGET_MS = 50_000

interface Pair {
  hospital_id: string
  kam_id: string
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'recalculate:complete')
  if (!auth.ok) return auth.response
  const user = auth.user

  try {
    if (googleRoutesDisabled()) {
      return NextResponse.json(
        { error: 'El cálculo de rutas con Google está deshabilitado temporalmente' },
        { status: 503 }
      )
    }

    const body = (await readJsonBody(request)) as
      | { routes?: unknown; pairs?: unknown; saveToDatabase?: unknown; batchStart?: unknown; overwrite?: unknown }
      | undefined
    if (!body || typeof body !== 'object') return badJson()

    const rawList = Array.isArray(body.pairs) ? body.pairs : body.routes
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json({ error: 'No se proporcionaron rutas' }, { status: 400 })
    }
    if (rawList.length > MAX_LIST_LENGTH) {
      return NextResponse.json({ error: 'Demasiadas rutas en la petición' }, { status: 400 })
    }

    // Solo hospital_id / kam_id (cualquier coordenada enviada se ignora)
    const allPairs: Pair[] = []
    for (const item of rawList) {
      const hospitalId = (item as any)?.hospital_id
      const kamId = (item as any)?.kam_id
      if (!isUuid(hospitalId) || !isUuid(kamId)) {
        return NextResponse.json(
          { error: 'Cada ruta debe tener hospital_id y kam_id válidos' },
          { status: 400 }
        )
      }
      allPairs.push({ hospital_id: hospitalId, kam_id: kamId })
    }

    const batchStartRaw = Number(body.batchStart ?? 0)
    const batchStart = Number.isInteger(batchStartRaw) && batchStartRaw >= 0 ? batchStartRaw : 0
    const saveToDatabase = body.saveToDatabase === true
    const overwrite = body.overwrite === true

    // Ventana de esta petición, sin duplicados
    const seen = new Set<string>()
    const windowPairs = allPairs.slice(batchStart, batchStart + MAX_PAIRS_PER_REQUEST).filter(p => {
      const key = `${p.hospital_id}-${p.kam_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const hasMore = batchStart + MAX_PAIRS_PER_REQUEST < allPairs.length
    const currentBatch = Math.floor(batchStart / MAX_PAIRS_PER_REQUEST) + 1
    const totalBatches = Math.ceil(allPairs.length / MAX_PAIRS_PER_REQUEST)

    const startTime = Date.now()

    const hospitalIds = Array.from(new Set(windowPairs.map(p => p.hospital_id)))
    const kamIds = Array.from(new Set(windowPairs.map(p => p.kam_id)))

    // Coordenadas desde la BD (solo entidades activas)
    const [hospitalsRes, kamsRes] = await Promise.all([
      supabaseAdmin.from('hospitals').select('id, name, lat, lng').in('id', hospitalIds).eq('active', true),
      supabaseAdmin.from('kams').select('id, name, lat, lng').in('id', kamIds).eq('active', true),
    ])
    if (hospitalsRes.error) return serverError('calculate-batch-secure (hospitales)', hospitalsRes.error)
    if (kamsRes.error) return serverError('calculate-batch-secure (kams)', kamsRes.error)

    const hospitals = new Map((hospitalsRes.data || []).map(h => [h.id, h]))
    const kams = new Map((kamsRes.data || []).map(k => [k.id, k]))

    // Pares ya existentes en hospital_kam_distances
    const { data: existingRows, error: existingError } = await fetchAllRows<{ hospital_id: string; kam_id: string }>(
      (from, to) =>
        supabaseAdmin
          .from('hospital_kam_distances')
          .select('hospital_id, kam_id')
          .in('hospital_id', hospitalIds)
          .in('kam_id', kamIds)
          .order('id')
          .range(from, to)
    )
    if (existingError) return serverError('calculate-batch-secure (existentes)', existingError)
    const existing = new Set(existingRows.map(r => `${r.hospital_id}-${r.kam_id}`))

    const failedResults: { hospital_id: string; kam_id: string; error: string }[] = []
    const toCalculate: Pair[] = []
    let skippedExisting = 0

    for (const pair of windowPairs) {
      const hospital = hospitals.get(pair.hospital_id)
      const kam = kams.get(pair.kam_id)
      if (!hospital || !kam || hospital.lat == null || hospital.lng == null || kam.lat == null || kam.lng == null) {
        failedResults.push({ ...pair, error: 'Hospital o KAM no encontrado, inactivo o sin coordenadas' })
        continue
      }
      if (existing.has(`${pair.hospital_id}-${pair.kam_id}`) && !overwrite) {
        skippedExisting++
        continue
      }
      toCalculate.push(pair)
    }

    const overwriteCount = toCalculate.filter(p => existing.has(`${p.hospital_id}-${p.kam_id}`)).length
    if (overwrite && overwriteCount > 0) {
      console.warn(
        `[calculate-batch-secure] overwrite=true: usuario=${user.id} (${user.email}) recalculará y sobrescribirá ${overwriteCount} pares existentes`
      )
    }

    // Agrupar por KAM: una llamada a Google por KAM con hasta 25 destinos
    const byKam = new Map<string, Pair[]>()
    for (const pair of toCalculate) {
      const list = byKam.get(pair.kam_id) || []
      list.push(pair)
      byKam.set(pair.kam_id, list)
    }

    const successfulResults: {
      hospital_id: string
      hospital_name: string
      kam_id: string
      kam_name: string
      travel_time: number
      distance: number | null
    }[] = []
    let googleElements = 0
    let googleCalls = 0
    let stoppedByTimeBudget = false

    const processed = new Set<string>()

    outer: for (const [kamId, pairs] of Array.from(byKam.entries())) {
      const kam = kams.get(kamId)!
      for (let i = 0; i < pairs.length; i += MAX_DESTINATIONS) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          stoppedByTimeBudget = true
          break outer
        }

        const chunk = pairs.slice(i, i + MAX_DESTINATIONS)
        const destinations = chunk.map(p => {
          const h = hospitals.get(p.hospital_id)!
          return { lat: Number(h.lat), lng: Number(h.lng) }
        })

        const matrix = await distanceMatrix([{ lat: Number(kam.lat), lng: Number(kam.lng) }], destinations)
        googleCalls++
        googleElements += matrix.elementsBilled

        chunk.forEach((pair, index) => {
          processed.add(`${pair.hospital_id}-${pair.kam_id}`)
          const element = matrix.ok ? matrix.rows[0]?.[index] : undefined
          if (element?.ok && element.durationSeconds !== null) {
            successfulResults.push({
              hospital_id: pair.hospital_id,
              hospital_name: hospitals.get(pair.hospital_id)!.name,
              kam_id: pair.kam_id,
              kam_name: kam.name,
              travel_time: element.durationSeconds, // SEGUNDOS
              distance: element.distanceKm,
            })
          } else {
            failedResults.push({
              ...pair,
              error: matrix.ok ? `Ruta no encontrada (${element?.status ?? 'sin dato'})` : 'Error de Google Maps',
            })
          }
        })
      }
    }

    if (stoppedByTimeBudget) {
      for (const pair of toCalculate) {
        if (!processed.has(`${pair.hospital_id}-${pair.kam_id}`)) {
          failedResults.push({ ...pair, error: 'Tiempo agotado; reintentar' })
        }
      }
    }

    console.info(
      `[google-distance-matrix] calculate-batch-secure usuario=${user.id} llamadas=${googleCalls} elementos=${googleElements}`
    )

    // Guardar
    let savedCount = 0
    let saveFailed = false
    if (saveToDatabase && successfulResults.length > 0) {
      const now = new Date().toISOString()
      const rows = successfulResults.map(r => ({
        hospital_id: r.hospital_id,
        kam_id: r.kam_id,
        travel_time: r.travel_time,
        distance: r.distance,
        source: 'google_maps',
        calculated_at: now,
        updated_at: now,
      }))

      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100)
        const { data: saved, error: saveError } = await supabaseAdmin
          .from('hospital_kam_distances')
          .upsert(chunk, { onConflict: 'hospital_id,kam_id', ignoreDuplicates: !overwrite })
          .select('id')

        if (saveError) {
          saveFailed = true
          console.error('calculate-batch-secure: error guardando lote', saveError)
        } else {
          savedCount += saved?.length || 0
        }
      }
    }

    const totalTime = (Date.now() - startTime) / 1000

    return NextResponse.json({
      success: true,
      batch: {
        current: currentBatch,
        total: totalBatches,
        start: batchStart,
        size: windowPairs.length,
        hasMore,
        nextStart: hasMore ? batchStart + MAX_PAIRS_PER_REQUEST : null,
      },
      calculated: successfulResults.length,
      failed: failedResults.length,
      skippedExisting,
      saved: savedCount,
      saveErrors: saveFailed ? ['Algunos lotes no se pudieron guardar'] : undefined,
      errors: failedResults.length > 0 ? failedResults : undefined,
      stoppedByTimeBudget,
      googleCalls,
      googleElements,
      totalTime: totalTime.toFixed(2),
      costEstimate: `$${(googleElements * 0.005).toFixed(2)} USD`,
    })
  } catch (error) {
    return serverError('calculate-batch-secure', error, 'Error al calcular rutas')
  }
}
