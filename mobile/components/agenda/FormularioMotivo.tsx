/**
 * El motivo de "No se hizo" o de Cancelar (F1b; A7, A8 y C10 de la spec de actividades de campo): la pregunta, los
 * motivos de la lista en chips (sin "Salió de la empresa", que lo pone el sistema), el texto (obligatorio con "Otro",
 * de 3 a 300 caracteres; opcional con los demás) y "Sí, …" / "No, dejarla". Revisa el motivo antes de enviar con los
 * mensajes del servidor (revisarMotivo de lib/agenda-ciclo.ts) y muestra el error que devuelva quien lo manda. Lo usan
 * el detalle de una cita en Mi agenda y "¿Qué pasó con esto?" en Hoy. Nunca datos de pacientes (lo dice la ayuda).
 */
import { useState, type JSX } from 'react'
import { View } from 'react-native'
import { MAX_MOTIVO_CIERRE, MOTIVOS_ELEGIBLES, revisarMotivo } from '../../lib/agenda-ciclo'
import type { MotivoElegible } from '../../lib/tipos'
import { Boton, Campo, Chip, Grupo, Texto, useColores } from '../../lib/ui'

interface Props {
  /** 'cerrar' = "No se hizo"; 'cancelar' = Cancelar (de hoy en adelante). */
  uso: 'cerrar' | 'cancelar'
  /** La pregunta ("¿Por qué no se hizo la cita con …?"). */
  pregunta: string
  /** Envía el motivo: null si salió bien, o el mensaje del error (se muestra aquí). */
  alConfirmar: (motivo: { motivo_codigo: MotivoElegible; motivo: string | null }) => Promise<string | null>
  /** "No, dejarla": vuelve sin cambiar nada. */
  alVolver: () => void
}

export function FormularioMotivo({ uso, pregunta, alConfirmar, alVolver }: Props): JSX.Element {
  const c = useColores()
  const [codigo, setCodigo] = useState<MotivoElegible | null>(null)
  const [texto, setTexto] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sin motivo elegido, eso; con él, lo del texto (los mensajes del servidor: con "Otro", de 3 a 300 caracteres).
  const faltaCodigo = codigo === null ? 'Elige el motivo' : null
  const faltaTexto = codigo === null ? null : revisarMotivo(codigo, texto, uso)

  const confirmar = async () => {
    setIntentado(true)
    setError(null)
    if (faltaCodigo || faltaTexto || !codigo) return
    setEnviando(true)
    const fallo = await alConfirmar({ motivo_codigo: codigo, motivo: texto.trim() ? texto.trim() : null })
    setEnviando(false)
    if (fallo) setError(fallo)
  }

  return (
    <View style={{ gap: 10 }}>
      <Texto negrita>{pregunta}</Texto>
      <Grupo>
        {MOTIVOS_ELEGIBLES.map(motivo => (
          <Chip
            key={motivo.valor}
            texto={motivo.etiqueta}
            activo={codigo === motivo.valor}
            deshabilitado={enviando}
            alPresionar={() => {
              setCodigo(motivo.valor)
              setError(null)
            }}
          />
        ))}
      </Grupo>
      {intentado && faltaCodigo ? (
        <Texto peque color={c.peligro}>
          {faltaCodigo}
        </Texto>
      ) : null}
      <Campo
        etiqueta={codigo === 'otro' ? '¿Qué pasó?' : 'Cuéntalo (opcional)'}
        valor={texto}
        alCambiar={valor => {
          setTexto(valor)
          setError(null)
        }}
        varias
        maxLength={MAX_MOTIVO_CIERRE}
        placeholder={uso === 'cerrar' ? 'El médico salió a cirugía, se cerró la vía…' : 'El médico viaja esa semana, cambió la prioridad…'}
        ayuda="Sin datos de pacientes."
        error={intentado ? faltaTexto : null}
      />
      <Boton
        titulo={uso === 'cerrar' ? 'Sí, no se hizo' : 'Sí, cancelar la cita'}
        variante={uso === 'cerrar' ? 'primario' : 'peligro'}
        cargando={enviando}
        alPresionar={() => void confirmar()}
      />
      <Boton titulo="No, dejarla" variante="texto" deshabilitado={enviando} alPresionar={alVolver} />
      {error ? (
        <Texto peque color={c.peligro}>
          {error}
        </Texto>
      ) : null}
    </View>
  )
}
