'use client'

// Banner de la lista de IPS: IPS pendientes de rutas y asignación y botón "Calcular rutas y asignar
// pendientes". Crear, editar la ubicación o activar una IPS ya no recalcula el territorio; esta acción lo
// hace en bloque: fase A (tiempos que faltan, por lotes) y fase B (recálculo completo UNA vez).
// API: GET /api/hospitals/pending-assignment y POST /api/hospitals/process-pending
// (app/api/_lib/pending-assignment.ts).

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/usePermissions'

interface PendingItem {
  id: string
  name: string
  municipality_name: string | null
  reason: string
  missingPairs: number
}

interface PendingSummary {
  count: number
  pairsMissing: number
  costEstimateUsd: number
  items: PendingItem[]
  truncated: boolean
  withoutZone: number
  withoutCoordinates: number
  lastRecalculationAt: string | null
  routesDisabled: boolean
}

interface RunState {
  running: boolean
  batches: number
  hospitalsDone: number
  hospitalsTotal: number
  calculated: number
  noRoute: number
  failed: number
  googleElements: number
  status: string
}

interface RunResult {
  ok: boolean
  message: string
  details: string[]
}

const MAX_BATCHES = 500 // salvaguarda: nunca un bucle sin fin
const GOOGLE_COST_PER_ELEMENT_USD = 0.005 // mismo precio que app/api/_lib/hospital-routes.ts
const formatUsd = (value: number) => value.toFixed(2)

export const PENDING_QUERY_KEY = ['hospitals-pending']

