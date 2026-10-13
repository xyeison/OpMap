'use client'

// "Contratar" en una vacante de /executives: la misma fila pasa a ser la persona contratada (nombre, email y fecha de
// ingreso) y conserva todo lo que la vacante tenía (zona, líneas, médicos, ajustes manuales y nombre del territorio).
// Si ya hay un usuario de OpMap con ese email, la API lo enlaza.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. API: POST /api/executives/[id]/contratar
// (executives:edit; cuerpo validado por contratarSchema de lib/traspaso-schemas.ts).
import { useMemo, useState } from 'react'
import {
  AvisoError,
  Chip,
  claseInput,
  claseLabel,
  hoyEnBogota,
  mensajeError,
  mensajeExcepcion,
  Modal,
  pedirJson,
  PieFormulario,
  primerErrorZod,
} from '@/components/terceros/comun'
import { NOMBRE_MAX } from '@/lib/traspaso'
import { contratarSchema } from '@/lib/traspaso-schemas'
import type { BusinessLine, Executive } from '@/lib/types/lines'
import { zoneLabel, type ZoneOption } from './shared'
import { executiveDe } from './traspaso-ui'

interface ContratarDialogProps {
  vacante: Executive
  /** Todo el equipo, para avisar antes de enviar si el email ya es de otra persona. */
  executives: Executive[]
  lines: BusinessLine[]
  zones: ZoneOption[]
  onCerrar: () => void
  /**
   * Contratada: la fila actualizada si la API la devuelve (si no, null y la página recarga) y si quedó enlazada a un
   * usuario de OpMap (null si la API no lo dice).
   */
  onHecho: (executive: Executive | null, nombre: string, usuarioEnlazado: boolean | null) => void
}

export default function ContratarDialog({ vacante, executives, lines, zones, onCerrar, onHecho }: ContratarDialogProps) {
  const hoy = useMemo(() => hoyEnBogota(), [])
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState(vacante.email ?? '')
  const [fechaIngreso, setFechaIngreso] = useState(hoy)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const lineById = useMemo(() => new Map(lines.map(line => [line.id, line])), [lines])
  const zona = vacante.base_kam_id ? zones.find(item => item.id === vacante.base_kam_id) : undefined
  const nombreZona = zona ? zoneLabel(zona.name) : vacante.base_kam_name ? zoneLabel(vacante.base_kam_name) : 'sin zona base'

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    const datos = { full_name: nombre, email: email.trim() || null, fecha_ingreso: fechaIngreso || null }
    const validado = contratarSchema.safeParse(datos)
    if (!validado.success) {
      setError(primerErrorZod(validado.error))
      return
    }
    if (validado.data.email) {
      const enUso = executives.find(
        executive => executive.id !== vacante.id && (executive.email ?? '').trim().toLowerCase() === validado.data.email
      )
      if (enUso) {
        setError(`El email ${validado.data.email} ya es de ${enUso.full_name}`)
        return
      }
    }
    setGuardando(true)
    try {
      const respuesta = await pedirJson(`/api/executives/${vacante.id}/contratar`, { method: 'POST', json: datos })
      if (!respuesta.ok) {
        setError(mensajeError(respuesta, 'No se pudo contratar'))
        setGuardando(false)
        return
      }
      const enlazado = (respuesta.data as { usuario_enlazado?: unknown } | null)?.usuario_enlazado
      onHecho(executiveDe<Executive>(respuesta.data), validado.data.full_name, typeof enlazado === 'boolean' ? enlazado : null)
    } catch (err: unknown) {
      setError(mensajeExcepcion(err, 'No se pudo contratar'))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Contratar" subtitulo={vacante.full_name} onCerrar={() => !guardando && onCerrar()} ancho="sm:max-w-lg">
      <form onSubmit={enviar} className="flex flex-col min-h-full">
        <div className="flex-1 px-4 sm:px-6 py-4 space-y-4 min-w-0">
          <p className="text-sm text-gray-700">
            La vacante pasa a ser la persona contratada y <strong>conserva todo lo que tenía</strong>: su zona, sus
            líneas, sus médicos, sus ajustes manuales y el nombre de su territorio. Si ya existe un usuario de OpMap con
            ese email, se enlaza.
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm min-w-0">
            <div className="text-gray-600">Zona: {nombreZona}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vacante.lines.length === 0 ? (
                <span className="text-gray-400">Sin líneas</span>
              ) : (
                vacante.lines.map(id => <Chip key={id}>{lineById.get(id)?.name ?? 'Línea desconocida'}</Chip>)
              )}
            </div>
          </div>

          {error && <AvisoError>{error}</AvisoError>}

          <div className="min-w-0">
            <label className={claseLabel} htmlFor="contratar-nombre">
              Nombre completo <span className="text-red-500">*</span>
            </label>
            <input
              id="contratar-nombre"
              type="text"
              value={nombre}
              onChange={event => setNombre(event.target.value)}
              maxLength={NOMBRE_MAX}
              className={claseInput}
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label className={claseLabel} htmlFor="contratar-email">
              Email
            </label>
            <input
              id="contratar-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              maxLength={320}
              placeholder="nombre@vgmedical.com.co"
              className={claseInput}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">Opcional. Con el email se enlaza su usuario de OpMap si ya existe.</p>
          </div>
          <div className="min-w-0">
            <label className={claseLabel} htmlFor="contratar-fecha">
              Fecha de ingreso
            </label>
            <input
              id="contratar-fecha"
              type="date"
              value={fechaIngreso}
              onChange={event => setFechaIngreso(event.target.value)}
              className={`${claseInput} sm:max-w-xs`}
            />
          </div>
        </div>
        <PieFormulario onCancelar={onCerrar} guardando={guardando} textoGuardar="Contratar" />
      </form>
    </Modal>
  )
}
