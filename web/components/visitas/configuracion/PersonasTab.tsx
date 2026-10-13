'use client'

// Configuración > Personas: por Ejecutivo Comercial, perfil (médica, institucional), telefónica habilitada, tope
// de telefónicas y radio propio (config_personas con vigencias; vacío = los generales) y su cuota del mes
// (GET /api/config-visitas/cuota?executive_id=&mes=). Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { useState } from 'react'
import {
  generalVigente,
  mesDe,
  valorVigente,
  type ConfigPersona,
  type ConfigVisitasResponse,
  type EjecutivaOpcion,
} from '@/lib/visits-rules'
import { Chip, claseBotonChico, claseInput } from '@/components/terceros/comun'
import CuotaPanel from '../CuotaPanel'
import FormularioCambio from '../FormularioCambio'
import { ClaveTarjeta } from '../LineaDeTiempo'
import TerminarValor from '../TerminarValor'
import { EditorPersona, valoresPersona, type ValorPersona } from '../editores'
import { Casilla, Modal, Vacio, mensajeCambioGuardado, numeroTexto } from '../comun'
import { textoPersona } from '../textos'

type Abierto =
  | { tipo: 'cambiar'; ejecutiva: EjecutivaOpcion; inicial: ValorPersona }
  | { tipo: 'terminar'; fila: ConfigPersona }
  | { tipo: 'cuota'; ejecutiva: EjecutivaOpcion }

const describir = (fila: ConfigPersona) => textoPersona(fila)

export default function PersonasTab({ datos, onCambio }: { datos: ConfigVisitasResponse; onCambio: (mensaje: string) => void }) {
  const { hoy, personas, ejecutivas, general } = datos
  const [abierto, setAbierto] = useState<Abierto | null>(null)
  const [texto, setTexto] = useState('')
  const [todas, setTodas] = useState(false)

  const radioGeneral = Number(generalVigente(general, 'radio_presencial_m', hoy))
  const topeGeneral = Number(generalVigente(general, 'telefonicas', hoy).tope_dia)
  const buscado = texto.trim().toLowerCase()
  const lista = ejecutivas
    .filter(e => todas || e.status === 'active')
    .filter(e => !buscado || e.nombre.toLowerCase().includes(buscado) || (e.zona ?? '').toLowerCase().includes(buscado))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div className="space-y-4 min-w-0">
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-3 min-w-0">
        <input
          type="search"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Buscar por nombre o zona..."
          className={claseInput}
          aria-label="Buscar Ejecutivo Comercial"
        />
        <Casilla marcada={todas} onCambiar={setTodas}>
          Mostrar también cupos por contratar e inactivos
        </Casilla>
        <p className="text-xs text-gray-500">
          Sin configuración propia, una persona tiene perfil médica e institucional, sin telefónica, radio general (
          {numeroTexto(radioGeneral)} m) y tope general de telefónicas ({topeGeneral} al día).
        </p>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="No hay Ejecutivos Comerciales que mostrar">
          {buscado ? 'Prueba con otro nombre.' : 'Créalos en Ejecutivos Comerciales.'}
        </Vacio>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lista.map(ejecutiva => {
            const filas = personas.filter(p => p.executive_id === ejecutiva.id)
            return (
              <ClaveTarjeta
                key={ejecutiva.id}
                titulo={ejecutiva.nombre}
                subtitulo={ejecutiva.zona ? `Zona ${ejecutiva.zona}` : 'Sin zona base'}
                etiquetas={
                  ejecutiva.status !== 'active' ? (
                    <Chip tono="ambar">{ejecutiva.status === 'placeholder' ? 'Por contratar' : 'Inactiva'}</Chip>
                  ) : undefined
                }
                filas={filas}
                hoy={hoy}
                describir={describir}
                sinValor="Sin configuración propia: médica e institucional, sin telefónica, radio y tope generales."
                onCambiar={() => {
                  const actual = valorVigente(filas, hoy)
                  setAbierto({
                    tipo: 'cambiar',
                    ejecutiva,
                    inicial: actual
                      ? {
                          perfil: [...actual.perfil],
                          telefonica_habilitada: actual.telefonica_habilitada,
                          tope: actual.tope_telefonicas_dia === null ? '' : String(actual.tope_telefonicas_dia),
                          radio: actual.radio_m === null ? '' : String(actual.radio_m),
                        }
                      : { perfil: ['medica', 'institucional'], telefonica_habilitada: false, tope: '', radio: '' },
                  })
                }}
                onTerminar={fila => setAbierto({ tipo: 'terminar', fila })}
                acciones={
                  <button type="button" onClick={() => setAbierto({ tipo: 'cuota', ejecutiva })} className={claseBotonChico}>
                    Cuota del mes
                  </button>
                }
              />
            )
          })}
        </div>
      )}

      {abierto?.tipo === 'cambiar' && (
        <FormularioCambio<ValorPersona, ConfigPersona>
          titulo={`Configuración de ${abierto.ejecutiva.nombre}`}
          subtitulo={abierto.ejecutiva.zona ? `Zona ${abierto.ejecutiva.zona}` : undefined}
          tabla="config_personas"
          hoy={hoy}
          filasTabla={personas}
          describir={describir}
          inicial={abierto.inicial}
          editor={(valor, onCambiar) => (
            <EditorPersona valor={valor} onCambiar={onCambiar} topeGeneral={topeGeneral} radioGeneral={radioGeneral} />
          )}
          construir={valor => valoresPersona(abierto.ejecutiva.id, valor)}
          resumen={valor =>
            textoPersona({
              perfil: valor.perfil,
              telefonica_habilitada: valor.telefonica_habilitada,
              tope_telefonicas_dia: valor.tope.trim() ? Number(valor.tope) : null,
              radio_m: valor.radio.trim() ? Number(valor.radio) : null,
            })
          }
          onCerrar={() => setAbierto(null)}
          onGuardado={respuesta => {
            setAbierto(null)
            onCambio(mensajeCambioGuardado(respuesta.meses_recalculados))
          }}
        />
      )}

      {abierto?.tipo === 'terminar' && (
        <TerminarValor<ConfigPersona>
          tabla="config_personas"
          fila={abierto.fila}
          filasTabla={personas}
          hoy={hoy}
          describir={describir}
          despues="la configuración por defecto (médica e institucional, sin telefónica, radio y tope generales)"
          onCerrar={() => setAbierto(null)}
          onHecho={mensaje => {
            setAbierto(null)
            onCambio(mensaje)
          }}
        />
      )}

      {abierto?.tipo === 'cuota' && (
        <Modal
          titulo={`Cuota de ${abierto.ejecutiva.nombre}`}
          subtitulo={abierto.ejecutiva.zona ? `Zona ${abierto.ejecutiva.zona}` : 'Sin zona base'}
          onCerrar={() => setAbierto(null)}
          ancho="sm:max-w-2xl"
        >
          <div className="p-4 sm:p-6">
            <CuotaPanel
              url={mes => `/api/config-visitas/cuota?executive_id=${encodeURIComponent(abierto.ejecutiva.id)}&mes=${mes}`}
              mesInicial={mesDe(hoy)}
              mesActual={mesDe(hoy)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
