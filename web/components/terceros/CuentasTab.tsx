'use client'

// Pestaña "Cuentas": POST /api/terceros/cuentas/buscar { q, clase, cliente, municipio, page } (los filtros van en
// el cuerpo: lo que se escribe en el buscador, incluso una cédula, no queda en la URL ni en los logs) →
// { items: [{ id, nombre, clase, es_cliente, tipo_identificacion, numero_identificacion, modalidad_facturacion,
// sedes, activo }], total, page }. municipio = filtro "Ciudad" (cuentas con alguna sede activa ahí). Tabla en
// escritorio y tarjetas en el celular.
import { useEffect, useRef, useState } from 'react'
import {
  CLASES_CUENTA,
  TERCEROS_POR_PAGINA,
  etiquetaClaseCuenta,
  etiquetaModalidad,
  type ClaseCuenta,
  type CuentaListItem,
} from '@/lib/terceros'
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

type FiltroCliente = '' | 'true' | 'false'

function identificacion(cuenta: CuentaListItem): string {
  return `${cuenta.tipo_identificacion} ${cuenta.numero_identificacion ?? '(protegida)'}`
}

export default function CuentasTab({ version, onAbrir }: { version: number; onAbrir: (id: string) => void }) {
  const [texto, setTexto] = useState('')
  const [clase, setClase] = useState<ClaseCuenta | ''>('')
  const [cliente, setCliente] = useState<FiltroCliente>('')
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [items, setItems] = useState<CuentaListItem[]>([])
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
          ...(clase ? { clase } : {}),
          ...(cliente ? { cliente: cliente === 'true' } : {}),
          ...(municipio ? { municipio } : {}),
          page: pagina,
        }
        const respuesta = await pedirJson('/api/terceros/cuentas/buscar', { method: 'POST', json: filtros })
        if (miTurno !== turno.current) return
        if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudieron cargar las cuentas'))
        const lista = itemsDe<CuentaListItem>(respuesta.data)
        setItems(lista)
        setTotal(totalDe(respuesta.data, lista.length))
      } catch (err) {
        if (miTurno !== turno.current) return
        setError(mensajeExcepcion(err, 'No se pudieron cargar las cuentas'))
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    }
    cargar()
  }, [busqueda, clase, cliente, municipio, pagina, version, intento])

  const hayFiltros = Boolean(busqueda || clase || cliente || municipio)

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
            placeholder="Buscar por nombre o NIT..."
            className={`${claseInput} pl-10`}
            value={texto}
            onChange={e => {
              setTexto(e.target.value)
              setPagina(1) // cambiar un filtro vuelve a la primera página
            }}
            aria-label="Buscar cuentas"
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 lg:items-end">
          <MunicipioSelector
            valor={municipio}
            onCambiar={codigo => {
              setMunicipio(codigo)
              setPagina(1)
            }}
            etiqueta="Ciudad"
            textoVacio="Todas las ciudades"
          />
          <select
            value={clase}
            onChange={e => {
              setClase(e.target.value as ClaseCuenta | '')
              setPagina(1)
            }}
            className={claseInput}
            aria-label="Filtrar por clase"
          >
            <option value="">Todas las clases</option>
            {CLASES_CUENTA.map(opcion => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          <select
            value={cliente}
            onChange={e => {
              setCliente(e.target.value as FiltroCliente)
              setPagina(1)
            }}
            className={claseInput}
            aria-label="Filtrar por cliente"
          >
            <option value="">Clientes y no clientes</option>
            <option value="true">Solo clientes</option>
            <option value="false">Solo no clientes</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {error ? (
          <div className="p-4">
            <AvisoError onReintentar={() => setIntento(n => n + 1)}>{error}</AvisoError>
          </div>
        ) : cargando && items.length === 0 ? (
          <Cargando texto="Cargando cuentas..." />
        ) : items.length === 0 ? (
          <div className="text-center py-12 px-4">
            <h3 className="text-sm font-medium text-gray-900">No se encontraron cuentas</h3>
            <p className="mt-1 text-sm text-gray-500">
              {hayFiltros ? 'Prueba con otros términos de búsqueda o con otros filtros' : 'Crea la primera cuenta para comenzar'}
            </p>
          </div>
        ) : (
          <div className={cargando ? 'opacity-60 transition-opacity' : ''}>
            {/* Celular: tarjetas */}
            <ul className="md:hidden divide-y divide-gray-100">
              {items.map(cuenta => (
                <li key={cuenta.id}>
                  <button type="button" onClick={() => onAbrir(cuenta.id)} className="w-full text-left p-4 hover:bg-gray-50 min-w-0">
                    <p className={`text-sm font-semibold truncate ${cuenta.activo ? 'text-gray-900' : 'text-gray-400'}`}>{cuenta.nombre}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {identificacion(cuenta)} · {cuenta.sedes} {cuenta.sedes === 1 ? 'sede' : 'sedes'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Chip>{etiquetaClaseCuenta(cuenta.clase)}</Chip>
                      {cuenta.es_cliente && <Chip tono="verde">Cliente</Chip>}
                      {cuenta.modalidad_facturacion && <Chip tono="azul">{etiquetaModalidad(cuenta.modalidad_facturacion)}</Chip>}
                      {!cuenta.activo && <Chip tono="rojo">Inactiva</Chip>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Escritorio: tabla */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Cuenta</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Clase</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Identificación</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Sedes</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(cuenta => (
                    <tr key={cuenta.id} onClick={() => onAbrir(cuenta.id)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-3 max-w-md">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            onAbrir(cuenta.id)
                          }}
                          className={`block text-left text-sm font-semibold truncate max-w-full hover:underline ${cuenta.activo ? 'text-gray-900' : 'text-gray-400'}`}
                          title={cuenta.nombre}
                        >
                          {cuenta.nombre}
                        </button>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{etiquetaClaseCuenta(cuenta.clase)}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{identificacion(cuenta)}</td>
                      <td className="px-6 py-3 text-sm text-gray-700 text-center">{cuenta.sedes}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {cuenta.es_cliente && <Chip tono="verde">Cliente</Chip>}
                          {cuenta.modalidad_facturacion && <Chip tono="azul">{etiquetaModalidad(cuenta.modalidad_facturacion)}</Chip>}
                          {!cuenta.activo && <Chip tono="rojo">Inactiva</Chip>}
                          {cuenta.activo && !cuenta.es_cliente && !cuenta.modalidad_facturacion && (
                            <span className="text-sm text-gray-400">Activa</span>
                          )}
                        </div>
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
