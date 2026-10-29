'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { claveComercial, columnasFaltantes, comercialesDe, leerVisitasVmo, lotesVmo, type LecturaVmo } from '@/lib/vmo-visitas'

// Visitas: puente temporal para el mapa de calor (dueño, 2026-10-29, docs/decisiones/2026-10-29-visitas-vmo-mapa-de-calor.md).
// Se sube el Excel de VMO › Visitas; el navegador se queda solo con las visitas hechas con coordenadas, por Ejecutivo
// Comercial (lib/vmo-visitas.ts). Antes de importar pide al servidor a quién reconoce y a quién crea ({ simular: true }) y
// luego manda las visitas por lotes a POST /api/visits/import. Nada más del archivo sale del navegador.

interface ResultadoImportacion {
  visitas: number
  enlazados: { vmo: string; opmap: string }[]
  creados: { nombre: string; estado: 'active' | 'inactive' }[]
}

/** Plan de POST /api/visits/import con { simular: true }: opmap null = se crea con ese estado. */
interface PlanComercial {
  vmo: string
  opmap: string | null
  estado: 'active' | 'inactive' | null
}

const DESCARTES: { clave: keyof LecturaVmo['descartadas']; texto: string }[] = [
  { clave: 'noRealizadas', texto: 'no realizadas' },
  { clave: 'sinCoordenadas', texto: 'sin coordenadas en Colombia' },
  { clave: 'sinFecha', texto: 'sin fecha' },
  { clave: 'sinComercial', texto: 'sin Ejecutivo Comercial' },
  { clave: 'sinId', texto: 'sin ID de VMO' },
  { clave: 'repetidas', texto: 'repetidas' },
]

const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
/** "2026-10" → "Oct 2026" */
const mesCorto = (mes: string) => `${MESES_CORTOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`

