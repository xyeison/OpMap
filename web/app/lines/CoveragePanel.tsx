'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { zoneDisplayName } from '@/lib/zone-names'
import type { Executive } from '@/lib/types/lines'
import {
  canEditCoverageOf,
  CONFLICT_COLOR,
  formatMinutes,
  KIND_BADGE,
  KIND_LABELS,
  readError,
  VACANT_COLOR,
  type CoverageKindUI,
  type CoverageResponse,
  type CoverageRowUI,
  type MyLine,
} from './coverage-shared'

// Ejecutiva tal como la devuelve GET /api/executives (Fase 2 añade `color`).
type ExecutiveWithColor = Executive & { color?: string | null }

interface CoveragePanelProps {
  myLines: MyLine[]
  hasCoverageEdit: boolean
  /** kams.id → nombre visible de la zona (para "por alcance desde <zona base>"). */
  zoneNameById: Map<string, string>
  /** Fase 2b: avisa a la página qué línea está elegida (para el panel de territorio). */
  onLineChange?: (code: string | null) => void
  /** Fase 2b: avisa cuando la cobertura cambió (recálculo o ajuste manual). */
  onCoverageChanged?: () => void
}

const KIND_ORDER: CoverageKindUI[] = ['local', 'reach', 'manual', 'vacant', 'conflict']

function zoneLabel(name: string | null | undefined): string {
  return zoneDisplayName(name) || name || ''
}

/** Lee ?line=<code> de la URL (solo en el navegador). */
function readLineFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get('line')
  } catch {
    return null
  }
}

/** Escribe ?line=<code> en la URL sin recargar ni añadir entradas al historial. */
function writeLineToUrl(code: string) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('line', code)
    window.history.replaceState(window.history.state, '', url.toString())
  } catch {
    // Sin URL persistida: no es crítico
  }
}

