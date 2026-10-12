'use client'

// Selector de municipio (código DANE de 5 dígitos): departamento → municipio, con las rutas existentes
// GET /api/locations/departments y GET /api/locations/municipalities?departmentId= (tabla municipalities).
import { useEffect, useState } from 'react'
import { claseInput, claseLabel } from './comun'

interface Opcion {
  id: string
  name: string
}

// Caché del navegador para no pedir lo mismo en cada formulario.
let departamentosCache: Opcion[] | null = null
const municipiosCache = new Map<string, Opcion[]>()

async function cargarDepartamentos(): Promise<Opcion[]> {
  if (departamentosCache) return departamentosCache
  const response = await fetch('/api/locations/departments', { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudieron cargar los departamentos')
  const data = await response.json().catch(() => null)
  departamentosCache = Array.isArray(data) ? (data as Opcion[]) : []
  return departamentosCache
}

async function cargarMunicipios(departamento: string): Promise<Opcion[]> {
  const enCache = municipiosCache.get(departamento)
  if (enCache) return enCache
  const response = await fetch(`/api/locations/municipalities?departmentId=${encodeURIComponent(departamento)}`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('No se pudieron cargar los municipios')
  const data = await response.json().catch(() => null)
  const lista = Array.isArray(data) ? (data as Opcion[]) : []
  municipiosCache.set(departamento, lista)
  return lista
}

interface Props {
  /** Código DANE elegido (5 dígitos) o null. */
  valor: string | null
  /** Se llama con el código y el nombre del municipio, o null/null si se quita. */
  onCambiar: (codigo: string | null, nombre: string | null) => void
  etiqueta?: string
  requerido?: boolean
  /** Texto de la opción vacía del municipio ("Todos", "Sin ciudad"...). */
  textoVacio?: string
  disabled?: boolean
}

export default function MunicipioSelector({
  valor,
  onCambiar,
  etiqueta = 'Municipio',
  requerido = false,
  textoVacio = 'Elige el municipio',
  disabled = false,
}: Props) {
  const [departamentos, setDepartamentos] = useState<Opcion[]>(departamentosCache ?? [])
  const [departamento, setDepartamento] = useState(valor ? valor.slice(0, 2) : '')
  const [municipios, setMunicipios] = useState<Opcion[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    cargarDepartamentos()
      .then(lista => {
        if (vigente) setDepartamentos(lista)
      })
      .catch(err => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los departamentos')
      })
    return () => {
      vigente = false
    }
  }, [])

  // Si el valor cambia desde fuera (formulario reiniciado o valor inicial), el departamento lo sigue.
  useEffect(() => {
    if (valor && valor.slice(0, 2) !== departamento) setDepartamento(valor.slice(0, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  useEffect(() => {
    if (!departamento) {
      setMunicipios([])
      return
    }
    let vigente = true
    setCargando(true)
    setError('')
    cargarMunicipios(departamento)
      .then(lista => {
        if (vigente) setMunicipios(lista)
      })
      .catch(err => {
        if (vigente) setError(err instanceof Error ? err.message : 'No se pudieron cargar los municipios')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [departamento])

  return (
    <div className="min-w-0">
      <span className={claseLabel}>
        {etiqueta} {requerido && <span className="text-red-500">*</span>}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={departamento}
          disabled={disabled}
          onChange={e => {
            setDepartamento(e.target.value)
            onCambiar(null, null)
          }}
          className={claseInput}
          aria-label={`${etiqueta}: departamento`}
        >
          <option value="">Departamento</option>
          {departamentos.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={valor ?? ''}
          disabled={disabled || !departamento || cargando}
          onChange={e => {
            const codigo = e.target.value
            const elegido = municipios.find(m => m.id === codigo)
            onCambiar(codigo || null, elegido ? elegido.name : null)
          }}
          className={claseInput}
          aria-label={`${etiqueta}: municipio`}
        >
          <option value="">{cargando ? 'Cargando...' : textoVacio}</option>
          {municipios.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

/** Nombre de un municipio por su código (usa la misma caché; null si no se puede saber). */
export async function nombreMunicipio(codigo: string | null | undefined): Promise<string | null> {
  if (!codigo || !/^\d{5}$/.test(codigo)) return null
  try {
    const lista = await cargarMunicipios(codigo.slice(0, 2))
    return lista.find(m => m.id === codigo)?.name ?? null
  } catch {
    return null
  }
}
