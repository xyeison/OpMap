'use client'

// Panel "Territorio por ejecutivo comercial" (Fase 2b) de /lines.
// Por cada Ejecutivo Comercial de la línea: nombre comercial de la zona (editable), resumen,
// acordeón departamento → municipio → IPS, exportación CSV de los anexos A y B, vista imprimible
// y versiones inmutables (guardar, ver y comparar con el territorio vigente).
// Contrato: GET /api/territory?line=<code>, GET /api/territory/export, PUT /api/territory/names,
// GET|POST /api/territory/snapshots, GET /api/territory/snapshots/[id] y /[id]/diff.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  AnnexAHospital,
  AnnexBDepartment,
  LineTerritoriesResponse,
  Territory,
  TerritoryDiff,
  TerritorySnapshot,
  TerritorySnapshotListItem,
  TerritoryZone,
} from '@/lib/territory'

interface TerritoryPanelProps {
  /** Código de la línea elegida en la cobertura (null = ninguna). */
  lineCode: string | null
  /** Cambia cuando la cobertura se recalcula o se ajusta, para recargar el territorio. */
  refreshKey?: number
}

const ZONE_KIND_LABEL: Record<TerritoryZone['kind'], string> = {
  local: 'Local',
  reach: 'Por alcance',
  manual: 'Ajuste manual',
}

const FALLBACK_COLOR = '#9ca3af'

/** "2 h 40", "45 min" */
function formatRoad(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return ''
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

function formatDate(value: string | null | undefined, withTime = true): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return withTime
    ? date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('es-CO', { dateStyle: 'long' })
}

