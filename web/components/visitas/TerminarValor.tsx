'use client'

// Fase 7 · F2: terminar un valor de configuración (o cancelar uno programado) con
// POST /api/config-visitas/cerrar { tabla, id, hasta, motivo? } → config_cerrar. Si "hasta" es anterior a su
// inicio, el valor se anula; motivo obligatorio si "hasta" es anterior a hoy. Si ese valor había cortado o
// reemplazado otro al registrarse, en el hueco vuelve a regir el anterior (decisión 12 del contrato); si no, rige
// lo que la pestaña indica en `despues`. La vista previa es local (planearCierre con las filas de la clave, espejo
// de config_cerrar) y dice exactamente qué rige después. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { useState, type FormEvent } from 'react'
import {
  MOTIVO_MINIMO,
  esFechaIso,
  mesesAfectados,
  planearCierre,
  sumarDias,
  type ConfigBase,
  type PlanCierre,
  type TablaConfig,
} from '@/lib/visits-rules'
import {
  AvisoAtencion,
  AvisoError,
  CAPA_MODAL,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
} from '@/components/terceros/comun'
import { CampoMotivo, Modal, conMayuscula, fechaLarga, nombreMes, unirLista } from './comun'
import { textoRango } from './LineaDeTiempo'

export default function TerminarValor<R extends ConfigBase>({
  tabla,
  fila,
  filasTabla,
  hoy,
  describir,
  despues,
  onCerrar,
  onHecho,
  capa = CAPA_MODAL,
}: {
  tabla: TablaConfig
  fila: R
  /** Filas de la tabla (activas y anuladas): de ellas salen las de la misma clave para saber qué vuelve a regir. */
  filasTabla: readonly R[]
  hoy: string
  describir: (fila: R) => string
  /**
   * Qué rige cuando no queda ningún valor de esta clave ni vuelve uno anterior ("el valor por defecto: …",
   * "la meta de su zona o la de toda la empresa"...).
   */
  despues: string
  onCerrar: () => void
  onHecho: (mensaje: string) => void
  capa?: string
}) {
  const futura = fila.vigente_desde > hoy
  const [hasta, setHasta] = useState(hoy)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const filasClave = filasTabla.filter(f => f.clave === fila.clave)
  const fechaValida = esFechaIso(hasta)
  const plan = fechaValida ? planearCierre(fila, { hasta }, hoy, filasClave) : null
  const vuelve = plan?.restaura ? filasClave.find(f => f.id === plan.restaura?.deId) ?? null : null
  const requiereMotivo = fechaValida && hasta < hoy
  const faltaMotivo = requiereMotivo && motivo.trim().length < MOTIVO_MINIMO
  const meses =
    plan?.accion === 'cerrar'
      ? mesesAfectados(sumarDias(hasta, 1), fila.vigente_hasta, hoy)
      : plan?.accion === 'anular'
        ? mesesAfectados(fila.vigente_desde, fila.vigente_hasta, hoy)
        : []
  const puede = Boolean(plan && !plan.error && plan.accion !== 'nada') && !faltaMotivo && !enviando

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!puede || !plan) return
    setEnviando(true)
    setError('')
    try {
      const respuesta = await pedirJson('/api/config-visitas/cerrar', {
        method: 'POST',
        json: { tabla, id: fila.id, hasta, motivo: motivo.trim() || null },
      })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo terminar el valor'))
      const terminado =
        plan.accion === 'anular' ? `Se anuló «${describir(fila)}».` : `«${describir(fila)}» rige hasta el ${fechaLarga(hasta)}.`
      onHecho(vuelve ? `${terminado} Vuelve a regir «${describir(vuelve)}».` : terminado)
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo terminar el valor'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      titulo={futura ? 'Cancelar o acortar un valor programado' : 'Terminar un valor'}
      subtitulo={describir(fila)}
      onCerrar={enviando ? () => undefined : onCerrar}
      ancho="sm:max-w-lg"
      capa={capa}
    >
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-4 flex-1 min-w-0">
          <p className="text-sm text-gray-700 break-words">
            <span className="font-semibold">«{describir(fila)}»</span>: {textoRango(fila.vigente_desde, fila.vigente_hasta).toLowerCase()}.
          </p>
          <div className="min-w-0">
            <label htmlFor="terminar-hasta" className={claseLabel}>
              Último día en que rige <span className="text-red-500">*</span>
            </label>
            <input
              id="terminar-hasta"
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              className={claseInput}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              {futura
                ? 'Una fecha anterior a su inicio lo cancela (queda anulado en el historial). Abajo ves qué rige en su lugar.'
                : 'Abajo ves qué rige desde el día siguiente.'}
            </p>
          </div>

          {plan && (
            <div aria-live="polite" className="space-y-2">
              {plan.error ? (
                <AvisoError>{plan.error}</AvisoError>
              ) : plan.accion === 'nada' ? (
                <AvisoAtencion>No cambia nada: ese valor ya termina antes de esa fecha.</AvisoAtencion>
              ) : plan.accion === 'anular' ? (
                <AvisoAtencion>
                  Se anula: nunca llegará a regir (o deja de haber regido).{' '}
                  {textoQueRige({ desde: fila.vigente_desde, finHueco: fila.vigente_hasta, plan, vuelve, describir, despues })}
                </AvisoAtencion>
              ) : (
                <p className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 break-words">
                  Regirá hasta el {fechaLarga(hasta)}.{' '}
                  {textoQueRige({ desde: sumarDias(hasta, 1), finHueco: fila.vigente_hasta, plan, vuelve, describir, despues })}
                </p>
              )}
              {!plan.error && plan.accion !== 'nada' && (
                <p
                  className={`p-3 rounded-lg border text-sm break-words ${
                    meses.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-800'
                  }`}
                >
                  {meses.length > 0
                    ? `Se recalculan: ${unirLista(meses.map(nombreMes))}.`
                    : 'No se recalcula ningún mes ya transcurrido.'}
                </p>
              )}
            </div>
          )}

          <CampoMotivo
            valor={motivo}
            onCambiar={setMotivo}
            obligatorio={requiereMotivo}
            id="terminar-motivo"
            maximo={500}
            ayuda={requiereMotivo ? 'Obligatorio porque cambia el pasado.' : 'Queda en el historial.'}
          />
          {error && <AvisoError>{error}</AvisoError>}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex justify-end gap-3">
          <button type="button" onClick={onCerrar} disabled={enviando} className={claseBotonSecundario}>
            Volver
          </button>
          <button type="submit" disabled={!puede} className={claseBotonPrimario}>
            {enviando ? 'Guardando...' : plan?.accion === 'anular' ? 'Anular valor' : 'Terminar valor'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Qué rige en el hueco [desde, finHueco] que deja el valor: el anterior que vuelve (hasta donde regía antes) y, si
 * no hay o se acaba antes del hueco, `despues` (el valor por defecto de esa configuración).
 */
function textoQueRige<R extends ConfigBase>({
  desde,
  finHueco,
  plan,
  vuelve,
  describir,
  despues,
}: {
  desde: string
  finHueco: string | null
  plan: PlanCierre
  vuelve: R | null
  describir: (fila: R) => string
  despues: string
}): string {
  const tramo = (inicio: string, fin: string | null) =>
    `${conMayuscula(`desde el ${fechaLarga(inicio)}`)}${fin !== null ? ` y hasta el ${fechaLarga(fin)}` : ''}`
  const restaura = plan.restaura
  if (!restaura || !vuelve) return `${tramo(desde, finHueco)} rige ${despues}.`
  const vuelveTexto = `${tramo(restaura.desde, restaura.hasta)} vuelve a regir el valor anterior: «${describir(vuelve)}».`
  if (restaura.hasta !== null && (finHueco === null || restaura.hasta < finHueco)) {
    return `${vuelveTexto} ${tramo(sumarDias(restaura.hasta, 1), finHueco)} rige ${despues}.`
  }
  return vuelveTexto
}
