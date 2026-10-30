'use client'

// SIA Observa · piezas de UI compartidas (tarjeta de la IPS, panel del contrato, importación y bandeja).
import { formatCop } from '@/lib/giros-format'
import { lineaColor, lineaLabel } from '@/lib/compras-publicas'
import { TIPO_DOCUMENTO_LABELS, type TipoDocumento } from '@/lib/sia-observa/tipos'

export function pesos(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : formatCop(Number(valor))
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function LineaChip({ linea }: { linea: string | null | undefined }) {
  if (!linea || linea === 'no_clasificado') return <span className="text-[11px] text-gray-400">Sin línea</span>
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: lineaColor(linea) }} />
      {lineaLabel(linea)}
    </span>
  )
}

export const ESTADO_DOCUMENTO: Record<string, { label: string; clase: string; ayuda: string }> = {
  descargado: { label: 'Copia en OpMap', clase: 'bg-green-50 text-green-800 border-green-200', ayuda: 'PDF copiado al almacenamiento privado de OpMap' },
  solo_enlace: { label: 'Solo en SIA', clase: 'bg-gray-50 text-gray-700 border-gray-200', ayuda: 'PDF disponible en SIA; no se copia (no es de los documentos clave)' },
  anonimizacion_pendiente: { label: 'Pide correo (anonimización)', clase: 'bg-amber-50 text-amber-800 border-amber-200', ayuda: 'SIA pide un correo para enviarlo anonimizado; OpMap no lo envía' },
  restringido: { label: 'Restringido (Ley 1581)', clase: 'bg-red-50 text-red-700 border-red-200', ayuda: 'SIA restringe su visualización' },
  error: { label: 'No se pudo leer', clase: 'bg-red-50 text-red-700 border-red-200', ayuda: 'Se reintenta en la próxima carga' },
}

export function EstadoDocumento({ estado }: { estado: string }) {
  const e = ESTADO_DOCUMENTO[estado] ?? ESTADO_DOCUMENTO.error
  return (
    <span title={e.ayuda} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${e.clase}`}>
      {e.label}
    </span>
  )
}

export function tipoDocumentoLabel(tipo: string): string {
  return TIPO_DOCUMENTO_LABELS[tipo as TipoDocumento] ?? tipo
}

/** Abre el PDF del bucket con un enlace firmado de 10 minutos (POST /api/sia/documentos/[id]/enlace). */
export async function abrirDocumento(id: string): Promise<void> {
  const res = await fetch(`/api/sia/documentos/${id}/enlace`, { method: 'POST' })
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!res.ok || !data.url) {
    alert(data.error ?? 'No se pudo abrir el documento')
    return
  }
  window.open(data.url, '_blank', 'noopener,noreferrer')
}
