'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useVisits } from '@/hooks/useVisits'
import MapSwitch from './MapSwitch'
import MapVista, { type MapVistaConfig } from './MapVista'
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

/** Años del selector de visitas: desde 2024 (VMO tiene visitas desde agosto de 2024) hasta el año en curso. */
const PRIMER_ANIO_VISITAS = 2024
function aniosConVisitas(): number[] {
  const actual = Math.max(new Date().getFullYear(), PRIMER_ANIO_VISITAS)
  return Array.from({ length: actual - PRIMER_ANIO_VISITAS + 1 }, (_, i) => PRIMER_ANIO_VISITAS + i)
}

interface MapControlsProps {
  mapData: any
  hospitalTypeFilter: string
  setHospitalTypeFilter: (value: string) => void
  filteredAssignments: any[]
  filteredUnassignedHospitals: any[]
  onVisitsChange?: (visits: any[]) => void
  onShowHeatmapChange?: (show: boolean) => void
  onShowMarkersChange?: (show: boolean) => void
  // 'floating': botón y panel flotante (escritorio). 'embedded': contenido dentro de la hoja inferior (móvil)
  variant?: 'floating' | 'embedded'
  // Visitas apagadas por defecto: sin consulta ni mapa de calor hasta activarlas
  visitsEnabled?: boolean
  onVisitsEnabledChange?: (enabled: boolean) => void
  // Vista: ver por Ejecutivos Comerciales o Zonas y la línea de negocio (null: sin selector)
  vista?: MapVistaConfig | null
  // "Ver solo" de la leyenda, para los textos de la pestaña Visitas (null: la vista no tiene lista)
  verSolo?: VerSoloResumen | null
  // "Mostrar": capas que se ven
  mostrar?: MapMostrarConfig | null
  // Zonas (kam_id) cuyas visitas se muestran según el filtro; null = todas
  visitKamIds?: string[] | null
  // "IPS filtradas" en el botón flotante cuando el bloque IPS oculta puntos
  filterChipLabel?: string | null
  // Cada cambio abre la pestaña "Filtros" (botón "Filtros" de la hoja inferior)
  filtersTabRequest?: number
  // Fase 3: bloque "IPS" (servicios y capacidad del REPS); oculta los puntos que no cumplen
  ipsServiceFilter?: IpsServiceFilter
  onIpsServiceFilterChange?: (filter: IpsServiceFilter) => void
}

const IPS_FILTER_CHECKS = ['quirofano', 'ortopedia', 'neurocirugia', 'columna'] as const

// "Ver solo" de la leyenda, resumido: personas (vista por línea) o Zonas (vista de zonas) que quedan en el mapa
export interface VerSoloResumen {
  kind: 'executive' | 'zone'
  // null = sin filtro
  marcados: number | null
  total: number
}

