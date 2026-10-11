'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { zoneDisplayName } from '@/lib/zone-names'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import type { BusinessLine, LineZone } from '@/lib/types/lines'
import CoveragePanel from './CoveragePanel'
import { parseMyLines, type MyLine } from './coverage-shared'

// Zona = fila de kams (ciudad base = area_id). Solo se usan los campos que necesita esta página.
interface ZoneOption {
  id: string
  name: string
  area_id: string
  color: string | null
  active: boolean
  base_city?: string | null
}

// Matriz en edición: lineId → (kamId → tiene equipo)
type EquipmentDraft = Record<string, Record<string, boolean>>

/** Nombre visible de la zona: los registros heredados se llaman "KAM Ciudad"; en la UI basta "Ciudad". */
function zoneLabel(name: string): string {
  return zoneDisplayName(name) || name
}

/** Extrae el mensaje de error de una respuesta JSON de la API (o uno genérico). */
async function readError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null)
  if (data && typeof data.error === 'string' && data.error) return data.error
  return `${fallback} (${response.status})`
}

function buildDraft(lines: BusinessLine[]): EquipmentDraft {
  const draft: EquipmentDraft = {}
  for (const line of lines) {
    const byZone: Record<string, boolean> = {}
    for (const zone of line.zones) byZone[zone.kam_id] = zone.has_equipment
    draft[line.id] = byZone
  }
  return draft
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export default function LinesPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="lines:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver las líneas de negocio.</p>
            </div>
          </div>
        }
      >
        <LinesContent />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function LinesContent() {
  const { can } = usePermissions()
  const canEdit = can('lines:edit')
  const hasCoverageEdit = can('coverage:edit')

  const [lines, setLines] = useState<BusinessLine[]>([])
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [draft, setDraft] = useState<EquipmentDraft>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [editingLine, setEditingLine] = useState<BusinessLine | null>(null)
  // Líneas del usuario (GET /api/me/lines). null = no se pudieron cargar (se muestra todo, la API valida)
  const [myLines, setMyLines] = useState<MyLine[] | null>(null)
  const [canSeeAll, setCanSeeAll] = useState(false)
  const [myLinesError, setMyLinesError] = useState('')
  const [zoneNameById, setZoneNameById] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setMyLinesError('')
      const [linesResponse, zonesResponse, myLinesResponse] = await Promise.all([
        fetch('/api/business-lines'),
        fetch('/api/kams'),
        fetch('/api/me/lines').catch(() => null),
      ])
      if (!linesResponse.ok) throw new Error(await readError(linesResponse, 'Error al cargar las líneas'))
      if (!zonesResponse.ok) throw new Error(await readError(zonesResponse, 'Error al cargar las zonas'))

      const linesData = await linesResponse.json().catch(() => null)
      const zonesData = await zonesResponse.json().catch(() => null)
      const loadedLines: BusinessLine[] = Array.isArray(linesData?.lines) ? linesData.lines : []
      const loadedZones: ZoneOption[] = Array.isArray(zonesData) ? zonesData : []

      // Las líneas del usuario no bloquean la página: si fallan, se avisa y la API sigue validando
      if (myLinesResponse && myLinesResponse.ok) {
        const parsed = parseMyLines(await myLinesResponse.json().catch(() => null))
        setMyLines(parsed.lines)
        setCanSeeAll(parsed.canSeeAll)
      } else {
        setMyLines(null)
        setCanSeeAll(false)
        setMyLinesError(
          myLinesResponse
            ? await readError(myLinesResponse, 'No se pudieron cargar tus líneas')
            : 'No se pudieron cargar tus líneas (error de conexión)'
        )
      }

      setZoneNameById(new Map(loadedZones.map(zone => [zone.id, zoneLabel(zone.name)])))
      setLines(loadedLines)
      setDraft(buildDraft(loadedLines))
      setZones(
        loadedZones
          .filter(zone => zone.active)
          .sort((a, b) => zoneLabel(a.name).localeCompare(zoneLabel(b.name), 'es'))
      )
    } catch (error: unknown) {
      console.error('Error cargando líneas de negocio:', error)
      setLoadError(error instanceof Error ? error.message : 'Error al cargar las líneas de negocio')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Rol del usuario en cada línea (leader | executive | all)
  const myRoleByLineId = useMemo(
    () => new Map((myLines ?? []).map(line => [line.id, line.role])),
    [myLines]
  )

  // Quien no ve todas las líneas (líder de línea, ejecutivo) solo ve las suyas
  const visibleLines = useMemo(() => {
    if (myLines === null || canSeeAll) return lines
    return lines.filter(line => myRoleByLineId.has(line.id))
  }, [lines, myLines, canSeeAll, myRoleByLineId])

  // Editar una línea: permiso lines:edit y, si no ve todas, ser su líder (la API vuelve a validarlo)
  const canEditLine = useCallback(
    (lineId: string): boolean => {
      if (!canEdit) return false
      if (myLines === null || canSeeAll) return true
      const role = myRoleByLineId.get(lineId)
      return role === 'leader' || role === 'all'
    },
    [canEdit, myLines, canSeeAll, myRoleByLineId]
  )
  const canEditAnyLine = visibleLines.some(line => canEditLine(line.id))

  // Líneas para la cobertura: las de /api/me/lines, en el orden de business_lines
  const coverageLines = useMemo<MyLine[]>(() => {
    if (myLines === null) return []
    const order = new Map(lines.map((line, index) => [line.id, index]))
    return [...myLines].sort(
      (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    )
  }, [myLines, lines])

  // Valor guardado de una celda (zonas sin fila en line_zones = sin equipo)
  const savedValue = useCallback(
    (line: BusinessLine, kamId: string): boolean =>
      line.zones.find(zone => zone.kam_id === kamId)?.has_equipment ?? false,
    []
  )

  const cellValue = (lineId: string, kamId: string): boolean => draft[lineId]?.[kamId] ?? false

  // Líneas con cambios sin guardar (solo cuentan las zonas activas que se muestran)
  const dirtyLineIds = useMemo(() => {
    return visibleLines
      .filter(line => zones.some(zone => (draft[line.id]?.[zone.id] ?? false) !== savedValue(line, zone.id)))
      .map(line => line.id)
  }, [visibleLines, zones, draft, savedValue])

  const toggleCell = (lineId: string, kamId: string) => {
    if (!canEditLine(lineId) || saving) return
    setSaveNotice('')
    setDraft(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [kamId]: !(prev[lineId]?.[kamId] ?? false) },
    }))
  }

  const setWholeLine = (lineId: string, value: boolean) => {
    if (!canEditLine(lineId) || saving) return
    setSaveNotice('')
    setDraft(prev => {
      const next = { ...prev[lineId] }
      for (const zone of zones) next[zone.id] = value
      return { ...prev, [lineId]: next }
    })
  }

  const discardChanges = () => {
    setDraft(buildDraft(lines))
    setSaveError('')
    setSaveNotice('')
  }

  // Guarda cada línea modificada con PUT /api/business-lines/[id]/zones (reemplaza su matriz).
  // Las filas de zonas inactivas que ya existían se reenvían sin cambios para no borrarlas.
  const saveChanges = async () => {
    if (!canEditAnyLine || dirtyLineIds.length === 0) return
    setSaving(true)
    setSaveError('')
    setSaveNotice('')

    const activeIds = new Set(zones.map(zone => zone.id))
    const failures: string[] = []
    const updated = new Map<string, LineZone[]>()

    for (const lineId of dirtyLineIds) {
      const line = lines.find(l => l.id === lineId)
      if (!line || !canEditLine(lineId)) continue
      const payload: LineZone[] = [
        ...line.zones.filter(zone => !activeIds.has(zone.kam_id)),
        ...zones.map(zone => ({ kam_id: zone.id, has_equipment: draft[lineId]?.[zone.id] ?? false })),
      ]
      try {
        const response = await fetch(`/api/business-lines/${lineId}/zones`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zones: payload }),
        })
        if (!response.ok) {
          failures.push(`${line.name}: ${await readError(response, 'no se pudo guardar')}`)
          continue
        }
        const data = await response.json().catch(() => null)
        if (!data || !Array.isArray(data.zones)) {
          failures.push(`${line.name}: respuesta inesperada del servidor`)
          continue
        }
        updated.set(lineId, data.zones as LineZone[])
      } catch (error) {
        console.error('Error guardando la matriz de la línea:', error)
        failures.push(`${line.name}: error de conexión`)
      }
    }

    // Solo las líneas confirmadas por el servidor pasan a "guardadas"; las fallidas conservan el borrador
    if (updated.size > 0) {
      setLines(prev => prev.map(line => (updated.has(line.id) ? { ...line, zones: updated.get(line.id)! } : line)))
      setDraft(prev => {
        const next = { ...prev }
        updated.forEach((lineZones, lineId) => {
          const byZone: Record<string, boolean> = {}
          for (const zone of lineZones) byZone[zone.kam_id] = zone.has_equipment
          next[lineId] = byZone
        })
        return next
      })
    }

    if (failures.length > 0) {
      setSaveError(`No se pudieron guardar algunas líneas: ${failures.join(' · ')}`)
    } else if (updated.size > 0) {
      setSaveNotice(updated.size === 1 ? 'Cambios guardados en 1 línea.' : `Cambios guardados en ${updated.size} líneas.`)
    }
    setSaving(false)
  }

  const handleLineSaved = (line: BusinessLine) => {
    setLines(prev => prev.map(l => (l.id === line.id ? line : l)))
    setEditingLine(null)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando líneas de negocio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-white">Líneas de negocio</h1>
        <p className="text-gray-300 mt-2">
          Cobertura por zona, líderes, alcance máximo y zonas donde cada línea tiene equipos
        </p>
      </div>

      {loadError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={load} className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100">
            Reintentar
          </button>
        </div>
      )}

      {!loadError && (
        <>
          {myLinesError && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
              {myLinesError}. La cobertura por línea no se puede mostrar por ahora.
            </div>
          )}
          {myLines !== null && (
            <CoveragePanel myLines={coverageLines} hasCoverageEdit={hasCoverageEdit} zoneNameById={zoneNameById} />
          )}

          {/* Tabla de líneas */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto mb-8">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Línea</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Líder</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Alcance máximo</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Zonas con equipo</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  {canEditAnyLine && (
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleLines.map(line => {
                  const withEquipment = zones.filter(zone => savedValue(line, zone.id)).length
                  return (
                    <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-900">{line.name}</div>
                        <div className="text-xs text-gray-500">{line.code}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {line.leader_name || <span className="text-gray-400">Sin líder asignado</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {line.max_reach_minutes} min
                        <span className="text-xs text-gray-500 ml-1">({formatMinutes(line.max_reach_minutes)})</span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {withEquipment} / {zones.length}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                            line.active
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {line.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      {canEditAnyLine && (
                        <td className="px-6 py-4 text-center">
                          {canEditLine(line.id) && (
                          <button
                            onClick={() => setEditingLine(line)}
                            className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium"
                          >
                            Editar
                          </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {visibleLines.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-500">
                {lines.length === 0 ? 'No hay líneas de negocio configuradas.' : 'No tienes líneas asignadas.'}
              </div>
            )}
          </div>

          {/* Matriz línea × zona */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Equipos por zona</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Marca las zonas donde la línea tiene equipos. Donde no los tenga, la línea aparecerá como
                  &ldquo;sin equipo&rdquo; aunque alguien cubra la zona.
                </p>
              </div>
              {canEditAnyLine && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={discardChanges}
                    disabled={saving || dirtyLineIds.length === 0}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving || dirtyLineIds.length === 0}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>

            {canEditAnyLine && dirtyLineIds.length > 0 && !saving && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
                Cambios sin guardar en:{' '}
                {lines.filter(line => dirtyLineIds.includes(line.id)).map(line => line.name).join(', ')}
              </div>
            )}
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{saveError}</div>
            )}
            {saveNotice && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{saveNotice}</div>
            )}
            {!canEditAnyLine && (
              <p className="mb-4 text-xs text-gray-500">Vista de solo lectura: no tienes permiso para editar líneas.</p>
            )}

            {zones.length === 0 || visibleLines.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500">
                {zones.length === 0 ? 'No hay zonas activas.' : 'No hay líneas de negocio configuradas.'}
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Zona
                      </th>
                      {visibleLines.map(line => (
                        <th key={line.id} className="px-3 py-3 text-center align-top min-w-[8rem]">
                          <div className={`text-xs font-bold uppercase tracking-wider ${line.active ? 'text-gray-700' : 'text-gray-400'}`}>
                            {line.name}
                          </div>
                          {!line.active && <div className="text-[10px] text-gray-400">Inactiva</div>}
                          {canEditLine(line.id) && (
                            <div className="mt-1 flex justify-center gap-2 text-[11px] font-medium">
                              <button
                                type="button"
                                onClick={() => setWholeLine(line.id, true)}
                                disabled={saving}
                                className="text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
                              >
                                Todas
                              </button>
                              <button
                                type="button"
                                onClick={() => setWholeLine(line.id, false)}
                                disabled={saving}
                                className="text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
                              >
                                Ninguna
                              </button>
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {zones.map(zone => (
                      <tr key={zone.id} className="hover:bg-gray-50">
                        <td className="sticky left-0 bg-white px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                              style={{ backgroundColor: zone.color || '#9CA3AF' }}
                            />
                            <span className="font-medium text-gray-900">{zoneLabel(zone.name)}</span>
                          </div>
                        </td>
                        {visibleLines.map(line => {
                          const checked = cellValue(line.id, zone.id)
                          const changed = checked !== savedValue(line, zone.id)
                          return (
                            <td key={line.id} className={`px-3 py-2.5 text-center ${changed ? 'bg-amber-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCell(line.id, zone.id)}
                                disabled={!canEditLine(line.id) || saving}
                                aria-label={`${line.name} en ${zoneLabel(zone.name)}: tiene equipo`}
                                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700 disabled:cursor-not-allowed"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editingLine && (
        <LineEditModal line={editingLine} onClose={() => setEditingLine(null)} onSaved={handleLineSaved} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal de edición de una línea (PATCH /api/business-lines/[id])
// ---------------------------------------------------------------------------

interface LineEditModalProps {
  line: BusinessLine
  onClose: () => void
  onSaved: (line: BusinessLine) => void
}

function LineEditModal({ line, onClose, onSaved }: LineEditModalProps) {
  const [name, setName] = useState(line.name)
  const [maxReach, setMaxReach] = useState(String(line.max_reach_minutes))
  const [active, setActive] = useState(line.active)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const minutes = Number(maxReach)
    if (!trimmedName) {
      setError('El nombre es requerido')
      return
    }
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 720) {
      setError('El alcance máximo debe ser un número entero entre 30 y 720 minutos')
      return
    }

    // Solo se envían los campos que cambiaron
    const body: { name?: string; max_reach_minutes?: number; active?: boolean } = {}
    if (trimmedName !== line.name) body.name = trimmedName
    if (minutes !== line.max_reach_minutes) body.max_reach_minutes = minutes
    if (active !== line.active) body.active = active
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/business-lines/${line.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await readError(response, 'Error al guardar la línea'))
      const data = await response.json().catch(() => null)
      if (!data || !data.line || typeof data.line.id !== 'string') {
        throw new Error('Respuesta inesperada del servidor')
      }
      // Se conserva la matriz cargada si el servidor no la devuelve
      const saved = data.line as BusinessLine
      onSaved({ ...line, ...saved, zones: Array.isArray(saved.zones) ? saved.zones : line.zones })
    } catch (err: unknown) {
      console.error('Error guardando la línea:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar la línea')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Editar línea</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alcance máximo (minutos)</label>
            <input
              type="number"
              min={30}
              max={720}
              step={1}
              value={maxReach}
              onChange={e => setMaxReach(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tiempo máximo en carro, de ciudad base a ciudad base, para cubrir una zona por alcance.
            </p>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Líder</span>
            <p className="text-sm text-gray-900">{line.leader_name || 'Sin líder asignado'}</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
            />
            <span className="text-sm text-gray-700">Línea activa</span>
          </label>

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
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
