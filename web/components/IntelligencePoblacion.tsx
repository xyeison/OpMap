'use client'

// Fase 4 · Sección "Población y cobertura" de /inteligencia: afiliados por régimen (MinSalud / BDUA),
// población DANE, cobertura, EPS dominantes, giros ADRES y el índice "potencial" por municipio, zona o
// Ejecutivo Comercial. Datos: GET /api/intelligence/poblacion (permiso intelligence:view).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCop, formatCopCompact, formatPct, monthLabel } from '@/lib/giros-format'
import {
  AFILIADOS_PESOS,
  POTENCIAL_PESOS,
  buildPoblacionCsv,
  type PoblacionApiResponse,
  type PoblacionGroup,
  type PoblacionRow,
} from '@/lib/poblacion-intelligence'

interface MyLine {
  id: string
  code: string
  name: string
}

type SortKey = 'potencial' | 'afiliados' | 'giros' | 'cobertura' | 'poblacion'

const GROUP_TABS: Array<{ value: PoblacionGroup; label: string }> = [
  { value: 'municipio', label: 'Municipio' },
  { value: 'zona', label: 'Zona' },
  { value: 'ejecutivo', label: 'Ejecutivo Comercial' },
]

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'potencial', label: 'Potencial' },
  { value: 'afiliados', label: 'Afiliados' },
  { value: 'giros', label: 'Giros ADRES' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'poblacion', label: 'Población' },
]

/** Paleta categórica validada (la misma de los giros): contributivo azul, subsidiado naranja, excepción gris. */
const REGIMEN_COLORS = { contributivo: '#2a78d6', subsidiado: '#eb6834', excepcion: '#9ca3af' } as const

const PAGE = 50
const fmtInt = (value: number | null | undefined) => (value === null || value === undefined ? '—' : Math.round(value).toLocaleString('es-CO'))
const fmtCompactInt = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
  if (abs >= 1e4) return `${(value / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil`
  return Math.round(value).toLocaleString('es-CO')
}
const pesoLabel = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function sortValue(row: PoblacionRow, key: SortKey): number {
  if (key === 'cobertura') return row.cobertura ?? -1
  return row[key]
}

