/**
 * Una cita en Hoy y en Mi agenda (F4.1): la hora a la izquierda ("Sin hora" en pequeño), con quién (médico, o cuenta y
 * subtipo), la sede (y la cuenta si dice algo más), la nota y el estado. Si se puede tocar (la hecha abre su visita),
 * lleva "›". `children` va debajo (p. ej. "Cancelar esta cita"). Nunca documentos.
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
  children?: ReactNode
}

export function FilaCita({ cita, alPresionar, conTipo, conNota, children }: Props) {
  const con = conQuienCita(cita)
  const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
  return (
    <Tarjeta
      alPresionar={alPresionar}
      estilo={{ padding: 12, gap: 6 }}
      etiquetaAccesible={`Cita ${textoHoraCita(cita.hora)} con ${con} en ${cita.sede.nombre}, ${ETIQUETA_ESTADO_CITA[cita.estado]}${alPresionar ? '. Toca para ver la visita' : ''}`}
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
