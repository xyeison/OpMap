'use client'

// Detalle de un contrato · "SIA Observa" (spec docs/specs/2026-10-29-agente-sia-observa.md, Fases 2.6 y 3.5):
//   - Documentos de la ficha con su estado; los copiados se abren con un enlace firmado de 10 minutos, los demás en SIA.
//   - Diferencias entre el contrato y lo que dice SIA (valor vigente, fechas, número, modelo, enlace) o lo que leyó la IA
//     (indicadores y requisitos): cada una se aplica con un clic (PUT /api/contracts/[id]); nada cambia solo.
//   - "Actualizar desde SIA" (contracts:edit): Vercel no llega a SIA; pide que la carga nocturna relea la ficha.
// Sin enlace con SIA, sin migración o sin permiso: no se pinta nada.
import { useCallback, useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { EstadoDocumento, LineaChip, abrirDocumento, fechaCorta, pesos, tipoDocumentoLabel } from './sia-ui'

interface Documento {
  id: string
  nombre_archivo: string
  tipo: string
  estado: string
  fuente_url: string
  fecha_cargue_sia: string | null
  paginas: number | null
  tiene_texto: boolean | null
}

interface Diferencia {
  campo: string
  etiqueta: string
  actual: string | number | boolean | null
  propuesto: string | number | boolean | null
  fuente: 'sia' | 'ia'
  cambios: Record<string, unknown>
}

interface Respuesta {
  sia: { id: string; sia_idc: number; codigo: string | null; ficha_url: string; valor_vigente: number | null; linea: string; secop_cruce: string | null; ficha_leida_at: string | null } | null
  documentos: Documento[]
  extraccion: {
    modelo: string
    fecha: string
    discrepancias: Array<{ campo: string; extraido: unknown; sia: unknown }>
    faltantes: string[]
    mercado: { cotizantes: Array<{ nombre: string; nit: string | null }>; ganador: string | null; base_presupuesto: string | null; gasto_historico: string | null } | null
  } | null
  diferencias: Diferencia[]
  refresco_pendiente?: boolean
}

const MODELOS: Record<string, string> = {
  contratacion_directa: 'Contratación Directa',
  licitacion: 'Licitación',
  invitacion_privada: 'Invitación Privada',
  subasta_inversa: 'Subasta Inversa',
}

function mostrar(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (campo === 'contract_value') return pesos(Number(valor))
  if (campo === 'contracting_model') return MODELOS[String(valor)] ?? String(valor)
  if (campo === 'max_endeudamiento') return `${Math.round(Number(valor) * 1000) / 10} %`
  if (campo === 'min_capital_trabajo') return `${valor} millones`
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return fechaCorta(valor)
  return String(valor)
}

export default function ContratoSiaPanel({ contractId, onAplicado }: { contractId: string; onAplicado?: () => void }) {
  const { can, loading: cargandoPermisos } = usePermissions()
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const puedeVer = !cargandoPermisos && can('contracts:view')
  const puedeEditar = !cargandoPermisos && can('contracts:edit')

  const cargar = useCallback(() => {
    fetch(`/api/sia/contrato/${contractId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setDatos(data))
      .catch(() => setDatos(null))
  }, [contractId])

  useEffect(() => {
    if (puedeVer) cargar()
  }, [puedeVer, cargar])

  if (!puedeVer || !datos?.sia) return null
  const { sia, documentos, extraccion, diferencias } = datos

  const aplicar = async (d: Diferencia) => {
    setOcupado(d.campo)
    try {
      const res = await fetch(`/api/contracts/${contractId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d.cambios) })
      if (!res.ok) throw new Error('No se pudo guardar')
      cargar()
      onAplicado?.()
    } catch {
      alert('No se pudo aplicar el cambio')
    } finally {
      setOcupado(null)
    }
  }

  const actualizar = async () => {
    setOcupado('actualizar')
    try {
      const res = await fetch(`/api/sia/contrato/${contractId}/actualizar`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      setAviso((data as { mensaje?: string; error?: string }).mensaje ?? (data as { error?: string }).error ?? 'Listo')
      cargar()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SIA Observa</h2>
          <p className="text-sm text-gray-500 mt-1">
            {sia.codigo ?? `idc ${sia.sia_idc}`} · vigente {pesos(sia.valor_vigente)} · <LineaChip linea={sia.linea} />
            {sia.ficha_leida_at ? ` · ficha leída el ${fechaCorta(sia.ficha_leida_at)}` : ' · ficha aún sin leer'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={sia.ficha_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
            Ver ficha en SIA
          </a>
          {puedeEditar && (
            <button type="button" onClick={actualizar} disabled={ocupado !== null || datos.refresco_pendiente} className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black text-sm disabled:opacity-50">
              {datos.refresco_pendiente ? 'Actualización pedida' : 'Actualizar desde SIA'}
            </button>
          )}
        </div>
      </div>
      {aviso && <p className="mb-4 text-sm text-gray-700">{aviso}</p>}

      {diferencias.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Diferencias para revisar</h3>
          <div className="divide-y divide-gray-100 rounded-lg border border-amber-200 bg-amber-50/40">
            {diferencias.map(d => (
              <div key={d.campo} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="text-sm">
                  <p className="font-medium text-gray-900">
                    {d.etiqueta} <span className="text-xs font-normal text-gray-500">({d.fuente === 'sia' ? 'SIA' : 'leído por la IA'})</span>
                  </p>
                  <p className="text-gray-700 break-words">
                    {mostrar(d.campo, d.actual)} → <span className="font-semibold">{mostrar(d.campo, d.propuesto)}</span>
                  </p>
                </div>
                {puedeEditar && (
                  <button type="button" onClick={() => aplicar(d)} disabled={ocupado !== null} className="px-3 py-1.5 border border-gray-900 text-gray-900 rounded-lg text-sm hover:bg-white disabled:opacity-50">
                    {ocupado === d.campo ? 'Aplicando…' : 'Aplicar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-gray-900 mb-2">Documentos</h3>
      {documentos.length === 0 ? (
        <p className="text-sm text-gray-500">La ficha aún no se ha leído (la carga nocturna lo hace).</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {documentos.map(doc => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 break-all">{doc.nombre_archivo}</p>
                <p className="text-xs text-gray-500">
                  {tipoDocumentoLabel(doc.tipo)}
                  {doc.paginas ? ` · ${doc.paginas} págs.` : ''}
                  {doc.tiene_texto === false ? ' · escaneado' : ''}
                  {doc.fecha_cargue_sia ? ` · cargado en SIA el ${fechaCorta(doc.fecha_cargue_sia)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <EstadoDocumento estado={doc.estado} />
                {doc.estado === 'descargado' ? (
                  <button type="button" onClick={() => abrirDocumento(doc.id)} className="text-sm text-gray-900 underline">
                    Abrir
                  </button>
                ) : (
                  <a href={doc.fuente_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 underline">
                    Ver en SIA
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {extraccion?.mercado && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 space-y-1">
          <h3 className="font-semibold text-gray-900">Lo que dicen los documentos (IA · {extraccion.modelo}, {fechaCorta(extraccion.fecha)})</h3>
          {extraccion.mercado.cotizantes.length > 0 && <p>Cotizaron: {extraccion.mercado.cotizantes.map(c => c.nombre + (c.nit ? ` (NIT ${c.nit})` : '')).join(', ')}.</p>}
          {extraccion.mercado.ganador && <p>Ganó: {extraccion.mercado.ganador}.</p>}
          {extraccion.mercado.base_presupuesto && <p>Base del presupuesto: {extraccion.mercado.base_presupuesto}.</p>}
          {extraccion.mercado.gasto_historico && <p>Gasto histórico: {extraccion.mercado.gasto_historico}.</p>}
          {extraccion.discrepancias.length > 0 && <p className="text-amber-800">Difiere de SIA en: {extraccion.discrepancias.map(d => d.campo).join(', ')}.</p>}
          {extraccion.faltantes.length > 0 && <p className="text-gray-500">No está en los documentos: {extraccion.faltantes.join(', ')}.</p>}
        </div>
      )}
    </div>
  )
}
