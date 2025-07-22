'use client'

import dynamic from 'next/dynamic'

// Importar Leaflet dinámicamente para evitar errores de SSR
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div>
})

export default function MapPage() {
  return (
    <div className="h-screen">
      <MapComponent />
    </div>
  )
}