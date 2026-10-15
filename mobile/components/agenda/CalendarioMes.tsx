/**
 * Calendario de la agenda (spec 2026-10-15): el mes en cuadrícula (o la semana), lunes primero, hoy marcado, los días
 * fuera de desde..hasta apagados, la cantidad de citas por día y los días libres por estado. Lo usan Agendar, Mi
 * agenda, Días libres y la próxima reunión de la visita.
 *
 * PROVISIONAL (Paso 0): es el "‹ fecha ›" de Agendar de hoy (un día por toque, dentro de desde..hasta) con las props
 * definitivas; avisa alCambiarMes al pasar de mes. `vista` todavía no cambia nada. El paquete 3 escribe la cuadrícula.
 */
import type { JSX } from 'react'
import { View } from 'react-native'
import { fechaLarga, fechaRelativa, mesDe, sumarDias } from '../../lib/fechas'
import { ETIQUETA_ESTADO_DIA_LIBRE, type EstadoDiaLibre } from '../../lib/tipos'
import { Boton, Texto } from '../../lib/ui'

export interface MarcaDia {
  /** Citas de ese día (pendientes y hechas). */
  citas?: number
  /** Estado del día libre de ese día, si hay. */
  estadoLibre?: EstadoDiaLibre | null
  /** El día no se puede elegir (además de los que caen fuera de desde..hasta). */
  apagado?: boolean
}

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
}

export function CalendarioMes({ valor, alCambiar, hoy, desde, hasta, marcas, alCambiarMes }: PropsCalendarioMes): JSX.Element {
  const fecha = valor ?? hoy
  const elegible = (dia: string) => (desde === undefined || dia >= desde) && (hasta === undefined || dia <= hasta) && !marcas?.[dia]?.apagado
  const mover = (dias: number) => {
    const nueva = sumarDias(fecha, dias)
    if (!elegible(nueva)) return
    if (alCambiarMes && mesDe(nueva) !== mesDe(fecha)) alCambiarMes(mesDe(nueva))
    alCambiar(nueva)
  }
  const marca = marcas?.[fecha]
  const detalle = [
    marca?.citas ? `${marca.citas} ${marca.citas === 1 ? 'cita' : 'citas'}` : null,
    marca?.estadoLibre ? `Día libre: ${ETIQUETA_ESTADO_DIA_LIBRE[marca.estadoLibre].toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Boton titulo="‹" variante="secundario" alPresionar={() => mover(-1)} deshabilitado={!elegible(sumarDias(fecha, -1))} estilo={{ minWidth: 56 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Texto negrita centro>
            {capitalizar(fechaLarga(fecha))}
          </Texto>
          <Texto suave peque centro>
            {fechaRelativa(fecha)}
          </Texto>
        </View>
        <Boton titulo="›" variante="secundario" alPresionar={() => mover(1)} deshabilitado={!elegible(sumarDias(fecha, 1))} estilo={{ minWidth: 56 }} />
      </View>
      {detalle ? (
        <Texto suave peque centro>
          {detalle}
        </Texto>
      ) : null}
    </View>
  )
}

function capitalizar(texto: string): string {
  return texto ? texto[0].toUpperCase() + texto.slice(1) : texto
}
