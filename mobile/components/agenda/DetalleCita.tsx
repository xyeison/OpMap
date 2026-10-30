/**
 * Detalle de una cita en Mi agenda, ahí mismo en la línea del día (spec 2026-10-15; F1b de actividades de campo, A7):
 * con quién, la hora y el día, su estado ("Programada", "Atrasada", "Sin cerrar", "Hecha", "No se hizo", "Cancelada"),
 * de qué cita viene ("Viene de la cita del 12 oct · No se hizo") y si ya tiene otra fecha, el motivo de la cerrada, la
 * sede (y la cuenta si dice algo más), la nota completa y si cuenta como agendada. Lo que se puede hacer depende de su
 * estado y su día (accionesDeCita de lib/agenda-ciclo.ts, espejo del servidor):
 *   - Reportar (la pendiente de hoy) y "Ver la visita" (la hecha);
 *   - "No se hizo" (desde su día) y Cancelar (de hoy en adelante), las dos con motivo de la lista (FormularioMotivo);
 *   - "Agendar otra fecha" (cerrada y sin otra fecha; la hecha solo si su visita no fue efectiva);
 *   - "Eliminar: lo agendé por error" (pendiente de hoy en adelante), con una pregunta antes.
 * Lo programado no se mueve de fecha: no hay "Mover" ni "Reprogramar". Cerrar o cancelar no borra: la cita queda en la
 * agenda con su estado (la pregunta de cancelar la arma la pantalla). Nunca documentos ni teléfonos.
 */
import { useState, type JSX } from 'react'
import { View } from 'react-native'
import { accionesDeCita, estadoVisible, textoMotivoDeCierre, textoVieneDe } from '../../lib/agenda-ciclo'
import { fechaLarga } from '../../lib/fechas'
import { ETIQUETA_COMO } from '../../lib/persona'
import { conQuienCita, cuentaDistinta, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_ESTADO_VISIBLE, ETIQUETA_TIPO_VISITA, type CitaItem, type EstadoVisible, type MotivoElegible } from '../../lib/tipos'
import { Boton, Grupo, Insignia, Tarjeta, Texto, confirmar, useColores, type Tono } from '../../lib/ui'
import { FormularioMotivo } from './FormularioMotivo'

/** El color de cada estado visible: hecha en verde, lo que espera su resultado en ámbar, lo cerrado sin visita en rojo. */
export const TONO_ESTADO_VISIBLE: Record<EstadoVisible, Tono> = {
  programada: 'neutro',
  atrasada: 'alerta',
  sin_cerrar: 'alerta',
  hecha: 'exito',
  no_realizada: 'peligro',
  cancelada: 'peligro',
  eliminada: 'neutro',
}

type Motivo = { motivo_codigo: MotivoElegible; motivo: string | null }

interface Props {
  cita: CitaItem
  /** Hoy en Bogotá: lo que se puede hacer depende del día de la cita. */
  hoy: string
  /** Reloj del estado visible (Atrasada, Sin cerrar). */
  ahora?: Date
  /** Reportar la pendiente de hoy (Reportar la abre ya elegida). */
  alReportar?: () => void
  /** "Ver la visita" (solo si la cita ya tiene su visita). */
  alVerVisita?: () => void
  /** "No se hizo" con el motivo: null si se cerró, o el mensaje del error. Sin esto no se ofrece. */
  alNoSeHizo?: (motivo: Motivo) => Promise<string | null>
  /** La pregunta antes de cancelar ("¿Cancelas la cita con …? Queda en tu agenda como cancelada."). */
  preguntaCancelar: string
  /** Cancela con el motivo (obligatorio, A8): null si se canceló, o el mensaje del error. Sin esto no se ofrece. */
  alCancelar?: (motivo: Motivo) => Promise<string | null>
  /** Elimina por error: null si se eliminó, o el mensaje del error. Sin esto no se ofrece. */
  alEliminar?: () => Promise<string | null>
  /** "Agendar otra fecha" (abre Agendar con la cita). Sin esto no se ofrece. */
  alOtraFecha?: () => void
  /** Si está hecha: ¿su visita fue efectiva? null o sin el dato: no se sabe (y no se ofrece otra fecha). */
  visitaEfectiva?: boolean | null
  /** Mostrar "Como líder" / "Como Ejecutivo Comercial" (solo a quien tiene los dos papeles). */
  conComo?: boolean
  /** Oculta el detalle. */
  alOcultar: () => void
}

