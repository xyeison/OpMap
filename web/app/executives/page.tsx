'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { CAPA_MODAL } from '@/components/terceros/comun'
import { usePermissions } from '@/hooks/usePermissions'
import type { BusinessLine, Executive, ExecutiveStatus } from '@/lib/types/lines'
import { puedeVerDatosDeZona } from '@/lib/zona-estadisticas'
import ContratarDialog from './ContratarDialog'
import ExecutiveModal from './ExecutiveModal'
import HistorialTraspasos from './HistorialTraspasos'
import { executiveColor, readError, STATUS_BADGE, STATUS_LABELS, zoneLabel, type ZoneOption } from './shared'
import { avisoCoberturaDe } from './traspaso-ui'
import TraspasoWizard, { type ModoTraspaso } from './TraspasoWizard'
import ZonaEstadisticasModal from './ZonaEstadisticasModal'

type StatusFilter = 'current' | ExecutiveStatus | 'all'

/** Asistente "Traspasar" abierto: quién entrega, con qué modo y (desde Editar) qué líneas. */
interface TraspasoAbierto {
  origen: Executive
  modo: ModoTraspaso | null
  lineas?: string[]
}

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
  const { can, papeles } = usePermissions()
  const canEdit = can('executives:edit')
  // "Datos de la zona": executives:view + hospitals:view (sus cifras salen de las IPS); la API exige lo mismo
  const canVerDatos = puedeVerDatosDeZona(papeles)
  // Traspaso (spec 2026-10-12): pasar lo de una persona a otra, a una nueva o a una vacante (admin, director comercial)
  const canTransfer = can('executives:transfer')

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
  // "Ver": la ficha de la persona sin poder cambiarla (quien no tiene executives:edit)
  const [viendo, setViendo] = useState(false)
  const [deactivating, setDeactivating] = useState<Executive | null>(null)
  const [traspaso, setTraspaso] = useState<TraspasoAbierto | null>(null)
  const [contratando, setContratando] = useState<Executive | null>(null)
  // Ventana "Datos de la zona" (clic en el nombre o en la fila): solo lectura
  const [datosDe, setDatosDe] = useState<Executive | null>(null)
  const [historialKey, setHistorialKey] = useState(0)
  const [notice, setNotice] = useState('')
  // El cambio se guardó pero la cobertura no se pudo recalcular (PATCH o DELETE): sigue dándole zonas a quien se fue
  const [warning, setWarning] = useState('')
  const avisar = (texto: string, aviso: string | null = null) => {
    setNotice(texto)
    setWarning(aviso ?? '')
  }

  // silencioso = sin la pantalla de carga (tras un traspaso o una contratación, con una ventana abierta)
  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
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
      if (!silencioso) setLoading(false)
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

  // Clic en la fila (o tarjeta) abre "Datos de la zona", salvo que el clic sea en un botón o enlace de la fila
  // (Editar, Traspasar, Dar de baja, Contratar…). Con teclado se abre con el botón del nombre.
  const abrirDatosDesdeFila = (event: MouseEvent<HTMLElement>, executive: Executive) => {
    if (!canVerDatos) return
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, input, select, textarea, label')) return
    setDatosDe(executive)
  }

  const openCreate = () => {
    setEditing(null)
    avisar('')
    setModalOpen(true)
  }

  const openEdit = (executive: Executive) => {
    setEditing(executive)
    setViendo(false)
    avisar('')
    setModalOpen(true)
  }

  const openView = (executive: Executive) => {
    setEditing(executive)
    setViendo(true)
    setModalOpen(true)
  }

  const handleSaved = (saved: Executive, aviso: string | null) => {
    const wasEdit = editing !== null
    setExecutives(prev =>
      prev.some(e => e.id === saved.id) ? prev.map(e => (e.id === saved.id ? saved : e)) : [...prev, saved]
    )
    setModalOpen(false)
    setEditing(null)
    avisar(wasEdit ? `Se guardaron los cambios de ${saved.full_name}.` : `Se creó ${saved.full_name}.`, aviso)
  }

  const handleDeactivated = (saved: Executive, aviso: string | null) => {
    setExecutives(prev => prev.map(e => (e.id === saved.id ? saved : e)))
    setDeactivating(null)
    avisar(`${saved.full_name} quedó inactiva.`, aviso)
  }

  const openTraspaso = (executive: Executive, modo: ModoTraspaso | null, lineas?: string[]) => {
    avisar('')
    setTraspaso({ origen: executive, modo, lineas })
  }

  // "Dar de baja": con permiso de traspaso y líneas, abre el asistente como baja (lo suyo pasa a alguien); si no lleva
  // líneas o solo se puede editar, la baja simple de siempre (la API termina sus visitantes y recalcula la cobertura).
  const canTransferFrom = (executive: Executive) =>
    canTransfer && executive.status !== 'inactive' && executive.lines.length > 0
  const startDeactivate = (executive: Executive) => {
    if (canTransferFrom(executive)) {
      openTraspaso(executive, 'baja')
      return
    }
    avisar('')
    setDeactivating(executive)
  }

  const handleTraspasoHecho = () => {
    if (traspaso) avisar(`Traspaso de ${traspaso.origen.full_name} hecho. Está en el historial de traspasos.`)
    setHistorialKey(value => value + 1)
    void load(true)
  }

  const handleContratado = (saved: Executive | null, name: string, linkedUser: boolean | null) => {
    if (saved) setExecutives(prev => prev.map(e => (e.id === saved.id ? saved : e)))
    else void load(true)
    setContratando(null)
    avisar(
      `Se contrató a ${name} en la vacante: conserva su zona, sus líneas, sus médicos y sus ajustes manuales.${
        linkedUser ? ' Quedó enlazada a su usuario de OpMap.' : ''
      }`
    )
  }

  // Acciones de cada persona como íconos (dueño, 2026-10-29): Ver (quien solo consulta), Editar, Contratar (vacantes),
  // Traspasar y Dar de baja, cada una con su permiso. En la tabla, solo el ícono (con su nombre al pasar el cursor y para
  // lectores de pantalla); en las tarjetas del celular, ícono y nombre.
  const renderActions = (executive: Executive, layout: 'table' | 'card') => {
    const active = executive.status !== 'inactive'
    const canDeactivate = active && (canTransferFrom(executive) || canEdit)
    return (
      <div className={layout === 'table' ? 'flex items-center justify-center gap-0.5' : 'flex flex-wrap gap-2'}>
        {!canEdit && (
          <BotonAccion
            layout={layout}
            icono={ICONO_VER}
            etiqueta="Ver"
            titulo={linesError ? 'No se puede ver la ficha sin cargar las líneas' : `Ver la ficha de ${executive.full_name}`}
            onClick={() => openView(executive)}
            disabled={Boolean(linesError)}
          />
        )}
        {canEdit && (
          <BotonAccion
            layout={layout}
            icono={ICONO_EDITAR}
            etiqueta="Editar"
            titulo={linesError ? 'No se puede editar sin cargar las líneas' : `Editar a ${executive.full_name}`}
            onClick={() => openEdit(executive)}
            disabled={Boolean(linesError)}
          />
        )}
        {canEdit && executive.status === 'placeholder' && (
          <BotonAccion
            layout={layout}
            tono="verde"
            icono={ICONO_CONTRATAR}
            etiqueta="Contratar"
            titulo={linesError ? 'No se puede contratar sin cargar las líneas' : 'Contratar: la vacante pasa a ser la persona contratada y conserva todo lo que tenía'}
            onClick={() => {
              avisar('')
              setContratando(executive)
            }}
            disabled={Boolean(linesError)}
          />
        )}
        {canTransferFrom(executive) && (
          <BotonAccion
            layout={layout}
            tono="azul"
            icono={ICONO_TRASPASAR}
            etiqueta="Traspasar"
            titulo={linesError ? 'No se puede traspasar sin cargar las líneas' : 'Traspasar: pasar sus líneas, zonas, ajustes y médicos a otra persona'}
            onClick={() => openTraspaso(executive, null)}
            disabled={Boolean(linesError)}
          />
        )}
        {canDeactivate && (
          <BotonAccion
            layout={layout}
            tono="rojo"
            icono={ICONO_BAJA}
            etiqueta="Dar de baja"
            titulo={`Dar de baja a ${executive.full_name}`}
            onClick={() => startDeactivate(executive)}
            disabled={canTransferFrom(executive) && Boolean(linesError)}
          />
        )}
      </div>
    )
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
    { key: 'placeholder', label: 'Vacantes', value: counts.placeholder, color: 'from-amber-500 to-amber-600' },
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
            {canVerDatos && (
              <p className="text-gray-400 text-sm mt-1">Toca o haz clic en un nombre para ver los datos de su zona y de su territorio.</p>
            )}
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
          <button onClick={() => load()} className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100">
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
          {warning && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm" role="alert">
              {warning}
            </div>
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
              <option value="current">Activas y vacantes</option>
              <option value="active">Solo activas</option>
              <option value="placeholder">Solo vacantes</option>
              <option value="inactive">Solo inactivas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          {/* Tabla (escritorio) */}
          <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Zona base</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Líneas</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Correo</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(executive => {
                  const zone = executive.base_kam_id ? zoneById.get(executive.base_kam_id) : undefined
                  return (
                    <tr
                      key={executive.id}
                      className={`hover:bg-gray-50 transition-colors align-top ${canVerDatos ? 'cursor-pointer' : ''}`}
                      onClick={event => abrirDatosDesdeFila(event, executive)}
                    >
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 text-sm font-semibold ${executive.status === 'inactive' ? 'text-gray-400' : 'text-gray-900'}`}>
                          <ColorDot executive={executive} />
                          <NombreBoton executive={executive} onAbrir={canVerDatos ? setDatosDe : null} />
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
                        <LineChips executive={executive} lineById={lineById} />
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
                      <td className="px-4 py-4">{renderActions(executive, 'table')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <EmptyState filtering={Boolean(searchTerm) || statusFilter !== 'current'} />}
          </div>

          {/* Tarjetas (celular) */}
          <div className="md:hidden space-y-3">
            {filtered.map(executive => {
              const zone = executive.base_kam_id ? zoneById.get(executive.base_kam_id) : undefined
              return (
                <div
                  key={executive.id}
                  className={`bg-white rounded-xl shadow-md border border-gray-100 p-4 min-w-0 ${canVerDatos ? 'cursor-pointer' : ''}`}
                  onClick={event => abrirDatosDesdeFila(event, executive)}
                >
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div
                      className={`flex items-center gap-2 text-sm font-semibold min-w-0 ${
                        executive.status === 'inactive' ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      <ColorDot executive={executive} />
                      <NombreBoton executive={executive} onAbrir={canVerDatos ? setDatosDe : null} className="break-words min-w-0" />
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${STATUS_BADGE[executive.status]}`}>
                      {STATUS_LABELS[executive.status]}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-700 min-w-0">
                    {zone && (
                      <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: zone.color || '#9CA3AF' }} />
                    )}
                    <span className={`truncate ${executive.base_kam_id ? '' : 'text-gray-400'}`}>Zona: {baseZoneName(executive)}</span>
                    {zone && !zone.active && <span className="text-xs text-gray-400 shrink-0">(inactiva)</span>}
                  </div>
                  <div className="mt-2">
                    <LineChips executive={executive} lineById={lineById} />
                  </div>
                  <div className="mt-2 text-xs text-gray-500 break-all">
                    {executive.email || 'Sin correo'} · {executive.company}
                  </div>
                  {executive.notes && <div className="mt-1 text-xs text-gray-500 break-words">{executive.notes}</div>}
                  <div className="mt-3 pt-3 border-t border-gray-100">{renderActions(executive, 'card')}</div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-100">
                <EmptyState filtering={Boolean(searchTerm) || statusFilter !== 'current'} />
              </div>
            )}
          </div>

          <HistorialTraspasos refrescar={historialKey} lines={lines} executives={executives} />
        </>
      )}

      {modalOpen && (
        <ExecutiveModal
          executive={editing}
          zones={zones}
          lines={lines}
          soloLectura={viendo}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
            setViendo(false)
          }}
          onSaved={handleSaved}
          onTraspasar={
            canTransfer
              ? (executive, removedLines) => {
                  setModalOpen(false)
                  setEditing(null)
                  openTraspaso(executive, 'quitar', removedLines)
                }
              : undefined
          }
        />
      )}

      {deactivating && (
        <DeactivateDialog
          executive={deactivating}
          canTransfer={canTransfer}
          onCancel={() => setDeactivating(null)}
          onDone={handleDeactivated}
        />
      )}

      {traspaso && (
        <TraspasoWizard
          origen={traspaso.origen}
          modoInicial={traspaso.modo}
          lineasIniciales={traspaso.lineas}
          executives={executives}
          lines={lines}
          zones={zones}
          onCerrar={() => setTraspaso(null)}
          onHecho={handleTraspasoHecho}
        />
      )}

      {datosDe && <ZonaEstadisticasModal executive={datosDe} onCerrar={() => setDatosDe(null)} />}

      {contratando && (
        <ContratarDialog
          vacante={contratando}
          executives={executives}
          lines={lines}
          zones={zones}
          onCerrar={() => setContratando(null)}
          onHecho={handleContratado}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piezas de la lista
// ---------------------------------------------------------------------------

/** Nombre como botón: abre "Datos de la zona" (con teclado: Tab + Enter). Sin onAbrir (rol sin ese permiso), solo texto. */
function NombreBoton({
  executive,
  onAbrir,
  className = '',
}: {
  executive: Executive
  onAbrir: ((executive: Executive) => void) | null
  className?: string
}) {
  if (!onAbrir) return <span className={className}>{executive.full_name}</span>
  return (
    <button
      type="button"
      onClick={() => onAbrir(executive)}
      className={`text-left underline decoration-gray-300 underline-offset-2 hover:decoration-gray-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-700 ${className}`}
    >
      {executive.full_name}
      <span className="sr-only"> · ver los datos de su zona</span>
    </button>
  )
}

function ColorDot({ executive }: { executive: Executive }) {
  const color = executiveColor(executive)
  return (
    <span
      className={`w-3.5 h-3.5 rounded-full shrink-0 border ${color ? 'border-gray-300' : 'border-dashed border-gray-400'}`}
      style={{ backgroundColor: color ?? 'transparent' }}
      title={color ? `Color en el mapa: ${color}` : 'Sin color asignado'}
    />
  )
}

function LineChips({ executive, lineById }: { executive: Executive; lineById: Map<string, BusinessLine> }) {
  if (executive.lines.length === 0) return <span className="text-sm text-gray-400">Sin líneas</span>
  return (
    <div className="flex flex-wrap gap-1.5 md:max-w-xs">
      {executive.lines.map(lineId => {
        const line = lineById.get(lineId)
        return (
          <span key={lineId} className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">
            {line ? line.name : 'Línea desconocida'}
          </span>
        )
      })}
    </div>
  )
}

function EmptyState({ filtering }: { filtering: boolean }) {
  return (
    <div className="text-center py-12 px-4">
      <h3 className="text-sm font-medium text-gray-900">No se encontraron ejecutivas</h3>
      <p className="mt-1 text-sm text-gray-500">
        {filtering ? 'Prueba con otros términos de búsqueda o con otro filtro de estado' : 'Agrega la primera ejecutiva para comenzar'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Baja simple (DELETE /api/executives/[id] → status 'inactive' + left_at). Se usa cuando la persona no lleva líneas
// (no hay nada que traspasar) o cuando quien administra no tiene permiso de traspaso. La API termina sus visitantes y
// recalcula la cobertura: "si alguien se va, ya no está" (decisión del dueño 2026-10-12).
// ---------------------------------------------------------------------------

interface DeactivateDialogProps {
  executive: Executive
  canTransfer: boolean
  onCancel: () => void
  /** aviso: la baja quedó guardada pero la cobertura no se pudo recalcular. */
  onDone: (executive: Executive, aviso: string | null) => void
}

function DeactivateDialog({ executive, canTransfer, onCancel, onDone }: DeactivateDialogProps) {
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
      onDone(data.executive as Executive, avisoCoberturaDe(data))
    } catch (err: unknown) {
      console.error('Error dando de baja a la ejecutiva:', err)
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja a la ejecutiva')
      setWorking(false)
    }
  }

  const hasLines = executive.lines.length > 0

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 ${CAPA_MODAL} flex items-center justify-center p-4`} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-orange-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Dar de baja</h3>
        <p className="text-center text-gray-600 mb-4 break-words">
          ¿Dar de baja a <strong>{executive.full_name}</strong>?
        </p>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5 text-sm text-orange-800 space-y-2">
          <p>
            Quedará como inactiva con la fecha de salida de hoy. No se borra: su historial se conserva y se puede
            reactivar después desde Editar.
          </p>
          {hasLines ? (
            <p>
              <strong>Ya no está:</strong> sus médicos quedan sin visitante y la cobertura deja de darle zonas.
              {canTransfer
                ? ' Para pasar lo suyo a otra persona, cancela y usa «Traspasar».'
                : ' Para pasar lo suyo a otra persona, pide a un administrador o al director comercial que use «Traspasar».'}
            </p>
          ) : (
            <p>No lleva líneas: no hay médicos ni zonas que traspasar.</p>
          )}
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

// Íconos de las acciones (trazos de 24 × 24)
const ICONO_VER = 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
const ICONO_EDITAR = 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
const ICONO_CONTRATAR = 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
const ICONO_TRASPASAR = 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
const ICONO_BAJA = 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6'

const TONOS: Record<'neutro' | 'verde' | 'azul' | 'rojo', { tabla: string; tarjeta: string }> = {
  neutro: { tabla: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100', tarjeta: 'text-gray-700 border-gray-300 bg-white hover:bg-gray-50' },
  verde: { tabla: 'text-green-700 hover:text-green-800 hover:bg-green-50', tarjeta: 'text-green-700 border-green-300 bg-white hover:bg-green-50' },
  azul: { tabla: 'text-blue-700 hover:text-blue-800 hover:bg-blue-50', tarjeta: 'text-blue-700 border-blue-300 bg-white hover:bg-blue-50' },
  rojo: { tabla: 'text-red-600 hover:text-red-700 hover:bg-red-50', tarjeta: 'text-red-600 border-red-200 bg-white hover:bg-red-50' },
}

function BotonAccion({ layout, icono, etiqueta, titulo, onClick, disabled = false, tono = 'neutro' }: {
  layout: 'table' | 'card'
  icono: string
  etiqueta: string
  titulo?: string
  onClick: () => void
  disabled?: boolean
  tono?: keyof typeof TONOS
}) {
  const dibujo = (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icono} />
    </svg>
  )
  if (layout === 'table') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={titulo ?? etiqueta}
        aria-label={etiqueta}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-40 ${TONOS[tono].tabla}`}
      >
        {dibujo}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo ?? etiqueta}
      className={`inline-flex min-h-[44px] min-w-[7rem] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-40 ${TONOS[tono].tarjeta}`}
    >
      {dibujo}
      {etiqueta}
    </button>
  )
}
