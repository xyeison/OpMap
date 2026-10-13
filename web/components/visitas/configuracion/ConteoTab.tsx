'use client'

// Configuración > Qué cuenta: por subtipo institucional, si suma a la meta institucional (con su peso), si tiene
// meta propia o si es solo seguimiento (config_conteo con vigencias). Las visitas médicas siempre suman a la
// meta médica con peso 1. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "Interfaz").
import { useState } from 'react'
import { valorVigente, type ConfigConteo, type ConfigVisitasResponse, type Subtipo } from '@/lib/visits-rules'
import { Chip } from '@/components/terceros/comun'
import FormularioCambio from '../FormularioCambio'
import { ClaveTarjeta } from '../LineaDeTiempo'
import TerminarValor from '../TerminarValor'
import { EditorConteo, valoresConteo, type ValorConteo } from '../editores'
import { Tarjeta, fechaLarga, mensajeCambioGuardado } from '../comun'
import { textoConteo } from '../textos'

type Abierto = { tipo: 'cambiar'; subtipo: Subtipo; inicial: ValorConteo } | { tipo: 'terminar'; fila: ConfigConteo }

const describir = (fila: ConfigConteo) => textoConteo(fila)

export default function ConteoTab({ datos, onCambio }: { datos: ConfigVisitasResponse; onCambio: (mensaje: string) => void }) {
  const { hoy, conteo, subtipos } = datos
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const ordenados = [...subtipos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div className="space-y-4 min-w-0">
      <Tarjeta className="p-4">
        <p className="text-sm text-gray-700">
          Las visitas médicas siempre suman a la meta médica con peso 1. Aquí se decide qué hace cada subtipo de visita
          institucional. Cada visita usa el valor que regía el día en que se hizo: cambiar algo hoy no cambia el pasado.
        </p>
      </Tarjeta>

      {ordenados.length === 0 ? (
        <p className="text-sm text-gray-500">No hay subtipos. Créalos en la pestaña Subtipos.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ordenados.map(subtipo => {
            const filas = conteo.filter(c => c.subtipo_id === subtipo.id)
            const apagado = subtipo.vigente_hasta !== null && subtipo.vigente_hasta < hoy
            return (
              <ClaveTarjeta
                key={subtipo.id}
                titulo={subtipo.nombre}
                subtitulo={subtipo.para_que}
                etiquetas={
                  apagado ? (
                    <Chip tono="gris" titulo={`Apagado desde el ${fechaLarga(subtipo.vigente_hasta)}`}>
                      Apagado
                    </Chip>
                  ) : undefined
                }
                filas={filas}
                hoy={hoy}
                describir={describir}
                sinValor="Sin valor hoy: no suma a ninguna meta."
                onCambiar={() => {
                  const actual = valorVigente(filas, hoy)
                  setAbierto({
                    tipo: 'cambiar',
                    subtipo,
                    inicial: actual ? { modo: actual.modo, peso: String(actual.peso) } : { modo: 'seguimiento', peso: '1' },
                  })
                }}
                onTerminar={fila => setAbierto({ tipo: 'terminar', fila })}
                puedeTerminar={fila => fila.vigente_desde > hoy}
              />
            )
          })}
        </div>
      )}

      {abierto?.tipo === 'cambiar' && (
        <FormularioCambio<ValorConteo, ConfigConteo>
          titulo={`Qué cuenta: ${abierto.subtipo.nombre}`}
          subtitulo="Visita institucional"
          tabla="config_conteo"
          hoy={hoy}
          filasTabla={conteo}
          describir={describir}
          inicial={abierto.inicial}
          editor={(valor, onCambiar) => <EditorConteo valor={valor} onCambiar={onCambiar} />}
          construir={valor => valoresConteo(abierto.subtipo.id, valor)}
          resumen={valor => textoConteo({ modo: valor.modo, peso: valor.peso || '1' })}
          onCerrar={() => setAbierto(null)}
          onGuardado={respuesta => {
            setAbierto(null)
            onCambio(mensajeCambioGuardado(respuesta.meses_recalculados))
          }}
        />
      )}

      {abierto?.tipo === 'terminar' && (
        <TerminarValor<ConfigConteo>
          tabla="config_conteo"
          fila={abierto.fila}
          filasTabla={conteo}
          hoy={hoy}
          describir={describir}
          despues="ningún valor: sus visitas no suman a ninguna meta"
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
