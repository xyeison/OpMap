'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Pane, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type L from 'leaflet'

// Capa de nombres de lugares (ciudades, departamentos) en su propio panel: encima de los polígonos y
// debajo de los puntos de IPS y de las insignias de zona, sin recibir toques.
//
// Leaflet, tras un flyTo (p. ej. al tocar un racimo de zonas), a veces deja visibles teselas del zoom
// anterior detrás de las nuevas. En el mapa base no se nota (teselas opacas), pero en esta capa
// transparente aparecen nombres enormes y borrosos. Por eso los nombres se ocultan con un fundido
// mientras dura el zoom y, al terminar, se pide a la capa que retire las teselas que ya no
// corresponden a la vista antes de volver a mostrarlos.

const PRUNE_DELAY_MS = 300
const PRUNE_MAX_ATTEMPTS = 12
// Pase lo que pase, los nombres vuelven a verse como mucho este tiempo después de que termine el zoom
const SHOW_FALLBACK_MS = 2000
const ZOOMING_CLASS = 'opmap-labels-pane--zooming'

interface MapLabelsLayerProps {
  pane: string
  // Orden del panel: por encima de los polígonos (400) y por debajo del panel de IPS
  zIndex: number
  url: string
  maxNativeZoom?: number
}

// Partes internas de L.GridLayer que se usan aquí (si faltaran en otra versión, no se hace nada)
interface GridLayerInternals {
  _map?: unknown
  _tiles?: Record<string, { current?: boolean; active?: boolean }>
  _pruneTiles?: () => void
}

export default function MapLabelsLayer({ pane, zIndex, url, maxNativeZoom }: MapLabelsLayerProps) {
  const map = useMap()
  const layerRef = useRef<L.TileLayer | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setZooming = (zooming: boolean) => {
    map.getPane(pane)?.classList.toggle(ZOOMING_CLASS, zooming)
    if (!zooming && showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
  }

  // Espera a que las teselas de la vista actual estén cargadas y visibles (fundido terminado); hasta
  // entonces Leaflet conserva a propósito las del zoom anterior para no dejar huecos.
  const tryPrune = (attempt: number) => {
    const layer = layerRef.current as unknown as GridLayerInternals | null
    if (!layer || !layer._map || typeof layer._pruneTiles !== 'function') {
      setZooming(false)
      return
    }
    const tiles = Object.values(layer._tiles ?? {})
    const settling = tiles.some(t => t.current && !t.active)
    if (settling && attempt < PRUNE_MAX_ATTEMPTS) {
      timerRef.current = setTimeout(() => tryPrune(attempt + 1), PRUNE_DELAY_MS)
      return
    }
    layer._pruneTiles()
    setZooming(false)
  }

  const schedulePrune = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => tryPrune(0), PRUNE_DELAY_MS)
    // Un flyTo largo puede durar más que el respaldo: el plazo máximo se cuenta desde que termina
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = setTimeout(() => setZooming(false), SHOW_FALLBACK_MS)
    }
  }

  const onZoomStart = () => {
    setZooming(true)
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
    showTimerRef.current = setTimeout(() => setZooming(false), SHOW_FALLBACK_MS)
  }

  // Manejadores estables (react-leaflet vuelve a registrar los eventos si cambia el objeto): leen la
  // versión vigente de las funciones desde una referencia
  const handlersRef = useRef({ onZoomStart, schedulePrune })
  handlersRef.current = { onZoomStart, schedulePrune }
  const mapHandlers = useMemo(() => ({
    zoomstart: () => handlersRef.current.onZoomStart(),
    zoomend: () => handlersRef.current.schedulePrune(),
    moveend: () => handlersRef.current.schedulePrune()
  }), [])
  const tileHandlers = useMemo(() => ({ load: () => handlersRef.current.schedulePrune() }), [])

  useMapEvents(mapHandlers)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (showTimerRef.current) clearTimeout(showTimerRef.current)
  }, [])

  return (
    <Pane name={pane} style={{ zIndex, pointerEvents: 'none' }}>
      <TileLayer
        ref={layerRef}
        url={url}
        maxNativeZoom={maxNativeZoom}
        className="opmap-labels-layer"
        eventHandlers={tileHandlers}
      />
    </Pane>
  )
}
