/**
 * Detalle de una cita en Mi agenda, ahí mismo en la línea del día (spec 2026-10-15): con quién, la hora y el día, la
 * sede (y la cuenta si dice algo más), la nota completa, si cuenta como agendada, "Ver la visita" (la hecha) y
 * "Cancelar esta cita" con motivo opcional. Cancelar no borra: la cita queda en la agenda como cancelada (la pregunta
 * la arma la pantalla). Nunca documentos.
 */
import { useState, type JSX } from 'react'
import { View } from 'react-native'
import { fechaLarga } from '../../lib/fechas'
import { conQuienCita, cuentaDistinta, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_ESTADO_CITA, ETIQUETA_TIPO_VISITA, MAX_MOTIVO_CANCELACION_CITA, type CitaItem } from '../../lib/tipos'
import { Boton, Campo, Grupo, Insignia, Tarjeta, Texto, useColores } from '../../lib/ui'

interface Props {
  cita: CitaItem
  /** "Ver la visita" (solo si la cita ya tiene su visita). */
  alVerVisita?: () => void
  /** La pregunta antes de cancelar ("¿Cancelas la cita con …? Queda en tu agenda como cancelada."). */
  preguntaCancelar: string
  /** Cancela con el motivo: null si se canceló, o el mensaje del error. Sin esto no se ofrece cancelar. */
  alCancelar?: (motivo: string) => Promise<string | null>
  alCerrar: () => void
}

export function DetalleCita({ cita, alVerVisita, preguntaCancelar, alCancelar, alCerrar }: Props): JSX.Element {
  const c = useColores()
  const [confirmando, setConfirmando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null

  const cancelar = async () => {
    if (!alCancelar) return
    setEnviando(true)
    setError(null)
    const fallo = await alCancelar(motivo)
    setEnviando(false)
    if (fallo) setError(fallo)
    else setConfirmando(false)
  }

  return (
    <Tarjeta estilo={{ gap: 10, borderColor: c.texto }}>
      <View style={{ gap: 2 }}>
        <Texto negrita>{conQuienCita(cita)}</Texto>
        <Texto suave peque>
          {`${textoHoraCita(cita.hora)} · ${fechaLarga(cita.fecha)}`}
        </Texto>
      </View>
      <Grupo>
        <Insignia texto={ETIQUETA_TIPO_VISITA[cita.tipo]} />
        <Insignia texto={ETIQUETA_ESTADO_CITA[cita.estado]} tono={cita.estado === 'hecha' ? 'exito' : cita.estado === 'cancelada' ? 'peligro' : 'neutro'} />
      </Grupo>
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
      {cita.estado !== 'cancelada' ? (
        <Texto suave peque>
          {cita.anticipada ? 'Cuenta como agendada: se creó antes de su día.' : 'Se creó el mismo día: la visita contará como no agendada.'}
        </Texto>
      ) : null}

      {cita.visita_id && alVerVisita ? <Boton titulo="Ver la visita" variante="secundario" alPresionar={alVerVisita} /> : null}

      {cita.cancelable && alCancelar && !confirmando ? (
        <Boton
          titulo="Cancelar esta cita"
          variante="peligro"
          alPresionar={() => {
            setConfirmando(true)
            setMotivo('')
            setError(null)
          }}
        />
      ) : null}
      {confirmando ? (
        <View style={{ gap: 8 }}>
          <Texto>{preguntaCancelar}</Texto>
          <Campo
            etiqueta="Motivo (opcional)"
            valor={motivo}
            alCambiar={setMotivo}
            maxLength={MAX_MOTIVO_CANCELACION_CITA}
            placeholder="El médico no atiende ese día, se movió la cita…"
          />
          <Boton titulo="Sí, cancelar la cita" variante="peligro" cargando={enviando} alPresionar={() => void cancelar()} />
          <Boton titulo="No, dejarla" variante="texto" deshabilitado={enviando} alPresionar={() => setConfirmando(false)} />
        </View>
      ) : null}
      {error ? (
        <Texto peque color={c.peligro}>
          {error}
        </Texto>
      ) : null}

      <Boton titulo="Cerrar" variante="texto" deshabilitado={enviando} alPresionar={alCerrar} />
    </Tarjeta>
  )
}
