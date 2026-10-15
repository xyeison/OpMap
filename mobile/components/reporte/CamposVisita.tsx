/**
 * Campos que la persona escribe o corrige de una visita (iguales en Reportar y en Visita para corregir el mismo
 * día): efectiva o no con su motivo, conclusión, compromisos, próxima reunión y líneas. Nunca documentos.
 *
 * F4.1: con `dictado`, junto a "Conclusión" va el micrófono (DictarCampo): lo que se dice se reparte entre conclusión,
 * compromisos y próxima reunión y se AÑADE a lo escrito (unirCamposDictados); todo queda editable antes de confirmar.
 *
 * Spec 2026-10-15 (paquete 2): la próxima reunión se elige con los atajos o en el calendario (CalendarioMes, "Otra
 * fecha"), no escribiendo AAAA-MM-DD. Con `solo` se pintan únicamente esos campos (la tarjeta en resumen corrige uno a
 * la vez).
 */
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { CalendarioMes } from '../agenda/CalendarioMes'
import { esFechaIso, fechaLarga, hoyBogota, sumarDias } from '../../lib/fechas'
import { MAX_COMPROMISOS, MAX_CONCLUSION, MAX_FAILURE_REASON, textoResultadoDictado, unirCamposDictados } from '../../lib/propuesta'
import type { CamposDictadoResponse, LineaEjecutiva, TipoVisita } from '../../lib/tipos'
import { Campo, Chip, Grupo, Texto, useColores } from '../../lib/ui'
import { DictarCampo } from './DictarCampo'

/** Cada parte que se puede pintar sola (`solo`). */
export type CampoVisita = 'resultado' | 'conclusion' | 'compromisos' | 'proxima' | 'lineas'

export interface ValoresCampos {
  efectiva: boolean
  failure_reason: string
  conclusion: string
  compromisos: string
  /** AAAA-MM-DD o ''. */
  next_step_date: string
  lineas: string[]
}

interface Props {
  valores: ValoresCampos
  lineas: readonly LineaEjecutiva[]
  alCambiar: (cambios: Partial<ValoresCampos>) => void
  /** Mensaje de error por campo (failure_reason, conclusion, compromisos, next_step_date, lineas). */
  errorDe?: (campo: string) => string | null
  /** Micrófono junto a Conclusión (F4.1): el tipo de la visita y si la voz está disponible (configurada y con señal). */
  dictado?: { tipo: TipoVisita | null; disponible: boolean }
  /** Solo estas partes (la tarjeta en resumen corrige un campo a la vez); sin `solo`, todas. */
  solo?: readonly CampoVisita[]
}

