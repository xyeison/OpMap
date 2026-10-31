'use client'

import { useState } from 'react'
import type { EmpresaMovil } from '@/lib/reporte-visitas'

// La empresa activa en el menú de OpMap (empresas, capa 1). Sin empresas no pinta nada; con una, solo su nombre corto;
// con varias, un selector. Al cambiar llama a POST /api/auth/empresa y recarga en /inicio con la sesión nueva (la caché
// del navegador y los permisos dependen de la empresa). Si el servidor dice que no, el motivo va debajo, sin diálogos.
export default function SelectorEmpresa({ empresa, empresas }: { empresa: EmpresaMovil | null; empresas: EmpresaMovil[] }) {
  const [cambiando, setCambiando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (empresas.length === 0) return null

  if (empresas.length === 1) {
    return <div className="mt-0.5 truncate text-xs font-medium text-texto">{empresas[0].nombre_corto}</div>
  }

  async function cambiar(empresaId: string) {
    if (!empresaId || empresaId === empresa?.id) return
    setCambiando(true)
    setError(null)
    try {
      const respuesta = await fetch('/api/auth/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ empresa_id: empresaId }),
      })
      if (respuesta.ok) {
        window.location.assign('/inicio')
        return
      }
      const datos = await respuesta.json().catch(() => null)
      setError(typeof datos?.error === 'string' ? datos.error : 'No se pudo cambiar de empresa')
    } catch {
      setError('No se pudo cambiar de empresa. Revisa la conexión.')
    }
    setCambiando(false)
  }

  return (
    <div className="mt-1">
      <select
        aria-label="Empresa activa"
        value={empresa?.id ?? ''}
        disabled={cambiando}
        onChange={event => cambiar(event.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-borde-fuerte bg-relleno px-2 text-sm font-medium text-texto disabled:opacity-60"
      >
        {empresa === null && <option value="" disabled>Elegir empresa</option>}
        {empresas.map(e => (
          <option key={e.id} value={e.id}>{e.nombre_corto}</option>
        ))}
      </select>
      {error && (
        <div role="alert" className="mt-1 text-xs text-peligro">
          {error}
        </div>
      )}
    </div>
  )
}
