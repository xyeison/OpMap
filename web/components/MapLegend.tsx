'use client'

import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { readableTextColor } from './ZoneBadgeIcon'

// Leyenda del mapa: "Ver por" (Ejecutivos Comerciales / Zonas), línea de negocio, Ejecutivos Comerciales o
// zonas con su color, estados de los territorios y capas visibles. La misma pieza va en la tarjeta de
// escritorio y en la hoja inferior de móvil.

// Zona de un Ejecutivo Comercial con varias zonas: mini-muestra con su tono en el mapa
export interface LegendZone {
  key: string
  color: string
  // Iniciales de la ciudad base ("Ch"), las mismas de la insignia en el mapa
  text: string
  // Nombre corto de la ciudad base ("Chapinero")
  title: string
}

export interface LegendEntry {
  key: string
  label: string
  detail: string
  color: string
  initials: string
  // Solo si el Ejecutivo Comercial cubre más de una zona en la línea
  zones?: LegendZone[]
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

// "Ver por" (autorizado por el dueño el 2026-10-14): mapa por Ejecutivos Comerciales (vista por línea, con el
// selector de línea) o por zonas (todas las zonas activas con kams.color)
export type LegendViewByValue = 'executives' | 'zones'
export interface LegendViewBy {
  value: LegendViewByValue
  onChange: (value: LegendViewByValue) => void
  // Sin líneas asignadas no hay vista por Ejecutivos Comerciales
  executivesDisabled?: boolean
}

const VIEW_BY_OPTIONS: { value: LegendViewByValue; label: string }[] = [
  { value: 'executives', label: 'Ejecutivos Comerciales' },
  { value: 'zones', label: 'Zonas' }
]

export interface LegendToggles {
  showIps: boolean
  onShowIps: (value: boolean) => void
  showReach: boolean
  onShowReach: (value: boolean) => void
  visitsEnabled: boolean
  onVisitsEnabled: (value: boolean) => void
}

// Filtro activo por Ejecutivo Comercial (o por zona): la lista muestra solo los filtrados
export interface LegendFilter {
  // "1 de 11" (marcados de la lista)
  text: string
  onClear: () => void
}

export interface MapLegendProps {
  // Nombre de la vista cuando no hay selector (una sola línea)
  viewLabel: string
  // "Ver por" (null: sin selector, solo la línea). En "Zonas" no se muestra la línea de negocio.
  viewBy?: LegendViewBy | null
  viewSelect: LegendViewSelect | null
  entriesTitle: string
  entries: LegendEntry[]
  emptyEntriesText: string
  highlightKey: string | null
  // Zona resaltada sola dentro del grupo highlightKey (mini-muestra); null si se resalta el grupo entero
  highlightZoneKey?: string | null
  onHighlight: (key: string | null) => void
  onHighlightZone?: (entryKey: string, zoneKey: string | null) => void
  states: LegendState[]
  markers: LegendMarkers
  notes: LegendNote[]
  toggles: LegendToggles
  // Filtro activo (null sin filtro): la lista de entradas ya viene filtrada
  filter?: LegendFilter | null
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
  viewBy = null,
  viewSelect,
  entriesTitle,
  entries,
  emptyEntriesText,
  highlightKey,
  highlightZoneKey = null,
  onHighlight,
  onHighlightZone,
  states,
  markers,
  notes,
  toggles,
  filter = null,
  touch = false,
  footer
}: MapLegendProps) {
  const rowHeight = touch ? 'min-h-[44px]' : 'min-h-[34px]'
  const viewByLabelId = useId()
  const viewByNoteId = useId()
  // En "Zonas" el mapa no depende de la línea: no se muestra su selector
  const showLine = viewBy?.value !== 'zones'

  return (
    <div className="space-y-4">
      {/* Ver por: Ejecutivos Comerciales (vista por línea) o Zonas. Botones segmentados con aria-pressed. */}
      {viewBy && (
        <div>
          <div id={viewByLabelId} className={SECTION_TITLE}>Ver por</div>
          <div role="group" aria-labelledby={viewByLabelId} className="flex w-full gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5">
            {VIEW_BY_OPTIONS.map(option => {
              const pressed = viewBy.value === option.value
              const disabled = option.value === 'executives' && !!viewBy.executivesDisabled && !pressed
              // Desactivado con aria-disabled (no disabled): sigue recibiendo foco y lee el motivo, que además se ve
              // debajo del selector (un title no se ve al tocar ni lo leen bien los lectores de pantalla)
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={pressed}
                  aria-disabled={disabled || undefined}
                  aria-describedby={disabled ? viewByNoteId : undefined}
                  onClick={() => {
                    if (!pressed && !disabled) viewBy.onChange(option.value)
                  }}
                  className={`flex-auto whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[32px]'} ${pressed ? 'bg-white text-gray-900 shadow-sm' : disabled ? 'cursor-not-allowed text-gray-600 opacity-50' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {viewBy.executivesDisabled && (
            <p id={viewByNoteId} className="mt-1.5 text-xs text-gray-500">
              Sin líneas de negocio asignadas: solo puedes ver el mapa por zonas.
            </p>
          )}
        </div>
      )}

      {/* Línea de negocio (vista por Ejecutivos Comerciales): selector si hay varias, nombre si hay una */}
      {showLine && (
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
      )}

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
        {filter && (
          // Filtro activo: aviso con la cuenta y "Quitar filtro" (el resaltado sigue funcionando)
          <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-gray-100 pl-2.5 pr-1">
            <span className="min-w-0 truncate text-xs text-gray-700">Filtro: {filter.text}</span>
            <button
              type="button"
              onClick={filter.onClear}
              className={`flex-shrink-0 rounded-md px-2 text-xs font-medium text-gray-900 underline underline-offset-2 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[28px]'}`}
            >
              Quitar filtro
            </button>
          </div>
        )}
        {entries.length === 0 ? (
          <p className="text-xs text-gray-500">{emptyEntriesText}</p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map(entry => {
              const active = highlightKey === entry.key
              const faded = !!highlightKey && !active
              // Fila resaltada entera (no solo una de sus zonas)
              const wholeActive = active && !highlightZoneKey
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    aria-pressed={wholeActive}
                    // Toque en la fila: resalta todas sus zonas; si ya estaban todas, quita el resaltado
                    onClick={() => onHighlight(wholeActive ? null : entry.key)}
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
                  {entry.zones && entry.zones.length > 1 && onHighlightZone && (
                    // Una mini-muestra por zona con su tono; tocarla resalta solo esa zona
                    <div className={`flex flex-wrap gap-1 pl-[34px] ${touch ? 'pb-1' : 'pb-1.5 -mt-0.5'} ${faded ? 'opacity-50' : ''}`}>
                      {entry.zones.map(zone => {
                        const zoneActive = active && highlightZoneKey === zone.key
                        return (
                          <button
                            key={zone.key}
                            type="button"
                            title={zone.title}
                            aria-label={`Resaltar solo la zona ${zone.title}`}
                            aria-pressed={zoneActive}
                            onClick={() => onHighlightZone(entry.key, zoneActive ? null : zone.key)}
                            className={`inline-flex items-center gap-1 rounded-full pl-1 pr-1.5 text-[11px] font-medium text-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[24px]'} ${zoneActive ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100'}`}
                          >
                            <span aria-hidden="true" className="opmap-legend-dot opmap-legend-dot--zone" style={{ backgroundColor: zone.color }} />
                            <span aria-hidden="true">{zone.text}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
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
