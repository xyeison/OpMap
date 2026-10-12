'use client'

// Pestaña "Médicos": POST /api/terceros/medicos/buscar { q, municipio, visitante: 'me', page } (los filtros van en
// el cuerpo: lo que se escribe en el buscador no queda en la URL ni en los logs) →
// { items: [{ id, nombre, especialidades, municipality_id, ciudad, sedes, visitantes, activo }], total, page }.
// Nunca trae el documento. Un visitante vigente que ya no cumple la regla (Ejecutivo Comercial inactivo o sin esa
// línea) sale marcado "Revisar". Tabla en escritorio y tarjetas en el celular.
import { useEffect, useRef, useState } from 'react'
import { TERCEROS_POR_PAGINA, etiquetaEspecialidad, etiquetaRolMedicoSede, type MedicoListItem } from '@/lib/terceros'
import MunicipioSelector from './MunicipioSelector'
import {
  AvisoError,
  Cargando,
  Chip,
  Paginacion,
  claseInput,
  itemsDe,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  totalDe,
  useDemorado,
} from './comun'

function textoSedes(medico: MedicoListItem): string {
  if (medico.sedes.length === 0) return 'Sin sedes'
  return medico.sedes.map(sede => `${sede.nombre} (${etiquetaRolMedicoSede(sede.rol).toLowerCase()})`).join(' · ')
}

function textoVisitantes(medico: MedicoListItem): string {
  if (medico.visitantes.length === 0) return 'Sin visitantes'
  return medico.visitantes.map(v => `${v.executive} · ${v.line}${v.aviso ? ' (revisar)' : ''}`).join(' · ')
}

