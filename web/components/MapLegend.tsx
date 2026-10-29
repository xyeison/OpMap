'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { readableTextColor } from './ZoneBadgeIcon'

// Leyenda del mapa, SOLO PARA LEER (dueño, 2026-10-29, docs/specs/2026-10-29-mapa-filtros-y-leyenda.md): qué significa
// cada color (Ejecutivos Comerciales o Zonas de la vista, solo los que se ven), cada estado de territorio y cada
// marcador. La vista, "Ver solo" y lo que se muestra se eligen en el panel de Filtros (MapControls). La misma pieza va
// en la tarjeta de escritorio y en la hoja inferior de móvil.

export interface LegendEntry {
  key: string
  label: string
  detail: string
  color: string
  initials: string
}

export interface LegendState {
  key: string
  label: string
  swatch: CSSProperties
  count?: number | null
}

// Muestras de los marcadores (mismos colores que en el mapa)
export interface LegendMarkers {
  ipsColor: string
  unzonedIpsColor: string
  zoneColor: string
  zoneTextColor: string
  zoneText: string
  clusterColor: string
  clusterTextColor: string
  // Vista por línea con Zonas sin cobertura: color de sus IPS (null si no hay ninguna)
  vacantIpsColor?: string | null
}

export interface LegendNote {
  tone: 'info' | 'warn' | 'error'
  text: string
}

export interface MapLegendProps {
  entriesTitle: string
  entries: LegendEntry[]
  emptyEntriesText: string
  states: LegendState[]
  markers: LegendMarkers
  notes: LegendNote[]
  // Táctil: filas de al menos 44 px
  touch?: boolean
}

const NOTE_CLASSES: Record<LegendNote['tone'], string> = {
  info: 'text-gray-500',
  warn: 'text-amber-700',
  error: 'text-red-700'
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5'

export default function MapLegend({ entriesTitle, entries, emptyEntriesText, states, markers, notes, touch = false }: MapLegendProps) {
  const rowHeight = touch ? 'min-h-[44px]' : 'min-h-[34px]'

  return (
    <div className="space-y-4">
      {/* Colores de la vista: Ejecutivos Comerciales o Zonas (solo los que se ven) */}
      <div>
        <div className={SECTION_TITLE}>{entriesTitle}</div>
        {entries.length === 0 ? (
          <p className="text-xs text-gray-500">{emptyEntriesText}</p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map(entry => (
              <li key={entry.key} className={`flex items-center gap-2.5 ${rowHeight}`}>
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: entry.color, color: readableTextColor(entry.color) }}
                >
                  {entry.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-900">{entry.label}</span>
                  <span className="block truncate text-xs text-gray-500">{entry.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Estados de los territorios */}
      <div>
        <div className={SECTION_TITLE}>Territorios</div>
        <ul className="space-y-1.5">
          {states.map(state => (
            <li key={state.key} className="flex items-center gap-2.5 text-sm text-gray-800">
              <span aria-hidden="true" className="inline-block h-3 w-7 flex-shrink-0 rounded-[3px]" style={state.swatch} />
              <span className="flex-1 min-w-0">{state.label}</span>
              {state.count !== undefined && state.count !== null && (
                <span className="text-xs tabular-nums text-gray-500">{state.count}</span>
              )}
            </li>
          ))}
        </ul>
        {notes.length > 0 && (
          <div className="mt-2 space-y-1">
            {notes.map(note => (
              <p key={note.text} className={`text-xs ${NOTE_CLASSES[note.tone]}`}>{note.text}</p>
            ))}
          </div>
        )}
      </div>

      {/* Marcadores: punto de IPS, IPS sin zona, insignia de zona y racimo */}
      <div>
        <div className={SECTION_TITLE}>Marcadores</div>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2.5 text-sm text-gray-800">
            <span aria-hidden="true" className="inline-flex w-7 justify-center flex-shrink-0">
              <span className="opmap-legend-dot" style={{ backgroundColor: markers.ipsColor }} />
            </span>
            <span className="flex-1">IPS (más grande, más camas)</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-gray-800">
            <span aria-hidden="true" className="inline-flex w-7 justify-center flex-shrink-0">
              <span className="opmap-legend-dot opmap-legend-dot--small" style={{ backgroundColor: markers.unzonedIpsColor }} />
            </span>
            <span className="flex-1">IPS sin zona</span>
          </li>
          {markers.vacantIpsColor && (
            <li className="flex items-center gap-2.5 text-sm text-gray-800">
              <span aria-hidden="true" className="inline-flex w-7 justify-center flex-shrink-0">
                <span className="opmap-legend-dot" style={{ backgroundColor: markers.vacantIpsColor }} />
              </span>
              <span className="flex-1">IPS de Zona sin cobertura en la línea</span>
            </li>
          )}
          <li className="flex items-center gap-2.5 text-sm text-gray-800">
            <span aria-hidden="true" className="inline-flex w-7 justify-center flex-shrink-0">
              <span className="opmap-legend-badge" style={{ backgroundColor: markers.zoneColor, color: markers.zoneTextColor }}>
                {markers.zoneText}
              </span>
            </span>
            <span className="flex-1">Zona (iniciales de la ciudad base)</span>
          </li>
          <li className="flex items-center gap-2.5 text-sm text-gray-800">
            <span aria-hidden="true" className="inline-flex w-7 justify-center flex-shrink-0">
              <span className="opmap-legend-badge opmap-legend-badge--cluster" style={{ backgroundColor: markers.clusterColor, color: markers.clusterTextColor }}>
                3
              </span>
            </span>
            <span className="flex-1">Varias zonas juntas (toca para acercar)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// Tarjeta flotante de escritorio (abajo a la izquierda), plegable. El estado plegado puede venir de
// fuera (el mapa no reserva el ancho de la leyenda al acercar a un racimo si está plegada).
export function MapLegendCard({
  title,
  subtitle,
  collapsed: collapsedProp,
  onCollapsedChange,
  children
}: {
  title: string
  subtitle?: string | null
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  children: ReactNode
}) {
  const [collapsedState, setCollapsedState] = useState(false)
  const collapsed = collapsedProp ?? collapsedState
  const setCollapsed = (update: (value: boolean) => boolean) => {
    const next = update(collapsed)
    if (collapsedProp === undefined) setCollapsedState(next)
    onCollapsedChange?.(next)
  }
  return (
    <section
      aria-label="Leyenda del mapa"
      className="absolute left-4 bottom-7 z-[1000] flex w-[300px] max-h-[min(72vh,calc(100%_-_5rem))] flex-col rounded-xl border border-gray-200/70 bg-white/[0.92] shadow-[0_4px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm"
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
          {subtitle && <div className="truncate text-xs text-gray-500">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(value => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Mostrar la leyenda' : 'Ocultar la leyenda'}
          className="flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          {collapsed ? 'Mostrar' : 'Ocultar'}
        </button>
      </header>
      {!collapsed && <div className="overflow-y-auto px-4 py-3">{children}</div>}
    </section>
  )
}
