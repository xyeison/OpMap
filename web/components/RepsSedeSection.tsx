'use client'

// Fase 3 · Sección "Sede REPS" de la ficha de una IPS.
// Muestra la sede del REPS vinculada (código de habilitación) y, si la IPS es ambigua o no tiene cruce,
// deja elegir entre las sedes del mismo NIT o buscar cualquier sede para vincularla.
// Datos: GET/PATCH /api/hospitals/[id]/reps-link y GET /api/hospitals/reps/sedes.

import { useCallback, useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface RepsSede {
  codigo_habilitacion: string
  codigo_prestador: string
  nombre_prestador: string
  nombre_sede: string
  nit: string
  naturaleza: string | null
  ese: boolean
  municipio_sede: string
  municipio_sede_nombre: string | null
  departamento_sede: string | null
  direccion_sede: string | null
  telefono_sede?: string | null
  email_sede?: string | null
  clase_prestador: string
  fecha_corte: string | null
}

interface Candidate {
  codigo_habilitacion: string
  nombre_sede: string
  municipio_sede: string
  municipio_sede_nombre: string | null
  direccion_sede: string | null
  same_municipality?: boolean
  score?: number
  principal: boolean
  linked_hospital: { id: string; name: string } | null
}

interface RepsLinkData {
  hospital: {
    id: string
    name: string
    nit: string | null
    municipality_id: string | null
    reps_code: string | null
    reps_match_status: 'matched' | 'ambiguous' | 'unmatched' | null
    reps_matched_at: string | null
  }
  sede: RepsSede | null
  orphan: boolean
  evaluation: { status: string; method: string | null; reason: string; suggested_code: string | null } | null
  candidates: Candidate[]
  cut: { fecha_corte: string | null; total: number }
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  matched: { label: 'Vinculada', className: 'bg-gray-900 text-white' },
  ambiguous: { label: 'Ambigua', className: 'bg-amber-100 text-amber-800' },
  unmatched: { label: 'Sin cruce', className: 'bg-gray-200 text-gray-700' },
  none: { label: 'Sin evaluar', className: 'bg-gray-100 text-gray-600' },
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin dato'
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 font-medium text-gray-900 break-words">{children}</p>
    </div>
  )
}

