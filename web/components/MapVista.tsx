'use client'

import { useId } from 'react'

// "Vista" del panel de Filtros del mapa (desde el 2026-10-29 aquí y no en la leyenda): ver por Ejecutivos Comerciales
// (mapa por línea de negocio) o por Zonas (cada Zona con su color), y la línea de negocio en la vista por Ejecutivos
// Comerciales (autorizado por el dueño el 2026-10-14).

export type MapVistaPor = 'executives' | 'zones'

export interface MapVistaConfig {
  por: MapVistaPor
  onPorChange: (value: MapVistaPor) => void
  // Sin líneas asignadas no hay vista por Ejecutivos Comerciales
  sinLineas: boolean
  // Línea de negocio: selector con varias, nombre con una (null en la vista de zonas)
  linea: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void } | null
  lineaNombre: string | null
}

const OPCIONES: { value: MapVistaPor; label: string }[] = [
  { value: 'executives', label: 'Ejecutivos Comerciales' },
  { value: 'zones', label: 'Zonas' }
]

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5'

export default function MapVista({ config, touch = false }: { config: MapVistaConfig; touch?: boolean }) {
  const tituloId = useId()
  const notaId = useId()
  const { por, onPorChange, sinLineas, linea, lineaNombre } = config

  return (
    <div className="space-y-3">
      <div>
        <div id={tituloId} className={SECTION_TITLE}>Ver por</div>
        <div role="group" aria-labelledby={tituloId} className="flex w-full gap-0.5 rounded-lg border border-gray-200 bg-gray-100 p-0.5">
          {OPCIONES.map(opcion => {
            const elegida = por === opcion.value
            const desactivada = opcion.value === 'executives' && sinLineas && !elegida
            // aria-disabled (no disabled): sigue recibiendo foco y lee el motivo, que además se ve debajo
            return (
              <button
                key={opcion.value}
                type="button"
                aria-pressed={elegida}
                aria-disabled={desactivada || undefined}
                aria-describedby={desactivada ? notaId : undefined}
                onClick={() => {
                  if (!elegida && !desactivada) onPorChange(opcion.value)
                }}
                className={`flex-auto whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${touch ? 'min-h-[44px]' : 'min-h-[32px]'} ${elegida ? 'bg-white text-gray-900 shadow-sm' : desactivada ? 'cursor-not-allowed text-gray-600 opacity-50' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {opcion.label}
              </button>
            )
          })}
        </div>
        {sinLineas && (
          <p id={notaId} className="mt-1.5 text-xs text-gray-500">
            Sin líneas de negocio asignadas: solo puedes ver el mapa por zonas.
          </p>
        )}
      </div>

      {por === 'executives' && (linea || lineaNombre) && (
        <div>
          <label htmlFor="map-linea" className={SECTION_TITLE + ' block'}>
            Línea de negocio
          </label>
          {linea ? (
            <select
              id="map-linea"
              value={linea.value}
              onChange={event => linea.onChange(event.target.value)}
              className={`w-full px-3 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 ${touch ? 'h-11' : 'h-9'}`}
            >
              {linea.options.map(opcion => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          ) : (
            <div className="text-sm font-medium text-gray-900">{lineaNombre}</div>
          )}
        </div>
      )}
    </div>
  )
}