export function DetalleCita({
  cita,
  hoy,
  ahora,
  alReportar,
  alVerVisita,
  alNoSeHizo,
  preguntaCancelar,
  alCancelar,
  alEliminar,
  alOtraFecha,
  visitaEfectiva = null,
  conComo,
  alOcultar,
}: Props): JSX.Element {
  const c = useColores()
  const [abierto, setAbierto] = useState<'cerrar' | 'cancelar' | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
  const visible = estadoVisible(cita, ahora ?? new Date())
  const acciones = accionesDeCita(cita, hoy, visitaEfectiva)
  const vieneDe = textoVieneDe(cita)
  const motivo = textoMotivoDeCierre(cita)

  const abrir = (cual: 'cerrar' | 'cancelar') => {
    setAbierto(cual)
    setError(null)
  }

  const enviar = async (accion: (m: Motivo) => Promise<string | null>, m: Motivo): Promise<string | null> => {
    const fallo = await accion(m)
    if (!fallo) setAbierto(null)
    return fallo
  }

  const eliminar = async () => {
    if (!alEliminar) return
    const si = await confirmar(
      'Eliminar la cita',
      `¿Agendaste por error la cita con ${conQuienCita(cita)}? Se quita de tu agenda y no cuenta en tus números. Si solo no se va a hacer, cancélala con su motivo.`,
      'Eliminar',
      true
    )
    if (!si) return
    setEliminando(true)
    setError(null)
    const fallo = await alEliminar()
    setEliminando(false)
    if (fallo) setError(fallo)
  }

  return (
    <Tarjeta estilo={{ gap: 10, borderColor: c.acento, borderWidth: 2 }}>
      <View style={{ gap: 2 }}>
        <Texto negrita>{conQuienCita(cita)}</Texto>
        <Texto suave peque>
          {`${textoHoraCita(cita.hora)} · ${fechaLarga(cita.fecha)}`}
        </Texto>
      </View>
      <Grupo>
        <Insignia texto={ETIQUETA_TIPO_VISITA[cita.tipo]} />
        <Insignia texto={ETIQUETA_ESTADO_VISIBLE[visible]} tono={TONO_ESTADO_VISIBLE[visible]} />
        {conComo ? <Insignia texto={ETIQUETA_COMO[cita.como]} tono="info" /> : null}
      </Grupo>
      {vieneDe ? (
        <Texto suave peque>
          {vieneDe}
        </Texto>
      ) : null}
      {cita.sucesora_id ? (
        <Texto suave peque>
          Ya tiene otra fecha.
        </Texto>
      ) : null}
      {motivo ? (
        <View style={{ gap: 2 }}>
          <Texto suave peque>
            Motivo
          </Texto>
          <Texto>{motivo}</Texto>
        </View>
      ) : null}
      <View style={{ gap: 2 }}>
        <Texto suave peque>
          Sede
        </Texto>
        <Texto>{cuenta ? `${cita.sede.nombre} · ${cuenta}` : cita.sede.nombre}</Texto>
      </View>
      {cita.nota ? (
        <View style={{ gap: 2 }}>
          <Texto suave peque>
            Nota
          </Texto>
          <Texto>{cita.nota}</Texto>
        </View>
      ) : null}
      {cita.estado === 'pendiente' || cita.estado === 'hecha' ? (
        <Texto suave peque>
          {cita.anticipada ? 'Cuenta como agendada: se creó antes de su día.' : 'Se creó el mismo día: la visita contará como no agendada.'}
        </Texto>
      ) : null}

      {abierto === null ? (
        <View style={{ gap: 8 }}>
          {acciones.reportar && alReportar ? <Boton titulo="Reportar" icono="microfono" deshabilitado={eliminando} alPresionar={alReportar} /> : null}
          {cita.visita_id && alVerVisita ? <Boton titulo="Ver la visita" variante="secundario" alPresionar={alVerVisita} /> : null}
          {acciones.noSeHizo && alNoSeHizo ? <Boton titulo="No se hizo" variante="secundario" deshabilitado={eliminando} alPresionar={() => abrir('cerrar')} /> : null}
          {acciones.otraFecha && alOtraFecha ? <Boton titulo="Agendar otra fecha" variante="secundario" icono="agregar" alPresionar={alOtraFecha} /> : null}
          {acciones.cancelar && alCancelar ? <Boton titulo="Cancelar" variante="peligro" deshabilitado={eliminando} alPresionar={() => abrir('cancelar')} /> : null}
          {acciones.eliminar && alEliminar ? (
            <Boton titulo="Eliminar: lo agendé por error" variante="texto" cargando={eliminando} alPresionar={() => void eliminar()} />
          ) : null}
        </View>
      ) : null}
      {abierto === 'cerrar' && alNoSeHizo ? (
        <FormularioMotivo uso="cerrar" pregunta={`¿Por qué no se hizo la cita con ${conQuienCita(cita)}?`} alConfirmar={m => enviar(alNoSeHizo, m)} alVolver={() => setAbierto(null)} />
      ) : null}
      {abierto === 'cancelar' && alCancelar ? (
        <FormularioMotivo uso="cancelar" pregunta={preguntaCancelar} alConfirmar={m => enviar(alCancelar, m)} alVolver={() => setAbierto(null)} />
      ) : null}
      {error ? (
        <Texto peque color={c.peligro}>
          {error}
        </Texto>
      ) : null}

      <Boton titulo="Cerrar" variante="texto" deshabilitado={eliminando} alPresionar={alOcultar} />
    </Tarjeta>
  )
}
