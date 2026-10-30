'use client'

// Seguimiento de las líderes en /lideres (dueño, 2026-10-29, docs/decisiones/2026-10-29-historico-tracker-lideres.md).
// Muestra el histórico del Excel "Tracker Líderes" guardado en OpMap (GET /api/lideres/historico) hasta su fecha de
// corte: dónde está cada una, cumplimiento, ritmo, tipos, ciudades y calidad del registro. Desde el 2026-10-30 (dueño)
// el Excel ya no se sube desde aquí: el histórico se carga una sola vez con scripts/lideres-historico-cargar.ts, y lo
// nuevo las líderes lo planean y lo reportan en la app.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoricoRespuesta } from '@/app/api/lideres/_lib/historico-server'
import { ESTADO_TEXTO, TIPO_TEXTO, type EstadoHistorico } from '@/lib/lideres-historico'
import {
  agendaTresSemanas,
  calidadRegistro,
  PERIODOS_SEGUIMIENTO,
  realizadasPorCiudad,
  realizadasPorMes,
  realizadasPorTipo,
  resumenPorLider,
  type ActividadSeguimiento,
  type PeriodoSeguimiento,
} from '@/lib/lideres-seguimiento'
import { hoyBogota } from '@/lib/visits-rules'

const COLORES_LIDER = ['#2a78d6', '#eb6834', '#16a34a', '#9333ea', '#ca8a04', '#0891b2', '#db2777', '#4b5563']
const COLOR_ESTADO: Record<EstadoHistorico, string> = { realizada: '#16a34a', planificada: '#64748b', sin_cerrar: '#d97706', cancelada: '#dc2626' }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const entero = (n: number) => n.toLocaleString('es-CO')
const fechaCorta = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '—')

function Tarjeta({ titulo, nota, children, className = '' }: { titulo: string; nota?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 min-w-0 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      {nota && <p className="text-xs text-gray-500 mt-0.5 mb-3">{nota}</p>}
      {children}
    </section>
  )
}

function Cifra({ etiqueta, valor, nota, alerta = false }: { etiqueta: string; valor: string; nota: string; alerta?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-medium text-gray-500">{etiqueta}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${alerta ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5">{nota}</p>
    </div>
  )
}

