'use client'

// Ventana "Datos de la zona" de /executives: al hacer clic en una persona o vacante se ven las cifras de su zona base y
// de su territorio (las zonas que cubre por línea según la cobertura). Solo lectura: GET /api/executives/[id]/estadisticas.
// Las cuentas están en lib/zona-estadisticas.ts (con pruebas en scripts/zona-estadisticas-check.ts). Lo que no se ve con
// el rol (compras públicas sin Inteligencia, cobertura de líneas ajenas) ni llega: data.acceso dice qué se muestra.
// Desde la spec 2026-10-23 (Zonas por línea) las tarjetas, la lista "Quién cubre…", las notas y los estados de carga
// viven en zona-bloques.tsx, compartidos con la ventana por Zona de /kams (ZonaDatosModal); la apariencia no cambió.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/terceros/comun'
import { KIND_BADGE, KIND_LABELS, formatMinutes } from '@/app/lines/coverage-shared'
import type { Executive } from '@/lib/types/lines'
import { fechaEs, numeroEs, type CoberturaLineaEjecutivo, type ZonaEstadisticasResponse } from '@/lib/zona-estadisticas'
import { readError, STATUS_BADGE, STATUS_LABELS } from './shared'
import { Bloque, CargandoDatos, CoberturaBase, ErrorDatos, NotasCalculo, useVentanaAccesible } from './zona-bloques'

type Nivel = 'base' | 'territorio'

interface Props {
  executive: Executive
  onCerrar: () => void
}

