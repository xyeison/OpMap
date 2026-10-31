'use client'

// Fase 3 · Importar servicios habilitados y capacidad instalada del REPS (admin y data_manager).
// 1) Subir el archivo (Excel, CSV/TXT o PDF con texto) → POST /api/hospitals/import/preview (simulación).
// 2) Revisar el mapeo de columnas (editable) y la simulación por IPS.
// 3) "Aplicar" → POST /api/hospitals/import/apply con el token. Nunca recalcula asignaciones.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import ProtectedRoute from '@/components/ProtectedRoute'
import { usePermissions } from '@/hooks/usePermissions'
import {
  REPS_FIELDS,
  REPS_MAX_FILE_BYTES,
  SERVICE_FLAG_KEYS,
  SERVICE_FLAG_LABELS,
  type RepsApplyResponse,
  type RepsColumnMapping,
  type RepsFieldKey,
  type RepsImportKind,
  type RepsImportMode,
  type RepsPreviewResponse,
  type RepsSimulationItem,
  type ServiceFlags,
} from '@/lib/reps-import-fields'

type KindChoice = RepsImportKind | 'auto'
type ItemFilter = 'all' | 'changes' | 'unmatched'

const PAGE_SIZE = 100

const METHOD_LABELS: Record<string, string> = {
  reps_code: 'Código de habilitación vinculado',
  importacion_previa: 'Vínculo de una importación anterior',
  nit: 'NIT (única sede)',
  nit_municipio: 'NIT + municipio',
}

function flagDiff(before: ServiceFlags | null, after: ServiceFlags | null): string[] {
  if (!after) return []
  const prev = before || {}
  const out: string[] = []
  SERVICE_FLAG_KEYS.forEach(key => {
    if (!prev[key] && after[key]) out.push(`+ ${SERVICE_FLAG_LABELS[key]}`)
    if (prev[key] && !after[key]) out.push(`− ${SERVICE_FLAG_LABELS[key]}`)
  })
  return out
}

function numberChange(label: string, before: number | null, after: number | null): string | null {
  if (before === after) return null
  return `${label}: ${before ?? '—'} → ${after ?? '—'}`
}

