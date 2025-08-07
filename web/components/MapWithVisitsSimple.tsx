'use client'

import dynamic from 'next/dynamic'

// Dynamic imports
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div>
})

export default function MapWithVisitsSimple() {
  return (
    <div className="relative h-full">
      {/* Mapa con controles integrados */}
      <MapComponent />
    </div>
  )
}