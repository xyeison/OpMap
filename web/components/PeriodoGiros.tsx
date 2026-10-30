'use client'

// Selector "Período" de /inteligencia (giros), spec 2026-10-29-giros-variaciones: últimos 3, 6 o 12 meses, todo lo
// cargado, cada año con datos, o "Personalizado" con mes y año en listas. Reemplaza los <input type="month">: cada
// navegador los pinta distinto y cambiar el año costaba (dueño, 2026-10-29). Solo deja elegir meses con datos.
import {
  aniosDisponibles,
  ajustarAlDisponible,
  mesesDelAnio,
  opcionesPeriodo,
  PERIODO_PERSONALIZADO,
  rangoDePeriodo,
  type MesesDisponibles,
} from '@/lib/periodo-giros'

const SELECT = 'rounded-lg border border-gray-300 px-3 py-2 bg-white'

export interface CambioPeriodo {
  periodo: string
  desde: string
  hasta: string
}

/** Mes y año de un extremo del rango personalizado. */
function MesAnio({ etiqueta, valor, disponible, onCambiar }: { etiqueta: string; valor: string; disponible: MesesDisponibles; onCambiar: (mes: string) => void }) {
  const anio = Number(valor.slice(0, 4))
  return (
    <div className="text-sm" role="group" aria-label={etiqueta}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{etiqueta}</span>
      <div className="flex gap-2">
        <select aria-label={`${etiqueta}: mes`} value={valor} onChange={event => onCambiar(event.target.value)} className={`${SELECT} flex-1 min-w-0`}>
          {mesesDelAnio(anio, disponible).map(mes => (
            <option key={mes.mes} value={mes.mes} disabled={!mes.habilitado}>
              {mes.etiqueta}
            </option>
          ))}
        </select>
        <select
          aria-label={`${etiqueta}: año`}
          value={anio}
          onChange={event => onCambiar(ajustarAlDisponible(`${event.target.value}-${valor.slice(5, 7)}`, disponible))}
          className={`${SELECT} w-[5.5rem] shrink-0`}
        >
          {aniosDisponibles(disponible).map(item => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/**
 * El selector y, con "Personalizado", Desde y Hasta. `desde`/`hasta` son el rango que se está mostrando (el que
 * devolvió la API); sin `disponible` (aún no hay respuesta) el selector espera apagado.
 */
export default function PeriodoGiros({
  disponible,
  periodo,
  desde,
  hasta,
  onCambiar,
}: {
  disponible: MesesDisponibles | null
  periodo: string
  desde: string | null
  hasta: string | null
  onCambiar: (cambio: CambioPeriodo) => void
}) {
  const elegir = (valor: string) => {
    if (!disponible) return
    const rango = rangoDePeriodo(valor, disponible)
    if (rango) onCambiar({ periodo: valor, ...rango })
    else
      onCambiar({
        periodo: PERIODO_PERSONALIZADO,
        // El rango por defecto de la API puede empezar antes del primer mes con datos (fuente con menos de 12 meses)
        desde: ajustarAlDisponible(desde ?? disponible.min, disponible),
        hasta: ajustarAlDisponible(hasta ?? disponible.max, disponible),
      })
  }

  return (
    <>
      <label className="text-sm">
        <span className="block text-xs font-medium text-gray-600 mb-1">Período</span>
        <select value={periodo} onChange={event => elegir(event.target.value)} disabled={!disponible} className={`${SELECT} w-full disabled:opacity-60`}>
          {(disponible ? opcionesPeriodo(disponible) : [{ valor: periodo, etiqueta: 'Cargando…' }]).map(opcion => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      {periodo === PERIODO_PERSONALIZADO && disponible && desde && hasta && (
        <>
          <MesAnio
            etiqueta="Desde"
            valor={desde}
            disponible={disponible}
            onCambiar={mes => onCambiar({ periodo: PERIODO_PERSONALIZADO, desde: mes, hasta: mes > hasta ? mes : hasta })}
          />
          <MesAnio
            etiqueta="Hasta"
            valor={hasta}
            disponible={disponible}
            onCambiar={mes => onCambiar({ periodo: PERIODO_PERSONALIZADO, desde: mes < desde ? mes : desde, hasta: mes })}
          />
        </>
      )}
    </>
  )
}
