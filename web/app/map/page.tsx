'use client'

import { useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import type { MapLine, MapMode } from '@/components/MapComponent'
import { setMapHeaderTitle } from '@/components/mapHeaderStore'
import { lineForExecutivesView, resolveMapView } from '@/lib/map-view'

const MapComponent = dynamic(
  () => import('@/components/MapComponent').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    )
  }
)

// Fallback mientras se resuelven los parámetros de búsqueda (requerido por Next 14.2 para useSearchParams)
function MapPageFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando mapa...</p>
      </div>
    </div>
  )
}

interface MyLinesResponse {
  lines: MapLine[]
  canSeeAll: boolean
}

// Filtro del mapa en la URL: ?exec=<id1,id2> (Ejecutivos Comerciales, vista por línea) o
// ?zones=<id1,id2> (zonas, vista de zonas). Sin parámetro = sin filtro; vacío (?exec=) = ninguno marcado.
const FILTER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILTER_IDS = 100

function parseFilterIds(raw: string | null): string[] | null {
  if (raw === null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return []
  const ids = Array.from(new Set(trimmed.split(',').map(id => id.trim().toLowerCase()).filter(id => FILTER_ID_RE.test(id))))
  // Un valor sin ningún id válido se ignora (sin filtro) en vez de dejar el mapa vacío
  return ids.length > 0 ? ids.slice(0, MAX_FILTER_IDS) : null
}

// Error HTTP de /api/me/lines con el código de estado (401 → login)
class MyLinesError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export default function MapPage() {
  return (
    <Suspense fallback={<MapPageFallback />}>
      <MapPageContent />
    </Suspense>
  )
}

function MapPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Líneas de negocio que el usuario puede ver en el mapa
  const { data: myLines, isLoading: linesLoading, isError: linesError, error: linesErrorObj, refetch: refetchLines } = useQuery<MyLinesResponse>({
    queryKey: ['me-lines'],
    queryFn: async () => {
      const response = await fetch('/api/me/lines')
      if (!response.ok) throw new MyLinesError('Error al cargar tus líneas', response.status)
      const data = await response.json()
      return {
        lines: Array.isArray(data?.lines) ? data.lines : [],
        canSeeAll: data?.canSeeAll === true,
      }
    },
    retry: (failureCount, error) =>
      !(error instanceof MyLinesError && (error.status === 401 || error.status === 403)) && failureCount < 2,
  })

  const linesUnauthorized = linesErrorObj instanceof MyLinesError && linesErrorObj.status === 401
  useEffect(() => {
    if (linesUnauthorized) router.replace('/login')
  }, [linesUnauthorized, router])

  const lines = useMemo(() => myLines?.lines ?? [], [myLines])
  const canSeeAll = myLines?.canSeeAll === true
  const lineParam = searchParams.get('line')
  const selectedLine = lines.find(l => l.code === lineParam) ?? null
  // Vista "Zonas" (colores por zona, ?mode=zones): todo el que ve el mapa (spec 2026-10-14; antes solo quien ve
  // todas las líneas). A quien no ve todas, /api/map/data no le trae nada de las personas ni de la cobertura de
  // las líneas que no ve. Sin modo Regiones desde el 2026-10-14 (lib/map-view.ts).
  const { mapMode } = resolveMapView({ mode: searchParams.get('mode') })

  // Actualiza la URL (?line=code&mode=zones) conservando el resto de parámetros
  const updateParams = useCallback((changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null) params.delete(key)
      else params.set(key, value)
    })
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  // Elegir una línea en el selector del mapa vuelve a la vista por línea (quita ?mode=zones). Los
  // Ejecutivos Comerciales cambian de una línea a otra: el filtro se quita.
  const selectLine = useCallback(
    (code: string) => updateParams({ line: code, mode: null, exec: null, zones: null }),
    [updateParams]
  )
  // "Ver por" de Filtros → Vista. Volver a "Ejecutivos Comerciales" deja la línea elegida o, si no había ninguna (se
  // entró directo a la vista de zonas), la primera de sus líneas.
  const changeMapMode = useCallback(
    (mode: MapMode) => {
      if (mode === 'zones') updateParams({ mode: 'zones', exec: null, zones: null })
      else updateParams({ mode: null, exec: null, zones: null, line: lineForExecutivesView(selectedLine?.code ?? null, lines) })
    },
    [updateParams, selectedLine, lines]
  )

  // Una sola línea: se selecciona sola (conserva el filtro de un enlace compartido)
  useEffect(() => {
    if (lines.length === 1 && !selectedLine) {
      updateParams({ line: lines[0].code })
    }
  }, [lines, selectedLine, updateParams])

  // Filtro del mapa: por Ejecutivo Comercial en la vista por línea, por zona en la vista de zonas
  const filterParam = mapMode === 'zones' ? 'zones' : 'exec'
  const rawFilter = searchParams.get(filterParam)
  const filterIds = useMemo(() => parseFilterIds(rawFilter), [rawFilter])
  // history.replaceState (Next 14 lo sincroniza con useSearchParams): sin ir al servidor en cada
  // toque de "Ver solo". Los ids son UUID validados, la coma se deja sin codificar (?exec=<id1,id2>).
  const changeFilterIds = useCallback((ids: string[] | null) => {
    const params = new URLSearchParams(window.location.search)
    params.delete(filterParam)
    let query = params.toString()
    if (ids !== null) {
      const safeIds = ids.filter(id => FILTER_ID_RE.test(id)).slice(0, MAX_FILTER_IDS)
      query = `${query ? `${query}&` : ''}${filterParam}=${safeIds.join(',')}`
    }
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }, [filterParam, pathname])

  // Cabecera compacta en móvil: "OpMap · <línea>"
  const headerTitle = mapMode === 'zones' ? 'Vista de zonas' : selectedLine?.name ?? null
  useEffect(() => {
    setMapHeaderTitle(headerTitle)
  }, [headerTitle])
  useEffect(() => () => setMapHeaderTitle(null), [])

  const renderBody = () => {
    if (linesUnauthorized) {
      return <div className="flex items-center justify-center h-full">Sesión expirada. Redirigiendo al inicio de sesión...</div>
    }

    if (linesLoading) {
      return <MapPageFallback />
    }

    if (linesError || !myLines) {
      return (
        <div className="flex items-center justify-center h-full px-4">
          <div className="text-center">
            <p className="text-gray-700 font-medium mb-3">No se pudieron cargar tus líneas de negocio</p>
            <button
              type="button"
              onClick={() => refetchLines()}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    // Sin líneas: no hay vista por Ejecutivos Comerciales, pero sí la de zonas (todo el que ve el mapa)
    if (lines.length === 0 && mapMode !== 'zones') {
      return (
        <div className="flex items-center justify-center h-full px-4">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-900 font-semibold mb-1">No tienes líneas asignadas</p>
            <p className="text-sm text-gray-600">
              Pide al administrador que te asigne una línea de negocio para ver su mapa. Mientras tanto puedes ver
              todas las zonas.
            </p>
            <button
              type="button"
              onClick={() => changeMapMode('zones')}
              className="mt-4 w-full min-h-[44px] px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              Ver el mapa por zonas
            </button>
          </div>
        </div>
      )
    }

    // Una sola línea: se selecciona sola (efecto de arriba)
    if (!selectedLine && lines.length === 1) return <MapPageFallback />

    // Varias líneas y ninguna elegida en la vista por Ejecutivos Comerciales: selector obligatorio (no se cierra
    // hasta elegir). La vista de zonas no depende de la línea: se abre sin elegirla.
    if (!selectedLine && mapMode !== 'zones') {
      return <LineSelectorModal lines={lines} onSelect={selectLine} />
    }

    return (
      <MapComponent
        lines={lines}
        selectedLineCode={selectedLine?.code ?? null}
        onLineChange={selectLine}
        canSeeAllLines={canSeeAll}
        mapMode={mapMode}
        onMapModeChange={changeMapMode}
        filterIds={filterIds}
        onFilterIdsChange={changeFilterIds}
      />
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="map:view"
        fallback={
          <div className="flex items-center justify-center h-screen">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Acceso denegado:</strong> No tienes permisos para ver el mapa.
            </div>
          </div>
        }
      >
        {/* Alto de la pantalla menos la cabecera (48 px en móvil, 64 px en escritorio); sin scroll de página */}
        <div className="opmap-map-page relative">
          {renderBody()}
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}

// Selector obligatorio de línea de negocio: modal centrado sin botón de cerrar (cabe en 375 px)
function LineSelectorModal({ lines, onSelect }: { lines: MapLine[]; onSelect: (code: string) => void }) {
  return (
    <div
      className="fixed inset-0 top-12 md:top-16 z-[9997] flex items-center justify-center bg-gray-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-selector-title"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <h2 id="line-selector-title" className="text-base font-semibold text-gray-900">
          Elige una línea de negocio
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          El mapa muestra la cobertura de una línea a la vez. Podrás cambiarla después en Filtros, dentro del mapa.
        </p>
        <div className="mt-4 space-y-2">
          {lines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              autoFocus={index === 0}
              onClick={() => onSelect(line.code)}
              className="w-full min-h-[48px] flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 text-left hover:border-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{line.name}</span>
              {line.role === 'leader' && (
                <span className="text-xs text-gray-500 flex-shrink-0">Líder</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