export default function CoveragePanel({
  myLines,
  hasCoverageEdit,
  zoneNameById,
  onLineChange,
  onCoverageChanged,
}: CoveragePanelProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [recalculating, setRecalculating] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [executives, setExecutives] = useState<ExecutiveWithColor[]>([])
  const [executivesError, setExecutivesError] = useState('')
  const [adjusting, setAdjusting] = useState<CoverageRowUI | null>(null)
  const [removing, setRemoving] = useState<CoverageRowUI | null>(null)

  // Línea inicial: la de la URL si el usuario la tiene; si no, la primera
  useEffect(() => {
    if (myLines.length === 0) {
      setSelectedCode(null)
      return
    }
    setSelectedCode(prev => {
      if (prev && myLines.some(line => line.code === prev)) return prev
      const fromUrl = readLineFromUrl()
      if (fromUrl && myLines.some(line => line.code === fromUrl)) return fromUrl
      return myLines[0].code
    })
  }, [myLines])

  useEffect(() => {
    if (selectedCode) writeLineToUrl(selectedCode)
    onLineChange?.(selectedCode)
  }, [selectedCode, onLineChange])

  const selectedLine = useMemo(
    () => myLines.find(line => line.code === selectedCode),
    [myLines, selectedCode]
  )
  const canEdit = canEditCoverageOf(selectedLine, hasCoverageEdit)

  const loadCoverage = useCallback(async (code: string) => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await fetch(`/api/coverage?line=${encodeURIComponent(code)}`)
      if (!response.ok) throw new Error(await readError(response, 'Error al cargar la cobertura'))
      const data = await response.json().catch(() => null)
      if (!data || !data.line || !Array.isArray(data.rows)) throw new Error('Respuesta inesperada del servidor')
      setCoverage(data as CoverageResponse)
    } catch (error: unknown) {
      console.error('Error cargando cobertura:', error)
      setCoverage(null)
      setLoadError(error instanceof Error ? error.message : 'Error al cargar la cobertura')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedCode) return
    setNotice('')
    setActionError('')
    loadCoverage(selectedCode)
  }, [selectedCode, loadCoverage])

  // Ejecutivas para el ajuste manual (solo si puede editar alguna línea)
  useEffect(() => {
    if (!hasCoverageEdit) return
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/executives')
        if (!response.ok) throw new Error(await readError(response, 'Error al cargar los ejecutivos comerciales'))
        const data = await response.json().catch(() => null)
        if (!cancelled) setExecutives(Array.isArray(data?.executives) ? data.executives : [])
      } catch (error: unknown) {
        console.error('Error cargando ejecutivas para ajustes:', error)
        if (!cancelled) {
          setExecutivesError(error instanceof Error ? error.message : 'Error al cargar los ejecutivos comerciales')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasCoverageEdit])

  const rows = useMemo(() => {
    const list = coverage?.rows ?? []
    return [...list].sort((a, b) => zoneLabel(a.zone_name).localeCompare(zoneLabel(b.zone_name), 'es'))
  }, [coverage])

  const counts = useMemo(() => {
    const byKind: Record<CoverageKindUI, number> = { local: 0, reach: 0, manual: 0, vacant: 0, conflict: 0 }
    let withoutEquipment = 0
    for (const row of rows) {
      if (byKind[row.kind] !== undefined) byKind[row.kind] += 1
      if (!row.has_equipment) withoutEquipment += 1
    }
    return { byKind, withoutEquipment }
  }, [rows])

  const recalculate = async () => {
    if (!selectedCode) return
    setRecalculating(true)
    setNotice('')
    setActionError('')
    try {
      const response = await fetch('/api/coverage/recalculate', { method: 'POST' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo recalcular la cobertura'))
      const data = await response.json().catch(() => null)
      const total = typeof data?.rows === 'number' ? data.rows : null
      setNotice(total !== null ? `Cobertura recalculada (${total} filas en todas las líneas).` : 'Cobertura recalculada.')
      await loadCoverage(selectedCode)
      onCoverageChanged?.()
    } catch (error: unknown) {
      console.error('Error recalculando cobertura:', error)
      setActionError(error instanceof Error ? error.message : 'No se pudo recalcular la cobertura')
    } finally {
      setRecalculating(false)
    }
  }

  const handleAdjusted = async (message: string) => {
    setAdjusting(null)
    setRemoving(null)
    setActionError('')
    setNotice(message)
    if (selectedCode) await loadCoverage(selectedCode)
    onCoverageChanged?.()
  }

  const describeExecutive = (row: CoverageRowUI) => {
    if (row.kind === 'vacant') {
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: VACANT_COLOR }} />
            <span className="text-sm font-medium text-gray-600">Sin cobertura</span>
          </div>
          {row.nearest && (
            <div className="text-xs text-gray-500 mt-0.5">
              Más cercana: {row.nearest.full_name} a {formatMinutes(row.nearest.minutes)}
            </div>
          )}
        </div>
      )
    }
    if (row.kind === 'conflict' || !row.executive) {
      return (
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
            style={{ backgroundColor: row.kind === 'conflict' ? CONFLICT_COLOR : VACANT_COLOR }}
          />
          <span className="text-sm font-medium text-gray-700">
            {row.kind === 'conflict' ? 'Conflicto' : 'Sin asignar'}
          </span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
          style={{ backgroundColor: row.executive.color || VACANT_COLOR }}
        />
        <span className="text-sm font-medium text-gray-900">{row.executive.full_name}</span>
        {row.executive.status === 'placeholder' && <span className="text-xs text-amber-700">(por contratar)</span>}
        {row.executive.status === 'inactive' && <span className="text-xs text-gray-400">(inactiva)</span>}
      </div>
    )
  }

  const describeMinutes = (row: CoverageRowUI) => {
    if (row.kind === 'local') return <span className="text-gray-500">En la zona</span>
    if (row.kind === 'reach' && row.travel_minutes != null) {
      const source =
        (row.source_zone_name ? zoneLabel(row.source_zone_name) : undefined) ??
        (row.source_kam_id ? zoneNameById.get(row.source_kam_id) : undefined)
      return (
        <div>
          <div className="text-gray-900">{formatMinutes(row.travel_minutes)}</div>
          {source && <div className="text-xs text-gray-500">desde {source}</div>}
        </div>
      )
    }
    if (row.travel_minutes != null) return <span className="text-gray-900">{formatMinutes(row.travel_minutes)}</span>
    return <span className="text-gray-400">—</span>
  }

  const describeNote = (row: CoverageRowUI) => {
    const text = row.kind === 'manual' ? row.override_reason || row.note : row.note
    if (!text) return <span className="text-gray-400">—</span>
    return (
      <span className="text-xs text-gray-600" title={text}>
        {text.length > 90 ? `${text.slice(0, 90)}…` : text}
      </span>
    )
  }

  if (myLines.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900">Cobertura por línea</h2>
        <p className="text-sm text-gray-600 mt-2">No tienes líneas asignadas.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cobertura por línea</h2>
          <p className="text-sm text-gray-600 mt-1">
            Qué Ejecutivo Comercial cubre cada zona en la línea elegida: local, por alcance (hasta{' '}
            {coverage ? formatMinutes(coverage.line.max_reach_minutes) : 'el alcance máximo'} de ciudad base a ciudad
            base), ajuste manual o sin cobertura.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={recalculate}
            disabled={recalculating || loading}
            className="shrink-0 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {recalculating ? 'Recalculando...' : 'Recalcular cobertura'}
          </button>
        )}
      </div>

      {/* Selector de línea */}
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Línea de negocio">
        {myLines.map(line => (
          <button
            key={line.id}
            type="button"
            role="tab"
            aria-selected={line.code === selectedCode}
            onClick={() => setSelectedCode(line.code)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              line.code === selectedCode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {line.name}
            {line.role === 'leader' && <span className="ml-1 text-[11px] opacity-75">(líder)</span>}
          </button>
        ))}
      </div>

      {notice && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{notice}</div>}
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{actionError}</div>
      )}
      {!canEdit && selectedLine && (
        <p className="mb-4 text-xs text-gray-500">Vista de solo lectura: no puedes ajustar la cobertura de esta línea.</p>
      )}

      {loadError ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            onClick={() => selectedCode && loadCoverage(selectedCode)}
            className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : loading && !coverage ? (
        <div className="text-center py-10 text-sm text-gray-500">Cargando cobertura...</div>
      ) : (
        <>
          {/* Resumen */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {KIND_ORDER.map(kind => (
              <span key={kind} className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border ${KIND_BADGE[kind]}`}>
                {KIND_LABELS[kind]}: {counts.byKind[kind]}
              </span>
            ))}
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg font-semibold border bg-white text-gray-700 border-gray-300 border-dashed">
              Sin equipo: {counts.withoutEquipment}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-500">
              No hay cobertura calculada para esta línea.
              {canEdit && ' Usa "Recalcular cobertura" para generarla.'}
            </div>
          ) : (
            <div className={`overflow-x-auto border border-gray-100 rounded-xl ${loading ? 'opacity-60' : ''}`}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Zona</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ciudad base</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Ejecutivo Comercial</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tiempo</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Equipo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nota</th>
                    {canEdit && (
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(row => (
                    <tr key={row.kam_id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{zoneLabel(row.zone_name)}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.base_city || '—'}</td>
                      <td className="px-4 py-3">{describeExecutive(row)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${
                            KIND_BADGE[row.kind] ?? KIND_BADGE.vacant
                          }`}
                        >
                          {KIND_LABELS[row.kind] ?? row.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{describeMinutes(row)}</td>
                      <td className="px-4 py-3 text-center">
                        {row.has_equipment ? (
                          <span className="text-xs font-semibold text-green-700">Sí</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border border-dashed border-gray-400 text-gray-600 whitespace-nowrap">
                            Sin equipo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">{describeNote(row)}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setNotice('')
                                setActionError('')
                                setAdjusting(row)
                              }}
                              className="px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium whitespace-nowrap"
                            >
                              Ajuste manual
                            </button>
                            {/* También si el ajuste quedó sin efecto (la ejecutiva dejó la línea, etc.) */}
                            {(row.kind === 'manual' || row.override_id) && (
                              <button
                                onClick={() => {
                                  setNotice('')
                                  setActionError('')
                                  setRemoving(row)
                                }}
                                disabled={!row.override_id}
                                title={row.override_id ? 'Quitar el ajuste manual' : 'La API no envió el id del ajuste'}
                                className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Quitar ajuste
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {adjusting && coverage && (
        <AdjustModal
          row={adjusting}
          line={coverage.line}
          executives={executives}
          executivesError={executivesError}
          onClose={() => setAdjusting(null)}
          onDone={handleAdjusted}
        />
      )}

      {removing && removing.override_id && (
        <RemoveAdjustDialog
          row={removing}
          overrideId={removing.override_id}
          onCancel={() => setRemoving(null)}
          onDone={handleAdjusted}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ajuste manual: POST /api/coverage/overrides { line_id, kam_id, executive_id, reason }
// ---------------------------------------------------------------------------

interface AdjustModalProps {
  row: CoverageRowUI
  line: CoverageResponse['line']
  executives: ExecutiveWithColor[]
  executivesError: string
  onClose: () => void
  onDone: (message: string) => void
}

function AdjustModal({ row, line, executives, executivesError, onClose, onDone }: AdjustModalProps) {
  const [executiveId, setExecutiveId] = useState(row.kind === 'manual' && row.executive ? row.executive.id : '')
  const [reason, setReason] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Regla del dueño: si en la zona ya vive alguien con la línea, solo se puede elegir a quien vive en ella
  // (sirve para resolver un conflicto). La API lo vuelve a validar y responde 409 con el motivo.
  const residentsWithLine = useMemo(
    () =>
      executives
        .filter(e => e.status !== 'inactive' && e.base_kam_id === row.kam_id && e.lines.includes(line.id))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
    [executives, row.kam_id, line.id]
  )

  // Por defecto, solo ejecutivas vigentes que llevan la línea; opcionalmente todas las vigentes
  const options = useMemo(() => {
    return executives
      .filter(e => e.status !== 'inactive')
      .filter(e => showAll || e.lines.includes(line.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  }, [executives, showAll, line.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = reason.trim()
    if (!executiveId) return setError('Selecciona el Ejecutivo Comercial')
    if (!trimmed) return setError('El motivo es obligatorio')

    setSaving(true)
    try {
      const response = await fetch('/api/coverage/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_id: line.id, kam_id: row.kam_id, executive_id: executiveId, reason: trimmed }),
      })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo guardar el ajuste'))
      const chosen = executives.find(ex => ex.id === executiveId)
      onDone(`Ajuste guardado: ${zoneLabel(row.zone_name)} queda con ${chosen?.full_name ?? 'el ejecutivo elegido'} en ${line.name}.`)
    } catch (err: unknown) {
      console.error('Error guardando ajuste manual:', err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ajuste')
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Ajuste manual</h2>
            <p className="text-sm text-gray-300">
              {zoneLabel(row.zone_name)} · {line.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {executivesError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">{executivesError}</div>
          )}

          <p className="text-sm text-gray-600">
            El ajuste manual reemplaza la regla automática para esta zona en esta línea hasta que se quite. Solo se
            puede forzar a un Ejecutivo Comercial de otra ciudad cuando en la zona no hay nadie con esa línea; si en la
            zona hay dos o más con la línea, sirve para elegir a uno de ellos.
          </p>
          {residentsWithLine.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
              {zoneLabel(row.zone_name)} ya tiene a {residentsWithLine.map(e => e.full_name).join(', ')} con{' '}
              {line.name}: solo puedes elegir a quien vive en la zona.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ejecutivo Comercial <span className="text-red-500">*</span>
            </label>
            <select value={executiveId} onChange={e => setExecutiveId(e.target.value)} className={inputClass}>
              <option value="">Selecciona un Ejecutivo Comercial</option>
              {options.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.full_name}
                  {ex.base_kam_name ? ` — ${zoneLabel(ex.base_kam_name)}` : ''}
                  {ex.status === 'placeholder' ? ' (por contratar)' : ''}
                  {!ex.lines.includes(line.id) ? ' (no lleva la línea)' : ''}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
              />
              Mostrar también ejecutivos que no llevan {line.name}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Ej: acuerdo comercial con la clínica, cubre temporalmente mientras se contrata..."
              className={inputClass}
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
              {saving ? 'Guardando...' : 'Guardar ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quitar ajuste: DELETE /api/coverage/overrides/[id]
// ---------------------------------------------------------------------------

interface RemoveAdjustDialogProps {
  row: CoverageRowUI
  overrideId: string
  onCancel: () => void
  onDone: (message: string) => void
}

function RemoveAdjustDialog({ row, overrideId, onCancel, onDone }: RemoveAdjustDialogProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setWorking(true)
    setError('')
    try {
      const response = await fetch(`/api/coverage/overrides/${encodeURIComponent(overrideId)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo quitar el ajuste'))
      onDone(`Se quitó el ajuste manual de ${zoneLabel(row.zone_name)}; la zona vuelve a la regla automática.`)
    } catch (err: unknown) {
      console.error('Error quitando ajuste manual:', err)
      setError(err instanceof Error ? err.message : 'No se pudo quitar el ajuste')
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Quitar ajuste</h3>
        <p className="text-center text-gray-600 mb-4">
          ¿Quitar el ajuste manual de <strong>{zoneLabel(row.zone_name)}</strong>
          {row.executive ? (
            <>
              {' '}
              (hoy con <strong>{row.executive.full_name}</strong>)
            </>
          ) : null}
          ? La cobertura se recalcula con la regla automática.
        </p>
        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={working}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={working}
            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium disabled:opacity-50"
          >
            {working ? 'Procesando...' : 'Quitar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}
