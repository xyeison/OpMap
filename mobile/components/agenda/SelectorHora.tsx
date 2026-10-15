/**
 * "¿A qué hora?" de Agendar (spec 2026-10-15, decisión 3): las medias horas de 07:00 a 18:30 en dos grupos, "Por la
 * mañana" y "Por la tarde" (no "Mañana": en la app "Mañana" es el día siguiente), cinco por fila y de 44 pt de alto; y
 * "Otra hora" con la hora de 05 a 21 y los minutos 00, 15, 30 y 45. La franja que se pisa con una cita de ese día lleva
 * un punto (el aviso de choque lo da el pie; no se bloquea) y, si la fecha es hoy, lo que ya pasó queda atenuado y sin
 * toque, también en "Otra hora" (revisión 2026-10-15). La hora es obligatoria: no hay "Sin hora". El texto no crece más
 * de 1,3 veces con el texto grande del sistema (los chips miden ~58 pt). Reglas puras en lib/agenda.ts (franjasHorario,
 * citasQueChocan, franjaPasada, OTRA_HORA).
 */
import { useState, type JSX } from 'react'
import { Pressable, Text, View } from 'react-native'
import { citasQueChocan, franjaPasada, franjasHorario, INICIO_TARDE, OTRA_HORA } from '../../lib/agenda'
import { Icono } from '../../lib/iconos'
import type { CitaItem } from '../../lib/tipos'
import { ALTO_TOQUE_MIN, useColores, useFuente } from '../../lib/ui'

/** Hasta cuánto crece el texto de los chips con el texto grande del sistema (si no, "07:00" se parte o se corta). */
const MAX_ESCALA_TEXTO = 1.3

interface Props {
  /** HH:MM elegida, o '' si aún no hay. */
  valor: string
  alCambiar: (hora: string) => void
  /** Fecha de la cita (AAAA-MM-DD). */
  fecha: string
  /** Citas de ese día (para marcar las franjas que ya tienen una). */
  citasDelDia: readonly Pick<CitaItem, 'hora' | 'estado'>[]
  error?: string | null
  /** Reloj (las pruebas y la pantalla lo pasan; por defecto, ahora). */
  ahora?: Date
}

export function SelectorHora({ valor, alCambiar, fecha, citasDelDia, error, ahora }: Props): JSX.Element {
  const c = useColores()
  const fuente = useFuente()
  const franjas = franjasHorario()
  const enFranjas = franjas.includes(valor)
  const [otraAbierta, setOtraAbierta] = useState(() => !!valor && !enFranjas)
  const horaOtra = valor ? valor.slice(0, 2) : null
  const minutoOtro = valor ? valor.slice(3, 5) : null
  const reloj = ahora ?? new Date()
  /** Con la fecha de hoy, el primer minuto de esa hora que aún no pasa (null: ya pasó entera). */
  const primerMinuto = (h: string): string | null => OTRA_HORA.minutos.find(m => !franjaPasada(fecha, `${h}:${m}`, reloj)) ?? null

  const celda = (texto: string, opciones: { activo: boolean; deshabilitado?: boolean; marcada?: boolean; ancho: `${number}%`; etiqueta: string; alPresionar: () => void }) => (
    <View key={texto} style={{ width: opciones.ancho, padding: 3 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={opciones.etiqueta}
        accessibilityState={{ selected: opciones.activo, disabled: !!opciones.deshabilitado }}
        disabled={opciones.deshabilitado}
        onPress={opciones.alPresionar}
        style={({ pressed }) => ({
          minHeight: ALTO_TOQUE_MIN,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: opciones.activo ? c.acento : c.bordeControl,
          backgroundColor: opciones.activo ? c.acento : c.superficie,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: opciones.deshabilitado ? 0.35 : pressed ? 0.7 : 1,
        })}
      >
        <Text maxFontSizeMultiplier={MAX_ESCALA_TEXTO} numberOfLines={1} style={[{ color: opciones.activo ? c.sobreAcento : c.texto, fontSize: 16 }, fuente(opciones.activo ? 'negrita' : 'media')]}>
          {texto}
        </Text>
        {opciones.marcada ? (
          <View style={{ position: 'absolute', top: 5, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: opciones.activo ? c.sobreAcento : c.info }} />
        ) : null}
      </Pressable>
    </View>
  )

  const grupo = (titulo: string, lista: readonly string[]) => (
    <View style={{ gap: 4 }}>
      <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('media')]}>{titulo}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
        {lista.map(franja => {
          const ocupada = citasQueChocan(franja, citasDelDia).length > 0
          const pasada = franjaPasada(fecha, franja, reloj)
          return celda(franja, {
            activo: valor === franja,
            deshabilitado: pasada,
            marcada: ocupada,
            ancho: '20%',
            etiqueta: `${franja}${ocupada ? ', ya tienes una cita' : ''}${pasada ? ', ya pasó' : ''}`,
            alPresionar: () => {
              setOtraAbierta(false)
              alCambiar(franja)
            },
          })
        })}
      </View>
    </View>
  )

  return (
    <View style={{ gap: 10 }}>
      {grupo('Por la mañana', franjas.filter(f => f < INICIO_TARDE))}
      {grupo('Por la tarde', franjas.filter(f => f >= INICIO_TARDE))}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: otraAbierta }}
        accessibilityLabel={`Otra hora${valor && !enFranjas ? `: ${valor}` : ''}`}
        onPress={() => setOtraAbierta(!otraAbierta)}
        style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}
      >
        <Icono nombre="reloj" activo={!!valor && !enFranjas} tamano={22} />
        <Text style={[{ color: c.texto, fontSize: 16, flex: 1 }, fuente(valor && !enFranjas ? 'negrita' : 'media')]}>
          {valor && !enFranjas ? `Otra hora: ${valor}` : 'Otra hora'}
        </Text>
        <Icono nombre={otraAbierta ? 'cerrar' : 'adelante'} tamano={20} color={c.textoSuave} />
      </Pressable>

      {otraAbierta ? (
        <View style={{ gap: 8 }}>
          <View style={{ gap: 4 }}>
            <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('media')]}>Hora</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {OTRA_HORA.horas.map(h => {
                const libre = primerMinuto(h)
                const minuto = minutoOtro && (OTRA_HORA.minutos as readonly string[]).includes(minutoOtro) && !franjaPasada(fecha, `${h}:${minutoOtro}`, reloj) ? minutoOtro : libre
                return celda(h, {
                  activo: horaOtra === h,
                  deshabilitado: libre === null,
                  ancho: '16.66%',
                  etiqueta: `Las ${h}${libre === null ? ', ya pasó' : ''}`,
                  alPresionar: () => alCambiar(`${h}:${minuto ?? '00'}`),
                })
              })}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={[{ color: c.textoSuave, fontSize: 14 }, fuente('media')]}>Minutos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 }}>
              {OTRA_HORA.minutos.map(m => {
                const hora = horaOtra && (OTRA_HORA.horas as readonly string[]).includes(horaOtra) ? horaOtra : '08'
                const pasado = franjaPasada(fecha, `${hora}:${m}`, reloj)
                return celda(`:${m}`, {
                  activo: !!valor && minutoOtro === m,
                  deshabilitado: pasado,
                  ancho: '25%',
                  etiqueta: `Minuto ${m}${pasado ? ', ya pasó' : ''}`,
                  alPresionar: () => alCambiar(`${hora}:${m}`),
                })
              })}
            </View>
          </View>
        </View>
      ) : null}

      {error ? <Text style={[{ color: c.peligro, fontSize: 14 }, fuente('regular')]}>{error}</Text> : null}
    </View>
  )
}
