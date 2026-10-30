'use client'

// "IPS con cambios fuera de lo normal" en Inteligencia › Giros (spec 2026-10-29-giros-variaciones). Compara los últimos
// 3, 6 o 12 meses de cada prestador (NIT) con los anteriores o con el año anterior, frente a lo que creció todo el país,
// y dice qué tan confiable es el cambio. Datos: GET /api/intelligence/giros/variacion con los filtros de la página.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { VariacionApiResponse } from '@/app/api/intelligence/giros/variacion/route'
import { csvCell, formatCopCompact, formatPct, GIROS_COLORS, nombreCortoEntidad } from '@/lib/giros-format'
import {
  CONFIANZA_TEXTO,
  MINIMO_MENSUAL_DEFECTO,
  senalBaja,
  senalSube,
  textoSenal,
  VENTANAS,
  ventanasVariacion,
  type Comparacion,
  type ConfianzaVariacion,
  type VariacionIps,
  type VentanaMeses,
} from '@/lib/giros-variacion'
import { mesCorto, type MesesDisponibles } from '@/lib/periodo-giros'

type Mostrar = 'suben' | 'bajan' | 'todas'
type Orden = 'pesos' | 'porcentaje' | 'confianza'

const PAGINA = 25
const SELECT = 'rounded-lg border border-gray-300 px-3 py-2 bg-white text-sm'
const ORDEN_CONFIANZA: Record<ConfianzaVariacion, number> = { alta: 0, media: 1, baja: 2 }
const MINIMOS = [
  { valor: 0, etiqueta: 'Todas las IPS', corto: '' },
  { valor: 100_000_000, etiqueta: 'Desde 100 M al mes', corto: '100 M' },
  { valor: 1_000_000_000, etiqueta: 'Desde 1.000 M al mes', corto: '1.000 M' },
]
const COMPARACIONES: Array<{ valor: Comparacion; etiqueta: string }> = [
  { valor: 'anterior', etiqueta: 'los meses anteriores' },
  { valor: 'anio_anterior', etiqueta: 'los mismos meses del año anterior' },
]
const MOSTRAR: Array<{ valor: Mostrar; etiqueta: string }> = [
  { valor: 'suben', etiqueta: 'Suben más que el mercado' },
  { valor: 'bajan', etiqueta: 'Bajan o crecen menos' },
  { valor: 'todas', etiqueta: 'Todas' },
]
const COLOR_RECIENTE_BAJA = GIROS_COLORS.evento
const COLOR_BASE = '#9ca3af'
const COLOR_OTROS_MESES = '#e5e7eb'

const conSigno = (texto: string, valor: number) => `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${texto}`
const pctConSigno = (fraccion: number | null) => (fraccion === null ? '—' : conSigno(formatPct(Math.abs(fraccion) * 100), fraccion))
const pesosConSigno = (valor: number) => conSigno(formatCopCompact(Math.abs(valor)), valor)
const numeroP = (valor: number | null) => (valor === null ? '—' : valor < 0.0001 ? '< 0,0001' : valor.toLocaleString('es-CO', { maximumSignificantDigits: 2 }))

