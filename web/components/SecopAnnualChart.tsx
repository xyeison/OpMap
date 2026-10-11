'use client'

// Fase 5 · Columnas por año de las compras públicas (SECOP), apiladas por línea de producto.
// SVG propio, sin librerías; la tabla (details) deja los valores accesibles sin hover.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatCop, formatCopCompact } from '@/lib/giros-format'
import { compareLineas, lineaColor, lineaLabel, type AnioPunto } from '@/lib/compras-publicas'

interface Props {
  points: AnioPunto[]
  ariaLabel: string
  height?: number
}

const DEFAULT_WIDTH = 640
const PAD = { top: 10, right: 8, bottom: 24, left: 66 }

function niceStep(value: number): number {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

export default function SecopAnnualChart({ points, ariaLabel, height = 200 }: Props) {
  // El SVG se dibuja al ancho real del contenedor para que los textos midan siempre lo mismo (celular)
  const boxRef = useRef<HTMLDivElement>(null)
  const [WIDTH, setWidth] = useState(DEFAULT_WIDTH)
  const hasPoints = points.some(p => p.total > 0)
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
  const lineas = useMemo(() => {
    const set = new Set<string>()
    for (const point of points) for (const key of Object.keys(point.lineas)) if (point.lineas[key] > 0) set.add(key)
    return Array.from(set).sort(compareLineas)
  }, [points])

  if (points.length === 0 || points.every(p => p.total <= 0)) {
    return <p className="text-sm text-gray-500">Sin compras con fecha en el histórico.</p>
  }

  const max = Math.max(...points.map(p => p.total))
  const step = niceStep(max / 4)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const slot = plotW / points.length
  const barW = Math.max(4, Math.min(48, slot * 0.7))
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v)
  // Etiqueta de año cada k columnas para que no se monten (~36 px por etiqueta)
  const labelEvery = Math.max(1, Math.ceil(36 / Math.max(1, slot)))

  return (
    <div>
      <div ref={boxRef}>
      <svg width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} className="block max-w-full" role="img" aria-label={ariaLabel}>
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#6b7280">
              {tick === 0 ? '0' : formatCopCompact(tick).replace(/^\$\s/, '')}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = PAD.left + slot * index + (slot - barW) / 2
          let acc = 0
          return (
            <g key={point.anio}>
              <title>{`${point.anio}: ${formatCop(point.total)}`}</title>
              {lineas.map(linea => {
                const value = point.lineas[linea] || 0
                if (value <= 0) return null
                const y0 = y(acc + value)
                const h = y(acc) - y0
                acc += value
                return <rect key={linea} x={x} y={y0} width={barW} height={Math.max(0.5, h)} fill={lineaColor(linea)} />
              })}
              {index % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="#6b7280">
                  {point.anio}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      </div>
      {lineas.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
          {lineas.map(linea => (
            <li key={linea} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: lineaColor(linea) }} />
              {lineaLabel(linea)}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-2 text-xs text-gray-600">
        <summary className="cursor-pointer select-none py-2">Ver tabla por año</summary>
        <div className="overflow-x-auto">
          <table className="min-w-full mt-1">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-1 pr-3 font-medium">Año</th>
                {lineas.map(linea => (
                  <th key={linea} className="py-1 pr-3 font-medium text-right whitespace-nowrap">
                    {lineaLabel(linea)}
                  </th>
                ))}
                <th className="py-1 pr-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {points.map(point => (
                <tr key={point.anio} className="border-b border-gray-100">
                  <td className="py-1 pr-3 tabular-nums">{point.anio}</td>
                  {lineas.map(linea => (
                    <td key={linea} className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
                      {point.lineas[linea] ? formatCopCompact(point.lineas[linea]) : '—'}
                    </td>
                  ))}
                  <td className="py-1 pr-3 text-right tabular-nums font-medium whitespace-nowrap">{formatCopCompact(point.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