// "Mostrar" del panel de Filtros (desde el 2026-10-29 aquí y no en la leyenda)
export interface MapMostrarConfig {
  showIps: boolean
  onShowIps: (value: boolean) => void
  showReach: boolean
  onShowReach: (value: boolean) => void
  // Zonas sin cobertura en la línea e IPS sin Zona ("Sin cobertura e IPS sin Zona"; en la vista de zonas, "IPS sin Zona")
  showVacant: boolean
  onShowVacant: (value: boolean) => void
  vacantLabel: string
  vacantHint: string
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'

export default function MapControls({
  mapData,
  hospitalTypeFilter,
  setHospitalTypeFilter,
  filteredAssignments,
  filteredUnassignedHospitals,
  onVisitsChange,
  onShowHeatmapChange,
  onShowMarkersChange,
  variant = 'floating',
  visitsEnabled = false,
  onVisitsEnabledChange,
  vista = null,
  verSolo = null,
  mostrar = null,
  visitKamIds = null,
  filterChipLabel = null,
  filtersTabRequest = 0,
  ipsServiceFilter = EMPTY_IPS_FILTER,
  onIpsServiceFilterChange
}: MapControlsProps) {
  const embedded = variant === 'embedded'
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'filters' | 'visits'>('filters')
  // Texto de los campos de camas (el filtro solo guarda números válidos)
  const [minBedsText, setMinBedsText] = useState(ipsServiceFilter.minBeds === null ? '' : String(ipsServiceFilter.minBeds))
  const [maxBedsText, setMaxBedsText] = useState(ipsServiceFilter.maxBeds === null ? '' : String(ipsServiceFilter.maxBeds))
  const ipsWithoutReps = useMemo(
    () => (mapData?.hospitals || []).filter((h: any) => !hasRepsData(h)).length,
    [mapData]
  )
  // Sin ningún dato del REPS importado, marcar un servicio dejaría el mapa sin puntos: se desactiva
  const ipsServiceAvailable = useMemo(() => ipsServiceAvailability(mapData?.hospitals), [mapData])
  // Cuántas IPS hay de cada tipo (van en las opciones de "Tipo")
  const ipsPorTipo = useMemo(() => {
    const hospitals: any[] = mapData?.hospitals || []
    return {
      Publico: hospitals.filter(h => h.type === 'Publico').length,
      Privada: hospitals.filter(h => h.type === 'Privada').length,
      Mixta: hospitals.filter(h => h.type === 'Mixta').length,
      sinTipo: hospitals.filter(h => !h.type).length
    }
  }, [mapData])
  const ipsFilterActive = hospitalTypeFilter !== 'all' || isIpsFilterActive(ipsServiceFilter)
  
  // Estados para visitas - Tipo de visualización
  const [visualizationType, setVisualizationType] = useState<'heatmap' | 'markers' | 'both'>('heatmap')
  
  // Filtros de período - año con múltiples meses: por defecto el mes en curso (las visitas de VMO llegan por Excel,
  // lib/vmo-visitas.ts; las de la app, en el día)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear())
  const [selectedMonths, setSelectedMonths] = useState<number[]>(() => [new Date().getMonth() + 1])
  
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


  useEffect(() => {
    if (onShowMarkersChange) {
      onShowMarkersChange(showMarkers)
    }
  }, [showMarkers, onShowMarkersChange])


  // Texto del filtro principal en la pestaña de visitas
  const groupNoun = verSolo?.kind === 'zone' ? 'una Zona' : 'un Ejecutivo Comercial'
  // "todos los Ejecutivos Comerciales (11)" / "1 de 11 Ejecutivos Comerciales"; en la vista de zonas, con Zonas
  const verSoloTexto = !verSolo
    ? ''
    : verSolo.marcados === null
      ? `${verSolo.kind === 'zone' ? 'todas las Zonas' : 'todos los Ejecutivos Comerciales'} (${verSolo.total})`
      : `${verSolo.marcados} de ${verSolo.total} ${verSolo.kind === 'zone' ? 'Zonas' : 'Ejecutivos Comerciales'}`

  const tabs: { id: 'filters' | 'visits'; label: string; icon: string }[] = [
    { id: 'filters', label: 'Filtros', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
    { id: 'visits', label: 'Visitas', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z' }
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
          {/* Vista: ver por Ejecutivos Comerciales o Zonas y la línea de negocio */}
          {vista && (
            <div className="mb-4 pb-4 border-b">
              <MapVista config={vista} touch={embedded} />
            </div>
          )}

          {/* Mostrar: capas que se ven */}
          {mostrar && (
            <div className="mb-4 pb-3 border-b">
              <div className={`${SECTION_TITLE} mb-1`}>Mostrar</div>
              <MapSwitch label="Puntos de IPS" checked={mostrar.showIps} onChange={mostrar.onShowIps} touch={embedded} />
              <MapSwitch label="Municipios de alcance" checked={mostrar.showReach} onChange={mostrar.onShowReach} touch={embedded} />
              <MapSwitch label={mostrar.vacantLabel} hint={mostrar.vacantHint} checked={mostrar.showVacant} onChange={mostrar.onShowVacant} touch={embedded} />
            </div>
          )}

          {/* IPS: tipo, servicios y capacidad del REPS (Fase 3) y camas. Solo ocultan puntos; el territorio no cambia */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className={SECTION_TITLE}>IPS</span>
              {ipsFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setHospitalTypeFilter('all')
                    setMinBedsText('')
                    setMaxBedsText('')
                    onIpsServiceFilterChange?.(EMPTY_IPS_FILTER)
                  }}
                  className="text-xs text-gray-600 underline hover:text-gray-900"
                >
                  Limpiar
                </button>
              )}
            </div>
            <label htmlFor="map-tipo-ips" className="text-xs font-semibold text-gray-700 block mb-1">Tipo</label>
            <select
              id="map-tipo-ips"
              value={hospitalTypeFilter}
              onChange={(e) => setHospitalTypeFilter(e.target.value)}
              className={`w-full px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white ${embedded ? 'h-11' : 'py-2'}`}
            >
              <option value="all">Todas</option>
              <option value="Publico">Públicas ({ipsPorTipo.Publico})</option>
              <option value="Privada">Privadas ({ipsPorTipo.Privada})</option>
              <option value="Mixta">Mixtas ({ipsPorTipo.Mixta})</option>
              <option value="sin_tipo">Sin clasificar ({ipsPorTipo.sinTipo})</option>
            </select>

            {onIpsServiceFilterChange && (
              <>
                <div className="mt-3 mb-1 text-xs font-semibold text-gray-700">Servicios</div>
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
              </>
            )}

            <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700" aria-live="polite">
              {mostrar && !mostrar.showIps
                ? 'Puntos de IPS apagados (en "Mostrar")'
                : `Mostrando ${filteredAssignments.length + filteredUnassignedHospitals.length} IPS en el mapa`}
            </p>
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
                      : `Debe marcar al menos ${groupNoun} en la leyenda`
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
                {aniosConVisitas().map(year => (
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

          {/* Las visitas siguen "Ver solo" de la leyenda */}
          {verSolo && (
            <div className="mb-4 border-t pt-4">
              <div className="text-xs font-semibold text-gray-700">Visitas de {verSoloTexto}</div>
              <p className="mt-1 text-xs text-gray-500">
                Siguen a &quot;Ver solo&quot;: solo las de las Zonas que quedan en el mapa. Para elegir a quién, toca en la
                leyenda.
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
        // Alto máximo: arriba deja libres el buscador y los botones de zoom del mapa (terminan ~138 px bajo el borde de
        // la ventana; abajo van 64 px del botón)
        <div className="fixed bottom-16 right-4 z-[9995] bg-white rounded-2xl shadow-2xl border border-gray-100" style={{ width: 'min(360px, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 212px)', overflowY: 'auto' }}>
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
