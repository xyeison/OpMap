'use client'

// Fase 3 · Ficha de la IPS: servicios habilitados y capacidad instalada importados del REPS
// (GET /api/hospitals/[id]/reps-services). Solo lectura; se incluye en una línea en app/hospitals/[id].

import { useEffect, useMemo, useState } from 'react'
import { CAPACITY_GROUP_LABELS, SERVICE_FLAG_KEYS, SERVICE_FLAG_LABELS, type CapacityGroup } from '@/lib/reps-import-fields'

interface RepsService {
  reps_code: string
  service_code: string
  service_name: string | null
  group_name: string | null
  complexity: string | null
  modality: string
}

interface RepsCapacity {
  reps_code: string
  group_name: CapacityGroup
  concept: string
  quantity: number
}

interface RepsSummary {
  quirofanos: number | null
  reps_beds: number | null
  service_flags: Record<string, boolean> | null
  reps_services_count: number | null
  reps_updated_at: string | null
}

interface RepsData {
  available: boolean
  summary: RepsSummary | null
  services: RepsService[]
  capacity: RepsCapacity[]
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function HospitalRepsPanel({ hospitalId }: { hospitalId: string }) {
  const [data, setData] = useState<RepsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showServices, setShowServices] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    fetch(`/api/hospitals/${hospitalId}/reps-services`)
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || 'No se pudieron cargar los datos del REPS')
        if (!cancelled) setData(body as RepsData)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [hospitalId])

  // Un servicio por código (las modalidades se juntan), agrupado por grupo del REPS
  const servicesByGroup = useMemo(() => {
    const groups = new Map<string, Map<string, { name: string; code: string; complexity: Set<string>; modality: Set<string> }>>()
    ;(data?.services || []).forEach(service => {
      const group = service.group_name || 'Sin grupo'
      if (!groups.has(group)) groups.set(group, new Map())
      const byCode = groups.get(group)!
      const current = byCode.get(service.service_code) || {
        name: service.service_name || service.service_code,
        code: service.service_code,
        complexity: new Set<string>(),
        modality: new Set<string>(),
      }
      if (service.complexity) current.complexity.add(service.complexity)
      if (service.modality) current.modality.add(service.modality)
      byCode.set(service.service_code, current)
    })
    return Array.from(groups.entries()).map(([group, byCode]) => ({ group, services: Array.from(byCode.values()) }))
  }, [data])

  const summary = data?.summary
  const flags = summary?.service_flags || {}
  const activeFlags = SERVICE_FLAG_KEYS.filter(key => flags[key] === true)
  const hasData = Boolean(summary?.reps_updated_at) || (data?.services.length || 0) > 0 || (data?.capacity.length || 0) > 0

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold text-gray-900">Servicios y capacidad (REPS)</h2>
        {summary?.reps_updated_at && (
          <span className="text-xs text-gray-500">Última importación: {formatDate(summary.reps_updated_at)}</span>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="text-sm text-gray-500">Cargando…</p>}
      {data && (!data.available || !hasData) && (
        <p className="text-sm text-gray-500">
          Sin datos del REPS todavía. Un administrador o gestor de datos puede cargarlos en Hospitales → &quot;Importar del REPS&quot;.
        </p>
      )}

      {data && data.available && hasData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Quirófanos</div>
              <div className="text-lg font-semibold text-gray-900">{summary?.quirofanos ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Camas (REPS)</div>
              <div className="text-lg font-semibold text-gray-900">{summary?.reps_beds ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Servicios habilitados</div>
              <div className="text-lg font-semibold text-gray-900">{summary?.reps_services_count ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Sede REPS</div>
              <div className="text-sm font-medium text-gray-900 break-all">
                {data.services[0]?.reps_code || data.capacity[0]?.reps_code || '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">Servicios prioritarios</div>
            {activeFlags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFlags.map(key => (
                  <span key={key} className="px-2 py-1 rounded-full text-xs font-medium bg-gray-900 text-white">
                    {SERVICE_FLAG_LABELS[key]}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {Object.keys(flags).length > 0 ? 'Ninguno de los servicios prioritarios está habilitado.' : 'Sin servicios importados.'}
              </p>
            )}
          </div>

          {data.capacity.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-2">Capacidad instalada</div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {data.capacity.map(row => (
                      <tr key={`${row.group_name}|${row.concept}`}>
                        <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">{CAPACITY_GROUP_LABELS[row.group_name] || row.group_name}</td>
                        <td className="py-1 pr-3 text-gray-900">{row.concept}</td>
                        <td className="py-1 text-right font-medium text-gray-900">{row.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {servicesByGroup.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowServices(!showServices)}
                className="text-sm font-medium text-gray-900 underline underline-offset-2"
                aria-expanded={showServices}
              >
                {showServices ? 'Ocultar servicios habilitados' : `Ver servicios habilitados (${summary?.reps_services_count ?? data.services.length})`}
              </button>
              {showServices && (
                <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                  {servicesByGroup.map(({ group, services }) => (
                    <div key={group}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{group}</div>
                      <ul className="space-y-1">
                        {services.map(service => (
                          <li key={service.code} className="text-sm text-gray-800">
                            <span className="text-gray-500 mr-1">{service.code}</span>
                            {service.name}
                            {(service.complexity.size > 0 || service.modality.size > 0) && (
                              <span className="ml-1 text-xs text-gray-500">
                                ({[...Array.from(service.complexity), ...Array.from(service.modality)].join(' · ')})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
