'use client'

// Columnas por mes de los giros ADRES (SVG propio, sin librerías). Con stacked=true apila
// Capitación (azul) + Evento (naranja) + Otros (gris, solo si hay), con leyenda.
// Hover/foco por columna muestra los valores; la tabla (details) los deja accesibles sin hover.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCop, formatCopCompact, GIROS_COLORS, monthLabel } from '@/lib/giros-format'

export interface GirosChartPoint {
  periodo: string // 'YYYY-MM'
  total: number
  capitacion?: number
  evento?: number
}

interface Props {
  points: GirosChartPoint[]
  stacked?: boolean
  height?: number
  ariaLabel: string
  showTable?: boolean
}

const DEFAULT_WIDTH = 640
const PAD = { top: 12, right: 8, bottom: 26, left: 64 }

/** Paso "redondo" (1, 2, 2,5 o 5 × 10^k) para ~4 divisiones del eje. */
function niceStep(value: number): number {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

/** Rectángulo con las esquinas de arriba redondeadas (r) y la base recta. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export default function GirosMonthlyChart({ points, stacked = false, height = 220, ariaLabel, showTable = true }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  // El SVG se dibuja al ancho real del contenedor para que los textos midan siempre lo mismo
  const boxRef = useRef<HTMLDivElement>(null)
  const [WIDTH, setWidth] = useState(DEFAULT_WIDTH)
  const hasPoints = points.length > 0 // el contenedor solo existe cuando hay meses
  useEffect(() => {
    const node = boxRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect.width || 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasPoints])
  const innerW = Math.max(40, WIDTH - PAD.left - PAD.right)
  const innerH = height - PAD.top - PAD.bottom
  const { max, ticks } = useMemo(() => {
    const top = Math.max(0, ...points.map(p => p.total))
    const step = niceStep(top / 4)
    const steps = Math.max(1, Math.ceil(top / step))
    return { max: steps * step, ticks: Array.from({ length: steps + 1 }, (_, i) => i * step) }
  }, [points])
  const hasOtros = stacked && points.some(p => p.total - (p.capitacion || 0) - (p.evento || 0) > 0.5)
  const slot = points.length > 0 ? innerW / points.length : innerW
  const barW = Math.max(4, Math.min(24, slot * 0.6))
  // Etiquetas de mes cada k columnas para que no se monten (~56 px por etiqueta)
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(1, slot)))
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH

  if (points.length === 0) return <p className="text-sm text-gray-500">Sin meses en el rango.</p>

  const hovered = hover !== null ? points[hover] : null
  const hoverLeftPct = hover !== null ? ((PAD.left + slot * hover + slot / 2) / WIDTH) * 100 : 0

  return (
    <div>
      {stacked && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: GIROS_COLORS.capitacion }} /> Capitación
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: GIROS_COLORS.evento }} /> Evento
          </span>
          {hasOtros && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: GIROS_COLORS.otros }} /> Otros
            </span>
          )}
        </div>
      )}
      <div className="relative" ref={boxRef}>
        <svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} className="block max-w-full" role="img" aria-label={ariaLabel}>
          {ticks.map(tick => (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b7280">
                {tick === 0 ? '0' : formatCopCompact(tick).replace('$ ', '')}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const cx = PAD.left + slot * index + slot / 2
            const x = cx - barW / 2
            const segments: Array<{ value: number; color: string }> = stacked
              ? [
                  { value: point.capitacion || 0, color: GIROS_COLORS.capitacion },
                  { value: point.evento || 0, color: GIROS_COLORS.evento },
                  { value: Math.max(0, point.total - (point.capitacion || 0) - (point.evento || 0)), color: GIROS_COLORS.otros },
                ].filter(segment => segment.value > 0.5)
              : [{ value: point.total, color: GIROS_COLORS.total }]
            let base = PAD.top + innerH
            const shapes = segments.map((segment, segIndex) => {
              const h = (segment.value / max) * innerH
              const isTop = segIndex === segments.length - 1
              const gap = segIndex > 0 ? 2 : 0 // separación de 2 px entre segmentos apilados
              const top = base - h
              const drawH = Math.max(0, h - gap)
              const shape = isTop ? (
                <path key={segIndex} d={topRounded(x, top, barW, drawH, 4)} fill={segment.color} />
              ) : (
                <rect key={segIndex} x={x} y={top} width={barW} height={drawH} fill={segment.color} />
              )
              base = top
              return shape
            })
            const active = hover === index
            return (
              <g
                key={point.periodo}
                tabIndex={0}
                aria-label={`${monthLabel(point.periodo)}: ${formatCop(point.total)}`}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(current => (current === index ? null : current))}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(current => (current === index ? null : current))}
                style={{ outline: 'none', cursor: 'default' }}
              >
                <rect x={PAD.left + slot * index} y={PAD.top} width={slot} height={innerH} fill={active ? '#f3f4f6' : 'transparent'} />
                <g opacity={hover === null || active ? 1 : 0.55}>{shapes}</g>
                {index % labelEvery === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill="#6b7280">
                    {monthLabel(point.periodo)}
                  </text>
                )}
              </g>
            )
          })}
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#d1d5db" strokeWidth={1} />
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `${Math.min(85, Math.max(15, hoverLeftPct))}%` }}
          >
            <div className="font-semibold text-gray-900">{formatCop(hovered.total)}</div>
            <div className="text-gray-500">{monthLabel(hovered.periodo)}</div>
            {stacked && (
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="inline-block w-3 h-0.5" style={{ background: GIROS_COLORS.capitacion }} />
                  <span className="font-medium">{formatCop(hovered.capitacion || 0)}</span>
                  <span className="text-gray-500">Capitación</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span className="inline-block w-3 h-0.5" style={{ background: GIROS_COLORS.evento }} />
                  <span className="font-medium">{formatCop(hovered.evento || 0)}</span>
                  <span className="text-gray-500">Evento</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showTable && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Ver tabla por mes</summary>
          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1 pr-4 font-medium">Mes</th>
                  <th className="py-1 pr-4 font-medium text-right">Total</th>
                  {stacked && <th className="py-1 pr-4 font-medium text-right">Capitación</th>}
                  {stacked && <th className="py-1 pr-4 font-medium text-right">Evento</th>}
                </tr>
              </thead>
              <tbody>
                {points.map(point => (
                  <tr key={point.periodo} className="border-t border-gray-100">
                    <td className="py-1 pr-4 text-gray-700">{monthLabel(point.periodo)}</td>
                    <td className="py-1 pr-4 text-right tabular-nums text-gray-900">{formatCop(point.total)}</td>
                    {stacked && <td className="py-1 pr-4 text-right tabular-nums text-gray-700">{formatCop(point.capitacion || 0)}</td>}
                    {stacked && <td className="py-1 pr-4 text-right tabular-nums text-gray-700">{formatCop(point.evento || 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