export default function VisitsPage() {
  const [stats, setStats] = useState({
    totalVisits: 0,
    effectiveVisits: 0,
    inPersonVisits: 0,
    virtualVisits: 0,
    loadingStats: true
  })
  const [archivo, setArchivo] = useState<string | null>(null)
  const [lectura, setLectura] = useState<LecturaVmo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [plan, setPlan] = useState<PlanComercial[] | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/visits/stats')
      if (response.ok) {
        const data = await response.json()
        setStats({ ...data, loadingStats: false })
      } else {
        setStats(prev => ({ ...prev, loadingStats: false }))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats(prev => ({ ...prev, loadingStats: false }))
    }
  }

  const leerArchivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setArchivo(null)
    setLectura(null)
    setPlan(null)
    setError(null)
    setResultado(null)
    try {
      const libro = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[libro.SheetNames[0]], { raw: true, defval: null })
      const faltan = columnasFaltantes(filas.length > 0 ? Object.keys(filas[0]) : [])
      if (filas.length === 0 || faltan.length > 0) {
        setError(`Este archivo no es la exportación de VMO › Visitas${faltan.length > 0 ? ` (faltan las columnas ${faltan.join(', ')})` : ' (no tiene filas)'}.`)
        return
      }
      const nueva = leerVisitasVmo(filas)
      setArchivo(file.name)
      setLectura(nueva)
      if (nueva.visitas.length > 0) {
        // A quién reconoce y a quién crea, antes de importar (no escribe nada)
        const response = await fetch('/api/visits/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ simular: true, comerciales: comercialesDe(nueva.visitas) }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || `Error ${response.status} al revisar los Ejecutivos Comerciales`)
        setPlan(body.comerciales as PlanComercial[])
      }
    } catch (err) {
      console.error('visits: error leyendo el Excel de VMO', err)
      setError(err instanceof Error && err.message.includes('Ejecutivos Comerciales') ? err.message : 'No se pudo leer el archivo. Expórtalo otra vez desde VMO › Visitas a Excel.')
    }
  }

  const resumen = useMemo(() => {
    if (!lectura || lectura.visitas.length === 0) return null
    const fechas = lectura.visitas.map(v => v.fecha).sort()
    const porComercial = new Map<string, number>()
    for (const visita of lectura.visitas) {
      const clave = claveComercial(visita.comercial)
      porComercial.set(clave, (porComercial.get(clave) ?? 0) + 1)
    }
    return {
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      meses: Object.entries(lectura.porMes).sort(([a], [b]) => a.localeCompare(b)),
      comerciales: comercialesDe(lectura.visitas).map(c => ({ ...c, visitas: porComercial.get(claveComercial(c.nombre)) ?? 0 })),
    }
  }, [lectura])

  const importar = async () => {
    if (!lectura || lectura.visitas.length === 0) return
    const lotes = lotesVmo(lectura.visitas)
    const total: ResultadoImportacion = { visitas: 0, enlazados: [], creados: [] }
    setError(null)
    setResultado(null)
    setProgreso({ hechos: 0, total: lotes.length })
    try {
      for (let i = 0; i < lotes.length; i++) {
        const response = await fetch('/api/visits/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lotes[i]),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error || `Error ${response.status} al importar`)
        total.visitas += body.visitas
        total.enlazados.push(...body.enlazados)
        total.creados.push(...body.creados)
        setProgreso({ hechos: i + 1, total: lotes.length })
      }
      setResultado(total)
      setLectura(null)
      setPlan(null)
      setArchivo(null)
    } catch (err) {
      setError(`${err instanceof Error ? err.message : 'Error al importar'}. Lo importado antes del error quedó guardado: puedes subir el mismo archivo otra vez sin duplicar.`)
      if (total.visitas > 0) setResultado(total)
    } finally {
      setProgreso(null)
      loadStats()
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num)
  }

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="visits:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <strong className="font-semibold">Acceso denegado</strong>
              <p className="text-sm mt-1">No tienes permisos para gestionar visitas.</p>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Gestión de Visitas</h1>
            <p className="text-gray-300 mt-2">
              Visitas de VMO para el mapa de calor, mientras la app de visita reemplaza a VMO
            </p>
          </div>

          {/* Estadísticas Mejoradas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Visitas</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.totalVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.effectiveVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Efectivas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.effectiveVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.inPersonVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Presenciales</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.inPersonVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.virtualVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Virtuales</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.virtualVisits)
                )}
              </p>
            </div>
          </div>

          {/* Importar el Excel de VMO */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Importar visitas de VMO</h2>
            <ol className="mt-3 list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>En VMO entra a <strong>Visitas</strong>, elige el rango de fechas y exporta a <strong>Excel → Todo</strong>.</li>
              <li>Sube aquí ese archivo, revisa el resumen y pulsa <strong>Importar</strong>.</li>
            </ol>
            <p className="mt-3 text-sm text-gray-500">
              Solo se guardan las visitas hechas (realizadas y extra) con coordenadas: la fecha, el punto y el Ejecutivo
              Comercial. Lo demás del archivo (médicos, teléfonos, comentarios) no sale de tu computador. Subir otra vez el
              mismo período no duplica: cada visita tiene su ID de VMO. Si un Ejecutivo Comercial de VMO no existe en OpMap,
              se crea; el resumen dice antes a quién reconoce y a quién crea.
            </p>

            <label
              htmlFor="archivo-vmo"
              className="mt-5 flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100 text-center"
            >
              <span className="text-sm font-medium text-gray-900">{archivo ?? 'Haz clic para elegir el Excel de VMO'}</span>
              <span className="text-xs text-gray-500 mt-1">{archivo ? 'Haz clic para cambiar el archivo' : 'XLSX, XLS o CSV'}</span>
            </label>
            <input id="archivo-vmo" type="file" accept=".xlsx,.xls,.csv" onChange={leerArchivo} className="hidden" disabled={progreso !== null} />

            {lectura && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <p>
                  <strong>{formatNumber(lectura.visitas.length)}</strong> visitas para importar de {formatNumber(lectura.filas)} filas del archivo
                  {resumen && <> · del {fechaCorta(resumen.desde)} al {fechaCorta(resumen.hasta)}</>}
                </p>
                {DESCARTES.some(d => lectura.descartadas[d.clave] > 0) && (
                  <p className="mt-1 text-gray-500">
                    No se importan: {DESCARTES.filter(d => lectura.descartadas[d.clave] > 0).map(d => `${formatNumber(lectura.descartadas[d.clave])} ${d.texto}`).join(', ')}.
                  </p>
                )}
                {resumen && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Por mes</p>
                      <ul className="mt-1 space-y-0.5">
                        {resumen.meses.map(([mes, cantidad]) => (
                          <li key={mes} className="flex justify-between gap-4"><span>{mesCorto(mes)}</span><span className="tabular-nums">{formatNumber(cantidad)}</span></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ejecutivos Comerciales ({resumen.comerciales.length})</p>
                      <ul className="mt-1 space-y-1">
                        {resumen.comerciales.map(c => {
                          const destino = plan?.find(p => claveComercial(p.vmo) === claveComercial(c.nombre))
                          return (
                            <li key={c.nombre} className="flex justify-between gap-4">
                              <span>
                                {c.nombre}
                                {destino && (
                                  <span className="block text-xs text-gray-500">
                                    {destino.opmap
                                      ? destino.opmap === c.nombre ? 'Ya está en OpMap' : `Es ${destino.opmap} en OpMap`
                                      : `Se crea en OpMap${destino.estado === 'inactive' ? ' (inactivo: sin visitas en los últimos 60 días)' : ''}`}
                                  </span>
                                )}
                              </span>
                              <span className="tabular-nums">{formatNumber(c.visitas)}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={importar}
                    disabled={lectura.visitas.length === 0 || plan === null || progreso !== null}
                    className="min-h-[44px] px-6 py-2.5 rounded-lg font-medium bg-gray-900 text-white hover:bg-black disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    {progreso ? `Importando… (${progreso.hechos} de ${progreso.total})` : `Importar ${formatNumber(lectura.visitas.length)} visitas`}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            {resultado && (
              <div className="mt-5 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm space-y-1">
                <p className="font-medium">Listo: {formatNumber(resultado.visitas)} visitas guardadas.</p>
                {resultado.enlazados.length > 0 && (
                  <p>Reconocidos en OpMap: {resultado.enlazados.map(e => (e.vmo === e.opmap ? e.opmap : `${e.vmo} → ${e.opmap}`)).join(', ')}.</p>
                )}
                {resultado.creados.length > 0 && (
                  <p>
                    Creados en OpMap: {resultado.creados.map(c => `${c.nombre}${c.estado === 'inactive' ? ' (inactivo: sin visitas en los últimos 60 días)' : ''}`).join(', ')}.
                    Asígnales su Zona en Ejecutivos Comerciales y vuelve a subir el archivo: sus visitas toman la Zona de la persona.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}