function todayLabel(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `v${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function formatNumber(value: number): string {
  return value.toLocaleString('es-CO')
}

async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data.error === 'string' && data.error) return data.error
  return `${fallback} (${response.status})`
}

function exportUrl(lineCode: string, executiveId: string, annex: 'a' | 'b'): string {
  const params = new URLSearchParams({ line: lineCode, executive: executiveId, annex })
  return `/api/territory/export?${params.toString()}`
}

/** IPS del Anexo A agrupadas por código de municipio/localidad. */
function hospitalsByMunicipality(annexA: AnnexAHospital[]): Map<string, AnnexAHospital[]> {
  const map = new Map<string, AnnexAHospital[]>()
  for (const hospital of annexA) {
    const key = hospital.municipality_code || ''
    const list = map.get(key) || []
    list.push(hospital)
    map.set(key, list)
  }
  return map
}

/** IPS del Anexo A cuyo municipio no está en el Anexo B (el municipio lo colorea otra zona por mayoría). */
function orphanHospitals(annexA: AnnexAHospital[], annexB: AnnexBDepartment[]): AnnexAHospital[] {
  const codes = new Set(annexB.flatMap(group => group.municipalities.map(m => m.code)))
  return annexA.filter(hospital => !hospital.municipality_code || !codes.has(hospital.municipality_code))
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type PrintTarget = {
  zoneName: string
  lineName: string
  executiveName: string
  dateLabel: string
  versionLabel: string | null
  contentHash: string
  zones: TerritoryZone[]
  annexA: AnnexAHospital[]
  annexB: AnnexBDepartment[]
  reachPending: boolean
}

export default function TerritoryPanel({ lineCode, refreshKey = 0 }: TerritoryPanelProps) {
  const [data, setData] = useState<LineTerritoriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState('')
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null)
  const [savingFor, setSavingFor] = useState<Territory | null>(null)
  const [viewing, setViewing] = useState<TerritorySnapshot | null>(null)
  const [comparing, setComparing] = useState<{ snapshot: TerritorySnapshotListItem; diff: TerritoryDiff } | null>(null)
  const [versionsVersion, setVersionsVersion] = useState(0)

  const load = useCallback(async (code: string) => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`/api/territory?line=${encodeURIComponent(code)}`)
      if (!response.ok) throw new Error(await readError(response, 'Error al cargar el territorio'))
      const body = await response.json().catch(() => null)
      if (!body || !Array.isArray(body.territories) || !body.line) throw new Error('Respuesta inesperada del servidor')
      setData(body as LineTerritoriesResponse)
    } catch (error: unknown) {
      console.error('Error cargando territorios:', error)
      setData(null)
      setLoadError(error instanceof Error ? error.message : 'Error al cargar el territorio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!lineCode) {
      setData(null)
      return
    }
    setNotice('')
    load(lineCode)
  }, [lineCode, refreshKey, load])

  // Una sola ejecutiva visible: se abre directamente
  useEffect(() => {
    if (data && data.territories.length === 1) setExpanded(new Set([data.territories[0].executive.id]))
  }, [data])

  // Imprimir: el anexo se monta en un portal hijo directo de <body>; @media print oculta el resto
  useEffect(() => {
    if (!printTarget) return
    const body = document.body
    body.classList.add('territory-printing')
    const done = () => {
      body.classList.remove('territory-printing')
      setPrintTarget(null)
    }
    window.addEventListener('afterprint', done, { once: true })
    const timer = window.setTimeout(() => window.print(), 50)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', done)
      body.classList.remove('territory-printing')
    }
  }, [printTarget])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const updateTerritoryName = (executiveId: string, name: string) => {
    setData(prev =>
      prev
        ? {
            ...prev,
            territories: prev.territories.map(t =>
              t.executive.id === executiveId ? { ...t, zone_name: name, zone_name_is_custom: true } : t
            ),
          }
        : prev
    )
  }

  const printCurrent = (territory: Territory) =>
    setPrintTarget({
      zoneName: territory.zone_name,
      lineName: territory.line.name,
      executiveName: territory.executive.full_name,
      dateLabel: formatDate(territory.generated_at),
      versionLabel: null,
      contentHash: territory.content_hash,
      zones: territory.zones,
      annexA: territory.annex_a,
      annexB: territory.annex_b,
      reachPending: territory.reach_pending,
    })

  const printSnapshot = (snapshot: TerritorySnapshot) =>
    setPrintTarget({
      zoneName: snapshot.summary.zone_name || snapshot.version_label,
      lineName: snapshot.summary.line_name || data?.line.name || '',
      executiveName: snapshot.summary.executive_name || '',
      dateLabel: formatDate(snapshot.created_at),
      versionLabel: snapshot.version_label,
      contentHash: snapshot.content_hash,
      zones: snapshot.summary.zones_detail || [],
      annexA: snapshot.annex_a,
      annexB: snapshot.annex_b,
      reachPending: snapshot.summary.reach_pending === true,
    })

  if (!lineCode) return null

  return (
    // id="anexo": destino del enlace "Ver anexo" del resumen del traspaso (/lines?line=<código>#anexo)
    <div id="anexo" className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Territorio por ejecutivo comercial{data ? ` · ${data.line.name}` : ''}
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Lo que recibe cada Ejecutivo Comercial: sus zonas, las IPS que debe visitar (Anexo A) y los municipios
            de su territorio (Anexo B). Los municipios sin IPS se asignan por <strong>tiempo real por carretera</strong>{' '}
            desde la ciudad base, nunca por distancia en línea recta; los que no tienen ruta terrestre o superan el
            alcance no entran en ningún anexo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(lineCode)}
          disabled={loading}
          className="shrink-0 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {/* Convenciones */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold border bg-gray-900 text-white border-gray-900">
          Con IPS · hay que visitar
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold border bg-white text-gray-700 border-gray-400 border-dashed">
          Alcance · sin IPS hoy (si abre una clínica, la visita este ejecutivo)
        </span>
      </div>

      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{notice}</div>}

      {data?.reach_pending && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          Municipios de alcance pendientes de cálculo: por ahora el Anexo B muestra solo los municipios con IPS. Los
          municipios sin IPS se añadirán cuando se calculen los tiempos por carretera.
        </div>
      )}
      {data && !data.reach_pending && data.pending_municipalities > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
          {formatNumber(data.pending_municipalities)} municipios del país siguen pendientes de cálculo por carretera y
          aún no aparecen en ningún anexo.
        </div>
      )}
      {data && !data.storage_ready && (
        <p className="mb-4 text-xs text-gray-500">
          Las versiones y los nombres comerciales de zona se activarán al aplicar la migración de la Fase 2b.
        </p>
      )}

      {loadError ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            onClick={() => load(lineCode)}
            className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : loading && !data ? (
        <div className="text-center py-10 text-sm text-gray-500">Cargando territorios...</div>
      ) : !data || data.territories.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">No hay ejecutivos comerciales con territorio en esta línea.</div>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {data.territories.map(territory => (
            <TerritoryCard
              key={territory.executive.id}
              territory={territory}
              lineCode={data.line.code}
              open={expanded.has(territory.executive.id)}
              onToggle={() => toggle(territory.executive.id)}
              canEditName={data.can_edit_names && data.storage_ready}
              canSnapshot={data.can_snapshot && data.storage_ready}
              storageReady={data.storage_ready}
              onNameSaved={name => {
                updateTerritoryName(territory.executive.id, name)
                setNotice(`Nombre de zona guardado: ${name}`)
              }}
              onPrint={() => printCurrent(territory)}
              onSaveVersion={() => setSavingFor(territory)}
              onView={setViewing}
              onCompare={(snapshot, diff) => setComparing({ snapshot, diff })}
              versionsVersion={versionsVersion}
            />
          ))}
        </div>
      )}

      {savingFor && (
        <SaveVersionModal
          territory={savingFor}
          onClose={() => setSavingFor(null)}
          onSaved={snapshot => {
            setSavingFor(null)
            setVersionsVersion(v => v + 1)
            setExpanded(prev => new Set(prev).add(snapshot.executive_id))
            setNotice(`Versión "${snapshot.version_label}" guardada (hash ${snapshot.content_hash.slice(0, 12)}).`)
          }}
        />
      )}

      {viewing && (
        <SnapshotModal snapshot={viewing} onClose={() => setViewing(null)} onPrint={() => printSnapshot(viewing)} />
      )}

      {comparing && (
        <DiffModal snapshot={comparing.snapshot} diff={comparing.diff} onClose={() => setComparing(null)} />
      )}

      {printTarget && typeof document !== 'undefined' &&
        createPortal(
          <div className="territory-print-root">
            <PrintableAnnex target={printTarget} />
          </div>,
          document.body
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta por ejecutivo
// ---------------------------------------------------------------------------

interface TerritoryCardProps {
  territory: Territory
  lineCode: string
  open: boolean
  onToggle: () => void
  canEditName: boolean
  canSnapshot: boolean
  storageReady: boolean
  onNameSaved: (name: string) => void
  onPrint: () => void
  onSaveVersion: () => void
  onView: (snapshot: TerritorySnapshot) => void
  onCompare: (snapshot: TerritorySnapshotListItem, diff: TerritoryDiff) => void
  versionsVersion: number
}

function TerritoryCard({
  territory,
  lineCode,
  open,
  onToggle,
  canEditName,
  canSnapshot,
  storageReady,
  onNameSaved,
  onPrint,
  onSaveVersion,
  onView,
  onCompare,
  versionsVersion,
}: TerritoryCardProps) {
  const { executive, summary } = territory
  const color = executive.color || FALLBACK_COLOR

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 flex flex-col xl:flex-row xl:items-center gap-3 justify-between bg-gray-50">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}
            className="mt-1 text-gray-500 hover:text-gray-900 shrink-0"
          >
            <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="mt-1.5 w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <ZoneNameEditor
              territory={territory}
              canEdit={canEditName}
              onSaved={onNameSaved}
            />
            <div className="text-sm text-gray-600">
              {executive.full_name}
              {executive.status === 'placeholder' && <span className="ml-1 text-xs text-amber-700">(por contratar)</span>}
              {executive.status === 'inactive' && <span className="ml-1 text-xs text-gray-400">(inactivo)</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-700">
              <span><strong>{summary.zones}</strong> {summary.zones === 1 ? 'zona' : 'zonas'}</span>
              <span><strong>{summary.municipalities_ips}</strong> municipios con IPS</span>
              <span>
                <strong>{territory.reach_pending ? '—' : summary.municipalities_reach}</strong> de alcance
              </span>
              <span><strong>{formatNumber(summary.hospitals)}</strong> IPS</span>
              <span><strong>{formatNumber(summary.beds)}</strong> camas</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end shrink-0">
          <a
            href={exportUrl(lineCode, executive.id, 'a')}
            download
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-800"
          >
            Exportar Anexo A (CSV)
          </a>
          <a
            href={exportUrl(lineCode, executive.id, 'b')}
            download
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-800"
          >
            Exportar Anexo B (CSV)
          </a>
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-800"
          >
            Imprimir anexo
          </button>
          {canSnapshot && (
            <button
              type="button"
              onClick={onSaveVersion}
              className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              Guardar versión
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-5">
          <ZonesList zones={territory.zones} />
          <AnnexAccordion annexA={territory.annex_a} annexB={territory.annex_b} zones={territory.zones} />
          <VersionsList
            territory={territory}
            lineCode={lineCode}
            storageReady={storageReady}
            onView={onView}
            onCompare={onCompare}
            reloadKey={versionsVersion}
          />
          <p className="text-[11px] text-gray-400 break-all">Hash del contenido vigente: {territory.content_hash}</p>
        </div>
      )}
    </div>
  )
}

function ZonesList({ zones }: { zones: TerritoryZone[] }) {
  if (zones.length === 0) {
    return <p className="text-sm text-gray-500">No cubre ninguna zona en esta línea.</p>
  }
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Zonas</h3>
      <div className="flex flex-wrap gap-2">
        {zones.map(zone => (
          <span key={zone.kam_id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border bg-white border-gray-200 text-gray-800">
            <strong>{zone.name}</strong>
            {zone.base_city && <span className="text-gray-500">({zone.base_city})</span>}
            <span className="text-gray-500">· {ZONE_KIND_LABEL[zone.kind] ?? zone.kind}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Nombre comercial editable
// ---------------------------------------------------------------------------

function ZoneNameEditor({
  territory,
  canEdit,
  onSaved,
}: {
  territory: Territory
  canEdit: boolean
  onSaved: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(territory.zone_name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!editing) setValue(territory.zone_name)
  }, [territory.zone_name, editing])

  const save = async () => {
    const name = value.trim()
    if (name.length < 2) {
      setError('Mínimo 2 caracteres')
      return
    }
    if (name === territory.zone_name) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/territory/names', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: territory.line.id, executive_id: territory.executive.id, name }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo guardar el nombre'))
      const body = await response.json().catch(() => null)
      onSaved(typeof body?.name === 'string' ? body.name : name)
      setEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el nombre')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base font-bold text-gray-900">{territory.zone_name}</span>
        {!territory.zone_name_is_custom && <span className="text-[11px] text-gray-400">(nombre por defecto)</span>}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-gray-900 underline"
          >
            Renombrar
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          maxLength={120}
          autoFocus
          aria-label="Nombre comercial de la zona"
          className="px-2 py-1 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-700 min-w-[16rem]"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setError('')
          }}
          disabled={saving}
          className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Acordeón departamento → municipio → IPS
// ---------------------------------------------------------------------------

function MunicipalityBadge({ kind }: { kind: 'ips' | 'reach' }) {
  return kind === 'ips' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-900 text-white">Con IPS</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border border-dashed border-gray-400 text-gray-600">
      Alcance
    </span>
  )
}

function HospitalList({ hospitals, zoneNames }: { hospitals: AnnexAHospital[]; zoneNames: Map<string, string> }) {
  return (
    <ul className="mt-1 mb-2 ml-6 space-y-0.5">
      {hospitals.map(hospital => (
        <li key={hospital.code} className="text-xs text-gray-700 flex flex-wrap gap-x-2">
          <span className="font-medium text-gray-900">{hospital.name}</span>
          <span className="text-gray-500">{hospital.code}</span>
          <span className="text-gray-500">· {formatNumber(hospital.beds)} camas</span>
          {zoneNames.size > 1 && <span className="text-gray-400">· {zoneNames.get(hospital.kam_id) || ''}</span>}
        </li>
      ))}
    </ul>
  )
}

function AnnexAccordion({
  annexA,
  annexB,
  zones,
}: {
  annexA: AnnexAHospital[]
  annexB: AnnexBDepartment[]
  zones: TerritoryZone[]
}) {
  const [openDepartments, setOpenDepartments] = useState<Set<string>>(new Set())
  const [openMunicipalities, setOpenMunicipalities] = useState<Set<string>>(new Set())
  const byMunicipality = useMemo(() => hospitalsByMunicipality(annexA), [annexA])
  const orphans = useMemo(() => orphanHospitals(annexA, annexB), [annexA, annexB])
  const zoneNames = useMemo(() => new Map(zones.map(zone => [zone.kam_id, zone.name])), [zones])

  const toggleIn = (setter: typeof setOpenDepartments, key: string) =>
    setter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (annexB.length === 0 && annexA.length === 0) {
    return <p className="text-sm text-gray-500">Sin municipios ni IPS en este territorio.</p>
  }

  const allOpen = annexB.length > 0 && annexB.every(group => openDepartments.has(group.department))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Municipios e IPS</h3>
        {annexB.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenDepartments(allOpen ? new Set() : new Set(annexB.map(group => group.department)))}
            className="text-xs text-gray-500 hover:text-gray-900 underline"
          >
            {allOpen ? 'Contraer todo' : 'Expandir todo'}
          </button>
        )}
      </div>
      <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
        {annexB.map(group => {
          const isOpen = openDepartments.has(group.department)
          const ipsCount = group.municipalities.filter(m => m.kind === 'ips').length
          const reachCount = group.municipalities.length - ipsCount
          return (
            <div key={group.department}>
              <button
                type="button"
                onClick={() => toggleIn(setOpenDepartments, group.department)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm font-semibold text-gray-900">{group.department}</span>
                <span className="text-xs text-gray-500">
                  {ipsCount} con IPS{reachCount > 0 ? ` · ${reachCount} de alcance` : ''}
                </span>
              </button>
              {isOpen && (
                <ul className="px-3 pb-2">
                  {group.municipalities.map(municipality => {
                    const hospitals = byMunicipality.get(municipality.code) || []
                    const key = `${group.department}|${municipality.code}`
                    const municipalityOpen = openMunicipalities.has(key)
                    return (
                      <li key={municipality.code} className="py-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {hospitals.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleIn(setOpenMunicipalities, key)}
                              aria-expanded={municipalityOpen}
                              className="text-gray-500 hover:text-gray-900"
                              aria-label={municipalityOpen ? 'Ocultar IPS' : 'Ver IPS'}
                            >
                              <svg className={`w-3 h-3 transition-transform ${municipalityOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="w-3" />
                          )}
                          <span className={municipality.kind === 'ips' ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                            {municipality.name}
                          </span>
                          <MunicipalityBadge kind={municipality.kind} />
                          {municipality.kind === 'ips' && (
                            <span className="text-xs text-gray-500">
                              {municipality.ips_count} IPS en el municipio
                              {hospitals.length !== municipality.ips_count ? ` (${hospitals.length} de esta zona)` : ''}
                            </span>
                          )}
                          {municipality.travel_minutes !== null && (
                            <span className="text-xs text-gray-500">· {formatRoad(municipality.travel_minutes)} por carretera</span>
                          )}
                        </div>
                        {municipalityOpen && hospitals.length > 0 && <HospitalList hospitals={hospitals} zoneNames={zoneNames} />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
        {orphans.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => toggleIn(setOpenDepartments, '__orphans__')}
              aria-expanded={openDepartments.has('__orphans__')}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-900">IPS asignadas en municipios de otra zona</span>
              <span className="text-xs text-gray-500">{orphans.length} IPS</span>
            </button>
            {openDepartments.has('__orphans__') && (
              <div className="px-3 pb-2">
                <p className="text-xs text-gray-500 mb-1">
                  Estas IPS están en el Anexo A, pero su municipio lo gana otra zona por mayoría de camas.
                </p>
                <ul className="space-y-0.5">
                  {orphans.map(hospital => (
                    <li key={hospital.code} className="text-xs text-gray-700 flex flex-wrap gap-x-2">
                      <span className="font-medium text-gray-900">{hospital.name}</span>
                      <span className="text-gray-500">{hospital.municipality}, {hospital.department}</span>
                      <span className="text-gray-500">· {formatNumber(hospital.beds)} camas</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Versiones
// ---------------------------------------------------------------------------

function VersionsList({
  territory,
  lineCode,
  storageReady,
  onView,
  onCompare,
  reloadKey,
}: {
  territory: Territory
  lineCode: string
  storageReady: boolean
  onView: (snapshot: TerritorySnapshot) => void
  onCompare: (snapshot: TerritorySnapshotListItem, diff: TerritoryDiff) => void
  reloadKey: number
}) {
  const [snapshots, setSnapshots] = useState<TerritorySnapshotListItem[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const params = new URLSearchParams({ line: lineCode, executive: territory.executive.id })
        const response = await fetch(`/api/territory/snapshots?${params.toString()}`)
        if (!response.ok) throw new Error(await readError(response, 'No se pudieron cargar las versiones'))
        const body = await response.json().catch(() => null)
        if (!cancelled) setSnapshots(Array.isArray(body?.snapshots) ? body.snapshots : [])
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las versiones')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lineCode, territory.executive.id, storageReady, reloadKey])

  const view = async (snapshot: TerritorySnapshotListItem) => {
    setBusyId(snapshot.id)
    setError('')
    try {
      const response = await fetch(`/api/territory/snapshots/${snapshot.id}`)
      if (!response.ok) throw new Error(await readError(response, 'No se pudo cargar la versión'))
      const body = await response.json().catch(() => null)
      if (!body?.snapshot) throw new Error('Respuesta inesperada del servidor')
      onView(body.snapshot as TerritorySnapshot)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la versión')
    } finally {
      setBusyId(null)
    }
  }

  const compare = async (snapshot: TerritorySnapshotListItem) => {
    setBusyId(snapshot.id)
    setError('')
    try {
      const response = await fetch(`/api/territory/snapshots/${snapshot.id}/diff`)
      if (!response.ok) throw new Error(await readError(response, 'No se pudo comparar la versión'))
      const body = await response.json().catch(() => null)
      if (!body || !Array.isArray(body.added_municipalities)) throw new Error('Respuesta inesperada del servidor')
      onCompare(snapshot, body as TerritoryDiff)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo comparar la versión')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Versiones guardadas</h3>
      {!storageReady ? (
        <p className="text-xs text-gray-500">Disponibles al aplicar la migración de la Fase 2b.</p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : snapshots === null ? (
        <p className="text-xs text-gray-500">Cargando versiones...</p>
      ) : snapshots.length === 0 ? (
        <p className="text-xs text-gray-500">Aún no hay versiones guardadas.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-gray-700">
                <th className="px-3 py-2 font-bold">Versión</th>
                <th className="px-3 py-2 font-bold">Fecha</th>
                <th className="px-3 py-2 font-bold">Guardada por</th>
                <th className="px-3 py-2 font-bold">Contenido</th>
                <th className="px-3 py-2 font-bold">Hash</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snapshots.map(snapshot => (
                <tr key={snapshot.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-gray-900">{snapshot.version_label}</div>
                    {snapshot.note && <div className="text-gray-500 max-w-xs">{snapshot.note}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatDate(snapshot.created_at)}</td>
                  <td className="px-3 py-2 text-gray-700">{snapshot.created_by_name || '—'}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {snapshot.summary?.municipalities_ips ?? 0} con IPS · {snapshot.summary?.municipalities_reach ?? 0} alcance ·{' '}
                    {snapshot.summary?.hospitals ?? 0} IPS
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-500" title={snapshot.content_hash}>
                    {snapshot.content_hash.slice(0, 12)}
                    {snapshot.content_hash === territory.content_hash && (
                      <span className="ml-1 font-sans text-green-700">(= vigente)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => view(snapshot)}
                      disabled={busyId === snapshot.id}
                      className="px-2 py-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded font-medium disabled:opacity-50"
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => compare(snapshot)}
                      disabled={busyId === snapshot.id}
                      className="px-2 py-1 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded font-medium disabled:opacity-50"
                    >
                      Comparar con vigente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function SaveVersionModal({
  territory,
  onClose,
  onSaved,
}: {
  territory: Territory
  onClose: () => void
  onSaved: (snapshot: TerritorySnapshot) => void
}) {
  const [label, setLabel] = useState(todayLabel())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const versionLabel = label.trim()
    if (!versionLabel) {
      setError('La etiqueta es obligatoria')
      return
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/territory/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: territory.line.id,
          executive_id: territory.executive.id,
          version_label: versionLabel,
          note: note.trim() || null,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo guardar la versión'))
      const body = await response.json().catch(() => null)
      if (!body?.snapshot) throw new Error('Respuesta inesperada del servidor')
      onSaved(body.snapshot as TerritorySnapshot)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la versión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Guardar versión del territorio" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Se guardará una copia <strong>inmutable</strong> de los anexos A y B de{' '}
          <strong>{territory.zone_name}</strong> ({territory.executive.full_name}, {territory.line.name}). No se podrá
          editar ni borrar.
        </p>
        {territory.reach_pending && (
          <p className="text-xs p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
            Los municipios de alcance aún están pendientes de cálculo: esta versión solo incluirá los municipios con IPS.
          </p>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Etiqueta <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nota</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ej.: anexo firmado con el contrato de octubre"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar versión'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function SnapshotModal({ snapshot, onClose, onPrint }: { snapshot: TerritorySnapshot; onClose: () => void; onPrint: () => void }) {
  const summary = snapshot.summary
  return (
    <ModalShell title={`Versión ${snapshot.version_label}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="text-sm text-gray-700 space-y-1">
          <div className="text-base font-bold text-gray-900">{summary.zone_name || snapshot.version_label}</div>
          <div>
            {summary.executive_name} · {summary.line_name}
          </div>
          <div className="text-xs text-gray-500">
            Guardada el {formatDate(snapshot.created_at)}
            {snapshot.created_by_name ? ` por ${snapshot.created_by_name}` : ''}
          </div>
          {snapshot.note && <div className="text-xs text-gray-600">Nota: {snapshot.note}</div>}
          <div className="text-[11px] text-gray-400 break-all">Hash: {snapshot.content_hash}</div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
          <span><strong>{summary.zones}</strong> zonas</span>
          <span><strong>{summary.municipalities_ips}</strong> municipios con IPS</span>
          <span><strong>{summary.municipalities_reach}</strong> de alcance</span>
          <span><strong>{formatNumber(summary.hospitals)}</strong> IPS</span>
          <span><strong>{formatNumber(summary.beds)}</strong> camas</span>
        </div>
        {summary.zones_detail && <ZonesList zones={summary.zones_detail} />}
        <AnnexAccordion annexA={snapshot.annex_a} annexB={snapshot.annex_b} zones={summary.zones_detail || []} />
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onPrint} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">
            Imprimir esta versión
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function DiffModal({
  snapshot,
  diff,
  onClose,
}: {
  snapshot: TerritorySnapshotListItem
  diff: TerritoryDiff
  onClose: () => void
}) {
  const kindLabel = (kind: 'ips' | 'reach') => (kind === 'ips' ? 'Con IPS' : 'Alcance')
  const section = (title: string, tone: 'add' | 'remove', items: React.ReactNode[]) => (
    <div>
      <h4 className={`text-sm font-bold mb-1 ${tone === 'add' ? 'text-green-700' : 'text-red-700'}`}>
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-gray-500">Ninguno.</p>
      ) : (
        <ul className="text-xs text-gray-700 space-y-0.5 max-h-56 overflow-y-auto">{items}</ul>
      )}
    </div>
  )

  return (
    <ModalShell title={`Comparar ${snapshot.version_label} con el vigente`} onClose={onClose} wide>
      <div className="space-y-4">
        {diff.unchanged ? (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            Sin cambios: el territorio vigente es idéntico a esta versión (mismo hash).
          </div>
        ) : (
          <p className="text-sm text-gray-600">Cambios desde la versión guardada el {formatDate(snapshot.created_at)}.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {section(
            'Municipios añadidos',
            'add',
            diff.added_municipalities.map(m => (
              <li key={m.code}>
                + {m.name}, {m.department} <span className="text-gray-400">({kindLabel(m.kind)})</span>
              </li>
            ))
          )}
          {section(
            'Municipios quitados',
            'remove',
            diff.removed_municipalities.map(m => (
              <li key={m.code}>
                − {m.name}, {m.department} <span className="text-gray-400">({kindLabel(m.kind)})</span>
              </li>
            ))
          )}
          {section(
            'IPS añadidas',
            'add',
            diff.added_hospitals.map(h => (
              <li key={h.code}>
                + {h.name} <span className="text-gray-400">({h.municipality}, {h.department})</span>
              </li>
            ))
          )}
          {section(
            'IPS quitadas',
            'remove',
            diff.removed_hospitals.map(h => (
              <li key={h.code}>
                − {h.name} <span className="text-gray-400">({h.municipality}, {h.department})</span>
              </li>
            ))
          )}
        </div>
        <div className="text-[11px] text-gray-400 break-all">
          Hash de la versión: {diff.snapshot_hash}
          <br />
          Hash vigente: {diff.current_hash}
        </div>
        <div className="flex justify-end pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Vista imprimible (solo visible con @media print, ver globals.css)
// ---------------------------------------------------------------------------

function PrintableAnnex({ target }: { target: PrintTarget }) {
  const zoneNames = new Map(target.zones.map(zone => [zone.kam_id, zone.name]))
  const flat = target.annexB.flatMap(group => group.municipalities)
  const beds = target.annexA.reduce((sum, hospital) => sum + hospital.beds, 0)

  return (
    <div className="territory-print">
      <header className="territory-print-header">
        <h1>{target.zoneName}</h1>
        <table className="territory-print-meta">
          <tbody>
            <tr>
              <th>Línea</th>
              <td>{target.lineName}</td>
              <th>Ejecutivo Comercial</th>
              <td>{target.executiveName}</td>
            </tr>
            <tr>
              <th>Fecha</th>
              <td>{target.dateLabel}</td>
              <th>Versión</th>
              <td>{target.versionLabel || 'Vigente (sin versión guardada)'}</td>
            </tr>
            <tr>
              <th>Hash del contenido</th>
              <td colSpan={3} className="territory-print-hash">{target.contentHash}</td>
            </tr>
          </tbody>
        </table>
        <p className="territory-print-summary">
          {target.zones.length} zonas · {flat.filter(m => m.kind === 'ips').length} municipios con IPS ·{' '}
          {flat.filter(m => m.kind === 'reach').length} municipios de alcance · {target.annexA.length} IPS ·{' '}
          {formatNumber(beds)} camas
        </p>
        {target.zones.length > 0 && (
          <p className="territory-print-zones">
            Zonas:{' '}
            {target.zones
              .map(zone => `${zone.name}${zone.base_city ? ` (${zone.base_city})` : ''} – ${ZONE_KIND_LABEL[zone.kind] ?? zone.kind}`)
              .join('; ')}
          </p>
        )}
      </header>

      <section>
        <h2>Anexo A · IPS objetivo (visitar)</h2>
        <table className="territory-print-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>IPS</th>
              <th>Municipio</th>
              <th>Departamento</th>
              <th className="num">Camas</th>
              <th>Zona</th>
            </tr>
          </thead>
          <tbody>
            {target.annexA.map(hospital => (
              <tr key={hospital.code}>
                <td>{hospital.code}</td>
                <td>{hospital.name}</td>
                <td>{hospital.municipality}</td>
                <td>{hospital.department}</td>
                <td className="num">{formatNumber(hospital.beds)}</td>
                <td>{zoneNames.get(hospital.kam_id) || ''}</td>
              </tr>
            ))}
            {target.annexA.length === 0 && (
              <tr>
                <td colSpan={6}>Sin IPS asignadas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Anexo B · Municipios del territorio</h2>
        {target.reachPending && (
          <p className="territory-print-note">
            Municipios de alcance pendientes de cálculo: este anexo incluye solo los municipios con IPS.
          </p>
        )}
        <table className="territory-print-table">
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Código DANE</th>
              <th>Municipio</th>
              <th>Tipo</th>
              <th className="num">IPS</th>
              <th>Por carretera</th>
            </tr>
          </thead>
          <tbody>
            {target.annexB.flatMap(group =>
              group.municipalities.map((municipality, index) => (
                <tr key={`${group.department}|${municipality.code}`}>
                  <td>{index === 0 ? group.department : ''}</td>
                  <td>{municipality.code}</td>
                  <td>{municipality.name}</td>
                  <td>{municipality.kind === 'ips' ? 'Con IPS objetivo (visitar)' : 'De alcance (sin IPS hoy)'}</td>
                  <td className="num">{municipality.kind === 'ips' ? municipality.ips_count : ''}</td>
                  <td>{formatRoad(municipality.travel_minutes)}</td>
                </tr>
              ))
            )}
            {target.annexB.length === 0 && (
              <tr>
                <td colSpan={6}>Sin municipios.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="territory-print-note">
          Los municipios sin IPS se asignan por tiempo real por carretera (Google Maps, en carro) desde la ciudad base de
          la zona, nunca por distancia en línea recta. Los municipios sin acceso terrestre o fuera del alcance no forman
          parte de este territorio. Si en un municipio de alcance abre una IPS, la visita este Ejecutivo Comercial.
        </p>
      </section>
    </div>
  )
}
