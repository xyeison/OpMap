'use client'

// Configuración > General: radio, plazo de gracia, días hábiles de la semana (0, ½, 1), tope por médico,
// telefónicas, aprobación de días libres (si se exige y quién aprueba), motivos de día libre (lista editable) y
// factor del primer mes. Cada parámetro es una línea de tiempo en config_general; su editor es legible (sin JSON).
// Las alertas de mezcla se configurarán con los indicadores (F5). Contrato:
// docs/fases/fase7-visitas-f2-config-calendario.md (secciones "Base de datos" e "Interfaz").
import { useState } from 'react'
import {
  GENERAL_POR_DEFECTO,
  PARAMETROS_GENERALES,
  generalVigente,
  type CambioConfigResponse,
  type ConfigGeneral,
  type ConfigVisitasResponse,
  type DiasHabilesSemana,
  type ParametroGeneral,
} from '@/lib/visits-rules'
import FormularioCambio from '../FormularioCambio'
import { ClaveTarjeta } from '../LineaDeTiempo'
import TerminarValor from '../TerminarValor'
import {
  EditorAprobacion,
  EditorDiasSemana,
  EditorMotivos,
  EditorNumero,
  EditorTelefonicas,
  filasMotivos,
  valorMotivos,
  valorTelefonicas,
  type FilaMotivo,
  type ValorAprobacion,
  type ValorTelefonicas,
} from '../editores'
import { leerNumero, mensajeCambioGuardado, numeroTexto } from '../comun'
import { AYUDA_GENERAL, textoDiasSemana, textoGeneral } from '../textos'

/** Parámetros que se editan aquí (alertas_mezcla espera a los indicadores). */
const EDITABLES = PARAMETROS_GENERALES.filter(p => p.valor !== 'alertas_mezcla')

const describir = (fila: ConfigGeneral) => textoGeneral(fila.parametro, fila.valor)

type Abierto = { tipo: 'cambiar'; parametro: ParametroGeneral; titulo: string } | { tipo: 'terminar'; fila: ConfigGeneral }

export default function GeneralTab({ datos, onCambio }: { datos: ConfigVisitasResponse; onCambio: (mensaje: string) => void }) {
  const { hoy, general } = datos
  const [abierto, setAbierto] = useState<Abierto | null>(null)

  const guardado = (respuesta: CambioConfigResponse) => {
    setAbierto(null)
    onCambio(mensajeCambioGuardado(respuesta.meses_recalculados))
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {EDITABLES.map(parametro => (
          <ClaveTarjeta
            key={parametro.valor}
            titulo={parametro.etiqueta}
            filas={general.filter(fila => fila.parametro === parametro.valor)}
            hoy={hoy}
            describir={describir}
            sinValor={`Sin valor guardado: se usa ${textoGeneral(parametro.valor, GENERAL_POR_DEFECTO[parametro.valor]).toLowerCase()}.`}
            ayuda={AYUDA_GENERAL[parametro.valor]}
            onCambiar={() => setAbierto({ tipo: 'cambiar', parametro: parametro.valor, titulo: parametro.etiqueta })}
            onTerminar={fila => setAbierto({ tipo: 'terminar', fila })}
            puedeTerminar={fila => fila.vigente_desde > hoy}
          />
        ))}
      </div>

      {abierto?.tipo === 'cambiar' && (
        <FormularioGeneral
          parametro={abierto.parametro}
          titulo={abierto.titulo}
          datos={datos}
          onCerrar={() => setAbierto(null)}
          onGuardado={guardado}
        />
      )}

      {abierto?.tipo === 'terminar' && (
        <TerminarValor<ConfigGeneral>
          tabla="config_general"
          fila={abierto.fila}
          filasTabla={general}
          hoy={hoy}
          describir={describir}
          despues={`el valor por defecto (${textoGeneral(abierto.fila.parametro, GENERAL_POR_DEFECTO[abierto.fila.parametro]).toLowerCase()})`}
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            onCambio(mensaje)
          }}
        />
      )}
    </div>
  )
}