export default function PendingAssignmentBanner() {
  const queryClient = useQueryClient()
  const { can } = usePermissions()
  const [showList, setShowList] = useState(false)
  const [run, setRun] = useState<RunState | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)

  const { data, isLoading, error, refetch } = useQuery<PendingSummary>({
    queryKey: PENDING_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/hospitals/pending-assignment')
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Error al cargar las IPS pendientes')
      return body as PendingSummary
    },
  })

  const processPending = async () => {
    if (!data || run?.running) return
    // El costo se confirma con la cola recién leída (durante una carga masiva la caché puede estar vieja)
    const fresh = await refetch()
    if (fresh.error || !fresh.data) {
      setResult({ ok: false, message: 'No se pudo leer la cola de pendientes; vuelve a intentarlo', details: [] })
      return
    }
    const summary = fresh.data
    if (summary.count === 0) return
    const pairs = summary.pairsMissing
    const confirmMessage = summary.routesDisabled
      ? `El cálculo de rutas con Google está deshabilitado: no se calcularán las ${pairs} rutas que faltan. ` +
        'Se recalculará la asignación de TODAS las IPS con los tiempos que ya existen. ¿Continuar?'
      : pairs > 0
        ? `Se calcularán con Google Maps ~${pairs} rutas (≈ US$${formatUsd(summary.costEstimateUsd)}) y después se ` +
          'recalculará la asignación de TODAS las IPS (territorio completo). ¿Continuar?'
        : 'No faltan rutas. Se recalculará la asignación de TODAS las IPS (territorio completo), sin costo en Google. ¿Continuar?'
    if (!window.confirm(confirmMessage)) return

    setResult(null)
    const state: RunState = {
      running: true,
      batches: 0,
      hospitalsDone: 0,
      hospitalsTotal: summary.items.filter(item => item.missingPairs > 0).length,
      calculated: 0,
      noRoute: 0,
      failed: 0,
      googleElements: 0,
      status: pairs > 0 && !summary.routesDisabled ? 'Calculando rutas...' : 'Recalculando asignación...',
    }
    setRun({ ...state })

    const warnings = new Set<string>()
    let cursor: string | null = null
    try {
      for (let step = 0; step < MAX_BATCHES; step++) {
        const response: Response = await fetch('/api/hospitals/process-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor }),
        })
        const body: any = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Error al calcular rutas y asignar')
        for (const warning of Array.isArray(body.warnings) ? body.warnings : []) {
          if (typeof warning === 'string') warnings.add(warning)
        }

        if (body.phase === 'routes') {
          state.batches++
          state.hospitalsDone += Number(body.done) || 0
          state.hospitalsTotal = Math.max(state.hospitalsTotal, state.hospitalsDone + (Number(body.remaining) || 0))
          state.calculated += Number(body.calculated) || 0
          state.noRoute += Number(body.noRoute) || 0
          state.failed += Number(body.failed) || 0
          state.googleElements += Number(body.googleElements) || 0
          state.status = body.hasMore
            ? `Lote ${state.batches}: rutas de ${state.hospitalsDone} de ${state.hospitalsTotal} IPS...`
            : 'Rutas listas. Recalculando la asignación de todas las IPS...'
          setRun({ ...state })
          if (!body.nextCursor || body.nextCursor === cursor) throw new Error('El cálculo de rutas no avanzó')
          cursor = body.nextCursor
          continue
        }

        if (body.phase === 'assigned') {
          const details: string[] = [`${body.assignments} asignaciones guardadas.`]
          if (state.googleElements > 0 || state.calculated > 0) {
            details.push(
              `${state.calculated} rutas calculadas en ${state.batches} lote(s) · coste estimado US$${formatUsd(state.googleElements * GOOGLE_COST_PER_ELEMENT_USD)}.`
            )
          }
          if (state.failed > 0) details.push(`${state.failed} rutas no se pudieron calcular (vuelve a intentarlo más tarde).`)
          if (body.municipalities?.recomputed) details.push('Mapa de municipios actualizado.')
          if (body.routesDisabled) details.push('El cálculo de rutas con Google estaba deshabilitado: se usaron los tiempos existentes.')
          details.push(...Array.from(warnings))
          setResult({ ok: true, message: 'Rutas calculadas y territorio recalculado.', details })
          break
        }

        throw new Error('Respuesta inesperada del servidor')
      }
    } catch (err: any) {
      setResult({
        ok: false,
        message: `No se pudo completar: ${err?.message || 'Error desconocido'}`,
        details: [
          ...(state.calculated > 0 ? [`${state.calculated} rutas ya quedaron guardadas; puedes volver a intentarlo.`] : []),
          ...Array.from(warnings),
        ],
      })
    } finally {
      setRun(null)
      queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      queryClient.invalidateQueries({ queryKey: ['map-data'] })
    }
  }

  if (isLoading) return null
  if (error) {
    return (
      <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
        {(error as Error).message}
      </div>
    )
  }
  if (!data) return null

  const resultBox = result && (
    <div
      className={`mt-4 p-3 rounded-lg text-sm border ${
        result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{result.message}</p>
          {result.details.length > 0 && (
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {result.details.map(detail => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={() => setResult(null)} className="text-xs underline whitespace-nowrap">
          Cerrar
        </button>
      </div>
    </div>
  )

  if (data.count === 0 && !run) {
    return result ? <div className="mb-6">{resultBox}</div> : null
  }

  const canProcess = can('recalculate:complete')
  const progressPercent =
    run && run.hospitalsTotal > 0 ? Math.min(100, Math.round((run.hospitalsDone / run.hospitalsTotal) * 100)) : null

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-amber-900">
            {data.count} IPS pendientes de rutas y asignación · ~{data.pairsMissing} rutas · ≈ US${formatUsd(data.costEstimateUsd)}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Crear, editar la ubicación o activar una IPS ya no recalcula el territorio. Cuando termines la carga, calcula
            las rutas que falten y asigna todas de una vez.
          </p>
          {data.routesDisabled && (
            <p className="text-sm text-amber-800 mt-1">
              El cálculo de rutas con Google está deshabilitado (GOOGLE_ROUTES_DISABLED): solo se puede recalcular la
              asignación con los tiempos existentes.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => setShowList(value => !value)}
            className="px-4 py-2 text-sm bg-white border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-100 transition-all"
          >
            {showList ? 'Ocultar pendientes' : 'Ver pendientes'}
          </button>
          {canProcess && (
            <button
              onClick={processPending}
              disabled={Boolean(run?.running)}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {run?.running ? 'Procesando...' : 'Calcular rutas y asignar pendientes'}
            </button>
          )}
        </div>
      </div>

      {run && (
        <div className="mt-4">
          <p className="text-sm text-amber-900">{run.status}</p>
          {progressPercent !== null && (
            <div className="mt-2 h-2 bg-amber-100 rounded-full overflow-hidden">
              <div className="h-full bg-gray-900 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
          {run.calculated > 0 && (
            <p className="text-xs text-amber-800 mt-1">
              {run.calculated} rutas calculadas · coste estimado US${formatUsd(run.googleElements * GOOGLE_COST_PER_ELEMENT_USD)}
            </p>
          )}
        </div>
      )}

      {resultBox}

      {showList && (
        <div className="mt-4 bg-white border border-amber-200 rounded-lg overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">IPS</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                    Municipio
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2">
                      <a href={`/hospitals/${item.id}`} className="text-gray-900 hover:underline">
                        {item.name}
                      </a>
                      <div className="text-xs text-gray-500 md:hidden">{item.municipality_name || '-'}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 hidden md:table-cell">{item.municipality_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-700">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.truncated && (
            <div className="bg-gray-50 px-4 py-2 text-xs text-gray-600">
              Mostrando {data.items.length} de {data.count} IPS pendientes
            </div>
          )}
        </div>
      )}
    </div>
  )
}