export default function MedicosTab({ version, onAbrir }: { version: number; onAbrir: (id: string) => void }) {
  const [texto, setTexto] = useState('')
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [soloMios, setSoloMios] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [items, setItems] = useState<MedicoListItem[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)
  const turno = useRef(0)

  const busqueda = useDemorado(texto.trim(), 300)

  useEffect(() => {
    const miTurno = ++turno.current
    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        const filtros = {
          ...(busqueda ? { q: busqueda } : {}),
          ...(municipio ? { municipio } : {}),
          ...(soloMios ? { visitante: 'me' } : {}),
          page: pagina,
        }
        const respuesta = await pedirJson('/api/terceros/medicos/buscar', { method: 'POST', json: filtros })
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron cargar los médicos'))
        const lista = itemsDe<MedicoListItem>(respuesta.data).map(medico => ({
          ...medico,
          especialidades: Array.isArray(medico.especialidades) ? medico.especialidades : [],
          sedes: Array.isArray(medico.sedes) ? medico.sedes : [],
          visitantes: Array.isArray(medico.visitantes) ? medico.visitantes : [],
        }))
        setItems(lista)
        setTotal(totalDe(respuesta.data, lista.length))
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudieron cargar los médicos'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [busqueda, municipio, soloMios, pagina, version, intento])

  const hayFiltros = Boolean(busqueda || municipio || soloMios)

  return (
    <div className="space-y-4">
      {/* Búsqueda y filtros */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-3">
        <div className="relative min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            type="search"
            placeholder="Buscar médico por nombre..."
            className={`${claseInput} pl-10`}
            value={texto}
            onChange={e => {
              setTexto(e.target.value)
              setPagina(1) // cambiar un filtro vuelve a la primera página
            }}
            aria-label="Buscar médicos"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 lg:items-end">
          <MunicipioSelector
            valor={municipio}
            onCambiar={codigo => {
              setMunicipio(codigo)
              setPagina(1)
            }}
            etiqueta="Ciudad"
            textoVacio="Todas las ciudades"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 lg:pb-2.5">
            <input
              type="checkbox"
              checked={soloMios}
              onChange={e => {
                setSoloMios(e.target.checked)
                setPagina(1)
              }}
            />
            Solo los médicos que visito
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {error ? (
          <div className="p-4">
            <AvisoError onReintentar={() => setIntento(n => n + 1)}>{error}</AvisoError>
          </div>
        ) : cargando && items.length === 0 ? (
          <Cargando texto="Cargando médicos..." />
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <h3 className="text-sm font-medium text-gray-900">No se encontraron médicos</h3>
            <p className="mt-1 text-sm text-gray-500">
              {hayFiltros ? 'Prueba con otros términos de búsqueda o con otros filtros' : 'Crea el primer médico para comenzar'}
            </p>
          </div>
        ) : (
          <div className={cargando ? 'opacity-60 transition-opacity' : ''}>
            {/* Celular: tarjetas */}
            <ul className="md:hidden divide-y divide-gray-100">
              {items.map(medico => (
                <li key={medico.id}>
                  <button type="button" onClick={() => onAbrir(medico.id)} className="w-full text-left p-4 hover:bg-gray-50 min-w-0">
                    <p className={`text-sm font-semibold truncate ${medico.activo ? 'text-gray-900' : 'text-gray-400'}`}>{medico.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">{medico.ciudad ?? medico.municipality_id}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {medico.especialidades.map(especialidad => (
                        <Chip key={especialidad}>{etiquetaEspecialidad(especialidad)}</Chip>
                      ))}
                      {!medico.activo && <Chip tono="rojo">Inactivo</Chip>}
                    </div>
                    <p className="text-xs text-gray-600 mt-2 truncate">Sedes: {textoSedes(medico)}</p>
                    <p className="text-xs text-gray-600 truncate">Visitantes: {textoVisitantes(medico)}</p>
                    {medico.visitantes.some(v => v.aviso) && (
                      <p className="text-xs text-amber-700 truncate">
                        {medico.visitantes
                          .filter(v => v.aviso)
                          .map(v => `${v.executive}: ${v.aviso}`)
                          .join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {/* Escritorio: tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full table-fixed">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <th className="w-1/4 px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Médico</th>
                    <th className="w-1/5 px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Especialidades</th>
                    <th className="w-1/4 px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Sedes</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Visitantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(medico => (
                    <tr key={medico.id} onClick={() => onAbrir(medico.id)} className="hover:bg-gray-50 cursor-pointer align-top">
                      <td className="px-6 py-3 min-w-0">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onAbrir(medico.id)
                          }}
                          className={`block text-left text-sm font-semibold truncate max-w-full hover:underline ${medico.activo ? 'text-gray-900' : 'text-gray-400'}`}
                          title={medico.nombre}
                        >
                          {medico.nombre}
                        </button>
                        <p className="text-xs text-gray-500 truncate">
                          {medico.ciudad ?? medico.municipality_id}
                          {!medico.activo ? ' · Inactivo' : ''}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {medico.especialidades.map(especialidad => (
                            <Chip key={especialidad}>{etiquetaEspecialidad(especialidad)}</Chip>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        <ul className="space-y-0.5">
                          {medico.sedes.length === 0 && <li className="text-gray-400">Sin sedes</li>}
                          {medico.sedes.map(sede => (
                            <li key={sede.id} className="truncate" title={sede.nombre}>
                              {sede.nombre} <span className="text-xs text-gray-500">({etiquetaRolMedicoSede(sede.rol).toLowerCase()})</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        <ul className="space-y-0.5">
                          {medico.visitantes.length === 0 && <li className="text-gray-400">Sin visitantes</li>}
                          {medico.visitantes.map((visitante, indice) => (
                            <li key={visitante.id ?? `${visitante.executive}-${visitante.line}-${indice}`} className="truncate">
                              {visitante.executive} <span className="text-xs text-gray-500">· {visitante.line}</span>
                              {visitante.aviso && (
                                <>
                                  {' '}
                                  <Chip tono="ambar" titulo={visitante.aviso}>
                                    Revisar
                                  </Chip>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} total={total} porPagina={TERCEROS_POR_PAGINA} onCambiar={setPagina} />
          </div>
        )}
      </div>
    </div>
  )
}
