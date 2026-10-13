'use client'

// Fase 7 · F2: línea de tiempo de una clave de configuración (desde, hasta, valor legible, quién, cuándo, motivo;
// anulados tachados; el valor que rige hoy destacado) y la tarjeta de una clave con su valor de hoy, el cambio
// programado y los botones "Cambiar" e "Historial". Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { useState, type ReactNode } from 'react'
import { valorVigente, type ConfigBase } from '@/lib/visits-rules'
import { Chip, claseBotonChico, claseBotonPrimario } from '@/components/terceros/comun'
import { fechaHora, fechaLarga } from './comun'

export type EstadoVigencia = 'anulado' | 'rige' | 'programado' | 'terminado'

/** Estado de una fila respecto a hoy. */
export function estadoVigencia(fila: Pick<ConfigBase, 'vigente_desde' | 'vigente_hasta' | 'anulado_at'>, hoy: string): EstadoVigencia {
  if (fila.anulado_at) return 'anulado'
  if (fila.vigente_desde > hoy) return 'programado'
  if (fila.vigente_hasta !== null && fila.vigente_hasta < hoy) return 'terminado'
  return 'rige'
}

/** "Desde lunes 12 de octubre de 2026 · sin fecha de fin" o "Del ... al ...". */
export function textoRango(desde: string, hasta: string | null): string {
  if (hasta === null) return `Desde el ${fechaLarga(desde)}, sin fecha de fin`
  if (hasta === desde) return `Solo el ${fechaLarga(desde)}`
  return `Del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`
}

/** Filas ordenadas para la línea de tiempo: la más reciente primero (por inicio y luego por creación). */
export function ordenarLinea<R extends ConfigBase>(filas: readonly R[]): R[] {
  return [...filas].sort((a, b) => {
    if (a.vigente_desde !== b.vigente_desde) return a.vigente_desde < b.vigente_desde ? 1 : -1
    return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  })
}

const CHIP_ESTADO: Record<EstadoVigencia, { texto: string; tono: 'negro' | 'azul' | 'gris' | 'rojo' }> = {
  rige: { texto: 'Rige hoy', tono: 'negro' },
  programado: { texto: 'Programado', tono: 'azul' },
  terminado: { texto: 'Terminado', tono: 'gris' },
  anulado: { texto: 'Anulado', tono: 'rojo' },
}

