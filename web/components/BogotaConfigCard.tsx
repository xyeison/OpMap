'use client'

// Tarjeta de /kams (solo admin): "Bogotá: sectores y corredores" (PR 3, 2026-10-11; sectores desde el 2026-10-28).
// k = en cuántas zonas de Bogotá se reparte el cupo de Bogotá; celda que recibe cada grupo de
// corredores; tope único. "Simular" ejecuta el motor en memoria (GET /api/kams/bogota-config/simulate,
// solo lectura) y "Guardar" guarda la configuración (PUT /api/kams/bogota-config) SIN recalcular.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { zoneDisplayName } from '@/lib/zone-names'
import {
  AGRUPACIONES_POR_K,
  CORREDOR_LABEL,
  gruposPorDefecto,
  type BogotaK,
  type Corredor,
} from '@/lib/bogota-corredores'
import {
  BOGOTA_MAX_MINUTES_MAX,
  BOGOTA_MAX_MINUTES_MIN,
  gruposDesdeReceptoras,
  nombreGrupo,
  receptorasDesdeGrupos,
  simulationQueryString,
  validateBogotaConfigInput,
  type BogotaSimulationSummary,
  type SimChange,
} from '@/lib/bogota-admin'
import { usePermissions } from '@/hooks/usePermissions'

interface Cell {
  id: string
  name: string
  base_city: string | null
  area_id: string
  max_travel_time: number
  color: string | null
}

interface ConfigResponse {
  config: { k: BogotaK; max_travel_minutes: number; grupos: Partial<Record<Corredor, string>> } | null
  updated_at: string | null
  updated_by_name: string | null
  por_defecto: { k: BogotaK; max_travel_minutes: number; grupos: Partial<Record<Corredor, string>> | null }
  celdas: Cell[]
  corredores: Record<Corredor, { departamentos: number; municipios: number }>
}

type SimulationResponse = BogotaSimulationSummary & { fuente_corredores: 'tabla' | 'semilla'; segundos: number }

const K_OPTIONS: BogotaK[] = [1, 2, 3, 4]

// Nombre de la zona ("Bogotá Norte"); la localidad del punto base solo si no hay nombre
const cellLabel = (cell: Pick<Cell, 'name' | 'base_city'>) => zoneDisplayName(cell.name) || cell.base_city || ''

