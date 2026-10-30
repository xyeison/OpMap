'use client'

// "Importar desde SIA / SECOP" en /contracts/new/edit (spec docs/specs/2026-10-29-agente-sia-observa.md, Fase 2.5): lista
// los contratos de SIA y SECOP del NIT de la IPS de los últimos 24 meses que aún no están en Contratos (primero los de las
// líneas) y, al elegir uno, trae la precarga del formulario. No guarda nada: la persona revisa y pulsa "Crear Contrato".
import { useEffect, useState } from 'react'
import { LineaChip, fechaCorta, pesos } from './sia-ui'

export interface Importable {
  origen: 'sia' | 'secop'
  id: string
  codigo: string | null
  fecha_firma: string | null
  contratista: string | null
  valor: number | null
  linea: string
  objeto: string | null
}

export interface PrecargaRespuesta {
  origen: 'sia' | 'secop'
  precarga: {
    hospital_id: string | null
    contract_number: string
    current_provider: string
    contract_value: number
    contract_type: string
    contracting_model: string
    start_date: string | null
    end_date: string | null
    duration_months: number | null
    description: string
    documents_link: string
    sia_contrato_id: string | null
    secop_contrato_id: string | null
    lineas: string[]
    valor_secop: number | null
  }
  indicadores: Record<string, unknown> | null
  extraccion: {
    modelo: string
    fecha: string
    discrepancias: Array<{ campo: string; extraido: unknown; sia: unknown }>
    faltantes: string[]
    fuentes: Array<{ campo: string; documento: string; pagina: number }>
  } | null
  proveedor: { id: string; nombre: string } | null
}

export async function pedirPrecarga(q: { siaId?: string | null; secopId?: string | null }): Promise<PrecargaRespuesta> {
  const params = q.siaId ? `sia_id=${q.siaId}` : `secop_id=${q.secopId}`
  const res = await fetch(`/api/sia/precarga?${params}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'No se pudo precargar el contrato')
  return data as PrecargaRespuesta
}

export default function ImportarSiaModal({ hospitalId, onClose, onImport }: { hospitalId: string; onClose: () => void; onImport: (data: PrecargaRespuesta) => void }) {
  const [lista, setLista] = useState<Importable[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/sia/importables?hospital_id=${hospitalId}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!vivo) return
        if (res.status === 503) setError('SIA Observa todavía no está instalado en OpMap.')
        else if (!res.ok) setError((data as { error?: string }).error ?? 'No se pudo cargar la lista')
        else setLista((data as { contratos: Importable[] }).contratos)
      })
      .catch(() => vivo && setError('No se pudo cargar la lista'))
    return () => {
      vivo = false
    }
  }, [hospitalId])

  const elegir = async (item: Importable) => {
    setCargando(item.id)
    try {
      onImport(await pedirPrecarga(item.origen === 'sia' ? { siaId: item.id } : { secopId: item.id }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo precargar el contrato')
    } finally {
      setCargando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Importar desde SIA / SECOP</h2>
            <p className="text-sm text-gray-500 mt-1">Contratos de esta IPS de los últimos 24 meses que aún no están en Contratos. Se precarga el formulario; nada se guarda hasta que pulses &ldquo;Crear Contrato&rdquo;.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!error && lista === null && <p className="text-sm text-gray-500">Cargando…</p>}
          {lista && lista.length === 0 && <p className="text-sm text-gray-500">No hay contratos de SIA ni de SECOP por importar para esta IPS.</p>}
          <div className="divide-y divide-gray-100">
            {(lista ?? []).map(item => (
              <button
                key={`${item.origen}-${item.id}`}
                type="button"
                disabled={cargando !== null}
                onClick={() => elegir(item)}
                className="w-full py-3 text-left hover:bg-gray-50 disabled:opacity-50 rounded-lg px-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    <span className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${item.origen === 'sia' ? 'border-gray-900 text-gray-900' : 'border-gray-300 text-gray-600'}`}>{item.origen === 'sia' ? 'SIA' : 'SECOP'}</span>
                    {item.codigo ?? 'Sin número'} <span className="font-normal text-gray-500">· firma {fechaCorta(item.fecha_firma)}</span>
                  </p>
                  <LineaChip linea={item.linea} />
                </div>
                <p className="text-sm text-gray-900">
                  {item.contratista ?? 'Proveedor no publicado'} <span className="text-gray-500">· {pesos(item.valor)}</span>
                </p>
                {item.objeto && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.objeto}</p>}
                {cargando === item.id && <p className="text-xs text-gray-500 mt-1">Precargando…</p>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
