'use client'

// PR 7 · Panel "Fuentes de datos" (solo admin, permiso fuentes:manage): de dónde salen los datos de
// inteligencia, cuándo se cargaron por última vez y cuándo toca la próxima. Las cargas ligeras se
// actualizan solas (Vercel Cron) y aquí se pueden correr a mano con el mismo código ("Actualizar ahora",
// 50 s por ronda; si no termina, sigue sola hasta 10 rondas). La ADRES (pesada) va por GitHub Actions.
// Datos: GET /api/fuentes y POST /api/fuentes/[fuente]/actualizar.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FuenteActualizarResponse, FuenteEstadoFila, FuenteSemaforo, FuentesResponse } from '@/lib/compras-publicas'

const MAX_RONDAS = 10

const SEMAFORO: Record<FuenteSemaforo, { label: string; cls: string }> = {
  ok: { label: 'Al día', cls: 'bg-green-50 text-green-800 border-green-200' },
  atrasada: { label: 'Atrasada', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  error: { label: 'Error', cls: 'bg-red-50 text-red-700 border-red-200' },
  en_curso: { label: 'En curso', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  nunca: { label: 'Sin cargar', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const fecha = (value: string | null) => (value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

interface Progreso {
  ronda: number
  filas: number
  mensaje: string | null
  terminado: boolean
  error: string | null
  /** Otra invocación (el cron u otro clic) tiene la fuente tomada. */
  ocupada?: boolean
}

export default function FuentesDatosPanel() {
  const [data, setData] = useState<FuentesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<Record<string, Progreso>>({})
  const stopRef = useRef(false)

  const load = useCallback(() => {
    fetch('/api/fuentes', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        setData(body as FuentesResponse)
        setError(null)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar el estado de las fuentes'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const actualizar = async (fuente: string) => {
    setRunning(fuente)
    stopRef.current = false
    let filas = 0
    for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
      setProgreso(prev => ({ ...prev, [fuente]: { ronda, filas, mensaje: 'Cargando…', terminado: false, error: null } }))
      try {
        const response = await fetch(`/api/fuentes/${encodeURIComponent(fuente)}/actualizar`, { method: 'POST' })
        const body = (await response.json().catch(() => null)) as (FuenteActualizarResponse & { error?: string }) | null
        if (!response.ok || !body) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        if (body.estado === 'ocupada') {
          setProgreso(prev => ({ ...prev, [fuente]: { ronda, filas, mensaje: body.mensaje, terminado: true, error: null, ocupada: true } }))
          break
        }
        // filas = guardadas en la pasada hasta ahora (el ejecutor las acumula en el cursor)
        filas = body.filas ?? filas
        const terminado = body.terminado || !body.ok
        setProgreso(prev => ({
          ...prev,
          [fuente]: { ronda, filas, mensaje: body.mensaje, terminado, error: body.ok ? null : body.mensaje || 'La carga terminó con error' },
        }))
        if (terminado || stopRef.current) break
      } catch (err) {
        setProgreso(prev => ({ ...prev, [fuente]: { ronda, filas, mensaje: null, terminado: true, error: err instanceof Error ? err.message : 'Error' } }))
        break
      }
    }
    setRunning(null)
    load()
  }

  const fuentes = data?.fuentes || []

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Fuentes de datos</h1>
        <p className="text-gray-600 mt-2">
          De dónde salen las cifras de inteligencia y cuándo se cargaron. Las cargas ligeras se actualizan solas cada día, semana o mes; la de la
          ADRES corre una vez al mes en GitHub Actions.
        </p>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {data && !data.cronConfigurado && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Falta la variable <code className="px-1 bg-white/60 rounded">CRON_SECRET</code> en Vercel: sin ella las cargas automáticas no se
          ejecutan (/api/cron/* responde 503). Crearla en Vercel → Settings → Environment Variables y volver a desplegar. &quot;Actualizar ahora&quot; sí
          funciona sin ella.
        </div>
      )}

      {!data && !error ? (
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {fuentes.map(fuente => (
            <FuenteCard key={fuente.fuente} fuente={fuente} running={running} progreso={progreso[fuente.fuente]} onRun={actualizar} onStop={() => (stopRef.current = true)} />
          ))}
        </ul>
      )}

      <div className="text-xs text-gray-500 space-y-1 mt-6">
        <p>&quot;Al día&quot;: la última carga correcta tiene menos de dos periodos de antigüedad. &quot;Atrasada&quot;: más vieja que eso.</p>
        <p>Cada ronda de &quot;Actualizar ahora&quot; dura como máximo 50 s y retoma donde quedó la anterior (cursor incremental).</p>
        {data && <p>Consultado: {fecha(data.ahora)}.</p>}
      </div>
    </div>
  )
}

function FuenteCard({
  fuente,
  running,
  progreso,
  onRun,
  onStop,
}: {
  fuente: FuenteEstadoFila
  running: string | null
  progreso: Progreso | undefined
  onRun: (fuente: string) => void
  onStop: () => void
}) {
  const sem = SEMAFORO[fuente.semaforo]
  const isRunning = running === fuente.fuente
  return (
    <li className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900 break-words">{fuente.nombre}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {fuente.horario || fuente.frecuencia} · carga {fuente.tipo}
            {fuente.ejecutor ? ` · ${fuente.ejecutor === 'vercel_cron' ? 'Vercel Cron' : fuente.ejecutor === 'github_actions' ? 'GitHub Actions' : 'manual'}` : ''}
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${sem.cls}`}>{sem.label}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500">Último OK</dt>
          <dd className="text-gray-900 tabular-nums">{fecha(fuente.ultimo_ok)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Último intento</dt>
          <dd className="text-gray-900 tabular-nums">{fecha(fuente.ultimo_intento)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Filas</dt>
          <dd className="text-gray-900 tabular-nums">{fuente.filas !== null ? fuente.filas.toLocaleString('es-CO') : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Siguiente programado</dt>
          <dd className="text-gray-900 tabular-nums">{fecha(fuente.siguiente_programado)}</dd>
        </div>
      </dl>
      {fuente.mensaje && <p className={`text-xs mt-3 break-words ${fuente.semaforo === 'error' ? 'text-red-700' : 'text-gray-600'}`}>{fuente.mensaje}</p>}
      <p className="text-xs text-gray-500 mt-2 break-words">{fuente.como}</p>

      {progreso && (
        <p
          className={`text-xs mt-3 rounded-lg px-3 py-2 break-words ${
            progreso.error ? 'bg-red-50 text-red-700' : progreso.ocupada ? 'bg-amber-50 text-amber-900' : progreso.terminado ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'
          }`}
        >
          {progreso.error
            ? `Error en la ronda ${progreso.ronda}: ${progreso.error}`
            : progreso.ocupada
              ? progreso.mensaje
              : progreso.terminado
              ? `Terminado en ${progreso.ronda} ${progreso.ronda === 1 ? 'ronda' : 'rondas'}: ${progreso.filas.toLocaleString('es-CO')} filas.${progreso.mensaje ? ` ${progreso.mensaje}` : ''}`
              : `Ronda ${progreso.ronda} de hasta ${MAX_RONDAS}… ${progreso.filas.toLocaleString('es-CO')} filas hasta ahora.${progreso.mensaje && progreso.mensaje !== 'Cargando…' ? ` ${progreso.mensaje}` : ''}`}
          {!progreso.terminado && !progreso.error && progreso.ronda >= MAX_RONDAS && ' Quedó a medias: vuelve a pulsar para seguir.'}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {fuente.manual ? (
          <>
            <button
              type="button"
              disabled={running !== null}
              onClick={() => onRun(fuente.fuente)}
              className="min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-40"
            >
              {isRunning ? 'Actualizando…' : 'Actualizar ahora'}
            </button>
            {isRunning && (
              <button type="button" onClick={onStop} className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Detener tras esta ronda
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">Carga pesada: se corre en GitHub Actions (o a mano con el script), no desde aquí.</p>
        )}
      </div>
    </li>
  )
}