function claseSenal(fila: VariacionIps): string {
  if (senalSube(fila.senal)) return 'bg-green-50 text-green-800 border-green-200'
  if (senalBaja(fila.senal)) return 'bg-red-50 text-red-800 border-red-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

function detalleConfianza(fila: VariacionIps): string {
  if (fila.p === null) return fila.senal === 'giros_nuevos' ? 'Sin giros en los meses de comparación' : 'Sin giros en los meses recientes'
  const prueba = fila.prueba === 'mes' ? 'un mes frente a los de la comparación' : 'promedio mensual (Welch)'
  return `p = ${numeroP(fila.p)} · q = ${numeroP(fila.q)} · prueba: ${prueba}`
}

/** Barras de los meses cargados: gris los de comparación, color los recientes, claro los demás de la tendencia. */
function MiniSerie({ fila, meses, base, reciente }: { fila: VariacionIps; meses: string[]; base: Set<string>; reciente: Set<string> }) {
  const ancho = 120
  const alto = 28
  const maximo = Math.max(...fila.serie, 1)
  const paso = ancho / Math.max(1, fila.serie.length)
  const colorReciente = senalBaja(fila.senal) ? COLOR_RECIENTE_BAJA : GIROS_COLORS.total
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Giro de cada mes de ${fila.nombre}`} className="block">
      {fila.serie.map((valor, index) => {
        const mes = meses[index]
        const alturaBarra = valor > 0 ? Math.max(1.5, (valor / maximo) * (alto - 2)) : 0
        const color = reciente.has(mes) ? colorReciente : base.has(mes) ? COLOR_BASE : COLOR_OTROS_MESES
        return (
          <rect key={mes} x={index * paso + 0.5} y={alto - alturaBarra} width={Math.max(1, paso - 1.5)} height={alturaBarra} rx={1} fill={color}>
            <title>{`${mesCorto(mes)}: ${formatCopCompact(valor)}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function Entidades({ fila }: { fila: VariacionIps }) {
  if (fila.entidades.length === 0) return <span className="text-gray-400">—</span>
  return (
    <ul className="space-y-0.5">
      {fila.entidades.map(entidad => (
        <li key={entidad.clave} className="flex items-baseline gap-1.5 min-w-0">
          <span className="truncate max-w-[11rem]" title={entidad.nombre}>
            {nombreCortoEntidad(entidad.nombre)}
          </span>
          <span className="tabular-nums whitespace-nowrap text-gray-900">{pesosConSigno(entidad.cambio)}</span>
          {entidad.nueva && <span className="text-[11px] text-green-700">nueva</span>}
          {entidad.dejo && <span className="text-[11px] text-red-700">dejó de girar</span>}
        </li>
      ))}
    </ul>
  )
}

function construirCsv(data: VariacionApiResponse, filas: VariacionIps[]): string {
  const lineas: string[] = []
  const agregar = (celdas: Array<string | number | null | undefined>) => lineas.push(celdas.map(csvCell).join(';'))
  const conEjecutivo = data.line !== null
  const pct = (fraccion: number | null) => (fraccion === null ? '' : (Math.round(fraccion * 1000) / 10).toLocaleString('es-CO'))
  agregar([`Comparación: ${data.ventanas.texto}`, `Fuente: ${data.fuente === 'identifica' ? 'ADRES Identifica tu Giro' : 'ADRES Reporte 29'}`, `Régimen: ${data.regimen}`])
  agregar([`Mercado (todas las IPS del país): ${pct(data.mercado.variacion)} %`])
  agregar([
    'NIT',
    'IPS',
    'Sedes del NIT',
    'Municipio',
    'Departamento',
    'Zona',
    ...(conEjecutivo ? ['Ejecutivo Comercial'] : []),
    'Giro antes (COP)',
    'Giro ahora (COP)',
    'Cambio (COP)',
    'Cambio (%)',
    'Frente al mercado (%)',
    'Señal',
    'Confianza',
    'p',
    'q',
    'Tendencia 12 meses (tau)',
    'Tendencia (p)',
    'Pendiente (% del mes típico)',
    'Quién explica el cambio',
  ])
  for (const fila of filas) {
    agregar([
      fila.nit,
      fila.nombre,
      fila.sedes,
      fila.municipio,
      fila.departamento,
      fila.zona ?? 'Sin zona asignada',
      ...(conEjecutivo ? [fila.ejecutivo] : []),
      fila.base,
      fila.reciente,
      fila.cambio,
      pct(fila.variacion),
      pct(fila.frenteAlMercado),
      textoSenal(fila),
      CONFIANZA_TEXTO[fila.confianza],
      fila.p === null ? '' : fila.p.toExponential(2),
      fila.q === null ? '' : fila.q.toExponential(2),
      fila.tendencia ? (Math.round(fila.tendencia.tau * 100) / 100).toLocaleString('es-CO') : '',
      fila.tendencia ? fila.tendencia.p.toExponential(2) : '',
      fila.tendencia ? pct(fila.tendencia.pendientePct) : '',
      fila.entidades.map(entidad => `${entidad.nombre} ${Math.round(entidad.cambio)}${entidad.nueva ? ' (nueva)' : entidad.dejo ? ' (dejó de girar)' : ''}`).join(' | '),
    ])
  }
  return '﻿' + lineas.join('\r\n') + '\r\n'
}

function descargarCsv(data: VariacionApiResponse, filas: VariacionIps[]) {
  const blob = new Blob([construirCsv(data, filas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `giros-variaciones-${data.ventanas.reciente.desde}_${data.ventanas.reciente.hasta}-contra-${data.ventanas.base.desde}_${data.ventanas.base.hasta}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export default function GirosVariaciones({
  line,
  departamento,
  municipio,
  regimen,
  fuente,
  hasta,
  disponible,
}: {
  line: string
  departamento: string
  municipio: string
  regimen: 'todos' | 'contributivo' | 'subsidiado'
  fuente: 'auto' | 'identifica' | 'reporte29'
  /** Último mes del período elegido en la página (null: el último con datos). */
  hasta: string | null
  /** Meses con datos de la fuente (para apagar las comparaciones que no caben). */
  disponible: MesesDisponibles | null
}) {
  const [ventana, setVentana] = useState<VentanaMeses>(6)
  const [comparacion, setComparacion] = useState<Comparacion>('anterior')
  const [minimo, setMinimo] = useState(MINIMO_MENSUAL_DEFECTO)
  const [mostrar, setMostrar] = useState<Mostrar>('suben')
  const [soloConfianza, setSoloConfianza] = useState(true)
  const [orden, setOrden] = useState<Orden>('pesos')
  const [data, setData] = useState<VariacionApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGINA)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ ventana: String(ventana), comparar: comparacion, minimo: String(minimo) })
    if (line) params.set('line', line)
    if (departamento) params.set('departamento', departamento)
    if (municipio) params.set('municipio', municipio)
    if (regimen !== 'todos') params.set('regimen', regimen)
    if (fuente !== 'auto') params.set('fuente', fuente)
    if (hasta) params.set('hasta', hasta)
    setLoading(true)
    setError(null)
    fetch(`/api/intelligence/giros/variacion?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        setData(body as VariacionApiResponse)
        setVisible(PAGINA)
      })
      .catch(err => {
        if (controller.signal.aborted) return
        setData(null)
        setError(err instanceof Error ? err.message : 'No se pudieron calcular las variaciones')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [line, departamento, municipio, regimen, fuente, hasta, ventana, comparacion, minimo])

  // Si lo elegido deja de caber en los meses cargados (otra fuente o un período que termina antes), se pasa a la
  // comparación más útil que sí quepa
  const disponibleMin = disponible?.min ?? null
  const disponibleMax = disponible?.max ?? null
  useEffect(() => {
    if (!disponibleMin || !disponibleMax) return
    const meses = { min: disponibleMin, max: disponibleMax }
    const cabe = (v: VentanaMeses, c: Comparacion) => ventanasVariacion({ hasta: hasta ?? meses.max, ventana: v, comparacion: c, disponible: meses }).ok
    if (cabe(ventana, comparacion)) return
    const alternativas: Array<[VentanaMeses, Comparacion]> = [
      [6, 'anterior'],
      [3, 'anterior'],
      [6, 'anio_anterior'],
      [3, 'anio_anterior'],
      [12, 'anterior'],
    ]
    const otra = alternativas.find(([v, c]) => cabe(v, c))
    if (otra) {
      setVentana(otra[0])
      setComparacion(otra[1])
    }
  }, [disponibleMin, disponibleMax, hasta, ventana, comparacion])

  // Qué comparaciones caben en los meses cargados (las otras se apagan con el porqué)
  const motivoNoCabe = (v: VentanaMeses, c: Comparacion): string | null => {
    if (!disponible) return null
    const resultado = ventanasVariacion({ hasta: hasta ?? disponible.max, ventana: v, comparacion: c, disponible })
    return resultado.ok ? null : resultado.error
  }

  const filas = useMemo(() => {
    if (!data) return []
    const elegidas = data.filas.filter(fila => {
      if (soloConfianza && fila.confianza === 'baja') return false
      if (mostrar === 'suben') return senalSube(fila.senal)
      if (mostrar === 'bajan') return senalBaja(fila.senal)
      return true
    })
    const magnitud = (fila: VariacionIps) => Math.abs(fila.cambio)
    const porcentaje = (fila: VariacionIps) => (fila.variacion === null ? Infinity : Math.abs(fila.variacion))
    return [...elegidas].sort((a, b) => {
      if (orden === 'porcentaje') return porcentaje(b) - porcentaje(a) || magnitud(b) - magnitud(a)
      if (orden === 'confianza') return ORDEN_CONFIANZA[a.confianza] - ORDEN_CONFIANZA[b.confianza] || (a.q ?? a.p ?? 1) - (b.q ?? b.p ?? 1) || magnitud(b) - magnitud(a)
      return magnitud(b) - magnitud(a)
    })
  }, [data, mostrar, soloConfianza, orden])

  const mesesBase = useMemo(() => new Set(data?.ventanas.base.meses ?? []), [data])
  const mesesRecientes = useMemo(() => new Set(data?.ventanas.reciente.meses ?? []), [data])
  const conEjecutivo = Boolean(data?.line)
  const minimoTexto = MINIMOS.find(item => item.valor === minimo)?.corto ?? ''

  return (
    <section id="variaciones" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6" aria-labelledby="variaciones-titulo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="variaciones-titulo" className="text-lg font-semibold text-gray-900">
            IPS con cambios fuera de lo normal
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data ? `${data.ventanas.texto} · ${data.fuente === 'identifica' ? 'Identifica tu Giro' : 'Reporte 29'} · frente a todo el país` : 'Giro de cada prestador frente a lo que creció todo el país'}
          </p>
        </div>
        <button
          type="button"
          disabled={!data || filas.length === 0}
          onClick={() => data && descargarCsv(data, filas)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Exportar CSV
        </button>
      </div>

      {/* Controles de la comparación y de la lista */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mt-4">
        <div>
          <span className="block text-xs font-medium text-gray-600 mb-1">Comparar los últimos</span>
          <div className="inline-flex rounded-lg border border-gray-300 p-0.5" role="group" aria-label="Meses a comparar">
            {VENTANAS.map(item => {
              const motivo = motivoNoCabe(item, comparacion)
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={ventana === item}
                  aria-label={`${item} meses`}
                  disabled={Boolean(motivo)}
                  title={motivo ?? undefined}
                  onClick={() => setVentana(item)}
                  className={`min-h-[36px] px-3 text-sm rounded-md ${ventana === item ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {item} meses
                </button>
              )
            })}
          </div>
        </div>
        <label className="text-sm">
          <span className="block text-xs font-medium text-gray-600 mb-1">Contra</span>
          <select value={comparacion} onChange={event => setComparacion(event.target.value as Comparacion)} className={SELECT}>
            {COMPARACIONES.map(item => (
              <option key={item.valor} value={item.valor} disabled={Boolean(motivoNoCabe(ventana, item.valor))}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="block text-xs font-medium text-gray-600 mb-1">Mostrar</span>
          <div className="inline-flex flex-wrap rounded-lg border border-gray-300 p-0.5" role="group" aria-label="Qué IPS mostrar">
            {MOSTRAR.map(item => (
              <button
                key={item.valor}
                type="button"
                aria-pressed={mostrar === item.valor}
                onClick={() => {
                  setMostrar(item.valor)
                  setVisible(PAGINA)
                }}
                className={`min-h-[36px] px-3 text-sm rounded-md ${mostrar === item.valor ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {item.etiqueta}
              </button>
            ))}
          </div>
        </div>
        <label className="text-sm">
          <span className="block text-xs font-medium text-gray-600 mb-1">Tamaño</span>
          <select value={minimo} onChange={event => setMinimo(Number(event.target.value))} className={SELECT}>
            {MINIMOS.map(item => (
              <option key={item.valor} value={item.valor}>
                {item.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</span>
          <select value={orden} onChange={event => setOrden(event.target.value as Orden)} className={SELECT}>
            <option value="pesos">Cambio en pesos</option>
            <option value="porcentaje">Cambio en %</option>
            <option value="confianza">Confianza</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 min-h-[40px]">
          <input type="checkbox" checked={soloConfianza} onChange={event => setSoloConfianza(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Solo cambios con confianza
        </label>
      </div>

      {error && <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">{error}</p>}

      {data && (
        <p className={`text-sm text-gray-700 mt-4 ${loading ? 'opacity-60' : ''}`}>
          El giro de todas las IPS del país{' '}
          {data.mercado.variacion === null ? (
            'no tiene base para comparar'
          ) : (
            <>
              {data.mercado.variacion >= 0 ? 'subió' : 'bajó'} <strong className="tabular-nums">{formatPct(Math.abs(data.mercado.variacion) * 100)}</strong>
            </>
          )}{' '}
          ({data.ventanas.texto}). En este filtro: <strong className="tabular-nums">{data.resumen.suben}</strong> por encima del mercado,{' '}
          <strong className="tabular-nums">{data.resumen.bajan}</strong> por debajo
          {data.resumen.nuevas > 0 && `, ${data.resumen.nuevas} con giros nuevos`}
          {data.resumen.dejan > 0 && `, ${data.resumen.dejan} sin giros recientes`} y {data.resumen.sinCambio} sin cambio importante.
          {data.resumen.pequenas > 0 &&
            ` ${data.resumen.pequenas === 1 ? 'No se muestra 1 IPS' : `No se muestran ${data.resumen.pequenas} IPS`} con menos de ${minimoTexto} al mes.`}
        </p>
      )}

      {!data && loading && !error && <p className="text-sm text-gray-500 py-6 text-center">Calculando…</p>}

      {data && filas.length === 0 && !loading && (
        <p className="text-sm text-gray-500 py-6 text-center">Ninguna IPS de este filtro cumple lo elegido. Prueba con &ldquo;Todas&rdquo; o quita &ldquo;Solo cambios con confianza&rdquo;.</p>
      )}

      {data && filas.length > 0 && (
        <div className={`mt-4 ${loading ? 'opacity-60' : ''}`}>
          {/* Celular: tarjetas */}
          <ol className="sm:hidden divide-y divide-gray-100 border-t border-gray-100">
            {filas.slice(0, visible).map(fila => (
              <li key={fila.nit} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/hospitals/${fila.hospital_id}`} className="text-sm font-medium text-gray-900 hover:underline break-words">
                      {fila.nombre}
                    </Link>
                    <p className="text-xs text-gray-500 break-words">
                      {[fila.municipio, fila.zona ?? 'Sin zona asignada', conEjecutivo ? fila.ejecutivo : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{pesosConSigno(fila.cambio)}</p>
                    <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{pctConSigno(fila.variacion)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 tabular-nums">
                  {formatCopCompact(fila.base)} → {formatCopCompact(fila.reciente)} · frente al mercado {pctConSigno(fila.frenteAlMercado)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${claseSenal(fila)}`}>{textoSenal(fila)}</span>
                  <span className="text-xs text-gray-600" title={detalleConfianza(fila)}>
                    Confianza {CONFIANZA_TEXTO[fila.confianza].toLowerCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  <Entidades fila={fila} />
                </div>
                <MiniSerie fila={fila} meses={data.ventanas.meses} base={mesesBase} reciente={mesesRecientes} />
              </li>
            ))}
          </ol>

          {/* Escritorio: tabla */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">IPS</th>
                  <th className="py-2 pr-3 font-medium text-right">Antes</th>
                  <th className="py-2 pr-3 font-medium text-right">Ahora</th>
                  <th className="py-2 pr-3 font-medium text-right">Cambio</th>
                  <th className="py-2 pr-3 font-medium text-right" title="Cuánto más (o menos) creció que todas las IPS del país">
                    Frente al mercado
                  </th>
                  <th className="py-2 pr-3 font-medium">Señal</th>
                  <th className="py-2 pr-3 font-medium">Quién lo explica</th>
                  <th className="py-2 font-medium">Meses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filas.slice(0, visible).map(fila => (
                  <tr key={fila.nit} className="align-top">
                    <td className="py-2.5 pr-3 min-w-[14rem]">
                      <Link href={`/hospitals/${fila.hospital_id}`} className="font-medium text-gray-900 hover:underline">
                        {fila.nombre}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[`NIT ${fila.nit}${fila.sedes > 1 ? ` (${fila.sedes} sedes)` : ''}`, fila.municipio, fila.zona ?? 'Sin zona asignada', conEjecutivo ? fila.ejecutivo : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap text-gray-700">{formatCopCompact(fila.base)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap text-gray-900">{formatCopCompact(fila.reciente)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{pesosConSigno(fila.cambio)}</span>
                      <span className="block text-xs text-gray-500">{pctConSigno(fila.variacion)}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums whitespace-nowrap text-gray-700">{pctConSigno(fila.frenteAlMercado)}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${claseSenal(fila)}`}>{textoSenal(fila)}</span>
                      <span className={`block text-xs mt-1 ${fila.confianza === 'alta' ? 'font-semibold text-gray-900' : fila.confianza === 'media' ? 'text-gray-700' : 'text-gray-400'}`} title={detalleConfianza(fila)}>
                        Confianza {CONFIANZA_TEXTO[fila.confianza].toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-600">
                      <Entidades fila={fila} />
                    </td>
                    <td className="py-2.5">
                      <MiniSerie fila={fila} meses={data.ventanas.meses} base={mesesBase} reciente={mesesRecientes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <p className="text-xs text-gray-500">
              Minigráfica: una barra por mes;{' '}
              <span style={{ color: COLOR_BASE }}>■</span> meses de comparación, <span style={{ color: GIROS_COLORS.total }}>■</span> meses recientes (
              <span style={{ color: COLOR_RECIENTE_BAJA }}>■</span> si baja).
            </p>
            {filas.length > visible && (
              <button type="button" onClick={() => setVisible(value => value + PAGINA)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Ver {Math.min(PAGINA, filas.length - visible)} más de {filas.length - visible}
              </button>
            )}
          </div>
        </div>
      )}

      {data && (
        <details className="mt-4 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-700">Cómo se calcula</summary>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            {data.notes.map(nota => (
              <li key={nota}>{nota}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
