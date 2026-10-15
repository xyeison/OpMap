'use client'

// Ventana "Datos de la zona" de /executives: al hacer clic en una persona o vacante se ven las cifras de su zona base y
// de su territorio (las zonas que cubre por línea según la cobertura). Solo lectura: GET /api/executives/[id]/estadisticas.
// Las cuentas están en lib/zona-estadisticas.ts (con pruebas en scripts/zona-estadisticas-check.ts). Lo que no se ve con
// el rol (compras públicas sin Inteligencia, cobertura de líneas ajenas) ni llega: data.acceso dice qué se muestra.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Modal } from '@/components/terceros/comun'
import { KIND_BADGE, KIND_LABELS, formatMinutes } from '@/app/lines/coverage-shared'
import { formatCopCompact } from '@/lib/giros-format'
import type { Executive } from '@/lib/types/lines'
import {
  fechaEs,
  numeroEs,
  pctEs,
  rangoMesesEs,
  type BloqueZona,
  type CoberturaLineaEjecutivo,
  type CoberturaZonaLinea,
  type ZonaEstadisticasResponse,
} from '@/lib/zona-estadisticas'
import { readError, STATUS_BADGE, STATUS_LABELS } from './shared'

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

  // Escape cierra; el foco entra a la ventana y vuelve a donde estaba al cerrar. onCerrar va en una ref para que un
  // render del padre (que crea otra función) no vuelva a suscribir ni devuelva el foco antes de tiempo.
  const onCerrarRef = useRef(onCerrar)
  onCerrarRef.current = onCerrar
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCerrarRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previo?.focus()
    }
  }, [])

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
            <div className="py-16 text-center" role="status">
              <svg className="animate-spin h-10 w-10 text-gray-700 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <p className="text-sm text-gray-600">Cargando los datos de la zona…</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3" role="alert">
              <span className="break-words">{error}</span>
              <button type="button" onClick={reintentar} className="px-4 py-2 bg-white border border-red-300 rounded-lg text-sm font-medium hover:bg-red-100 shrink-0">
                Reintentar
              </button>
            </div>
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
        <Bloque bloque={bloque} data={data} />
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

      <details className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-800">¿Cómo se calcula?</summary>
        <ul className="mt-3 space-y-2 list-disc pl-5">
          {data.notas.map(nota => (
            <li key={nota}>{nota}</li>
          ))}
        </ul>
      </details>
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
// Cifras de un bloque (zona base o territorio)
// ---------------------------------------------------------------------------

