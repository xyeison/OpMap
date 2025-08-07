'use client'

import { useState, useEffect } from 'react'
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
  onMapNavigate
}: MapControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'filters' | 'visits' | 'legend' | 'search'>('filters')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  // Estados para visitas - Inicializar con julio 2025 donde hay datos
  // IMPORTANTE: Los meses son 1-based (1=enero, 7=julio, 12=diciembre)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [showMarkers, setShowMarkers] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number>(7) // 7 = Julio (donde están los datos)
  const [selectedYear, setSelectedYear] = useState<number>(2025) // 2025 donde están las visitas
  const [visitTypeFilter, setVisitTypeFilter] = useState('all')
  const [contactTypeFilter, setContactTypeFilter] = useState('all')
  const [multipleMonthsMode, setMultipleMonthsMode] = useState(false)
  const [selectedMonths, setSelectedMonths] = useState<number[]>([7]) // Julio por defecto
  const [selectedKams, setSelectedKams] = useState<string[]>([]) // Vacío para mostrar todas las visitas
  const [availableKams, setAvailableKams] = useState<{id: string, name: string, color: string}[]>([])
  
  // Asegurar que el mes inicial sea julio al montar el componente
  useEffect(() => {
    console.log('MapControls - Inicialización del componente, mes inicial:', selectedMonth, 'año inicial:', selectedYear)
    // Forzar julio 2025 en la inicialización
    if (selectedMonth !== 7 || selectedYear !== 2025) {
      console.log('MapControls - Estableciendo valores iniciales: julio (7) 2025')
      setSelectedMonth(7)
      setSelectedYear(2025)
      setSelectedMonths([7])
    }
  }, [])

  // Cargar visitas con filtros - corregido para manejar múltiples meses correctamente
  // Si está en modo múltiple y no hay meses seleccionados, no cargar visitas
  const shouldLoadVisits = !multipleMonthsMode || (multipleMonthsMode && selectedMonths.length > 0)
  
  // Debug
  useEffect(() => {
    if (multipleMonthsMode) {
      console.log('MapControls - Modo múltiple activado, meses seleccionados:', selectedMonths)
    }
  }, [multipleMonthsMode, selectedMonths])
  
  // Debug - log de los parámetros de búsqueda
  useEffect(() => {
    console.log('MapControls - Parámetros actuales de búsqueda:', {
      selectedMonth,
      selectedYear,
      selectedKams: selectedKams.length,
      multipleMonthsMode,
      selectedMonths,
      kamIds: selectedKams
    })
  }, [selectedMonth, selectedYear, selectedKams, multipleMonthsMode, selectedMonths])

  const queryParams = {
    month: multipleMonthsMode ? undefined : selectedMonth,
    months: multipleMonthsMode && selectedMonths.length > 0 ? selectedMonths.sort((a, b) => a - b) : undefined,
    year: selectedYear,
    visitType: visitTypeFilter === 'all' ? undefined : visitTypeFilter,
    contactType: contactTypeFilter === 'all' ? undefined : contactTypeFilter,
    kamIds: selectedKams.length > 0 ? selectedKams : undefined // Si no hay KAMs seleccionados, no filtrar por KAM
  }
  
  // Debug de los parámetros de la query
  useEffect(() => {
    console.log('MapControls - Query params para useVisits:', queryParams)
  }, [JSON.stringify(queryParams)])
  
  const { data: visitsData, isLoading, error } = useVisits(queryParams)
  
  // Solo usar las visitas si deberíamos cargarlas
  const visits = shouldLoadVisits ? (visitsData || []) : []
  
  // Debug del resultado
  useEffect(() => {
    console.log('MapControls - Resultado de visitas:', {
      shouldLoadVisits,
      isLoading,
      error: error?.message || null,
      visitsDataLength: visitsData?.length || 0,
      visitsLength: visits.length,
      showHeatmap,
      primeras3: visits?.slice(0, 3)
    })
  }, [shouldLoadVisits, isLoading, error, visitsData, visits, showHeatmap])

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
        
        // NO seleccionar KAMs por defecto - dejar que el usuario los seleccione
        // Esto permite que la consulta inicial no filtre por KAMs
        setSelectedKams([])
        console.log('MapControls - Iniciando sin KAMs seleccionados para mostrar todas las visitas')
      }
    }
    loadKams()
  }, [])

  // Notificar cambios de visitas
  useEffect(() => {
    console.log('MapControls - Notificando cambio de visitas:', {
      cantidad: visits?.length || 0,
      tiene_onVisitsChange: !!onVisitsChange,
      primeras_3: visits?.slice(0, 3)
    })
    if (onVisitsChange && visits) {
      onVisitsChange(visits)
    }
  }, [visits, onVisitsChange])

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

  // Manejar cambio de modo múltiples meses
  const handleMultipleMonthsModeChange = (enabled: boolean) => {
    setMultipleMonthsMode(enabled)
    if (!enabled) {
      // Al desactivar modo múltiple, volver al mes actual
      setSelectedMonths([selectedMonth])
    } else if (selectedMonths.length === 0) {
      // Al activar, si no hay meses seleccionados, seleccionar el actual
      setSelectedMonths([selectedMonth])
    }
  }

  return (
    <>
      {/* Botón moderno para abrir/cerrar controles */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="absolute top-4 right-4 z-[9996] bg-white rounded-xl shadow-lg px-5 py-3 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm font-medium border border-gray-100"
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
        <div className="absolute top-20 right-4 z-[9995] bg-white rounded-2xl shadow-2xl border border-gray-100" style={{ width: '360px', maxHeight: '80vh', overflowY: 'auto' }}>
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
                <h3 className="text-sm font-semibold mb-3">Control de Visitas</h3>
                
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

                {/* Modo de selección de meses */}
                <div className="mb-3 pb-3 border-b">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={multipleMonthsMode}
                      onChange={(e) => handleMultipleMonthsModeChange(e.target.checked)}
                      className="mr-2"
                    />
                    Seleccionar múltiples meses
                  </label>
                </div>

                {/* Filtros de fecha */}
                {!multipleMonthsMode ? (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Mes</label>
                      <select
                        value={String(selectedMonth)}
                        onChange={(e) => {
                          const month = Number(e.target.value)
                          console.log('MapControls - Cambiando mes de', selectedMonth, 'a', month)
                          setSelectedMonth(month)
                          setSelectedMonths([month])
                        }}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        {[...Array(12)].map((_, i) => {
                          const monthValue = i + 1
                          return (
                            <option key={monthValue} value={String(monthValue)}>
                              {format(new Date(2000, i, 1), 'MMMM', { locale: es })}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Año</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        {[2023, 2024, 2025].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-700 mb-1 block">
                      Meses seleccionados ({selectedMonths.length})
                      {selectedMonths.length === 0 && (
                        <span className="text-red-500 ml-1">(Seleccione al menos un mes)</span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[...Array(12)].map((_, i) => (
                        <label key={i + 1} className="flex items-center text-xs">
                          <input
                            type="checkbox"
                            checked={selectedMonths.includes(i + 1)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMonths([...selectedMonths, i + 1])
                              } else {
                                const newMonths = selectedMonths.filter(m => m !== i + 1)
                                setSelectedMonths(newMonths.length > 0 ? newMonths : [])
                              }
                            }}
                            className="mr-1"
                          />
                          {format(new Date(2000, i, 1), 'MMM', { locale: es })}
                        </label>
                      ))}
                    </div>
                    {selectedMonths.length === 0 && (
                      <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded text-xs text-gray-700">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                        </svg>
                        No se mostrarán visitas hasta seleccionar al menos un mes
                      </div>
                    )}
                    <div className="mt-2">
                      <label className="text-xs font-medium text-gray-700">Año</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border rounded"
                      >
                        {[2023, 2024, 2025].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Filtro de KAMs */}
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    KAMs a mostrar
                    <button
                      onClick={() => {
                        if (selectedKams.length === 0) {
                          // Si no hay ninguno, seleccionar solo los que tienen visitas
                          const kamsWithVisits = ['11dae2e2-b01e-43b4-a927-62aa994d25b7', 'f44b0557-1c17-41b9-ac66-f1ef5d23d75c', '1b2f89c9-4709-4764-afc2-36a7faafe609', 'ef69d4fa-63cb-474c-964f-33aa323dc5c9', '3ce353cc-64d0-454e-9017-e78e20a1ea59', '0422850d-2cb9-4099-b8e0-010d5dfb15ee', '247f8e1a-c9c9-4e15-9f3b-25dbf46f439c']
                          setSelectedKams(kamsWithVisits.filter(id => availableKams.some(k => k.id === id)))
                        } else {
                          // Si hay alguno seleccionado, deseleccionar todos
                          setSelectedKams([])
                        }
                      }}
                      className="ml-2 text-gray-700 hover:text-black font-medium"
                    >
                      ({selectedKams.length === 0 ? 'Mostrar todos' : `${selectedKams.length} seleccionados`})
                    </button>
                  </label>
                  <div className="max-h-24 overflow-y-auto border rounded p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {availableKams.map(kam => {
                        // KAMs que tienen visitas en julio 2025
                        const kamsWithVisitsJuly2025 = ['11dae2e2-b01e-43b4-a927-62aa994d25b7', 'f44b0557-1c17-41b9-ac66-f1ef5d23d75c', '1b2f89c9-4709-4764-afc2-36a7faafe609', 'ef69d4fa-63cb-474c-964f-33aa323dc5c9', '3ce353cc-64d0-454e-9017-e78e20a1ea59', '0422850d-2cb9-4099-b8e0-010d5dfb15ee', '247f8e1a-c9c9-4e15-9f3b-25dbf46f439c']
                        const hasVisits = kamsWithVisitsJuly2025.includes(kam.id)
                        
                        return (
                          <label key={kam.id} className={`flex items-center text-xs ${!hasVisits ? 'opacity-50' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedKams.includes(kam.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedKams([...selectedKams, kam.id])
                                } else {
                                  setSelectedKams(selectedKams.filter(k => k !== kam.id))
                                }
                              }}
                              className="mr-1"
                            />
                            <span 
                              className="w-2 h-2 rounded-full mr-1" 
                              style={{ backgroundColor: kam.color }}
                            />
                            {kam.name}
                            {hasVisits && <span className="ml-1 text-green-600">●</span>}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Estadísticas de visitas */}
                <div className="mt-3 pt-3 border-t text-xs text-gray-600">
                  {isLoading ? (
                    <p className="text-gray-500">Cargando visitas...</p>
                  ) : error ? (
                    <p className="text-red-500">Error: {error.message}</p>
                  ) : (
                    <>
                      <p>Total visitas: <strong className="text-gray-900">{visits ? visits.length : 0}</strong></p>
                      <p>Efectivas: <strong className="text-gray-800">
                        {visits ? visits.filter(v => v.visit_type === 'Visita efectiva').length : 0}
                      </strong></p>
                      <p>Presenciales: <strong className="text-gray-800">
                        {visits ? visits.filter(v => v.contact_type === 'Visita presencial').length : 0}
                      </strong></p>
                      {visits?.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          Filtros: {selectedMonth}/{selectedYear}, {selectedKams.length} KAMs
                        </p>
                      )}
                    </>
                  )}
                </div>
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