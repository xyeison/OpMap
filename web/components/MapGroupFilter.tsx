'use client'

import { alternarVerSolo } from '@/lib/mapa-ver-solo'
import { readableTextColor } from './ZoneBadgeIcon'

// Lista de la leyenda del mapa: los Ejecutivos Comerciales (vista por línea) o las Zonas (vista de zonas) con su color.
// Es la clave de colores y, al tocar, "Ver solo" (dueño, 2026-10-29: una sola lista, en la leyenda; spec
// docs/specs/2026-10-29-mapa-filtros-y-leyenda.md). Tocar a alguien deja solo lo suyo en color y lo demás casi blanco;
// tocar otra la suma; tocar una marcada la quita; "Ver todos" vuelve a todo (lib/mapa-ver-solo.ts). Filas de al menos
// 44 px en táctil.

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
  options: GroupFilterOption[]
  // null = sin filtro (se ve todo)
  selected: ReadonlySet<string> | null
  onChange: (ids: string[] | null) => void
}

// "1 ejecutiva" / "3 ejecutivas" (vista por línea), "1 zona" / "3 zonas" (vista de zonas)
export function groupFilterChipLabel(kind: GroupFilterConfig['kind'], count: number): string {
  if (kind === 'executive') return `${count} ${count === 1 ? 'ejecutiva' : 'ejecutivas'}`
  return `${count} ${count === 1 ? 'zona' : 'zonas'}`
}

// Ids marcados que siguen en la lista, en su orden (un enlace compartido puede traer ids de otra línea)
export function selectedOptionIds(config: Pick<GroupFilterConfig, 'options' | 'selected'>): string[] {
  const { options, selected } = config
  return options.filter(o => selected === null || selected.has(o.id)).map(o => o.id)
}

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'

export default function MapGroupFilter({ config, touch = false }: { config: GroupFilterConfig; touch?: boolean }) {
  const { kind, options, selected, onChange } = config
  const allIds = options.map(o => o.id)
  const filtered = selected !== null
  const marked = filtered ? selectedOptionIds(config) : []
  const titleId = `opmap-ver-solo-${kind}`

  return (
    <div role="group" aria-labelledby={titleId} className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div id={titleId} className={SECTION_TITLE}>{kind === 'executive' ? 'Ejecutivos Comerciales' : 'Zonas'}</div>
        {filtered && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-md px-2 text-xs font-medium text-gray-900 underline underline-offset-2 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[28px]'}`}
          >
            Ver todos
          </button>
        )}
      </div>

      {options.length === 0 ? (
        <p className="mt-0.5 text-xs text-gray-500">{kind === 'executive' ? 'Nadie lleva esta línea todavía.' : 'Sin zonas.'}</p>
      ) : (
        <>
          <p className="mt-0.5 mb-1.5 text-xs text-gray-500" aria-live="polite">
            {!filtered
              ? `Toca ${kind === 'executive' ? 'a alguien' : 'una Zona'} para ver solo lo suyo; toca otro para sumarlo.`
              : marked.length === 0
                ? 'Nadie marcado: solo el contexto del país.'
                : `Viendo ${marked.length} de ${options.length}.`}
          </p>
          <ul className="space-y-0.5">
            {options.map(option => {
              const pressed = filtered && selected.has(option.id)
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onChange(alternarVerSolo(filtered ? marked : null, option.id, allIds))}
                    className={`-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[34px]'} ${pressed ? 'bg-gray-100' : 'hover:bg-gray-50'} ${filtered && !pressed ? 'opacity-50' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white shadow-sm"
                      style={{ backgroundColor: option.color, color: readableTextColor(option.color) }}
                    >
                      {option.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{option.label}</span>
                      <span className="block truncate text-xs text-gray-500">{option.detail}</span>
                    </span>
                    {pressed && (
                      <svg className="h-4 w-4 flex-shrink-0 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
