'use client'

// Sección "Historial de traspasos" de /executives: quién entregó, quién recibió, qué líneas, desde cuándo, quién lo
// hizo y el resumen de lo que se movió. El historial no se edita ni se borra (ejecutivas_traspasos, migración 0820).
// API: GET /api/executives/traspasos (executives:view) → TraspasosHistorialResponse (lib/traspaso.ts).
import { useCallback, useEffect, useState } from 'react'
import {
  AvisoAtencion,
  AvisoError,
  Cargando,
  Chip,
  claseBotonChico,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
} from '@/components/terceros/comun'
import { etiquetaRazon, type TraspasoHistorialItem } from '@/lib/traspaso'
import type { BusinessLine, Executive } from '@/lib/types/lines'
import { fechaHora, fechaLarga, frasesResumen, leerHistorial } from './traspaso-ui'

const CUANTOS_AL_INICIO = 5

interface HistorialTraspasosProps {
  /** Cambia tras un traspaso o una contratación, para recargar. */
  refrescar: number
  /** Para nombrar líneas y personas si la API no trae el nombre. */
  lines: BusinessLine[]
  executives: Executive[]
}

/** Omitidos agrupados por razón, en el orden en que aparece cada razón: [[razón, cuántos], ...]. */
function omitidosPorRazon(omitidos: { razon: string }[]): [string, number][] {
  const cuenta = new Map<string, number>()
  for (const omitido of omitidos) cuenta.set(omitido.razon, (cuenta.get(omitido.razon) ?? 0) + 1)
  return Array.from(cuenta.entries())
}

export default function HistorialTraspasos({ refrescar, lines, executives }: HistorialTraspasosProps) {
  const [items, setItems] = useState<TraspasoHistorialItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  // 503: falta la migración 0820 (el historial aún no existe en la base): aviso, no error
  const [noDisponible, setNoDisponible] = useState(false)
  const [verTodos, setVerTodos] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    setNoDisponible(false)
    try {
      const respuesta = await pedirJson('/api/executives/traspasos')
      if (!respuesta.ok) {
        setNoDisponible(respuesta.status === 503)
        setError(mensajeError(respuesta, 'No se pudo cargar el historial de traspasos'))
        return
      }
      setItems(leerHistorial(respuesta.data))
    } catch (err: unknown) {
      setError(mensajeExcepcion(err, 'No se pudo cargar el historial de traspasos'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar, refrescar])

  const nombreLinea = (id: string) => lines.find(line => line.id === id)?.name ?? 'Línea desconocida'
  const nombrePersona = (id: string | null) => (id ? executives.find(executive => executive.id === id)?.full_name ?? null : null)

  const visibles = verTodos ? items : items.slice(0, CUANTOS_AL_INICIO)

  return (
    <section className="mt-8 bg-white rounded-2xl shadow-xl border border-gray-100 min-w-0" aria-labelledby="historial-traspasos">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
        <div className="min-w-0">
          <h2 id="historial-traspasos" className="text-lg font-bold text-gray-900">
            Historial de traspasos
          </h2>
          <p className="text-sm text-gray-500">Quién entregó, quién recibió y qué se movió. No se edita ni se borra.</p>
        </div>
        {!cargando && !error && items.length > 0 && (
          <span className="text-sm text-gray-500 shrink-0">{items.length.toLocaleString('es-CO')} en total</span>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {cargando ? (
          <Cargando texto="Cargando historial..." />
        ) : error && noDisponible ? (
          <AvisoAtencion>{error}</AvisoAtencion>
        ) : error ? (
          <AvisoError onReintentar={() => void cargar()}>{error}</AvisoError>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Aún no hay traspasos.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {visibles.map(item => {
                const origen = item.origen_nombre ?? nombrePersona(item.origen_id) ?? 'Ejecutivo Comercial'
                const destino =
                  item.destino_tipo === 'nadie'
                    ? 'Nadie'
                    : item.destino_nombre ?? nombrePersona(item.destino_id) ?? 'Persona sin nombre'
                const lineas = item.lineas_nombres.length > 0 ? item.lineas_nombres : item.lineas.map(nombreLinea)
                const frases = item.resumen ? frasesResumen(item.resumen, 'pasado') : []
                // "Copiar excepciones" pedido pero sin nada que copiar no se muestra como hecho
                const copioExcepciones = item.copiar_excepciones && (item.resumen ? item.resumen.excepciones_copiadas > 0 : true)
                return (
                  <li key={item.id} className="rounded-xl border border-gray-200 p-3 sm:p-4 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">Desde el {fechaLarga(item.fecha)}</span>
                      {item.dar_de_baja ? <Chip tono="rojo">Baja</Chip> : <Chip>Quitar líneas</Chip>}
                      {item.destino_tipo === 'nueva' && <Chip tono="verde">Persona nueva</Chip>}
                      {item.destino_tipo === 'vacante' && <Chip tono="ambar">Vacante</Chip>}
                    </div>
                    <p className="mt-2 text-sm text-gray-800 break-words">
                      <span className="font-medium">{origen}</span>
                      <span className="text-gray-400" aria-hidden="true">
                        {' '}
                        →{' '}
                      </span>
                      <span className="sr-only"> entregó a </span>
                      <span className="font-medium">{destino}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {lineas.map((nombre, index) => (
                        <Chip key={`${nombre}-${index}`} tono="azul">
                          {nombre}
                        </Chip>
                      ))}
                    </div>
                    {item.resumen && (
                      <div className="mt-2 text-sm text-gray-700">
                        {frases.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-0.5">
                            {frases.map(frase => (
                              <li key={frase}>{frase}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">
                            {item.destino_tipo === 'nadie'
                              ? 'Se le quitaron las líneas; no había médicos ni ajustes manuales que terminar.'
                              : 'Pasaron las líneas; no había médicos, ajustes manuales ni nombre de territorio que mover.'}
                          </p>
                        )}
                        {item.resumen.omitidos.length > 0 && (
                          <p className="mt-1 text-xs text-gray-500 break-words">
                            No pasaron a quien recibe:{' '}
                            {omitidosPorRazon(item.resumen.omitidos)
                              .map(([razon, n]) => `${n} · ${etiquetaRazon(razon)}`)
                              .join('; ')}
                          </p>
                        )}
                      </div>
                    )}
                    {item.motivo && <p className="mt-2 text-sm text-gray-600 break-words">Motivo: {item.motivo}</p>}
                    {(item.desactivar_usuario || copioExcepciones) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {[item.desactivar_usuario ? 'Se desactivó su usuario de OpMap' : '', copioExcepciones ? 'Se copiaron sus excepciones' : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500 break-words">
                      Lo hizo {item.created_by_nombre ?? 'un usuario'} el {fechaHora(item.created_at)}
                    </p>
                  </li>
                )
              })}
            </ul>
            {items.length > CUANTOS_AL_INICIO && (
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setVerTodos(valor => !valor)} className={claseBotonChico}>
                  {verTodos ? 'Ver menos' : `Ver todos (${items.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
