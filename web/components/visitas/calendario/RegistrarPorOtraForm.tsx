'use client'

// Días libres: quien aprueba (directora, recursos humanos, admin) registra un día libre por otra persona.
// POST /api/dias-libres (diaLibrePorOtraSchema): día hábil para ella, sin duplicado (409), motivo de la lista
// vigente; dentro del plazo de gracia o, fuera, con justificación obligatoria (queda marcado fuera de plazo).
// Queda aprobado de una vez. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (decisiones 2 y 3).
import { useState, type FormEvent } from 'react'
import { diaLibrePorOtraSchema } from '@/lib/visits-config-schemas'
import {
  FRACCIONES_DIA_LIBRE,
  MOTIVO_MINIMO,
  esFechaIso,
  etiquetaFraccionDiaLibre,
  fechaHoraBogota,
  puedeRegistrarDiaLibre,
  venceRegistroDiaLibre,
  type FraccionDiaLibre,
  type MotivoDiaLibre,
} from '@/lib/visits-rules'
import {
  AvisoAtencion,
  AvisoError,
  PieFormulario,
  claseInput,
  claseLabel,
  mensajeError,
  mensajeExcepcion,
  pedirJson,
  primerErrorZod,
} from '@/components/terceros/comun'
import { CampoMotivo, Modal, Segmentado, conMayuscula, fechaLarga } from '../comun'

export interface PersonaOpcion {
  id: string
  nombre: string
  zona: string | null
}

/** "martes 13 de octubre a las 23:59": el último minuto en que todavía se puede registrar. */
export function textoVence(venceAt: Date): string {
  const { fecha, hora } = fechaHoraBogota(new Date(venceAt.getTime() - 60 * 1000))
  return `${fechaLarga(fecha)} a las ${hora}`
}

export default function RegistrarPorOtraForm({
  personas,
  motivos,
  plazoHoras,
  hoy,
  onCerrar,
  onHecho,
}: {
  personas: readonly PersonaOpcion[]
  motivos: readonly MotivoDiaLibre[]
  plazoHoras: number
  hoy: string
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}) {
  const [persona, setPersona] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [fraccion, setFraccion] = useState<FraccionDiaLibre>(1)
  const [motivo, setMotivo] = useState(motivos[0]?.codigo ?? '')
  const [nota, setNota] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const fechaValida = esFechaIso(fecha)
  const venceAt = fechaValida ? venceRegistroDiaLibre(fecha, plazoHoras) : null
  const fueraDePlazo = venceAt !== null && Date.now() >= venceAt.getTime()
  const otroProblema = fechaValida && !fueraDePlazo ? puedeRegistrarDiaLibre({ fecha, ahora: new Date(), plazoHoras }).error : null
  const faltaJustificacion = fueraDePlazo && justificacion.trim().length < MOTIVO_MINIMO

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (faltaJustificacion) {
      setError(`Está fuera del plazo de gracia: escribe la justificación (al menos ${MOTIVO_MINIMO} caracteres)`)
      return
    }
    const validacion = diaLibrePorOtraSchema.safeParse({
      executive_id: persona,
      fecha,
      fraccion,
      motivo,
      nota: nota.trim() || null,
      justificacion: justificacion.trim() || null,
    })
    if (!validacion.success) {
      setError(persona ? primerErrorZod(validacion.error) : 'Elige el Ejecutivo Comercial')
      return
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson('/api/dias-libres', { method: 'POST', json: validacion.data })
      if (!respuesta.ok) throw new Error(mensajeError(respuesta, 'No se pudo registrar el día libre'))
      const nombre = personas.find(p => p.id === persona)?.nombre ?? 'la persona'
      onHecho(
        `Se registró ${etiquetaFraccionDiaLibre(fraccion).toLowerCase()} libre de ${nombre} el ${fechaLarga(fecha)}, ya aprobado${
          fueraDePlazo ? ' (marcado fuera de plazo)' : ''
        }.`
      )
    } catch (err) {
      setError(mensajeExcepcion(err, 'No se pudo registrar el día libre'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Registrar día libre por otra persona" subtitulo="Queda aprobado de una vez" onCerrar={guardando ? () => undefined : onCerrar} ancho="sm:max-w-xl">
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="p-4 sm:p-6 space-y-4 flex-1 min-w-0">
          <div className="min-w-0">
            <label htmlFor="otra-persona" className={claseLabel}>
              Ejecutivo Comercial <span className="text-red-500">*</span>
            </label>
            <select id="otra-persona" value={persona} onChange={e => setPersona(e.target.value)} className={claseInput}>
              <option value="">Elige...</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.zona ? `${p.nombre} · ${p.zona}` : p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="otra-fecha" className={claseLabel}>
                Fecha <span className="text-red-500">*</span>
              </label>
              <input id="otra-fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} required />
              {fechaValida && <p className="mt-1 text-xs text-gray-500">{conMayuscula(fechaLarga(fecha))}</p>}
            </div>
            <div className="min-w-0">
              <span className={claseLabel}>Duración</span>
              <Segmentado opciones={FRACCIONES_DIA_LIBRE} valor={fraccion} onCambiar={setFraccion} etiqueta="Duración del día libre" />
            </div>
          </div>

          {venceAt && (
            <p className={`text-xs ${fueraDePlazo ? 'text-amber-800' : 'text-gray-500'}`}>
              {fueraDePlazo
                ? `Fuera del plazo de gracia: se podía registrar hasta el ${textoVence(venceAt)}.`
                : `Dentro del plazo de gracia (hasta el ${textoVence(venceAt)}).`}
            </p>
          )}
          {otroProblema && <AvisoAtencion>{otroProblema}</AvisoAtencion>}

          <div className="min-w-0">
            <label htmlFor="otra-motivo" className={claseLabel}>
              Motivo <span className="text-red-500">*</span>
            </label>
            <select id="otra-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} className={claseInput}>
              {motivos.map(m => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="otra-nota" className={claseLabel}>
              Nota <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea id="otra-nota" value={nota} maxLength={500} rows={2} onChange={e => setNota(e.target.value)} className={claseInput} />
          </div>

          <CampoMotivo
            valor={justificacion}
            onCambiar={setJustificacion}
            obligatorio={fueraDePlazo}
            etiqueta="Justificación"
            placeholder="Por ejemplo, la incapacidad llegó tarde"
            maximo={500}
            id="otra-justificacion"
            ayuda={fueraDePlazo ? 'Obligatoria porque está fuera del plazo: queda en el registro.' : 'Solo hace falta si está fuera del plazo de gracia.'}
          />

          {error && <AvisoError>{error}</AvisoError>}
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Registrar día libre" deshabilitado={faltaJustificacion || Boolean(otroProblema)} />
      </form>
    </Modal>
  )
}
