'use client'

// Un día libre en las listas de /calendario (Días libres y Mis días libres): persona, fecha, fracción, motivo,
// nota, estado, si fue fuera de plazo (con su justificación), quién lo registró y quién lo revisó.
import type { ReactNode } from 'react'
import { etiquetaFraccionDiaLibre, type DiaLibreItem } from '@/lib/visits-rules'
import { Chip } from '@/components/terceros/comun'
import { ChipEstadoDiaLibre, conMayuscula, fechaHora, fechaLarga } from '../comun'

export default function DiaLibreTarjeta({
  dia,
  mostrarPersona,
  seleccion,
  acciones,
}: {
  dia: DiaLibreItem
  mostrarPersona: boolean
  seleccion?: { marcado: boolean; onCambiar: (marcado: boolean) => void; deshabilitado?: boolean }
  acciones?: ReactNode
}) {
  const inactivo = dia.estado === 'anulado' || dia.estado === 'rechazado'
  const revision =
    dia.revisado_at && dia.estado !== 'registrado' && dia.estado !== 'por_aprobar'
      ? `${dia.estado === 'aprobado' ? 'Aprobado' : dia.estado === 'rechazado' ? 'Rechazado' : 'Anulado'}${
          dia.revisado_por_nombre ? ` por ${dia.revisado_por_nombre}` : ''
        } el ${fechaHora(dia.revisado_at)}`
      : null

  return (
    <div className="flex items-start gap-3 px-4 py-3 min-w-0">
      {seleccion && (
        <input
          type="checkbox"
          checked={seleccion.marcado}
          disabled={seleccion.deshabilitado}
          onChange={e => seleccion.onCambiar(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-700 disabled:opacity-30"
          aria-label={`Seleccionar el día libre de ${dia.ejecutiva} del ${fechaLarga(dia.fecha)}`}
        />
      )}
      <div className="min-w-0 flex-1">
        {mostrarPersona && (
          <p className="text-sm font-semibold text-gray-900 truncate">
            {dia.ejecutiva}
            {dia.zona ? <span className="font-normal text-gray-500"> · {dia.zona}</span> : null}
          </p>
        )}
        <p className={`text-sm ${mostrarPersona ? 'text-gray-700' : 'font-semibold text-gray-900'} ${inactivo ? 'line-through text-gray-400' : ''}`}>
          {conMayuscula(fechaLarga(dia.fecha))}
        </p>
        <p className="text-xs text-gray-600 mt-0.5 break-words">
          {etiquetaFraccionDiaLibre(dia.fraccion)} · {dia.motivo_nombre || dia.motivo}
          {dia.nota ? <span className="italic"> · {dia.nota}</span> : null}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <ChipEstadoDiaLibre estado={dia.estado} />
          {dia.fuera_de_plazo && <Chip tono="ambar">Registrado fuera de plazo</Chip>}
        </div>
        <p className="text-xs text-gray-500 mt-1.5 break-words">
          Registrado{dia.registrado_por_nombre ? ` por ${dia.registrado_por_nombre}` : ''} el {fechaHora(dia.registrado_at)}
          {dia.fuera_de_plazo && dia.justificacion ? <> · Justificación: «{dia.justificacion}»</> : null}
        </p>
        {revision && (
          <p className="text-xs text-gray-500 mt-0.5 break-words">
            {revision}
            {dia.motivo_revision ? <> · «{dia.motivo_revision}»</> : null}
          </p>
        )}
      </div>
      {acciones && <div className="shrink-0">{acciones}</div>}
    </div>
  )
}
