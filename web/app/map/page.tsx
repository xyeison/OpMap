'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

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

export default function MapPage() {
  const searchParams = useSearchParams()
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
          <MapComponent
            viewMode={viewMode}
            selectedZoneId={selectedZoneId}
            onViewModeChange={setViewMode}
          />
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}