'use client'

// Fase 3 · "Cruce REPS": cuántas IPS están vinculadas a su sede del REPS (código de habilitación) y cuáles
// quedan ambiguas o sin cruce, con enlace a la ficha para vincularlas a mano. Permiso hospitals:view.
// Datos: GET /api/hospitals/reps/summary.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

interface PendingRow {
  id: string
  name: string
  code: string | null
  nit: string | null
  municipality_name: string | null
  locality_name: string | null
  active: boolean | null
  status: 'ambiguous' | 'unmatched' | null
  live_status: 'matched' | 'ambiguous' | 'unmatched' | null
  reason: string | null
  candidates: number
  suggested: { codigo_habilitacion: string; nombre_sede: string } | null
}

interface Summary {
  counts: { matched: number; ambiguous: number; unmatched: number; not_evaluated: number; total: number }
  cut: { fecha_corte: string | null; total: number }
  pending: PendingRow[]
  otherMunicipality: Array<{ id: string; name: string; municipality_name: string | null; reps_code: string; sede_municipality: string | null }>
  orphans: Array<{ id: string; name: string; reps_code: string }>
}

type Filter = 'all' | 'ambiguous' | 'unmatched' | 'none'

const STATUS_LABELS: Record<string, string> = {
  ambiguous: 'Ambigua',
  unmatched: 'Sin cruce',
  none: 'Sin evaluar',
}