export default function RepsImportPage() {
  const { can, loading: roleLoading } = usePermissions()
  // El REPS es de administración: admin y data_manager (lib/permissions.ts)
  const canImport = can('reps:manage')
  const queryClient = useQueryClient()

  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<KindChoice>('auto')
  const [mode, setMode] = useState<RepsImportMode>('replace')
  const [mapping, setMapping] = useState<RepsColumnMapping | null>(null)
  const [preview, setPreview] = useState<RepsPreviewResponse | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RepsApplyResponse | null>(null)
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [showHelp, setShowHelp] = useState(false)
  const [showInvalid, setShowInvalid] = useState(false)

  const analyze = async (withManualMapping: boolean) => {
    if (!file) {
      setError('Elige un archivo')
      return
    }
    if (file.size > REPS_MAX_FILE_BYTES) {
      setError('El archivo supera 4 MB: divide la consulta del REPS (por departamento o municipio) o expórtala a Excel')
      return
    }
    setAnalyzing(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      form.append('mode', mode)
      if (withManualMapping && mapping) form.append('mapping', JSON.stringify(mapping))
      const response = await fetch('/api/hospitals/import/preview', { method: 'POST', body: form })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo analizar el archivo')
      const data = body as RepsPreviewResponse
      setPreview(data)
      setMapping(data.mapping)
      if (kind === 'auto' && !data.needsMapping) setKind(data.kind)
      setFilter('all')
      setVisible(PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar el archivo')
    } finally {
      setAnalyzing(false)
    }
  }

  const apply = async () => {
    if (!preview?.token) return
    const s = preview.stats
    const text =
      `Se van a actualizar ${s.matched} IPS con cruce (${s.hospitalsWithChanges} con cambios).\n` +
      (preview.kind === 'servicios'
        ? `Servicios a guardar: ${s.servicesToUpsert}; a retirar: ${s.servicesToDelete}.\n`
        : `Filas de capacidad a guardar: ${s.capacityToUpsert}; a retirar: ${s.capacityToDelete}.\n`) +
      `Las ${s.ambiguous + s.unmatched} sedes sin cruce no se guardan.\n\nNo se recalcula ninguna asignación. ¿Aplicar?`
    if (!window.confirm(text)) return
    setApplying(true)
    setError(null)
    try {
      const response = await fetch('/api/hospitals/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: preview.token }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || 'No se pudo aplicar la importación')
      setResult(body as RepsApplyResponse)
      setPreview(null)
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aplicar la importación')
    } finally {
      setApplying(false)
    }
  }

  const items = useMemo(() => {
    const all = preview?.items || []
    if (filter === 'changes') return all.filter(i => i.status === 'matched' && i.hasChanges)
    if (filter === 'unmatched') return all.filter(i => i.status !== 'matched')
    return all
  }, [preview, filter])

  const effectiveKind: RepsImportKind = preview?.kind ?? (kind === 'auto' ? 'servicios' : kind)
  const fieldsForKind = REPS_FIELDS.filter(f => f.kinds.includes(effectiveKind))

  if (roleLoading) {
    return <div className="p-6 text-gray-600">Cargando…</div>
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-8">
          <Link href="/hospitals" className="mb-4 inline-flex items-center gap-2 font-medium text-gray-700 hover:text-gray-900">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a IPS
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Importar del REPS</h1>
          <p className="text-gray-600 mt-2">
            Servicios habilitados y capacidad instalada por sede (código de habilitación). Primero se simula; nada cambia hasta
            pulsar &quot;Aplicar&quot;. Importar no recalcula la asignación de IPS.
          </p>
        </div>

        {!canImport ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            Solo administradores y gestores de datos pueden importar del REPS.
          </div>
        ) : (
          <>
            {/* Cómo exportar */}
            <div className="mb-6 bg-white rounded-2xl shadow border border-gray-100 p-4">
              <button type="button" onClick={() => setShowHelp(!showHelp)} className="text-sm font-semibold text-gray-900" aria-expanded={showHelp}>
                {showHelp ? '▾' : '▸'} Cómo exportar del REPS
              </button>
              {showHelp && (
                <ol className="mt-3 list-decimal pl-5 space-y-1 text-sm text-gray-700">
                  <li>Entra al portal del REPS del Ministerio de Salud con el perfil invitado.</li>
                  <li>
                    Consulta <strong>Servicios</strong> (o <strong>Capacidades instaladas</strong>) filtrando por departamento, municipio o
                    NIT, y exporta a Excel (o texto separado por ;). Sin filtrar por grupo ni por servicio, salvo que luego uses &quot;Solo añadir&quot;.
                  </li>
                  <li>Sube aquí el archivo (máximo 4 MB; si pesa más, divide la consulta por departamento o municipio).</li>
                  <li>
                    También sirve un PDF <strong>con texto</strong> (que se pueda seleccionar). Un PDF escaneado no tiene texto y requiere OCR.
                  </li>
                  <li>
                    Las sedes se cruzan por código de habilitación (el vínculo de la ficha de la IPS) o, si no hay, por NIT cuando el NIT
                    tiene una sola sede o una sola en el municipio de la IPS. Las ambiguas se vinculan en la ficha y se vuelve a importar.
                  </li>
                </ol>
              )}
            </div>

            {/* Archivo */}
            <div className="mb-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reps-file">Archivo del REPS</label>
                  <input
                    id="reps-file"
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
                    onChange={e => {
                      setFile(e.target.files?.[0] || null)
                      setPreview(null)
                      setMapping(null)
                      setResult(null)
                      setError(null)
                    }}
                    className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Excel (.xlsx o .xls), CSV o TXT separado por punto y coma o coma, o PDF con texto (sin escanear). Máximo 4 MB.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reps-kind">Tipo</label>
                  <select
                    id="reps-kind"
                    value={kind}
                    onChange={e => {
                      setKind(e.target.value as KindChoice)
                      setMapping(null)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                  >
                    <option value="auto">Detectar automáticamente</option>
                    <option value="servicios">Servicios habilitados</option>
                    <option value="capacidad">Capacidad instalada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reps-mode">Al aplicar</label>
                  <select
                    id="reps-mode"
                    value={mode}
                    onChange={e => setMode(e.target.value as RepsImportMode)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                  >
                    <option value="replace">Reemplazar lo de las sedes del archivo</option>
                    <option value="merge">Solo añadir y actualizar (no retirar)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => analyze(false)}
                    disabled={!file || analyzing}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {analyzing ? 'Analizando…' : 'Analizar (simulación)'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                &quot;Reemplazar&quot; retira de cada sede del archivo los servicios (o capacidades) guardados que ya no aparecen, solo en los
                grupos que trae el archivo. Si filtraste la consulta por servicio, usa &quot;Solo añadir&quot;.
              </p>
            </div>

            {error && <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}

            {result && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 space-y-1">
                <p className="font-semibold">{result.message}</p>
                <p>
                  {result.kind === 'servicios'
                    ? `Servicios guardados: ${result.counts.services_upserted}; retirados: ${result.counts.services_deleted}.`
                    : `Capacidades guardadas: ${result.counts.capacity_upserted}; retiradas: ${result.counts.capacity_deleted}.`}{' '}
                  Historial: {result.counts.history_rows} IPS.
                </p>
                {result.changedSincePreview && (
                  <p>La base cambió entre la simulación y la aplicación: se aplicó lo calculado en ese momento.</p>
                )}
                <Link href="/hospitals" className="inline-block mt-2 underline">Ir a la lista de IPS</Link>
              </div>
            )}

            {preview && (
              <>
                {preview.warnings.length > 0 && (
                  <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-1">
                    {preview.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                )}

                {/* Resumen */}
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {[
                    ['Filas leídas', preview.stats.rowsRead],
                    ['Válidas', preview.stats.validRows],
                    ['Inválidas', preview.stats.invalidRows],
                    ['Sedes', preview.stats.sedes],
                    ['Con cruce', preview.stats.matched],
                    ['Ambiguas', preview.stats.ambiguous],
                    ['Sin cruce', preview.stats.unmatched],
                    ['IPS con cambios', preview.stats.hospitalsWithChanges],
                  ].map(([label, value]) => (
                    <div key={label as string} className="bg-white rounded-xl border border-gray-100 shadow p-3">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-xl font-semibold text-gray-900">{value as number}</div>
                    </div>
                  ))}
                </div>

                {/* Mapeo de columnas */}
                <div className="mb-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h2 className="text-lg font-bold text-gray-900">Columnas del archivo</h2>
                    <span className="text-xs text-gray-500">
                      {preview.fileKind.toUpperCase()} · {preview.table.totalRows} filas
                      {preview.table.sheetName ? ` · hoja "${preview.table.sheetName}"` : ''}
                      {preview.table.headerRow > 0 ? ` · encabezados en la fila ${preview.table.headerRow}` : ''}
                      {preview.detectedKind ? ` · detectado: ${preview.detectedKind}` : ''}
                    </span>
                  </div>
                  {preview.needsMapping && (
                    <p className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                      Faltan columnas obligatorias: {preview.missingFields.join('; ')}. Elígelas abajo y vuelve a analizar.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    {fieldsForKind.map(field => {
                      const value = mapping?.[field.key]
                      const sample = typeof value === 'number' ? preview.table.sampleRows.map(r => r[value]).filter(Boolean).slice(0, 2).join(' · ') : ''
                      return (
                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <label className="text-sm text-gray-700 sm:w-56 shrink-0" htmlFor={`map-${field.key}`} title={field.hint}>
                            {field.label}
                          </label>
                          <div className="flex-1 min-w-0">
                            <select
                              id={`map-${field.key}`}
                              value={typeof value === 'number' ? String(value) : ''}
                              onChange={e => {
                                const next = e.target.value === '' ? null : Number(e.target.value)
                                setMapping(prev => ({ ...(prev || {}), [field.key as RepsFieldKey]: next }))
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-sm"
                            >
                              <option value="">— No usar —</option>
                              {preview.table.headers.map((header, index) => (
                                <option key={index} value={index}>
                                  {index + 1}. {header}
                                </option>
                              ))}
                            </select>
                            {sample && <div className="text-xs text-gray-500 truncate mt-0.5">Ej.: {sample}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {preview.flagColumns.length > 0 && (
                    <p className="text-xs text-gray-500 mt-3">
                      Columnas SI/NO detectadas: {preview.flagColumns.map(f => `${f.header} (${f.meaning})`).join('; ')}.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => analyze(true)}
                    disabled={analyzing || !file}
                    className="mt-4 px-4 py-2 border border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm font-medium"
                  >
                    {analyzing ? 'Analizando…' : 'Volver a analizar con este mapeo'}
                  </button>
                </div>

                {preview.invalidSamples.length > 0 && (
                  <div className="mb-6 bg-white rounded-2xl shadow border border-gray-100 p-4">
                    <button type="button" onClick={() => setShowInvalid(!showInvalid)} className="text-sm font-semibold text-gray-900" aria-expanded={showInvalid}>
                      {showInvalid ? '▾' : '▸'} Filas inválidas ({preview.stats.invalidRows})
                    </button>
                    {showInvalid && (
                      <ul className="mt-2 text-sm text-gray-700 space-y-0.5 max-h-60 overflow-y-auto">
                        {preview.invalidSamples.map((r, i) => (
                          <li key={i}>Fila {r.row}: {r.reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Simulación */}
                {!preview.needsMapping && (
                  <div className="mb-24 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h2 className="text-lg font-bold text-gray-900">Simulación por sede</h2>
                      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Filtrar simulación">
                        {([
                          ['all', `Todas (${preview.items.length})`],
                          ['changes', `Con cambios (${preview.stats.hospitalsWithChanges})`],
                          ['unmatched', `Sin cruce (${preview.stats.ambiguous + preview.stats.unmatched})`],
                        ] as [ItemFilter, string][]).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={filter === id}
                            onClick={() => {
                              setFilter(id)
                              setVisible(PAGE_SIZE)
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm ${filter === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {preview.itemsTruncated && (
                      <p className="mb-3 text-xs text-gray-500">Se muestran las primeras {preview.items.length} sedes (con cambios primero).</p>
                    )}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
                          <tr>
                            <th className="px-3 py-2">Sede REPS</th>
                            <th className="px-3 py-2">IPS en OpMap</th>
                            <th className="px-3 py-2">Qué cambia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.slice(0, visible).map(item => (
                            <SimulationRow key={item.key} item={item} kind={preview.kind} />
                          ))}
                          {items.length === 0 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-6 text-center text-gray-500">No hay sedes en este filtro.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {items.length > visible && (
                      <button type="button" onClick={() => setVisible(visible + PAGE_SIZE)} className="mt-3 text-sm underline text-gray-900">
                        Mostrar más ({items.length - visible} restantes)
                      </button>
                    )}
                  </div>
                )}

                {/* Barra de aplicar */}
                {!preview.needsMapping && (
                  <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-lg">
                    <div className="container mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-3">
                      <p className="text-xs sm:text-sm text-gray-700">
                        {preview.stats.matched} IPS con cruce · {preview.stats.hospitalsWithChanges} con cambios
                        <span className="hidden sm:inline"> · la simulación caduca a los 30 min</span>
                      </p>
                      <button
                        type="button"
                        onClick={apply}
                        disabled={applying || !preview.token || preview.stats.matched === 0}
                        className="shrink-0 px-5 py-2 min-h-[44px] bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {applying ? 'Aplicando…' : 'Aplicar'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}

function SimulationRow({ item, kind }: { item: RepsSimulationItem; kind: RepsImportKind }) {
  const changes: string[] = []
  if (item.status === 'matched') {
    if (kind === 'servicios') {
      changes.push(...flagDiff(item.flagsBefore, item.flagsAfter))
      if (item.addedCount > 0) changes.push(`${item.addedCount} servicio(s) nuevo(s)${item.added.length ? `: ${item.added.slice(0, 5).join(', ')}${item.addedCount > 5 ? '…' : ''}` : ''}`)
      if (item.removedCount > 0) changes.push(`${item.removedCount} retirado(s)${item.removed.length ? `: ${item.removed.slice(0, 5).join(', ')}${item.removedCount > 5 ? '…' : ''}` : ''}`)
      const count = numberChange('Servicios', item.servicesBefore, item.servicesAfter)
      if (count) changes.push(count)
    } else {
      const q = numberChange('Quirófanos', item.quirofanosBefore, item.quirofanosAfter)
      const b = numberChange('Camas REPS', item.bedsBefore, item.bedsAfter)
      if (q) changes.push(q)
      if (b) changes.push(b)
      changes.push(...item.changed.slice(0, 5))
      if (item.addedCount > 0) changes.push(`${item.addedCount} nueva(s): ${item.added.slice(0, 3).join(', ')}${item.addedCount > 3 ? '…' : ''}`)
      if (item.removedCount > 0) changes.push(`${item.removedCount} retirada(s): ${item.removed.slice(0, 3).join(', ')}${item.removedCount > 3 ? '…' : ''}`)
    }
  }
  return (
    <tr className={item.status === 'matched' ? '' : 'bg-gray-50'}>
      <td className="px-3 py-2 align-top">
        <div className="font-mono text-xs text-gray-600">{item.key}</div>
        <div className="text-gray-900">{item.sedeName || item.prestadorName || '—'}</div>
        <div className="text-xs text-gray-500">
          {[item.municipality, item.nit ? `NIT ${item.nit}` : null, `${item.rowsInFile} fila(s)`].filter(Boolean).join(' · ')}
        </div>
      </td>
      <td className="px-3 py-2 align-top">
        {item.hospital ? (
          <>
            <Link href={`/hospitals/${item.hospital.id}`} className="text-gray-900 underline underline-offset-2">{item.hospital.name}</Link>
            <div className="text-xs text-gray-500">
              {item.hospital.code}
              {item.method ? ` · ${METHOD_LABELS[item.method] || item.method}` : ''}
              {!item.hospital.active ? ' · inactiva' : ''}
            </div>
            {item.reason && <div className="text-xs text-amber-700">{item.reason}</div>}
          </>
        ) : (
          <>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.status === 'ambiguous' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
              {item.status === 'ambiguous' ? 'Ambigua' : 'Sin cruce'}
            </span>
            {item.reason && <div className="text-xs text-gray-600 mt-1">{item.reason}</div>}
          </>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {item.status !== 'matched' ? (
          <span className="text-xs text-gray-500">No se guarda</span>
        ) : changes.length === 0 ? (
          <span className="text-xs text-gray-500">Sin cambios</span>
        ) : (
          <ul className="space-y-0.5 text-xs text-gray-800">
            {changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  )
}