/** El FormularioCambio de un parámetro general, con el editor que le corresponde. */
function FormularioGeneral({
  parametro,
  titulo,
  datos,
  onCerrar,
  onGuardado,
}: {
  parametro: ParametroGeneral
  titulo: string
  datos: ConfigVisitasResponse
  onCerrar: () => void
  onGuardado: (respuesta: CambioConfigResponse) => void
}) {
  const { hoy, general } = datos
  const comunes = {
    titulo,
    subtitulo: 'Parámetro general',
    tabla: 'config_general' as const,
    hoy,
    filasTabla: general,
    describir,
    onCerrar,
    onGuardado,
  }

  switch (parametro) {
    case 'radio_presencial_m':
    case 'plazo_gracia_horas':
    case 'tope_visitas_medico_dia': {
      const unidad = parametro === 'radio_presencial_m' ? 'metros' : parametro === 'plazo_gracia_horas' ? 'horas' : 'por médico al día'
      const etiqueta =
        parametro === 'radio_presencial_m' ? 'Radio' : parametro === 'plazo_gracia_horas' ? 'Plazo de gracia' : 'Visitas que suman'
      const ayuda =
        parametro === 'radio_presencial_m'
          ? 'Entero entre 50 y 5000.'
          : parametro === 'plazo_gracia_horas'
            ? 'Entero entre 0 y 720. Cuenta desde que termina el día libre; rige para lo que se registre desde que empieza a regir.'
            : 'Entero entre 1 y 10.'
      return (
        <FormularioCambio<string, ConfigGeneral>
          {...comunes}
          inicial={String(generalVigente(general, parametro, hoy))}
          editor={(valor, onCambiar) => (
            <EditorNumero valor={valor} onCambiar={onCambiar} etiqueta={etiqueta} unidad={unidad} ayuda={ayuda} />
          )}
          construir={valor => {
            const numero = leerNumero(valor)
            return numero === null ? `Escribe el valor (${etiqueta.toLowerCase()})` : { parametro, valor: numero }
          }}
          resumen={valor => `${numeroTexto(leerNumero(valor))} ${unidad}`}
        />
      )
    }
    case 'primer_mes_factor':
      return (
        <FormularioCambio<string, ConfigGeneral>
          {...comunes}
          inicial={String(Math.round(Number(generalVigente(general, 'primer_mes_factor', hoy)) * 100))}
          editor={(valor, onCambiar) => (
            <EditorNumero
              valor={valor}
              onCambiar={onCambiar}
              etiqueta="Parte de la meta en el mes de entrada"
              unidad="%"
              ayuda="Entre 0 y 100. Con 50 %, quien entra el 10 de un mes tiene la mitad de la meta los días que trabaje ese mes."
            />
          )}
          construir={valor => {
            const numero = leerNumero(valor)
            if (numero === null) return 'Escribe el porcentaje'
            if (numero < 0 || numero > 100) return 'El porcentaje va de 0 a 100'
            return { parametro, valor: Math.round(numero * 100) / 10000 }
          }}
          resumen={valor => `${numeroTexto(leerNumero(valor))} % de la meta en el mes de entrada`}
        />
      )
    case 'dias_habiles_semana':
      return (
        <FormularioCambio<DiasHabilesSemana, ConfigGeneral>
          {...comunes}
          inicial={{ ...generalVigente(general, 'dias_habiles_semana', hoy) }}
          editor={(valor, onCambiar) => <EditorDiasSemana valor={valor} onCambiar={onCambiar} />}
          construir={valor => ({ parametro, valor })}
          resumen={valor => textoDiasSemana(valor)}
        />
      )
    case 'telefonicas': {
      const actual = generalVigente(general, 'telefonicas', hoy)
      return (
        <FormularioCambio<ValorTelefonicas, ConfigGeneral>
          {...comunes}
          inicial={{ tope_dia: String(actual.tope_dia), peso: String(actual.peso), medios: [...actual.medios] }}
          editor={(valor, onCambiar) => <EditorTelefonicas valor={valor} onCambiar={onCambiar} />}
          construir={valor => {
            const telefonicas = valorTelefonicas(valor)
            return typeof telefonicas === 'string' ? telefonicas : { parametro, valor: telefonicas }
          }}
        />
      )
    }
    case 'aprobacion_dias_libres': {
      const actual = generalVigente(general, 'aprobacion_dias_libres', hoy)
      return (
        <FormularioCambio<ValorAprobacion, ConfigGeneral>
          {...comunes}
          inicial={{ requiere: actual.requiere, aprueban: [...actual.aprueban] }}
          editor={(valor, onCambiar) => <EditorAprobacion valor={valor} onCambiar={onCambiar} />}
          construir={valor => ({ parametro, valor: { requiere: valor.requiere, aprueban: valor.aprueban } })}
          resumen={valor => textoGeneral('aprobacion_dias_libres', valor)}
        />
      )
    }
    case 'motivos_dia_libre':
      return (
        <FormularioCambio<FilaMotivo[], ConfigGeneral>
          {...comunes}
          inicial={filasMotivos(generalVigente(general, 'motivos_dia_libre', hoy))}
          editor={(valor, onCambiar) => <EditorMotivos valor={valor} onCambiar={onCambiar} />}
          construir={valor => {
            const motivos = valorMotivos(valor)
            return typeof motivos === 'string' ? motivos : { parametro, valor: motivos }
          }}
          resumen={valor => `${valor.length} ${valor.length === 1 ? 'motivo' : 'motivos'}`}
        />
      )
    default:
      return null
  }
}
