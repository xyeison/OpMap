/**
 * El día de Mi agenda como línea de tiempo por medias horas (spec 2026-10-15): cada franja con su hora a la izquierda
 * y sus citas; la línea "Ahora" si el día es hoy; una franja libre que aún se puede agendar se toca y abre Agendar a
 * esa hora; tocar una cita abre su detalle ahí mismo (debajo de ella). Las citas viejas sin hora van al final, en "Sin
 * hora", y las canceladas en "Ver canceladas (n)". Cada cita ocupa una franja (DURACION_VISUAL_MIN: no hay duración).
 * Revisión 2026-10-15: tres o más franjas libres seguidas van plegadas en una fila ("Libre de 07:00 a 09:00 · Ver horas";
 * al tocarla se despliegan para elegir la hora), cortadas en la línea "Ahora": un día con 2 citas ya no son 24 filas y
 * "Sin hora" y "Ver canceladas" quedan cerca. Reglas puras en lib/agenda.ts (ocupacionDelDia, plegarLibres, filaDeAhora,
 * franjaPasada).
 */
import { useState, type JSX, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { filaDeAhora, franjaPasada, ocupacionDelDia, plegarLibres, type FilaDelDia } from '../../lib/agenda'
import { hoyBogota, horaBogota } from '../../lib/fechas'
import { citaAtrasada } from '../../lib/pantallas'
import { Icono } from '../../lib/iconos'
import { conQuienCita, cuentaDistinta } from '../../lib/reglas'
import { ETIQUETA_ESTADO_CITA, type CitaItem } from '../../lib/tipos'
import { ALTO_TOQUE_MIN, Insignia, TAMANO, useColores, useFuente } from '../../lib/ui'

interface Props {
  /** Día que se dibuja (AAAA-MM-DD). */
  fecha: string
  /** Citas de ese día (todas: también las canceladas, que van aparte). */
  citas: readonly CitaItem[]
  /** Se puede agendar ese día (dentro de hoy..hoy + 30 y sin un día libre que lo impida). */
  agendable: boolean
  /** Tocar una franja libre que aún no pasa: abre Agendar a esa hora. */
  alTocarFranja: (hora: string) => void
  alTocarCita: (cita: CitaItem) => void
  /** Id de la cita abierta: su detalle va debajo de ella. */
  abierta: string | null
  /** El detalle de la cita abierta (components/agenda/DetalleCita). */
  detalle?: ReactNode
  /** Id de la cita recién agendada (se resalta). */
  resaltada?: string | null
  ahora?: Date
}

export function LineaDelDia({ fecha, citas, agendable, alTocarFranja, alTocarCita, abierta, detalle, resaltada, ahora }: Props): JSX.Element {
  const c = useColores()
  const fuente = useFuente()
  const [verCanceladas, setVerCanceladas] = useState(false)
  /** Tramos libres desplegados (clave: la franja con que empiezan); se vuelven a plegar al cambiar de día. */
  const [desplegados, setDesplegados] = useState<{ fecha: string; franjas: ReadonlySet<string> }>({ fecha, franjas: new Set() })
  const abiertos = desplegados.fecha === fecha ? desplegados.franjas : new Set<string>()
  const reloj = ahora ?? new Date()
  const { filas, sinHora } = ocupacionDelDia(citas)
  const canceladas = citas.filter(cita => cita.estado === 'cancelada')
  const esHoy = fecha === hoyBogota(reloj)
  const indiceAhora = esHoy ? filaDeAhora(filas.map(f => f.franja), horaBogota(reloj)) : -1

  // Un día sin citas en el que no se agenda (pasado, más allá de hoy + 30 o día libre): sin la línea vacía.
  if (citas.length === 0 && !agendable && !esHoy) {
    return <Text style={[{ color: c.textoSuave, fontSize: 16, paddingVertical: 8 }, fuente('regular')]}>Sin citas este día.</Text>
  }

  const lineaAhora = (
    <View key="ahora" accessibilityLabel={`Ahora, ${horaBogota(reloj)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 }}>
      <Text style={[{ width: 48, color: c.peligro, fontSize: 13, textAlign: 'left' }, fuente('negrita')]}>{horaBogota(reloj)}</Text>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.peligro }} />
      <View style={{ flex: 1, height: 2, backgroundColor: c.peligro }} />
      <Text style={[{ color: c.peligro, fontSize: 13 }, fuente('negrita')]}>Ahora</Text>
    </View>
  )

  const bloque = (cita: CitaItem) => {
    const abiertaEsta = abierta === cita.id
    const cuenta = cita.tipo === 'medica' ? cuentaDistinta(cita.sede.nombre, cita.sede.cuenta_nombre) : null
    return (
      <View key={cita.id} style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: abiertaEsta }}
          accessibilityLabel={`Cita ${cita.hora ?? 'sin hora'} con ${conQuienCita(cita)} en ${cita.sede.nombre}, ${ETIQUETA_ESTADO_CITA[cita.estado]}. Toca para ver el detalle`}
          onPress={() => alTocarCita(cita)}
          style={({ pressed }) => ({
            minHeight: ALTO_TOQUE_MIN,
            borderRadius: TAMANO.radio,
            paddingHorizontal: 12,
            paddingVertical: 6,
            // Estilo Uber: la pendiente rellena de #EEEEEE; la hecha, #F6F6F6 con borde fino; la abierta o recién
            // agendada, con borde negro.
            borderWidth: resaltada === cita.id || abiertaEsta ? 2 : cita.estado === 'pendiente' ? 0 : 1,
            borderColor: resaltada === cita.id || abiertaEsta ? c.acento : c.bordeFuerte,
            backgroundColor: cita.estado === 'pendiente' ? c.relleno : c.superficieSuave,
            justifyContent: 'center',
            opacity: pressed ? 0.7 : cita.estado === 'cancelada' ? 0.75 : 1,
            gap: 2,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={2} style={[{ color: cita.estado === 'pendiente' ? c.texto : c.textoSuave, fontSize: 15, lineHeight: 19, flex: 1 }, fuente('negrita')]}>
              {`${cita.hora ? `${cita.hora.slice(0, 5)} · ` : ''}${conQuienCita(cita)}`}
            </Text>
            {cita.estado !== 'pendiente' ? <Insignia texto={ETIQUETA_ESTADO_CITA[cita.estado]} tono={cita.estado === 'hecha' ? 'exito' : 'neutro'} /> : citaAtrasada(cita, reloj) ? <Insignia texto="Atrasada" tono="alerta" /> : null}
          </View>
          <Text numberOfLines={1} style={[{ color: c.textoSuave, fontSize: 13, lineHeight: 17 }, fuente('regular')]}>
            {cuenta ? `${cita.sede.nombre} · ${cuenta}` : cita.sede.nombre}
          </Text>
        </Pressable>
        {abiertaEsta ? detalle : null}
      </View>
    )
  }

  const filaDibujada = (fila: FilaDelDia<CitaItem>) => {
    const pasada = franjaPasada(fecha, fila.franja, reloj)
    const libre = fila.citas.length === 0
    const tocable = libre && agendable && !pasada
    const enPunto = fila.franja.endsWith(':00')
    return (
      <View key={fila.franja} style={{ flexDirection: 'row', gap: 10, minHeight: libre && !tocable ? 32 : ALTO_TOQUE_MIN }}>
        <Text style={[{ width: 48, paddingTop: libre ? 0 : 12, color: c.textoSuave, fontSize: 13, fontVariant: ['tabular-nums'], textAlign: 'left', alignSelf: libre ? 'center' : 'flex-start' }, fuente(enPunto ? 'media' : 'regular')]}>
          {fila.franja}
        </Text>
        <View style={{ flex: 1, gap: 6, borderTopWidth: 1, borderTopColor: enPunto ? c.bordeFuerte : c.borde, paddingTop: libre ? 0 : 4, justifyContent: 'center' }}>
          {libre ? (
            tocable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Agendar a las ${fila.franja}`}
                onPress={() => alTocarFranja(fila.franja)}
                style={({ pressed }) => ({
                  minHeight: ALTO_TOQUE_MIN - 4,
                  marginVertical: 2,
                  paddingHorizontal: 12,
                  borderRadius: TAMANO.radio,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: c.bordeControl,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Icono nombre="agregar" tamano={18} color={c.texto} />
                <Text style={[{ color: c.texto, fontSize: 14 }, fuente('media')]}>Libre</Text>
              </Pressable>
            ) : null
          ) : (
            fila.citas.map(bloque)
          )}
        </View>
      </View>
    )
  }

  // Las libres seguidas, plegadas (cortadas donde va "Ahora"); un tramo que aún se puede agendar se despliega al tocarlo.
  const filasDibujadas: ReactNode[] = []
  for (const tramo of plegarLibres(filas, { cortes: indiceAhora >= 0 ? [indiceAhora] : [], desplegados: abiertos })) {
    const primero = tramo.tipo === 'fila' ? tramo.indice : tramo.indices[0]
    if (primero === indiceAhora) filasDibujadas.push(lineaAhora)
    if (tramo.tipo === 'fila') {
      filasDibujadas.push(filaDibujada(tramo.fila))
      continue
    }
    const desplegable = agendable && !franjaPasada(fecha, tramo.filas[tramo.filas.length - 1].franja, reloj)
    const texto = `Libre de ${tramo.desde} a ${tramo.hasta}`
    filasDibujadas.push(
      <View key={`libres-${tramo.desde}`} style={{ flexDirection: 'row', gap: 10, minHeight: desplegable ? ALTO_TOQUE_MIN : 32 }}>
        <Text style={[{ width: 48, color: c.textoSuave, fontSize: 13, fontVariant: ['tabular-nums'], textAlign: 'left', alignSelf: 'center' }, fuente('media')]}>{tramo.desde}</Text>
        <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: c.bordeFuerte, justifyContent: 'center' }}>
          {desplegable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${texto}. Toca para ver las horas y agendar`}
              onPress={() => setDesplegados({ fecha, franjas: new Set([...abiertos, tramo.desde]) })}
              style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN - 4, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.5 : 1 })}
            >
              <Icono nombre="agregar" tamano={18} color={c.textoSuave} />
              <Text style={[{ color: c.textoSuave, fontSize: 14, flex: 1 }, fuente('regular')]}>{texto}</Text>
              <Text style={[{ color: c.texto, fontSize: 14 }, fuente('negrita')]}>Ver horas</Text>
            </Pressable>
          ) : (
            <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('regular')]}>{texto}</Text>
          )}
        </View>
      </View>
    )
  }
  if (indiceAhora === filas.length) filasDibujadas.push(lineaAhora)

  return (
    <View style={{ gap: 2 }}>
      {filasDibujadas}

      {sinHora.length > 0 ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          <Text accessibilityRole="header" style={[{ color: c.texto, fontSize: 15 }, fuente('negrita')]}>
            Sin hora
          </Text>
          {sinHora.map(bloque)}
        </View>
      ) : null}

      {canceladas.length > 0 ? (
        <View style={{ gap: 6, marginTop: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: verCanceladas }}
            onPress={() => setVerCanceladas(!verCanceladas)}
            style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[{ color: c.texto, fontSize: 15 }, fuente('negrita')]}>
              {verCanceladas ? `Ocultar canceladas (${canceladas.length})` : `Ver canceladas (${canceladas.length})`}
            </Text>
          </Pressable>
          {verCanceladas ? canceladas.map(bloque) : null}
        </View>
      ) : null}
    </View>
  )
}