export function CamposVisita({ valores, lineas, alCambiar, errorDe, dictado, solo }: Props) {
  const c = useColores()
  const hoy = hoyBogota()
  const ver = (parte: CampoVisita) => !solo || solo.includes(parte)
  // Lo dictado llega tarde (tras grabar y transcribir): se une con lo que haya escrito EN ESE MOMENTO.
  const ultimos = useRef(valores)
  ultimos.current = valores
  const alDictar = (campos: CamposDictadoResponse): string => {
    const actual = ultimos.current
    const unido = unirCamposDictados(actual, campos, hoyBogota())
    if (unido.agregados.length > 0) alCambiar({ conclusion: unido.conclusion, compromisos: unido.compromisos, next_step_date: unido.next_step_date })
    return textoResultadoDictado(unido)
  }
  const atajos = [
    { texto: 'Mañana', fecha: sumarDias(hoy, 1) },
    { texto: 'En 1 semana', fecha: sumarDias(hoy, 7) },
    { texto: 'En 15 días', fecha: sumarDias(hoy, 15) },
    { texto: 'En 1 mes', fecha: sumarDias(hoy, 30) },
  ]
  const proxima = valores.next_step_date.trim()
  const esAtajo = atajos.some(atajo => atajo.fecha === proxima)
  // El calendario se abre con "Otra fecha" (o si la fecha puesta no es de un atajo, p. ej. la dictada).
  const [verCalendario, setVerCalendario] = useState(() => !!proxima && !esAtajo)
  const error = (campo: string) => (errorDe ? errorDe(campo) : null)

  const campoConclusion = (
    <Campo
      etiqueta="Conclusión"
      valor={valores.conclusion}
      alCambiar={texto => alCambiar({ conclusion: texto })}
      varias
      maxLength={MAX_CONCLUSION}
      placeholder={dictado ? 'Qué pasó en la visita (sin datos de pacientes). Escríbelo o toca Dictar.' : 'Qué pasó en la visita (sin datos de pacientes)'}
      error={error('conclusion')}
    />
  )

  const alternarLinea = (id: string) => {
    const tiene = valores.lineas.includes(id)
    alCambiar({ lineas: tiene ? valores.lineas.filter(l => l !== id) : [...valores.lineas, id] })
  }

  return (
    <View style={{ gap: 14 }}>
      {ver('resultado') ? (
        <View style={{ gap: 6 }}>
          <Texto negrita>¿Fue efectiva?</Texto>
          <Grupo>
            <Chip texto="Sí, efectiva" activo={valores.efectiva} alPresionar={() => alCambiar({ efectiva: true, failure_reason: '' })} />
            <Chip texto="No efectiva" activo={!valores.efectiva} alPresionar={() => alCambiar({ efectiva: false })} />
          </Grupo>
          {!valores.efectiva ? (
            <Campo
              etiqueta="Motivo (obligatorio)"
              valor={valores.failure_reason}
              alCambiar={texto => alCambiar({ failure_reason: texto })}
              placeholder="No estaba, cancelaron la cita…"
              maxLength={MAX_FAILURE_REASON}
              error={error('failure_reason')}
              ayuda="Solo la visita efectiva suma; la no efectiva se guarda con su motivo."
            />
          ) : null}
        </View>
      ) : null}

      {ver('conclusion') ? (
        dictado ? (
          <DictarCampo tipo={dictado.tipo} disponible={dictado.disponible} alDictar={alDictar}>
            {campoConclusion}
          </DictarCampo>
        ) : (
          campoConclusion
        )
      ) : null}
      {ver('compromisos') ? (
        <Campo
          etiqueta="Compromisos"
          valor={valores.compromisos}
          alCambiar={texto => alCambiar({ compromisos: texto })}
          varias
          maxLength={MAX_COMPROMISOS}
          placeholder="Qué quedó pendiente y de quién"
          error={error('compromisos')}
        />
      ) : null}

      {ver('proxima') ? (
        <View style={{ gap: 6 }}>
          <Texto negrita>Próxima reunión</Texto>
          <Grupo>
            <Chip
              texto="Sin fecha"
              activo={!proxima}
              alPresionar={() => {
                setVerCalendario(false)
                alCambiar({ next_step_date: '' })
              }}
            />
            {atajos.map(atajo => (
              <Chip
                key={atajo.texto}
                texto={atajo.texto}
                activo={proxima === atajo.fecha}
                alPresionar={() => {
                  setVerCalendario(false)
                  alCambiar({ next_step_date: atajo.fecha })
                }}
              />
            ))}
            <Chip texto="Otra fecha" activo={verCalendario || (!!proxima && !esAtajo)} alPresionar={() => setVerCalendario(!verCalendario)} />
          </Grupo>
          {verCalendario ? (
            <CalendarioMes valor={esFechaIso(proxima) ? proxima : null} alCambiar={fecha => alCambiar({ next_step_date: fecha })} hoy={hoy} desde={hoy} />
          ) : null}
          {error('next_step_date') ? (
            <Texto peque color={c.peligro}>
              {error('next_step_date')}
            </Texto>
          ) : esFechaIso(proxima) ? (
            <Texto peque suave>
              {`Próxima reunión: ${textoFecha(proxima)}`}
            </Texto>
          ) : null}
        </View>
      ) : null}

      {ver('lineas') ? (
        <View style={{ gap: 6 }}>
          <Texto negrita>Líneas</Texto>
          {lineas.length === 0 ? (
            <Texto suave peque>
              No tienes líneas asignadas: pide a tu líder que las revise.
            </Texto>
          ) : (
            <Grupo>
              {lineas.map(linea => (
                <Chip key={linea.id} texto={linea.name} activo={valores.lineas.includes(linea.id)} alPresionar={() => alternarLinea(linea.id)} />
              ))}
            </Grupo>
          )}
          {error('lineas') ? (
            <Texto peque color={c.peligro}>
              {error('lineas')}
            </Texto>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** "jueves 22 de octubre" (o la fecha tal cual si no se puede leer). */
function textoFecha(fecha: string): string {
  try {
    return fechaLarga(fecha)
  } catch {
    return fecha
  }
}
