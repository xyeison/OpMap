'use client'

// Ficha de la IPS · tarjeta "Procesos publicados sin contrato (SECOP II)" (radar comercial, spec
// docs/specs/2026-10-25-secop-procesos-radar.md; decisión docs/decisiones/2026-10-25-procesos-secop-radar-comercial.md).
// Datos: GET /api/secop/hospital/[id]/procesos (permiso secop:procesos: los roles con intelligence:view y los Ejecutivos
// Comerciales). Va aparte de "Contratación pública (SECOP)": un proceso no es una compra.
//   - Por proceso: el proveedor que FIGURA (empresa con NIT o nombre; "según el título del proceso" si sale del título;
//     persona natural sin nombre; "Proveedor no publicado" si no figura nadie), el precio base de la convocatoria, la
//     fecha de publicación, la referencia, las líneas y "Ver proceso" (expediente en SECOP).
//   - El precio base se muestra proceso por proceso y NUNCA se suma (ni entre procesos ni con las compras).
//   - 5 filas visibles y "Ver los N"; la ruta manda como máximo 50 (los más recientes) y `total` los cuenta todos.
//   - Sin procesos (total 0), sin permiso, mientras carga o si la ruta falla: no se pinta nada.
import { useEffect, useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCopCompact, formatFechaGiro } from '@/lib/giros-format'
import { SECOP_VENTANA_MESES, lineaColor, lineaLabel } from '@/lib/compras-publicas'
import { MAPA_DETALLE_TEXTOS, PROCESOS_FICHA_VISIBLES } from '@/lib/mapa-detalle'
import type { ProcesoDetalle, ProcesosDetalle } from '@/lib/types/mapa-detalle'

const T = MAPA_DETALLE_TEXTOS
/** Rótulo del proveedor: el que figura en el proceso, nunca "el adjudicado" (en régimen especial no hay adjudicación). */
const PROVEEDOR_FIGURA = 'Proveedor que figura'

function LineaChip({ linea }: { linea: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 whitespace-nowrap">
      <span className="inline-block w-2 h-2 rounded-sm" style={{ background: lineaColor(linea) }} />
      {lineaLabel(linea)}
    </span>
  )
}

function Proveedor({ proceso }: { proceso: ProcesoDetalle }) {
  const { proveedor } = proceso
  if (proveedor) {
    const mostrarNit = proveedor.nit !== null && proveedor.nombre !== `NIT ${proveedor.nit}`
    return (
      <p className="text-sm text-gray-900 break-words">
        <span className="text-gray-500">{PROVEEDOR_FIGURA}: </span>
        <span className="font-medium">{proveedor.nombre}</span>
        {mostrarNit && <span className="text-gray-500"> · NIT {proveedor.nit}</span>}
        {proveedor.origen === 'titulo' && <span className="text-gray-500"> · {T.proveedorTitulo}</span>}
        {proveedor.vigilado && (
          <>
            {' '}
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">
              Vigilado
            </span>
          </>
        )}
      </p>
    )
  }
  if (proceso.proveedorPersona) {
    return (
      <p className="text-sm text-gray-900 break-words">
        <span className="text-gray-500">{PROVEEDOR_FIGURA}: </span>
        {T.proveedorPersona}
      </p>
    )
  }
  return <p className="text-sm text-gray-500 break-words">{T.proveedorNoPublicado}</p>
}

function FilaProceso({ proceso }: { proceso: ProcesoDetalle }) {
  const detalle = [
    proceso.fechaPublicacion ? `Publicado el ${formatFechaGiro(proceso.fechaPublicacion)}` : null,
    proceso.referencia ? `Ref. ${proceso.referencia}` : null,
  ].filter(Boolean)
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Proveedor proceso={proceso} />
          {detalle.length > 0 && <p className="text-xs text-gray-500 mt-0.5 break-words">{detalle.join(' · ')}</p>}
          {proceso.lineas.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {proceso.lineas.map(linea => (
                <LineaChip key={linea} linea={linea} />
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {proceso.precioBase !== null ? (
            <>
              <p className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">{formatCopCompact(proceso.precioBase)}</p>
              <p className="text-xs text-gray-500 whitespace-nowrap">precio base</p>
            </>
          ) : (
            <p className="text-xs text-gray-500 whitespace-nowrap">Precio base no publicado</p>
          )}
        </div>
      </div>
      {proceso.url && (
        <a
          href={proceso.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center min-h-[44px] text-xs font-medium text-blue-700 hover:underline"
        >
          {T.verProceso}
        </a>
      )}
    </li>
  )
}

export default function HospitalProcesosCard({ hospitalId }: { hospitalId: string }) {
  const { can, loading: permsLoading } = usePermissions()
  const allowed = can('secop:procesos')
  const [data, setData] = useState<ProcesosDetalle | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    setData(null)
    setVerTodos(false)
    fetch(`/api/secop/hospital/${encodeURIComponent(hospitalId)}/procesos`, { cache: 'no-store' })
      .then(async response => {
        // 403, 404, 5xx: la tarjeta no aparece (la de contratación pública ya informa sus propios errores)
        if (!response.ok) return
        const body = (await response.json().catch(() => null)) as ProcesosDetalle | null
        if (!cancelled && body && Array.isArray(body.procesos)) setData(body)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [hospitalId, allowed])

  if (permsLoading || !allowed || !data || data.total === 0 || data.procesos.length === 0) return null

  const visibles = verTodos ? data.procesos : data.procesos.slice(0, PROCESOS_FICHA_VISIBLES)

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 mb-8">
      <div className="min-w-0 mb-3">
        <h2 className="text-xl font-bold text-gray-900">{T.tituloProcesos}</h2>
        <p className="text-sm text-gray-500 mt-1 break-words">
          Últimos {SECOP_VENTANA_MESES} meses ({data.ventana.texto}) · {data.total.toLocaleString('es-CO')} {data.total === 1 ? 'proceso' : 'procesos'}
        </p>
      </div>
      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mb-2 break-words">{T.notaProcesos}</p>

      <ul className="divide-y divide-gray-100">
        {visibles.map(proceso => (
          <FilaProceso key={proceso.id} proceso={proceso} />
        ))}
      </ul>

      {data.procesos.length > PROCESOS_FICHA_VISIBLES && (
        <button
          type="button"
          onClick={() => setVerTodos(v => !v)}
          className="mt-2 min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {verTodos ? 'Ver menos' : `Ver los ${data.procesos.length}`}
        </button>
      )}
      {data.total > data.procesos.length && (
        <p className="text-xs text-gray-500 mt-2">
          Se muestran los {data.procesos.length} más recientes de {data.total.toLocaleString('es-CO')}.
        </p>
      )}
    </div>
  )
}
