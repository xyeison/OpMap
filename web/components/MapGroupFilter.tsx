'use client'

import { readableTextColor } from './ZoneBadgeIcon'

// Filtro principal del mapa: por Ejecutivo Comercial en la vista por línea y por zona en la vista de
// zonas. Casillas múltiples, "Todos" / "Ninguno" y "Solo" por fila. Sin filtro (null) todas las casillas
// aparecen marcadas; marcar todas vuelve a "sin filtro". Va en la pestaña "Filtros" del panel de
// escritorio y de la hoja inferior de móvil (filas de al menos 44 px en táctil).

export interface GroupFilterOption {
  id: string
  label: string
  // "2 zonas · 30 IPS"
  detail: string
  color: string
  initials: string
}

export interface GroupFilterConfig {
  kind: 'executive' | 'zone'
  // "Ejecutivos Comerciales" | "Zonas"
  title: string
  options: GroupFilterOption[]
  // null = sin filtro (se ve todo)
  selected: ReadonlySet<string> | null
  onChange: (ids: string[] | null) => void
  showVacant: boolean
  onShowVacantChange: (value: boolean) => void
  // Qué incluye "Mostrar vacantes" en esta vista
  vacantHint: string
}

// "1 ejecutiva" / "3 ejecutivas" (vista por línea), "1 zona" / "3 zonas" (vista de zonas)
export function groupFilterChipLabel(kind: GroupFilterConfig['kind'], count: number): string {
  if (kind === 'executive') return `${count} ${count === 1 ? 'ejecutiva' : 'ejecutivas'}`
  return `${count} ${count === 1 ? 'zona' : 'zonas'}`
}

// Ids marcados que siguen en la lista (un enlace compartido puede traer ids de otra línea)
export function selectedOptionIds(config: Pick<GroupFilterConfig, 'options' | 'selected'>): string[] {
  const { options, selected } = config
  return options.filter(o => selected === null || selected.has(o.id)).map(o => o.id)
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'

export default function MapGroupFilter({ config, touch = false }: { config: GroupFilterConfig; touch?: boolean }) {
  const { kind, title, options, selected, onChange, showVacant, onShowVacantChange, vacantHint } = config
  const allIds = options.map(o => o.id)
  const checkedIds = selectedOptionIds(config)
  const checkedCount = checkedIds.length
  const filtered = selected !== null

  // Siempre en el orden de la lista; si quedan todas marcadas se quita el filtro
  const emit = (ids: Set<string>) => {
    const next = allIds.filter(id => ids.has(id))
    onChange(next.length === allIds.length && allIds.length > 0 ? null : next)
  }

  const toggle = (id: string) => {
    const next = new Set(checkedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    emit(next)
  }

  const only = (id: string) => emit(new Set([id]))

  const rowHeight = touch ? 'min-h-[44px]' : 'min-h-[40px]'
  const actionClass = `text-xs font-medium rounded-md px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-40 disabled:cursor-default ${touch ? 'min-h-[44px] min-w-[44px]' : 'min-h-[28px]'}`
  const noun = kind === 'executive' ? 'Ejecutivos Comerciales' : 'zonas'
  const titleId = `opmap-filtro-${kind}-titulo`

  return (
    <div role="group" aria-labelledby={titleId} className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div id={titleId} className={SECTION_TITLE}>{title}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={!filtered}
            className={`${actionClass} text-gray-700 hover:bg-gray-100`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={filtered && checkedCount === 0}
            className={`${actionClass} text-gray-700 hover:bg-gray-100`}
          >
            Ninguno
          </button>
        </div>
      </div>

      <p className="mt-0.5 mb-2 text-xs text-gray-500" aria-live="polite">
        {!filtered
          ? `Sin filtro: se ven ${kind === 'executive' ? 'los' : 'las'} ${options.length} ${noun}`
          : checkedCount === 0
            ? 'Ninguno marcado: solo el contexto gris del país'
            : `Solo ${checkedCount} de ${options.length} ${noun}`}
      </p>

      {options.length === 0 ? (
        <p className="text-xs text-gray-500">{kind === 'executive' ? 'Nadie lleva esta línea todavía.' : 'Sin zonas.'}</p>
      ) : (
        <ul className={`space-y-0.5 ${touch ? '' : 'max-h-64 overflow-y-auto -mx-1 px-1'}`}>
          {options.map(option => {
            const checked = selected === null || selected.has(option.id)
            const inputId = `opmap-filtro-${kind}-${option.id}`
            return (
              <li key={option.id} className={`flex items-center gap-1 rounded-lg ${checked && filtered ? 'bg-gray-50' : ''}`}>
                <label
                  htmlFor={inputId}
                  className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 ${rowHeight} hover:bg-gray-50`}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.id)}
                    className="h-4 w-4 flex-shrink-0 accent-gray-900"
                  />
                  <span
                    aria-hidden="true"
                    className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: option.color, color: readableTextColor(option.color) }}
                  >
                    {option.initials}
                  </span>
                  <span className={`min-w-0 flex-1 ${checked ? '' : 'opacity-60'}`}>
                    <span className="block truncate text-sm text-gray-900">{option.label}</span>
                    <span className="block truncate text-xs text-gray-500">{option.detail}</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => only(option.id)}
                  aria-label={`Ver solo ${option.label}`}
                  className={`${actionClass} flex-shrink-0 text-gray-500 hover:bg-gray-100 hover:text-gray-900`}
                >
                  Solo
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Zonas vacantes e IPS sin zona: visibles por defecto sin filtro, ocultas con filtro */}
      <button
        type="button"
        role="switch"
        aria-checked={showVacant}
        onClick={() => onShowVacantChange(!showVacant)}
        className={`mt-2 w-full flex items-center justify-between gap-3 rounded-lg px-1.5 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[52px] py-1.5' : 'min-h-[40px] py-1'}`}
      >
        <span className="min-w-0">
          <span className="block text-sm text-gray-900">Mostrar vacantes</span>
          <span className="block text-xs text-gray-500">{vacantHint}</span>
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${showVacant ? 'bg-gray-900' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${showVacant ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
    </div>
  )
}