export function LineaDeTiempo<R extends ConfigBase>({
  filas,
  hoy,
  describir,
  onTerminar,
  puedeTerminar,
}: {
  filas: readonly R[]
  hoy: string
  describir: (fila: R) => string
  /** Terminar (o cancelar, si es futura) una fila activa. */
  onTerminar?: (fila: R) => void
  puedeTerminar?: (fila: R) => boolean
}) {
  if (filas.length === 0) return <p className="text-sm text-gray-500">Todavía no hay valores guardados.</p>
  return (
    <ol className="relative border-l-2 border-gray-200 ml-2 space-y-4">
      {ordenarLinea(filas).map(fila => {
        const estado = estadoVigencia(fila, hoy)
        const anulado = estado === 'anulado'
        const chip = CHIP_ESTADO[estado]
        const terminable =
          Boolean(onTerminar) && !anulado && estado !== 'terminado' && (puedeTerminar ? puedeTerminar(fila) : true)
        return (
          <li key={fila.id} className="ml-4 min-w-0">
            <span
              className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white ${
                estado === 'rige' ? 'bg-gray-900' : estado === 'programado' ? 'bg-blue-500' : anulado ? 'bg-red-300' : 'bg-gray-300'
              }`}
              aria-hidden="true"
            ></span>
            <div
              className={`rounded-lg p-3 min-w-0 ${
                estado === 'rige' ? 'bg-gray-50 border border-gray-900' : 'border border-gray-100'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Chip tono={chip.tono}>{chip.texto}</Chip>
                <span className={`text-sm font-semibold break-words min-w-0 ${anulado ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {describir(fila)}
                </span>
              </div>
              <p className={`mt-1 text-xs ${anulado ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                {textoRango(fila.vigente_desde, fila.vigente_hasta)}
              </p>
              <p className="mt-1 text-xs text-gray-500 break-words">
                {fila.set_by_nombre ? `Por ${fila.set_by_nombre}` : 'Por el sistema'} · {fechaHora(fila.created_at)}
                {fila.motivo ? <> · «{fila.motivo}»</> : null}
              </p>
              {anulado && (
                <p className="mt-1 text-xs text-red-700 break-words">
                  Anulado {fila.anulado_por_nombre ? `por ${fila.anulado_por_nombre} ` : ''}el {fechaHora(fila.anulado_at)}
                  {fila.anulado_motivo ? <> · «{fila.anulado_motivo}»</> : null}
                </p>
              )}
              {terminable && onTerminar && (
                <div className="mt-2">
                  <button type="button" onClick={() => onTerminar(fila)} className={claseBotonChico}>
                    {estado === 'programado' ? 'Cancelar o acortar' : 'Terminar'}
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Tarjeta de una clave (una meta, un subtipo, una persona, un parámetro): el valor que rige hoy, el siguiente
 * cambio programado, "Cambiar" y el historial desplegable.
 */
export function ClaveTarjeta<R extends ConfigBase>({
  titulo,
  subtitulo,
  etiquetas,
  filas,
  hoy,
  describir,
  sinValor,
  ayuda,
  onCambiar,
  textoCambiar = 'Cambiar',
  onTerminar,
  puedeTerminar,
  acciones,
}: {
  titulo: string
  subtitulo?: string
  etiquetas?: ReactNode
  filas: readonly R[]
  hoy: string
  describir: (fila: R) => string
  /** Qué se aplica cuando no hay un valor propio que rija hoy. */
  sinValor: string
  ayuda?: string
  onCambiar?: () => void
  textoCambiar?: string
  onTerminar?: (fila: R) => void
  puedeTerminar?: (fila: R) => boolean
  /** Botones extra (por ejemplo, "Cuota del mes"). */
  acciones?: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const vigente = valorVigente(filas, hoy)
  const programado = filas
    .filter(fila => !fila.anulado_at && fila.vigente_desde > hoy)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? -1 : 1))[0]
  const anulados = filas.filter(fila => fila.anulado_at).length

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 min-w-0 flex flex-col">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-gray-900 break-words">{titulo}</h3>
          {subtitulo && <p className="text-xs text-gray-500 truncate">{subtitulo}</p>}
        </div>
        {etiquetas && <div className="shrink-0 flex flex-wrap justify-end gap-1">{etiquetas}</div>}
      </div>

      <div className="mt-3 min-w-0">
        {vigente ? (
          <>
            <p className="text-base font-semibold text-gray-900 break-words">{describir(vigente)}</p>
            <p className="text-xs text-gray-500">
              {vigente.vigente_hasta === null
                ? `Rige desde el ${fechaLarga(vigente.vigente_desde)}`
                : `Rige del ${fechaLarga(vigente.vigente_desde)} al ${fechaLarga(vigente.vigente_hasta)}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600 break-words">{sinValor}</p>
        )}
        {programado && (
          <p className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 break-words">
            Programado desde el {fechaLarga(programado.vigente_desde)}: {describir(programado)}
          </p>
        )}
        {ayuda && <p className="mt-2 text-xs text-gray-500">{ayuda}</p>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onCambiar && (
          <button type="button" onClick={onCambiar} className={`${claseBotonPrimario} text-sm py-1.5`}>
            {textoCambiar}
          </button>
        )}
        {filas.length > 0 && (
          <button type="button" onClick={() => setAbierto(a => !a)} className={claseBotonChico} aria-expanded={abierto}>
            {abierto ? 'Ocultar historial' : `Historial (${filas.length}${anulados ? `, ${anulados} anulado${anulados === 1 ? '' : 's'}` : ''})`}
          </button>
        )}
        {acciones}
      </div>

      {abierto && (
        <div className="mt-4 min-w-0">
          <LineaDeTiempo filas={filas} hoy={hoy} describir={describir} onTerminar={onTerminar} puedeTerminar={puedeTerminar} />
        </div>
      )}
    </div>
  )
}
