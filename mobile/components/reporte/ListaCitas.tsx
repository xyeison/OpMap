/**
 * Paso 1 de Reportar (F4.1): las citas PENDIENTES de hoy, la más cercana primero (lib/propuesta.ts citasParaReportar),
 * con la hora, con quién, la sede, la distancia y si está dentro del radio presencial. Tocar una la deja elegida: la
 * visita sale ya armada con esa cita (tipo, médico o cuenta y subtipo, sede y agenda_id). Sin ubicación, por hora.
 *
 * Estilo Uber (2026-10-15): la hora a la izquierda, la distancia a la derecha; la elegida va aparte, con borde negro y
 * "✓". Desde el 2026-10-31 (dueño: "no es claro cuál es la opción que se puede tocar") cada cita es una TARJETA con
 * borde y "›", no una fila con separador.
 */
import { Pressable, View } from 'react-native'
import { textoDistancia } from '../../lib/geo'
import { citaAtrasada } from '../../lib/pantallas'
import { conQuienCita, cuentaDistinta, sinCortes, textoHoraCita } from '../../lib/reglas'
import { ETIQUETA_TIPO_VISITA, type CitaItem } from '../../lib/tipos'
import { Grupo, IconoUi, Insignia, TAMANO, Tarjeta, Texto, Vacio, useColores } from '../../lib/ui'

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
  const ahora = new Date()
  return (
    <View style={{ gap: 8 }}>
      {citas.map(cita => {
        const activa = cita.id === elegida
        const con = conQuienCita(cita)
        const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
        const etiqueta = `Cita ${textoHoraCita(cita.hora)} con ${con} en ${cita.sede.nombre}${cita.distancia_m !== null ? `, a ${textoDistancia(cita.distancia_m)}` : ''}${activa ? ', elegida' : ''}`
        const contenido = (
          <>
            <View style={{ width: 56, paddingTop: cita.hora ? 0 : 2 }}>
              {cita.hora ? (
                <Texto negrita estilo={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>
                  {activa ? '✓ ' : ''}
                  {textoHoraCita(cita.hora)}
                </Texto>
              ) : (
                <Texto peque suave negrita={activa}>
                  {activa ? '✓ ' : ''}
                  {textoHoraCita(cita.hora)}
                </Texto>
              )}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <Texto negrita={activa} media={!activa} estilo={{ flexShrink: 1 }}>
                  {con}
                </Texto>
                {cita.distancia_m !== null ? <Texto negrita peque>{sinCortes(textoDistancia(cita.distancia_m))}</Texto> : null}
              </View>
              <Texto suave peque>
                {cita.sede.nombre}
                {cuenta ? ` · ${cuenta}` : ''}
              </Texto>
              <Grupo estilo={{ marginTop: 4 }}>
                <Insignia texto={ETIQUETA_TIPO_VISITA[cita.tipo]} />
                {/* Como en Hoy (revisión 2026-10-15): la pendiente de hoy con la hora ya pasada. */}
                {citaAtrasada(cita, ahora) ? <Insignia texto="Atrasada" tono="alerta" /> : null}
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
            </View>
          </>
        )
        if (activa) {
          return (
            <Pressable
              key={cita.id}
              accessibilityRole="button"
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: true }}
              onPress={() => alElegir(null)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: TAMANO.radioTarjeta,
                borderWidth: 2,
                borderColor: c.acento,
                backgroundColor: c.superficie,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {contenido}
            </Pressable>
          )
        }
        return (
          <Tarjeta key={cita.id} alPresionar={() => alElegir(cita.id)} etiquetaAccesible={etiqueta} estilo={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>{contenido}</View>
            <IconoUi nombre="adelante" color={c.textoSuave} tamano={18} />
          </Tarjeta>
        )
      })}
    </View>
  )
}
