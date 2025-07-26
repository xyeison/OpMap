'use client'

import dynamic from 'next/dynamic'
import RecalculateButton from '@/components/RecalculateButtonEnhanced'

// Importar Leaflet dinámicamente para evitar errores de SSR
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div>
})

export default function MapPage() {
  return (
    <div className="h-screen relative">
      <MapComponent />
      <div className="absolute top-4 right-4 z-[1000]">
        <RecalculateButton />
      </div>
    </div>
  )
}