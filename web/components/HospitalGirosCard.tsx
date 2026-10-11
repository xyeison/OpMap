'use client'

// Fase 3 · Tarjeta "Giros ADRES (últimos 12 meses)" de la ficha de IPS.
// Datos: GET /api/intelligence/giros/hospital/[id] (por NIT del prestador). Si el NIT ya se consultó en
// "Identifica tu Giro": total por régimen, entidades ordenadoras y serie por régimen. Si no, Reporte 29
// (régimen subsidiado: Capitación / Evento y EPS).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import GirosMonthlyChart, { SEGMENTS_REGIMEN } from '@/components/GirosMonthlyChart'
import { formatCop, formatFechaGiro, formatPct, monthLabel, GIROS_COLORS } from '@/lib/giros-format'

interface HospitalGirosResponse {
  nit: string | null
  sedesNit: number
  fuente: 'identifica' | 'reporte29' | null
  range: { desde: string; hasta: string } | null
  summary: {
    total: number
    capitacion: number
    evento: number
    otros: number
    contributivo: number
    subsidiado: number
    regimenOtro: number
    ultimaFecha: string | null
    topEps: Array<{ codigo: string; nombre: string; valor: number; pct: number }>
    series: Array<{ periodo: string; total: number; contributivo?: number; subsidiado?: number; otro?: number }>
  } | null
  lastFetch: { estado: string; fetched_at: string; nombre_prestador: string | null } | null
}

function fetchNote(data: HospitalGirosResponse): string | null {
  if (!data.lastFetch) return 'Este NIT aún no se ha consultado en la ADRES.'
  const date = new Date(data.lastFetch.fetched_at).toLocaleDateString('es-CO')
  if (data.lastFetch.estado === 'error') return `La última consulta a la ADRES falló (${date}).`
  if (data.lastFetch.estado === 'sin_registros') return `Consultado en la ADRES el ${date}: no reporta giros en el rango consultado.`
  return `Consultado en la ADRES el ${date}.`
}

function Amount({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        {color && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />} {label}
      </p>
      <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">{formatCop(value)}</p>
    </div>
  )
}

export default function HospitalGirosCard({ hospitalId }: { hospitalId: string }) {
  const { can } = usePermissions()
  const [data, setData] = useState<HospitalGirosResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetch(`/api/intelligence/giros/hospital/${encodeURIComponent(hospitalId)}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        if (!cancelled) setData(body as HospitalGirosResponse)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los giros')
      })
    return () => {
      cancelled = true
    }
  }, [hospitalId])

  const summary = data?.summary ?? null
  const identifica = data?.fuente === 'identifica'
  const rangeLabel = data?.range ? `${monthLabel(data.range.desde)} a ${monthLabel(data.range.hasta)}` : null
  const fuenteLabel = identifica ? 'Contributivo y subsidiado' : 'Régimen subsidiado'
  const sourceNote = identifica
    ? 'Fuente: ADRES, "Identifica tu Giro", por fecha de giro. En los giros LMA "CXP IPS" del subsidiado la entidad ordenadora es el ente territorial, no la EPS.'
    : 'Fuente: ADRES, Reporte 29 "Giro a IPS", por mes de proceso.'

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Giros ADRES (últimos 12 meses)</h2>
          <p className="text-sm text-gray-500 mt-1">
            {fuenteLabel}
            {data?.nit ? ` · NIT ${data.nit}` : ''}
            {rangeLabel ? ` · ${rangeLabel}` : ''}
          </p>
        </div>
        {can('intelligence:view') && (
          <Link href="/inteligencia" className="text-sm font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2">
            Ver inteligencia de giros
          </Link>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-600">No se pudieron cargar los giros: {error}</p>
      ) : !data ? (
        <div className="animate-pulse space-y-3" aria-label="Cargando giros">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
        </div>
      ) : !data.nit ? (
        <p className="text-sm text-gray-600">El código de esta IPS no es un NIT válido; no se puede cruzar con la ADRES.</p>
      ) : !summary ? (
        <div className="text-center py-6">
          <p className="text-gray-700 font-medium">Sin giros registrados ({fuenteLabel.toLowerCase()})</p>
          <p className="text-gray-500 text-sm mt-1">{fetchNote(data)}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.sedesNit > 1 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              NIT con {data.sedesNit} sedes activas en OpMap: estas cifras son del prestador completo, no solo de esta sede.
            </p>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${identifica ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500">{data.sedesNit > 1 ? 'Total girado al prestador (NIT)' : 'Total girado'}</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{formatCop(summary.total)}</p>
              <p className="text-xs text-gray-500 mt-1">Último giro: {formatFechaGiro(summary.ultimaFecha, !identifica)}</p>
            </div>
            {identifica ? (
              <>
                <Amount label="Contributivo" value={summary.contributivo} color={GIROS_COLORS.contributivo} />
                <Amount label="Subsidiado" value={summary.subsidiado} color={GIROS_COLORS.subsidiado} />
                <Amount label="Otros conceptos" value={summary.regimenOtro} color={GIROS_COLORS.otros} />
              </>
            ) : (
              <>
                <Amount label="Capitación" value={summary.capitacion} color={GIROS_COLORS.capitacion} />
                <Amount label="Evento" value={summary.evento} color={GIROS_COLORS.evento} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{identifica ? 'Entidades ordenadoras que más giraron' : 'EPS que más giraron'}</h3>
              <ul className="space-y-2.5">
                {summary.topEps.map(eps => (
                  <li key={eps.codigo}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-gray-800 truncate min-w-0" title={`${eps.nombre} (${eps.codigo})`}>
                        {eps.nombre} <span className="text-gray-400 text-xs">{eps.codigo.startsWith('nombre:') ? '' : identifica ? `NIT ${eps.codigo}` : eps.codigo}</span>
                      </span>
                      <span className="tabular-nums text-gray-900 whitespace-nowrap">
                        {formatCop(eps.valor)} <span className="text-gray-500 text-xs">{formatPct(eps.pct)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(1, Math.min(100, eps.pct))}%`, background: GIROS_COLORS.total }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Giro por mes</h3>
              <GirosMonthlyChart
                points={summary.series}
                stacked={identifica}
                segments={identifica ? SEGMENTS_REGIMEN : undefined}
                height={190}
                ariaLabel={`Giro mensual de la ADRES al NIT ${data.nit}`}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {sourceNote} {fetchNote(data)}
          </p>
        </div>
      )}
    </div>
  )
}