const minutesText = (minutes: number | null | undefined) => {
  if (minutes === null || minutes === undefined) return 'sin tiempo'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

function ChangeList({ items, empty }: { items: SimChange[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">{empty}</p>
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(item => (
        <li key={item.hospital_id} className="py-2 text-sm">
          <Link href={`/hospitals/${item.hospital_id}`} className="font-medium text-gray-900 hover:underline">
            {item.name}
          </Link>
          <span className="block text-xs text-gray-500">
            {item.municipio}
            {item.departamento ? ` · ${item.departamento}` : ''}
          </span>
          <span className="block text-gray-700">
            {item.antes ? `${item.antes.zona} (${minutesText(item.antes.minutos)})` : 'Sin zona'}
            {' → '}
            {item.despues
              ? `${item.despues.zona} (${minutesText(item.despues.minutos)})${
                  item.despues.corredor ? ` · corredor ${CORREDOR_LABEL[item.despues.corredor]}` : ''
                }`
              : 'Sin zona (fuera de alcance)'}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function BogotaConfigCard() {
  const { can } = usePermissions()
  const canSimulate = can('recalculate:complete')
  const [data, setData] = useState<ConfigResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [k, setK] = useState<BogotaK>(4)
  const [receptoras, setReceptoras] = useState<string[]>([])
  const [maxMinutes, setMaxMinutes] = useState('240')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [simulating, setSimulating] = useState(false)
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null)

  const load = async () => {
    setLoadError('')
    try {
      const response = await fetch('/api/kams/bogota-config')
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Error al cargar la configuración (${response.status})`)
      const value = body as ConfigResponse
      setData(value)
      const base = value.config ?? { ...value.por_defecto, grupos: value.por_defecto.grupos ?? {} }
      setK(base.k)
      setReceptoras(receptorasDesdeGrupos(base.k, base.grupos))
      setMaxMinutes(String(base.max_travel_minutes))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Error al cargar la configuración de Bogotá')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cells = useMemo(() => data?.celdas ?? [], [data])
  const cellIds = useMemo(() => new Set(cells.map(c => c.id)), [cells])
  const cellById = useMemo(() => new Map(cells.map(c => [c.id, c])), [cells])

  const proposal = useMemo(
    () => ({ k, max_travel_minutes: maxMinutes, grupos: gruposDesdeReceptoras(k, receptoras) }),
    [k, maxMinutes, receptoras]
  )

  const isDirty = useMemo(() => {
    if (!data?.config) return true
    const saved = data.config
    const grupos = proposal.grupos
    return (
      saved.k !== k ||
      String(saved.max_travel_minutes) !== maxMinutes ||
      (Object.keys(CORREDOR_LABEL) as Corredor[]).some(c => saved.grupos[c] !== grupos[c])
    )
  }, [data, k, maxMinutes, proposal])

  const resetFeedback = () => {
    setErrors([])
    setSavedMessage('')
    setSimulation(null)
  }

  const changeK = (next: BogotaK) => {
    if (next === k) return
    // Celda por defecto de cada grupo: la del primer corredor del grupo con k = 4 (o la que ya tenía)
    const current = gruposDesdeReceptoras(k, receptoras)
    const defaults: Partial<Record<Corredor, string>> = gruposPorDefecto(4, cells) ?? {}
    const used = new Set<string>()
    const nextReceptoras = AGRUPACIONES_POR_K[next].map(grupo => {
      const first = grupo[0]
      const options = [next === 4 ? undefined : current[first], defaults[first], ...cells.map(cell => cell.id)]
      const chosen = options.find((id): id is string => Boolean(id) && !used.has(id as string)) ?? ''
      if (chosen) used.add(chosen)
      return chosen
    })
    setK(next)
    setReceptoras(nextReceptoras)
    resetFeedback()
  }

  const validate = () => {
    const validation = validateBogotaConfigInput(proposal, cellIds)
    if (!validation.ok) {
      setErrors(validation.errors)
      return null
    }
    setErrors([])
    return validation.value
  }

  const simulate = async () => {
    const value = validate()
    if (!value) return
    setSimulating(true)
    setSimulation(null)
    setSavedMessage('')
    try {
      const response = await fetch(`/api/kams/bogota-config/simulate?${simulationQueryString(value)}`)
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Error al simular (${response.status})`)
      setSimulation(body as SimulationResponse)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error al simular la configuración'])
    } finally {
      setSimulating(false)
    }
  }

  const save = async () => {
    const value = validate()
    if (!value) return
    setSaving(true)
    setSavedMessage('')
    try {
      const response = await fetch('/api/kams/bogota-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error || `Error al guardar (${response.status})`)
      setSavedMessage(body?.message || 'Configuración guardada. Los cambios aplican al próximo recálculo.')
      await load()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Error al guardar la configuración'])
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        {loadError}
      </div>
    )
  }
  if (!data) {
    return <div className="mb-8 p-6 bg-white rounded-2xl border border-gray-100 shadow-md animate-pulse">Cargando configuración de Bogotá...</div>
  }

  return (
    <section className="mb-8 bg-white rounded-2xl shadow-md border border-gray-100 p-4 sm:p-6" aria-labelledby="bogota-config-title">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
        <div>
          <h2 id="bogota-config-title" className="text-xl font-bold text-gray-900">
            Bogotá: sectores y corredores
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-3xl">
            Dentro de Bogotá cada localidad es de un sector (Norte, Occidente, Sur u Oriente) y sus IPS van a la zona
            de ese sector, sin contar minutos. Hacia afuera, Bogotá compite como una sola ciudad: su tiempo es el mejor
            entre sus zonas y su tope es uno solo. Si Bogotá gana una IPS, la recibe la zona del corredor de salida del
            municipio. Cada zona recibe su sector y su corredor.
          </p>
        </div>
        {data.updated_at && (
          <p className="text-xs text-gray-500 sm:text-right shrink-0">
            Guardada {new Date(data.updated_at).toLocaleString('es-CO')}
            {data.updated_by_name ? ` por ${data.updated_by_name}` : ''}
          </p>
        )}
      </div>

      {cells.length === 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          No hay zonas activas de Bogotá (localidades 11001xx). Activa al menos una para configurar el reparto.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">¿En cuántas zonas se reparte Bogotá hacia afuera?</p>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Número de zonas">
              {K_OPTIONS.map(option => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={k === option}
                  disabled={option > cells.length}
                  onClick={() => changeK(option)}
                  className={`min-h-[44px] rounded-lg border text-base font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    k === option ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {k === 4 && 'Cada corredor tiene su zona.'}
              {k === 3 && 'Norte, Occidente y el grupo Sur y Oriente.'}
              {k === 2 && 'Dos grupos: Norte y Oriente; Occidente y Sur.'}
              {k === 1 && 'Una sola zona recibe todo lo que Bogotá gane afuera.'}
            </p>

            <label htmlFor="bogota-max" className="block text-sm font-medium text-gray-700 mt-5 mb-2">
              Tope único de Bogotá hacia afuera
            </label>
            <div className="flex items-center gap-2">
              <input
                id="bogota-max"
                type="number"
                inputMode="numeric"
                min={BOGOTA_MAX_MINUTES_MIN}
                max={BOGOTA_MAX_MINUTES_MAX}
                step={5}
                value={maxMinutes}
                onChange={event => {
                  setMaxMinutes(event.target.value)
                  resetFeedback()
                }}
                className="min-h-[44px] w-28 px-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-gray-700"
              />
              <span className="text-sm text-gray-600">minutos ({minutesText(Number(maxMinutes) || 0)})</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Reemplaza hacia afuera el tiempo máximo de cada zona de Bogotá (hoy:{' '}
              {cells.map(cell => `${cellLabel(cell)} ${cell.max_travel_time}`).join(', ')} min). Ese tiempo
              máximo sigue editándose en cada zona.
            </p>
          </div>

          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-gray-700 mb-2">Zona que recibe cada corredor</p>
            <div className="space-y-3">
              {AGRUPACIONES_POR_K[k].map((grupo, index) => {
                const conteo = grupo.reduce(
                  (acc, c) => ({
                    departamentos: acc.departamentos + (data.corredores[c]?.departamentos ?? 0),
                    municipios: acc.municipios + (data.corredores[c]?.municipios ?? 0),
                  }),
                  { departamentos: 0, municipios: 0 }
                )
                const selectId = `bogota-grupo-${index}`
                return (
                  <div key={grupo.join('-')} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label htmlFor={selectId} className="sm:w-56 shrink-0">
                      <span className="block text-sm font-semibold text-gray-900">{nombreGrupo(grupo)}</span>
                      <span className="block text-xs text-gray-500">
                        {conteo.departamentos} departamentos y, en Cundinamarca, {conteo.municipios} municipios
                      </span>
                    </label>
                    <select
                      id={selectId}
                      value={receptoras[index] ?? ''}
                      onChange={event => {
                        const next = [...receptoras]
                        next[index] = event.target.value
                        setReceptoras(next)
                        resetFeedback()
                      }}
                      className="min-h-[44px] w-full sm:flex-1 px-3 border border-gray-300 rounded-lg text-base bg-white focus:outline-none focus:ring-2 focus:ring-gray-700"
                    >
                      <option value="">Elige una zona de Bogotá</option>
                      {cells.map(cell => (
                        <option key={cell.id} value={cell.id}>
                          {cellLabel(cell)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              El corredor de cada municipio sale de la tabla de corredores (por departamento y, en Cundinamarca, por
              municipio según su provincia). Un municipio sin corredor va a la zona de Bogotá con menor tiempo real.
            </p>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm" role="alert">
          {errors.map(error => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {savedMessage && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm" role="status">
          <p>{savedMessage}</p>
          <p className="mt-1">
            Las asignaciones no se recalculan solas: usa{' '}
            <Link href="/configuracion?seccion=asignacion" className="font-semibold underline">
              Recalcular asignaciones
            </Link>{' '}
            en Configuración → Asignación cuando quieras aplicarla.
          </p>
        </div>
      )}

      {cells.length > 0 && (
        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center">
          {canSimulate && (
            <button
              type="button"
              onClick={simulate}
              disabled={simulating || saving}
              className="min-h-[44px] px-5 rounded-lg border border-gray-900 text-gray-900 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {simulating ? 'Simulando...' : 'Simular'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || simulating || !isDirty}
            className="min-h-[44px] px-5 rounded-lg bg-gray-900 text-white font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <span className="text-xs text-gray-500">
            {isDirty
              ? 'Cambios sin guardar. Guardar no recalcula: los cambios aplican al próximo recálculo.'
              : 'Configuración guardada. Aplica al próximo recálculo de asignaciones.'}
          </span>
        </div>
      )}

      {simulating && (
        <p className="mt-4 text-sm text-gray-600" role="status">
          Calculando en memoria con las distancias guardadas (sin Google, sin guardar nada)...
        </p>
      )}

      {simulation && <SimulationResult simulation={simulation} cellById={cellById} />}
    </section>
  )
}

function SimulationResult({ simulation, cellById }: { simulation: SimulationResponse; cellById: Map<string, Cell> }) {
  const t = simulation.totales
  return (
    <div className="mt-6 border-t border-gray-200 pt-5" aria-live="polite">
      <h3 className="text-lg font-semibold text-gray-900">Simulación (no se guardó nada)</h3>
      <p className="text-xs text-gray-500 mt-1">
        Antes = asignaciones guardadas hoy. Después = el algoritmo con esta configuración, en memoria
        ({simulation.segundos} s{simulation.fuente_corredores === 'semilla' ? ', corredores de la semilla' : ''}).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">IPS que cambian</p>
          <p className="text-xl font-bold text-gray-900">{t.cambios}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Quedan fuera de alcance</p>
          <p className="text-xl font-bold text-gray-900">{t.fuera_de_alcance}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Ganadas por Bogotá afuera</p>
          <p className="text-xl font-bold text-gray-900">
            {Object.values(t.por_corredor).reduce((sum, n) => sum + n, 0) + t.sin_corredor}
          </p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Sin corredor</p>
          <p className="text-xl font-bold text-gray-900">{t.sin_corredor}</p>
        </div>
      </div>
      <p className="text-sm text-gray-700 mt-3">
        Por corredor:{' '}
        {(Object.keys(t.por_corredor) as Corredor[]).map(c => `${CORREDOR_LABEL[c]} ${t.por_corredor[c]}`).join(' · ')}
      </p>
      {t.otros_cambios > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          Además, {t.otros_cambios} IPS cambiarían entre zonas que no son de Bogotá: son datos pendientes de
          recalcular, no efecto de esta configuración.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 pr-3 font-medium">Zona de Bogotá</th>
              <th className="py-2 pr-3 font-medium">Recibe</th>
              <th className="py-2 pr-3 font-medium text-right">Antes</th>
              <th className="py-2 pr-3 font-medium text-right">Después</th>
              <th className="py-2 font-medium text-right">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {simulation.celdas.map(cell => (
              <tr key={cell.kam_id} className="border-b">
                <td className="py-2 pr-3 font-medium text-gray-900">
                  {cellById.get(cell.kam_id) ? cellLabel(cellById.get(cell.kam_id) as Cell) : cell.nombre}
                </td>
                <td className="py-2 pr-3 text-gray-700">
                  {cell.corredores.length > 0 ? cell.corredores.map(c => CORREDOR_LABEL[c]).join(', ') : 'Sin sector ni corredor'}
                </td>
                <td className="py-2 pr-3 text-right">{cell.antes}</td>
                <td className="py-2 pr-3 text-right">{cell.despues}</td>
                <td className={`py-2 text-right font-medium ${cell.diferencia > 0 ? 'text-green-700' : cell.diferencia < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                  {cell.diferencia > 0 ? `+${cell.diferencia}` : cell.diferencia}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-3">
        <details className="rounded-lg border border-gray-200 p-3" open={simulation.cambios.length > 0 && simulation.cambios.length <= 15}>
          <summary className="cursor-pointer min-h-[44px] flex items-center font-medium text-gray-900">
            IPS que cambian ({simulation.cambios.length})
          </summary>
          <ChangeList items={simulation.cambios} empty="Ninguna IPS cambia de zona." />
        </details>
        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="cursor-pointer min-h-[44px] flex items-center font-medium text-gray-900">
            Quedan fuera de alcance ({simulation.fuera_de_alcance.length})
          </summary>
          <p className="text-xs text-gray-500 mb-2">Hoy están en una zona de Bogotá y con esta configuración no las alcanza nadie.</p>
          <ChangeList items={simulation.fuera_de_alcance} empty="Ninguna IPS queda fuera de alcance." />
        </details>
        <details className="rounded-lg border border-gray-200 p-3">
          <summary className="cursor-pointer min-h-[44px] flex items-center font-medium text-gray-900">
            Sin corredor configurado ({simulation.sin_corredor.length})
          </summary>
          <p className="text-xs text-gray-500 mb-2">Bogotá las gana pero su municipio no tiene corredor: van a la zona con menor tiempo.</p>
          <ChangeList items={simulation.sin_corredor} empty="Todas las IPS que gana Bogotá tienen corredor." />
        </details>
        <details className="rounded-lg border border-gray-200 p-3" open={simulation.forzadas.length > 0}>
          <summary className="cursor-pointer min-h-[44px] flex items-center font-medium text-gray-900">
            Asignaciones forzadas a zonas de Bogotá ({simulation.forzadas.length})
          </summary>
          <p className="text-xs text-gray-500 mb-2">Se conservan hasta que se retiren; aquí se comparan con lo que daría el corredor.</p>
          {simulation.forzadas.length === 0 ? (
            <p className="text-sm text-gray-500">No hay asignaciones forzadas a zonas de Bogotá.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {simulation.forzadas.map(f => (
                <li key={f.territory_id} className="py-2 text-sm">
                  <span className="font-medium text-gray-900">{f.territory_name}</span>
                  <span className="text-gray-500"> · {f.ips} IPS</span>
                  <span className="block text-gray-700">
                    Forzada a {f.celda_forzada.nombre}.{' '}
                    {f.corredor
                      ? `Por corredor ${CORREDOR_LABEL[f.corredor]} iría a ${f.celda_por_corredor?.nombre ?? 'sin zona configurada'}`
                      : 'Su municipio no tiene corredor'}
                    {f.corredor && (f.coincide ? ' (coincide).' : ' (no coincide).')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
    </div>
  )
}
