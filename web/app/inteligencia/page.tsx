'use client'

// Fase 3 · Inteligencia de giros directos de la ADRES por IPS, municipio, zona y Ejecutivo Comercial.
// Dos fuentes: Reporte 29 (subsidiado, por mes de proceso) e "Identifica tu Giro" (por giro, contributivo
// y subsidiado, con entidad ordenadora). Datos: GET /api/intelligence/giros (permiso intelligence:view).
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import GirosMonthlyChart, { SEGMENTS_REGIMEN, SEGMENTS_TIPO } from '@/components/GirosMonthlyChart'
import IntelligencePoblacion from '@/components/IntelligencePoblacion'
import IntelligenceSecop from '@/components/IntelligenceSecop'
import FuentesDatosPanel from '@/components/FuentesDatosPanel'
import GirosVariaciones from '@/components/GirosVariaciones'
import PeriodoGiros from '@/components/PeriodoGiros'
import { usePermissions } from '@/hooks/usePermissions'
import { csvCell, formatCop, formatCopCompact, formatFechaGiro, formatPct, monthLabel, GIROS_COLORS } from '@/lib/giros-format'

type Group = 'ips' | 'municipio' | 'zona' | 'ejecutivo'
type Fuente = 'reporte29' | 'identifica'
type FuenteParam = 'auto' | Fuente
type Regimen = 'todos' | 'contributivo' | 'subsidiado'

interface EpsShare {
  codigo: string
  nombre: string
  valor: number
  pct: number
}

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
  contributivo: number
  subsidiado: number
  otro: number
  ultima_fecha: string | null
  eps_top: EpsShare[]
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
  fuente: Fuente
  fuenteSolicitada: FuenteParam
  fuenteMotivo: string
  regimen: Regimen
  range: { desde: string; hasta: string; meses: number } | null
  available: { min: string; max: string } | null
  cobertura: { desde: string; hasta: string; texto: string } | null
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
    contributivo: number
    subsidiado: number
    regimenOtro: number
    ultimaFecha: string | null
  }
  series: Array<{ periodo: string; total: number; capitacion: number; evento: number; contributivo: number; subsidiado: number; otro: number }>
  rows: GirosRow[]
  epsTop: EpsShare[]
  notes: string[]
}

const GROUP_TABS: Array<{ value: Group; label: string }> = [
  { value: 'ips', label: 'IPS' },
  { value: 'municipio', label: 'Municipio' },
  { value: 'zona', label: 'Zona' },
  { value: 'ejecutivo', label: 'Ejecutivo Comercial' },
]

const PAGE = 50

const REGIMEN_OPTIONS: Array<{ value: Regimen; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'contributivo', label: 'Contributivo' },
  { value: 'subsidiado', label: 'Subsidiado' },
]

const FUENTE_OPTIONS: Array<{ value: FuenteParam; label: string }> = [
  { value: 'auto', label: 'Automática' },
  { value: 'identifica', label: 'Identifica tu Giro' },
  { value: 'reporte29', label: 'Reporte 29 (subsidiado)' },
]

/** Las dos columnas de reparto según la fuente: por régimen (Identifica tu Giro) o por tipo (Reporte 29). */
function splitColumns(fuente: Fuente): Array<{ key: 'contributivo' | 'subsidiado' | 'capitacion' | 'evento'; label: string }> {
  return fuente === 'identifica'
    ? [
        { key: 'contributivo', label: 'Contributivo' },
        { key: 'subsidiado', label: 'Subsidiado' },
      ]
    : [
        { key: 'capitacion', label: 'Capitación' },
        { key: 'evento', label: 'Evento' },
      ]
}

const entidadLabel = (fuente: Fuente) => (fuente === 'identifica' ? 'entidad ordenadora' : 'EPS')
const ultimaLabel = (row: { ultima_fecha: string | null }, fuente: Fuente) => formatFechaGiro(row.ultima_fecha, fuente === 'reporte29')
const principal = (row: GirosRow) => (row.eps_top[0] ? `${row.eps_top[0].nombre} (${formatPct(row.eps_top[0].pct)})` : null)


