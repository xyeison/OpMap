/**
 * "¿Qué pasó con esto?" en Hoy (F1b de actividades de campo; C6 y A7 de la spec): lo programado que no se cerró solo
 * —lo atrasado de hoy y lo sin cerrar de días anteriores (porCerrar de lib/pantallas.ts, sin la cita "de ahora", que
 * sigue en "Siguiente")— con lo que se puede hacer según su día (accionesDeCita de lib/agenda-ciclo.ts):
 *   - Reportar: solo lo de hoy (una visita se reporta el mismo día), con su botón: la fila NO se toca (un botón dentro
 *     de otro botón no lo lee VoiceOver ni TalkBack);
 *   - "No se hizo", con su motivo (desde su día, sin tope hacia atrás);
 *   - Cancelar, con su motivo: solo de hoy en adelante (lo de días anteriores se cierra con "No se hizo").
 * Al cerrar o cancelar queda "Anotado…" con "Agendar otra fecha" (A7: otra fecha es una cita nueva enlazada). Se ven
 * MAX_POR_CERRAR_VISIBLES y "Ver todas (n)". Con un servidor sin F1a (conCicloDeVida de lib/persona.ts) Hoy no la
 * muestra. Nunca documentos.
 */
import { useState, type JSX } from 'react'
import { View } from 'react-native'
import { accionesDeCita, mensajeTrasCerrar, origenParaOtraFecha } from '../../lib/agenda-ciclo'
import { fechaCortita } from '../../lib/calendario'
import { diasEntre } from '../../lib/fechas'
import { citaAtrasada, MAX_POR_CERRAR_VISIBLES } from '../../lib/pantallas'
import { conQuienCita } from '../../lib/reglas'
import type { CitaItem, MotivoElegible } from '../../lib/tipos'
import { Aviso, Boton, Grupo, Seccion, Texto } from '../../lib/ui'
import { FilaCita } from '../reporte/FilaCita'
import { FormularioMotivo } from './FormularioMotivo'

type Motivo = { motivo_codigo: MotivoElegible; motivo: string | null }

interface Props {
  /** Lo que espera su resultado (porCerrar), en su orden. */
  citas: readonly CitaItem[]
  hoy: string
  ahora: Date
  /** Reportar la de hoy (Reportar la abre ya elegida). */
  alReportar: (cita: CitaItem) => void
  /** "No se hizo": la cita cerrada, o el mensaje del error. */
  alNoSeHizo: (cita: CitaItem, motivo: Motivo) => Promise<CitaItem | string>
  /** Cancelar: la cita cancelada, o el mensaje del error. */
  alCancelar: (cita: CitaItem, motivo: Motivo) => Promise<CitaItem | string>
  /** "Agendar otra fecha" de una cita ya cerrada. */
  alOtraFecha: (cita: CitaItem) => void
}

/** "ayer" o "12 oct" (lo de hoy no lleva día). */
function textoDia(fecha: string, hoy: string): string | null {
  const dias = diasEntre(fecha, hoy)
  if (dias <= 0) return null
  return dias === 1 ? 'ayer' : fechaCortita(fecha)
}

export function QuePasoConEsto({ citas, hoy, ahora, alReportar, alNoSeHizo, alCancelar, alOtraFecha }: Props): JSX.Element | null {
  const [abierta, setAbierta] = useState<{ id: string; uso: 'cerrar' | 'cancelar' } | null>(null)
  const [hecho, setHecho] = useState<{ cita: CitaItem; uso: 'cerrar' | 'cancelar' } | null>(null)
  const [todas, setTodas] = useState(false)
  if (citas.length === 0 && !hecho) return null

  const visibles = todas ? citas : citas.slice(0, MAX_POR_CERRAR_VISIBLES)
  const enviar = async (cita: CitaItem, uso: 'cerrar' | 'cancelar', motivo: Motivo): Promise<string | null> => {
    const resultado = await (uso === 'cerrar' ? alNoSeHizo(cita, motivo) : alCancelar(cita, motivo))
    if (typeof resultado === 'string') return resultado
    setAbierta(null)
    setHecho({ cita: resultado, uso })
    return null
  }
  const otraFechaDelHecho =
    hecho && origenParaOtraFecha({ estado: hecho.cita.estado, motivo_codigo: hecho.cita.motivo_codigo, tiene_sucesora: !!hecho.cita.sucesora_id }) === null

  return (
    <View style={{ gap: 6 }}>
      <Seccion titulo="¿Qué pasó con esto?" derecha={citas.length > 0 ? `${citas.length}` : undefined} />
      {citas.length > 0 ? (
        <Texto suave peque>
          Lo que agendaste no se cierra solo: cuenta si se hizo o no.
        </Texto>
      ) : null}
      {hecho ? (
        <Aviso
          tono="exito"
          accion={
            <View style={{ gap: 8 }}>
              {otraFechaDelHecho ? <Boton titulo="Agendar otra fecha" variante="secundario" icono="agregar" alPresionar={() => alOtraFecha(hecho.cita)} /> : null}
              <Boton titulo="Listo" variante="texto" alPresionar={() => setHecho(null)} />
            </View>
          }
        >
          {mensajeTrasCerrar(hecho.uso === 'cerrar' ? 'no_se_hizo' : 'cancelar', hecho.cita)}
        </Aviso>
      ) : null}
      <View>
        {visibles.map((cita, i) => {
          const acciones = accionesDeCita(cita, hoy)
          const aqui = abierta?.id === cita.id ? abierta : null
          return (
            <FilaCita
              key={cita.id}
              cita={cita}
              primera={i === 0}
              dia={textoDia(cita.fecha, hoy)}
              atrasada={citaAtrasada(cita, ahora)}
              sinCerrar={cita.fecha < hoy}
            >
              {aqui ? (
                <View style={{ marginTop: 8 }}>
                  <FormularioMotivo
                    uso={aqui.uso}
                    pregunta={aqui.uso === 'cerrar' ? `¿Por qué no se hizo la cita con ${conQuienCita(cita)}?` : `¿Cancelas la cita con ${conQuienCita(cita)}? Queda en tu agenda como cancelada.`}
                    alConfirmar={motivo => enviar(cita, aqui.uso, motivo)}
                    alVolver={() => setAbierta(null)}
                  />
                </View>
              ) : (
                <Grupo estilo={{ marginTop: 8 }}>
                  {acciones.reportar ? <Boton titulo="Reportar" compacto icono="microfono" alPresionar={() => alReportar(cita)} /> : null}
                  {acciones.noSeHizo ? <Boton titulo="No se hizo" variante="secundario" compacto alPresionar={() => setAbierta({ id: cita.id, uso: 'cerrar' })} /> : null}
                  {acciones.cancelar ? <Boton titulo="Cancelar" variante="peligro" compacto alPresionar={() => setAbierta({ id: cita.id, uso: 'cancelar' })} /> : null}
                </Grupo>
              )}
            </FilaCita>
          )
        })}
      </View>
      {citas.length > MAX_POR_CERRAR_VISIBLES ? (
        <Boton titulo={todas ? 'Ver menos' : `Ver todas (${citas.length})`} variante="texto" estilo={{ alignSelf: 'flex-start' }} alPresionar={() => setTodas(!todas)} />
      ) : null}
    </View>
  )
}
