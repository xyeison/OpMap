'use client'

import dynamic from 'next/dynamic'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

// Importar Leaflet dinámicamente para evitar errores de SSR
const MapWithVisits = dynamic(() => import('@/components/MapWithVisits'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div>
})

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
        <div className="h-screen relative">
          <MapWithVisits />
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}