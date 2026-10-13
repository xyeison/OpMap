'use client'

// Calendario: añadir un día de empresa o de ciudad (no hábil o hábil). POST /api/calendario { fecha, alcance:
// 'empresa' | 'ciudad', municipality_id?, tipo, nombre } → origen 'manual'; 409 si ya hay un día activo igual.
// Los festivos nacionales los pone el sistema. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { useState, type FormEvent } from 'react'
import { calendarioDiaCreateSchema } from '@/lib/visits-config-schemas'
import { TIPOS_DIA_CALENDARIO, esFechaIso, type TipoDiaCalendario } from '@/lib/visits-rules'
import {
  AvisoError,
  PieFormulario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
} from '@/components/terceros/comun'
import MunicipioSelector from '@/components/terceros/MunicipioSelector'
import { Modal, Segmentado, conMayuscula, fechaLarga } from '../comun'

type Alcance = 'empresa' | 'ciudad'

const ALCANCES: readonly { valor: Alcance; etiqueta: string }[] = [
  { valor: 'empresa', etiqueta: 'Toda la empresa' },
  { valor: 'ciudad', etiqueta: 'Una ciudad' },
]

export default function DiaCalendarioForm({
  fechaInicial,
  municipioInicial,
  onCerrar,
  onCreado,
}: {
  fechaInicial: string
  municipioInicial: string | null
  onCerrar: () => void
  onCreado: (mensaje: string) => void
}) {
  const [fecha, setFecha] = useState(fechaInicial)
  const [alcance, setAlcance] = useState<Alcance>(municipioInicial ? 'ciudad' : 'empresa')
  const [municipio, setMunicipio] = useState<string | null>(municipioInicial)
  const [ciudad, setCiudad] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoDiaCalendario>('no_habil')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const validacion = calendarioDiaCreateSchema.safeParse({
      fecha,
      alcance,
      municipality_id: alcance === 'ciudad' ? municipio : null,
      tipo,
      nombre,
    })
    if (!validacion.success) {
      setError(primerErrorZod(validacion.error))
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson('/api/calendario', { method: 'POST', json: validacion.data })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo añadir el día'))
      const donde = alcance === 'ciudad' ? `para ${ciudad ?? 'la ciudad elegida'}` : 'para toda la empresa'
      onCreado(
        `Se añadió «${validacion.data.nombre}» el ${fechaLarga(validacion.data.fecha)} ${donde} (${
          tipo === 'habil' ? 'hábil' : 'no hábil'
        }).`
      )
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo añadir el día'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Añadir día al calendario" subtitulo="Día de empresa o de ciudad" onCerrar={guardando ? () => undefined : onCerrar} ancho="sm:max-w-xl">
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-4 flex-1 min-w-0">
          <div className="min-w-0">
            <label htmlFor="dia-fecha" className={claseLabel}>
              Fecha <span className="text-red-500">*</span>
            </label>
            <input id="dia-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} required />
            {esFechaIso(fecha) && <p className="mt-1 text-xs text-gray-500">{conMayuscula(fechaLarga(fecha))}</p>}
          </div>

          <div className="min-w-0">
            <span className={claseLabel}>A quién aplica</span>
            <Segmentado opciones={ALCANCES} valor={alcance} onCambiar={setAlcance} etiqueta="A quién aplica" />
            <p className="mt-1 text-xs text-gray-500">
              {alcance === 'ciudad'
                ? 'Solo a quienes trabajan en esa ciudad (la ciudad base de su zona). Manda sobre el día de empresa y el festivo.'
                : 'A todas las personas. Manda sobre el festivo nacional.'}
            </p>
          </div>

          {alcance === 'ciudad' && (
            <MunicipioSelector
              valor={municipio}
              onCambiar={(codigo, nombreMunicipio) => {
                setMunicipio(codigo)
                setCiudad(nombreMunicipio)
              }}
              etiqueta="Ciudad"
              requerido
            />
          )}

          <div className="min-w-0">
            <span className={claseLabel}>Tipo de día</span>
            <Segmentado opciones={TIPOS_DIA_CALENDARIO} valor={tipo} onCambiar={setTipo} etiqueta="Tipo de día" />
            <p className="mt-1 text-xs text-gray-500">
              {tipo === 'no_habil'
                ? 'No hábil: ese día no genera cuota (por ejemplo, 24 de diciembre o el día de la familia).'
                : 'Hábil: ese día genera cuota aunque sea festivo o fin de semana.'}
            </p>
          </div>

          <div className="min-w-0">
            <label htmlFor="dia-nombre" className={claseLabel}>
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="dia-nombre"
              value={nombre}
              maxLength={120}
              onChange={e => setNombre(e.target.value)}
              className={claseInput}
              placeholder={alcance === 'ciudad' ? 'Por ejemplo, Día cívico' : 'Por ejemplo, Día de la familia'}
            />
          </div>

          {error && <AvisoError>{error}</AvisoError>}
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Añadir día" />
      </form>
    </Modal>
  )
}