function buildCsv(data: GirosResponse): string {
  const lines: string[] = []
  const push = (cells: Array<string | number | null | undefined>) => lines.push(cells.map(csvCell).join(';'))
  const withExecutive = data.line !== null
  const split = splitColumns(data.fuente)
  const splitHeaders = split.map(col => `${col.label} (COP)`)
  const tail = (row: GirosRow) => [ultimaLabel(row, data.fuente), row.eps_top[0]?.nombre ?? '', row.eps_top[0] ? row.eps_top[0].pct.toLocaleString('es-CO') : '']
  const tailHeaders = ['Último giro', `Principal ${entidadLabel(data.fuente)}`, `% de la principal ${entidadLabel(data.fuente)}`]
  push([`Fuente: ${data.fuente === 'identifica' ? 'ADRES Identifica tu Giro' : 'ADRES Reporte 29'}`, `Régimen: ${data.regimen}`])
  if (data.group === 'ips') {
    push(['IPS', 'NIT', 'Municipio', 'Departamento', 'Zona', ...(withExecutive ? ['Ejecutivo Comercial'] : []), 'Camas', 'Giro (COP)', '% del total', ...splitHeaders, 'Giro total del NIT (COP)', 'Sedes del NIT en OpMap', ...tailHeaders])
    for (const row of data.rows) {
      push([row.label, row.nit, row.municipio, row.departamento, row.zona ?? 'Sin zona asignada', ...(withExecutive ? [row.ejecutivo] : []), row.camas, row.giro, row.pct.toLocaleString('es-CO'), ...split.map(col => row[col.key]), row.giro_nit, row.sedes_nit, ...tail(row)])
    }
  } else {
    const first = data.group === 'municipio' ? 'Municipio' : data.group === 'zona' ? 'Zona' : 'Ejecutivo Comercial'
    push([first, ...(data.group === 'municipio' ? ['Departamento'] : []), ...(data.group === 'ejecutivo' ? ['Zonas'] : []), 'IPS', 'IPS con giro', 'Camas', 'Giro (COP)', '% del total', ...splitHeaders, 'IPS con más giro', ...tailHeaders])
    for (const row of data.rows) {
      push([row.label, ...(data.group === 'municipio' ? [row.departamento] : []), ...(data.group === 'ejecutivo' ? [(row.zonas || []).join(', ')] : []), row.ips, row.ipsConGiro, row.camas, row.giro, row.pct.toLocaleString('es-CO'), ...split.map(col => row[col.key]), row.top_ips, ...tail(row)])
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
  a.download = `giros-adres-${data.fuente}-${data.regimen}-${data.group}${data.line ? `-${data.line.code}` : ''}-${range}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`${value.length > 16 ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 tabular-nums mt-1 break-words`}>{value}</p>
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
        {/* useSearchParams exige Suspense en el build (Next 14.2) */}
        <Suspense fallback={null}>
          <InteligenciaTabs />
        </Suspense>
      </PermissionGuard>
    </ProtectedRoute>
  )
}

type Tab = 'giros' | 'secop' | 'fuentes'

// Pestañas de /inteligencia (?tab=secop | fuentes). La pestaña sigue a la URL, también al llegar desde el menú
// ("Compras públicas" estando en ADRES, dueño 2026-10-29); tocar una pestaña cambia la URL con replaceState.
function InteligenciaTabs() {
  const { can } = usePermissions()
  const tabEnUrl = useSearchParams().get('tab')
  const [tab, setTab] = useState<Tab>('giros')
  const canFuentes = can('fuentes:manage')

  useEffect(() => {
    setTab(tabEnUrl === 'secop' || tabEnUrl === 'fuentes' ? tabEnUrl : 'giros')
  }, [tabEnUrl])

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'giros', label: 'Giros y población' },
    { value: 'secop', label: 'Compras públicas' },
    ...(canFuentes ? [{ value: 'fuentes' as Tab, label: 'Fuentes de datos' }] : []),
  ]
  const current: Tab = tab === 'fuentes' && !canFuentes ? 'giros' : tab

  // En celular las pestañas no caben: la activa se desplaza a la vista (si no, "Fuentes de datos" queda cortada)
  useEffect(() => {
    try {
      document.getElementById(`intel-tab-${current}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } catch {
      // navegador sin scrollIntoView con opciones
    }
  }, [current])

  const select = (value: Tab) => {
    setTab(value)
    try {
      const url = new URL(window.location.href)
      if (value === 'giros') url.searchParams.delete('tab')
      else url.searchParams.set('tab', value)
      if (value !== 'secop') url.searchParams.delete('proveedor')
      window.history.replaceState(null, '', url.toString())
    } catch {
      // sin historial: solo cambia la pestaña
    }
  }

  return (
    <>
      <div className="container mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Secciones de inteligencia">
          {tabs.map(item => (
            <button
              key={item.value}
              id={`intel-tab-${item.value}`}
              type="button"
              role="tab"
              aria-selected={current === item.value}
              onClick={() => select(item.value)}
              className={`min-h-[44px] px-3 sm:px-4 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                current === item.value ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {current === 'giros' && (
        <>
          <InteligenciaContent />
          <IntelligencePoblacion />
        </>
      )}
      {current === 'secop' && <IntelligenceSecop />}
      {current === 'fuentes' && canFuentes && <FuentesDatosPanel />}
    </>
  )
}

function InteligenciaContent() {
  const { role } = usePermissions()
  const [lines, setLines] = useState<MyLine[]>([])
  const [group, setGroup] = useState<Group>('ips')
  const [line, setLine] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
  // Período: una opción del selector (u3, u6, u12, todo, un año o personalizado) y el rango explícito que pide a la
  // API; vacío = el rango por defecto de la API (12 meses hasta el último mes con giros), que es "Últimos 12 meses".
  const [periodo, setPeriodo] = useState('u12')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [regimen, setRegimen] = useState<Regimen>('todos')
  const [fuente, setFuente] = useState<FuenteParam>('auto')
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
      if (regimen !== 'todos') params.set('regimen', regimen)
      if (fuente !== 'auto') params.set('fuente', fuente)
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
    // desde/hasta vacíos = rango por defecto de la API (12 meses hasta el último mes con giros de la fuente)
    [group, line, departamento, municipio, desde, hasta, regimen, fuente]
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
    setPeriodo('u12')
    setDesde('')
    setHasta('')
    setRegimen('todos')
    setFuente('auto')
    setGroup(group === 'ejecutivo' && !line ? 'ips' : group)
  }

  const kpis = data?.kpis
  const rangeLabel = data?.range ? `${monthLabel(data.range.desde)} a ${monthLabel(data.range.hasta)}` : ''
  const withExecutive = Boolean(data?.line)
  const rows = data?.rows || []
  const fuenteActual: Fuente = data?.fuente ?? 'reporte29'
  const split = splitColumns(fuenteActual)
  const ultimoGiro = kpis ? formatFechaGiro(kpis.ultimaFecha, fuenteActual === 'reporte29') : '—'

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Inteligencia: giros ADRES</h1>
        <p className="text-gray-600 mt-2">
          Recursos que la ADRES gira directamente a las IPS (régimen contributivo y subsidiado), por NIT del prestador. Sirve para
          ver qué IPS y municipios reciben más recursos y de qué entidades.
        </p>
      </div>

      {/* Filtros: una fila, encima de todo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
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
            <span className="block text-xs font-medium text-gray-600 mb-1">Régimen</span>
            <select value={regimen} onChange={event => setRegimen(event.target.value as Regimen)} className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
              {REGIMEN_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-gray-600 mb-1">Fuente</span>
            <select
              value={fuente}
              onChange={event => {
                // Cada fuente tiene sus meses: el período vuelve a los últimos 12 de la fuente nueva
                setFuente(event.target.value as FuenteParam)
                setPeriodo('u12')
                setDesde('')
                setHasta('')
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              {FUENTE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <PeriodoGiros
            disponible={data?.available ?? null}
            periodo={periodo}
            desde={desde || data?.range?.desde || null}
            hasta={hasta || data?.range?.hasta || null}
            onCambiar={cambio => {
              setPeriodo(cambio.periodo)
              setDesde(cambio.desde)
              setHasta(cambio.hasta)
            }}
          />
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
        {data && (
          <div className="text-xs text-gray-500 mt-3 space-y-0.5">
            <p>
              <span className="font-medium text-gray-700">{data.fuente === 'identifica' ? 'Identifica tu Giro' : 'Reporte 29'}</span>
              {' · '}
              {data.fuenteMotivo}
            </p>
            {data.cobertura ? (
              <p>Cobertura: {data.cobertura.texto}</p>
            ) : (
              data.available && (
                <p>
                  Meses con giros cargados: {monthLabel(data.available.min)} a {monthLabel(data.available.max)}.
                </p>
              )
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {data && !data.available && !loading && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="font-medium text-gray-800">Aún no se han cargado giros de la ADRES en esta fuente.</p>
          {role === 'admin' && (
            <p className="text-sm text-gray-500 mt-1">
              Cargarlos con{' '}
              <code className="px-1 py-0.5 bg-gray-100 rounded">
                cd web &amp;&amp; node scripts/{data.fuente === 'identifica' ? 'adres-identifica-giro.mjs' : 'adres-giros.mjs'}
              </code>
            </p>
          )}
        </div>
      )}

      {kpis && data?.available && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${loading ? 'opacity-60' : ''}`}>
            <Kpi label="Total girado" value={formatCop(kpis.total)} hint={`${rangeLabel} · último giro ${ultimoGiro}`} />
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
            {fuenteActual === 'identifica' ? (
              <Kpi
                label="Contributivo / Subsidiado"
                value={kpis.total > 0 ? `${formatPct((kpis.contributivo / kpis.total) * 100)} / ${formatPct((kpis.subsidiado / kpis.total) * 100)}` : '—'}
                hint={`${formatCopCompact(kpis.contributivo)} · ${formatCopCompact(kpis.subsidiado)}${kpis.regimenOtro > 0 ? ` · otros conceptos ${formatCopCompact(kpis.regimenOtro)}` : ''}`}
              />
            ) : (
              <Kpi
                label="Capitación / Evento"
                value={kpis.total > 0 ? `${formatPct((kpis.capitacion / kpis.total) * 100)} / ${formatPct((kpis.evento / kpis.total) * 100)}` : '—'}
                hint={`${formatCopCompact(kpis.capitacion)} · ${formatCopCompact(kpis.evento)}`}
              />
            )}
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 ${loading ? 'opacity-60' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:col-span-2 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Giro por mes</h2>
              <p className="text-xs text-gray-500 mb-3">
                {rangeLabel} · {fuenteActual === 'identifica' ? 'por fecha de giro, régimen apilado' : 'por mes de proceso, Capitación y Evento apilados'}
              </p>
              <GirosMonthlyChart
                points={data.series}
                stacked
                segments={fuenteActual === 'identifica' ? SEGMENTS_REGIMEN : SEGMENTS_TIPO}
                ariaLabel={`Giro mensual de la ADRES, ${rangeLabel}`}
              />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">{fuenteActual === 'identifica' ? 'Entidades ordenadoras' : 'EPS que más giraron'}</h2>
              <p className="text-xs text-gray-500 mb-3">
                {fuenteActual === 'identifica' ? 'La EPS; en los giros LMA "CXP IPS" del subsidiado, el ente territorial' : 'Régimen subsidiado'}
              </p>
              {data.epsTop.length === 0 ? (
                <p className="text-sm text-gray-500">Sin giros en el rango.</p>
              ) : (
                <ul className="space-y-2.5">
                  {data.epsTop.map(eps => (
                    <li key={eps.codigo}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-gray-800 truncate" title={fuenteActual === 'identifica' && !eps.codigo.startsWith('nombre:') ? `${eps.nombre} (NIT ${eps.codigo})` : eps.nombre}>
                          {eps.nombre} {fuenteActual === 'reporte29' && <span className="text-gray-400 text-xs">{eps.codigo}</span>}
                        </span>
                        <span className="tabular-nums text-gray-900 whitespace-nowrap">
                          {formatCopCompact(eps.valor)} <span className="text-gray-500 text-xs">{formatPct(eps.pct)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1, Math.min(100, eps.pct))}%`, background: GIROS_COLORS.total }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <GirosVariaciones
            line={line}
            departamento={departamento}
            municipio={municipio}
            regimen={regimen}
            fuente={fuente}
            hasta={hasta || null}
            disponible={data.available}
          />

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
                          {split.map(col => `${col.label} ${formatCopCompact(row[col.key])}`).join(' · ')}
                          {group !== 'ips' ? ` · IPS con giro ${row.ipsConGiro} / ${row.ips}` : ''}
                          {group === 'ips' && row.sedes_nit && row.sedes_nit > 1 ? ` · NIT compartido (${row.sedes_nit} sedes)` : ''}
                          {` · último giro ${ultimaLabel(row, fuenteActual)}`}
                        </p>
                        {principal(row) && (
                          <p className="text-xs text-gray-500 mt-0.5 break-words">
                            Principal {entidadLabel(fuenteActual)}: {principal(row)}
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
                      {split.map(col => (
                        <th key={col.key} className="py-2 pr-3 font-medium text-right">
                          {col.label}
                        </th>
                      ))}
                      <th className="py-2 pr-3 font-medium text-right whitespace-nowrap">Último giro</th>
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
                              {principal(row) && (
                                <div className="text-xs text-gray-500" title={`Principal ${entidadLabel(fuenteActual)}`}>
                                  Principal: {principal(row)}
                                </div>
                              )}
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
                            <td className="py-2 pr-3 font-medium text-gray-900">
                              {row.label}
                              {principal(row) && <div className="text-xs font-normal text-gray-500">Principal: {principal(row)}</div>}
                            </td>
                            <td className="py-2 pr-3 text-gray-700">{row.departamento || '—'}</td>
                          </>
                        )}
                        {group === 'zona' && (
                          <td className="py-2 pr-3 font-medium text-gray-900">
                            {row.label}
                            {principal(row) && <div className="text-xs font-normal text-gray-500">Principal: {principal(row)}</div>}
                          </td>
                        )}
                        {group === 'ejecutivo' && (
                          <>
                            <td className="py-2 pr-3 font-medium text-gray-900">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: row.color || '#d1d5db' }} />
                                {row.label}
                              </span>
                              {principal(row) && <div className="text-xs font-normal text-gray-500">Principal: {principal(row)}</div>}
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
                        {split.map(col => (
                          <td key={col.key} className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">
                            {formatCopCompact(row[col.key])}
                          </td>
                        ))}
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-600 whitespace-nowrap">{ultimaLabel(row, fuenteActual)}</td>
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
