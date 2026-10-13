'use client'

// Fase 7 · F2: el ÚNICO formulario de cambio de configuración (metas, qué cuenta, personas y general).
// Valor nuevo (lo pinta `editor`), "Rige desde" (por defecto hoy), "Hasta" opcional y motivo (obligatorio si
// "Rige desde" es anterior a hoy). Antes de habilitar "Guardar" pide la VISTA PREVIA al servidor
// (POST /api/config-visitas/vista-previa → { plan, meses_recalculados }) y muestra qué valor se corta, cuál se
// anula, cuál continúa después de un valor temporal y qué meses se recalculan. Guarda con
// POST /api/config-visitas/cambios → 201 { id, meses_recalculados } (400 validación o motivo; 409 superposición).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (secciones "API" e "Interfaz").
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { cambioConfigSchema } from '@/lib/visits-config-schemas'
import {
  MENSAJE_MOTIVO_PASADO,
  MOTIVO_MINIMO,
  claveConfig,
  esFechaIso,
  mesesAfectados,
  planearCambio,
  sumarDias,
  type CambioConfigResponse,
  type ConfigBase,
  type PlanCambio,
  type TablaConfig,
  type VistaPreviaResponse,
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
  primerErrorZod,
  useDemorado,
} from '@/components/terceros/comun'
import { CampoMotivo, Modal, conMayuscula, fechaLarga, nombreMes, unirLista } from './comun'
import { textoRango } from './LineaDeTiempo'

type Vista =
  | { firma: string; plan: PlanCambio; meses: string[]; error?: undefined }
  | { firma: string; error: string; plan?: undefined; meses?: undefined }

interface Props<V, R extends ConfigBase> {
  titulo: string
  subtitulo?: string
  tabla: TablaConfig
  /** Fecha de hoy en Bogotá (la que trae GET /api/config-visitas). */
  hoy: string
  /** Todas las filas de la tabla (para describir lo que se corta o se anula). */
  filasTabla: readonly R[]
  describir: (fila: R) => string
  /** Estado inicial del editor del valor. */
  inicial: V
  /** Dibuja el editor del valor nuevo. */
  editor: (valor: V, onCambiar: (valor: V) => void) => ReactNode
  /** Convierte el estado del editor en `valores` para la API, o devuelve un mensaje si falta algo. */
  construir: (valor: V) => Record<string, unknown> | string
  /** El valor nuevo en palabras (para la vista previa). */
  resumen?: (valor: V) => string
  /** Fecha inicial de "Rige desde" (por defecto, hoy). */
  desdeInicial?: string
  onCerrar: () => void
  onGuardado: (respuesta: CambioConfigResponse) => void
  capa?: string
}

