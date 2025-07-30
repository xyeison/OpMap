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
      
      {/* Mapa base con visitas */}
      <MapComponent 
        visits={showVisits ? visits : []}
        showHeatmap={showHeatmap}
        showMarkers={showMarkers}
      />
    </div>
  )
}