export default function ZonaEstadisticasModal({ executive, onCerrar }: Props) {
  const [data, setData] = useState<ZonaEstadisticasResponse | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [nivel, setNivel] = useState<Nivel>('base')
  const [intento, setIntento] = useState(0)
  const tituloRef = useRef<HTMLHeadingElement>(null)

  // Escape cierra; el foco entra a la ventana y vuelve a donde estaba al cerrar
  useVentanaAccesible(onCerrar)

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true)
    setError('')
    fetch(`/api/executives/${executive.id}/estadisticas`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(await readError(response, 'No se pudieron cargar los datos de la zona'))
        const body = (await response.json().catch(() => null)) as ZonaEstadisticasResponse | null
        if (!body || !body.executive) throw new Error('Respuesta inesperada del servidor')
        setData(body)
        setNivel(body.base ? 'base' : 'territorio')
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
  }, [executive.id, intento])

  useEffect(() => {
    tituloRef.current?.focus()
  }, [cargando])

  const reintentar = useCallback(() => setIntento(value => value + 1), [])

  return (
    <Modal titulo="Datos de la zona" subtitulo={`${executive.full_name} · ${STATUS_LABELS[executive.status]}`} onCerrar={onCerrar} ancho="sm:max-w-3xl">
      <div className="min-h-full flex flex-col">
        <div className="flex-1 p-4 sm:p-6 space-y-5 min-w-0">
          {cargando ? (
            <CargandoDatos />
          ) : error ? (
            <ErrorDatos error={error} onReintentar={reintentar} />
          ) : data ? (
            <Contenido data={data} nivel={nivel} setNivel={setNivel} tituloRef={tituloRef} />
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

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

function Contenido({
  data,
  nivel,
  setNivel,
  tituloRef,
}: {
  data: ZonaEstadisticasResponse
  nivel: Nivel
  setNivel: (nivel: Nivel) => void
  tituloRef: React.RefObject<HTMLHeadingElement>
}) {
  const { executive, acceso } = data
  // Sin líneas visibles no hay cobertura ni territorio que mostrar (no es que no cubra nada: no se ve)
  const sinCobertura = acceso.lineasCobertura.length === 0
  const soloUnNivel = data.territorioIgualBase || !data.base || !data.territorio
  const mostrar: Nivel = soloUnNivel ? (data.base ? 'base' : 'territorio') : nivel
  const bloque = mostrar === 'base' ? data.base : data.territorio

  return (
    <>
      {/* Persona */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 min-w-0">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border ${STATUS_BADGE[executive.status]}`}>
          {STATUS_LABELS[executive.status]}
        </span>
        <span className="min-w-0 break-words">
          Zona base: <strong className="text-gray-900">{data.zonaBase ? data.zonaBase.nombre : 'sin zona base'}</strong>
          {data.zonaBase && !data.zonaBase.activa && <span className="text-gray-400"> (inactiva)</span>}
        </span>
        <span className="hidden sm:inline text-gray-300" aria-hidden="true">
          ·
        </span>
        {data.medicos && (
          <span title="Fuente: Terceros, visitantes vigentes hoy">
            Médicos asignados: <strong className="text-gray-900">{numeroEs(data.medicos.total)}</strong>{' '}
            <span className="text-gray-400">(Terceros, vigentes hoy)</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {executive.lineas.length === 0 ? (
          <span className="text-sm text-gray-400">No lleva líneas</span>
        ) : (
          executive.lineas.map(line => {
            const medicos = data.medicos?.porLinea.find(item => item.line.id === line.id)?.total ?? 0
            return (
              <span key={line.id} className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-xs font-medium">
                {line.name}
                {medicos > 0 ? ` · ${numeroEs(medicos)} médicos` : ''}
              </span>
            )
          })
        )}
      </div>

      {data.coberturaDesactualizada && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm" role="note">
          La cobertura se calculó el {fechaEs(data.coberturaCalculada)}, antes de que existiera {executive.full_name}: sus zonas por
          línea aparecerán cuando se recalcule la cobertura de las líneas.
        </div>
      )}

      {/* Nivel: zona base o territorio */}
      {!soloUnNivel && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl" role="group" aria-label="Qué mirar">
          <BotonNivel activo={mostrar === 'base'} onClick={() => setNivel('base')} titulo="Zona base" detalle={data.zonaBase?.nombre ?? ''} />
          <BotonNivel
            activo={mostrar === 'territorio'}
            onClick={() => setNivel('territorio')}
            titulo="Territorio"
            detalle={`${numeroEs(data.territorio?.zonas.length ?? 0)} ${(data.territorio?.zonas.length ?? 0) === 1 ? 'zona' : 'zonas'}`}
          />
        </div>
      )}

      <h3 ref={tituloRef} tabIndex={-1} className="text-base font-bold text-gray-900 focus:outline-none break-words">
        {mostrar === 'base'
          ? `Zona base: ${data.zonaBase?.nombre ?? 'sin zona base'}`
          : data.territorio
            ? `Territorio: ${data.territorio.zonas.map(zona => zona.nombre).join(', ')}`
            : 'Territorio'}
      </h3>
      {data.territorioIgualBase && data.base && (
        <p className="-mt-3 text-sm text-gray-500">Su territorio es su zona base: cubre solo {data.zonaBase?.nombre} en todas sus líneas.</p>
      )}
      {!data.base && mostrar === 'territorio' && <p className="-mt-3 text-sm text-gray-500">No tiene zona base: se muestra su territorio.</p>}

      {bloque ? (
        <Bloque bloque={bloque} verSecop={acceso.comprasPublicas} municipiosCalculados={data.fuentes.municipiosCalculados} />
      ) : (
        <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          {mostrar === 'territorio'
            ? sinCobertura
              ? 'No tiene zona base, y la cobertura por línea solo se ve en las líneas que lideras o llevas.'
              : `No cubre ninguna zona según la cobertura calculada el ${fechaEs(data.coberturaCalculada)}.`
            : 'No tiene zona base.'}
        </p>
      )}

      {sinCobertura ? (
        <p className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          La cobertura por línea y el territorio solo se ven en las líneas que lideras o llevas, y tu usuario no tiene ninguna.
        </p>
      ) : (
        <>
          {mostrar === 'base' && data.coberturaBase.length > 0 && <CoberturaBase filas={data.coberturaBase} zona={data.zonaBase?.nombre ?? ''} />}
          {(mostrar === 'territorio' || soloUnNivel) && <CoberturaPersona filas={data.coberturaEjecutivo} />}
          <p className="text-xs text-gray-400">
            Cobertura calculada el {fechaEs(data.coberturaCalculada)}
            {acceso.todasLasLineas ? '.' : ` · solo en tus líneas: ${acceso.lineasCobertura.map(line => line.name).join(', ')}.`}
          </p>
        </>
      )}

      <NotasCalculo notas={data.notas} />
    </>
  )
}

function BotonNivel({ activo, onClick, titulo, detalle }: { activo: boolean; onClick: () => void; titulo: string; detalle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-w-0 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-700 ${
        activo ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      <span className="block truncate">{titulo}</span>
      {detalle && <span className="block truncate text-xs font-normal text-gray-500">{detalle}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Zonas que cubre la persona por línea (solo en esta ventana: la de /kams es por Zona)
// ---------------------------------------------------------------------------

function CoberturaPersona({ filas }: { filas: CoberturaLineaEjecutivo[] }) {
  return (
    <section className="min-w-0">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zonas que cubre por línea</h4>
      {filas.length === 0 ? (
        <p className="p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">No lleva líneas activas ni cubre zonas.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
          {filas.map(fila => (
            <li key={fila.line.id} className="px-4 py-3 min-w-0">
              <p className="text-sm font-medium text-gray-900 break-words">
                {fila.line.name}
                {!fila.lleva && <span className="ml-1 text-xs font-normal text-gray-500">(no la lleva)</span>}
              </p>
              {fila.zonas.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">No cubre ninguna zona en esta línea.</p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {fila.zonas.map(zona => (
                    <span key={zona.kam_id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${KIND_BADGE[zona.kind]}`}>
                      <span className="font-semibold">{zona.nombre}</span>
                      <span>
                        · {KIND_LABELS[zona.kind]}
                        {zona.kind === 'reach' && zona.travel_minutes !== null ? ` ${formatMinutes(zona.travel_minutes)}` : ''}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
