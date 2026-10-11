'use client'

// Fase 5 · Tarjeta "Contratación pública (SECOP)" de la ficha de IPS.
// Datos: GET /api/secop/hospital/[id] (permiso intelligence:view). Solo aparece si la IPS es pública o
// mixta (REPS) o si su NIT figura como entidad contratante en SECOP; si es privada, una línea.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import SecopAnnualChart from '@/components/SecopAnnualChart'
import { formatCop, formatCopCompact, formatFechaGiro, monthLabel } from '@/lib/giros-format'
import { FILTRO_ATIPICOS, FILTRO_MEDICOS, especialidadLabel, lineaColor, lineaLabel, type HospitalSecopResponse } from '@/lib/compras-publicas'

const LISTA_INICIAL = 8

function Chip({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'amber' | 'blue' | 'red' }) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-800 border-blue-200'
        : tone === 'red'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-gray-50 text-gray-700 border-gray-200'
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${cls}`}>{children}</span>
}

function LineaChip({ linea }: { linea: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: lineaColor(linea) }} />
      {lineaLabel(linea)}
    </span>
  )
}

export default function HospitalSecopCard({ hospitalId }: { hospitalId: string }) {
  const { can, loading: permsLoading } = usePermissions()
  const allowed = can('intelligence:view')
  const [data, setData] = useState<HospitalSecopResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(false)
  const [verProveedores, setVerProveedores] = useState(false)
  const [verMedicos, setVerMedicos] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page) })
    if (filtro) params.set('linea', filtro)
    fetch(`/api/secop/hospital/${encodeURIComponent(hospitalId)}?${params.toString()}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        if (!cancelled) setData(body as HospitalSecopResponse)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la contratación pública')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hospitalId, page, filtro, allowed])

  if (permsLoading || !allowed) return null

  if (data && !data.publica) {
    return (
      <p className="text-sm text-gray-500 mb-8 px-1">
        {data.naturaleza === 'Privada' ? 'IPS privada: sin contratación pública (SECOP).' : 'Sin contratación pública registrada en SECOP para este NIT.'}
      </p>
    )
  }

  const summary = data?.summary ?? null
  const ventanaLabel = summary ? `${monthLabel(summary.ventana.desde.slice(0, 7))} a ${monthLabel(summary.ventana.hasta.slice(0, 7))}` : null
  const proveedores = summary ? (verProveedores ? summary.proveedores : summary.proveedores.slice(0, LISTA_INICIAL)) : []
  const medicos = summary ? (verMedicos ? summary.medicos : summary.medicos.slice(0, LISTA_INICIAL)) : []
  const actualizado = data ? Object.values(data.actualizado).filter(Boolean).sort().pop() ?? null : null

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Contratación pública (SECOP)</h2>
          <p className="text-sm text-gray-500 mt-1 break-words">
            {data?.naturaleza ? `Entidad ${data.naturaleza.toLowerCase()}` : 'Entidad pública'}
            {data?.entidad?.nit ? ` · NIT ${data.entidad.nit}` : ''}
            {data?.entidad?.nombre ? ` · en SECOP: ${data.entidad.nombre}` : ''}
          </p>
        </div>
        <Link
          href="/inteligencia?tab=secop"
          className="inline-flex items-center min-h-[44px] text-sm font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
        >
          Ver compras públicas
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">No se pudo cargar la contratación pública: {error}</p>
      ) : !data ? (
        <div className="animate-pulse space-y-3" aria-label="Cargando contratación pública">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      ) : !summary || summary.contratos.total + summary.totales.contratosTotal + summary.totales.contratosMedicos + summary.totales.contratosSinClasificar === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-700 font-medium">Sin contratos ortopédicos registrados en SECOP</p>
          <p className="text-gray-500 text-sm mt-1">
            {actualizado ? `Última carga de SECOP: ${new Date(actualizado).toLocaleDateString('es-CO')}.` : 'SECOP aún no se ha cargado.'}
          </p>
        </div>
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-70' : ''}`}>
          {/* KPIs por línea, últimos 24 meses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Compras de material ortopédico por línea · últimos {summary.ventana.meses} meses</h3>
            <p className="text-xs text-gray-500 mb-3">{ventanaLabel} · histórico desde {formatFechaGiro(summary.totales.primeraFecha)}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <div className="col-span-2 lg:col-span-1 p-3 sm:p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500">Total {summary.ventana.meses} meses</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatCopCompact(summary.totales.valorVentana)}</p>
                <p className="text-xs text-gray-500 mt-1 tabular-nums">
                  {summary.totales.contratosVentana.toLocaleString('es-CO')} contratos · histórico {formatCopCompact(summary.totales.valorTotal)}
                </p>
                {summary.totales.fueraEscala > 0 && (
                  <p className="text-xs text-red-700 mt-1">
                    {summary.totales.fueraEscala} con valor fuera de escala (más de 50.000 M) no suman ({formatCopCompact(summary.totales.valorFueraEscala)})
                  </p>
                )}
              </div>
              {summary.porLinea.map(item => (
                <div key={item.linea} className={`p-3 sm:p-4 rounded-xl min-w-0 ${item.orto ? 'bg-gray-50' : 'border border-dashed border-gray-300'}`}>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    {item.label}
                    {!item.orto && <span className="text-gray-400">(no suma)</span>}
                  </p>
                  <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">{formatCopCompact(item.valorVentana)}</p>
                  <p className="text-xs text-gray-500 mt-1 tabular-nums">
                    {item.contratosVentana.toLocaleString('es-CO')} contratos · histórico {formatCopCompact(item.valorTotal)} ({item.contratosTotal.toLocaleString('es-CO')})
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Compras de material por año</h3>
              <SecopAnnualChart points={summary.anual} height={190} ariaLabel={`Compras públicas de material por año, NIT ${data.entidad?.nit ?? ''}`} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Proveedores ({summary.proveedores.length})</h3>
              {summary.proveedores.length === 0 ? (
                <p className="text-sm text-gray-500">Sin compras de material registradas.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {proveedores.map(prov => (
                    <li key={prov.key} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 break-words">
                            {prov.nit ? (
                              <Link href={`/inteligencia?tab=secop&proveedor=${prov.nit}`} className="hover:underline">
                                {prov.nombre}
                              </Link>
                            ) : (
                              prov.nombre
                            )}{' '}
                            {prov.vigilado && <Chip tone="amber">Vigilado</Chip>}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {prov.nit ? `NIT ${prov.nit} · ` : ''}
                            {prov.contratos.toLocaleString('es-CO')} contratos · último {formatFechaGiro(prov.ultimaFecha)}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {prov.lineas.map(linea => (
                              <LineaChip key={linea} linea={linea} />
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatCopCompact(prov.valor)}</p>
                          {prov.valorVentana > 0 && <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{formatCopCompact(prov.valorVentana)} en 24 m</p>}
                          {prov.valorSinClasificar > 0 && (
                            <p className="text-xs text-gray-400 tabular-nums whitespace-nowrap">+ {formatCopCompact(prov.valorSinClasificar)} sin clasificar</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {summary.proveedores.length > LISTA_INICIAL && (
                <button
                  type="button"
                  onClick={() => setVerProveedores(v => !v)}
                  className="mt-2 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {verProveedores ? 'Ver menos' : `Ver los ${summary.proveedores.length}`}
                </button>
              )}
            </div>
          </div>

          {/* Médicos contratados (personas naturales; sin documento) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Médicos contratados ({summary.medicos.length})</h3>
            <p className="text-xs text-gray-500 mb-2">
              Servicios profesionales de especialistas (ortopedia, traumatología, columna, medicina deportiva o neurocirugía): personas naturales
              y empresas de especialistas.
            </p>
            {summary.medicos.length === 0 ? (
              <p className="text-sm text-gray-500">Ninguno registrado.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-gray-100">
                {medicos.map(medico => (
                  <li key={medico.key} className="py-2 sm:border-b sm:border-gray-100">
                    <p className="text-sm font-medium text-gray-900 break-words">
                      {medico.nombre} {medico.empresa && <Chip>Empresa</Chip>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {medico.especialidad ? `${especialidadLabel(medico.especialidad)} · ` : ''}
                      {medico.contratos.toLocaleString('es-CO')} {medico.contratos === 1 ? 'contrato' : 'contratos'} · último {formatFechaGiro(medico.ultimaFecha)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {summary.medicos.length > LISTA_INICIAL && (
              <button
                type="button"
                onClick={() => setVerMedicos(v => !v)}
                className="mt-2 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {verMedicos ? 'Ver menos' : `Ver los ${summary.medicos.length}`}
              </button>
            )}
          </div>

          {/* Contratos con enlace al expediente */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Contratos ({summary.contratos.total.toLocaleString('es-CO')})</h3>
              <label className="text-sm">
                <span className="sr-only">Filtrar contratos</span>
                <select
                  value={filtro}
                  onChange={event => {
                    setFiltro(event.target.value)
                    setPage(1)
                  }}
                  className="min-h-[44px] rounded-lg border border-gray-300 px-3 bg-white text-sm"
                >
                  <option value="">Todos</option>
                  {summary.porLinea.map(item => (
                    <option key={item.linea} value={item.linea}>
                      {item.label}
                    </option>
                  ))}
                  {summary.medicos.length > 0 && <option value={FILTRO_MEDICOS}>Médicos y especialistas</option>}
                  {summary.totales.atipicos + summary.totales.fueraEscala > 0 && <option value={FILTRO_ATIPICOS}>Valores atípicos</option>}
                </select>
              </label>
            </div>
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {summary.contratos.rows.map(row => (
                <li key={row.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 break-words">
                        {row.proveedor} {row.vigilado && <Chip tone="amber">Vigilado</Chip>}{' '}
                        {row.esServicio && <Chip tone="blue">{row.esPersona ? 'Médico' : 'Especialistas'}</Chip>}
                        {!row.esServicio && row.esPersona && <Chip>Persona natural</Chip>} {row.fueraEscala ? (
                          <Chip tone="red">Fuera de escala, no suma</Chip>
                        ) : (
                          row.atipico && <Chip tone="amber">Valor alto para la entidad</Chip>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatFechaGiro(row.fecha)}
                        {row.esServicio ? (row.especialidad ? ` · ${especialidadLabel(row.especialidad)}` : '') : ` · ${lineaLabel(row.linea)}`}
                        {row.estado ? ` · ${row.estado}` : ''}
                        {row.fuente ? ` · ${row.fuente}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap shrink-0">{formatCopCompact(row.valor)}</p>
                  </div>
                  {row.valorProceso !== null && row.contratistasProceso > 1 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      SECOP I publica el valor del proceso ({formatCopCompact(row.valorProceso)}) en cada uno de sus {row.contratistasProceso}{' '}
                      contratistas: aquí cuenta su parte.
                    </p>
                  )}
                  {row.objeto && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={row.objeto}>
                      {row.objeto}
                    </p>
                  )}
                  {row.url && (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[44px] text-xs font-medium text-blue-700 hover:underline"
                    >
                      Ver expediente en SECOP
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {summary.contratos.pages > 1 && (
              <div className="flex items-center justify-between gap-2 mt-3">
                <button
                  type="button"
                  disabled={summary.contratos.page <= 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-500 tabular-nums">
                  Página {summary.contratos.page} de {summary.contratos.pages}
                </span>
                <button
                  type="button"
                  disabled={summary.contratos.page >= summary.contratos.pages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            {data.notes.map(note => (
              <p key={note}>{note}</p>
            ))}
            <p>
              Total histórico ortopédico {formatCop(summary.totales.valorTotal)} en {summary.totales.contratosTotal.toLocaleString('es-CO')} contratos de material
              {actualizado ? ` · última carga de SECOP: ${new Date(actualizado).toLocaleString('es-CO')}` : ''}.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
