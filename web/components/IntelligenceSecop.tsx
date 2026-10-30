'use client'

// Fase 5 · Pestaña "Compras públicas" de /inteligencia: ranking de compras de material ortopédico y de
// neurocirugía en SECOP por hospital, proveedor, zona o Ejecutivo Comercial; tabla proveedor × hospital;
// detalle de un proveedor (dónde vende) y, para admin, la lista vigilada.
// Datos: GET /api/secop/ranking y /api/secop/proveedor/[nit] (permiso intelligence:view).
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import SecopAnnualChart from '@/components/SecopAnnualChart'
import SecopVigilados from '@/components/SecopVigilados'
import { formatCop, formatCopCompact, formatFechaGiro, formatPct, monthLabel } from '@/lib/giros-format'
import {
  buildSecopCsv,
  lineaColor,
  lineaLabel,
  type ProveedorSecopResponse,
  type SecopGroup,
  type SecopRankingResponse,
  type SecopRankingRow,
} from '@/lib/compras-publicas'

interface MyLine {
  id: string
  code: string
  name: string
}

const GROUP_TABS: Array<{ value: SecopGroup; label: string }> = [
  { value: 'hospital', label: 'IPS' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'zona', label: 'Zona' },
  { value: 'ejecutivo', label: 'Ejecutivo Comercial' },
]

const PAGE = 30
const inputCls = 'w-full min-h-[44px] rounded-lg border border-gray-300 px-3 bg-white text-sm'

