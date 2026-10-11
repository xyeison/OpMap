'use client'

import { MapContainer, TileLayer, GeoJSON, CircleMarker, Marker, Tooltip, ZoomControl } from 'react-leaflet'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { VisitsHeatmapLayer } from './VisitsHeatmapLayer'
import { formatTravelTimeFromSeconds, formatTravelTime } from '@/lib/format-utils'
import MapControls, { OUT_OF_REACH_COLOR, NO_ROAD_COLOR, PENDING_FILL_COLOR, PENDING_BORDER_COLOR } from './MapControls'
import MapController from './MapController'
import HospitalMarker, { formatZoneExecutives } from './HospitalMarker'
import { zoneDisplayName } from '@/lib/zone-names'
import { computeTerritoryWinners, territoryIdOf } from '@/lib/territory-rules'
// NO usar estimaciones - solo datos reales de Google Maps

// Fix for default markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Font Awesome CDN for icons
if (typeof window !== 'undefined' && !document.querySelector('link[href*="fontawesome"]')) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.2.0/css/all.min.css'
  document.head.appendChild(link)
}

// Add CSS for custom zone markers
if (typeof window !== 'undefined' && !document.querySelector('#custom-kam-marker-styles')) {
  const style = document.createElement('style')
  style.id = 'custom-kam-marker-styles'
  style.innerHTML = `
    .custom-kam-marker {
      cursor: pointer !important;
      pointer-events: auto !important;
    }
    .custom-kam-marker:hover {
      z-index: 10000 !important;
    }
  `
  document.head.appendChild(style)
}

// Mapa base configurable. CARTO ya no sirve tiles sin API key (devuelve un PNG "API KEY REQUIRED"
// con HTTP 200), así que por defecto se usa Esri World Light Gray Base, de estética clara similar.
const DEFAULT_BASEMAP_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
const BASEMAP_URL = process.env.NEXT_PUBLIC_BASEMAP_URL || DEFAULT_BASEMAP_URL
const BASEMAP_ATTRIBUTION = process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION || 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
// El servicio de Esri solo tiene tiles nativos hasta z16; por encima se reescalan en vez de fallar
const BASEMAP_MAX_NATIVE_ZOOM = BASEMAP_URL === DEFAULT_BASEMAP_URL ? 16 : undefined

// Escapa cualquier valor antes de interpolarlo en HTML construido con template strings
// (popups de Leaflet, divIcon). Evita XSS con datos editables como nombres de proveedor.
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]!)

// Solo se aceptan colores hexadecimales de 6 dígitos (#RRGGBB); cualquier otro valor usa el respaldo
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const isSafeColor = (v: unknown): v is string => typeof v === 'string' && HEX_COLOR_RE.test(v)
const safeColor = (v: unknown, fallback = '#888888') => (isSafeColor(v) ? v : fallback)

// Error HTTP de /api/map/data con el código de estado, para distinguir sesión caducada (401)
class MapDataError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Colores de respaldo para zonas sin color definido en la base de datos
const BACKUP_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#8B4513', '#1DD1A1', '#FF7675',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00D2D3',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'
]

// ---------- Mapa por línea de negocio (Fase 2) ----------

// Línea que el usuario puede ver (forma de /api/me/lines)
export interface MapLine {
  id: string
  code: string
  name: string
  role: 'leader' | 'executive' | 'all'
}

// 'line': territorios coloreados por el Ejecutivo Comercial que cubre la zona en la línea elegida.
// 'zones': vista anterior, colores por zona (solo quien ve todas las líneas).
export type MapMode = 'line' | 'zones'

export type CoverageKind = 'local' | 'reach' | 'manual' | 'vacant' | 'conflict'

export interface CoverageExecutive {
  id: string
  full_name: string
  status: string
  color: string | null
}

// Fila de cobertura (misma forma que GET /api/coverage, más override_reason)
export interface CoverageRow {
  kam_id: string
  zone_name: string
  base_city: string | null
  kind: CoverageKind
  executive: CoverageExecutive | null
  travel_minutes: number | null
  source_kam_id: string | null
  nearest: { executive_id: string; full_name: string; minutes: number | null } | null
  has_equipment: boolean
  note: string | null
  override_reason?: string | null
}

// Colores fijos del modo por línea
export const VACANT_COLOR = '#9ca3af'
export const CONFLICT_COLOR = '#f59e0b'
const NO_COVERAGE_DATA_COLOR = '#cccccc'

// Respaldo si un Ejecutivo Comercial aún no tiene color guardado (executives.color)
const EXECUTIVE_FALLBACK_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#0891b2', '#db2777', '#65a30d',
  '#7c3aed', '#1e3a8a', '#0d9488', '#be123c', '#4f46e5', '#a16207'
]

// Patrón rayado de "sin equipo": un <pattern> SVG por color (id derivado del hex ya validado)
const noEquipmentPatternId = (hex: string) => `opmap-sin-equipo-${hex.slice(1).toLowerCase()}`

