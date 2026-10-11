'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import type { MapLine, MapMode } from '@/components/MapComponent'

// Importar MapComponent directamente en lugar de MapWithVisitsSimple
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
  const [viewMode, setViewMode] = useState<'kams' | 'zones'>('kams')
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

  useEffect(() => {
    const mode = searchParams.get('viewMode')
    const zoneId = searchParams.get('zoneId')

    if (mode === 'zones') {
      setViewMode('zones')
    } else {
      setViewMode('kams')
    }

    if (zoneId) {
      setSelectedZoneId(zoneId)
    }
  }, [searchParams])

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
  // Vista "Zonas" (colores por zona): solo para quien ve todas las líneas
  const mapMode: MapMode = canSeeAll && searchParams.get('mode') === 'zones' ? 'zones' : 'line'

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

  const selectLine = useCallback((code: string) => updateParams({ line: code }), [updateParams])
  const changeMapMode = useCallback(
    (mode: MapMode) => updateParams({ mode: mode === 'zones' ? 'zones' : null }),
    [updateParams]
  )

  // Una sola línea: se selecciona sola
  useEffect(() => {
    if (lines.length === 1 && !selectedLine) {
      selectLine(lines[0].code)
    }
  }, [lines, selectedLine, selectLine])

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

    if (lines.length === 0) {
      return (
        <div className="flex items-center justify-center h-full px-4">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-900 font-semibold mb-1">No tienes líneas asignadas</p>
            <p className="text-sm text-gray-600">
              Pide al administrador que te asigne una línea de negocio para ver su mapa.
            </p>
          </div>
        </div>
      )
    }

    // Varias líneas y ninguna elegida: selector obligatorio (no se cierra hasta elegir)
    if (!selectedLine) {
      if (lines.length === 1) return <MapPageFallback />
      return <LineSelectorModal lines={lines} onSelect={selectLine} />
    }

    return (
      <MapComponent
        viewMode={viewMode}
        selectedZoneId={selectedZoneId}
        onViewModeChange={setViewMode}
        lines={lines}
        selectedLineCode={selectedLine.code}
        onLineChange={selectLine}
        canSeeAllLines={canSeeAll}
        mapMode={mapMode}
        onMapModeChange={changeMapMode}
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
        <div className="h-screen relative">
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
      className="fixed inset-0 top-16 z-[9997] flex items-center justify-center bg-gray-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-selector-title"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <h2 id="line-selector-title" className="text-base font-semibold text-gray-900">
          Elige una línea de negocio
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          El mapa muestra la cobertura de una línea a la vez. Podrás cambiarla después desde el panel de controles.
        </p>
        <div className="mt-4 space-y-2">
          {lines.map((line, index) => (
            <button
              key={line.id}
              type="button"
              autoFocus={index === 0}
              onClick={() => onSelect(line.code)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 text-left hover:border-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
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
