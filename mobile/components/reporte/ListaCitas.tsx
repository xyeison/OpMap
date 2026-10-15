/**
 * Paso 1 de Reportar (F4.1): las citas PENDIENTES de hoy, la más cercana primero (lib/propuesta.ts citasParaReportar),
 * con la hora, con quién, la sede, la distancia y si está dentro del radio presencial. Tocar una la deja elegida: la
 * visita sale ya armada con esa cita (tipo, médico o cuenta y subtipo, sede y agenda_id). Sin ubicación, por hora.
 */
import { View } from 'react-native'
import { textoDistancia } from '../../lib/geo'
import { conQuienCita, cuentaDistinta, sinCortes, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_TIPO_VISITA, type CitaItem } from '../../lib/tipos'
import { Grupo, Insignia, Tarjeta, Texto, Vacio, useColores } from '../../lib/ui'

interface Props {
  /** Ya ordenadas (citasParaReportar). */
  citas: readonly CitaItem[]
  radioM: number
  elegida: string | null
  alElegir: (id: string | null) => void
  vacio?: string
}

export function ListaCitas({ citas, radioM, elegida, alElegir, vacio = 'No tienes citas pendientes para hoy.' }: Props) {
  const c = useColores()
  if (citas.length === 0) return <Vacio texto={vacio} />
  return (
    <View style={{ gap: 8 }}>
      {citas.map(cita => {
        const activa = cita.id === elegida
        const con = conQuienCita(cita)
        const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
        return (
          <Tarjeta
            key={cita.id}
            alPresionar={() => alElegir(activa ? null : cita.id)}
            etiquetaAccesible={`Cita ${textoHoraCita(cita.hora)} con ${con} en ${cita.sede.nombre}${cita.distancia_m !== null ? `, a ${textoDistancia(cita.distancia_m)}` : ''}${activa ? ', elegida' : ''}`}
            estilo={{ padding: 12, gap: 6, ...(activa ? { borderWidth: 2.5, borderColor: c.acento } : null) }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <Texto negrita>
                {activa ? '✓ ' : ''}
                {textoHoraCita(cita.hora)}
              </Texto>
              {cita.distancia_m !== null ? <Texto negrita>{sinCortes(textoDistancia(cita.distancia_m))}</Texto> : null}
            </View>
            <Texto negrita>{con}</Texto>
            <Texto suave peque>
              {cita.sede.nombre}
              {cuenta ? ` · ${cuenta}` : ''}
            </Texto>
            <Grupo>
              <Insignia texto={ETIQUETA_TIPO_VISITA[cita.tipo]} />
              {cita.dentro_del_radio === true ? <Insignia texto="Dentro del radio" tono="exito" /> : null}
              {cita.dentro_del_radio === false ? <Insignia texto={`Fuera del radio (${sinCortes(textoDistancia(radioM))})`} tono="alerta" /> : null}
              {!cita.sede.ubicacion_confirmada ? <Insignia texto="Ubicación sin confirmar" /> : null}
            </Grupo>
            {cita.nota ? (
              <Texto peque suave lineas={2}>
                Nota: {cita.nota}
              </Texto>
            ) : null}
            {!cita.anticipada ? (
              <Texto peque suave>
                Agendada hoy: la visita contará como no agendada.
              </Texto>
            ) : null}
          </Tarjeta>
        )
      })}
    </View>
  )
}
