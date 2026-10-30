'use client'

// Buscador de sedes para vincular médicos: GET /api/terceros/sedes?q=&municipio= →
// { items: [{ id, nombre, cuenta_id, cuenta_nombre, ciudad, reps_code }] }.
import { useEffect, useRef, useState } from 'react'
import type { SedeBusquedaItem } from '@/lib/terceros'
import { claseInput, itemsDe, mensajeError, mensajeExcepcion, pedirJson } from './comun'

interface Props {
  onElegir: (sede: SedeBusquedaItem) => void
  /** Ids de sedes ya elegidas (no se ofrecen otra vez). */
  excluir: string[]
  /** Municipio del médico: permite limitar la búsqueda a su ciudad. */
  municipio?: string | null
  ciudad?: string | null
  disabled?: boolean
}

export default function SedeBuscador({ onElegir, excluir, municipio, ciudad, disabled = false }: Props) {
  const [texto, setTexto] = useState('')
  const [soloCiudad, setSoloCiudad] = useState(false)
  const [resultados, setResultados] = useState<SedeBusquedaItem[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')
  const [buscado, setBuscado] = useState(false)
  const turno = useRef(0)

  const filtrarCiudad = soloCiudad && Boolean(municipio)
  const termino = texto.trim()

  useEffect(() => {
    if (termino.length < 2 && !filtrarCiudad) {
      turno.current++ // descarta una búsqueda que siga en camino
      setResultados([])
      setBuscando(false)
      setBuscado(false)
      setError('')
      return
    }
    const miTurno = ++turno.current
    const temporizador = setTimeout(async () => {
      setBuscando(true)
      setError('')
      try {
        const parametros = new URLSearchParams()
        if (termino) parametros.set('q', termino)
        if (filtrarCiudad && municipio) parametros.set('municipio', municipio)
        const respuesta = await pedirJson(`/api/terceros/sedes?${parametros.toString()}`)
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron buscar las sedes'))
        setResultados(itemsDe<SedeBusquedaItem>(respuesta.data))
        setBuscado(true)
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudieron buscar las sedes'))
        setResultados([])
      } finally {
        if (miTurno === turno.current) setBuscando(false)
      }
    }, 300)
    return () => clearTimeout(temporizador)
  }, [termino, filtrarCiudad, municipio])

  const visibles = resultados.filter(sede => !excluir.includes(sede.id))

  return (
    <div className="space-y-2 min-w-0">
      <input
        type="search"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Busca la sede por nombre, cuenta o código de habilitación..."
        className={claseInput}
        disabled={disabled}
        aria-label="Buscar sede"
      />
      {municipio && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soloCiudad} onChange={e => setSoloCiudad(e.target.checked)} disabled={disabled} />
          Solo sedes en {ciudad || 'la ciudad del médico'}
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {buscando && <p className="text-sm text-gray-500">Buscando...</p>}
      {!buscando && buscado && visibles.length === 0 && !error && (
        <p className="text-sm text-gray-500">No se encontraron sedes con esa búsqueda.</p>
      )}
      {visibles.length > 0 && (
        <ul className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visibles.map(sede => (
            <li key={sede.id}>
              <button
                type="button"
                onClick={() => onElegir(sede)}
                disabled={disabled}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 min-w-0 disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-gray-900 truncate">{sede.nombre}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {[sede.cuenta_nombre, sede.ciudad, sede.reps_code ? `REPS ${sede.reps_code}` : null].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