function Kpi({ label, value, hint, wide = false }: { label: string; value: string; hint?: string; wide?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 min-w-0 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`${value.length > 16 ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 tabular-nums mt-1 break-words`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function VigiladoChip() {
  return <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 whitespace-nowrap">Vigilado</span>
}

/** Barra apilada por línea de producto (una fila del ranking). */
function LineaBar({ lineas, total }: { lineas: Record<string, number>; total: number }) {
  if (total <= 0) return null
  const entries = Object.entries(lineas).filter(([, v]) => v > 0)
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 mt-1" aria-hidden="true">
      {entries.map(([linea, valor]) => (
        <div key={linea} style={{ width: `${(valor / total) * 100}%`, background: lineaColor(linea) }} title={`${lineaLabel(linea)}: ${formatCop(valor)}`} />
      ))}
    </div>
  )
}

function downloadCsv(data: SecopRankingResponse) {
  const blob = new Blob([buildSecopCsv(data)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `compras-publicas-${data.group}${data.linea ? `-${data.linea}` : ''}${data.line ? `-${data.line.code}` : ''}-${data.range.desde}_${data.range.hasta}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function rowDetail(row: SecopRankingRow, group: SecopGroup, withExecutive: boolean): string[] {
  if (group === 'hospital') {
    return [
      row.sedes && row.sedes > 1 && row.nombre_secop ? `En SECOP: ${row.nombre_secop}` : null,
      row.municipio ? `${row.municipio}${row.departamento ? ` (${row.departamento})` : ''}` : null,
      row.zona || 'Sin zona asignada',
      withExecutive ? row.ejecutivo ?? null : null,
      row.sedes && row.sedes > 1 ? `${row.sedes} sedes` : null,
      row.top_proveedor ? `Principal proveedor: ${row.top_proveedor}` : null,
    ].filter((v): v is string => Boolean(v))
  }
  if (group === 'proveedor') {
    return [row.nit ? `NIT ${row.nit}` : null, `${row.entidades ?? 0} entidades`, row.top_entidad ? `Principal: ${row.top_entidad}` : null].filter((v): v is string => Boolean(v))
  }
  return [
    group === 'ejecutivo' && row.zonas?.length ? row.zonas.join(', ') : null,
    `${row.hospitales ?? 0} entidades`,
    row.top_entidad ? `Principal: ${row.top_entidad}` : null,
  ].filter((v): v is string => Boolean(v))
}

export default function IntelligenceSecop() {
  const { can } = usePermissions()
  const [lines, setLines] = useState<MyLine[]>([])
  const [group, setGroup] = useState<SecopGroup>('hospital')
  const [linea, setLinea] = useState('')
  const [line, setLine] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [ambito, setAmbito] = useState<'ips' | 'todas'>('ips')
  const [data, setData] = useState<SecopRankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE)
  const [paresVisible, setParesVisible] = useState(PAGE)
  const [paresFiltro, setParesFiltro] = useState('')
  const [proveedor, setProveedor] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me/lines', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        if (body && Array.isArray(body.lines)) setLines(body.lines as MyLine[])
      })
      .catch(() => setLines([]))
    try {
      const nit = new URLSearchParams(window.location.search).get('proveedor')
      if (nit && /^[\d.\-\s]{9,14}$/.test(nit)) setProveedor(nit.replace(/\D/g, '').slice(0, 9))
    } catch {
      // sin acceso a la URL: no se abre el detalle
    }
  }, [])

  const load = useCallback(
    (signal: AbortSignal) => {
      const params = new URLSearchParams({ group })
      if (linea) params.set('linea', linea)
      if (line) params.set('line', line)
      if (departamento) params.set('departamento', departamento)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (group === 'proveedor' && ambito === 'todas') params.set('ambito', 'todas')
      setLoading(true)
      setError(null)
      fetch(`/api/secop/ranking?${params.toString()}`, { cache: 'no-store', signal })
        .then(async response => {
          const body = await response.json().catch(() => null)
          if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
          setData(body as SecopRankingResponse)
          setVisible(PAGE)
          setParesVisible(PAGE)
        })
        .catch(err => {
          if (signal.aborted) return
          setError(err instanceof Error ? err.message : 'No se pudieron cargar las compras públicas')
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false)
        })
    },
    [group, linea, line, departamento, desde, hasta, ambito]
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const resetFilters = () => {
    setLinea('')
    setDepartamento('')
    setDesde('')
    setHasta('')
    setAmbito('ips')
    if (group === 'ejecutivo' && !line) setGroup('hospital')
  }

  const kpis = data?.kpis
  const rows = data?.rows || []
  const withExecutive = Boolean(data?.line)
  const rangeLabel = data ? `${monthLabel(data.range.desde)} a ${monthLabel(data.range.hasta)}` : ''
  const pares = useMemo(() => {
    const all = data?.pares || []
    const q = paresFiltro.trim().toLowerCase()
    if (!q) return all
    return all.filter(par => par.proveedor.toLowerCase().includes(q) || par.hospital.toLowerCase().includes(q) || (par.proveedor_nit || '').includes(q))
  }, [data, paresFiltro])
  const actualizado = data ? Object.values(data.actualizado).filter(Boolean).sort().pop() ?? null : null
  const porLineaMax = Math.max(1, ...(data?.porLinea || []).map(item => item.valor))

  const openProveedor = (nit: string | null | undefined) => {
    if (!nit) return
    setProveedor(nit)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('proveedor', nit)
      window.history.replaceState(null, '', url.toString())
    } catch {
      // sin historial: solo se abre el panel
    }
  }
  const closeProveedor = () => {
    setProveedor(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('proveedor')
      window.history.replaceState(null, '', url.toString())
    } catch {
      // nada
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Compras públicas (SECOP)</h1>
        <p className="text-gray-600 mt-2">
          Qué compran las IPS públicas en material ortopédico y de neurocirugía, a quién y cuánto, según los contratos publicados en SECOP. Se
          actualiza solo (ver &quot;Fuentes de datos&quot;).
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Línea de producto</span>
            <select value={linea} onChange={event => setLinea(event.target.value)} className={inputCls}>
              <option value="">Ortopédicas (6 líneas)</option>
              <option value="todas">Todas (incluye sin clasificar)</option>
              {(data?.filters.lineas || []).map(item => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Línea de negocio (para ejecutivo)</span>
            <select
              value={line}
              onChange={event => {
                setLine(event.target.value)
                if (!event.target.value && group === 'ejecutivo') setGroup('hospital')
              }}
              className={inputCls}
            >
              <option value="">Ninguna</option>
              {lines.map(item => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Departamento</span>
            <select value={departamento} onChange={event => setDepartamento(event.target.value)} className={inputCls} disabled={group === 'proveedor' && ambito === 'todas'}>
              <option value="">Todos</option>
              {(data?.filters.departamentos || []).map(item => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Entidades</span>
            <select
              value={group === 'proveedor' ? ambito : 'ips'}
              disabled={group !== 'proveedor'}
              title={group !== 'proveedor' ? 'Solo al agrupar por proveedor' : undefined}
              onChange={event => setAmbito(event.target.value === 'todas' ? 'todas' : 'ips')}
              className={inputCls}
            >
              <option value="ips">IPS de OpMap</option>
              <option value="todas">Todas las entidades públicas</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Desde (mes)</span>
            <input type="month" value={desde || data?.range.desde || ''} min="2005-01" max={hasta || data?.range.hasta} onChange={event => setDesde(event.target.value)} className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Hasta (mes)</span>
            <input type="month" value={hasta || data?.range.hasta || ''} min={desde || data?.range.desde} onChange={event => setHasta(event.target.value)} className={inputCls} />
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
            <button type="button" onClick={resetFilters} className="flex-1 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Restablecer
            </button>
            <button
              type="button"
              disabled={!data || rows.length === 0}
              onClick={() => data && downloadCsv(data)}
              className="flex-1 min-h-[44px] px-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>
        {data && (
          <p className="text-xs text-gray-500 mt-3">
            {rangeLabel} · por fecha de firma
            {actualizado ? ` · última carga de SECOP: ${new Date(actualizado).toLocaleString('es-CO')}` : ' · SECOP aún no se ha cargado'}
          </p>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {kpis && (
        <>
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 ${loading ? 'opacity-60' : ''}`}>
            <Kpi
              wide
              label="Total comprado"
              value={formatCop(kpis.valor)}
              hint={`${kpis.contratos.toLocaleString('es-CO')} contratos · ${rangeLabel}${kpis.fueraEscala > 0 ? ` · ${kpis.fueraEscala} fuera de escala no suman (${formatCopCompact(kpis.valorFueraEscala)})` : ''}`}
            />
            <Kpi
              label={data?.ambito === 'todas' ? 'Entidades compradoras' : 'IPS públicas con compras'}
              value={kpis.entidades.toLocaleString('es-CO')}
              hint={`${kpis.proveedores.toLocaleString('es-CO')} proveedores distintos`}
            />
            <Kpi label="A proveedores vigilados" value={formatPct(kpis.vigiladosPct)} hint={formatCopCompact(kpis.valorVigilados)} />
            <Kpi
              label="Médicos contratados"
              value={kpis.medicos.toLocaleString('es-CO')}
              hint={`${kpis.contratosMedicos.toLocaleString('es-CO')} contratos de prestación de servicios`}
            />
          </div>

          {data && data.porLinea.length > 0 && (
            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6 ${loading ? 'opacity-60' : ''}`}>
              <h2 className="text-lg font-semibold text-gray-900">Por línea de producto</h2>
              <p className="text-xs text-gray-500 mb-3">Todas las líneas del rango; las que el filtro deja fuera aparecen atenuadas.</p>
              <ul className="space-y-2.5">
                {data.porLinea.map(item => (
                  <li key={item.linea} className={(data.linea ? data.linea !== 'todas' && data.linea !== item.linea : !item.orto) ? 'opacity-50' : ''}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-gray-800 inline-flex items-center gap-1.5 min-w-0">
                        <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="tabular-nums text-gray-900 whitespace-nowrap">
                        {formatCopCompact(item.valor)} <span className="text-gray-500 text-xs">{item.contratos.toLocaleString('es-CO')} contratos</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1, (item.valor / porLineaMax) * 100)}%`, background: item.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ranking */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Ranking por compras</h2>
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
                      title={disabled ? 'Elige una línea de negocio para ver quién cubre cada zona' : undefined}
                      onClick={() => setGroup(tab.value)}
                      className={`min-h-[44px] px-3 text-sm rounded-md font-medium ${group === tab.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">{loading ? 'Cargando…' : 'No hay compras para estos filtros.'}</p>
            ) : (
              <div className={loading ? 'opacity-60' : ''}>
                {/* Celular: tarjetas */}
                <ol className="sm:hidden divide-y divide-gray-100 border-t border-gray-100">
                  {rows.slice(0, visible).map((row, index) => (
                    <li key={row.key} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">
                            <span className="text-gray-400 tabular-nums mr-1.5">{index + 1}</span>
                            {group === 'hospital' && row.hospital_id ? (
                              <Link href={`/hospitals/${row.hospital_id}`} className="hover:underline">
                                {row.label}
                              </Link>
                            ) : group === 'proveedor' && row.nit ? (
                              <button type="button" onClick={() => openProveedor(row.nit)} className="text-left hover:underline">
                                {row.label}
                              </button>
                            ) : (
                              row.label
                            )}{' '}
                            {row.vigilado && <VigiladoChip />}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 break-words">{rowDetail(row, group, withExecutive).join(' · ')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatCopCompact(row.valor)}</p>
                          <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                            {formatPct(row.pct)} · {row.contratos}
                          </p>
                        </div>
                      </div>
                      <LineaBar lineas={row.lineas} total={row.valor} />
                    </li>
                  ))}
                </ol>
                {/* Escritorio: tabla */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                        <th className="py-2 pr-3 font-medium">#</th>
                        <th className="py-2 pr-3 font-medium">{GROUP_TABS.find(t => t.value === group)?.label}</th>
                        {group === 'hospital' && (
                          <>
                            <th className="py-2 pr-3 font-medium">Municipio</th>
                            <th className="py-2 pr-3 font-medium">Zona</th>
                            {withExecutive && <th className="py-2 pr-3 font-medium">Ejecutivo Comercial</th>}
                          </>
                        )}
                        {group !== 'hospital' && <th className="py-2 pr-3 font-medium text-right">Entidades</th>}
                        <th className="py-2 pr-3 font-medium text-right">Valor</th>
                        <th className="py-2 pr-3 font-medium text-right">%</th>
                        <th className="py-2 pr-3 font-medium text-right">Contratos</th>
                        <th className="py-2 pr-3 font-medium min-w-[8rem]">Líneas</th>
                        <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Último</th>
                        <th className="py-2 pr-3 font-medium">{group === 'hospital' ? 'Principal proveedor' : 'Principal entidad'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, visible).map((row, index) => (
                        <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                          <td className="py-2 pr-3 text-gray-400 tabular-nums">{index + 1}</td>
                          <td className="py-2 pr-3 min-w-[14rem]">
                            {group === 'hospital' && row.hospital_id ? (
                              <Link href={`/hospitals/${row.hospital_id}`} className="font-medium text-gray-900 hover:underline">
                                {row.label}
                              </Link>
                            ) : group === 'proveedor' && row.nit ? (
                              <button type="button" onClick={() => openProveedor(row.nit)} className="font-medium text-gray-900 hover:underline text-left">
                                {row.label}
                              </button>
                            ) : (
                              <span className="font-medium text-gray-900 inline-flex items-center gap-1.5">
                                {group === 'ejecutivo' && <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color || '#d1d5db' }} />}
                                {row.label}
                              </span>
                            )}{' '}
                            {row.vigilado && <VigiladoChip />}
                            <div className="text-xs text-gray-500">
                              {group === 'hospital' &&
                                `NIT ${row.nit}${row.sedes && row.sedes > 1 ? ` · ${row.sedes} sedes${row.nombre_secop ? ` · en SECOP: ${row.nombre_secop}` : ''}` : ''}`}
                              {group === 'proveedor' && (row.nit ? `NIT ${row.nit}` : 'Sin NIT')}
                              {group === 'ejecutivo' && (row.zonas || []).join(', ')}
                            </div>
                          </td>
                          {group === 'hospital' && (
                            <>
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
                            </>
                          )}
                          {group !== 'hospital' && <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{(group === 'proveedor' ? row.entidades : row.hospitales) ?? 0}</td>}
                          <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">{formatCop(row.valor)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-gray-700 whitespace-nowrap">{formatPct(row.pct)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{row.contratos.toLocaleString('es-CO')}</td>
                          <td className="py-2 pr-3">
                            <LineaBar lineas={row.lineas} total={row.valor} />
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{formatFechaGiro(row.ultimaFecha)}</td>
                          <td className="py-2 pr-3 text-gray-600 text-xs">{(group === 'hospital' ? row.top_proveedor : row.top_entidad) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > visible && (
                  <div className="text-center mt-4">
                    <button type="button" onClick={() => setVisible(v => v + PAGE)} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Mostrar más ({rows.length - visible} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proveedor × IPS */}
          {data && data.ambito === 'ips' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Proveedor × IPS</h2>
                  <p className="text-xs text-gray-500">Quién le vende a quién (los {data.pares.length} pares de más valor en el rango).</p>
                </div>
                <label className="text-sm w-full sm:w-72">
                  <span className="sr-only">Buscar proveedor o IPS</span>
                  <input
                    type="search"
                    value={paresFiltro}
                    onChange={event => {
                      setParesFiltro(event.target.value)
                      setParesVisible(PAGE)
                    }}
                    placeholder="Buscar proveedor, NIT o IPS"
                    className={inputCls}
                  />
                </label>
              </div>
              {pares.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Sin pares para estos filtros.</p>
              ) : (
                <>
                  <ul className="sm:hidden divide-y divide-gray-100 border-t border-gray-100">
                    {pares.slice(0, paresVisible).map(par => (
                      <li key={`${par.proveedor_key}|${par.nit_entidad}`} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 break-words">
                              {par.proveedor} {par.vigilado && <VigiladoChip />}
                            </p>
                            <p className="text-xs text-gray-500 break-words">
                              a{' '}
                              {par.hospital_id ? (
                                <Link href={`/hospitals/${par.hospital_id}`} className="hover:underline">
                                  {par.hospital}
                                </Link>
                              ) : (
                                par.hospital
                              )}{' '}
                              · {par.contratos} contratos · último {formatFechaGiro(par.ultimaFecha)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap shrink-0">{formatCopCompact(par.valor)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                          <th className="py-2 pr-3 font-medium">Proveedor</th>
                          <th className="py-2 pr-3 font-medium">IPS</th>
                          <th className="py-2 pr-3 font-medium text-right">Valor</th>
                          <th className="py-2 pr-3 font-medium text-right">Contratos</th>
                          <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Último</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pares.slice(0, paresVisible).map(par => (
                          <tr key={`${par.proveedor_key}|${par.nit_entidad}`} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                            <td className="py-2 pr-3">
                              {par.proveedor_nit ? (
                                <button type="button" onClick={() => openProveedor(par.proveedor_nit)} className="font-medium text-gray-900 hover:underline text-left">
                                  {par.proveedor}
                                </button>
                              ) : (
                                <span className="font-medium text-gray-900">{par.proveedor}</span>
                              )}{' '}
                              {par.vigilado && <VigiladoChip />}
                              {par.proveedor_nit && <div className="text-xs text-gray-500">NIT {par.proveedor_nit}</div>}
                            </td>
                            <td className="py-2 pr-3 text-gray-700">
                              {par.hospital_id ? (
                                <Link href={`/hospitals/${par.hospital_id}`} className="hover:underline">
                                  {par.hospital}
                                </Link>
                              ) : (
                                par.hospital
                              )}
                              <div className="text-xs text-gray-500">NIT {par.nit_entidad}</div>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">{formatCop(par.valor)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{par.contratos.toLocaleString('es-CO')}</td>
                            <td className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{formatFechaGiro(par.ultimaFecha)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pares.length > paresVisible && (
                    <div className="text-center mt-4">
                      <button type="button" onClick={() => setParesVisible(v => v + PAGE)} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Mostrar más ({pares.length - paresVisible} restantes)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {data && (
        <div className="text-xs text-gray-500 space-y-1 mb-8">
          {data.notes.map(note => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}

      {can('fuentes:manage') && <SecopVigilados onOpenProveedor={openProveedor} />}

      {proveedor && <ProveedorPanel nit={proveedor} onClose={closeProveedor} />}
    </div>
  )
}

/** Panel lateral (hoja inferior en celular) con dónde vende un proveedor. */
function ProveedorPanel({ nit, onClose }: { nit: string; onClose: () => void }) {
  const [data, setData] = useState<ProveedorSecopResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch(`/api/secop/proveedor/${encodeURIComponent(nit)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        if (!cancelled) setData(body as ProveedorSecopResponse)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el proveedor')
      })
    return () => {
      cancelled = true
    }
  }, [nit])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const entidades = data ? (verTodas ? data.entidades : data.entidades.slice(0, 15)) : []

  return (
    // Debajo de la barra superior fija (h-16, z-[9999]): el panel empieza en top-16 para no quedar tapado.
    <div className="fixed inset-x-0 bottom-0 top-16 z-[1000] flex items-end sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label="Proveedor en SECOP">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Cerrar" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-xl max-h-[85%] sm:max-h-none sm:h-full overflow-y-auto rounded-t-2xl sm:rounded-none shadow-xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 break-words">{data?.nombre || `NIT ${nit}`}</h2>
            <p className="text-sm text-gray-500 mt-1">
              NIT {nit}
              {data?.lista?.ciudad ? ` · ${data.lista.ciudad}` : ''}
              {data?.vigilado ? ' · ' : ''}
              {data?.vigilado && <VigiladoChip />}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !data ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-40 bg-gray-100 rounded-xl" />
          </div>
        ) : data.contratos === 0 ? (
          <p className="text-sm text-gray-600">Sin contratos ortopédicos de este proveedor en SECOP.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500">Vendido a entidades públicas</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCopCompact(data.total)}</p>
                <p className="text-xs text-gray-500">
                  {data.contratos.toLocaleString('es-CO')} contratos · {data.entidades.length} entidades
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500">A IPS de OpMap</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCopCompact(data.totalIps)}</p>
                <p className="text-xs text-gray-500">
                  {formatFechaGiro(data.primeraFecha)} a {formatFechaGiro(data.ultimaFecha)}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Por año y línea</h3>
              <SecopAnnualChart points={data.anual} height={180} ariaLabel={`Ventas públicas por año de ${data.nombre ?? nit}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Dónde vende ({data.entidades.length})</h3>
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {entidades.map(ent => (
                  <li key={ent.nit} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 break-words">
                          {ent.hospital_id ? (
                            <Link href={`/hospitals/${ent.hospital_id}`} className="hover:underline">
                              {ent.nombre}
                            </Link>
                          ) : (
                            ent.nombre
                          )}{' '}
                          {ent.esIps && <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">IPS de OpMap</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          NIT {ent.nit} · {ent.contratos} contratos · último {formatFechaGiro(ent.ultimaFecha)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {Object.entries(ent.anios)
                            .sort(([a], [b]) => b.localeCompare(a))
                            .slice(0, 4)
                            .map(([anio, valor]) => `${anio}: ${formatCopCompact(valor)}`)
                            .join(' · ')}
                        </p>
                        <LineaBar lineas={ent.lineas} total={ent.valor} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap shrink-0">{formatCopCompact(ent.valor)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {data.entidades.length > 15 && (
                <button type="button" onClick={() => setVerTodas(v => !v)} className="mt-2 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {verTodas ? 'Ver menos' : `Ver las ${data.entidades.length}`}
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              {data.notes.map(note => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
