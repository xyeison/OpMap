'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import VisitsControls from './VisitsControls'

// Dynamic imports
const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen">Cargando mapa...</div>
})

export default function MapWithVisitsSimple() {
  const [visits, setVisits] = useState<any[]>([])
  const [showVisits, setShowVisits] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [showMarkers, setShowMarkers] = useState(false)

  return (
    <div className="relative h-full">
      {/* Controles de visitas superpuestos */}
      <VisitsControls
        onVisitsChange={setVisits}
        onShowVisitsChange={setShowVisits}
        onShowHeatmapChange={setShowHeatmap}
        onShowMarkersChange={setShowMarkers}
      />
      
      {/* Mapa base */}
      <MapComponent />
      
      {/* Por ahora, mostraremos un mensaje indicando que las visitas están cargadas */}
      {showVisits && visits.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white p-3 rounded-lg shadow-lg">
          <p className="text-sm text-gray-600">
            {visits.length} visitas cargadas para el período seleccionado
          </p>
        </div>
      )}
    </div>
  )
}