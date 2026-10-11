'use client'

// Fase 3 · Inteligencia de giros directos de la ADRES (régimen subsidiado) por IPS, municipio, zona y
// Ejecutivo Comercial. Datos: GET /api/intelligence/giros (permiso intelligence:view).
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import GirosMonthlyChart from '@/components/GirosMonthlyChart'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCop, formatCopCompact, formatPct, monthLabel } from '@/lib/giros-format'

type Group = 'ips' | 'municipio' | 'zona' | 'ejecutivo'

interface MyLine {
  id: string
  code: string
  name: string
}

interface GirosRow {
  key: string
  label: string
  giro: number
  capitacion: number
  evento: number
  pct: number
  ips: number
  ipsConGiro: number
  camas: number
  hospital_id?: string
  nit?: string
  municipio?: string | null
  departamento?: string | null
  zona?: string | null
  ejecutivo?: string | null
  ejecutivo_color?: string | null
  giro_nit?: number
  sedes_nit?: number
  color?: string | null
  zonas?: string[]
  top_ips?: string | null
}

interface GirosResponse {
  group: Group
  line: { code: string; name: string } | null
  range: { desde: string; hasta: string; meses: number } | null
  available: { min: string; max: string } | null
  fetch: { nitsConsultados: number; conDatos: number; sinRegistros: number; errores: number; ultimaConsulta: string | null }
  filters: {
    departamentos: Array<{ code: string; name: string }>
    municipios: Array<{ code: string; name: string; department_id: string }>
  }
  kpis: {
    total: number
    capitacion: number
    evento: number
    otros: number
    ipsTotal: number
    ipsConGiro: number
    nitsConGiro: number
    asignado: number
    asignadoPct: number | null
    sinZona: number
    ipsSinNit: number
    ipsConNitCompartido: number
  }
  series: Array<{ periodo: string; total: number; capitacion: number; evento: number }>
  rows: GirosRow[]
  notes: string[]
}

const GROUP_TABS: Array<{ value: Group; label: string }> = [
  { value: 'ips', label: 'IPS' },
  { value: 'municipio', label: 'Municipio' },
  { value: 'zona', label: 'Zona' },
  { value: 'ejecutivo', label: 'Ejecutivo Comercial' },
]

const PAGE = 50

// CSV para Excel en español: UTF-8 con BOM, separador ";", CRLF; evita fórmulas (inyección CSV).
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value)) : ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\r\n]/.test(text) || text !== text.trim()) text = `"${text.replace(/"/g, '""')}"`
  return text
}

