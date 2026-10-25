'use client'

// Ventana "Datos de la zona" de /kams: las cifras de UNA Zona (ciudad base), sin cabecera de persona, para que una Zona
// sin nadie (Ibagué, Engativá…) también tenga dónde verlas (spec 2026-10-23, E1 "Ver datos"). Solo lectura:
// GET /api/kams/[id]/estadisticas (app/api/kams/[id]/estadisticas/route.ts; contrato ZonaDatosResponse en
// lib/zona-estadisticas.ts). Reutiliza las tarjetas, la lista "Quién cubre <zona> en cada línea" y las notas de
// app/executives/zona-bloques.tsx, así se ve igual que la ventana de /executives. Nada de esta ventana calcula rutas ni
// consulta Google.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/terceros/comun'
import { readError } from '@/app/lines/coverage-shared'
import { Bloque, CargandoDatos, CoberturaBase, ErrorDatos, NotasCalculo, useVentanaAccesible } from '@/app/executives/zona-bloques'
import { fechaEs, type BloqueZona, type ZonaDatosResponse } from '@/lib/zona-estadisticas'
import { nombreZona } from './zonas-ui'

interface Props {
  zona: { kam_id: string; nombre: string; ciudad_base?: string | null }
  onCerrar: () => void
}

/** Acepta la respuesta tal cual o con el bloque bajo `base` (como la ruta de ejecutivos); null si falta zona o bloque. */
function normalizar(body: unknown): ZonaDatosResponse | null {
  if (!body || typeof body !== 'object') return null
  const objeto = body as Partial<ZonaDatosResponse> & { base?: BloqueZona | null }
  const bloque = objeto.bloque ?? objeto.base ?? null
  if (!objeto.zona || !bloque) return null
  return {
    zona: objeto.zona,
    bloque,
    coberturaBase: Array.isArray(objeto.coberturaBase) ? objeto.coberturaBase : [],
    coberturaCalculada: objeto.coberturaCalculada ?? null,
    fuentes: objeto.fuentes ?? { municipiosCalculados: null, poblacionAnio: null, bduaCorte: null },
    acceso: objeto.acceso ?? { comprasPublicas: false, todasLasLineas: false, lineasCobertura: [] },
    notas: Array.isArray(objeto.notas) ? objeto.notas : [],
    generado: objeto.generado ?? '',
  }
}

export default function ZonaDatosModal({ zona, onCerrar }: Props) {
  const [data, setData] = useState<ZonaDatosResponse | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)
  const tituloRef = useRef<HTMLHeadingElement>(null)

  // Escape cierra; el foco entra a la ventana y vuelve a donde estaba al cerrar
  useVentanaAccesible(onCerrar)

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true)
    setError('')
    fetch(`/api/kams/${encodeURIComponent(zona.kam_id)}/estadisticas`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(await readError(response, 'No se pudieron cargar los datos de la zona'))
        const body = normalizar(await response.json().catch(() => null))
        if (!body) throw new Error('Respuesta inesperada del servidor')
        setData(body)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('Error cargando los datos de la zona:', err)
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos de la zona')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })
    return () => controller.abort()
  }, [zona.kam_id, intento])

  useEffect(() => {
    tituloRef.current?.focus()
  }, [cargando])

  const reintentar = useCallback(() => setIntento(value => value + 1), [])

  const nombre = nombreZona(data?.zona.nombre ?? zona.nombre)
  const ciudad = data?.zona.ciudad_base ?? zona.ciudad_base ?? null

  return (
    <Modal titulo="Datos de la zona" subtitulo={ciudad && ciudad !== nombre ? `${nombre} · ciudad base ${ciudad}` : nombre} onCerrar={onCerrar} ancho="sm:max-w-3xl">
      <div className="min-h-full flex flex-col">
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          {cargando ? (
            <CargandoDatos />
          ) : error ? (
            <ErrorDatos error={error} onReintentar={reintentar} />
          ) : data ? (
            <>
              <h3 ref={tituloRef} tabIndex={-1} className="text-base font-bold text-gray-900 focus:outline-none break-words">
                Zona: {nombre}
                {!data.zona.activa && <span className="ml-1 text-sm font-normal text-gray-400">(inactiva)</span>}
              </h3>
              <p className="-mt-3 text-sm text-gray-500">
                Lo que hay en la Zona es igual para todas las líneas; lo que cambia por línea es quién la atiende.
              </p>

              <Bloque bloque={data.bloque} verSecop={data.acceso.comprasPublicas} municipiosCalculados={data.fuentes.municipiosCalculados} />

              {data.acceso.lineasCobertura.length === 0 ? (
                <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                  Quién cubre la Zona por línea solo se ve en las líneas que lideras o llevas, y tu usuario no tiene ninguna.
                </p>
              ) : (
                <>
                  {data.coberturaBase.length > 0 ? (
                    <CoberturaBase filas={data.coberturaBase} zona={nombre} />
                  ) : (
                    <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
                      No hay cobertura calculada para esta Zona en tus líneas.
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Cobertura calculada el {fechaEs(data.coberturaCalculada)}
                    {data.acceso.todasLasLineas ? '.' : ` · solo en tus líneas: ${data.acceso.lineasCobertura.map(line => line.name).join(', ')}.`}
                  </p>
                </>
              )}

              {data.notas.length > 0 && <NotasCalculo notas={data.notas} />}
            </>
          ) : null}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 flex justify-end">
          <button type="button" onClick={onCerrar} className="px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  )
}