function downloadCsv(data: PoblacionApiResponse, rows: PoblacionRow[]) {
  const blob = new Blob([buildPoblacionCsv({ group: data.group, line: data.line, rows })], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `poblacion-${data.group}${data.line ? `-${data.line.code}` : ''}-${data.corte || 'sin-corte'}.csv`
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

/** Barra apilada de afiliados por régimen (2 px de separación entre segmentos; el detalle va en el título). */
function RegimenBar({ row }: { row: Pick<PoblacionRow, 'contributivo' | 'subsidiado' | 'excepcion' | 'afiliados'> }) {
  if (!row.afiliados) return null
  const parts = [
    { key: 'contributivo', label: 'Contributivo', value: row.contributivo, color: REGIMEN_COLORS.contributivo },
    { key: 'subsidiado', label: 'Subsidiado', value: row.subsidiado, color: REGIMEN_COLORS.subsidiado },
    { key: 'excepcion', label: 'Excepción y especiales', value: row.excepcion, color: REGIMEN_COLORS.excepcion },
  ].filter(part => part.value > 0)
  const title = parts.map(part => `${part.label}: ${fmtInt(part.value)} (${formatPct((part.value / row.afiliados) * 100)})`).join(' · ')
  return (
    <div className="flex h-2 w-full gap-[2px] mt-1" title={title} aria-label={title} role="img">
      {parts.map((part, index) => (
        <span
          key={part.key}
          className={`h-2 ${index === 0 ? 'rounded-l' : ''} ${index === parts.length - 1 ? 'rounded-r' : ''}`}
          style={{ width: `${(part.value / row.afiliados) * 100}%`, background: part.color, minWidth: 2 }}
        />
      ))}
    </div>
  )
}

function PotencialMeter({ row }: { row: Pick<PoblacionRow, 'potencial' | 'potencialDetalle'> }) {
  const d = row.potencialDetalle
  const title = `Potencial ${row.potencial.toLocaleString('es-CO')} = 100 × (0,5 × ${d.afiliados.toLocaleString('es-CO')} + 0,3 × ${d.giros.toLocaleString('es-CO')} + 0,2 × ${d.capacidad.toLocaleString('es-CO')})`
  return (
    <div className="min-w-[5.5rem]" title={title}>
      <p className="text-sm font-semibold text-gray-900 tabular-nums text-right">{row.potencial.toLocaleString('es-CO', { maximumFractionDigits: 1 })}</p>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1" aria-hidden="true">
        <div className="h-1.5 rounded-full bg-gray-800" style={{ width: `${Math.max(0, Math.min(100, row.potencial))}%` }} />
      </div>
    </div>
  )
}

function EpsList({ row, max = 3 }: { row: PoblacionRow; max?: number }) {
  if (row.topEps.length === 0) return <span className="text-gray-400">Sin datos de EPS</span>
  const all = row.topEps.map(eps => `${eps.nombre}: ${fmtInt(eps.afiliados)} (${formatPct(eps.pct)})`).join('\n')
  return (
    <ul className="space-y-0.5" title={all}>
      {row.topEps.slice(0, max).map(eps => (
        <li key={eps.codigo} className="flex items-baseline justify-between gap-2">
          <span className="truncate max-w-[11rem]">{eps.nombre}</span>
          <span className="tabular-nums text-gray-500 whitespace-nowrap">{formatPct(eps.pct)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function IntelligencePoblacion() {
  const [lines, setLines] = useState<MyLine[]>([])
  const [group, setGroup] = useState<PoblacionGroup>('municipio')
  const [line, setLine] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [corte, setCorte] = useState('')
  const [sort, setSort] = useState<SortKey>('potencial')
  const [data, setData] = useState<PoblacionApiResponse | null>(null)
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
      if (corte) params.set('corte', corte)
      setLoading(true)
      setError(null)
      fetch(`/api/intelligence/poblacion?${params.toString()}`, { cache: 'no-store', signal })
        .then(async response => {
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
          setData(body as PoblacionApiResponse)
          setVisible(PAGE)
        })
        .catch(err => {
          if (signal.aborted) return
          setError(err instanceof Error ? err.message : 'No se pudo cargar la población')
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false)
        })
    },
    [group, line, departamento, municipio, corte]
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

  const rows = useMemo(() => {
    const list = [...(data?.rows || [])]
    list.sort((a, b) => sortValue(b, sort) - sortValue(a, sort) || b.potencial - a.potencial || a.label.localeCompare(b.label, 'es'))
    return list
  }, [data, sort])

  const resetFilters = () => {
    setDepartamento('')
    setMunicipio('')
    setCorte('')
    setSort('potencial')
    if (group === 'ejecutivo' && !line) setGroup('municipio')
  }

  const kpis = data?.kpis
  const withExecutive = Boolean(data?.line)
  const girosLabel = data?.giros.fuente
    ? `${data.giros.desde ? monthLabel(data.giros.desde) : ''} a ${data.giros.hasta ? monthLabel(data.giros.hasta) : ''} · ${
        data.giros.fuente === 'identifica' ? 'contributivo y subsidiado' : 'solo subsidiado'
      }`
    : 'Sin giros cargados'
  const firstColumn = group === 'municipio' ? 'Municipio' : group === 'zona' ? 'Zona' : 'Ejecutivo Comercial'
  const sinDatos = data && !data.sources.cifras && !data.sources.bdua

  const sortHeader = (value: SortKey, label: string) => (
    <th key={value} className="py-2 pr-3 font-medium text-right" aria-sort={sort === value ? 'descending' : 'none'}>
      <button type="button" onClick={() => setSort(value)} className={`inline-flex items-center gap-1 hover:text-gray-900 ${sort === value ? 'text-gray-900' : ''}`}>
        {label}
        <span aria-hidden="true" className={sort === value ? '' : 'invisible'}>
          ↓
        </span>
      </button>
    </th>
  )

  return (
    <section className="container mx-auto px-4 sm:px-6 pb-10" aria-labelledby="poblacion-title">
      <div className="border-t border-gray-200 pt-8 mb-6">
        <h2 id="poblacion-title" className="text-2xl sm:text-3xl font-bold text-gray-900">
          Población y cobertura
        </h2>
        <p className="text-gray-600 mt-2">
          Afiliados al sistema de salud por régimen, población DANE, cobertura, EPS dominantes y giros de la ADRES por municipio, zona o
          Ejecutivo Comercial, con un índice de potencial para priorizar.
        </p>
      </div>

      {/* Filtros: una fila, encima de todo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Línea</span>
            <select
              value={line}
              onChange={event => {
                setLine(event.target.value)
                if (!event.target.value && group === 'ejecutivo') setGroup('municipio')
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
            <span className="block text-xs font-medium text-gray-600 mb-1">Corte de afiliación</span>
            <select
              value={corte || data?.corte || ''}
              onChange={event => setCorte(event.target.value)}
              disabled={!data || data.cortes.length === 0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              {(data?.cortes || []).length === 0 && <option value="">Sin cortes cargados</option>}
              {(data?.cortes || []).map(item => (
                <option key={item} value={item}>
                  {monthLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={resetFilters} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Restablecer
            </button>
            <button
              type="button"
              disabled={!data || rows.length === 0}
              onClick={() => data && downloadCsv(data, rows)}
              className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {sinDatos && !loading && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Aún no se han cargado las cifras de afiliación (MinSalud) ni la BDUA: se muestran la población, los giros y la capacidad.
        </div>
      )}

      {kpis && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${loading ? 'opacity-60' : ''}`}>
          <Kpi
            label="Afiliados"
            value={fmtInt(kpis.afiliados)}
            hint={`Contributivo ${fmtCompactInt(kpis.contributivo)} · Subsidiado ${fmtCompactInt(kpis.subsidiado)} · Excepción ${fmtCompactInt(kpis.excepcion)}`}
          />
          <Kpi
            label="Cobertura"
            value={formatPct(kpis.cobertura)}
            hint={`Población DANE${data?.poblacionAnio ? ` ${data.poblacionAnio}` : ''}: ${fmtInt(kpis.poblacion)}`}
          />
          <Kpi
            label="% contributivo"
            value={formatPct(kpis.pctContributivo)}
            hint={`${kpis.municipiosConAfiliacion.toLocaleString('es-CO')} de ${kpis.municipios.toLocaleString('es-CO')} municipios con cifras${data?.corte ? ` · corte ${monthLabel(data.corte)}` : ''}`}
          />
          <Kpi label="Giros ADRES (12 meses)" value={formatCopCompact(kpis.giros)} hint={girosLabel} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Ranking por {firstColumn.toLowerCase()}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5" role="tablist" aria-label="Agrupar población por">
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
            <label className="text-sm inline-flex items-center gap-2 sm:hidden">
              <span className="text-xs text-gray-600">Ordenar por</span>
              <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="rounded-lg border border-gray-300 px-2 py-1.5 bg-white text-sm">
                {SORTS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Leyenda de la barra por régimen (identidad nunca solo por color) */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-3" aria-label="Leyenda de regímenes">
          {[
            { label: 'Contributivo', color: REGIMEN_COLORS.contributivo },
            { label: 'Subsidiado', color: REGIMEN_COLORS.subsidiado },
            { label: 'Excepción y especiales', color: REGIMEN_COLORS.excepcion },
          ].map(item => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">{loading ? 'Cargando…' : 'No hay datos para estos filtros.'}</p>
        ) : (
          <div className={loading ? 'opacity-60' : ''}>
            {/* Celular: tarjetas (la tabla ancha esconde columnas) */}
            <ol className="sm:hidden divide-y divide-gray-100 border-t border-gray-100">
              {rows.slice(0, visible).map((row, index) => {
                const detail =
                  group === 'municipio'
                    ? [row.departamento, row.zonas.join(', ') || 'Sin zona asignada', withExecutive ? row.ejecutivo : null]
                    : group === 'ejecutivo'
                      ? [row.zonas.join(', ')]
                      : [`${row.municipios} municipios`]
                return (
                  <li key={row.key} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 break-words">
                          <span className="text-gray-400 tabular-nums mr-1.5">{index + 1}</span>
                          {row.color && <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: row.color }} />}
                          {row.label}
                          {row.compartido && <span className="ml-1.5 text-xs font-normal text-gray-500">(compartido)</span>}
                        </p>
                        {detail.filter(Boolean).length > 0 && <p className="text-xs text-gray-500 mt-0.5 break-words">{detail.filter(Boolean).join(' · ')}</p>}
                      </div>
                      <div className="shrink-0 w-24">
                        <PotencialMeter row={row} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 mt-2 tabular-nums">
                      {fmtInt(row.afiliados)} afiliados · cobertura {formatPct(row.cobertura)} · contributivo {formatPct(row.pctContributivo)}
                    </p>
                    <RegimenBar row={row} />
                    <p className="text-xs text-gray-500 mt-1.5 tabular-nums">
                      Giros {formatCopCompact(row.giros)} · {row.ips} IPS · {fmtInt(row.camas)} camas
                      {row.quirofanos > 0 ? ` · ${fmtInt(row.quirofanos)} quirófanos` : ''}
                    </p>
                    {row.topEps.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 break-words">
                        EPS: {row.topEps.slice(0, 3).map(eps => `${eps.nombre} ${formatPct(eps.pct)}`).join(' · ')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>

            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">{firstColumn}</th>
                    {sortHeader('afiliados', 'Afiliados')}
                    <th className="py-2 pr-3 font-medium text-right">% contrib.</th>
                    {sortHeader('poblacion', 'Población')}
                    {sortHeader('cobertura', 'Cobertura')}
                    {sortHeader('giros', 'Giros 12 m')}
                    <th className="py-2 pr-3 font-medium text-right">IPS · camas</th>
                    <th className="py-2 pr-3 font-medium">EPS dominantes</th>
                    {sortHeader('potencial', 'Potencial')}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, visible).map((row, index) => (
                    <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                      <td className="py-2 pr-3 text-gray-400 tabular-nums">{index + 1}</td>
                      <td className="py-2 pr-3 min-w-[12rem]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                          {row.color && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />}
                          {row.label}
                        </span>
                        <div className="text-xs text-gray-500">
                          {group === 'municipio' && (
                            <>
                              {row.departamento}
                              {row.zonas.length > 0 ? ` · ${row.zonas.join(', ')}` : ' · Sin zona asignada'}
                              {row.compartido ? ' (compartido)' : ''}
                              {withExecutive && row.ejecutivo && (
                                <span className="inline-flex items-center gap-1 ml-1">
                                  · <span className="inline-block w-2 h-2 rounded-full" style={{ background: row.ejecutivo_color || '#d1d5db' }} />
                                  {row.ejecutivo}
                                </span>
                              )}
                            </>
                          )}
                          {group === 'zona' && `${row.municipios.toLocaleString('es-CO')} municipios`}
                          {group === 'ejecutivo' && (row.zonas.join(', ') || '—')}
                          {row.municipiosSinAfiliacion > 0 && group !== 'municipio' && ` · ${row.municipiosSinAfiliacion} sin cifras`}
                          {row.municipiosSinAfiliacion > 0 && group === 'municipio' && ' · sin cifras de afiliación'}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-900 min-w-[7rem]">
                        {fmtInt(row.afiliados)}
                        <RegimenBar row={row} />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{formatPct(row.pctContributivo)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{fmtInt(row.poblacion)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{formatPct(row.cobertura)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap" title={formatCop(row.giros)}>
                        {formatCopCompact(row.giros)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                        {row.ips} · {fmtInt(row.camas)}
                        {row.quirofanos > 0 && <div className="text-xs text-gray-500">{fmtInt(row.quirofanos)} quirófanos</div>}
                      </td>
                      <td className="py-2 pr-3 text-xs text-gray-700">
                        <EpsList row={row} />
                      </td>
                      <td className="py-2 pr-3">
                        <PotencialMeter row={row} />
                      </td>
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

      <details className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-gray-900">¿Cómo se calcula el potencial?</summary>
        <div className="mt-3 space-y-2">
          <p>
            <strong>Potencial (0 a 100)</strong> = 100 × ({pesoLabel(POTENCIAL_PESOS.afiliados)} × A + {pesoLabel(POTENCIAL_PESOS.giros)} × G +{' '}
            {pesoLabel(POTENCIAL_PESOS.capacidad)} × C). Cada término se divide por el valor más alto de las filas que ves (con los filtros
            actuales), así que el primero de la lista en cada término vale 1.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>A, afiliados ponderados</strong>: contributivo × {pesoLabel(AFILIADOS_PESOS.contributivo)} + subsidiado ×{' '}
              {pesoLabel(AFILIADOS_PESOS.subsidiado)}. Excepción y especiales no suman (contratan por fuera de las EPS).
            </li>
            <li>
              <strong>G, giros ADRES</strong> de los últimos 12 meses cargados a las IPS del grupo ({girosLabel}).
            </li>
            <li>
              <strong>C, capacidad</strong>: camas de las IPS del grupo (las del REPS si la IPS las tiene; si no, las de la ficha)
              {data?.capacidadConQuirofanos ? ' promediadas con los quirófanos del REPS' : '; los quirófanos del REPS entran cuando se importen'}.
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            Es un orden relativo para priorizar, no una cifra de mercado: cambia si cambian los filtros. Pasa el cursor por el potencial
            de una fila para ver sus tres términos.
          </p>
        </div>
      </details>

      {data && (
        <div className="text-xs text-gray-500 space-y-1">
          {data.notes.map(note => (
            <p key={note}>{note}</p>
          ))}
          {kpis && kpis.municipiosDesdeBdua > 0 && (
            <p>{kpis.municipiosDesdeBdua} municipios no tienen cifras de MinSalud en este corte: sus afiliados salen de la BDUA (activos).</p>
          )}
        </div>
      )}
    </section>
  )
}