function Bloque({ bloque, data }: { bloque: BloqueZona; data: ZonaEstadisticasResponse }) {
  const { municipios, poblacion, afiliados, ips, giros, secop, visitas } = bloque
  // Compras públicas solo con el acceso a Inteligencia; sin esa tarjeta, Giros ocupa la fila entera
  const verSecop = data.acceso.comprasPublicas
  const departamentosVisibles = municipios.departamentos.slice(0, 6)
  const departamentosOcultos = municipios.departamentos.length - departamentosVisibles.length

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
      <Tarjeta
        titulo="Municipios"
        valor={numeroEs(municipios.total)}
        fuente={`IPS asignadas hoy y alcance por tiempo real de carretera · calculado el ${fechaEs(data.fuentes.municipiosCalculados)}`}
      >
        <Linea>
          {numeroEs(municipios.conIps)} con IPS · {numeroEs(municipios.alcance)} de alcance
        </Linea>
        {municipios.compartidosNombres.length > 0 && (
          <Linea tenue>Compartido con otras zonas (cuenta por su parte): {municipios.compartidosNombres.join(', ')}</Linea>
        )}
        {municipios.departamentos.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {numeroEs(municipios.departamentos.length)} {municipios.departamentos.length === 1 ? 'departamento' : 'departamentos'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {departamentosVisibles.map(departamento => (
                <span key={departamento.code} className="px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs text-gray-700">
                  {departamento.nombre} · {numeroEs(departamento.municipios)}
                </span>
              ))}
              {departamentosOcultos > 0 && <span className="px-2 py-0.5 text-xs text-gray-500">y {numeroEs(departamentosOcultos)} más</span>}
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Población"
        valor={poblacion ? numeroEs(poblacion.total) : null}
        fuente={poblacion ? `DANE · proyección ${poblacion.anio} (serie 2020-2035, actualización post COVID-19)` : 'DANE · proyecciones municipales'}
      >
        {poblacion && (
          <>
            <Linea>
              Cabecera {numeroEs(poblacion.cabecera)} ({pctEs(poblacion.cabecera, poblacion.total)})
            </Linea>
            <Linea>
              Rural {numeroEs(poblacion.rural)} ({pctEs(poblacion.rural, poblacion.total)})
            </Linea>
            {poblacion.municipiosSinDato > 0 && <Linea tenue>{numeroEs(poblacion.municipiosSinDato)} municipios sin proyección</Linea>}
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Afiliados a salud"
        valor={afiliados ? numeroEs(afiliados.total) : null}
        fuente={afiliados ? `BDUA (ADRES) · afiliados activos · corte del ${fechaEs(afiliados.corte)}` : 'BDUA (ADRES)'}
      >
        {afiliados && (
          <>
            <Linea>
              Contributivo {numeroEs(afiliados.contributivo)} ({pctEs(afiliados.contributivo, afiliados.total)})
            </Linea>
            <Linea>
              Subsidiado {numeroEs(afiliados.subsidiado)} ({pctEs(afiliados.subsidiado, afiliados.total)})
            </Linea>
            {afiliados.eps.length > 0 && (
              <Linea tenue>EPS principales: {afiliados.eps.map(eps => `${eps.nombre} ${eps.pct.toLocaleString('es-CO')} %`).join(' · ')}</Linea>
            )}
            {afiliados.municipiosSinDato > 0 && <Linea tenue>{numeroEs(afiliados.municipiosSinDato)} municipios sin datos en la BDUA</Linea>}
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="IPS objetivo"
        valor={numeroEs(ips.total)}
        fuente={`IPS activas asignadas a la zona · servicios del REPS importados el ${fechaEs(ips.repsActualizado)}`}
      >
        <Linea>
          {numeroEs(ips.camas)} camas{ips.quirofanos !== null ? ` · ${numeroEs(ips.quirofanos)} quirófanos` : ''}
        </Linea>
        {ips.total > 0 && ips.conServiciosReps === 0 ? (
          <Linea tenue>Servicios del REPS: sin datos</Linea>
        ) : (
          ips.total > 0 && (
            <>
              <Linea>Con cirugía ortopédica: {numeroEs(ips.cirugiaOrtopedica)}</Linea>
              <Linea>Con neurocirugía: {numeroEs(ips.neurocirugia)}</Linea>
              <Linea>Con alguna de las dos: {numeroEs(ips.ortopediaONeuro)}</Linea>
              {ips.conServiciosReps < ips.total && (
                <Linea tenue>
                  {numeroEs(ips.conServiciosReps)} de {numeroEs(ips.total)} IPS tienen servicios del REPS importados
                </Linea>
              )}
            </>
          )
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Giros ADRES · 12 meses"
        valor={giros ? formatCopCompact(giros.valor) : null}
        fuente={
          giros
            ? `ADRES · ${giros.fuente === 'identifica' ? 'Identifica tu Giro (contributivo y subsidiado)' : 'Reporte 29 (solo subsidiado)'} · ${rangoMesesEs(giros.desde, giros.hasta)}`
            : 'ADRES'
        }
        ancho={!verSecop}
      >
        {giros && (
          <Linea>
            {numeroEs(giros.ipsConGiro)} de {numeroEs(ips.total)} IPS con giro
          </Linea>
        )}
      </Tarjeta>

      {verSecop && (
        <Tarjeta
          titulo="Compras públicas · 12 meses"
          valor={secop ? formatCopCompact(secop.valor) : null}
          fuente={
            secop
              ? `SECOP I, SECOP II e Integrado · material ortopédico y de neurocirugía · ${rangoMesesEs(secop.desde, secop.hasta)}${
                  secop.actualizado ? ` · datos al ${fechaEs(secop.actualizado)}` : ''
                }`
              : 'SECOP (Colombia Compra Eficiente)'
          }
        >
          {secop && (
            <>
              <Linea>
                {numeroEs(secop.contratos)} {secop.contratos === 1 ? 'contrato' : 'contratos'} · {numeroEs(secop.entidades)}{' '}
                {secop.entidades === 1 ? 'entidad' : 'entidades'}
              </Linea>
              <Linea>
                VG Medical: <strong className="text-gray-900">{formatCopCompact(secop.vg.valor)}</strong>
                {secop.valor > 0 ? ` (${pctEs(secop.vg.valor, secop.valor)})` : ''} · {numeroEs(secop.vg.contratos)}{' '}
                {secop.vg.contratos === 1 ? 'contrato' : 'contratos'}
              </Linea>
              {secop.ultimaFecha ? (
                <Linea tenue>Última firma: {fechaEs(secop.ultimaFecha)}</Linea>
              ) : (
                <Linea tenue>Sin compras de material ortopédico ni de neurocirugía en el periodo</Linea>
              )}
            </>
          )}
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Visitas · últimos 3 meses con datos"
        valor={visitas ? numeroEs(visitas.total) : null}
        fuente={visitas ? `Histórico de VMO · ${rangoMesesEs(visitas.desde, visitas.hasta)}` : 'Histórico de VMO'}
        ancho
      >
        {visitas && (
          <>
            <Linea>
              Efectivas {numeroEs(visitas.efectivas)} · No efectivas {numeroEs(visitas.noEfectivas)}
              {visitas.otras > 0 ? ` · Otras ${numeroEs(visitas.otras)}` : ''}
            </Linea>
            <Linea>
              Presenciales {numeroEs(visitas.presenciales)} · Virtuales {numeroEs(visitas.virtuales)} · {numeroEs(visitas.ipsVisitadas)} IPS visitadas
            </Linea>
            <Linea tenue>
              {visitas.ultimaVisita ? `Última visita registrada en la zona: ${fechaEs(visitas.ultimaVisita)}` : 'Sin visitas registradas en VMO para esta zona'}
            </Linea>
          </>
        )}
      </Tarjeta>
    </div>
  )
}

function Tarjeta({
  titulo,
  valor,
  fuente,
  children,
  ancho = false,
}: {
  titulo: string
  /** null = sin datos */
  valor: string | null
  fuente: string
  children?: ReactNode
  ancho?: boolean
}) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-4 min-w-0 flex flex-col ${ancho ? 'sm:col-span-2' : ''}`}>
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{titulo}</h4>
      {valor === null ? (
        <p className="mt-1 text-lg font-semibold text-gray-400">Sin datos</p>
      ) : (
        <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums break-words">{valor}</p>
      )}
      <div className="mt-1 space-y-0.5 flex-1">{children}</div>
      <p className="mt-3 text-xs text-gray-400 break-words">Fuente: {fuente}</p>
    </section>
  )
}

function Linea({ children, tenue = false }: { children: ReactNode; tenue?: boolean }) {
  return <p className={`text-sm break-words ${tenue ? 'text-gray-500' : 'text-gray-700'}`}>{children}</p>
}

// ---------------------------------------------------------------------------
// Cobertura por línea
// ---------------------------------------------------------------------------

function CoberturaBase({ filas, zona }: { filas: CoberturaZonaLinea[]; zona: string }) {
  return (
    <section className="min-w-0">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Quién cubre {zona} en cada línea</h4>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
        {filas.map(fila => (
          <li key={fila.line.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 min-w-0">
            <span className="text-sm font-medium text-gray-900 min-w-0 break-words">{fila.line.name}</span>
            <span className="flex flex-wrap items-center gap-2 text-sm text-gray-700 min-w-0">
              {fila.kind ? (
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${KIND_BADGE[fila.kind]}`}>{KIND_LABELS[fila.kind]}</span>
              ) : (
                <span className="text-xs text-gray-400">Sin cálculo</span>
              )}
              {fila.executive ? (
                <span className="break-words">
                  {fila.executive.full_name}
                  {fila.kind === 'reach' && fila.travel_minutes !== null ? ` · ${formatMinutes(fila.travel_minutes)}` : ''}
                </span>
              ) : fila.kind === 'vacant' ? (
                <span className="text-gray-500 break-words">
                  Nadie la cubre{fila.nearest ? ` · más cercana: ${fila.nearest.full_name} a ${formatMinutes(fila.nearest.minutes)}` : ''}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

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
