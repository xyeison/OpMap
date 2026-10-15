/**
 * Una cita en Hoy (F4.1): fila de lista con separador fino (estilo Uber, 2026-10-15): la hora en negrita a la
 * izquierda ("Sin hora" en pequeño), con quién (médico, o cuenta y subtipo), la sede (y la cuenta si dice algo más),
 * la nota y el estado. Si se puede tocar lleva "›": la hecha abre su visita y la pendiente (spec 2026-10-15, desde
 * Hoy) se reporta (lo dice la etiqueta accesible). Revisión 2026-10-15: solo "›" a la derecha (antes "Reportar" con la
 * flecha ocupaba ~67 pt y partía el nombre y la sede) y "Atrasada" junto a "Pendiente". `children` va debajo (p. ej.
 * "Cancelar esta cita"). Nunca documentos.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { conQuienCita, cuentaDistinta, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_ESTADO_CITA, ETIQUETA_TIPO_VISITA, type CitaItem } from '../../lib/tipos'
import { FilaLista, Grupo, Insignia, Texto } from '../../lib/ui'

interface Props {
  cita: CitaItem
  alPresionar?: () => void
  /** Mostrar "Médica" / "Institucional" (en Mi agenda). */
  conTipo?: boolean
  /** Mostrar la nota. */
  conNota?: boolean
  /** Pendiente de hoy con la hora ya pasada (lib/pantallas.ts citaAtrasada): "Atrasada" junto a "Pendiente". */
  atrasada?: boolean
  /** La primera de la lista va sin separador arriba. */
  primera?: boolean
  children?: ReactNode
}

export function FilaCita({ cita, alPresionar, conTipo, conNota, atrasada, primera, children }: Props) {
  const con = conQuienCita(cita)
  const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
  const reportar = !!alPresionar && cita.estado === 'pendiente'
  return (
    <FilaLista
      alPresionar={alPresionar}
      primera={primera}
      estilo={{ alignItems: 'flex-start' }}
      etiquetaAccesible={`Cita ${textoHoraCita(cita.hora)} con ${con} en ${cita.sede.nombre}, ${ETIQUETA_ESTADO_CITA[cita.estado]}${atrasada ? ', atrasada' : ''}${alPresionar ? (reportar ? '. Toca para reportarla' : '. Toca para ver la visita') : ''}`}
    >
      <View style={{ width: 56, paddingTop: cita.hora ? 0 : 2 }}>
        {cita.hora ? (
          <Texto negrita estilo={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>
            {textoHoraCita(cita.hora)}
          </Texto>
        ) : (
          <Texto peque suave>
            Sin hora
          </Texto>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto media>{con}</Texto>
        <Texto suave peque>
          {cita.sede.nombre}
          {cuenta ? ` · ${cuenta}` : ''}
        </Texto>
        {conNota && cita.nota ? (
          <Texto suave peque lineas={3}>
            Nota: {cita.nota}
          </Texto>
        ) : null}
        <Grupo estilo={{ marginTop: 4 }}>
          {conTipo ? <Insignia texto={ETIQUETA_TIPO_VISITA[cita.tipo]} /> : null}
          <Insignia texto={ETIQUETA_ESTADO_CITA[cita.estado]} tono={cita.estado === 'hecha' ? 'exito' : 'neutro'} />
          {atrasada ? <Insignia texto="Atrasada" tono="alerta" /> : null}
        </Grupo>
        {children}
      </View>
    </FilaLista>
  )
}
