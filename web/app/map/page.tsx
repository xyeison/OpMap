'use client'

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
        <div className="h-screen relative pt-16">
          <MapComponent />
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}