/** Barras horizontales sencillas (una serie), con el número al final. */
function Barras({ filas, color }: { filas: Array<{ etiqueta: string; n: number }>; color: string }) {
  const maximo = Math.max(1, ...filas.map(fila => fila.n))
  if (filas.length === 0) return <p className="text-sm text-gray-500 py-4 text-center">Sin actividades realizadas en el período.</p>
  return (
    <ul className="space-y-1.5">
      {filas.map(fila => (
        <li key={fila.etiqueta} className="grid grid-cols-[minmax(6rem,10rem)_1fr] items-center gap-2 text-sm">
          <span className="truncate text-gray-700" title={fila.etiqueta}>
            {fila.etiqueta}
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <span className="h-3.5 rounded" style={{ width: `${Math.max(2, (fila.n / maximo) * 100)}%`, background: color }} />
            <span className="tabular-nums text-gray-900 text-xs">{entero(fila.n)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function SeguimientoLideres() {
  const [historico, setHistorico] = useState<HistoricoRespuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<PeriodoSeguimiento>('mes')
  const [lider, setLider] = useState('Todas')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const respuesta = await fetch('/api/lideres/historico', { cache: 'no-store' })
      const cuerpo = await respuesta.json().catch(() => null)
      if (!respuesta.ok) throw new Error(cuerpo?.error ?? `Error ${respuesta.status}`)
      setHistorico(cuerpo as HistoricoRespuesta)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el histórico')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Lo que se muestra: el histórico guardado (la carga única del Excel)
  const actividades: ActividadSeguimiento[] = useMemo(
    () =>
      (historico?.filas ?? []).map(fila => ({
        fecha: fila.fecha,
        lider: fila.lider,
        ciudad: fila.ciudad,
        municipio_id: fila.municipio_id,
        tipo: fila.tipo,
        tipo_a_mano: fila.tipo_a_mano,
        estado: fila.estado,
        contactos: fila.contactos,
        con_observacion: fila.con_observacion,
      })),
    [historico]
  )

  const carga = historico?.carga ?? null
  const corte = carga?.corte ?? hoyBogota()
  const nombresLideres = useMemo(() => Array.from(new Set(actividades.map(actividad => actividad.lider))).sort((a, b) => a.localeCompare(b, 'es')), [actividades])
  const colorDe = (nombre: string) => COLORES_LIDER[Math.max(0, nombresLideres.indexOf(nombre)) % COLORES_LIDER.length]
  const elegidas = useMemo(() => (lider === 'Todas' ? actividades : actividades.filter(actividad => actividad.lider === lider)), [actividades, lider])
  const resumen = useMemo(() => resumenPorLider(actividades, periodo, corte), [actividades, periodo, corte])
  const fila = lider === 'Todas' ? resumen.total : resumen.lideres.find(item => item.lider === lider) ?? resumen.total
  const agenda = useMemo(() => agendaTresSemanas(elegidas, corte), [elegidas, corte])
  const porMes = useMemo(() => realizadasPorMes(elegidas, corte), [elegidas, corte])
  const tipos = useMemo(() => realizadasPorTipo(elegidas, periodo, corte), [elegidas, periodo, corte])
  const ciudades = useMemo(() => realizadasPorCiudad(elegidas, periodo, corte), [elegidas, periodo, corte])
  // El histórico guardado trae el código DANE de cada ciudad reconocida
  const calidad = useMemo(() => calidadRegistro(actividades, true), [actividades])
  const maximoMes = Math.max(1, ...porMes.map(mes => mes.total))
  const periodoTexto = periodo === 'mes' ? `En ${MESES_LARGOS[Number(corte.slice(5, 7)) - 1]}` : periodo === 'tres' ? 'En los últimos 3 meses' : 'En todo el registro'
  const hayDatos = actividades.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Líderes de negocio</h1>
        {(cargando || historico) && (
          <p className="text-gray-600 mt-2 max-w-3xl">
            {cargando ? (
              'Cargando…'
            ) : carga ? (
              <>
                Seguimiento de lo que hacen las líderes: dónde están, qué hicieron y qué planearon, con el histórico del Excel &ldquo;Tracker
                Líderes&rdquo;. Lo nuevo, las líderes lo planean y lo reportan en la app.
              </>
            ) : (
              'Todavía no está cargado el histórico del Excel.'
            )}
          </p>
        )}
        {historico && !historico.disponible && (
          <p className="mt-3 max-w-3xl text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Falta aplicar en la base la migración 0920 (con autorización del dueño): sin ella no hay dónde guardar el histórico del Excel.
          </p>
        )}
        {error && <p className="mt-3 max-w-3xl text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      </div>

      {hayDatos && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap rounded-lg border border-gray-300 p-0.5" role="group" aria-label="Período">
              {PERIODOS_SEGUIMIENTO.map(item => (
                <button
                  key={item.valor}
                  type="button"
                  aria-pressed={periodo === item.valor}
                  onClick={() => setPeriodo(item.valor)}
                  className={`min-h-[36px] px-3 text-sm rounded-md ${periodo === item.valor ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {item.etiqueta}
                </button>
              ))}
            </div>
            <select value={lider} onChange={event => setLider(event.target.value)} aria-label="Líder" className="rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm">
              <option value="Todas">Todas las líderes</option>
              {nombresLideres.map(nombre => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{`Corte ${fechaCorta(corte)}`}</span>
          </div>

          <p className="text-base text-gray-700 max-w-3xl">
            {periodoTexto}, {lider === 'Todas' ? 'las líderes hicieron' : `${lider} hizo`} <strong className="tabular-nums">{entero(fila.realizadas)}</strong> actividades en{' '}
            <strong className="tabular-nums">{entero(fila.ciudades)}</strong> ciudades. <strong className="tabular-nums">{entero(fila.sinCerrar)}</strong> quedaron con la fecha
            vencida y sin resultado, y <strong className="tabular-nums">{entero(fila.canceladasSinObservacion)}</strong> de <strong className="tabular-nums">{entero(fila.canceladas)}</strong>{' '}
            cancelaciones no dicen por qué.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Cifra etiqueta="Realizadas" valor={entero(fila.realizadas)} nota='con resultado "Exitosa"' />
            <Cifra etiqueta="Vencidas sin cerrar" valor={entero(fila.sinCerrar)} nota="fecha pasada, sin resultado" alerta={fila.sinCerrar > 0} />
            <Cifra etiqueta="Canceladas" valor={entero(fila.canceladas)} nota={`${entero(fila.canceladasSinObservacion)} sin observación`} alerta={fila.canceladasSinObservacion > 0} />
            <Cifra etiqueta="Planificadas" valor={entero(fila.planificadas)} nota="del día de la carga en adelante" />
            <Cifra etiqueta="Ciudades" valor={entero(fila.ciudades)} nota="con alguna realizada" />
            <Cifra etiqueta="Contactos anotados" valor={entero(fila.contactos)} nota="en las realizadas" />
          </div>

          <Tarjeta titulo="Dónde está cada una" nota="Una semana atrás y dos adelante. Pasa el cursor por una actividad para ver el tipo y el estado.">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-2" aria-hidden="true">
              {(Object.keys(COLOR_ESTADO) as EstadoHistorico[]).map(estado => (
                <span key={estado} className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLOR_ESTADO[estado] }} />
                  {ESTADO_TEXTO[estado]}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white text-left font-medium text-gray-500 pr-3 py-1">Líder</th>
                    {agenda.dias.map(dia => {
                      const fecha = new Date(`${dia}T12:00:00Z`)
                      return (
                        <th key={dia} className={`px-1.5 py-1 font-medium whitespace-nowrap text-center ${dia === corte ? 'text-gray-900' : 'text-gray-500'}`}>
                          {DIAS[fecha.getUTCDay()]} {fecha.getUTCDate()}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {agenda.lideres.map(nombre => (
                    <tr key={nombre}>
                      <td className="sticky left-0 bg-white pr-3 py-1.5 border-t border-gray-100 whitespace-nowrap text-gray-800 align-top">{nombre}</td>
                      {agenda.dias.map(dia => (
                        <td key={dia} className={`px-1 py-1.5 border-t border-gray-100 align-top min-w-[4.5rem] ${dia === corte ? 'bg-gray-50' : ''}`}>
                          {(agenda.celdas.get(`${nombre}|${dia}`) ?? []).map((actividad, indice) => (
                            <span key={indice} className="flex items-center gap-1 whitespace-nowrap leading-tight mb-0.5" title={`${TIPO_TEXTO[actividad.tipo]} · ${ESTADO_TEXTO[actividad.estado]}`}>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_ESTADO[actividad.estado] }} />
                              {actividad.ciudad}
                            </span>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Cumplimiento por líder"
            nota='"% cerradas": las que tienen resultado (realizada o cancelada) entre todas las de fecha pasada del período. "Última realizada": su última actividad con resultado.'
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3 font-medium">Líder</th>
                    <th className="py-2 pr-3 font-medium text-right">Realizadas</th>
                    <th className="py-2 pr-3 font-medium text-right">Canceladas</th>
                    <th className="py-2 pr-3 font-medium text-right">Sin observación</th>
                    <th className="py-2 pr-3 font-medium text-right">Vencidas sin cerrar</th>
                    <th className="py-2 pr-3 font-medium text-right">% cerradas</th>
                    <th className="py-2 pr-3 font-medium text-right">Ciudades</th>
                    <th className="py-2 pr-3 font-medium text-right">Contactos</th>
                    <th className="py-2 pr-3 font-medium text-right">Planificadas</th>
                    <th className="py-2 font-medium">Última realizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...resumen.lideres.filter(item => lider === 'Todas' || item.lider === lider), resumen.total].map(item => (
                    <tr key={item.lider} className={item === resumen.total ? 'font-semibold' : ''}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {item !== resumen.total && <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: colorDe(item.lider) }} />}
                        {item.lider}
                      </td>
                      <td className="py-2 pr-3 text-right">{entero(item.realizadas)}</td>
                      <td className="py-2 pr-3 text-right">{entero(item.canceladas)}</td>
                      <td className={`py-2 pr-3 text-right ${item.canceladasSinObservacion > 0 ? 'text-red-600' : ''}`}>{entero(item.canceladasSinObservacion)}</td>
                      <td className={`py-2 pr-3 text-right ${item.sinCerrar > 0 ? 'text-red-600' : ''}`}>{entero(item.sinCerrar)}</td>
                      <td className="py-2 pr-3 text-right">{item.pctCerradas === null ? '—' : `${Math.round(item.pctCerradas * 100)} %`}</td>
                      <td className="py-2 pr-3 text-right">{entero(item.ciudades)}</td>
                      <td className="py-2 pr-3 text-right">{entero(item.contactos)}</td>
                      <td className="py-2 pr-3 text-right">{entero(item.planificadas)}</td>
                      <td className="py-2 whitespace-nowrap">{fechaCorta(item.ultima)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Tarjeta titulo="Realizadas por mes" nota="Todo el registro hasta el corte; el color dice de quién es cada parte.">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                {nombresLideres
                  .filter(nombre => lider === 'Todas' || nombre === lider)
                  .map(nombre => (
                    <span key={nombre} className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: colorDe(nombre) }} />
                      {nombre}
                    </span>
                  ))}
              </div>
              <div className="flex items-end gap-2 h-44" role="img" aria-label="Actividades realizadas por mes">
                {porMes.map(mes => (
                  <div key={mes.mes} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-xs tabular-nums text-gray-700">{entero(mes.total)}</span>
                    <div className="w-full max-w-[2.5rem] flex flex-col-reverse rounded overflow-hidden" style={{ height: `${(mes.total / maximoMes) * 100}%` }}>
                      {Object.entries(mes.porLider).map(([nombre, n]) => (
                        <div key={nombre} title={`${nombre}: ${n}`} style={{ height: `${(n / mes.total) * 100}%`, background: colorDe(nombre) }} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{MESES[Number(mes.mes.slice(5)) - 1]}</span>
                  </div>
                ))}
              </div>
            </Tarjeta>
            <Tarjeta titulo="Qué hicieron" nota="Realizadas por tipo, en el período y para la líder elegida.">
              <Barras filas={tipos.map(item => ({ etiqueta: TIPO_TEXTO[item.clave], n: item.n }))} color="#2a78d6" />
            </Tarjeta>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Tarjeta titulo="Ciudades con más actividades realizadas" nota="Las diez primeras del período, para la líder elegida.">
              <Barras filas={ciudades.map(item => ({ etiqueta: item.clave, n: item.n }))} color="#16a34a" />
            </Tarjeta>
            <Tarjeta titulo="Lo que el Excel deja escribir mal" nota="Todo el registro. Con la app de las líderes esto no pasa: cada caso tiene su regla.">
              <ul className="divide-y divide-gray-100 text-sm">
                {[
                  { n: calidad.sinCerrar, titulo: 'Vencidas sin cerrar', arreglo: 'Lo vencido le aparece a la líder para cerrarlo con su resultado.' },
                  { n: calidad.canceladasSinObservacion, titulo: 'Canceladas sin observación', arreglo: 'Cancelar pide el motivo.' },
                  { n: calidad.realizadasSinContactos, titulo: 'Realizadas sin contactos anotados', arreglo: 'Los médicos se eligen de la lista de OpMap.' },
                  { n: calidad.fechasIlegibles, titulo: 'Fechas que no se pueden leer', arreglo: 'La fecha se elige en un calendario.' },
                  { n: calidad.tiposAMano, titulo: 'Tipos escritos a mano', arreglo: 'El tipo se elige de una lista.' },
                  { n: calidad.ciudadesSinCodigo, titulo: 'Ciudades que no son un municipio de Colombia', arreglo: 'La ciudad sale de la lista del DANE.' },
                ].map(item => (
                  <li key={item.titulo} className="py-2 grid grid-cols-[3rem_1fr] gap-3 items-baseline">
                    <span className={`text-right text-lg font-semibold tabular-nums ${item.n > 0 ? 'text-red-600' : 'text-green-700'}`}>{entero(item.n)}</span>
                    <span>
                      <span className="text-gray-900">{item.titulo}</span>
                      <span className="block text-xs text-gray-500">{item.arreglo}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  )
}
