'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useVisits } from '@/hooks/useVisits'

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
  onShowContractsChange?: (show: boolean) => void
}

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
  onShowContractsChange
}: MapControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'filters' | 'visits' | 'legend' | 'search'>('filters')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showContracts, setShowContracts] = useState(false)
  
  // Estados para visitas - Tipo de visualización
  const [visualizationType, setVisualizationType] = useState<'heatmap' | 'markers' | 'both'>('heatmap')
  
  // Filtros de período - año con múltiples meses
  const [selectedYear, setSelectedYear] = useState<number>(2025) // Año seleccionado
  const [selectedMonths, setSelectedMonths] = useState<number[]>([7]) // Meses seleccionados (julio por defecto)
  
  // Filtros de contenido
  const [visitTypeFilter, setVisitTypeFilter] = useState('all')
  const [contactTypeFilter, setContactTypeFilter] = useState('all')
  const [selectedKams, setSelectedKams] = useState<string[]>([]) // Vacío = todos los KAMs
  const [availableKams, setAvailableKams] = useState<{id: string, name: string, color: string}[]>([])
  
  // Calcular si las visualizaciones deben mostrarse automáticamente
  const hasValidFilters = selectedMonths.length > 0 && selectedKams.length > 0;
  const showHeatmap = hasValidFilters && (visualizationType === 'heatmap' || visualizationType === 'both');
  const showMarkers = hasValidFilters && (visualizationType === 'markers' || visualizationType === 'both');
  
  // Inicialización del componente
  useEffect(() => {
    console.log('MapControls - Inicialización del componente')
    console.log('- Año inicial: 2025')
    console.log('- Mes inicial: julio (7)')
    console.log('- KAMs: Se cargarán todos por defecto')
  }, [])

  // Debug de estado de filtros
  useEffect(() => {
    console.log('MapControls - Estado de filtros:', {
      año: selectedYear,
      mesesSeleccionados: selectedMonths,
      kamsSeleccionados: selectedKams.length,
      tipoVisita: visitTypeFilter,
      tipoContacto: contactTypeFilter
    })
  }, [selectedMonths, selectedYear, selectedKams, visitTypeFilter, contactTypeFilter])
  
  // Debug - log de los parámetros de búsqueda
  useEffect(() => {
    console.log('MapControls - Estado actualizado:', {
      año: selectedYear,
      meses: selectedMonths,
      kamsCount: selectedKams.length,
      kamsIds: selectedKams
    })
  }, [selectedYear, selectedKams, selectedMonths])

  // Construir queryParams basado en el estado actual de TODOS los filtros
  const queryParams = useMemo(() => {
    // Verificar que haya meses seleccionados
    if (selectedMonths.length === 0) {
      console.log('MapControls - Sin meses seleccionados, NO se hará query')
      return null
    }
    
    // Verificar que haya KAMs seleccionados
    if (selectedKams.length === 0) {
      console.log('MapControls - Sin KAMs seleccionados, NO se hará query')
      return null
    }
    
    // Construir parámetros
    const params: any = {
      months: selectedMonths.sort((a, b) => a - b),
      year: selectedYear
    }
    
    // Agregar filtros de contenido
    params.visitType = visitTypeFilter === 'all' ? undefined : visitTypeFilter
    params.contactType = contactTypeFilter === 'all' ? undefined : contactTypeFilter
    
    // Agregar KAMs seleccionados
    if (selectedKams.length < availableKams.length) {
      // Solo enviar el filtro si no están todos seleccionados
      params.kamIds = selectedKams
    }
    // Si todos los KAMs están seleccionados, no enviar el filtro (mostrar todos)
    
    console.log('MapControls - Query params construidos:', {
      año: params.year,
      meses: params.months?.join(','),
      kams: params.kamIds?.length || 'todos',
      filtros: [params.visitType, params.contactType].filter(Boolean).join(', ') || 'ninguno'
    })
    
    return params
  }, [selectedMonths, selectedYear, visitTypeFilter, contactTypeFilter, selectedKams, availableKams.length])
  
  // Hacer la query solo si hay parámetros válidos
  const { data: visitsData, isLoading, error } = useVisits(queryParams)
  
  // Las visitas son simplemente lo que retorna la query, pero SOLO si hay parámetros válidos
  const visits = queryParams && Array.isArray(visitsData) ? visitsData : []
  
  // Debug del resultado
  useEffect(() => {
    console.log('MapControls - Estado de visitas:', {
      total: visits.length,
      cargando: isLoading,
      error: error?.message,
      hayParametros: !!queryParams,
      mostrandoHeatmap: showHeatmap
    })
  }, [visits.length, isLoading, error, queryParams, showHeatmap])

  // Cargar KAMs disponibles
  useEffect(() => {
    const loadKams = async () => {
      const { data: kams } = await supabase
        .from('kams')
        .select('id, name, color')
        .eq('active', true)
        .order('name')
      
      if (kams) {
        console.log('MapControls - KAMs cargados:', kams.length)
        setAvailableKams(kams)
        
        // Seleccionar TODOS los KAMs por defecto
        const allKamIds = kams.map(k => k.id)
        setSelectedKams(allKamIds)
        console.log('MapControls - Todos los KAMs seleccionados por defecto:', allKamIds.length)
      }
    }
    loadKams()
  }, [])

  // Notificar cambios de visitas al componente padre
  useEffect(() => {
    if (onVisitsChange) {
      // Si no hay parámetros válidos (no hay meses o KAMs seleccionados), enviar array vacío
      if (!queryParams) {
        console.log('MapControls - Limpiando visitas (sin filtros válidos)')
        onVisitsChange([])
      } else {
        console.log('MapControls - Actualizando mapa con', visits.length, 'visitas (con filtros)')
        onVisitsChange(visits)
      }
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

  // Notificar cambios de visualización de contratos
  useEffect(() => {
    if (onShowContractsChange) {
      onShowContractsChange(showContracts)
    }
  }, [showContracts, onShowContractsChange])


  return (
    <>
      {/* Botón moderno para abrir/cerrar controles */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="absolute bottom-4 right-4 z-[9996] bg-white rounded-xl shadow-lg px-5 py-3 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-gray-100"
        type="button"
      >
        {isOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        )}
        <span className="hidden sm:inline">{isOpen ? 'Cerrar' : 'Controles'}</span>
      </button>

      {/* Panel de controles moderno */}
      {isOpen && (
        <div className="absolute bottom-20 right-4 z-[9995] bg-white rounded-2xl shadow-2xl border border-gray-100" style={{ width: '360px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Botón de cerrar dentro del panel */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 z-10 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar panel"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          
          {/* Tabs modernos */}
          <div className="flex p-2 bg-gray-50 rounded-t-2xl">
            <button
              onClick={() => setActiveTab('filters')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'filters' 
                  ? 'bg-white text-gray-900 shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
              </svg>
              Filtros
            </button>
            <button
              onClick={() => setActiveTab('visits')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'visits' 
                  ? 'bg-white text-gray-900 shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              Visitas
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'search' 
                  ? 'bg-white text-gray-900 shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              Buscar
            </button>
            <button
              onClick={() => setActiveTab('legend')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'legend' 
                  ? 'bg-white text-gray-900 shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Leyenda
            </button>
          </div>

          <div className="p-4">
            {/* Tab de Filtros */}
            {activeTab === 'filters' && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Filtros del Mapa</h3>
                
                {/* Filtro de tipo de hospital */}
                <div className="mb-3">
                  <label className="text-xs font-semibold text-gray-700 block mb-2">Tipo de Hospital</label>
                  <select 
                    value={hospitalTypeFilter}
                    onChange={(e) => setHospitalTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
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

                {/* Toggle de Solo Hospitales con Contratos */}
                <div className="mb-3 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700">Solo con Contratos</label>
                    <button
                      onClick={() => setShowContracts(!showContracts)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                        showContracts ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showContracts ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {showContracts && (
                    <div className="mt-2 px-3 py-2 bg-green-50 rounded-lg text-xs text-green-700">
                      <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                      </svg>
                      Mostrando solo hospitales con contratos activos
                    </div>
                  )}
                </div>

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
                          {selectedMonths.length === 0 && selectedKams.length === 0
                            ? 'Debe seleccionar al menos un mes y un KAM'
                            : selectedMonths.length === 0
                            ? 'Debe seleccionar al menos un mes'
                            : 'Debe seleccionar al menos un KAM'
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
                          className={`py-2 px-1 text-xs font-medium rounded-lg transition-all capitalize ${
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

                {/* Filtro de KAMs mejorado */}
                <div className="mb-4 border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-gray-700">Vendedores (KAMs)</label>
                    <button
                      onClick={() => {
                        if (selectedKams.length === availableKams.length) {
                          setSelectedKams([])
                        } else {
                          setSelectedKams(availableKams.map(k => k.id))
                        }
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {selectedKams.length === availableKams.length ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                  </div>
                  
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {availableKams.map(kam => {
                        const isSelected = selectedKams.includes(kam.id);
                        return (
                          <button
                            key={kam.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedKams(selectedKams.filter(k => k !== kam.id))
                              } else {
                                setSelectedKams([...selectedKams, kam.id])
                              }
                            }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-all ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            <span 
                              className="w-3 h-3 rounded-full border-2 flex-shrink-0" 
                              style={{ 
                                backgroundColor: isSelected ? kam.color : 'transparent',
                                borderColor: kam.color 
                              }}
                            />
                            <span className="truncate">{kam.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  
                  {selectedKams.length > 0 && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-600">
                        {selectedKams.length} de {availableKams.length} vendedores
                      </span>
                      {selectedKams.length !== availableKams.length && (
                        <button
                          onClick={() => setSelectedKams([])}
                          className="text-gray-500 hover:text-red-600 transition-colors"
                        >
                          Limpiar selección
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Estadísticas de visitas mejoradas */}
                {hasValidFilters && (
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

            {/* Tab de Leyenda */}
            {activeTab === 'legend' && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Convenciones</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <i className="fa fa-user" style={{ color: '#000', fontSize: '14px' }}></i>
                    <span>KAM (Key Account Manager)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#888',
                      borderRadius: '50%',
                      border: '1px solid #222'
                    }}></span>
                    <span>Institución Prestadora de Salud</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{
                      display: 'inline-block',
                      width: '30px',
                      height: '12px',
                      backgroundColor: '#888',
                      opacity: 0.4,
                      border: '1px solid #333'
                    }}></span>
                    <span>Territorio asignado</span>
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-gray-600">
                    <i className="fa fa-info-circle"></i> Los colores identifican a cada KAM y su zona de cobertura asignada
                  </div>
                </div>

                {/* Leyenda de visitas si están activas */}
                {showMarkers && (
                  <div className="mt-4 pt-3 border-t">
                    <h4 className="text-sm font-semibold mb-2">Tipos de Visita</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-900"></div>
                        <span>Visita efectiva</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                        <span>Visita extra</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                        <span>Visita no efectiva</span>
                      </div>
                    </div>
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
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
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
                          
                          // Si es un hospital, seleccionarlo para mostrar tooltip
                          if (result.type === 'hospital' && onHospitalSelect) {
                            onHospitalSelect(result.id)
                            // Mantener el tooltip visible por 8 segundos
                            setTimeout(() => onHospitalSelect(null), 8000)
                          }
                          
                          setIsOpen(false)
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
        </div>
      )}
    </>
  )
}