// 135 → "2 h 15"; 45 → "45 min"
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return 'tiempo sin calcular'
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60}`
}

const executiveName = (e: { full_name: string; status?: string } | null | undefined) =>
  e ? (e.status === 'placeholder' ? `${e.full_name} (por contratar)` : e.full_name) : ''

/**
 * Texto plano de quién cubre la zona en la línea. Quien lo inserte en HTML crudo debe escaparlo.
 * "<nombre> — local" | "— por alcance desde <zona>, 2 h 26" | "— ajuste manual: <motivo>" |
 * "Vacante (más cercana: <nombre> a 4 h 39)" | "Conflicto: <nombres>"
 */
export const describeCoverage = (row: CoverageRow | undefined, zoneNameById: Record<string, string>): string => {
  if (!row) return 'sin datos de cobertura (recalcular cobertura)'
  switch (row.kind) {
    case 'local':
      return `${executiveName(row.executive)} — local`
    case 'reach': {
      const from = zoneDisplayName(row.source_kam_id ? zoneNameById[row.source_kam_id] : '') || 'otra zona'
      return `${executiveName(row.executive)} — por alcance desde ${from}, ${formatMinutes(row.travel_minutes)}`
    }
    case 'manual':
      return `${executiveName(row.executive)} — ajuste manual: ${row.override_reason || row.note || 'sin motivo registrado'}`
    case 'vacant':
      return row.nearest
        ? `Vacante (más cercana: ${row.nearest.full_name} a ${formatMinutes(row.nearest.minutes)})`
        : 'Vacante (nadie lleva esta línea)'
    case 'conflict':
      return `Conflicto: ${row.note || 'varios Ejecutivos Comerciales locales'}`
    default:
      return 'sin datos de cobertura'
  }
}

// ---------- Capa completa de municipios y localidades (Fase 2b) ----------

// Polígonos estáticos generados por scripts/build-geojson.ts (properties = { code, name, dept }).
// Se descargan una sola vez; el navegador los revalida con ETag (sin las ~163 peticiones a /api/geojson).
const GEO_MUNICIPIOS_URL = '/geo/municipios.json'
const GEO_LOCALIDADES_URL = '/geo/localidades.json'

// Tipo de municipio según municipality_zone (contrato de GET /api/municipality-coverage)
export type MunicipalityKind = 'ips' | 'reach' | 'out_of_reach' | 'no_road' | 'pending'

export interface MunicipalityZoneRow {
  code: string
  name: string
  department_code: string
  kam_id: string | null
  kind: MunicipalityKind
  travel_minutes: number | null
  nearest_kam_id: string | null
  nearest_minutes: number | null
  ips_count: number
}

// Cómo se pinta cada polígono. 'vacant' = solo IPS sin asignar (estilo de siempre: gris con borde rojo).
type TerritoryKind = 'ips' | 'vacant' | 'reach' | 'out_of_reach' | 'no_road' | 'pending'

interface ResolvedTerritory {
  kind: TerritoryKind
  kamId?: string
  isVacant: boolean
  row?: MunicipalityZoneRow
}


// Leyenda de la capa de municipios (la pinta MapControls)
export interface TerritoryLegend {
  ips: number
  reach: number
  outOfReach: number
  noRoad: number
  pending: number
  // GET /api/municipality-coverage aún sin filas (antes de aplicar 0500 y correr el script)
  noMunicipalityData: boolean
  // /geo/*.json no se pudo cargar
  geoError: boolean
}

interface MapComponentProps {
  visits?: any[]
  showHeatmap?: boolean
  showMarkers?: boolean
  viewMode?: 'kams' | 'zones'
  selectedZoneId?: string | null
  onViewModeChange?: (mode: 'kams' | 'zones') => void
  // Mapa por línea
  lines?: MapLine[]
  selectedLineCode?: string | null
  onLineChange?: (code: string) => void
  canSeeAllLines?: boolean
  mapMode?: MapMode
  onMapModeChange?: (mode: MapMode) => void
}

export default function MapComponent({
  visits: initialVisits = [],
  showHeatmap: initialShowHeatmap = false,
  showMarkers: initialShowMarkers = false,
  viewMode = 'kams',
  selectedZoneId = null,
  onViewModeChange,
  lines = [],
  selectedLineCode = null,
  onLineChange,
  canSeeAllLines = false,
  mapMode = 'line',
  onMapModeChange
}: MapComponentProps) {
  const router = useRouter()
  const [kamColors, setKamColors] = useState<Record<string, string>>({})
  const [zoneColors, setZoneColors] = useState<Record<string, string>>({})
  const [unassignedTravelTimes, setUnassignedTravelTimes] = useState<Record<string, any[]>>({})
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<string>('all') // 'all', 'Publico', 'Privada', 'Mixta'
  const [visits, setVisits] = useState(initialVisits)
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap)
  const [showMarkers, setShowMarkers] = useState(initialShowMarkers)
  const [showContracts, setShowContracts] = useState(false)
  const [zones, setZones] = useState<any[]>([])
  const [zoneAssignments, setZoneAssignments] = useState<Record<string, string>>({})
  
  // Debug de visitas
  useEffect(() => {
    console.log('MapComponent - Visitas actualizadas:', {
      cantidad: visits?.length || 0,
      showHeatmap,
      primeras_3: visits?.slice(0, 3)
    })
  }, [visits, showHeatmap])
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined)
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined)
  
  // Cargar datos desde el API
  const { data: mapData, isLoading, isError, error: mapDataError, refetch, isFetching } = useQuery({
    queryKey: ['map-data', selectedLineCode],
    queryFn: async () => {
      // Con línea elegida la respuesta incluye la cobertura de esa línea (coverage + executives)
      const url = selectedLineCode
        ? `/api/map/data?line=${encodeURIComponent(selectedLineCode)}`
        : '/api/map/data'
      const response = await fetch(url)
      if (!response.ok) {
        throw new MapDataError('Error al cargar datos del mapa', response.status)
      }
      const data = await response.json()
      console.log('Map data received:', {
        kams: data.kams?.length || 0,
        assignments: data.assignments?.length || 0,
        hospitals: data.hospitals?.length || 0,
        unassignedHospitals: data.unassignedHospitals?.length || 0
      })
      return data
    },
    // Al cambiar de línea se conserva el mapa anterior mientras llega la nueva cobertura
    placeholderData: keepPreviousData,
    // Con sesión caducada (401) o sin acceso a la línea (403) no tiene sentido reintentar
    retry: (failureCount, error) =>
      !(error instanceof MapDataError && (error.status === 401 || error.status === 403)) && failureCount < 2
  })

  const isUnauthorized = mapDataError instanceof MapDataError && mapDataError.status === 401

  // Sesión caducada o inexistente: llevar al login
  useEffect(() => {
    if (isUnauthorized) {
      router.replace('/login')
    }
  }, [isUnauthorized, router])

  // Aviso no bloqueante si el proveedor del mapa base falla (se registra una sola vez)
  const [basemapError, setBasemapError] = useState(false)
  const basemapErrorLogged = useRef(false)
  const handleTileError = () => {
    if (basemapErrorLogged.current) return
    basemapErrorLogged.current = true
    console.error('No se pudo cargar el mapa base desde', BASEMAP_URL)
    setBasemapError(true)
  }

  // Asignar colores a KAMs desde la base de datos
  useEffect(() => {
    if (!mapData) return

    const colors: Record<string, string> = {}
    let backupIdx = 0

    mapData.kams.forEach((kam: any) => {
      // Usar el color del KAM desde la base de datos (solo si es un #RRGGBB válido)
      if (isSafeColor(kam.color)) {
        colors[kam.id] = kam.color
      } else {
        // Usar color de respaldo si no tiene color definido
        colors[kam.id] = BACKUP_COLORS[backupIdx % BACKUP_COLORS.length]
        backupIdx++
      }
    })

    setKamColors(colors)
  }, [mapData])

  // Cargar datos de zonas cuando viewMode es 'zones'
  useEffect(() => {
    if (viewMode !== 'zones' || !mapData) return

    const loadZonesData = async () => {
      try {
        // Cargar zonas
        const zonesResponse = await fetch('/api/zones')
        if (!zonesResponse.ok) {
          throw new Error(`Error ${zonesResponse.status} al cargar zonas`)
        }
        const zonesData = await zonesResponse.json()
        const zonesList: any[] = Array.isArray(zonesData) ? zonesData : []
        setZones(zonesList)

        // Asignar colores a zonas (solo #RRGGBB válidos)
        const colors: Record<string, string> = {}
        zonesList.forEach((zone: any) => {
          if (isSafeColor(zone.color)) {
            colors[zone.id] = zone.color
          }
        })
        setZoneColors(colors)

        // Mapa de KAM a zona: /api/map/data ya incluye zone_id de cada KAM
        const kamToZone: Record<string, string> = {}
        for (const kam of mapData.kams) {
          if (kam.zone_id) {
            kamToZone[kam.id] = kam.zone_id
          }
        }

        // Ahora, para cada territorio asignado, buscar la zona del KAM
        const territoryToZone: Record<string, string> = {}
        mapData.assignments.forEach((assignment: any) => {
          const kamId = assignment.kams.id
          const hospital = assignment.hospitals
          const territoryId = hospital.locality_id || hospital.municipality_id

          if (territoryId && kamToZone[kamId]) {
            territoryToZone[territoryId] = kamToZone[kamId]
          }
        })

        setZoneAssignments(territoryToZone)
      } catch (error) {
        console.error('Error loading zones data:', error)
      }
    }

    loadZonesData()
  }, [viewMode, mapData])

  // Cargar tiempos de viaje REALES para hospitales sin asignar (una sola vez: no dependen de la línea)
  const unassignedTimesRequested = useRef(false)
  useEffect(() => {
    if (!mapData || mapData.unassignedHospitals.length === 0) return
    if (unassignedTimesRequested.current) return
    unassignedTimesRequested.current = true

    const fetchUnassignedTravelTimes = async () => {
      try {
        console.log('🚀 MapComponent: Iniciando carga de tiempos para hospitales sin asignar...')
        console.log('📊 MapComponent: Total hospitales sin asignar en mapData:', mapData.unassignedHospitals.length)
        
        // Usar la API optimizada con la nueva tabla hospital_kam_distances
        const response = await fetch('/api/travel-times/unassigned-optimized')
        if (response.ok) {
          const data = await response.json()
          const timesMap: Record<string, any[]> = {}
          
          console.log('✅ MapComponent: Respuesta recibida del API')
          console.log('📊 MapComponent: Hospitales con datos:', data.unassigned_hospitals?.length || 0)
          console.log('🔍 MapComponent: Debug info del API:', data.debug)
          
          let hospitalsWithTravelTimes = 0
          
          data.unassigned_hospitals?.forEach((hospital: any) => {
            if (hospital.travel_times && hospital.travel_times.length > 0) {
              timesMap[hospital.id] = hospital.travel_times
              hospitalsWithTravelTimes++
            }
          })
          
          console.log(`✨ MapComponent: ${hospitalsWithTravelTimes} hospitales tienen tiempos de viaje`)
          console.log('📝 MapComponent: Ejemplo de hospital con tiempos:', Object.keys(timesMap)[0], timesMap[Object.keys(timesMap)[0]]?.slice(0, 3))
          
          setUnassignedTravelTimes(timesMap)
        } else {
          console.error('Failed to fetch travel times:', response.status, await response.text())
        }
      } catch (error) {
        console.error('Error fetching unassigned travel times:', error)
      }
    }

    fetchUnassignedTravelTimes()
  }, [mapData])

  // Polígonos de TODOS los municipios y localidades: una sola descarga por sesión (no dependen de la línea)
  const geoQueryOptions = {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1
  } as const
  const { data: municipiosGeo, isError: municipiosGeoError } = useQuery({
    queryKey: ['geo', 'municipios'],
    queryFn: async () => {
      const res = await fetch(GEO_MUNICIPIOS_URL)
      if (!res.ok) throw new Error(`Error ${res.status} al cargar ${GEO_MUNICIPIOS_URL}`)
      return res.json()
    },
    ...geoQueryOptions
  })
  const { data: localidadesGeo, isError: localidadesGeoError } = useQuery({
    queryKey: ['geo', 'localidades'],
    queryFn: async () => {
      const res = await fetch(GEO_LOCALIDADES_URL)
      if (!res.ok) throw new Error(`Error ${res.status} al cargar ${GEO_LOCALIDADES_URL}`)
      return res.json()
    },
    ...geoQueryOptions
  })

  // Reparto de municipios sin IPS por tiempo real de carretera (municipality_zone). Mientras la tabla
  // no exista o no tenga filas, la respuesta se trata como vacía y esos municipios quedan 'pending'.
  const { data: municipalityRows = [] } = useQuery<MunicipalityZoneRow[]>({
    queryKey: ['municipality-coverage'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/municipality-coverage')
        if (!res.ok) {
          console.warn(`/api/municipality-coverage respondió ${res.status}; municipios sin IPS como pendientes`)
          return []
        }
        const body = await res.json()
        return Array.isArray(body?.rows) ? body.rows : []
      } catch (error) {
        console.warn('No se pudo cargar /api/municipality-coverage:', error)
        return []
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  })

  const municipalityByCode = useMemo(() => {
    const byCode: Record<string, MunicipalityZoneRow> = {}
    municipalityRows.forEach(r => {
      if (r && typeof r.code === 'string') byCode[r.code] = r
    })
    return byCode
  }, [municipalityRows])

  // Territorios con IPS (localidad en Bogotá, municipio en el resto) y su zona ganadora por mayoría de
  // CAMAS. Misma función pura que usa el motor de municipios (lib/territory-rules.ts): más camas,
  // luego más IPS, luego nombre de zona y kam_id (desempate determinista).
  const territoryAnalysis = useMemo(() => {
    const territoriesWithIps = new Set<string>()
    const vacantTerritories = new Set<string>()
    const territoryWinners: Record<string, string> = {}
    if (!mapData) return { territoriesWithIps, vacantTerritories, territoryWinners }

    mapData.unassignedHospitals.forEach((hospital: any) => {
      const territoryId = territoryIdOf(hospital)
      if (territoryId) vacantTerritories.add(territoryId)
    })

    const zoneNames: Record<string, string> = {}
    ;(mapData.kams || []).forEach((k: any) => { zoneNames[k.id] = zoneDisplayName(k.name) })
    const votes: { kam_id: string; beds: number | null; territory: string | null }[] = []
    mapData.assignments.forEach((assignment: any) => {
      const kamId = assignment.kams?.id
      if (!kamId) return
      if (!zoneNames[kamId]) zoneNames[kamId] = zoneDisplayName(assignment.kams.name)
      const territory = territoryIdOf(assignment.hospitals || {})
      if (territory) territoriesWithIps.add(territory)
      votes.push({ kam_id: kamId, beds: assignment.hospitals?.beds ?? null, territory })
    })

    computeTerritoryWinners(votes, v => v.territory, kamId => zoneNames[kamId] ?? null)
      .forEach((winner, territory) => { territoryWinners[territory] = winner.kam_id })

    return { territoriesWithIps, vacantTerritories, territoryWinners }
  }, [mapData])

  // Zonas por id y zona residente por localidad (kams.area_id de 7 dígitos)
  const kamIndex = useMemo(() => {
    const byId: Record<string, any> = {}
    const residentByArea: Record<string, string> = {}
    const toRegion: Record<string, string> = {}
    ;(mapData?.kams || []).forEach((k: any) => {
      byId[k.id] = k
      if (k.area_id && !residentByArea[k.area_id]) residentByArea[k.area_id] = k.id
      if (k.zone_id) toRegion[k.id] = k.zone_id
    })
    return { byId, residentByArea, toRegion }
  }, [mapData])

  // Nombre de departamento por código (sale de las IPS; solo para el encabezado del tooltip)
  const departmentNames = useMemo(() => {
    const names: Record<string, string> = {}
    ;(mapData?.hospitals || []).forEach((h: any) => {
      if (h.department_id && h.department_name && !names[h.department_id]) names[h.department_id] = h.department_name
    })
    return names
  }, [mapData])

  // Tipo de cada polígono: las IPS asignadas mandan (regla de siempre); sin IPS, municipality_zone.
  const resolveTerritory = useCallback((code: string, isLocality: boolean): ResolvedTerritory => {
    const { territoriesWithIps, vacantTerritories, territoryWinners } = territoryAnalysis
    const isVacant = vacantTerritories.has(code)
    if (territoriesWithIps.has(code)) return { kind: 'ips', kamId: territoryWinners[code], isVacant }
    if (isVacant) return { kind: 'vacant', isVacant }
    if (isLocality) {
      // Localidad sin IPS: solo se atribuye a la zona que vive en ella (territorio base);
      // no hay tiempo por carretera calculado para localidades, así que el resto queda pendiente.
      const resident = kamIndex.residentByArea[code]
      return resident ? { kind: 'reach', kamId: resident, isVacant } : { kind: 'pending', isVacant }
    }
    const row = municipalityByCode[code]
    if (!row) return { kind: 'pending', isVacant }
    if ((row.kind === 'reach' || row.kind === 'ips') && row.kam_id) {
      // 'ips' sin IPS asignadas en el mapa = fila desactualizada: se muestra como alcance de esa zona
      return { kind: 'reach', kamId: row.kam_id, isVacant, row }
    }
    if (row.kind === 'out_of_reach' || row.kind === 'no_road') return { kind: row.kind, isVacant, row }
    return { kind: 'pending', isVacant, row }
  }, [territoryAnalysis, kamIndex, municipalityByCode])

  // ---------- Datos derivados del modo por línea ----------
  // Renderizador SVG solo para territorios "sin equipo": el patrón rayado (fill url(#...)) no existe en canvas
  const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), [])

  const lineView = useMemo(() => {
    const coverage = mapData?.coverage
    if (!coverage || !Array.isArray(coverage.rows)) return null
    const rows: CoverageRow[] = coverage.rows
    const executives: CoverageExecutive[] = Array.isArray(mapData?.executives) ? mapData.executives : []

    // Color por Ejecutivo Comercial: el guardado si es #RRGGBB válido; si no, uno de respaldo estable
    const executiveColors: Record<string, string> = {}
    let fallbackIdx = 0
    const assignColor = (e: CoverageExecutive | null | undefined) => {
      if (!e || executiveColors[e.id]) return
      if (isSafeColor(e.color)) {
        executiveColors[e.id] = e.color
      } else {
        executiveColors[e.id] = EXECUTIVE_FALLBACK_COLORS[fallbackIdx % EXECUTIVE_FALLBACK_COLORS.length]
        fallbackIdx++
      }
    }
    executives.forEach(assignColor)
    rows.forEach(r => assignColor(r.executive))

    const byKam: Record<string, CoverageRow> = {}
    const zoneNameById: Record<string, string> = {}
    rows.forEach(r => {
      byKam[r.kam_id] = r
      if (r.zone_name) zoneNameById[r.kam_id] = r.zone_name
    })
    ;(mapData?.kams || []).forEach((k: any) => {
      if (!zoneNameById[k.id]) zoneNameById[k.id] = k.name
    })

    // Conteos para la leyenda
    const zonesByExecutive: Record<string, number> = {}
    let vacant = 0
    let conflict = 0
    let noEquipment = 0
    rows.forEach(r => {
      if (r.kind === 'vacant') vacant++
      else if (r.kind === 'conflict') conflict++
      else if (r.executive) zonesByExecutive[r.executive.id] = (zonesByExecutive[r.executive.id] || 0) + 1
      if (!r.has_equipment) noEquipment++
    })

    return {
      line: coverage.line as { id: string; code: string; name: string; max_reach_minutes: number },
      rows,
      executives,
      executiveColors,
      byKam,
      zoneNameById,
      counts: { zonesByExecutive, vacant, conflict, noEquipment }
    }
  }, [mapData])

  // Modo por línea activo: hay cobertura cargada y no se eligió la vista "Zonas"
  const isLineMode = mapMode === 'line' && !!lineView

  // Color de la zona en la línea: Ejecutivo Comercial que la cubre, vacante (gris) o conflicto (ámbar)
  const zoneLineColor = useCallback((kamId: string | undefined): string => {
    if (!lineView || !kamId) return NO_COVERAGE_DATA_COLOR
    const row = lineView.byKam[kamId]
    if (!row) return NO_COVERAGE_DATA_COLOR
    if (row.kind === 'vacant') return VACANT_COLOR
    if (row.kind === 'conflict') return CONFLICT_COLOR
    return row.executive ? safeColor(lineView.executiveColors[row.executive.id]) : VACANT_COLOR
  }, [lineView])

  // ---------- Estilo de la capa completa de municipios y localidades ----------

  // Zona sin equipo en la línea elegida (solo aplica a polígonos con zona: IPS o alcance)
  const isNoEquipment = useCallback((t: ResolvedTerritory): boolean =>
    isLineMode && !!t.kamId && (t.kind === 'ips' || t.kind === 'reach') &&
    lineView?.byKam[t.kamId]?.has_equipment === false
  , [isLineMode, lineView])

  // Color de la zona del polígono según la vista: línea (Ejecutivo Comercial), región o zona
  const territoryColor = useCallback((t: ResolvedTerritory, code: string): string => {
    if (isLineMode && t.kamId) return zoneLineColor(t.kamId)
    if (t.kind === 'vacant' || (t.kind === 'ips' && t.isVacant)) return '#808080'
    if (!t.kamId) return '#cccccc'
    if (viewMode === 'zones') {
      const regionId = t.kind === 'ips' ? zoneAssignments[code] : kamIndex.toRegion[t.kamId]
      return regionId ? (zoneColors[regionId] || '#cccccc') : '#cccccc'
    }
    return kamColors[t.kamId] || '#cccccc'
  }, [isLineMode, zoneLineColor, viewMode, zoneAssignments, kamIndex, zoneColors, kamColors])

  // Estilo en reposo. Todas las variantes fijan dashArray para que setStyle no arrastre el anterior.
  const territoryRestStyle = useCallback((code: string, isLocality: boolean): L.PathOptions => {
    const t = resolveTerritory(code, isLocality)
    const noEquipment = isNoEquipment(t)
    switch (t.kind) {
      case 'ips':
      case 'vacant': {
        // Estilo de siempre de los territorios con IPS (relleno 0.4 / 0.5 en localidades)
        const color = territoryColor(t, code)
        const vacantStyle = t.kind === 'vacant' || (t.isVacant && !(isLineMode && t.kamId))
        if (noEquipment) {
          // El rayado lo pinta la capa SVG superpuesta; aquí solo el borde punteado
          return { fillColor: color, fillOpacity: 0, color: isLocality ? '#000000' : '#333333', weight: isLocality ? 1.5 : 0.8, opacity: 1, dashArray: '4 3' }
        }
        return {
          fillColor: color,
          color: vacantStyle ? '#FF0000' : (isLocality ? '#000000' : '#333333'),
          weight: vacantStyle ? 1 : (isLocality ? 1.5 : 0.8),
          opacity: 1,
          fillOpacity: vacantStyle ? 0.3 : (isLocality ? 0.5 : 0.4),
          dashArray: undefined
        }
      }
      case 'reach': {
        // De alcance (sin IPS hoy): mismo color de la zona, relleno tenue y borde fino
        const color = territoryColor(t, code)
        if (noEquipment) {
          return { fillColor: color, fillOpacity: 0, color, weight: 0.6, opacity: 0.8, dashArray: '4 3' }
        }
        return { fillColor: color, fillOpacity: 0.15, color, weight: 0.5, opacity: 0.7, dashArray: undefined }
      }
      case 'out_of_reach':
        return { fillColor: OUT_OF_REACH_COLOR, fillOpacity: 0.55, color: '#9ca3af', weight: 0.7, opacity: 1, dashArray: '4 3' }
      case 'no_road':
        return { fillColor: NO_ROAD_COLOR, fillOpacity: 0.6, color: NO_ROAD_COLOR, weight: 0.5, opacity: 1, dashArray: undefined }
      default:
        return { fillColor: PENDING_FILL_COLOR, fillOpacity: 0.45, color: PENDING_BORDER_COLOR, weight: 0.6, opacity: 1, dashArray: undefined }
    }
  }, [resolveTerritory, isNoEquipment, territoryColor, isLineMode])

  const territoryHoverStyle = useCallback((code: string, isLocality: boolean): L.PathOptions => {
    const rest = territoryRestStyle(code, isLocality)
    const t = resolveTerritory(code, isLocality)
    if (t.kind === 'ips' || t.kind === 'vacant') {
      const vacantStyle = t.kind === 'vacant' || (t.isVacant && !(isLineMode && t.kamId))
      return {
        ...rest,
        weight: vacantStyle ? 2 : (isLocality ? 2.5 : 1.5),
        fillOpacity: isNoEquipment(t) ? 0 : (vacantStyle ? 0.5 : (isLocality ? 0.7 : 0.6))
      }
    }
    return { ...rest, weight: (rest.weight || 0.5) + 1, fillOpacity: rest.fillOpacity ? Math.min(1, rest.fillOpacity + 0.2) : 0 }
  }, [territoryRestStyle, resolveTerritory, isLineMode, isNoEquipment])

  // style por feature: al cambiar de línea/vista solo cambia esta función y react-leaflet llama a setStyle
  // (los polígonos no se vuelven a crear)
  const municipiosStyle = useCallback((feature?: any) => territoryRestStyle(String(feature?.properties?.code ?? ''), false), [territoryRestStyle])
  const localidadesStyle = useCallback((feature?: any) => territoryRestStyle(String(feature?.properties?.code ?? ''), true), [territoryRestStyle])

  // Rayado "sin equipo": subconjunto pequeño en SVG (el patrón url(#...) no existe en canvas), sin eventos
  const noEquipmentOverlay = useMemo(() => {
    if (!isLineMode) return null
    const pick = (fc: any, isLocality: boolean) =>
      (Array.isArray(fc?.features) ? fc.features : []).filter((f: any) => {
        const code = String(f?.properties?.code ?? '')
        return isNoEquipment(resolveTerritory(code, isLocality))
      }).map((f: any) => ({ ...f, properties: { ...f.properties, isLocality } }))
    const features = [...pick(municipiosGeo, false), ...pick(localidadesGeo, true)]
    if (features.length === 0) return null
    const codes = features.map((f: any) => f.properties.code).join(',')
    let hash = 0
    for (let i = 0; i < codes.length; i++) hash = (hash * 31 + codes.charCodeAt(i)) | 0
    return { data: { type: 'FeatureCollection', features }, key: `${lineView?.line.code}-${features.length}-${hash}` }
  }, [isLineMode, municipiosGeo, localidadesGeo, isNoEquipment, resolveTerritory, lineView])

  const noEquipmentOverlayStyle = useCallback((feature?: any): L.PathOptions => {
    const isLocality = !!feature?.properties?.isLocality
    const t = resolveTerritory(String(feature?.properties?.code ?? ''), isLocality)
    const color = territoryColor(t, String(feature?.properties?.code ?? ''))
    return {
      fillColor: `url(#${noEquipmentPatternId(safeColor(color))})`,
      fillOpacity: t.kind === 'reach' ? 0.35 : 0.85,
      color: t.kind === 'reach' ? color : (isLocality ? '#000000' : '#333333'),
      weight: t.kind === 'reach' ? 0.6 : (isLocality ? 1.5 : 0.8),
      dashArray: '4 3'
    }
  }, [resolveTerritory, territoryColor])

  // Conteos para la leyenda de la capa de municipios
  const territoryLegend = useMemo<TerritoryLegend>(() => {
    const counts = { ips: 0, reach: 0, outOfReach: 0, noRoad: 0, pending: 0 }
    const tally = (fc: any, isLocality: boolean) => {
      ;(Array.isArray(fc?.features) ? fc.features : []).forEach((f: any) => {
        const t = resolveTerritory(String(f?.properties?.code ?? ''), isLocality)
        if (t.kind === 'ips' || t.kind === 'vacant') counts.ips++
        else if (t.kind === 'reach') counts.reach++
        else if (t.kind === 'out_of_reach') counts.outOfReach++
        else if (t.kind === 'no_road') counts.noRoad++
        else counts.pending++
      })
    }
    tally(municipiosGeo, false)
    tally(localidadesGeo, true)
    return {
      ...counts,
      noMunicipalityData: municipalityRows.length === 0,
      geoError: municipiosGeoError || localidadesGeoError
    }
  }, [municipiosGeo, localidadesGeo, resolveTerritory, municipalityRows, municipiosGeoError, localidadesGeoError])

  // Popup/tooltip al pasar el cursor. Los manejadores son estables y leen el contexto vigente de esta
  // referencia (se actualiza en cada render), así no se re-registran eventos al cambiar de línea.
  const territoryHoverRef = useRef<{
    describe: (code: string, isLocality: boolean, featureName: string) => { html: string; popup: boolean }
    rest: (code: string, isLocality: boolean) => L.PathOptions
    hover: (code: string, isLocality: boolean) => L.PathOptions
  } | null>(null)

  const makeTerritoryHandlers = useCallback((isLocality: boolean) => ({
    mouseover: (e: any) => {
      const layer = e.layer || e.propagatedFrom
      const feature = layer?.feature
      const ctx = territoryHoverRef.current
      if (!feature || !ctx) return
      const code = String(feature.properties?.code ?? '')
      layer.setStyle(ctx.hover(code, isLocality))
      const { html, popup } = ctx.describe(code, isLocality, String(feature.properties?.name ?? ''))
      if (popup) {
        layer.bindPopup(html, { maxWidth: 350, minWidth: 300, className: 'territory-popup', autoPan: false }).openPopup()
      } else {
        layer.unbindTooltip()
        layer.bindTooltip(html, { sticky: true, opacity: 0.95, className: 'custom-tooltip' }).openTooltip(e.latlng)
      }
    },
    mouseout: (e: any) => {
      const layer = e.layer || e.propagatedFrom
      const feature = layer?.feature
      const ctx = territoryHoverRef.current
      if (!feature || !ctx) return
      layer.setStyle(ctx.rest(String(feature.properties?.code ?? ''), isLocality))
      layer.closePopup()
      layer.unbindTooltip()
    }
  }), [])
  const municipiosHandlers = useMemo(() => makeTerritoryHandlers(false), [makeTerritoryHandlers])
  const localidadesHandlers = useMemo(() => makeTerritoryHandlers(true), [makeTerritoryHandlers])

  if (isUnauthorized) {
    return <div className="flex items-center justify-center h-full">Sesión expirada. Redirigiendo al inicio de sesión...</div>
  }

  if (isError && !mapData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-700 font-medium mb-3">No se pudo cargar el mapa</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {isFetching ? 'Reintentando...' : 'Reintentar'}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !mapData) {
    return <div className="flex items-center justify-center h-full">Cargando mapa...</div>
  }

  // Crear iconos personalizados para KAMs con el color del KAM
  const createKamIcon = (kamId: string) => {
    // Validado de nuevo aquí porque se interpola en HTML crudo
    const color = safeColor(kamColors[kamId])
    return L.divIcon({
      className: 'custom-kam-marker',
      html: `
        <div style="width: 42px; height: 52px; position: relative;">
          <div style="
            width: 36px;
            height: 36px;
            background-color: ${color};
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
          ">
            <i class="fa fa-user" style="
              color: white;
              font-size: 18px;
              text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
            "></i>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid ${color};
            margin: -3px auto 0 auto;
          "></div>
        </div>
      `,
      iconSize: [42, 52],
      iconAnchor: [21, 52],
      popupAnchor: [0, -52],
      tooltipAnchor: [0, -52]
    })
  }

  // Agrupar hospitales por KAM para estadísticas
  const kamStats = mapData.kams.map((kam: any) => {
    const assignments = mapData.assignments.filter((a: any) => a.kams.id === kam.id)
    
    // Calcular estadísticas
    const totalBeds = assignments.reduce((sum: number, a: any) => sum + (a.hospitals.beds || 0), 0)
    const municipalities = new Set(assignments.map((a: any) => a.hospitals.municipality_id))
    const avgTravelTime = assignments.length > 0 
      ? Math.round(assignments.reduce((sum: number, a: any) => sum + (a.travel_time || 0), 0) / assignments.length)
      : 0
    
    // Calcular población total
    const totalPopulation = Array.from(municipalities).reduce((sum, munId: any) => {
      return sum + (mapData.populationMap[munId] || 0)
    }, 0)
    
    return {
      ...kam,
      hospitalCount: assignments.length,
      totalBeds,
      municipalityCount: municipalities.size,
      avgTravelTime,
      totalPopulation
    }
  })

  // Ejecutivos Comerciales por zona, para los tooltips de las IPS
  const kamExecutives: Record<string, any[]> = {}
  mapData.kams.forEach((kam: any) => {
    kamExecutives[kam.id] = Array.isArray(kam.executives) ? kam.executives : []
  })

  // Filtrar hospitales según el tipo seleccionado
  const filterHospitalsByType = (hospitals: any[]) => {
    if (hospitalTypeFilter === 'all') return hospitals
    return hospitals.filter(h => h.type === hospitalTypeFilter || (hospitalTypeFilter === 'sin_tipo' && !h.type))
  }

  const filteredAssignments = mapData.assignments.filter((a: any) => {
    // Filtrar por contratos primero si está activo
    if (showContracts && !mapData.contractValuesByHospital[a.hospitals.id]) {
      return false
    }
    // Luego aplicar filtro de tipo
    if (hospitalTypeFilter === 'all') return true
    if (hospitalTypeFilter === 'sin_tipo') return !a.hospitals.type
    return a.hospitals.type === hospitalTypeFilter
  })

  const filteredUnassignedHospitals = filterHospitalsByType(mapData.unassignedHospitals).filter((h: any) => {
    // Si showContracts está activo, solo mostrar hospitales con contratos
    if (showContracts && !mapData.contractValuesByHospital[h.id]) {
      return false
    }
    return true
  })

  // Contenido del cursor sobre un polígono. Con IPS: el popup de estadísticas de siempre.
  // Sin IPS: tooltip corto con el reparto por tiempo real de carretera.
  // TODO valor dinámico pasa por escapeHtml: este HTML se inserta crudo en Leaflet.
  const describeTerritory = (code: string, isLocality: boolean, featureName: string): { html: string; popup: boolean } => {
    const t = resolveTerritory(code, isLocality)
    const territoryName = mapData.municipalityNames[code] || featureName || `Territorio ${code}`
    const zoneOf = (kamId: string | null | undefined) => {
      const k = kamId ? kamIndex.byId[kamId] : null
      return k ? (zoneDisplayName(k.name) || k.name) : ''
    }
    const lineCoverageHtml = (kamId: string | undefined) => {
      if (!isLineMode || !lineView || !kamId) return ''
      const row = lineView.byKam[kamId]
      return `<div style="margin-top: 4px;">Ejecutivo Comercial (${escapeHtml(lineView.line.name)}): ${escapeHtml(describeCoverage(row, lineView.zoneNameById))}${row?.has_equipment === false ? ' · sin equipo' : ''}</div>`
    }

    if (t.kind !== 'ips' && t.kind !== 'vacant') {
      const deptCode = municipalityByCode[code]?.department_code || code.slice(0, 2)
      const deptName = isLocality ? 'Bogotá, D.C.' : departmentNames[deptCode] || ''
      const population = mapData.populationMap[code] || 0
      let status = ''
      if (t.kind === 'reach') {
        const kam = t.kamId ? kamIndex.byId[t.kamId] : null
        const zone = zoneOf(t.kamId) || 'otra zona'
        if (t.row && t.row.travel_minutes !== null && t.row.travel_minutes !== undefined) {
          const from = kam?.base_city || zone
          status = `Zona: ${escapeHtml(zone)} · Alcance: ${escapeHtml(formatMinutes(t.row.travel_minutes))} por carretera desde ${escapeHtml(from)} · Sin IPS objetivo hoy`
        } else {
          status = `Zona: ${escapeHtml(zone)} · Territorio base de la zona · Sin IPS objetivo hoy`
        }
      } else if (t.kind === 'out_of_reach') {
        const nearest = zoneOf(t.row?.nearest_kam_id)
        status = nearest
          ? `Fuera de alcance (más cercana: ${escapeHtml(nearest)} a ${escapeHtml(formatMinutes(t.row?.nearest_minutes))})`
          : 'Fuera de alcance'
        status += '<div style="margin-top: 2px; font-size: 11px; color: #6b7280;">No se asigna a ninguna zona: supera el tope de tiempo por carretera.</div>'
      } else if (t.kind === 'no_road') {
        status = 'Sin acceso por carretera'
        status += '<div style="margin-top: 2px; font-size: 11px; color: #6b7280;">Google Maps no encontró ruta desde ninguna ciudad base candidata; no se asigna a ninguna zona.</div>'
      } else {
        status = isLocality
          ? 'Localidad sin IPS objetivo hoy · sin zona residente'
          : 'Tiempo por carretera pendiente de calcular'
      }
      const html = `
        <div style="font-size: 12px; min-width: 220px; max-width: 320px; padding: 8px 10px; white-space: normal; line-height: 1.45;">
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 4px;">
            ${escapeHtml(territoryName)}${deptName ? ` <span style="font-weight: normal; color: #6b7280;">· ${escapeHtml(deptName)}</span>` : ''}
          </div>
          <div>${status}</div>
          ${t.kind === 'reach' ? lineCoverageHtml(t.kamId) : ''}
          ${population > 0 ? `<div style="margin-top: 4px; font-size: 11px; color: #6b7280;">Población 2025: ${escapeHtml(Number(population).toLocaleString('es-CO'))}</div>` : ''}
        </div>`
      return { html, popup: false }
    }

    // ----- Territorio con IPS (estilo y contenido de siempre) -----
    const isVacant = t.isVacant
    // Modo por línea: un territorio con zona se pinta con la cobertura de esa zona en la línea.
    // Los territorios sin zona (solo IPS sin asignar) conservan el estilo de vacante de siempre.
    const useLineStyle = isLineMode && !!t.kamId
    const lineRow: CoverageRow | undefined = useLineStyle && t.kamId ? lineView!.byKam[t.kamId] : undefined
    const noEquipment = isNoEquipment(t)
    const stats = mapData.territoryStats?.[code] || {
      totalHospitals: 0,
      totalBeds: 0,
      totalAmbulances: 0,
      totalSurgeries: 0,
      totalContracts: 0,
      contractValue: 0,
      providers: []
    }
    const population = mapData.populationMap[code] || 0
    const providers: string[] = Array.isArray(stats.providers) ? stats.providers : []
    const bedsPer1000 = population > 0 ? stats.totalBeds / population * 1000 : 0
    const territoryZone = t.kamId ? kamIndex.byId[t.kamId] : undefined
    const zoneLabel = zoneDisplayName(territoryZone?.name || stats.kamName) || t.kamId?.toUpperCase()
    const executivesLabel = formatZoneExecutives(territoryZone?.executives)
    // Recuadro de cobertura de la línea: zona, ciudad base, línea y quién la cubre
    let lineStatusHtml = ''
    if (useLineStyle && lineView) {
      const kind = lineRow?.kind
      const boxBg = kind === 'vacant' ? '#fef2f2' : kind === 'conflict' ? '#fffbeb' : '#1e293b'
      const boxFg = kind === 'vacant' ? '#991b1b' : kind === 'conflict' ? '#92400e' : '#ffffff'
      const lineZoneName = zoneDisplayName(lineRow?.zone_name || territoryZone?.name || '') || zoneLabel
      const baseCity = lineRow?.base_city || territoryZone?.base_city || ''
      lineStatusHtml = `
        <div style="margin-top: 10px; padding: 8px; background-color: ${boxBg}; color: ${boxFg}; border-radius: 6px; font-size: 12px; line-height: 1.45;">
          <div style="font-size: 13px; font-weight: bold;">
            Zona: ${escapeHtml(lineZoneName)}${baseCity ? ` <span style="font-weight: normal;">(ciudad base ${escapeHtml(baseCity)})</span>` : ''}
          </div>
          <div>Línea: ${escapeHtml(lineView.line.name)}</div>
          <div>Ejecutivo Comercial: ${escapeHtml(describeCoverage(lineRow, lineView.zoneNameById))}</div>
          ${noEquipment ? '<div style="margin-top: 4px; font-weight: bold;">Sin equipo: la línea no opera en esta zona</div>' : ''}
        </div>`
    }
      const popupContent = `
                    <div style="min-width: 300px; padding: 10px;">
                      <div style="font-size: 15px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 8px;">
                        ${escapeHtml(territoryName)}
                      </div>
                      
                      <!-- Estadísticas de hospitales -->
                      <div style="margin-bottom: 10px;">
                        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #666;">
                          📊 ESTADÍSTICAS HOSPITALARIAS
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
                          <div style="display: flex; justify-content: space-between;">
                            <span>🏥 Hospitales:</span>
                            <strong>${escapeHtml(stats.totalHospitals)}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🛏️ Camas:</span>
                            <strong>${escapeHtml(Number(stats.totalBeds || 0).toLocaleString())}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🚑 Ambulancias:</span>
                            <strong>${escapeHtml(stats.totalAmbulances)}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span>🏥 Cirugías:</span>
                            <strong>${escapeHtml(Number(stats.totalSurgeries || 0).toLocaleString())}</strong>
                          </div>
                        </div>
                      </div>
                      
                      ${stats.contractValue > 0 ? `
                      <!-- Información de contratos -->
                      <div style="margin-bottom: 10px; padding: 8px; background-color: #f0f9ff; border-radius: 6px;">
                        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #0369a1;">
                          💼 CONTRATOS ACTIVOS
                        </div>
                        <div style="font-size: 12px;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span>Contratos:</span>
                            <strong>${escapeHtml(stats.totalContracts)}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span>Valor total:</span>
                            <strong style="color: #059669;">$${escapeHtml((Number(stats.contractValue) / 1000000).toFixed(1))}M</strong>
                          </div>
                          ${providers.length > 0 ? `
                          <div style="margin-top: 5px; font-size: 11px; color: #64748b;">
                            <span>Proveedores: </span>
                            <span style="font-style: italic;">${providers.slice(0, 3).map(escapeHtml).join(', ')}</span>
                            ${providers.length > 3 ? `<span> (+${escapeHtml(providers.length - 3)} más)</span>` : ''}
                          </div>` : ''}
                        </div>
                      </div>` : ''}
                      
                      ${population > 0 ? `
                      <!-- Población y métricas -->
                      <div style="margin-bottom: 10px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                          <span>👥 Población 2025:</span>
                          <strong>${escapeHtml(Number(population).toLocaleString())}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                          <span>📊 Camas/1000 hab:</span>
                          <strong style="color: ${bedsPer1000 < 1.5 ? '#dc2626' : bedsPer1000 < 2.5 ? '#f59e0b' : '#059669'};">
                            ${escapeHtml(bedsPer1000.toFixed(2))}
                          </strong>
                        </div>
                      </div>` : ''}
                      
                      <!-- Estado del territorio -->
                      ${useLineStyle ? lineStatusHtml : `<div style="margin-top: 10px; padding: 8px; background-color: ${isVacant ? '#fef2f2' : '#1e293b'}; color: ${isVacant ? '#dc2626' : '#fff'}; text-align: center; border-radius: 6px; font-size: 13px; font-weight: bold;">
                        ${isVacant ? '⚠️ ZONA VACANTE - SIN EJECUTIVO COMERCIAL' : `✓ Zona: ${escapeHtml(zoneLabel)}
                        <div style="margin-top: 4px; font-size: 12px; font-weight: normal;">Ejecutivo Comercial: ${escapeHtml(executivesLabel)}</div>`}
                      </div>`}
                    </div>
                  `
    return { html: popupContent, popup: true }
  }

  territoryHoverRef.current = {
    describe: describeTerritory,
    rest: territoryRestStyle,
    hover: territoryHoverStyle
  }

  return (
    <>
      {/* Control unificado del mapa */}
      <MapControls
        mapData={mapData}
        hospitalTypeFilter={hospitalTypeFilter}
        setHospitalTypeFilter={setHospitalTypeFilter}
        filteredAssignments={filteredAssignments}
        filteredUnassignedHospitals={filteredUnassignedHospitals}
        onVisitsChange={setVisits}
        onShowHeatmapChange={setShowHeatmap}
        onShowMarkersChange={setShowMarkers}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        lines={lines}
        selectedLineCode={selectedLineCode}
        onLineChange={onLineChange}
        canSeeAllLines={canSeeAllLines}
        mapMode={mapMode}
        onMapModeChange={onMapModeChange}
        lineLegend={isLineMode && lineView ? {
          lineName: lineView.line.name,
          executives: lineView.executives.map(e => ({
            id: e.id,
            name: executiveName(e),
            color: safeColor(lineView.executiveColors[e.id]),
            zones: lineView.counts.zonesByExecutive[e.id] || 0
          })),
          vacantColor: VACANT_COLOR,
          conflictColor: CONFLICT_COLOR,
          vacant: lineView.counts.vacant,
          conflict: lineView.counts.conflict,
          noEquipment: lineView.counts.noEquipment,
          totalZones: lineView.rows.length
        } : null}
        territoryLegend={territoryLegend}
        onShowContractsChange={setShowContracts}
        onHospitalSelect={setSelectedHospitalId}
        onMapNavigate={(lat: number, lng: number, zoom: number) => {
          setMapCenter([lat, lng])
          setMapZoom(zoom)
          // Limpiar después de un momento para permitir nuevas navegaciones
          setTimeout(() => {
            setMapCenter(undefined)
            setMapZoom(undefined)
          }, 100)
        }}
      />

      {/* Patrones rayados de "sin equipo" (uno por color usado en la línea), referenciados con fill url(#id) */}
      {isLineMode && lineView && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            {Array.from(new Set([
              ...Object.values(lineView.executiveColors).map(c => safeColor(c)),
              VACANT_COLOR,
              CONFLICT_COLOR,
              NO_COVERAGE_DATA_COLOR
            ])).map(hex => (
              <pattern
                key={hex}
                id={noEquipmentPatternId(hex)}
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill={hex} fillOpacity="0.15" />
                <line x1="0" y1="0" x2="0" y2="8" stroke={hex} strokeWidth="3" strokeOpacity="0.75" />
              </pattern>
            ))}
          </defs>
        </svg>
      )}

      <MapContainer
        center={[4.5709, -74.2973]}
        zoom={6}
        className="h-full w-full"
        preferCanvas={true}
        zoomControl={false}
      >
        <MapController center={mapCenter} zoom={mapZoom} />
        <TileLayer
          attribution={BASEMAP_ATTRIBUTION}
          url={BASEMAP_URL}
          maxNativeZoom={BASEMAP_MAX_NATIVE_ZOOM}
          eventHandlers={{ tileerror: handleTileError }}
        />
        <ZoomControl position="bottomleft" />
        
        {/* Todos los municipios (sin Bogotá) y las localidades: un solo <GeoJSON> por colección, estilo
            por feature. Con IPS: estilo de siempre; sin IPS: alcance / fuera de alcance / sin carretera. */}
        {municipiosGeo && (
          <GeoJSON
            key="geo-municipios"
            data={municipiosGeo}
            style={municipiosStyle}
            eventHandlers={municipiosHandlers}
          />
        )}
        {localidadesGeo && (
          <GeoJSON
            key="geo-localidades"
            data={localidadesGeo}
            style={localidadesStyle}
            eventHandlers={localidadesHandlers}
          />
        )}
        {/* Rayado "sin equipo" de la línea (SVG, sin eventos: el cursor lo atiende la capa de abajo) */}
        {noEquipmentOverlay && (
          <GeoJSON
            key={noEquipmentOverlay.key}
            data={noEquipmentOverlay.data as any}
            style={noEquipmentOverlayStyle}
            interactive={false}
            {...({ renderer: svgRenderer } as any)}
          />
        )}
        
        {/* Puntos de IPS - Segunda capa (encima de territorios) */}
        {filteredAssignments.map((assignment: any) => {
          const hospital = assignment.hospitals
          const kam = assignment.kams
          // Modo por línea: el punto toma el color del Ejecutivo Comercial que cubre su zona en la línea
          const lineRow = isLineMode ? lineView!.byKam[kam.id] : undefined
          
          return (
            <HospitalMarker
              key={hospital.id}
              hospital={hospital}
              kam={kam}
              kamColor={isLineMode ? zoneLineColor(kam.id) : kamColors[kam.id]}
              executives={kamExecutives[kam.id]}
              lineInfo={isLineMode ? {
                lineName: lineView!.line.name,
                coverageText: describeCoverage(lineRow, lineView!.zoneNameById),
                hasEquipment: lineRow ? lineRow.has_equipment !== false : true
              } : undefined}
              assignment={assignment}
              contractValue={mapData.contractValuesByHospital[hospital.id]}
              contractProviders={mapData.contractProvidersByHospital[hospital.id]}
              isSelected={selectedHospitalId === hospital.id}
            />
          )
        })}
        
        {/* Hospitales sin asignar (zonas vacantes) */}
        {filteredUnassignedHospitals.map((hospital: any, index: number) => {
          const travelTimes = unassignedTravelTimes[hospital.id] || []
          
          // Log para el primer hospital sin asignar
          if (index === 0) {
            console.log('🏥 MapComponent Render - Hospital sin asignar:', hospital.name)
            console.log('📍 MapComponent Render - ID:', hospital.id)
            console.log('⏱️ MapComponent Render - Tiempos disponibles:', travelTimes.length)
            console.log('📊 MapComponent Render - Primeros 3 tiempos:', travelTimes.slice(0, 3))
          }
          
          // SOLO mostrar tiempos reales de Google Maps
          // NO estimar si no hay datos
          
          // const zoneInfo = getZoneInfo(hospital.municipality_name) // Removido - usar solo datos reales
          
          return (
            <CircleMarker
              key={`unassigned-${hospital.id}-${travelTimes.length}`}
              center={[hospital.lat, hospital.lng]}
              radius={5}
              pathOptions={{
                color: '#FF0000',
                weight: 1,
                fillColor: '#CCCCCC',
                fillOpacity: 0.7,
                className: 'hospital-marker'
              }}
              pane="markerPane"
              eventHandlers={{
                click: () => {
                  router.push(`/hospitals/${hospital.id}`)
                }
              }}
            >
              <Tooltip 
                sticky={false} 
                opacity={0.95}
                permanent={selectedHospitalId === hospital.id}
                className="custom-tooltip"
              >
                <div style={{ 
                  fontSize: '12px', 
                  minWidth: '250px', 
                  maxWidth: '350px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  wordWrap: 'break-word',
                  whiteSpace: 'normal'
                }}>
                  <strong style={{ fontSize: '13px', color: '#FF0000' }}>⚠️ SIN COBERTURA</strong><br/>
                  <strong style={{ 
                    fontSize: '13px', 
                    wordBreak: 'break-word',
                    display: 'block',
                    marginBottom: '4px'
                  }}>{hospital.name}</strong>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Código NIT:</strong> {hospital.code}<br/>
                    <strong>Ubicación:</strong> {hospital.municipality_name || mapData.municipalityNames[hospital.municipality_id] || hospital.municipality_id}{hospital.department_name ? `, ${hospital.department_name}` : ''}<br/>
                    <strong>Camas:</strong> {hospital.beds || 0}<br/>
                    <strong>Nivel:</strong> {hospital.service_level || 'N/A'}<br/>
                    {hospital.type && (
                      <>
                        <strong>Tipo:</strong> <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          backgroundColor: hospital.type === 'Publico' ? '#DBEAFE' : 
                                         hospital.type === 'Privada' ? '#E9D5FF' : '#D1FAE5',
                          color: hospital.type === 'Publico' ? '#1E40AF' : 
                                hospital.type === 'Privada' ? '#6B21A8' : '#065F46'
                        }}>{hospital.type}</span><br/>
                      </>
                    )}
                    {mapData.contractValuesByHospital[hospital.id] && (
                      <>
                        <strong style={{ color: '#2ECC71' }}>💰 Contratos:</strong> ${mapData.contractValuesByHospital[hospital.id].toLocaleString('es-CO')}<br/>
                      </>
                    )}
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ddd' }}>
                      <strong>Distancia desde cada zona:</strong><br/>
                      {travelTimes && travelTimes.length > 0 ? (
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>
                          <table style={{ width: '100%', borderSpacing: '0 2px' }}>
                            <tbody>
                              {travelTimes.slice(0, 8).map((tt: any, idx: number) => {
                                const hasTime = tt.travel_time !== null && tt.travel_time !== undefined
                                // Los tiempos vienen en SEGUNDOS desde hospital_kam_distances
                                const timeStr = hasTime 
                                  ? formatTravelTimeFromSeconds(tt.travel_time) // Convertir segundos a formato legible
                                  : 'Sin calcular'
                                
                                const minutes = hasTime ? Math.round(tt.travel_time / 60) : 0
                                const isOverLimit = hasTime && minutes > (tt.max_travel_time || 240)
                                const isClose = hasTime && minutes > 240 && minutes <= 300 // 5 horas
                                
                                return (
                                  <tr key={idx}>
                                    <td style={{ 
                                      paddingRight: '10px',
                                      fontWeight: 'bold',
                                      color: !hasTime ? '#999' : (isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#333'))
                                    }}>
                                      {zoneDisplayName(tt.kam_name)}:
                                    </td>
                                    <td style={{ 
                                      textAlign: 'right',
                                      color: !hasTime ? '#999' : (isClose ? '#FF6B00' : (isOverLimit ? '#CC0000' : '#666'))
                                    }}>
                                      {timeStr} {isClose && '⚠️'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {travelTimes.length > 8 && (
                            <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#999' }}>
                              ...y {travelTimes.length - 8} zonas más
                            </div>
                          )}
                          <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
                            <em>Tiempos reales de Google Maps</em>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          <div style={{ padding: '4px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                            <strong>Hospital sin asignar</strong><br/>
                            <div style={{ marginTop: '4px', fontSize: '10px' }}>
                              No hay tiempos de viaje calculados para este hospital.<br/>
                              Ejecute un recálculo completo para incluirlo en el análisis.
                            </div>
                          </div>
                        </div>
                      )}
                      {travelTimes.length > 0 && travelTimes[0].travel_time && travelTimes[0].travel_time/60 > 240 && travelTimes[0].travel_time/60 <= 300 && (
                        <div style={{ marginTop: '6px', padding: '4px', backgroundColor: '#FFF3CD', border: '1px solid #FFE69C', borderRadius: '4px' }}>
                          <div style={{ fontSize: '11px', color: '#856404' }}>
                            💡 <strong>Sugerencia:</strong> la zona {zoneDisplayName(travelTimes[0].kam_name)} está a solo {formatTravelTimeFromSeconds(travelTimes[0].travel_time)}.
                            Considere ajustar su límite de tiempo máximo de 4 a 5 horas.
                          </div>
                        </div>
                      )}
                      {/* Información de zona removida - usar solo datos reales */}
                    </div>
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
        
        {/* Marcadores de zonas (ubicación base) */}
        {kamStats.filter((kam: any) => kam.lat && kam.lng).map((kam: any) => (
          <Marker
            key={kam.id}
            position={[kam.lat, kam.lng]}
            icon={createKamIcon(kam.id)}
            zIndexOffset={1000}
          >
            <Tooltip 
              sticky={true} 
              opacity={0.95}
              direction="top"
              offset={[0, -30]}
              permanent={false}
              interactive={false}
              className="custom-tooltip"
            >
              <div style={{ 
                fontSize: '12px', 
                minWidth: '200px',
                maxWidth: '350px',
                wordWrap: 'break-word',
                whiteSpace: 'normal'
              }}>
                <strong style={{ 
                  fontSize: '14px', 
                  color: kamColors[kam.id],
                  wordBreak: 'break-word',
                  display: 'block'
                }}>Zona: {zoneDisplayName(kam.name)}</strong>
                {kam.base_city && (
                  <div style={{ marginTop: '2px' }}>
                    <strong>Ciudad base:</strong> {kam.base_city}
                  </div>
                )}
                <div style={{ marginTop: '2px' }}>
                  <strong>Ejecutivo Comercial:</strong> {formatZoneExecutives(kam.executives)}
                </div>
                {isLineMode && (
                  <div style={{ marginTop: '2px' }}>
                    <strong>Línea {lineView!.line.name}:</strong> {describeCoverage(lineView!.byKam[kam.id], lineView!.zoneNameById)}
                    {lineView!.byKam[kam.id]?.has_equipment === false && ' · sin equipo'}
                  </div>
                )}
                <div style={{ marginTop: '4px' }}>
                  <strong>Total IPS:</strong> {kam.hospitalCount}<br/>
                  <strong>Total Camas:</strong> {kam.totalBeds.toLocaleString()}<br/>
                  <strong>Municipios:</strong> {kam.municipalityCount}<br/>
                  <strong>Población:</strong> {kam.totalPopulation.toLocaleString()}<br/>
                  <strong>Base:</strong> {kam.area_id}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
        
        {/* Capa de mapa de calor de visitas - SOLO mostrar si hay visitas válidas */}
        {showHeatmap && visits && Array.isArray(visits) && visits.length > 0 ? (
          <VisitsHeatmapLayer 
            key={`heatmap-${showHeatmap}-${visits.length}`} // Clave única para forzar remontaje
            visits={visits}
            intensity={0.5}
            radius={15}
            blur={25}
            maxZoom={15}
            gradient={{
              0.0: 'blue',
              0.25: 'cyan',
              0.5: 'lime',
              0.75: 'yellow',
              0.85: 'orange',
              1.0: 'red'
            }}
          />
        ) : (
          showHeatmap && console.log('MapComponent - Heatmap solicitado pero sin visitas válidas:', {
            showHeatmap,
            visitsLength: visits?.length || 0,
            visitsIsArray: Array.isArray(visits)
          })
        )}
        
        {/* Marcadores individuales de visitas */}
        {showMarkers && visits && visits.length > 0 && visits.map((visit, index) => {
          // Buscar el KAM para obtener su color
          const kam = mapData.kams.find((k: any) => k.id === visit.kam_id)
          const kamColor = kam ? kamColors[kam.id] : '#888888'
          
          return (
            <CircleMarker
              key={`visit-${index}`}
              center={[visit.lat, visit.lng]}
              radius={6}
              pathOptions={{
                fillColor: visit.visit_type === 'Visita efectiva' ? '#2ECC71' :
                          visit.visit_type === 'Visita extra' ? '#3498DB' : '#E74C3C',
                color: kamColor,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
              }}
            >
              <Tooltip className="custom-tooltip">
                <div style={{ 
                  fontSize: '12px', 
                  minWidth: '200px',
                  maxWidth: '350px',
                  wordWrap: 'break-word',
                  whiteSpace: 'normal'
                }}>
                  <strong style={{ 
                    fontSize: '13px', 
                    color: kamColor,
                    wordBreak: 'break-word',
                    display: 'block'
                  }}>
                    {zoneDisplayName(visit.kam_name)}
                  </strong>
                  <div style={{ marginTop: '4px', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                    <table style={{ width: '100%', borderSpacing: '0' }}>
                      <tbody>
                        <tr>
                          <td style={{ paddingRight: '10px' }}><strong>Tipo:</strong></td>
                          <td style={{ 
                            color: visit.visit_type === 'Visita efectiva' ? '#2ECC71' :
                                  visit.visit_type === 'Visita extra' ? '#3498DB' : '#E74C3C'
                          }}>
                            {visit.visit_type}
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Contacto:</strong></td>
                          <td>{visit.contact_type}</td>
                        </tr>
                        <tr>
                          <td><strong>Fecha:</strong></td>
                          <td>{new Date(visit.visit_date).toLocaleDateString('es-CO')}</td>
                        </tr>
                        {visit.hospital_name && (
                          <tr>
                            <td><strong>Hospital:</strong></td>
                            <td>{visit.hospital_name}</td>
                          </tr>
                        )}
                        {visit.observations && (
                          <tr>
                            <td colSpan={2}>
                              <div style={{ marginTop: '4px', fontSize: '11px', fontStyle: 'italic' }}>
                                {visit.observations}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#666' }}>
                    Zona: {kam ? zoneDisplayName(kam.name) : visit.kam_id}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Aviso no bloqueante: el proveedor del mapa base no responde (territorios y marcadores siguen visibles) */}
      {basemapError && (
        <div
          role="status"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none rounded-md bg-white/95 border border-amber-300 px-3 py-1.5 text-xs text-amber-800 shadow"
        >
          No se pudo cargar el mapa base
        </div>
      )}
      
      {/* Estilos CSS para el cursor */}
      <style jsx global>{`
        .hospital-marker {
          cursor: pointer !important;
        }
        .hospital-marker:hover {
          stroke-width: 2 !important;
          stroke-opacity: 1 !important;
        }
        .leaflet-tooltip {
          background: white !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          padding: 0 !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #ddd !important;
        }
      `}</style>
    </>
  )
}