function buildCsv(data: GirosResponse): string {
  const lines: string[] = []
  const push = (cells: Array<string | number | null | undefined>) => lines.push(cells.map(csvCell).join(';'))
  const withExecutive = data.line !== null
  if (data.group === 'ips') {
    push(['IPS', 'NIT', 'Municipio', 'Departamento', 'Zona', ...(withExecutive ? ['Ejecutivo Comercial'] : []), 'Camas', 'Giro (COP)', '% del total', 'Capitación (COP)', 'Evento (COP)', 'Giro total del NIT (COP)', 'Sedes del NIT en OpMap'])
    for (const row of data.rows) {
      push([row.label, row.nit, row.municipio, row.departamento, row.zona ?? 'Sin zona asignada', ...(withExecutive ? [row.ejecutivo] : []), row.camas, row.giro, row.pct.toLocaleString('es-CO'), row.capitacion, row.evento, row.giro_nit, row.sedes_nit])
    }
  } else {
    const first = data.group === 'municipio' ? 'Municipio' : data.group === 'zona' ? 'Zona' : 'Ejecutivo Comercial'
    push([first, ...(data.group === 'municipio' ? ['Departamento'] : []), ...(data.group === 'ejecutivo' ? ['Zonas'] : []), 'IPS', 'IPS con giro', 'Camas', 'Giro (COP)', '% del total', 'Capitación (COP)', 'Evento (COP)', 'IPS con más giro'])
    for (const row of data.rows) {
      push([row.label, ...(data.group === 'municipio' ? [row.departamento] : []), ...(data.group === 'ejecutivo' ? [(row.zonas || []).join(', ')] : []), row.ips, row.ipsConGiro, row.camas, row.giro, row.pct.toLocaleString('es-CO'), row.capitacion, row.evento, row.top_ips])
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n'
}

function downloadCsv(data: GirosResponse) {
  const blob = new Blob([buildCsv(data)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const range = data.range ? `${data.range.desde}_${data.range.hasta}` : 'sin-rango'
  a.href = url
  a.download = `giros-adres-${data.group}${data.line ? `-${data.line.code}` : ''}-${range}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1 break-words">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

export default function InteligenciaPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="intelligence:view"
        fallback={
          <div className="container mx-auto p-6">
            <p className="text-gray-600">No tienes permiso para ver la inteligencia de giros.</p>
          </div>
        }
      >
        <InteligenciaContent />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function InteligenciaContent() {
  const { role } = usePermissions()
  const [lines, setLines] = useState<MyLine[]>([])
  const [group, setGroup] = useState<Group>('ips')
  const [line, setLine] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [data, setData] = useState<GirosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE)

  useEffect(() => {
    fetch('/api/me/lines', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (body && Array.isArray(body.lines)) setLines(body.lines as MyLine[])
      })
      .catch(() => setLines([]))
  }, [])

  const load = useCallback(
    (signal: AbortSignal) => {
      const params = new URLSearchParams({ group })
      if (line) params.set('line', line)
      if (departamento) params.set('departamento', departamento)
      if (municipio) params.set('municipio', municipio)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      setLoading(true)
      setError(null)
      fetch(`/api/intelligence/giros?${params.toString()}`, { cache: 'no-store', signal })
        .then(async response => {
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
          const result = body as GirosResponse
          setData(result)
          setVisible(PAGE)
        })
        .catch(err => {
          if (signal.aborted) return
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los giros')
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false)
        })
    },
    // desde/hasta vacíos = rango por defecto de la API (12 meses hasta el último mes con giros)
    [group, line, departamento, municipio, desde, hasta]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const municipiosDelDepto = useMemo(
    () => (data?.filters.municipios || []).filter(m => !departamento || m.department_id === departamento),
    [data, departamento]
  )

  const resetFilters = () => {
    setDepartamento('')
    setMunicipio('')
    setDesde('')
    setHasta('')
    setGroup(group === 'ejecutivo' && !line ? 'ips' : group)
  }

  const kpis = data?.kpis
  const rangeLabel = data?.range ? `${monthLabel(data.range.desde)} a ${monthLabel(data.range.hasta)}` : ''
  const withExecutive = Boolean(data?.line)
  const rows = data?.rows || []

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Inteligencia: giros ADRES</h1>
        <p className="text-gray-600 mt-2">
          Recursos que la ADRES gira directamente a las IPS (régimen subsidiado), por NIT del prestador. Sirve para ver qué IPS y
          municipios reciben más recursos.
        </p>
      </div>

      {/* Filtros: una fila, encima de todo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Línea</span>
            <select
              value={line}
              onChange={event => {
                setLine(event.target.value)
                if (!event.target.value && group === 'ejecutivo') setGroup('ips')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="">Todas las líneas</option>
              {lines.map(item => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Departamento</span>
            <select
              value={departamento}
              onChange={event => {
                setDepartamento(event.target.value)
                setMunicipio('')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="">Todos</option>
              {(data?.filters.departamentos || []).map(item => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Municipio</span>
            <select value={municipio} onChange={event => setMunicipio(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
              <option value="">Todos</option>
              {municipiosDelDepto.map(item => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Desde (mes)</span>
            <input
              type="month"
              value={desde || data?.range?.desde || ''}
              min={data?.available?.min}
              max={hasta || data?.range?.hasta || data?.available?.max}
              onChange={event => setDesde(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Hasta (mes)</span>
            <input
              type="month"
              value={hasta || data?.range?.hasta || ''}
              min={desde || data?.range?.desde || data?.available?.min}
              max={data?.available?.max}
              onChange={event => setHasta(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={resetFilters} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Restablecer
            </button>
            <button
              type="button"
              disabled={!data || rows.length === 0}
              onClick={() => data && downloadCsv(data)}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>
        {data?.available && (
          <p className="text-xs text-gray-500 mt-3">
            Meses con giros cargados: {monthLabel(data.available.min)} a {monthLabel(data.available.max)}.
          </p>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {data && !data.available && !loading && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="font-medium text-gray-800">Aún no se han cargado giros de la ADRES.</p>
          {role === 'admin' && (
            <p className="text-sm text-gray-500 mt-1">
              Cargarlos con <code className="px-1 py-0.5 bg-gray-100 rounded">cd web &amp;&amp; node scripts/adres-giros.mjs</code>
            </p>
          )}
        </div>
      )}

      {kpis && data?.available && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${loading ? 'opacity-60' : ''}`}>
            <Kpi label="Total girado" value={formatCop(kpis.total)} hint={rangeLabel} />
            <Kpi
              label="IPS con giro"
              value={`${kpis.ipsConGiro.toLocaleString('es-CO')} de ${kpis.ipsTotal.toLocaleString('es-CO')}`}
              hint={`${kpis.nitsConGiro.toLocaleString('es-CO')} NIT distintos`}
            />
            <Kpi
              label="En IPS con zona asignada"
              value={formatPct(kpis.asignadoPct)}
              hint={`${formatCopCompact(kpis.asignado)} con zona · ${formatCopCompact(kpis.sinZona)} sin zona`}
            />
            <Kpi
              label="Capitación / Evento"
              value={kpis.total > 0 ? `${formatPct((kpis.capitacion / kpis.total) * 100)} / ${formatPct((kpis.evento / kpis.total) * 100)}` : '—'}
              hint={`${formatCopCompact(kpis.capitacion)} · ${formatCopCompact(kpis.evento)}`}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Giro por mes</h2>
            <p className="text-xs text-gray-500 mb-3">{rangeLabel} · Capitación y Evento apilados</p>
            <GirosMonthlyChart points={data.series} stacked ariaLabel={`Giro mensual de la ADRES, ${rangeLabel}`} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Ranking por giro</h2>
              <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5" role="tablist" aria-label="Agrupar por">
                {GROUP_TABS.map(tab => {
                  const disabled = tab.value === 'ejecutivo' && !line
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={group === tab.value}
                      disabled={disabled}
                      title={disabled ? 'Elige una línea para ver quién cubre cada zona' : undefined}
                      onClick={() => setGroup(tab.value)}
                      className={`px-3 py-1.5 text-sm rounded-md font-medium ${
                        group === tab.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">{loading ? 'Cargando…' : 'No hay giros para estos filtros.'}</p>
            ) : (
              <div className={loading ? 'opacity-60' : ''}>
                {/* Celular: tarjetas con el giro junto al nombre (la tabla ancha escondía la columna Giro) */}
                <ol className="sm:hidden divide-y divide-gray-100 border-t border-gray-100">
                  {rows.slice(0, visible).map((row, index) => {
                    const detail =
                      group === 'ips'
                        ? [row.municipio, row.zona || 'Sin zona asignada', withExecutive ? row.ejecutivo : null]
                        : group === 'municipio'
                          ? [row.departamento]
                          : group === 'ejecutivo'
                            ? [(row.zonas || []).join(', ')]
                            : []
                    return (
                      <li key={row.key} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 break-words">
                              <span className="text-gray-400 tabular-nums mr-1.5">{index + 1}</span>
                              {group === 'ips' ? (
                                <Link href={`/hospitals/${row.hospital_id}`} className="hover:underline">
                                  {row.label}
                                </Link>
                              ) : (
                                row.label
                              )}
                            </p>
                            {detail.filter(Boolean).length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5 break-words">{detail.filter(Boolean).join(' · ')}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatCopCompact(row.giro)}</p>
                            <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{formatPct(row.pct)}</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 tabular-nums">
                          Capitación {formatCopCompact(row.capitacion)} · Evento {formatCopCompact(row.evento)}
                          {group !== 'ips' ? ` · IPS con giro ${row.ipsConGiro} / ${row.ips}` : ''}
                          {group === 'ips' && row.sedes_nit && row.sedes_nit > 1 ? ` · NIT compartido (${row.sedes_nit} sedes)` : ''}
                        </p>
                      </li>
                    )
                  })}
                </ol>
                <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3 font-medium">#</th>
                      {group === 'ips' && (
                        <>
                          <th className="py-2 pr-3 font-medium">IPS</th>
                          <th className="py-2 pr-3 font-medium">Municipio</th>
                          <th className="py-2 pr-3 font-medium">Zona</th>
                          {withExecutive && <th className="py-2 pr-3 font-medium">Ejecutivo Comercial</th>}
                          <th className="py-2 pr-3 font-medium text-right">Camas</th>
                        </>
                      )}
                      {group === 'municipio' && (
                        <>
                          <th className="py-2 pr-3 font-medium">Municipio</th>
                          <th className="py-2 pr-3 font-medium">Departamento</th>
                        </>
                      )}
                      {group === 'zona' && <th className="py-2 pr-3 font-medium">Zona</th>}
                      {group === 'ejecutivo' && (
                        <>
                          <th className="py-2 pr-3 font-medium">Ejecutivo Comercial</th>
                          <th className="py-2 pr-3 font-medium">Zonas</th>
                        </>
                      )}
                      {group !== 'ips' && (
                        <>
                          <th className="py-2 pr-3 font-medium text-right">IPS con giro</th>
                          <th className="py-2 pr-3 font-medium text-right">Camas</th>
                        </>
                      )}
                      <th className="py-2 pr-3 font-medium text-right">Giro</th>
                      <th className="py-2 pr-3 font-medium text-right">%</th>
                      <th className="py-2 pr-3 font-medium text-right">Capitación</th>
                      <th className="py-2 pr-3 font-medium text-right">Evento</th>
                      {group !== 'ips' && group !== 'ejecutivo' && <th className="py-2 pr-3 font-medium">IPS con más giro</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, visible).map((row, index) => (
                      <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                        <td className="py-2 pr-3 text-gray-400 tabular-nums">{index + 1}</td>
                        {group === 'ips' && (
                          <>
                            <td className="py-2 pr-3 min-w-[14rem]">
                              <Link href={`/hospitals/${row.hospital_id}`} className="font-medium text-gray-900 hover:underline">
                                {row.label}
                              </Link>
                              <div className="text-xs text-gray-500">
                                NIT {row.nit}
                                {row.sedes_nit && row.sedes_nit > 1 && (
                                  <span title={`El NIT tiene ${row.sedes_nit} sedes en OpMap; su giro total (${formatCop(row.giro_nit || 0)}) se reparte por camas`}>
                                    {' '}· NIT compartido ({row.sedes_nit} sedes)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 pr-3 text-gray-700">
                              {row.municipio || '—'}
                              <div className="text-xs text-gray-500">{row.departamento}</div>
                            </td>
                            <td className="py-2 pr-3 text-gray-700">{row.zona || <span className="text-gray-400">Sin zona asignada</span>}</td>
                            {withExecutive && (
                              <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.ejecutivo_color || '#d1d5db' }} />
                                  {row.ejecutivo}
                                </span>
                              </td>
                            )}
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{row.camas ? row.camas.toLocaleString('es-CO') : '—'}</td>
                          </>
                        )}
                        {group === 'municipio' && (
                          <>
                            <td className="py-2 pr-3 font-medium text-gray-900">{row.label}</td>
                            <td className="py-2 pr-3 text-gray-700">{row.departamento || '—'}</td>
                          </>
                        )}
                        {group === 'zona' && <td className="py-2 pr-3 font-medium text-gray-900">{row.label}</td>}
                        {group === 'ejecutivo' && (
                          <>
                            <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color || '#d1d5db' }} />
                                {row.label}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-gray-600 text-xs">{(row.zonas || []).join(', ') || '—'}</td>
                          </>
                        )}
                        {group !== 'ips' && (
                          <>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                              {row.ipsConGiro} <span className="text-gray-400">/ {row.ips}</span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{row.camas ? row.camas.toLocaleString('es-CO') : '—'}</td>
                          </>
                        )}
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">{formatCop(row.giro)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">{formatPct(row.pct)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{formatCopCompact(row.capitacion)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{formatCopCompact(row.evento)}</td>
                        {group !== 'ips' && group !== 'ejecutivo' && <td className="py-2 pr-3 text-gray-600 text-xs">{row.top_ips || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {rows.length > visible && (
                  <div className="text-center mt-4">
                    <button type="button" onClick={() => setVisible(v => v + PAGE)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Mostrar más ({rows.length - visible} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {data && (
        <div className="text-xs text-gray-500 space-y-1">
          {data.notes.map(note => (
            <p key={note}>{note}</p>
          ))}
          {kpis && kpis.ipsConNitCompartido > 0 && (
            <p>
              {kpis.ipsConNitCompartido} IPS de esta vista comparten NIT con otras sedes: su giro es un reparto estimado por camas
              (marcadas como &quot;NIT compartido&quot; en el ranking).
            </p>
          )}
          {kpis && kpis.ipsSinNit > 0 && <p>{kpis.ipsSinNit} IPS no tienen un NIT válido en su código y no se pueden cruzar.</p>}
          <p>
            NIT consultados en la ADRES: {data.fetch.nitsConsultados.toLocaleString('es-CO')} (con giros {data.fetch.conDatos}, sin registros{' '}
            {data.fetch.sinRegistros}, con error {data.fetch.errores})
            {data.fetch.ultimaConsulta ? ` · última consulta: ${new Date(data.fetch.ultimaConsulta).toLocaleString('es-CO')}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
