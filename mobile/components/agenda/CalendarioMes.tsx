/**
 * Calendario de la agenda (spec 2026-10-15): el mes en cuadrícula (o una semana), lunes primero, celdas de 44 pt, hoy
 * marcado con un borde, el día elegido relleno, los días fuera de desde..hasta (o apagados) atenuados y sin toque, la
 * cantidad de citas en pequeño debajo del número y los días libres con fondo ámbar (borde punteado si están por
 * aprobar). Lo usan Agendar, Mi agenda, Días libres y la próxima reunión de la visita. Estilo Uber (2026-10-15):
 * celdas cuadradas de radio 10, el elegido negro y hoy con borde negro, como en el artboard de Agendar.
 *
 * Con `vista` 'mes' las flechas pasan de mes; con 'semana', de semana. Al pasar a otro mes avisa `alCambiarMes` (en la
 * vista de semana, cada mes que toca la semana nueva) para que la pantalla pida sus citas. Si `valor` cambia desde
 * afuera, el calendario va a su mes o su semana. Las reglas puras están en lib/calendario.ts.
 *
 * Revisión 2026-10-15: con `conHoy` (Mi agenda), un "Hoy" en la cabecera vuelve a hoy (lo elige) cuando se ve otro día
 * u otra semana. La leyenda de las citas es una insignia sin cifra ("número de citas del día"; con un "2" fijo se leía
 * como un total). Los números no crecen más de 1,3 veces con el texto grande del sistema (círculos de 38 pt e insignias
 * de 17).
 */
import { useEffect, useMemo, useState, type JSX } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  cuadriculaMes,
  cuadriculaSemana,
  etiquetaDia,
  LETRAS_SEMANA,
  lunesDe,
  mesAnterior,
  mesDe,
  mesesDeRango,
  mesSiguiente,
  rangoDeMes,
  semanasVisibles,
  tituloMes,
  tituloSemana,
  type DiaCalendario,
  type MarcaDia,
} from '../../lib/calendario'
import { fechaLarga, sumarDias } from '../../lib/fechas'
import { Icono } from '../../lib/iconos'
import { ETIQUETA_ESTADO_DIA_LIBRE, type EstadoDiaLibre } from '../../lib/tipos'
import { ALTO_TOQUE_MIN, TAMANO, useColores, useFuente } from '../../lib/ui'

export type { MarcaDia } from '../../lib/calendario'

export interface PropsCalendarioMes {
  /** Día elegido (AAAA-MM-DD) o null. */
  valor: string | null
  alCambiar: (fecha: string) => void
  /** Hoy en Bogotá (AAAA-MM-DD). */
  hoy: string
  /** Primer y último día que se pueden elegir (AAAA-MM-DD). */
  desde?: string
  hasta?: string
  marcas?: Readonly<Record<string, MarcaDia>>
  vista?: 'mes' | 'semana'
  /** Al pasar a otro mes (AAAA-MM): para pedir sus citas. */
  alCambiarMes?: (mes: string) => void
  /** "Hoy" en la cabecera (Mi agenda): vuelve a hoy y lo elige cuando se ve otro día u otra semana. */
  conHoy?: boolean
}

/** Hasta cuánto crecen los números con el texto grande del sistema. */
const MAX_ESCALA_TEXTO = 1.3

/** Día libre que ya cuenta como libre (fondo lleno); los demás estados vivos, borde punteado. */
const LIBRE_LLENO: readonly EstadoDiaLibre[] = ['aprobado', 'registrado']

