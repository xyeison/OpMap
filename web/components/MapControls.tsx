'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useVisits } from '@/hooks/useVisits'
import MapGroupFilter, { type GroupFilterConfig } from './MapGroupFilter'
import {
  EMPTY_IPS_FILTER,
  IPS_FILTER_HINTS,
  IPS_FILTER_LABELS,
  hasRepsData,
  ipsServiceAvailability,
  IPS_SERVICE_UNAVAILABLE_HINT,
  isIpsFilterActive,
  parseBedsInput,
  type IpsServiceFilter,
} from '@/lib/hospital-service-filters'

// Referencia estable para "sin visitas": un [] nuevo en cada render dispararía el efecto que avisa
// al padre (setVisits) en bucle mientras las visitas están apagadas
const NO_VISITS: any[] = []

interface MapControlsProps {
  mapData: any
  hospitalTypeFilter: string
  setHospitalTypeFilter: (value: string) => void
  filteredAssignments: any[]
  filteredUnassignedHospitals: any[]
  onVisitsChange?: (visits: any[]) => void
  onShowHeatmapChange?: (show: boolean) => void
  onShowMarkersChange?: (show: boolean) => void
  onHospitalSelect?: (hospitalId: string | null) => void
  onMapNavigate?: (lat: number, lng: number, zoom: number) => void
  // 'floating': botón y panel flotante (escritorio). 'embedded': contenido dentro de la hoja inferior (móvil)
  variant?: 'floating' | 'embedded'
  // Visitas apagadas por defecto: sin consulta ni mapa de calor hasta activarlas
  visitsEnabled?: boolean
  onVisitsEnabledChange?: (enabled: boolean) => void
  // Tras elegir un resultado de búsqueda (en móvil, la hoja se recoge)
  onSearchSelect?: () => void
  // Filtro principal: Ejecutivos Comerciales (vista por línea) o zonas (vista de zonas)
  groupFilter?: GroupFilterConfig | null
  // Zonas (kam_id) cuyas visitas se muestran según el filtro; null = todas
  visitKamIds?: string[] | null
  // "1 ejecutiva" en el botón flotante cuando hay filtro activo
  filterChipLabel?: string | null
  // Cada cambio abre la pestaña "Filtros" (botón "Filtros" de la hoja inferior)
  filtersTabRequest?: number
  // Fase 3: bloque "IPS" (servicios y capacidad del REPS); oculta los puntos que no cumplen
  ipsServiceFilter?: IpsServiceFilter
  onIpsServiceFilterChange?: (filter: IpsServiceFilter) => void
}

const IPS_FILTER_CHECKS = ['quirofano', 'ortopedia', 'neurocirugia', 'columna'] as const