export default function FormularioCambio<V, R extends ConfigBase>({
  titulo,
  subtitulo,
  tabla,
  hoy,
  filasTabla,
  describir,
  inicial,
  editor,
  construir,
  resumen,
  desdeInicial,
  onCerrar,
  onGuardado,
  capa = CAPA_MODAL,
}: Props<V, R>) {
  const [valor, setValor] = useState<V>(inicial)
  const [desde, setDesde] = useState(desdeInicial ?? hoy)
  const [hasta, setHasta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [vista, setVista] = useState<Vista | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const turno = useRef(0)

  // Cuerpo del cambio, validado aquí con el mismo esquema de la API (mensajes en español).
  const valores = construir(valor)
  let errorLocal = ''
  let cuerpo: Record<string, unknown> | null = null
  if (typeof valores === 'string') {
    errorLocal = valores
  } else if (!esFechaIso(desde)) {
    errorLocal = 'Escribe desde cuándo rige el valor'
  } else {
    const validacion = cambioConfigSchema.safeParse({
      tabla,
      valores,
      desde,
      hasta: hasta || null,
      motivo: motivo.trim() || null,
    })
    if (validacion.success) cuerpo = validacion.data as unknown as Record<string, unknown>
    else errorLocal = primerErrorZod(validacion.error)
  }
  // La vista previa va SIN la clave "motivo": así la API muestra el plan y los meses antes de que escriban el
  // motivo (el motivo lo exige aquí `faltaMotivo` y, al guardar, la base). Escribir el motivo no repite la vista previa.
  const cuerpoVista = cuerpo ? (({ motivo: _motivo, ...resto }) => resto)(cuerpo) : null
  const firma = cuerpoVista ? JSON.stringify(cuerpoVista) : ''
  const firmaDemorada = useDemorado(firma, 400)

  useEffect(() => {
    if (!firmaDemorada) {
      setVista(null)
      return
    }
    const miTurno = ++turno.current
    const pedir = async () => {
      try {
        // Cuerpo sin "motivo" (ver cuerpoVista).
        const respuesta = await pedirJson('/api/config-visitas/vista-previa', { method: 'POST', json: JSON.parse(firmaDemorada) })
        if (miTurno !== turno.current) return
        if (!respuesta.ok) {
          setVista({ firma: firmaDemorada, error: mensajeError(respuesta, 'No se pudo revisar el cambio') })
          return
        }
        const data = respuesta.data as VistaPreviaResponse | null
        if (!data || !data.plan) {
          setVista({ firma: firmaDemorada, error: 'La vista previa llegó vacía. Inténtalo de nuevo.' })
          return
        }
        setVista({ firma: firmaDemorada, plan: data.plan, meses: Array.isArray(data.meses_recalculados) ? data.meses_recalculados : [] })
      } catch (err) {
        if (miTurno !== turno.current) return
        setVista({ firma: firmaDemorada, error: mensajeExcepcion(err, 'No se pudo revisar el cambio') })
      }
    }
    pedir()
  }, [firmaDemorada])

  const requiereMotivo = esFechaIso(desde) && desde < hoy
  const faltaMotivo = requiereMotivo && motivo.trim().length < MOTIVO_MINIMO
  const vistaAlDia = vista !== null && vista.firma === firma && firma !== ''
  const revisando = firma !== '' && !vistaAlDia
  const planOk = vistaAlDia && !vista.error && vista.plan !== undefined && !vista.plan.error
  const puedeGuardar = planOk && !faltaMotivo && !guardando

  // Filas de la misma clave (para la vista previa local cuando solo falta el motivo).
  const filasClave =
    typeof valores === 'string' ? [] : filasTabla.filter(fila => fila.clave === claveConfig(tabla, valores))

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!puedeGuardar || !cuerpo) return
    setGuardando(true)
    setErrorGuardar('')
    try {
      const respuesta = await pedirJson('/api/config-visitas/cambios', { method: 'POST', json: cuerpo })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo guardar el cambio'))
      const data = (respuesta.data ?? {}) as Partial<CambioConfigResponse>
      onGuardado({ id: String(data.id ?? ''), meses_recalculados: Array.isArray(data.meses_recalculados) ? data.meses_recalculados : [] })
    } catch (err) {
      setErrorGuardar(mensajeExcepcion(err, 'No se pudo guardar el cambio'))
    } finally {
      setGuardando(false)
    }
  }

  let razonBloqueo = ''
  if (errorLocal) razonBloqueo = 'Completa el valor para ver la vista previa.'
  else if (revisando) razonBloqueo = 'Revisando el cambio...'
  else if (vistaAlDia && (vista.error || vista.plan?.error)) razonBloqueo = 'Corrige lo indicado en la vista previa para guardar.'
  else if (faltaMotivo) razonBloqueo = 'Escribe el motivo para guardar.'

  return (
    <Modal titulo={titulo} subtitulo={subtitulo} onCerrar={guardando ? () => undefined : onCerrar} ancho="sm:max-w-2xl" capa={capa}>
      <form onSubmit={guardar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-5 flex-1 min-w-0">
          <section className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Valor nuevo</h3>
            {editor(valor, setValor)}
          </section>

          <section className="space-y-3 min-w-0">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Vigencia</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label htmlFor="cambio-desde" className={claseLabel}>
                  Rige desde <span className="text-red-500">*</span>
                </label>
                <input
                  id="cambio-desde"
                  type="date"
                  value={desde}
                  onChange={e => setDesde(e.target.value)}
                  className={claseInput}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  {esFechaIso(desde) ? conMayuscula(fechaLarga(desde)) : 'Elige una fecha'}
                  {desde === hoy ? ' (hoy)' : ''}
                </p>
              </div>
              <div className="min-w-0">
                <label htmlFor="cambio-hasta" className={claseLabel}>
                  Hasta <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="flex gap-2 min-w-0">
                  <input
                    id="cambio-hasta"
                    type="date"
                    value={hasta}
                    min={esFechaIso(desde) ? desde : undefined}
                    onChange={e => setHasta(e.target.value)}
                    className={claseInput}
                  />
                  {hasta && (
                    <button type="button" onClick={() => setHasta('')} className={`${claseBotonSecundario} shrink-0 px-3`}>
                      Quitar
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {hasta && esFechaIso(hasta)
                    ? `${conMayuscula(fechaLarga(hasta))}. Al terminar vuelve a regir el valor anterior.`
                    : 'Vacío: rige hasta el siguiente cambio programado o indefinidamente.'}
                </p>
              </div>
            </div>
            {requiereMotivo && (
              <AvisoAtencion>
                Este cambio empieza antes de hoy: corrige el pasado. Hace falta un motivo y se recalculan los meses que
                indica la vista previa.
              </AvisoAtencion>
            )}
            <CampoMotivo
              valor={motivo}
              onCambiar={setMotivo}
              obligatorio={requiereMotivo}
              id="cambio-motivo"
              maximo={500}
              ayuda={requiereMotivo ? `Al menos ${MOTIVO_MINIMO} caracteres. Queda en el historial con tu nombre y la fecha.` : 'Queda en el historial con tu nombre y la fecha.'}
            />
          </section>

          <section className="space-y-2 min-w-0" aria-live="polite">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Vista previa</h3>
            {errorLocal ? (
              <p className="text-sm text-gray-600">{errorLocal}</p>
            ) : revisando ? (
              <p className="text-sm text-gray-500">Revisando qué cambia...</p>
            ) : vistaAlDia && vista.error ? (
              <AvisoError>{vista.error}</AvisoError>
            ) : vistaAlDia && vista.plan ? (
              vista.plan.error === MENSAJE_MOTIVO_PASADO ? (
                <>
                  <AvisoAtencion>{vista.plan.error}. Así quedaría al guardar:</AvisoAtencion>
                  <DetallePlan
                    plan={planearCambio(filasClave, { desde, hasta: hasta || null }, hoy)}
                    meses={null}
                    desde={desde}
                    hoy={hoy}
                    filas={filasTabla}
                    describir={describir}
                    resumenNuevo={resumen ? resumen(valor) : null}
                  />
                </>
              ) : vista.plan.error ? (
                <AvisoError>{vista.plan.error}</AvisoError>
              ) : (
                <DetallePlan
                  plan={vista.plan}
                  meses={vista.meses ?? []}
                  desde={desde}
                  hoy={hoy}
                  filas={filasTabla}
                  describir={describir}
                  resumenNuevo={resumen ? resumen(valor) : null}
                />
              )
            ) : (
              <p className="text-sm text-gray-500">Revisando qué cambia...</p>
            )}
          </section>

          {errorGuardar && <AvisoError>{errorGuardar}</AvisoError>}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
          {razonBloqueo && !guardando && <p className="text-xs text-gray-500 sm:mr-auto">{razonBloqueo}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button type="submit" disabled={!puedeGuardar} className={claseBotonPrimario}>
              {guardando ? 'Guardando...' : 'Guardar cambio'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/** Qué hace el cambio: valor nuevo, cortes, anulaciones, continuaciones y meses que se recalculan. */
function DetallePlan<R extends ConfigBase>({
  plan,
  meses,
  desde,
  hoy,
  filas,
  describir,
  resumenNuevo,
}: {
  plan: PlanCambio
  /** Meses del servidor; null = calcularlos aquí (vista previa local). */
  meses: string[] | null
  desde: string
  hoy: string
  filas: readonly R[]
  describir: (fila: R) => string
  resumenNuevo: string | null
}) {
  const fila = (id: string) => filas.find(f => f.id === id)
  const texto = (id: string) => {
    const encontrada = fila(id)
    return encontrada ? `«${describir(encontrada)}»` : 'El valor anterior'
  }
  const mesesRecalculados = meses ?? mesesAfectados(desde, plan.hastaEfectivo, hoy)
  const sinCambiosPrevios = plan.anular.length === 0 && plan.cortar.length === 0

  return (
    <ul className="space-y-2 text-sm text-gray-800">
      <li className="p-3 rounded-lg bg-gray-50 border border-gray-200 break-words">
        <span className="font-semibold">Valor nuevo{resumenNuevo ? `: «${resumenNuevo}»` : ''}.</span>{' '}
        {textoRango(desde, plan.hastaEfectivo)}.
        {plan.hastaEfectivo !== null && (
          <span className="block text-xs text-gray-600 mt-1">
            El {fechaLarga(sumarDias(plan.hastaEfectivo, 1))} empieza el valor siguiente.
          </span>
        )}
      </li>
      {plan.cortar.map(corte => {
        const original = fila(corte.id)
        return (
          <li key={`cortar-${corte.id}`} className="p-3 rounded-lg bg-amber-50 border border-amber-200 break-words">
            <span className="font-semibold">Se corta:</span> {texto(corte.id)}
            {original ? ` (${textoRango(original.vigente_desde, original.vigente_hasta).toLowerCase()})` : ''} ahora termina el{' '}
            {fechaLarga(corte.vigente_hasta)}.
          </li>
        )
      })}
      {plan.anular.map(id => (
        <li key={`anular-${id}`} className="p-3 rounded-lg bg-red-50 border border-red-200 break-words">
          <span className="font-semibold">Se anula:</span> {texto(id)} empezaba el mismo día; queda tachado en el historial.
        </li>
      ))}
      {plan.continuar.map(continuacion => (
        <li key={`continuar-${continuacion.deId}`} className="p-3 rounded-lg bg-blue-50 border border-blue-200 break-words">
          <span className="font-semibold">Continúa después:</span> {texto(continuacion.deId)} vuelve a regir{' '}
          {textoRango(continuacion.vigente_desde, continuacion.vigente_hasta).toLowerCase()}.
        </li>
      ))}
      {sinCambiosPrevios && <li className="text-gray-600">No cambia ningún valor anterior.</li>}
      <li
        className={`p-3 rounded-lg border break-words ${
          mesesRecalculados.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-green-50 border-green-200 text-green-800'
        }`}
      >
        {mesesRecalculados.length > 0
          ? `Se recalculan: ${unirLista(mesesRecalculados.map(nombreMes))}.`
          : 'No se recalcula ningún mes: el cambio empieza hoy o después.'}
      </li>
    </ul>
  )
}
