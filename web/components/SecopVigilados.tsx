'use client'

// Fase 5 · Sección "Lista vigilada" (solo admin, permiso fuentes:manage): proveedores de material cuya
// actividad en SECOP se sigue. Viene de Odoo (proveedores de la compañía) y se pueden añadir NIT a mano,
// activar o desactivar (nunca se borran). Datos: GET/POST/DELETE /api/secop/vigilados.
import { useCallback, useEffect, useState } from 'react'
import { formatCopCompact, formatFechaGiro } from '@/lib/giros-format'
import type { VigiladosResponse } from '@/lib/compras-publicas'

const inputCls = 'w-full min-h-[44px] rounded-lg border border-gray-300 px-3 bg-white text-sm'

export default function SecopVigilados({ onOpenProveedor }: { onOpenProveedor?: (nit: string) => void }) {
  const [data, setData] = useState<VigiladosResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nit, setNit] = useState('')
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [filtro, setFiltro] = useState('')

  const load = useCallback(() => {
    setError(null)
    fetch('/api/secop/vigilados', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
        setData(body as VigiladosResponse)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar la lista vigilada'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const send = async (method: 'POST' | 'DELETE', target: string, payload?: Record<string, unknown>) => {
    setSaving(target)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(method === 'DELETE' ? `/api/secop/vigilados?nit=${encodeURIComponent(target)}` : '/api/secop/vigilados', {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body && typeof body.error === 'string' ? body.error : `Error ${response.status}`)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      return false
    } finally {
      setSaving(null)
    }
  }

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!nit.trim()) return
    const ok = await send('POST', 'nuevo', { nit: nit.trim(), nombre: nombre.trim() || null, activo: true })
    if (ok) {
      setMessage(`NIT ${nit.trim()} añadido a la lista vigilada. Sus ventas aparecen tras la próxima carga de SECOP.`)
      setNit('')
      setNombre('')
      load()
    }
  }

  const toggle = async (target: string, activo: boolean) => {
    const ok = activo ? await send('POST', target, { nit: target, activo: true }) : await send('DELETE', target)
    if (ok) load()
  }

  const rows = (data?.vigilados || []).filter(row => (verInactivos || row.activo) && (!filtro.trim() || `${row.nombre ?? ''} ${row.nit}`.toLowerCase().includes(filtro.trim().toLowerCase())))
  const activos = (data?.vigilados || []).filter(row => row.activo).length
  const inactivos = (data?.vigilados.length || 0) - activos

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6" aria-labelledby="lista-vigilada">
      <h2 id="lista-vigilada" className="text-lg font-semibold text-gray-900">
        Lista vigilada de proveedores
      </h2>
      <p className="text-xs text-gray-500 mt-1 mb-4">
        Proveedores de material (de Odoo, sin intercompañía) y NIT añadidos a mano. Sus contratos con entidades públicas se marcan
        &quot;Vigilado&quot; en todo OpMap. Desactivar no borra: se puede volver a activar.
      </p>

      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-3 items-end mb-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-gray-600 mb-1">NIT (9 dígitos, con o sin DV)</span>
          <input value={nit} onChange={event => setNit(event.target.value)} inputMode="numeric" placeholder="900123456" className={inputCls} required />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-gray-600 mb-1">Nombre (opcional)</span>
          <input value={nombre} onChange={event => setNombre(event.target.value)} maxLength={200} placeholder="Razón social" className={inputCls} />
        </label>
        <button type="submit" disabled={saving !== null || !nit.trim()} className="min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-40">
          {saving === 'nuevo' ? 'Guardando…' : 'Añadir NIT'}
        </button>
      </form>

      {message && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>}
      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <p className="text-sm text-gray-700">
          {activos} activos{inactivos > 0 ? ` · ${inactivos} inactivos` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm w-full sm:w-64">
            <span className="sr-only">Buscar en la lista vigilada</span>
            <input type="search" value={filtro} onChange={event => setFiltro(event.target.value)} placeholder="Buscar nombre o NIT" className={inputCls} />
          </label>
          {inactivos > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 min-h-[44px]">
              <input type="checkbox" checked={verInactivos} onChange={event => setVerInactivos(event.target.checked)} className="w-5 h-5" />
              Ver inactivos
            </label>
          )}
        </div>
      </div>

      {!data ? (
        error ? null : <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">La lista vigilada está vacía.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {rows.map(row => (
            <li key={row.nit} className={`py-3 flex flex-wrap items-center justify-between gap-3 ${row.activo ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 break-words">
                  {onOpenProveedor ? (
                    <button type="button" onClick={() => onOpenProveedor(row.nit)} className="hover:underline text-left">
                      {row.nombre || `NIT ${row.nit}`}
                    </button>
                  ) : (
                    row.nombre || `NIT ${row.nit}`
                  )}
                  {!row.activo && <span className="ml-2 text-xs font-normal text-gray-500">(inactivo)</span>}
                </p>
                <p className="text-xs text-gray-500">
                  NIT {row.nit}
                  {row.ciudad ? ` · ${row.ciudad}` : ''}
                  {row.origen ? ` · ${row.origen === 'manual' ? 'añadido a mano' : row.origen === 'odoo_gcp' ? 'de Odoo' : `origen: ${row.origen}`}` : ''}
                  {row.compras_gcp_cop ? ` · compras en Odoo ${formatCopCompact(row.compras_gcp_cop)}` : ''}
                  {row.ventas
                    ? ` · vende ${formatCopCompact(row.ventas.valor)} a ${row.ventas.entidades} entidades (${row.ventas.contratos} contratos, último ${formatFechaGiro(row.ventas.ultimaFecha)})`
                    : ' · sin ventas ortopédicas en SECOP'}
                </p>
              </div>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => toggle(row.nit, !row.activo)}
                className={`min-h-[44px] px-3 rounded-lg border text-sm font-medium disabled:opacity-40 ${
                  row.activo ? 'border-gray-300 text-gray-700 hover:bg-gray-50' : 'border-gray-900 text-gray-900 hover:bg-gray-100'
                }`}
              >
                {saving === row.nit ? 'Guardando…' : row.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