function CandidateRow({
  candidate,
  selected,
  suggested,
  disabled,
  onSelect,
  readOnly,
}: {
  candidate: Candidate
  selected: boolean
  suggested: boolean
  disabled: boolean
  onSelect: () => void
  readOnly: boolean
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        disabled ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-70' : readOnly ? 'border-gray-200' : 'cursor-pointer border-gray-200 hover:bg-gray-50'
      } ${selected ? 'border-gray-900 ring-1 ring-gray-900' : ''}`}
    >
      {!readOnly && (
        <input
          type="radio"
          name="reps-sede"
          className="mt-1"
          checked={selected}
          disabled={disabled}
          onChange={onSelect}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900">{candidate.nombre_sede}</span>
          {suggested && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">Sugerida</span>}
          {candidate.principal && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Sede principal</span>}
          {candidate.same_municipality && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">Mismo municipio</span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          <span className="font-mono">{candidate.codigo_habilitacion}</span>
          {' · '}
          {candidate.municipio_sede_nombre ?? candidate.municipio_sede}
          {candidate.direccion_sede ? ` · ${candidate.direccion_sede}` : ''}
          {typeof candidate.score === 'number' && candidate.score > 0 ? ` · parecido ${Math.round(candidate.score * 100)}%` : ''}
        </p>
        {candidate.linked_hospital && (
          <p className="mt-1 text-xs text-gray-500">
            Ya vinculada a{' '}
            <a href={`/hospitals/${candidate.linked_hospital.id}`} className="underline hover:text-gray-900">
              {candidate.linked_hospital.name}
            </a>
          </p>
        )}
      </div>
    </label>
  )
}

export default function RepsSedeSection({ hospitalId, onChange }: { hospitalId: string; onChange?: () => void }) {
  const { can } = usePermissions()
  const canEdit = can('hospitals:edit')

  const [data, setData] = useState<RepsLinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; warnings?: string[] } | null>(null)

  const [query, setQuery] = useState('')
  const [onlyMunicipality, setOnlyMunicipality] = useState(true)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`/api/hospitals/${hospitalId}/reps-link`)
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo cargar la sede del REPS')
      setData(body as RepsLinkData)
      const suggestion = (body as RepsLinkData).evaluation?.suggested_code ?? null
      setSelected(suggestion)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la sede del REPS')
    } finally {
      setLoading(false)
    }
  }, [hospitalId])

  useEffect(() => {
    load()
  }, [load])

  const runSearch = async () => {
    const text = query.trim()
    if (!text) return
    setSearching(true)
    setSearchError(null)
    try {
      const params = new URLSearchParams({ q: text, limit: '25' })
      if (onlyMunicipality && data?.hospital.municipality_id) params.set('municipio', data.hospital.municipality_id)
      const response = await fetch(`/api/hospitals/reps/sedes?${params.toString()}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo buscar en el REPS')
      const sedes = (body?.sedes ?? []) as Array<RepsSede & { principal: boolean; linked_hospital: Candidate['linked_hospital'] }>
      setResults(
        sedes.map(sede => ({
          codigo_habilitacion: sede.codigo_habilitacion,
          nombre_sede: sede.nombre_sede,
          municipio_sede: sede.municipio_sede,
          municipio_sede_nombre: sede.municipio_sede_nombre,
          direccion_sede: sede.direccion_sede,
          same_municipality: sede.municipio_sede === data?.hospital.municipality_id,
          principal: sede.principal,
          linked_hospital: sede.linked_hospital && sede.linked_hospital.id !== hospitalId ? sede.linked_hospital : null,
        }))
      )
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'No se pudo buscar en el REPS')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const save = async (repsCode: string | null) => {
    if (repsCode === null && !window.confirm('¿Desvincular esta IPS de su sede del REPS?')) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/hospitals/${hospitalId}/reps-link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reps_code: repsCode }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = Array.isArray(body?.issues) ? `: ${body.issues.map((issue: { message: string }) => issue.message).join('; ')}` : ''
        throw new Error(`${body?.error || 'No se pudo guardar'}${detail}`)
      }
      setMessage({
        kind: 'ok',
        text: repsCode ? `IPS vinculada a la sede ${repsCode}` : 'IPS desvinculada de la sede del REPS',
        warnings: Array.isArray(body?.warnings) ? body.warnings : [],
      })
      setChanging(false)
      setResults(null)
      setQuery('')
      await load()
      onChange?.()
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar' })
    } finally {
      setSaving(false)
    }
  }

  const status = data?.hospital.reps_match_status ?? 'none'
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.none
  const linked = data?.sede ?? null
  const showPicker = Boolean(data) && (!data?.hospital.reps_code || changing)
  const suggested = data?.evaluation?.suggested_code ?? null
  const freeCandidates = (data?.candidates ?? []).filter(candidate => candidate.codigo_habilitacion !== data?.hospital.reps_code)

  return (
    <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">Sede REPS</h2>
          {data && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>}
        </div>
        {data?.cut && (
          <p className="text-xs text-gray-500">
            REPS cargado: {data.cut.total.toLocaleString('es-CO')} sedes, corte {formatDate(data.cut.fecha_corte)}
          </p>
        )}
      </div>

      {loading && !data && <p className="text-gray-500">Cargando...</p>}
      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.kind === 'ok' ? 'border-gray-200 bg-gray-50 text-gray-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <p className="font-medium">{message.text}</p>
          {message.warnings && message.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-amber-800">
              {message.warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {data && linked && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código de habilitación">
              <span className="font-mono">{linked.codigo_habilitacion}</span>
            </Field>
            <Field label="Nombre de la sede">{linked.nombre_sede}</Field>
            <Field label="Prestador">
              {linked.nombre_prestador} <span className="text-sm font-normal text-gray-500">(NIT {linked.nit})</span>
            </Field>
            <Field label="Dirección">
              {[linked.direccion_sede, linked.municipio_sede_nombre, linked.departamento_sede].filter(Boolean).join(', ') || 'Sin dato'}
            </Field>
            <Field label="Naturaleza">
              {linked.naturaleza ?? 'Sin dato'}
              {linked.ese ? ' · Empresa Social del Estado' : ''}
            </Field>
            <Field label="Fecha de corte">{formatDate(linked.fecha_corte)}</Field>
          </div>
          <p className="text-xs text-gray-500">
            {linked.clase_prestador}
            {data.hospital.reps_matched_at ? ` · vinculada el ${formatDate(data.hospital.reps_matched_at)}` : ''}
            {data.hospital.municipality_id && linked.municipio_sede !== data.hospital.municipality_id
              ? ' · la sede está en otro municipio que la IPS: revisar el municipio de la IPS'
              : ''}
          </p>
          {canEdit && !changing && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setChanging(true)
                  setSelected(null)
                }}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black"
              >
                Cambiar sede
              </button>
              <button
                onClick={() => save(null)}
                disabled={saving}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-300 disabled:opacity-50"
              >
                Desvincular
              </button>
            </div>
          )}
        </div>
      )}

      {data && data.orphan && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          La sede vinculada ({data.hospital.reps_code}) ya no está en el REPS cargado. Elige otra sede o desvincúlala.
        </p>
      )}

      {data && showPicker && (
        <div className={linked ? 'mt-6 border-t border-gray-100 pt-6' : ''}>
          {data.evaluation && !data.hospital.reps_code && (
            <p className="mb-3 text-sm text-gray-700">{data.evaluation.reason}</p>
          )}

          {freeCandidates.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Sedes del REPS con el NIT {data.hospital.nit ?? ''} ({freeCandidates.length})
              </h3>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {freeCandidates.map(candidate => (
                  <CandidateRow
                    key={candidate.codigo_habilitacion}
                    candidate={candidate}
                    selected={selected === candidate.codigo_habilitacion}
                    suggested={suggested === candidate.codigo_habilitacion}
                    disabled={Boolean(candidate.linked_hospital) || !canEdit}
                    readOnly={!canEdit}
                    onSelect={() => setSelected(candidate.codigo_habilitacion)}
                  />
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="mb-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Buscar otra sede en el REPS</h3>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={event => {
                  event.preventDefault()
                  runSearch()
                }}
              >
                <input
                  type="text"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Nombre de la sede, NIT o código de habilitación"
                  className="flex-1 rounded-lg border border-gray-300 p-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-700"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={onlyMunicipality}
                    onChange={event => setOnlyMunicipality(event.target.checked)}
                  />
                  Solo en el municipio de la IPS
                </label>
                <button
                  type="submit"
                  disabled={searching || query.trim().length === 0}
                  className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 transition-all hover:bg-gray-300 disabled:opacity-50"
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </form>
              {searchError && <p className="mt-2 text-sm text-red-700">{searchError}</p>}
              {results && results.length === 0 && <p className="mt-2 text-sm text-gray-500">Sin resultados.</p>}
              {results && results.length > 0 && (
                <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {results.map(candidate => (
                    <CandidateRow
                      key={`search-${candidate.codigo_habilitacion}`}
                      candidate={candidate}
                      selected={selected === candidate.codigo_habilitacion}
                      suggested={false}
                      disabled={Boolean(candidate.linked_hospital)}
                      readOnly={false}
                      onSelect={() => setSelected(candidate.codigo_habilitacion)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => selected && save(selected)}
                disabled={!selected || saving}
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Vinculando...' : 'Vincular'}
              </button>
              {changing && (
                <button
                  onClick={() => {
                    setChanging(false)
                    setResults(null)
                    setSelected(suggested)
                  }}
                  className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-300"
                >
                  Cancelar
                </button>
              )}
              {selected && <span className="font-mono text-sm text-gray-600">{selected}</span>}
            </div>
          ) : (
            !linked && <p className="text-sm text-gray-500">Solo quien puede editar IPS puede vincular la sede.</p>
          )}
        </div>
      )}
    </div>
  )
}
