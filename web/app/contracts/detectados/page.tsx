'use client'

// /contracts/detectados · bandeja de contratos de SIA Observa y SECOP de las líneas que aún no están en Contratos (spec
// docs/specs/2026-10-29-agente-sia-observa.md, Fase 3.4). Filtros por línea, Zona y fecha de firma (por defecto, los
// últimos 24 meses). Acciones: Importar (abre el formulario precargado; nada se guarda hasta "Crear Contrato") y Descartar
// (con motivo; sale de la bandeja). Datos: GET /api/sia/detectados y POST /api/sia/detectados/descartar (contracts:edit).
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { usePermissions } from '@/hooks/usePermissions'
import { LineaChip, fechaCorta, pesos } from '@/components/contracts/sia-ui'
import { lineaLabel } from '@/lib/compras-publicas'

interface Detectado {
  origen: 'sia' | 'secop'
  id: string
  codigo: string | null
  fecha_firma: string | null
  contratista: string | null
  valor: number | null
  linea: string
  objeto: string | null
  hospital_id: string | null
  hospital: string | null
  municipio: string | null
  zona: string | null
  ficha_url: string | null
}

const LINEAS = ['trauma', 'reemplazo', 'columna', 'deportiva', 'neurocirugia', 'otros_implantes']

export default function ContratosDetectadosPage() {
  const { can, loading: cargandoPermisos } = usePermissions()
  const [filtros, setFiltros] = useState({ linea: '', kam_id: '', desde: '', hasta: '' })
  const [zonas, setZonas] = useState<Array<{ id: string; name: string; active?: boolean }>>([])
  const [datos, setDatos] = useState<{ total: number; contratos: Detectado[]; desde: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [descartando, setDescartando] = useState<Detectado | null>(null)
  const [motivo, setMotivo] = useState('')
  const puede = !cargandoPermisos && can('contracts:edit')

  const cargar = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as Array<[string, string]>)
    setError(null)
    fetch(`/api/sia/detectados?${q.toString()}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (res.status === 503) setError('SIA Observa todavía no está instalado en OpMap (falta la migración 0930).')
        else if (!res.ok) setError((data as { error?: string }).error ?? 'No se pudo cargar la bandeja')
        else setDatos(data)
      })
      .catch(() => setError('No se pudo cargar la bandeja'))
  }, [filtros])

  useEffect(() => {
    if (puede) cargar()
  }, [puede, cargar])

  useEffect(() => {
    if (!puede) return
    fetch('/api/kams')
      .then(res => (res.ok ? res.json() : []))
      .then((lista: Array<{ id: string; name: string; active?: boolean }>) => setZonas(lista.filter(z => z.active !== false).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setZonas([]))
  }, [puede])

  const descartar = async () => {
    if (!descartando) return
    const res = await fetch('/api/sia/detectados/descartar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [descartando.origen === 'sia' ? 'sia_id' : 'secop_id']: descartando.id, motivo }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert((data as { error?: string }).error ?? 'No se pudo descartar')
      return
    }
    setDescartando(null)
    setMotivo('')
    cargar()
  }

  const importarHref = (c: Detectado) => {
    const q = new URLSearchParams({ [c.origen === 'sia' ? 'sia_id' : 'secop_id']: c.id })
    if (c.hospital_id) q.set('hospital_id', c.hospital_id)
    if (c.hospital) q.set('hospital_name', c.hospital)
    if (c.municipio) q.set('municipality_name', c.municipio)
    return `/contracts/new/edit?${q.toString()}`
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/contracts" className="text-sm text-gray-500 hover:text-gray-900">
              ← Contratos
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Contratos detectados</h1>
            <p className="text-gray-600 mt-1">Contratos de SIA Observa y SECOP de las líneas que aún no están en Contratos. Revisa e importa, o descarta con el motivo.</p>
          </div>
          {datos && <span className="text-sm text-gray-500">{datos.total} contratos{datos.total > datos.contratos.length ? ` (se muestran ${datos.contratos.length})` : ''}</span>}
        </div>

        {!cargandoPermisos && !puede && <p className="text-gray-600">Necesitas permiso para editar contratos.</p>}

        {puede && (
          <>
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <label className="text-sm text-gray-700">
                Línea
                <select value={filtros.linea} onChange={e => setFiltros(f => ({ ...f, linea: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Todas</option>
                  {LINEAS.map(l => (
                    <option key={l} value={l}>
                      {lineaLabel(l)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Zona
                <select value={filtros.kam_id} onChange={e => setFiltros(f => ({ ...f, kam_id: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Todas</option>
                  {zonas.map(z => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Firmados desde
                <input type="date" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </label>
              <label className="text-sm text-gray-700">
                Hasta
                <input type="date" value={filtros.hasta} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </label>
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}
            {!error && !datos && <p className="text-sm text-gray-500">Cargando…</p>}
            {datos && datos.contratos.length === 0 && <p className="text-sm text-gray-500">No hay contratos detectados con estos filtros.</p>}

            <div className="space-y-3">
              {(datos?.contratos ?? []).map(c => (
                <div key={`${c.origen}-${c.id}`} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        <span className={`mr-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.origen === 'sia' ? 'border-gray-900 text-gray-900' : 'border-gray-300 text-gray-600'}`}>{c.origen === 'sia' ? 'SIA' : 'SECOP'}</span>
                        {c.codigo ?? 'Sin número'} <span className="font-normal text-gray-500">· firma {fechaCorta(c.fecha_firma)}</span>
                      </p>
                      <p className="text-sm text-gray-900 mt-1">
                        {c.hospital ?? 'IPS'} {c.municipio && <span className="text-gray-500">· {c.municipio}</span>}
                        {c.zona && <span className="text-gray-500"> · Zona {c.zona}</span>}
                      </p>
                      <p className="text-sm text-gray-700">
                        {c.contratista ?? 'Proveedor no publicado'} · <span className="font-medium">{pesos(c.valor)}</span>
                      </p>
                      {c.objeto && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.objeto}</p>}
                      <div className="mt-1 flex items-center gap-3">
                        <LineaChip linea={c.linea} />
                        {c.ficha_url && (
                          <a href={c.ficha_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-700 underline">
                            {c.origen === 'sia' ? 'Ficha en SIA' : 'Ver en SECOP'}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={importarHref(c)} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-black">
                        Importar
                      </Link>
                      <button type="button" onClick={() => setDescartando(c)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                        Descartar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {descartando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">Descartar {descartando.codigo ?? 'contrato'}</h2>
              <p className="text-sm text-gray-600 mt-1">Sale de la bandeja y no se vuelve a proponer. El motivo queda guardado.</p>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej.: no es material de nuestras líneas, ya lo tenemos con otro número…" />
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setDescartando(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg">
                  Cancelar
                </button>
                <button type="button" onClick={descartar} disabled={motivo.trim().length < 3} className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50">
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
