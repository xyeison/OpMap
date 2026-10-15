/**
 * Una cita en Hoy y en Mi agenda (F4.1): la hora a la izquierda ("Sin hora" en pequeño), con quién (médico, o cuenta y
 * subtipo), la sede (y la cuenta si dice algo más), la nota y el estado. Si se puede tocar lleva "›": la hecha abre su
 * visita y la pendiente (spec 2026-10-15, desde Hoy) se reporta (lo dice la etiqueta accesible). Revisión 2026-10-15:
 * solo "›" a la derecha (antes "Reportar" con la flecha ocupaba ~67 pt y partía el nombre y la sede) y "Atrasada"
 * junto a "Pendiente". `children` va debajo (p. ej. "Cancelar esta cita"). Nunca documentos.
 */
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { conQuienCita, cuentaDistinta, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_ESTADO_CITA, ETIQUETA_TIPO_VISITA, type CitaItem } from '../../lib/tipos'
import { Grupo, Insignia, Tarjeta, Texto } from '../../lib/ui'

interface Props {
  cita: CitaItem
  alPresionar?: () => void
  /** Mostrar "Médica" / "Institucional" (en Mi agenda). */
  conTipo?: boolean
  /** Mostrar la nota. */
  conNota?: boolean
  /** Pendiente de hoy con la hora ya pasada (lib/pantallas.ts citaAtrasada): "Atrasada" junto a "Pendiente". */
  atrasada?: boolean
  children?: ReactNode
}

export function FilaCita({ cita, alPresionar, conTipo, conNota, atrasada, children }: Props) {
  const con = conQuienCita(cita)
  const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
  const reportar = !!alPresionar && cita.estado === 'pendiente'
  return (
    <Tarjeta
      alPresionar={alPresionar}
      estilo={{ padding: 12, gap: 6 }}
      etiquetaAccesible={`Cita ${textoHoraCita(cita.hora)} con ${con} en ${cita.sede.nombre}, ${ETIQUETA_ESTADO_CITA[cita.estado]}${atrasada ? ', atrasada' : ''}${alPresionar ? (reportar ? '. Toca para reportarla' : '. Toca para ver la visita') : ''}`}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 62, paddingTop: cita.hora ? 0 : 2 }}>
          {cita.hora ? (
            <Texto negrita>{textoHoraCita(cita.hora)}</Texto>
          ) : (
            <Texto peque suave>
              Sin hora
            </Texto>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Texto negrita>{con}</Texto>
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
        </View>
        {alPresionar ? (
          <Texto suave estilo={{ fontSize: 24, lineHeight: 26 }}>
            ›
          </Texto>
        ) : null}
      </View>
      {children}
    </Tarjeta>
  )
}
