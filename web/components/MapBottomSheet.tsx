'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

// Hoja inferior del mapa en móvil (< 768 px): el mapa ocupa toda la pantalla y la leyenda,
// el selector de línea y los filtros viven aquí. Tres alturas: asomada (nombre de la línea y
// botones "Filtros" y "Leyenda"), media (leyenda) y completa (filtros de visitas y búsqueda).
// Se arrastra desde el asa o se cambia con los botones.

export type SheetSnap = 'peek' | 'mid' | 'full'

// Alto asomado; globals.css sube los controles de Leaflet esta misma altura (.opmap-map--mobile)
export const SHEET_PEEK_PX = 64
// Alto de la cabecera compacta de /map en móvil (NavigationWithPermissions)
const HEADER_PX = 48

function snapHeights(viewportHeight: number): Record<SheetSnap, number> {
  const max = Math.max(SHEET_PEEK_PX + 120, viewportHeight - HEADER_PX - 8)
  return {
    peek: SHEET_PEEK_PX,
    mid: Math.round(Math.min(viewportHeight * 0.45, max)),
    full: Math.round(Math.min(viewportHeight * 0.9, max))
  }
}

const viewportHeight = () => (typeof window === 'undefined' ? 800 : window.innerHeight)

interface MapBottomSheetProps {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  title: string
  subtitle?: string | null
  // Leyenda (altura media)
  children: ReactNode
  // Filtros de visitas y búsqueda (altura completa); se mantiene montado para no perder su estado
  secondary?: ReactNode
  // Filtro activo ("1 ejecutiva"): el botón "Filtros" de la barra pasa a ser este chip
  filterChip?: string | null
  // Al tocar "Filtros" (o el chip): abre la pestaña de filtros
  onOpenFilters?: () => void
}

interface DragState {
  pointerId: number
  startY: number
  startHeight: number
  height: number
  moved: boolean
}

export default function MapBottomSheet({ snap, onSnapChange, title, subtitle, children, secondary, filterChip = null, onOpenFilters }: MapBottomSheetProps) {
  const [vh, setVh] = useState(viewportHeight)
  const [drag, setDrag] = useState<DragState | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const secondaryRef = useRef<HTMLDivElement>(null)
  const scrollToSecondary = useRef(false)

  useEffect(() => {
    const onResize = () => setVh(viewportHeight())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])

  // Al volver a la altura asomada, el contenido regresa arriba; al pedir los filtros, baja hasta ellos
  useEffect(() => {
    if (snap === 'peek' && contentRef.current) contentRef.current.scrollTop = 0
    if (snap === 'full' && scrollToSecondary.current && contentRef.current && secondaryRef.current) {
      scrollToSecondary.current = false
      contentRef.current.scrollTo({ top: secondaryRef.current.offsetTop - 8, behavior: 'smooth' })
    }
  }, [snap])

  const heights = snapHeights(vh)
  const visibleHeight = drag ? drag.height : heights[snap]
  const contentVisible = snap !== 'peek' || !!drag

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Los botones de la cabecera manejan su propio toque
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ pointerId: e.pointerId, startY: e.clientY, startHeight: heights[snap], height: heights[snap], moved: false })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const delta = drag.startY - e.clientY
    const height = Math.min(heights.full, Math.max(heights.peek, drag.startHeight + delta))
    setDrag({ ...drag, height, moved: drag.moved || Math.abs(delta) > 6 })
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!drag.moved) {
      // Toque sobre el asa: alterna entre asomada y media
      onSnapChange(snap === 'peek' ? 'mid' : 'peek')
    } else {
      // Altura más cercana a donde se soltó
      const nearest = (Object.keys(heights) as SheetSnap[]).reduce((best, key) =>
        Math.abs(heights[key] - drag.height) < Math.abs(heights[best] - drag.height) ? key : best
      , 'peek' as SheetSnap)
      onSnapChange(nearest)
    }
    setDrag(null)
  }

  return (
    <section
      aria-label="Leyenda y controles del mapa"
      className="fixed inset-x-0 bottom-0 z-[1100] md:hidden"
      style={{
        height: heights.full,
        transform: `translateY(${heights.full - visibleHeight}px)`,
        transition: drag ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
      }}
    >
      <div className="flex h-full flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-[0_-6px_24px_rgba(15,23,42,0.14)]">
        <div
          className="flex-shrink-0 touch-none select-none px-4 pt-2"
          style={{ height: SHEET_PEEK_PX }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-gray-300" aria-hidden="true" />
          <div className="mt-1.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-gray-900">{title}</div>
              {subtitle && <div className="truncate text-xs text-gray-500">{subtitle}</div>}
            </div>
            {secondary && snap !== 'full' && (
              <button
                type="button"
                onClick={() => {
                  scrollToSecondary.current = true
                  onOpenFilters?.()
                  onSnapChange('full')
                }}
                aria-controls="opmap-sheet-content"
                aria-label={filterChip ? `Filtros: ${filterChip}` : undefined}
                className={`min-h-[44px] flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 ${
                  filterChip ? 'border-gray-900 bg-gray-100 active:bg-gray-200' : 'border-gray-300 bg-white active:bg-gray-50'
                }`}
              >
                {filterChip && (
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                )}
                <span className="whitespace-nowrap">{filterChip || 'Filtros'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onSnapChange(snap === 'peek' ? 'mid' : 'peek')}
              aria-expanded={snap !== 'peek'}
              aria-controls="opmap-sheet-content"
              className="min-h-[44px] flex-shrink-0 rounded-full bg-gray-900 px-4 text-sm font-medium text-white active:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              {snap === 'peek' ? 'Leyenda' : 'Cerrar'}
            </button>
          </div>
        </div>
        <div
          ref={contentRef}
          id="opmap-sheet-content"
          className="relative flex-1 overflow-y-auto overscroll-contain px-4 pt-2"
          style={{
            visibility: contentVisible ? 'visible' : 'hidden',
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))'
          }}
        >
          {children}
          {secondary && (
            <div ref={secondaryRef} className="mt-5 border-t border-gray-100 pt-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Filtros, visitas y búsqueda</div>
              {secondary}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
