'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import type { BusinessLine, Executive, ExecutiveStatus } from '@/lib/types/lines'
import ExecutiveModal from './ExecutiveModal'
import { executiveColor, readError, STATUS_BADGE, STATUS_LABELS, zoneLabel, type ZoneOption } from './shared'

type StatusFilter = 'current' | ExecutiveStatus | 'all'

export default function ExecutivesPage() {
  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="executives:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para ver las ejecutivas.</p>
            </div>
          </div>
        }
      >
        <ExecutivesContent />
      </PermissionGuard>
    </ProtectedRoute>
  )
}

function ExecutivesContent() {
  const { can } = usePermissions()
  const canEdit = can('executives:edit')

  const [executives, setExecutives] = useState<Executive[]>([])
  const [lines, setLines] = useState<BusinessLine[]>([])
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [linesError, setLinesError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('current')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Executive | null>(null)
  const [deactivating, setDeactivating] = useState<Executive | null>(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    setLinesError('')
    try {
      const [executivesResponse, linesResponse, zonesResponse] = await Promise.all([
        fetch('/api/executives'),
        fetch('/api/business-lines'),
        fetch('/api/kams'),
      ])
      if (!executivesResponse.ok) {
        throw new Error(await readError(executivesResponse, 'Error al cargar las ejecutivas'))
      }
      if (!zonesResponse.ok) throw new Error(await readError(zonesResponse, 'Error al cargar las zonas'))

      const executivesData = await executivesResponse.json().catch(() => null)
      const zonesData = await zonesResponse.json().catch(() => null)
      setExecutives(Array.isArray(executivesData?.executives) ? executivesData.executives : [])
      setZones(Array.isArray(zonesData) ? zonesData : [])

      // Las líneas solo alimentan chips y casillas: si fallan, la tabla se muestra igual con un aviso
      if (linesResponse.ok) {
        const linesData = await linesResponse.json().catch(() => null)
        setLines(Array.isArray(linesData?.lines) ? linesData.lines : [])
      } else {
        setLines([])
        setLinesError(await readError(linesResponse, 'Error al cargar las líneas de negocio'))
      }
    } catch (error: unknown) {
      console.error('Error cargando ejecutivas:', error)
      setLoadError(error instanceof Error ? error.message : 'Error al cargar las ejecutivas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const lineById = useMemo(() => new Map(lines.map(line => [line.id, line])), [lines])
  const zoneById = useMemo(() => new Map(zones.map(zone => [zone.id, zone])), [zones])

  const baseZoneName = (executive: Executive): string => {
    const zone = executive.base_kam_id ? zoneById.get(executive.base_kam_id) : undefined
    if (zone) return zoneLabel(zone.name)
    if (executive.base_kam_name) return zoneLabel(executive.base_kam_name)
    return 'Sin zona base'
  }

  const counts = useMemo(
    () => ({
      active: executives.filter(e => e.status === 'active').length,
      placeholder: executives.filter(e => e.status === 'placeholder').length,
      inactive: executives.filter(e => e.status === 'inactive').length,
    }),
    [executives]
  )

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return executives
      .filter(e => {
        if (statusFilter === 'all') return true
        if (statusFilter === 'current') return e.status !== 'inactive'
        return e.status === statusFilter
      })
      .filter(e => {
        if (!term) return true
        const zone = e.base_kam_id ? zoneById.get(e.base_kam_id) : undefined
        return (
          e.full_name.toLowerCase().includes(term) ||
          (e.email || '').toLowerCase().includes(term) ||
          e.company.toLowerCase().includes(term) ||
          (zone ? zoneLabel(zone.name).toLowerCase().includes(term) : false)
        )
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
  }, [executives, statusFilter, searchTerm, zoneById])

  const openCreate = () => {
    setEditing(null)
    setNotice('')
    setModalOpen(true)
  }

  const openEdit = (executive: Executive) => {
    setEditing(executive)
    setNotice('')
    setModalOpen(true)
  }

  const handleSaved = (saved: Executive) => {
    const wasEdit = editing !== null
    setExecutives(prev =>
      prev.some(e => e.id === saved.id) ? prev.map(e => (e.id === saved.id ? saved : e)) : [...prev, saved]
    )
    setModalOpen(false)
    setEditing(null)
    setNotice(wasEdit ? `Se guardaron los cambios de ${saved.full_name}.` : `Se creó ${saved.full_name}.`)
  }

  const handleDeactivated = (saved: Executive) => {
    setExecutives(prev => prev.map(e => (e.id === saved.id ? saved : e)))
    setDeactivating(null)
    setNotice(`${saved.full_name} quedó inactiva.`)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando ejecutivas...</p>
        </div>
      </div>
    )
  }

  const statCards: { key: ExecutiveStatus; label: string; value: number; color: string }[] = [
    { key: 'active', label: 'Activas', value: counts.active, color: 'from-green-600 to-green-700' },
    { key: 'placeholder', label: 'Por contratar', value: counts.placeholder, color: 'from-amber-500 to-amber-600' },
    { key: 'inactive', label: 'Inactivas', value: counts.inactive, color: 'from-gray-500 to-gray-600' },
  ]

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Ejecutivos Comerciales</h1>
            <p className="text-gray-300 mt-2">Equipo comercial: zona base, líneas que lleva, color en el mapa y estado</p>
          </div>
          {canEdit && !loadError && !linesError && (
            <button
              onClick={openCreate}
              className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Agregar ejecutiva
            </button>
          )}
        </div>
      </div>

      {loadError ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button onClick={load} className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100">
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {linesError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
              {linesError}. Las líneas de cada ejecutiva no se pueden mostrar ni editar por ahora.
            </div>
          )}
          {notice && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{notice}</div>
          )}

          {/* Totales por estado (clic = filtrar) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {statCards.map(card => (
              <button
                key={card.key}
                type="button"
                onClick={() => setStatusFilter(prev => (prev === card.key ? 'current' : card.key))}
                className={`text-left bg-white rounded-xl shadow-md border p-5 transition-shadow hover:shadow-lg ${
                  statusFilter === card.key ? 'border-gray-900' : 'border-gray-100'
                }`}
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${card.color} rounded-xl mb-3`} />
                <p className="text-sm font-medium text-gray-600">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </button>
            ))}
          </div>

          {/* Búsqueda y filtro */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, correo, empresa o zona..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
              aria-label="Filtrar por estado"
            >
              <option value="current">Activas y por contratar</option>
              <option value="active">Solo activas</option>
              <option value="placeholder">Solo por contratar</option>
              <option value="inactive">Solo inactivas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Zona base</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Líneas</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Correo</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Empresa</th>
                  {canEdit && (
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(executive => {
                  const zone = executive.base_kam_id ? zoneById.get(executive.base_kam_id) : undefined
                  return (
                    <tr key={executive.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 text-sm font-semibold ${executive.status === 'inactive' ? 'text-gray-400' : 'text-gray-900'}`}>
                          <span
                            className={`w-3.5 h-3.5 rounded-full shrink-0 border ${executiveColor(executive) ? 'border-gray-300' : 'border-dashed border-gray-400'}`}
                            style={{ backgroundColor: executiveColor(executive) ?? 'transparent' }}
                            title={executiveColor(executive) ? `Color en el mapa: ${executiveColor(executive)}` : 'Sin color asignado'}
                          />
                          {executive.full_name}
                        </div>
                        {executive.notes && (
                          <div className="text-xs text-gray-500 max-w-xs mt-0.5" title={executive.notes}>
                            {executive.notes.length > 80 ? `${executive.notes.slice(0, 80)}…` : executive.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          {zone && (
                            <span
                              className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                              style={{ backgroundColor: zone.color || '#9CA3AF' }}
                            />
                          )}
                          <span className={executive.base_kam_id ? '' : 'text-gray-400'}>{baseZoneName(executive)}</span>
                          {zone && !zone.active && <span className="text-xs text-gray-400">(inactiva)</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {executive.lines.length === 0 ? (
                          <span className="text-sm text-gray-400">Sin líneas</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {executive.lines.map(lineId => {
                              const line = lineById.get(lineId)
                              return (
                                <span
                                  key={lineId}
                                  className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium"
                                >
                                  {line ? line.name : 'Línea desconocida'}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${STATUS_BADGE[executive.status]}`}>
                          {STATUS_LABELS[executive.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {executive.email || <span className="text-gray-400">Sin correo</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{executive.company}</td>
                      {canEdit && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEdit(executive)}
                              disabled={Boolean(linesError)}
                              className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                              title={linesError ? 'No se puede editar sin cargar las líneas' : 'Editar ejecutiva'}
                            >
                              Editar
                            </button>
                            {executive.status !== 'inactive' && (
                              <button
                                onClick={() => {
                                  setNotice('')
                                  setDeactivating(executive)
                                }}
                                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium"
                              >
                                Dar de baja
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <h3 className="text-sm font-medium text-gray-900">No se encontraron ejecutivas</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'current'
                    ? 'Prueba con otros términos de búsqueda o con otro filtro de estado'
                    : 'Agrega la primera ejecutiva para comenzar'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {modalOpen && (
        <ExecutiveModal
          executive={editing}
          zones={zones}
          lines={lines}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSaved={handleSaved}
        />
      )}

      {deactivating && (
        <DeactivateDialog
          executive={deactivating}
          onCancel={() => setDeactivating(null)}
          onDone={handleDeactivated}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmación de baja lógica (DELETE /api/executives/[id] → status 'inactive' + left_at)
// ---------------------------------------------------------------------------

interface DeactivateDialogProps {
  executive: Executive
  onCancel: () => void
  onDone: (executive: Executive) => void
}

function DeactivateDialog({ executive, onCancel, onDone }: DeactivateDialogProps) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const confirm = async () => {
    setWorking(true)
    setError('')
    try {
      const response = await fetch(`/api/executives/${executive.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response, 'No se pudo dar de baja a la ejecutiva'))
      const data = await response.json().catch(() => null)
      if (!data || !data.executive || typeof data.executive.id !== 'string') {
        throw new Error('Respuesta inesperada del servidor')
      }
      onDone(data.executive as Executive)
    } catch (err: unknown) {
      console.error('Error dando de baja a la ejecutiva:', err)
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja a la ejecutiva')
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Dar de baja</h3>
        <p className="text-center text-gray-600 mb-4">
          ¿Dar de baja a <strong>{executive.full_name}</strong>?
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 text-sm text-orange-800">
          Quedará como inactiva con la fecha de salida de hoy. No se borra: su historial se conserva y se puede
          reactivar después desde Editar.
        </div>
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
            {working ? 'Procesando...' : 'Dar de baja'}
          </button>
        </div>
      </div>
    </div>
  )
}
