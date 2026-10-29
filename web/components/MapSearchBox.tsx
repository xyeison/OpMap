'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buscarTerritorios, MIN_LETRAS, type TerritorioBuscable } from '@/lib/buscar-territorios'

// Buscador del mapa (dueño, 2026-10-28; el único desde el 2026-10-29): al escribir "Yop" sale "Yopal, Casanare"; al
// elegirlo, el mapa va ahí (onSelect). Busca sin tildes en municipios, departamentos, localidades, la ciudad de Bogotá e
// IPS (lib/buscar-territorios.ts). Teclado: flechas, Enter (el resaltado o el primero) y Escape.

interface MapSearchBoxProps {
  territorios: readonly TerritorioBuscable[]
  onSelect: (territorio: TerritorioBuscable) => void
  className?: string
}

export default function MapSearchBox({ territorios, onSelect, className = '' }: MapSearchBoxProps) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listaId = useId()

  const resultados = useMemo(() => buscarTerritorios(texto, territorios), [texto, territorios])
  const mostrarLista = abierto && texto.trim().length >= MIN_LETRAS

  const elegir = (territorio: TerritorioBuscable) => {
    setTexto(territorio.nombre)
    setAbierto(false)
    // En el teléfono se cierra el teclado para ver el mapa
    inputRef.current?.blur()
    onSelect(territorio)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setAbierto(true)
      setResaltado(i => Math.min(i + 1, Math.max(resultados.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setResaltado(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      const elegido = resultados[resaltado] ?? resultados[0]
      if (elegido) {
        event.preventDefault()
        elegir(elegido)
      }
    } else if (event.key === 'Escape') {
      setAbierto(false)
    }
  }

  return (
    // Con la lista abierta va por encima del panel de Filtros (z 9995) y de la hoja del celular; cerrada, debajo
    <div className={`${mostrarLista ? 'z-[9997]' : 'z-[1000]'} ${className}`}>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-label="Buscar municipio, departamento o IPS"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Buscar municipio, departamento o IPS…"
          value={texto}
          onChange={event => {
            setTexto(event.target.value)
            setResaltado(0)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          // Se cierra después del clic en un resultado (onMouseDown del resultado evita perder el foco antes)
          onBlur={() => setAbierto(false)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white/95 pl-9 pr-9 text-sm text-gray-900 shadow-[0_4px_20px_rgba(15,23,42,0.12)] backdrop-blur-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-700 [&::-webkit-search-cancel-button]:hidden"
        />
        {texto && (
          <button
            type="button"
            aria-label="Borrar la búsqueda"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              setTexto('')
              setResaltado(0)
              inputRef.current?.focus()
            }}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {mostrarLista && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Resultados de la búsqueda"
          className="mt-1 max-h-[min(60vh,22rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_4px_20px_rgba(15,23,42,0.12)]"
        >
          {resultados.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">Nada coincide</li>
          ) : (
            resultados.map((territorio, index) => (
              <li
                key={`${territorio.tipo}-${territorio.code}`}
                role="option"
                aria-selected={index === resaltado}
                // onMouseDown: elegir antes de que el campo pierda el foco y se cierre la lista
                onMouseDown={event => {
                  event.preventDefault()
                  elegir(territorio)
                }}
                onMouseEnter={() => setResaltado(index)}
                className={`flex min-h-[44px] cursor-pointer items-center px-3 py-1.5 text-sm ${index === resaltado ? 'bg-gray-100' : ''}`}
              >
                {/* Dos renglones: el nombre largo de una IPS se corta sin esconder su municipio */}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{territorio.nombre}</span>
                  {territorio.detalle && <span className="block truncate text-xs text-gray-500">{territorio.detalle}</span>}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