function formatDate(value: string | null): string {
  if (!value) return 'sin dato'
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function StatCard({ label, value, hint, active, onClick }: { label: string; value: number; hint?: string; active?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition-colors ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white text-gray-900 hover:bg-gray-50'
      } shadow-sm`}
    >
      <p className="text-3xl font-bold">{value.toLocaleString('es-CO')}</p>
      <p className={`mt-1 text-sm ${active ? 'text-gray-200' : 'text-gray-600'}`}>{label}</p>
      {hint && <p className={`mt-1 text-xs ${active ? 'text-gray-300' : 'text-gray-500'}`}>{hint}</p>}
    </Tag>
  )
}

export default function RepsCrossPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery<Summary>({
    queryKey: ['hospitals-reps-summary'],
    queryFn: async () => {
      const response = await fetch('/api/hospitals/reps/summary')
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo cargar el cruce con el REPS')
      return body as Summary
    },
  })

  const rows = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    return (data?.pending ?? []).filter(row => {
      const status = row.status ?? 'none'
      if (filter !== 'all' && status !== filter) return false
      if (!term) return true
      const haystack = `${row.name} ${row.code ?? ''} ${row.municipality_name ?? ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return haystack.includes(term)
    })
  }, [data, filter, search])

  const total = data?.counts.total ?? 0
  const percent = total > 0 ? Math.round(((data?.counts.matched ?? 0) / total) * 1000) / 10 : 0

  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="hospitals:view"
        fallback={<div className="container mx-auto p-6 text-gray-600">No tienes permiso para ver las IPS.</div>}
      >
        <div className="container mx-auto p-6">
          <div className="mb-8">
            <Link href="/hospitals" className="mb-4 inline-flex items-center gap-2 font-medium text-gray-700 hover:text-gray-900">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Volver a hospitales
            </Link>
            <h1 className="text-4xl font-bold text-gray-900">Cruce REPS</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Cada IPS se identifica por el código de habilitación de su sede en el REPS (un NIT puede tener varias sedes).
              Las ambiguas y las sin cruce se vinculan a mano desde su ficha, en la sección &quot;Sede REPS&quot;.
            </p>
            {data && (
              <p className="mt-2 text-sm text-gray-500">
                REPS cargado: {data.cut.total.toLocaleString('es-CO')} sedes (IPS, objeto social diferente y transporte especial),
                corte del {formatDate(data.cut.fecha_corte)}.
              </p>
            )}
          </div>

          {isLoading && <p className="text-gray-500">Cargando...</p>}
          {error && <p className="text-red-700">{(error as Error).message}</p>}

          {data && (
            <>
              <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Vinculadas a su sede" value={data.counts.matched} hint={`${percent}% de ${total} IPS`} />
                <StatCard
                  label="Ambiguas"
                  value={data.counts.ambiguous}
                  hint="Varias sedes posibles"
                  active={filter === 'ambiguous'}
                  onClick={() => setFilter(filter === 'ambiguous' ? 'all' : 'ambiguous')}
                />
                <StatCard
                  label="Sin cruce"
                  value={data.counts.unmatched}
                  hint="Ninguna sede con ese NIT"
                  active={filter === 'unmatched'}
                  onClick={() => setFilter(filter === 'unmatched' ? 'all' : 'unmatched')}
                />
                <StatCard
                  label="Sin evaluar"
                  value={data.counts.not_evaluated}
                  hint="Creadas después del último cruce"
                  active={filter === 'none'}
                  onClick={() => setFilter(filter === 'none' ? 'all' : 'none')}
                />
              </div>

              <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Por vincular ({rows.length}
                    {filter !== 'all' ? ` · ${STATUS_LABELS[filter]}` : ''})
                  </h2>
                  <input
                    type="text"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Buscar por nombre, NIT o municipio"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-700 sm:w-80"
                  />
                </div>
                {rows.length === 0 ? (
                  <p className="text-gray-500">No hay IPS en esta lista.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600">
                          <th className="py-2 pr-4 font-medium">IPS</th>
                          <th className="py-2 pr-4 font-medium">Municipio</th>
                          <th className="py-2 pr-4 font-medium">Estado</th>
                          <th className="py-2 pr-4 font-medium">Motivo</th>
                          <th className="py-2 pr-4 font-medium">Sugerida</th>
                          <th className="py-2 text-right font-medium">Sedes del NIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => (
                          <tr key={row.id} className="border-b align-top hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <Link href={`/hospitals/${row.id}`} className="font-medium text-gray-900 underline-offset-2 hover:underline">
                                {row.name}
                              </Link>
                              <p className="text-xs text-gray-500">
                                {row.code}
                                {row.active === false ? ' · inactiva' : ''}
                              </p>
                            </td>
                            <td className="py-3 pr-4 text-gray-700">
                              {row.municipality_name}
                              {row.locality_name ? ` – ${row.locality_name}` : ''}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  row.status === 'ambiguous' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {STATUS_LABELS[row.status ?? 'none']}
                              </span>
                            </td>
                            <td className="max-w-md py-3 pr-4 text-gray-600">{row.reason}</td>
                            <td className="py-3 pr-4 text-gray-700">
                              {row.suggested ? (
                                <>
                                  <span className="font-mono text-xs">{row.suggested.codigo_habilitacion}</span>
                                  <p className="text-xs text-gray-500">{row.suggested.nombre_sede}</p>
                                </>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="py-3 text-right text-gray-700">{row.candidates}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {(data.otherMunicipality.length > 0 || data.orphans.length > 0) && (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Vinculadas para revisar</h2>
                  {data.otherMunicipality.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2 text-sm text-gray-600">La sede del REPS está en otro municipio que la IPS (revisar el municipio de la IPS):</p>
                      <ul className="space-y-1 text-sm">
                        {data.otherMunicipality.map(row => (
                          <li key={row.id}>
                            <Link href={`/hospitals/${row.id}`} className="font-medium text-gray-900 hover:underline">
                              {row.name}
                            </Link>
                            <span className="text-gray-600">
                              {' '}
                              · IPS en {row.municipality_name ?? 'sin municipio'}, sede {row.reps_code} en {row.sede_municipality ?? 'otro municipio'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.orphans.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm text-gray-600">La sede vinculada ya no está en el REPS cargado:</p>
                      <ul className="space-y-1 text-sm">
                        {data.orphans.map(row => (
                          <li key={row.id}>
                            <Link href={`/hospitals/${row.id}`} className="font-medium text-gray-900 hover:underline">
                              {row.name}
                            </Link>
                            <span className="text-gray-600"> · {row.reps_code}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}
