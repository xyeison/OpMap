'use client'

// Fase 4 · Tarjeta "Entorno del municipio" de la ficha de IPS: afiliados por régimen, cobertura y 3 EPS
// dominantes del municipio, y la posición de la IPS en el ranking de giros ADRES de su municipio.
// Datos: GET /api/intelligence/poblacion/hospital/[id] (permiso hospitals:view).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCopCompact, formatPct, monthLabel } from '@/lib/giros-format'
import type { HospitalEntornoResponse } from '@/lib/poblacion-intelligence'

/** Paleta categórica validada (la misma de /inteligencia): contributivo azul, subsidiado naranja, excepción gris. */
const REGIMEN_COLORS = { contributivo: '#2a78d6', subsidiado: '#eb6834', excepcion: '#9ca3af' } as const

const fmtInt = (value: number | null | undefined) => (value === null || value === undefined ? '—' : Math.round(value).toLocaleString('es-CO'))

export default function HospitalEntornoCard({ hospitalId }: { hospitalId: string }) {
  const { can } = usePermissions()
  const [data, setData] = useState<HospitalEntornoResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch(`/api/intelligence/poblacion/hospital/${encodeURIComponent(hospitalId)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        if (!cancelled) setData(body as HospitalEntornoResponse)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el entorno del municipio')
      })
    return () => {
      cancelled = true
    }
  }, [hospitalId])

  const municipio = data?.municipio ?? null
  const ranking = data?.ranking ?? null
  const afiliados = municipio?.afiliados ?? null
  const regimenes = municipio
    ? [
        { key: 'contributivo', label: 'Contributivo', value: municipio.contributivo ?? 0, color: REGIMEN_COLORS.contributivo },
        { key: 'subsidiado', label: 'Subsidiado', value: municipio.subsidiado ?? 0, color: REGIMEN_COLORS.subsidiado },
        { key: 'excepcion', label: 'Excepción y especiales', value: municipio.excepcion ?? 0, color: REGIMEN_COLORS.excepcion },
      ]
    : []
  const visibles = regimenes.filter(item => item.value > 0)
  const fuenteAfiliados =
    municipio?.fuente === 'cifras'
      ? `MinSalud, corte ${data?.corte ? monthLabel(data.corte) : ''}`
      : municipio?.fuente === 'bdua'
        ? `BDUA activos${data?.bduaCorte ? `, corte ${monthLabel(data.bduaCorte)}` : ''} (sin régimen de excepción)`
        : null
  const girosLabel = data?.giros.fuente
    ? `${data.giros.desde ? monthLabel(data.giros.desde) : ''} a ${data.giros.hasta ? monthLabel(data.giros.hasta) : ''}, ${
        data.giros.fuente === 'identifica' ? 'contributivo y subsidiado' : 'régimen subsidiado'
      }`
    : null

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Entorno del municipio</h2>
          <p className="text-sm text-gray-500 mt-1">
            {municipio ? `${municipio.name}${municipio.department_name ? `, ${municipio.department_name}` : ''}` : 'Afiliados, cobertura y EPS del municipio de la IPS'}
          </p>
        </div>
        {can('intelligence:view') && (
          <Link href="/inteligencia" className="text-sm font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">
            Ver población y cobertura
          </Link>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">No se pudo cargar el entorno del municipio: {error}</p>
      ) : !data ? (
        <div className="animate-pulse space-y-3" aria-label="Cargando entorno del municipio">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
        </div>
      ) : !municipio ? (
        <p className="text-sm text-gray-600">Esta IPS no tiene un municipio reconocido; no se puede mostrar su entorno.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Afiliados</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{fmtInt(afiliados)}</p>
              {fuenteAfiliados && <p className="text-xs text-gray-500 mt-1">{fuenteAfiliados}</p>}
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Cobertura</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatPct(municipio.cobertura)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Población{data.poblacionAnio ? ` DANE ${data.poblacionAnio}` : ''}: {fmtInt(municipio.poblacion)}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">Giros ADRES en el municipio</p>
              {ranking && ranking.posicion ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                    {ranking.posicion}.ª <span className="text-base font-medium text-gray-500">de {ranking.conGiro}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Recibe {formatPct(ranking.pct)} de {formatCopCompact(ranking.giroMunicipio)} ({ranking.totalIps} IPS activas en el municipio)
                  </p>
                </>
              ) : ranking ? (
                <>
                  <p className="text-lg font-semibold text-gray-900 mt-1">Sin giro</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {ranking.conGiro > 0
                      ? `${ranking.conGiro} de ${ranking.totalIps} IPS del municipio reciben giros (${formatCopCompact(ranking.giroMunicipio)})`
                      : 'Ninguna IPS activa del municipio tiene giros cargados'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600 mt-1">Solo se calcula para IPS activas.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Afiliados por régimen</h3>
              {afiliados ? (
                <>
                  <div className="flex h-2.5 w-full gap-[2px]" role="img" aria-label={visibles.map(item => `${item.label} ${fmtInt(item.value)}`).join(', ')}>
                    {visibles.map((item, index) => (
                      <span
                        key={item.key}
                        className={`h-2.5 ${index === 0 ? 'rounded-l' : ''} ${index === visibles.length - 1 ? 'rounded-r' : ''}`}
                        style={{ width: `${(item.value / afiliados) * 100}%`, background: item.color, minWidth: 2 }}
                        title={`${item.label}: ${fmtInt(item.value)}`}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {regimenes.map(item => (
                      <li key={item.key} className="flex items-baseline justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                          {item.label}
                        </span>
                        <span className="tabular-nums text-gray-900 whitespace-nowrap">
                          {fmtInt(item.value)} <span className="text-gray-500 text-xs">{formatPct(afiliados ? (item.value / afiliados) * 100 : null)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-gray-500">Sin cifras de afiliación cargadas para este municipio.</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">EPS dominantes</h3>
              {municipio.topEps.length > 0 ? (
                <ul className="space-y-2.5">
                  {municipio.topEps.map(eps => (
                    <li key={eps.codigo}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-gray-800 truncate" title={eps.nombre}>
                          {eps.nombre}
                        </span>
                        <span className="tabular-nums text-gray-900 whitespace-nowrap">
                          {fmtInt(eps.afiliados)} <span className="text-gray-500 text-xs">{formatPct(eps.pct)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1, Math.min(100, eps.pct))}%`, background: REGIMEN_COLORS.contributivo }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Sin datos de la BDUA para este municipio.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {fuenteAfiliados ? `Afiliados: ${fuenteAfiliados}. ` : ''}
            EPS: BDUA, afiliados activos de todos los regímenes (% sobre los afiliados de la BDUA en el municipio).
            {girosLabel ? ` Giros: ADRES, ${girosLabel}; el giro de un NIT con varias sedes se reparte por camas.` : ' Aún no hay giros de la ADRES cargados.'}
          </p>
        </div>
      )}
    </div>
  )
}