export function CalendarioMes({ valor, alCambiar, hoy, desde, hasta, marcas, vista = 'mes', alCambiarMes, conHoy }: PropsCalendarioMes): JSX.Element {
  const c = useColores()
  const fuente = useFuente()
  const base = valor ?? (desde !== undefined && hoy < desde ? desde : hoy)
  const [mes, setMes] = useState(() => mesDe(base))
  const [lunes, setLunes] = useState(() => lunesDe(base))

  // El valor cambió desde afuera (otro día elegido, otra vista): el calendario va a su mes y a su semana.
  useEffect(() => {
    setMes(mesDe(base))
    setLunes(lunesDe(base))
  }, [base, vista])

  const semanas: DiaCalendario[][] = useMemo(
    () =>
      vista === 'semana'
        ? [cuadriculaSemana(lunes, { hoy, desde, hasta, marcas })]
        : semanasVisibles(cuadriculaMes(mes, { hoy, desde, hasta, marcas }), { desde, hasta }),
    [vista, lunes, mes, hoy, desde, hasta, marcas]
  )

  // Flechas: no se pasa a un mes (o una semana) que queda entero fuera de desde..hasta.
  const anterior = vista === 'semana' ? sumarDias(lunes, -7) : mesAnterior(mes)
  const siguiente = vista === 'semana' ? sumarDias(lunes, 7) : mesSiguiente(mes)
  const finDeAnterior = vista === 'semana' ? sumarDias(lunes, -1) : rangoDeMes(anterior).hasta
  const inicioDeSiguiente = vista === 'semana' ? siguiente : rangoDeMes(siguiente).desde
  const puedeAnterior = desde === undefined || finDeAnterior >= desde
  const puedeSiguiente = hasta === undefined || inicioDeSiguiente <= hasta

  const ir = (destino: string) => {
    if (vista === 'semana') {
      setLunes(destino)
      for (const m of mesesDeRango(destino, sumarDias(destino, 6))) alCambiarMes?.(m)
    } else {
      setMes(destino)
      alCambiarMes?.(destino)
    }
  }

  const elegir = (dia: DiaCalendario) => {
    if (!dia.elegible) return
    if (alCambiarMes && mesDe(dia.fecha) !== mesDe(base)) alCambiarMes(mesDe(dia.fecha))
    alCambiar(dia.fecha)
  }

  const visibles = semanas.flat()
  const hoyElegible = (desde === undefined || hoy >= desde) && (hasta === undefined || hoy <= hasta)
  const verHoy = !!conHoy && hoyElegible && (valor !== hoy || !visibles.some(d => d.fecha === hoy))
  const irAHoy = () => {
    if (vista === 'semana') ir(lunesDe(hoy))
    else ir(mesDe(hoy))
    alCambiar(hoy)
  }
  const hayCitas = visibles.some(d => (marcas?.[d.fecha]?.citas ?? 0) > 0)
  const libresVisibles = visibles.map(d => marcas?.[d.fecha]?.estadoLibre ?? null).filter((e): e is EstadoDiaLibre => e !== null)
  const hayLibres = libresVisibles.some(e => LIBRE_LLENO.includes(e))
  const hayPorAprobar = libresVisibles.some(e => !LIBRE_LLENO.includes(e))

  const flecha = (direccion: 'atras' | 'adelante', habilitada: boolean, destino: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direccion === 'atras' ? (vista === 'semana' ? 'Semana anterior' : 'Mes anterior') : vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
      accessibilityState={{ disabled: !habilitada }}
      disabled={!habilitada}
      onPress={() => ir(destino)}
      hitSlop={4}
      style={({ pressed }) => ({
        width: ALTO_TOQUE_MIN,
        height: ALTO_TOQUE_MIN,
        borderRadius: TAMANO.radio,
        backgroundColor: c.relleno,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: !habilitada ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icono nombre={direccion} tamano={22} />
    </Pressable>
  )

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {flecha('atras', puedeAnterior, anterior)}
        <Text accessibilityRole="header" style={[{ color: c.texto, fontSize: 17, lineHeight: 22, textAlign: 'center', flex: 1 }, fuente('negrita')]}>
          {vista === 'semana' ? tituloSemana(lunes) : tituloMes(mes)}
        </Text>
        {verHoy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a hoy"
            onPress={irAHoy}
            hitSlop={4}
            style={({ pressed }) => ({ minHeight: ALTO_TOQUE_MIN, paddingHorizontal: 12, marginRight: 8, borderRadius: TAMANO.radio, backgroundColor: c.relleno, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text maxFontSizeMultiplier={MAX_ESCALA_TEXTO} style={[{ color: c.texto, fontSize: 15 }, fuente('negrita')]}>
              Hoy
            </Text>
          </Pressable>
        ) : null}
        {flecha('adelante', puedeSiguiente, siguiente)}
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {LETRAS_SEMANA.map((letra, i) => (
          <Text key={i} importantForAccessibility="no" style={[{ flex: 1, textAlign: 'center', color: c.textoSuave, fontSize: 13 }, fuente('media')]}>
            {letra}
          </Text>
        ))}
      </View>

      {semanas.map(semana => (
        <View key={semana[0].fecha} style={{ flexDirection: 'row', gap: 4 }}>
          {semana.map(dia => {
            const marca = marcas?.[dia.fecha]
            const elegido = dia.fecha === valor
            const libre = marca?.estadoLibre ?? null
            const lleno = !!libre && LIBRE_LLENO.includes(libre)
            const fondo = elegido ? c.acento : lleno ? c.fondoAlerta : 'transparent'
            const colorNumero = elegido ? c.sobreAcento : !dia.elegible ? c.textoInactivo : libre ? c.alerta : dia.delMes ? c.texto : c.textoSuave
            const borde = dia.esHoy && !elegido ? c.acento : libre && !lleno && !elegido ? c.alerta : 'transparent'
            return (
              <Pressable
                key={dia.fecha}
                accessibilityRole="button"
                accessibilityLabel={etiquetaDia(capitalizar(fechaLarga(dia.fecha, new Date(`${hoy}T12:00:00-05:00`))), dia, marca, libre ? ETIQUETA_ESTADO_DIA_LIBRE[libre] : null)}
                accessibilityState={{ selected: elegido, disabled: !dia.elegible }}
                disabled={!dia.elegible}
                onPress={() => elegir(dia)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: ALTO_TOQUE_MIN,
                  borderRadius: TAMANO.radio,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: fondo,
                  borderWidth: 1.5,
                  borderColor: borde,
                  borderStyle: libre && !lleno && !elegido ? 'dashed' : 'solid',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text maxFontSizeMultiplier={MAX_ESCALA_TEXTO} style={[{ color: colorNumero, fontSize: 16, lineHeight: 20 }, fuente(elegido || dia.esHoy ? 'negrita' : 'media')]}>
                  {dia.numero}
                </Text>
                {/* Las citas del día: la cifra pequeña debajo del número (en el elegido, en blanco). */}
                {marca?.citas ? (
                  <Text
                    importantForAccessibility="no"
                    maxFontSizeMultiplier={MAX_ESCALA_TEXTO}
                    style={[{ color: elegido ? c.sobreAcento : dia.elegible ? c.texto : c.textoInactivo, fontSize: 11, lineHeight: 13 }, fuente('negrita')]}
                  >
                    {marca.citas}
                  </Text>
                ) : (
                  <View style={{ height: 13 }} />
                )}
              </Pressable>
            )
          })}
        </View>
      ))}

      {hayCitas || hayLibres || hayPorAprobar ? (
        <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 4 }}>
          {hayCitas ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 22 }}>
              <Text style={[{ color: c.textoSuave, fontSize: 13 }, fuente('regular')]}>Debajo del día, en pequeño: número de citas del día</Text>
            </View>
          ) : null}
          {hayLibres ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 20, height: 22, borderRadius: 6, backgroundColor: c.fondoAlerta }} />
              <Text style={[{ color: c.textoSuave, fontSize: 13 }, fuente('regular')]}>día libre</Text>
            </View>
          ) : null}
          {hayPorAprobar ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 20, height: 22, borderRadius: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.alerta }} />
              <Text style={[{ color: c.textoSuave, fontSize: 13 }, fuente('regular')]}>por aprobar</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
