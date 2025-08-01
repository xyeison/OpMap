'use client'

import { useState, useEffect } from 'react'
import { useVisits } from '@/hooks/useVisits'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface VisitsControlsProps {
  onVisitsChange?: (visits: any[]) => void
  onShowVisitsChange?: (show: boolean) => void
  onShowHeatmapChange?: (show: boolean) => void
  onShowMarkersChange?: (show: boolean) => void
}

export default function VisitsControls({
  onVisitsChange,
  onShowVisitsChange,
  onShowHeatmapChange,
  onShowMarkersChange
}: VisitsControlsProps) {
  const [showControls, setShowControls] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showMarkers, setShowMarkers] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [visitTypeFilter, setVisitTypeFilter] = useState('all')
  const [contactTypeFilter, setContactTypeFilter] = useState('all')

  // Cargar visitas con filtros
  const { data: visits, isLoading: visitsLoading } = useVisits({
    month: selectedMonth,
    year: selectedYear,
    visitType: visitTypeFilter === 'all' ? undefined : visitTypeFilter,
    contactType: contactTypeFilter === 'all' ? undefined : contactTypeFilter
  })

  // Notificar cambios
  useEffect(() => {
    console.log('VisitsControls - Visits loaded:', visits?.length, 'visits')
    if (visits && visits.length > 0) {
      console.log('VisitsControls - First visit:', visits[0])
    }
    if (onVisitsChange && visits) {
      onVisitsChange(visits)
    }
  }, [visits, onVisitsChange])

  useEffect(() => {
    if (onShowVisitsChange) {
      onShowVisitsChange(showControls)
    }
  }, [showControls, onShowVisitsChange])

  useEffect(() => {
    if (onShowHeatmapChange) {
      onShowHeatmapChange(showHeatmap)
    }
  }, [showHeatmap, onShowHeatmapChange])

  useEffect(() => {
    if (onShowMarkersChange) {
      onShowMarkersChange(showMarkers)
    }
  }, [showMarkers, onShowMarkersChange])

  return (
    <>
      {/* Controles de visitas */}
      {showControls && (
        <div className="absolute top-4 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg max-w-sm">
          <h3 className="font-bold text-lg mb-3">Control de Visitas</h3>
          
          {/* Filtros de fecha */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Mes</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {format(new Date(2000, i, 1), 'MMMM', { locale: es })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Año</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2023, 2024, 2025].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtros de tipo */}
          <div className="space-y-2 mb-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Tipo de Visita</label>
              <select
                value={visitTypeFilter}
                onChange={(e) => setVisitTypeFilter(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas</option>
                <option value="Visita efectiva">Efectivas</option>
                <option value="Visita extra">Extras</option>
                <option value="Visita no efectiva">No efectivas</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Tipo de Contacto</label>
              <select
                value={contactTypeFilter}
                onChange={(e) => setContactTypeFilter(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="Visita presencial">Presencial</option>
                <option value="Visita virtual">Virtual</option>
              </select>
            </div>
          </div>

          {/* Opciones de visualización */}
          <div className="space-y-2 mb-3">
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="mr-2"
              />
              Mostrar mapa de calor
            </label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
                className="mr-2"
              />
              Mostrar marcadores individuales
            </label>
          </div>

          {/* Estadísticas */}
          {visits && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-600">
              <p>Total visitas: <strong>{visits.length}</strong></p>
              <p>Efectivas: <strong className="text-green-600">
                {visits.filter(v => v.visit_type === 'Visita efectiva').length}
              </strong></p>
              <p>Presenciales: <strong className="text-blue-600">
                {visits.filter(v => v.contact_type === 'Visita presencial').length}
              </strong></p>
            </div>
          )}

          {/* Análisis de cobertura */}
          <button
            onClick={() => window.open(`/visits/coverage?month=${selectedMonth}&year=${selectedYear}`, '_blank')}
            className="mt-3 w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
          >
            Ver Zonas No Visitadas
          </button>
        </div>
      )}

      {/* Botón para mostrar/ocultar controles */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute top-4 left-4 z-[999] bg-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 flex items-center gap-2"
        style={{ left: showControls ? '340px' : '10px' }}
      >
        <i className="fas fa-map-marked-alt"></i>
        {showControls ? 'Ocultar' : 'Mostrar'} Visitas
      </button>

      {/* Leyenda adicional para visitas */}
      {showControls && showMarkers && (
        <div className="absolute bottom-40 right-4 z-[1000] bg-white p-3 rounded-lg shadow-lg">
          <h4 className="font-bold text-sm mb-2">Tipos de Visita</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2ECC71' }}></div>
              <span>Visita efectiva</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3498DB' }}></div>
              <span>Visita extra</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E74C3C' }}></div>
              <span>Visita no efectiva</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}