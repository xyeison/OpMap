'use client'

// Ficha de la IPS · "Contratos SIA" (spec docs/specs/2026-10-29-agente-sia-observa.md, Fase 1.7): contratos que la IPS
// reportó a SIA Observa, solo de empresas con objeto de las líneas. Por contrato: código, firma, contratista, objeto,
// valor inicial / adiciones / liberaciones / vigente, línea, enlace a la ficha y si cruza con SECOP (con su valor si difiere).
// Datos: GET /api/sia/hospital/[id] (contracts:view). Sin permiso, sin migración (503) o sin contratos: no se pinta nada.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePermissions } from '@/hooks/usePermissions'
import { LineaChip, fechaCorta, pesos } from '@/components/contracts/sia-ui'

interface ContratoSia {
  id: string
  sia_idc: number
  codigo: string | null
  fecha_firma: string | null
  contratista: string | null
  nit_contratista: string
  objeto: string | null
  valor_inicial: number | null
  adiciones: number | null
  liberaciones: number | null
  valor_vigente: number | null
  linea: string
  ficha_url: string
  secop_cruce: string | null
  hospital_contract_id: string | null
  estado_revision: string
  secop: { id: string; valor: number | null; fuente: string; url: string | null } | null
}

const VISIBLES = 5

export default function HospitalSiaCard({ hospitalId }: { hospitalId: string }) {
  const { can, loading: cargandoPermisos } = usePermissions()
  const [contratos, setContratos] = useState<ContratoSia[] | null>(null)
  const [todos, setTodos] = useState(false)
  const puede = !cargandoPermisos && can('contracts:view')

  useEffect(() => {
    if (!puede) return
    let vivo = true
    fetch(`/api/sia/hospital/${hospitalId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => vivo && setContratos(data?.contratos ?? null))
      .catch(() => vivo && setContratos(null))
    return () => {
      vivo = false
    }
  }, [hospitalId, puede])

  if (!puede || !contratos || contratos.length === 0) return null
  const lista = todos ? contratos : contratos.slice(0, VISIBLES)

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Contratos SIA</h2>
          <p className="text-sm text-gray-500 mt-1">Reportados a SIA Observa (Auditoría General) · empresas con objeto de las líneas</p>
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{contratos.length} contratos</span>
      </div>
      <div className="divide-y divide-gray-100">
        {lista.map(c => {
          const difSecop = c.secop && c.secop.valor !== null && c.valor_vigente !== null && Math.abs(c.secop.valor - c.valor_vigente) >= 1
          return (
            <div key={c.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {c.codigo ?? `idc ${c.sia_idc}`} <span className="font-normal text-gray-500">· firma {fechaCorta(c.fecha_firma)}</span>
                </p>
                <div className="flex items-center gap-3">
                  <LineaChip linea={c.linea} />
                  {c.hospital_contract_id ? (
                    <Link href={`/contracts/${c.hospital_contract_id}`} className="text-xs text-gray-700 underline">
                      En Contratos
                    </Link>
                  ) : c.estado_revision === 'descartado' ? (
                    <span className="text-xs text-gray-400">Descartado</span>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-gray-900 break-words">
                {c.contratista} <span className="text-gray-500">· NIT {c.nit_contratista}</span>
              </p>
              {c.objeto && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.objeto}</p>}
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Inicial</span>
                  <p className="text-gray-900">{pesos(c.valor_inicial)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Adiciones</span>
                  <p className="text-gray-900">{pesos(c.adiciones)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Liberaciones</span>
                  <p className="text-gray-900">{pesos(c.liberaciones)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Vigente</span>
                  <p className="font-semibold text-gray-900">{pesos(c.valor_vigente)}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <a href={c.ficha_url} target="_blank" rel="noopener noreferrer" className="text-gray-700 underline">
                  Ver ficha en SIA
                </a>
                {c.secop ? (
                  <span className="text-gray-600">
                    Cruza con SECOP{c.secop_cruce === 'contratista_fecha' ? ' (por contratista y fecha)' : ''}
                    {difSecop && <span className="text-amber-700"> · valor en SECOP {pesos(c.secop.valor)}</span>}
                    {c.secop.url && (
                      <>
                        {' · '}
                        <a href={c.secop.url} target="_blank" rel="noopener noreferrer" className="underline">
                          ver
                        </a>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">No cruza con SECOP</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {contratos.length > VISIBLES && (
        <button type="button" onClick={() => setTodos(v => !v)} className="mt-3 text-sm text-gray-700 underline">
          {todos ? 'Ver menos' : `Ver los ${contratos.length}`}
        </button>
      )}
    </div>
  )
}
