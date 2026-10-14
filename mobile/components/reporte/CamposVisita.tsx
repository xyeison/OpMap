/**
 * Campos que la persona escribe o corrige de una visita (iguales en Reportar y en Visita para corregir el mismo
 * día): efectiva o no con su motivo, conclusión, compromisos, próxima reunión y líneas. Nunca documentos.
 */
import { View } from 'react-native'
import { sumarDias, fechaCorta, hoyBogota } from '../../lib/fechas'
import { MAX_COMPROMISOS, MAX_CONCLUSION, MAX_FAILURE_REASON } from '../../lib/propuesta'
import type { LineaEjecutiva } from '../../lib/tipos'
import { Campo, Chip, Grupo, Texto, useColores } from '../../lib/ui'

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
}

export function CamposVisita({ valores, lineas, alCambiar, errorDe }: Props) {
  const c = useColores()
  const hoy = hoyBogota()
  const atajos = [
    { texto: 'Mañana', fecha: sumarDias(hoy, 1) },
    { texto: 'En 1 semana', fecha: sumarDias(hoy, 7) },
    { texto: 'En 15 días', fecha: sumarDias(hoy, 15) },
    { texto: 'En 1 mes', fecha: sumarDias(hoy, 30) },
  ]
  const error = (campo: string) => (errorDe ? errorDe(campo) : null)

  const alternarLinea = (id: string) => {
    const tiene = valores.lineas.includes(id)
    alCambiar({ lineas: tiene ? valores.lineas.filter(l => l !== id) : [...valores.lineas, id] })
  }

  return (
    <View style={{ gap: 14 }}>
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

      <Campo
        etiqueta="Conclusión"
        valor={valores.conclusion}
        alCambiar={texto => alCambiar({ conclusion: texto })}
        varias
        maxLength={MAX_CONCLUSION}
        placeholder="Qué pasó en la visita (sin datos de pacientes)"
        error={error('conclusion')}
      />
      <Campo
        etiqueta="Compromisos"
        valor={valores.compromisos}
        alCambiar={texto => alCambiar({ compromisos: texto })}
        varias
        maxLength={MAX_COMPROMISOS}
        placeholder="Qué quedó pendiente y de quién"
        error={error('compromisos')}
      />

      <View style={{ gap: 6 }}>
        <Texto negrita>Próxima reunión</Texto>
        <Grupo>
          <Chip texto="Sin fecha" activo={!valores.next_step_date} alPresionar={() => alCambiar({ next_step_date: '' })} />
          {atajos.map(atajo => (
            <Chip key={atajo.texto} texto={atajo.texto} activo={valores.next_step_date === atajo.fecha} alPresionar={() => alCambiar({ next_step_date: atajo.fecha })} />
          ))}
        </Grupo>
        <Campo
          etiqueta="Fecha (AAAA-MM-DD)"
          valor={valores.next_step_date}
          alCambiar={texto => alCambiar({ next_step_date: texto.trim() })}
          placeholder={sumarDias(hoy, 7)}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          maxLength={10}
          error={error('next_step_date')}
          ayuda={/^\d{4}-\d{2}-\d{2}$/.test(valores.next_step_date) ? safeFechaCorta(valores.next_step_date) : null}
        />
      </View>

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
    </View>
  )
}

function safeFechaCorta(fecha: string): string | null {
  try {
    return fechaCorta(fecha)
  } catch {
    return null
  }
}