export default function MapControls({
  mapData,
  hospitalTypeFilter,
  setHospitalTypeFilter,
  filteredAssignments,
  filteredUnassignedHospitals,
  onVisitsChange,
  onShowHeatmapChange,
  onShowMarkersChange,
  onHospitalSelect,
  onMapNavigate,
  variant = 'floating',
  visitsEnabled = false,
  onVisitsEnabledChange,
  onSearchSelect,
  groupFilter = null,
  visitKamIds = null,
  filterChipLabel = null,
  filtersTabRequest = 0,
  ipsServiceFilter = EMPTY_IPS_FILTER,
  onIpsServiceFilterChange
}: MapControlsProps) {
  const embedded = variant === 'embedded'
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'filters' | 'visits' | 'search'>('filters')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  // Texto de los campos de camas (el filtro solo guarda números válidos)
  const [minBedsText, setMinBedsText] = useState(ipsServiceFilter.minBeds === null ? '' : String(ipsServiceFilter.minBeds))
  const [maxBedsText, setMaxBedsText] = useState(ipsServiceFilter.maxBeds === null ? '' : String(ipsServiceFilter.maxBeds))
  const ipsWithoutReps = useMemo(
    () => (mapData?.hospitals || []).filter((h: any) => !hasRepsData(h)).length,
    [mapData]
  )
  // Sin ningún dato del REPS importado, marcar un servicio dejaría el mapa sin puntos: se desactiva
  const ipsServiceAvailable = useMemo(() => ipsServiceAvailability(mapData?.hospitals), [mapData])
  
  // Estados para visitas - Tipo de visualización
  const [visualizationType, setVisualizationType] = useState<'heatmap' | 'markers' | 'both'>('heatmap')
  
  // Filtros de período - año con múltiples meses
  const [selectedYear, setSelectedYear] = useState<number>(2025) // Año seleccionado
  const [selectedMonths, setSelectedMonths] = useState<number[]>([7]) // Meses seleccionados (julio por defecto)
  
  // Filtros de contenido
  const [visitTypeFilter, setVisitTypeFilter] = useState('all')
  const [contactTypeFilter, setContactTypeFilter] = useState('all')

  // Las zonas de las visitas salen del filtro principal (Ejecutivos Comerciales o zonas): null = todas
  const noGroupSelected = visitKamIds !== null && visitKamIds.length === 0
  const visitKamIdsKey = visitKamIds === null ? null : visitKamIds.join(',')

  // Las visualizaciones solo se muestran con las visitas activadas y filtros válidos
  const hasValidFilters = selectedMonths.length > 0 && !noGroupSelected;
  const showHeatmap = visitsEnabled && hasValidFilters && (visualizationType === 'heatmap' || visualizationType === 'both');
  const showMarkers = visitsEnabled && hasValidFilters && (visualizationType === 'markers' || visualizationType === 'both');

  // Construir queryParams basado en el estado actual de TODOS los filtros
  const queryParams = useMemo(() => {
    // Visitas apagadas: no se consulta nada
    if (!visitsEnabled) return null

    // Verificar que haya meses seleccionados
    if (selectedMonths.length === 0) return null

    // Filtro sin ningún Ejecutivo Comercial (o zona) marcado: no hay visitas que consultar
    if (visitKamIdsKey === '') return null

    // Construir parámetros
    const params: any = {
      months: selectedMonths.sort((a, b) => a - b),
      year: selectedYear
    }
    
    // Agregar filtros de contenido
    params.visitType = visitTypeFilter === 'all' ? undefined : visitTypeFilter
    params.contactType = contactTypeFilter === 'all' ? undefined : contactTypeFilter
    
    // Zonas del filtro principal; sin filtro no se envía (todas las visitas)
    if (visitKamIdsKey !== null) {
      params.kamIds = visitKamIdsKey.split(',')
    }

    return params
  }, [visitsEnabled, selectedMonths, selectedYear, visitTypeFilter, contactTypeFilter, visitKamIdsKey])
  
  // Hacer la query solo si hay parámetros válidos
  const { data: visitsData, isLoading, error } = useVisits(queryParams)
  
  // Las visitas son simplemente lo que retorna la query, pero SOLO si hay parámetros válidos
  const visits = queryParams && Array.isArray(visitsData) ? visitsData : NO_VISITS

  // El botón "Filtros" de la hoja inferior abre esta pestaña
  useEffect(() => {
    if (filtersTabRequest > 0) setActiveTab('filters')
  }, [filtersTabRequest])

  // Notificar cambios de visitas al componente padre
  useEffect(() => {
    if (onVisitsChange) {
      // Sin parámetros válidos (visitas apagadas, sin meses o sin Ejecutivos Comerciales): sin visitas
      onVisitsChange(queryParams ? visits : NO_VISITS)
    }
  }, [visits, onVisitsChange, queryParams])

  // Notificar cambios de visualización al componente padre
  useEffect(() => {
    if (onShowHeatmapChange) {
      onShowHeatmapChange(showHeatmap)
    }
  }, [showHeatmap, onShowHeatmapChange])

  // Función de búsqueda mejorada
  useEffect(() => {
    if (searchTerm.length > 2) {
      const results: any[] = []
      const searchLower = searchTerm.toLowerCase()
      
      // Buscar hospitales
      mapData.hospitals?.forEach((hospital: any) => {
        if (hospital.name.toLowerCase().includes(searchLower) ||
            hospital.code.toLowerCase().includes(searchLower)) {
          results.push({
            type: 'hospital',
            id: hospital.id,
            name: hospital.name,
            code: hospital.code,
            municipality: mapData.municipalityNames[hospital.municipality_id] || hospital.municipality_id,
            lat: hospital.lat,
            lng: hospital.lng
          })
        }
      })
      
      // Buscar municipios únicos
      const uniqueMunicipalities = new Map()
      const uniqueDepartments = new Map()
      
      mapData.hospitals?.forEach((hospital: any) => {
        // Municipios
        if (!uniqueMunicipalities.has(hospital.municipality_id)) {
          const municipalityName = mapData.municipalityNames[hospital.municipality_id] || hospital.municipality_name || hospital.municipality_id
          if (municipalityName && municipalityName.toLowerCase().includes(searchLower)) {
            // Calcular centro aproximado del municipio
            const hospitalsInMunicipality = mapData.hospitals.filter((h: any) => h.municipality_id === hospital.municipality_id)
            const avgLat = hospitalsInMunicipality.reduce((sum: number, h: any) => sum + h.lat, 0) / hospitalsInMunicipality.length
            const avgLng = hospitalsInMunicipality.reduce((sum: number, h: any) => sum + h.lng, 0) / hospitalsInMunicipality.length
            
            uniqueMunicipalities.set(hospital.municipality_id, {
              type: 'municipality',
              id: hospital.municipality_id,
              name: municipalityName,
              department: hospital.department_name || '',
              hospitalCount: hospitalsInMunicipality.length,
              lat: avgLat,
              lng: avgLng
            })
          }
        }
        
        // Departamentos
        if (!uniqueDepartments.has(hospital.department_id)) {
          const departmentName = hospital.department_name || hospital.department_id
          if (departmentName && departmentName.toLowerCase().includes(searchLower)) {
            // Calcular centro aproximado del departamento
            const hospitalsInDepartment = mapData.hospitals.filter((h: any) => h.department_id === hospital.department_id)
            const avgLat = hospitalsInDepartment.reduce((sum: number, h: any) => sum + h.lat, 0) / hospitalsInDepartment.length
            const avgLng = hospitalsInDepartment.reduce((sum: number, h: any) => sum + h.lng, 0) / hospitalsInDepartment.length
            
            uniqueDepartments.set(hospital.department_id, {
              type: 'department',
              id: hospital.department_id,
              name: departmentName,
              hospitalCount: hospitalsInDepartment.length,
              lat: avgLat,
              lng: avgLng
            })
          }
        }
      })
      
      // Agregar departamentos primero
      uniqueDepartments.forEach(department => results.push(department))
      // Luego municipios
      uniqueMunicipalities.forEach(municipality => results.push(municipality))
      
      // Ordenar resultados: departamentos primero, luego municipios, luego hospitales
      results.sort((a, b) => {
        const typeOrder = { department: 0, municipality: 1, hospital: 2 }
        return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder]
      })
      
      setSearchResults(results.slice(0, 15)) // Limitar a 15 resultados
    } else {
      setSearchResults([])
    }
  }, [searchTerm, mapData])

  useEffect(() => {
    if (onShowMarkersChange) {
      onShowMarkersChange(showMarkers)
    }
  }, [showMarkers, onShowMarkersChange])


  // Texto del filtro principal en la pestaña de visitas
  const groupNoun = groupFilter?.kind === 'zone' ? 'una zona' : 'un Ejecutivo Comercial'
  let groupSummary = ''
  if (groupFilter) {
    const total = groupFilter.options.length
    const marked = groupFilter.selected === null
      ? total
      : groupFilter.options.filter(o => groupFilter.selected!.has(o.id)).length
    const noun = groupFilter.kind === 'zone' ? 'zonas' : 'Ejecutivos Comerciales'
    groupSummary = groupFilter.selected === null
      ? `Sin filtro: ${total} ${noun}`
      : `Filtro: ${marked} de ${total} ${noun}`
  }

  const tabs: { id: 'filters' | 'visits' | 'search'; label: string; icon: string }[] = [
    { id: 'filters', label: 'Filtros', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
    { id: 'visits', label: 'Visitas', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'search', label: 'Buscar', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' }
  ]

  const tabBar = (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl" role="tablist" aria-label="Controles del mapa">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 rounded-lg text-sm font-medium transition-all ${embedded ? 'min-h-[44px]' : 'py-2'} ${
            activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path>
          </svg>
          {tab.label}
        </button>
      ))}
    </div>
  )

  const panelBody = (
    <div className={embedded ? 'pt-3' : 'p-4'}>
      {/* Tab de Filtros */}
      {activeTab === 'filters' && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Filtros del Mapa</h3>

          {/* Filtro principal: Ejecutivos Comerciales (vista por línea) o zonas (vista de zonas) */}
          {groupFilter && (
            <div className="mb-4 pb-3 border-b">
              <MapGroupFilter config={groupFilter} touch={embedded} />
            </div>
          )}

          {/* Filtro de tipo de hospital */}
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-700 block mb-2">Tipo de Hospital</label>
            <select 
              value={hospitalTypeFilter}
              onChange={(e) => setHospitalTypeFilter(e.target.value)}
              className={`w-full px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white ${embedded ? 'h-11' : 'py-2'}`}
            >
              <option value="all">Todos los hospitales</option>
              <option value="Publico">Públicos</option>
              <option value="Privada">Privados</option>
              <option value="Mixta">Mixtos</option>
              <option value="sin_tipo">Sin clasificar</option>
            </select>
            <div className="mt-2 px-3 py-2 bg-gray-100 rounded-lg text-xs text-gray-700 font-medium">
              <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
              </svg>
              Mostrando {filteredAssignments.length + filteredUnassignedHospitals.length} hospitales
            </div>
          </div>

          {/* Fase 3: IPS por servicios y capacidad del REPS (solo oculta puntos; el territorio no cambia) */}
          {onIpsServiceFilterChange && (
            <div className="mb-3 pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">IPS</span>
                {isIpsFilterActive(ipsServiceFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinBedsText('')
                      setMaxBedsText('')
                      onIpsServiceFilterChange(EMPTY_IPS_FILTER)
                    }}
                    className="text-xs text-gray-600 underline hover:text-gray-900"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {IPS_FILTER_CHECKS.map(key => {
                  // Se puede desmarcar siempre; marcar solo si hay datos del REPS para esa casilla
                  const unavailable = !ipsServiceAvailable[key] && !ipsServiceFilter[key]
                  return (
                    <label
                      key={key}
                      title={unavailable ? IPS_SERVICE_UNAVAILABLE_HINT : IPS_FILTER_HINTS[key]}
                      className={`flex items-center gap-2 text-sm ${unavailable ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 cursor-pointer'} ${embedded ? 'min-h-[44px]' : 'py-0.5'}`}
                    >
                      <input
                        type="checkbox"
                        checked={ipsServiceFilter[key]}
                        disabled={unavailable}
                        onChange={e => onIpsServiceFilterChange({ ...ipsServiceFilter, [key]: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {IPS_FILTER_LABELS[key]}
                    </label>
                  )
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-600 shrink-0">Camas</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="mín."
                  aria-label="Camas mínimas"
                  value={minBedsText}
                  onChange={e => {
                    setMinBedsText(e.target.value)
                    onIpsServiceFilterChange({ ...ipsServiceFilter, minBeds: parseBedsInput(e.target.value) })
                  }}
                  className={`w-full min-w-0 px-2 text-sm border border-gray-300 rounded-lg bg-white ${embedded ? 'h-11' : 'py-1'}`}
                />
                <span className="text-xs text-gray-500">a</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="máx."
                  aria-label="Camas máximas"
                  value={maxBedsText}
                  onChange={e => {
                    setMaxBedsText(e.target.value)
                    onIpsServiceFilterChange({ ...ipsServiceFilter, maxBeds: parseBedsInput(e.target.value) })
                  }}
                  className={`w-full min-w-0 px-2 text-sm border border-gray-300 rounded-lg bg-white ${embedded ? 'h-11' : 'py-1'}`}
                />
              </div>
              {ipsServiceAvailable.any ? (
                <p className="mt-1 text-xs text-gray-500">
                  Datos del REPS (camas del REPS o, si no hay, las de la ficha).
                  {ipsWithoutReps > 0 ? ` ${ipsWithoutReps} IPS aún sin datos del REPS quedan ocultas al filtrar por servicio.` : ''}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Los servicios se activan cuando se importen del REPS (Hospitales, &quot;Importar del REPS&quot;). Mientras tanto
                  se puede filtrar por camas (las de la ficha).
                </p>
              )}
            </div>
          )}

          {/* "Solo con Contratos" se quitó el 2026-10-24: el mapa ya no manda los contratos cargados a mano; giros ADRES y
              compras SECOP de 12 meses van en las tarjetas (spec docs/specs/2026-10-24-mapa-giros-y-compras-12-meses.md). */}

          {/* Estadísticas por tipo */}
          <div className="text-xs space-y-1 pt-2 border-t">
            <div className="flex justify-between">
              <span>Públicos:</span>
              <span className="font-medium">{mapData.hospitals.filter((h: any) => h.type === 'Publico').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Privados:</span>
              <span className="font-medium">{mapData.hospitals.filter((h: any) => h.type === 'Privada').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Mixtos:</span>
              <span className="font-medium">{mapData.hospitals.filter((h: any) => h.type === 'Mixta').length}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Sin clasificar:</span>
              <span className="font-medium">{mapData.hospitals.filter((h: any) => !h.type).length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab de Visitas */}
      {activeTab === 'visits' && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Visualización de Visitas Médicas</h3>

          {/* Visitas apagadas por defecto: sin consulta ni capa hasta activarlas */}
          <button
            type="button"
            role="switch"
            aria-checked={visitsEnabled}
            onClick={() => onVisitsEnabledChange?.(!visitsEnabled)}
            className={`mb-4 w-full flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 text-left hover:bg-gray-50 ${embedded ? 'min-h-[52px] py-2' : 'py-2'}`}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900">Mostrar visitas en el mapa</span>
              <span className="block text-xs text-gray-500">Los marcadores individuales aparecen desde zoom 10</span>
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${visitsEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${visitsEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </span>
          </button>

          {/* Tipo de visualización - Solo si hay filtros válidos */}
          {hasValidFilters ? (
            <div className="mb-4">
              <label className="text-xs font-medium text-gray-700 mb-2 block">Tipo de visualización</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setVisualizationType('heatmap')}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                    visualizationType === 'heatmap'
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                  </svg>
                  Mapa de Calor
                </button>
                <button
                  onClick={() => setVisualizationType('markers')}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                    visualizationType === 'markers'
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Marcadores
                </button>
                <button
                  onClick={() => setVisualizationType('both')}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all ${
                    visualizationType === 'both'
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                  </svg>
                  Ambos
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-xs">
                  <p className="font-semibold text-amber-800 mb-1">Seleccione filtros para visualizar</p>
                  <p className="text-amber-700">
                    {selectedMonths.length === 0 && noGroupSelected
                      ? `Debe seleccionar al menos un mes y ${groupNoun}`
                      : selectedMonths.length === 0
                      ? 'Debe seleccionar al menos un mes'
                      : `Debe marcar al menos ${groupNoun} en la pestaña Filtros`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filtros de fecha mejorados */}
          <div className="mb-4 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-gray-700">Período de Consulta</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1 text-xs font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2023, 2024, 2025].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-4 gap-1.5">
              {[...Array(12)].map((_, i) => {
                const monthDate = new Date(2000, i, 1);
                const monthShort = format(monthDate, 'MMM', { locale: es });
                const monthFull = format(monthDate, 'MMMM', { locale: es });
                const isSelected = selectedMonths.includes(i + 1);
                
                return (
                  <button
                    key={i + 1}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedMonths(selectedMonths.filter(m => m !== i + 1))
                      } else {
                        setSelectedMonths([...selectedMonths, i + 1])
                      }
                    }}
                    className={`px-1 text-xs font-medium rounded-lg transition-all capitalize ${embedded ? 'min-h-[44px]' : 'py-2'} ${
                      isSelected
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                    title={monthFull}
                  >
                    {monthShort}
                  </button>
                )
              })}
            </div>
            
            {selectedMonths.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {selectedMonths.length} {selectedMonths.length === 1 ? 'mes' : 'meses'} seleccionado{selectedMonths.length === 1 ? '' : 's'}
                </span>
                <button
                  onClick={() => setSelectedMonths([])}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Las visitas siguen el filtro principal de la pestaña Filtros */}
          {groupFilter && (
            <div className="mb-4 border-t pt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{groupFilter.title}</div>
                  <div className="text-xs text-gray-500">{groupSummary}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('filters')}
                  className={`flex-shrink-0 rounded-md px-2 text-xs font-medium text-gray-700 underline underline-offset-2 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${embedded ? 'min-h-[44px]' : 'min-h-[28px]'}`}
                >
                  Cambiar filtro
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Las visitas se muestran solo de las zonas que quedan en el mapa con el filtro.
              </p>
            </div>
          )}

          {/* Estadísticas de visitas (solo con las visitas activadas) */}
          {visitsEnabled && hasValidFilters && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-semibold text-gray-700 mb-3">Resumen de Visitas</h4>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-2 text-xs text-gray-500">Cargando visitas...</span>
                </div>
              ) : error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">Error al cargar: {error.message}</p>
                </div>
              ) : visits && visits.length > 0 ? (
                <div className="space-y-3">
                  {/* Contador principal */}
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 text-white">
                    <div className="text-2xl font-bold">{visits.length}</div>
                    <div className="text-xs opacity-90">Visitas totales</div>
                  </div>
                  
                  {/* Estadísticas detalladas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="text-lg font-semibold text-green-700">
                        {visits.filter(v => v.visit_type === 'Visita efectiva').length}
                      </div>
                      <div className="text-xs text-green-600">Efectivas</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                      <div className="text-lg font-semibold text-purple-700">
                        {visits.filter(v => v.contact_type === 'Visita presencial').length}
                      </div>
                      <div className="text-xs text-purple-600">Presenciales</div>
                    </div>
                  </div>
                  
                  {/* Porcentaje de efectividad */}
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Efectividad</span>
                      <span className="text-xs font-semibold text-gray-900">
                        {Math.round((visits.filter(v => v.visit_type === 'Visita efectiva').length / visits.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(visits.filter(v => v.visit_type === 'Visita efectiva').length / visits.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-xs text-gray-500">No hay visitas en el período seleccionado</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab de Búsqueda */}
      {activeTab === 'search' && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Buscar en el Mapa</h3>
          
          <div className="mb-3">
            <input
              type="text"
              placeholder="Buscar hospital, municipio o departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white ${embedded ? 'h-11' : 'py-2'}`}
            />
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // Centrar mapa en el resultado
                    const zoomLevel = result.type === 'hospital' ? 16 : 
                                    result.type === 'municipality' ? 13 : 
                                    9 // departamento
                    
                    // Navegar al punto usando la nueva función
                    if (onMapNavigate) {
                      onMapNavigate(result.lat, result.lng, zoomLevel)
                    }
                    
                    // Si es un hospital, abrir su tarjeta en el mapa
                    if (result.type === 'hospital' && onHospitalSelect) {
                      onHospitalSelect(result.id)
                    }

                    setIsOpen(false)
                    onSearchSelect?.()
                  }}
                  className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      result.type === 'hospital' ? 'bg-gray-900' : 
                      result.type === 'municipality' ? 'bg-gray-600' : 
                      'bg-gray-400'
                    }`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {result.type === 'hospital' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        ) : result.type === 'municipality' ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        )}
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{result.name}</div>
                      {result.type === 'hospital' && (
                        <>
                          <div className="text-xs text-gray-500">Hospital - Código: {result.code}</div>
                          {result.municipality && (
                            <div className="text-xs text-gray-400">{result.municipality}</div>
                          )}
                        </>
                      )}
                      {result.type === 'municipality' && (
                        <>
                          <div className="text-xs text-gray-500">Municipio - {result.hospitalCount} IPS</div>
                          {result.department && (
                            <div className="text-xs text-gray-400">{result.department}</div>
                          )}
                        </>
                      )}
                      {result.type === 'department' && (
                        <div className="text-xs text-gray-500">Departamento - {result.hospitalCount} IPS</div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {searchTerm.length > 0 && searchTerm.length <= 2 && (
            <div className="text-xs text-gray-500 mt-2">
              Escriba al menos 3 caracteres para buscar
            </div>
          )}

          {searchTerm.length > 2 && searchResults.length === 0 && (
            <div className="text-xs text-gray-500 mt-2">
              No se encontraron resultados
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Móvil: el contenido va dentro de la hoja inferior (sin botón ni panel flotante)
  if (embedded) {
    return (
      <div>
        {tabBar}
        {panelBody}
      </div>
    )
  }

  return (
    <>
      {/* Botón para abrir/cerrar controles (escritorio) */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="fixed bottom-4 right-4 z-[9996] bg-white rounded-xl shadow-lg px-5 py-3 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-gray-100"
        type="button"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
          </svg>
        )}
        <span>{isOpen ? 'Cerrar' : 'Filtros y visitas'}</span>
        {filterChipLabel && (
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">{filterChipLabel}</span>
        )}
      </button>

      {/* Panel de controles */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-[9995] bg-white rounded-2xl shadow-2xl border border-gray-100" style={{ width: 'min(360px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
          {/* Botón de cerrar dentro del panel */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 z-10 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar panel"
            aria-label="Cerrar panel"
            type="button"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          <div className="p-2 pr-12">{tabBar}</div>
          {panelBody}
        </div>
      )}
    </>
  )
}
