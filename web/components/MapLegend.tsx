'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { readableTextColor } from './ZoneBadgeIcon'

// Leyenda del mapa: vista (línea / zonas), Ejecutivos Comerciales o zonas con su color, estados de
// los territorios y capas visibles. La misma pieza va en la tarjeta de escritorio y en la hoja
// inferior de móvil.

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
  // Vista por línea con zonas vacantes: color de sus IPS (null si no hay vacantes)
  vacantIpsColor?: string | null
}

export interface LegendNote {
  tone: 'info' | 'warn' | 'error'
  text: string
}

export interface LegendViewSelect {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export interface LegendToggles {
  showIps: boolean
  onShowIps: (value: boolean) => void
  showReach: boolean
  onShowReach: (value: boolean) => void
  visitsEnabled: boolean
  onVisitsEnabled: (value: boolean) => void
}

export interface MapLegendProps {
  // Nombre de la vista cuando no hay selector (una sola línea)
  viewLabel: string
  viewSelect: LegendViewSelect | null
  entriesTitle: string
  entries: LegendEntry[]
  emptyEntriesText: string
  highlightKey: string | null
  onHighlight: (key: string | null) => void
  states: LegendState[]
  markers: LegendMarkers
  notes: LegendNote[]
  toggles: LegendToggles
  // Táctil: filas de al menos 44 px
  touch?: boolean
  footer?: ReactNode
}

const NOTE_CLASSES: Record<LegendNote['tone'], string> = {
  info: 'text-gray-500',
  warn: 'text-amber-700',
  error: 'text-red-700'
}

function Switch({ checked, onChange, label, touch }: { checked: boolean; onChange: (value: boolean) => void; label: string; touch: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between gap-3 text-left text-sm text-gray-800 rounded-lg px-1 -mx-1 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[32px]'}`}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5'

export default function MapLegend({
  viewLabel,
  viewSelect,
  entriesTitle,
  entries,
  emptyEntriesText,
  highlightKey,
  onHighlight,
  states,
  markers,
  notes,
  toggles,
  touch = false,
  footer
}: MapLegendProps) {
  const rowHeight = touch ? 'min-h-[44px]' : 'min-h-[34px]'

  return (
    <div className="space-y-4">
      {/* Vista: línea de negocio o vista de zonas */}
      <div>
        <label htmlFor="map-view-select" className={SECTION_TITLE + ' block'}>
          Línea de negocio
        </label>
        {viewSelect ? (
          <select
            id="map-view-select"
            value={viewSelect.value}
            onChange={e => viewSelect.onChange(e.target.value)}
            className={`w-full px-3 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 ${touch ? 'h-11' : 'h-9'}`}
          >
            {viewSelect.options.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <div className="text-sm font-medium text-gray-900">{viewLabel}</div>
        )}
      </div>

      {/* Ejecutivos Comerciales (o zonas / regiones): clic para resaltar su territorio */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className={SECTION_TITLE}>{entriesTitle}</div>
          {highlightKey && (
            <button
              type="button"
              onClick={() => onHighlight(null)}
              className={`text-xs font-medium text-gray-700 underline underline-offset-2 mb-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px] px-2 -mr-2' : ''}`}
            >
              Ver todos
            </button>
          )}
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-gray-500">{emptyEntriesText}</p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map(entry => {
              const active = highlightKey === entry.key
              const faded = !!highlightKey && !active
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onHighlight(active ? null : entry.key)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-1.5 -mx-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${rowHeight} ${active ? 'bg-gray-100' : 'hover:bg-gray-50'} ${faded ? 'opacity-50' : ''}`}
                  >
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
                  </button>
                </li>
              )
            })}
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
              <span className="flex-1">IPS de zona vacante en la línea</span>
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

      {/* Capas visibles */}
      <div>
        <div className={SECTION_TITLE}>Mostrar</div>
        <div className="space-y-0.5">
          <Switch label="Puntos de IPS" checked={toggles.showIps} onChange={toggles.onShowIps} touch={touch} />
          <Switch label="Municipios de alcance" checked={toggles.showReach} onChange={toggles.onShowReach} touch={touch} />
          <Switch label="Visitas" checked={toggles.visitsEnabled} onChange={toggles.onVisitsEnabled} touch={touch} />
        </div>
      </div>

      {footer}
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
