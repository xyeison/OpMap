'use client'

import { useState } from 'react'
import { CAPA_MODAL } from '@/components/terceros/comun'
import type { BusinessLine, Executive, ExecutiveStatus } from '@/lib/types/lines'
import { avisoCoberturaDe } from './traspaso-ui'
import {
  EXECUTIVE_PALETTE,
  executiveColor,
  HEX_COLOR_RE,
  readError,
  STATUS_LABELS,
  zoneLabel,
  type ZoneOption,
} from './shared'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Zonas por línea (spec 2026-10-23): "Líneas permitidas", la restricción de la dirección sobre qué líneas puede tener
// la persona o vacante (vacío = sin restricción; con valores = solo esas; la API de líneas rechaza con 409 las demás y
// PATCH exige lines ⊆ lineas_permitidas). GET /api/executives aún puede no traer el campo (lo añade la API de esa misma
// spec), por eso la intersección local en vez de tocar lib/types/lines.ts.
type ExecutiveConPermitidas = Executive & { lineas_permitidas?: string[] | null }

interface ExecutiveModalProps {
  executive: Executive | null // null = crear
  zones: ZoneOption[] // todas las zonas (activas e inactivas)
  lines: BusinessLine[]
  onClose: () => void
  /** aviso: el cambio se guardó pero la cobertura no se pudo recalcular (la página lo muestra). */
  onSaved: (executive: Executive, aviso: string | null) => void
  /**
   * Traspaso (spec 2026-10-12): si al editar se desmarca una línea, se ofrece abrir el asistente "Traspasar" con esas
   * líneas para pasar sus médicos y zonas. Sin esto (sin permiso executives:transfer) solo se avisa.
   */
  onTraspasar?: (executive: Executive, lineasQuitadas: string[]) => void
  /**
   * "Ver" (dueño, 2026-10-29): la misma ficha con todos los campos bloqueados y solo "Cerrar", para quien consulta sin
   * permiso de editar (líderes de negocio, Ejecutivos Comerciales, solo lectura).
   */
  soloLectura?: boolean
}

export default function ExecutiveModal({ executive, zones, lines, onClose, onSaved, onTraspasar, soloLectura = false }: ExecutiveModalProps) {
  const isEdit = executive !== null
  const [fullName, setFullName] = useState(executive?.full_name ?? '')
  const [email, setEmail] = useState(executive?.email ?? '')
  const [company, setCompany] = useState(executive?.company ?? 'VG Medical')
  const [baseKamId, setBaseKamId] = useState(executive?.base_kam_id ?? '')
  const [status, setStatus] = useState<ExecutiveStatus>(executive?.status ?? 'active')
  const [selectedLines, setSelectedLines] = useState<string[]>(executive?.lines ?? [])
  // Líneas permitidas por la dirección: ids de business_lines; vacío = sin restricción
  const [allowedLines, setAllowedLines] = useState<string[]>(
    (executive as ExecutiveConPermitidas | null)?.lineas_permitidas ?? []
  )
  const [odooId, setOdooId] = useState(executive?.odoo_employee_id != null ? String(executive.odoo_employee_id) : '')
  const [notes, setNotes] = useState(executive?.notes ?? '')
  // Fase 2: color en el mapa por línea (la API lo devuelve como `color`)
  const initialColor = executive ? executiveColor(executive) : null
  const [color, setColor] = useState(initialColor ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Zona base: solo zonas activas, más la actual si quedó inactiva (para no perderla al editar)
  const zoneOptions = zones
    .filter(zone => zone.active || zone.id === executive?.base_kam_id)
    .sort((a, b) => zoneLabel(a.name).localeCompare(zoneLabel(b.name), 'es'))

  // Estados elegibles: "inactiva" solo aparece si ya lo está (la baja se hace con "Dar de baja")
  const statusOptions: ExecutiveStatus[] =
    executive?.status === 'inactive' ? ['active', 'placeholder', 'inactive'] : ['active', 'placeholder']

  // Líneas que llevaba y se desmarcaron: al guardar, sus médicos de esas líneas quedan sin visitante ("ya no está")
  const removedLines =
    executive && executive.status !== 'inactive' ? executive.lines.filter(lineId => !selectedLines.includes(lineId)) : []
  const removedLineNames = removedLines.map(lineId => lines.find(line => line.id === lineId)?.name ?? 'una línea')

  const toggleLine = (lineId: string) => {
    setSelectedLines(prev => (prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]))
  }

  const toggleAllowedLine = (lineId: string) => {
    setAllowedLines(prev => (prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]))
  }

  // Líneas que lleva (marcadas arriba) y que la restricción no permite: la API responde 400, así que se avisa antes
  const linesOutsideAllowed = allowedLines.length > 0 ? selectedLines.filter(lineId => !allowedLines.includes(lineId)) : []
  const lineName = (lineId: string) => lines.find(line => line.id === lineId)?.name ?? 'una línea'

  const handleSubmit = async (e: React.FormEvent) => {
    if (soloLectura) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    setError('')

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()
    const trimmedCompany = company.trim()
    const trimmedOdoo = odooId.trim()

    if (!trimmedName) return setError('El nombre es requerido')
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) return setError('El correo no es válido')
    if (!trimmedCompany) return setError('La empresa es requerida')
    if (!baseKamId) return setError('Selecciona la zona base')

    const trimmedColor = color.trim()
    if (trimmedColor && !HEX_COLOR_RE.test(trimmedColor)) {
      return setError('El color debe tener el formato #RRGGBB')
    }

    let odooEmployeeId: number | null = null
    if (trimmedOdoo) {
      const parsed = Number(trimmedOdoo)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return setError('El ID de empleado de Odoo debe ser un número entero positivo')
      }
      odooEmployeeId = parsed
    }

    if (linesOutsideAllowed.length > 0) {
      return setError(
        `Las líneas asignadas deben estar entre las permitidas: ${linesOutsideAllowed.map(lineName).join(', ')} no lo ${
          linesOutsideAllowed.length === 1 ? 'está' : 'están'
        }. Permítela o quítasela.`
      )
    }

    const body: Record<string, unknown> = {
      full_name: trimmedName,
      email: trimmedEmail || null,
      company: trimmedCompany,
      base_kam_id: baseKamId,
      status,
      lines: selectedLines,
      odoo_employee_id: odooEmployeeId,
      notes: notes.trim() || null,
      // null = sin restricción (la API borra las filas de executive_allowed_lines)
      lineas_permitidas: allowedLines.length > 0 ? allowedLines : null,
    }
    // El color solo se envía si se eligió uno (al crear) o si cambió (al editar)
    const normalizedColor = trimmedColor.toLowerCase()
    if (normalizedColor && normalizedColor !== (initialColor ?? '').toLowerCase()) {
      body.color = normalizedColor
    }

    setSaving(true)
    try {
      const response = await fetch(isEdit ? `/api/executives/${executive.id}` : '/api/executives', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(await readError(response, 'Error al guardar la ejecutiva'))
      const data = await response.json().catch(() => null)
      if (!data || !data.executive || typeof data.executive.id !== 'string') {
        throw new Error('Respuesta inesperada del servidor')
      }
      onSaved(data.executive as Executive, avisoCoberturaDe(data))
    } catch (err: unknown) {
      console.error('Error guardando la ejecutiva:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar la ejecutiva')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent'

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 ${CAPA_MODAL} flex items-center justify-center p-4`}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-white">
            {soloLectura ? executive?.full_name ?? 'Ejecutivo Comercial' : isEdit ? 'Editar ejecutiva' : 'Nueva ejecutiva'}
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          {soloLectura && (
            <p className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700">Solo lectura: tu perfil puede ver esta ficha, no cambiarla.</p>
          )}

          {/* En "Ver", un fieldset deshabilitado bloquea todos los campos y botones de la ficha */}
          <fieldset disabled={soloLectura} className="contents space-y-5">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                maxLength={200}
                placeholder="Ej: Nueva Barranquilla"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                maxLength={320}
                placeholder="nombre@vgmedical.com.co"
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">Opcional para vacantes.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                maxLength={120}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zona base <span className="text-red-500">*</span>
              </label>
              <select value={baseKamId} onChange={e => setBaseKamId(e.target.value)} className={inputClass}>
                <option value="">Selecciona una zona</option>
                {zoneOptions.map(zone => (
                  <option key={zone.id} value={zone.id}>
                    {zoneLabel(zone.name)}
                    {zone.active ? '' : ' (inactiva)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ExecutiveStatus)}
                className={inputClass}
              >
                {statusOptions.map(option => (
                  <option key={option} value={option}>
                    {STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID de empleado en Odoo</label>
              <input
                type="number"
                min={1}
                step={1}
                value={odooId}
                onChange={e => setOdooId(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Líneas que lleva</span>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500">No hay líneas de negocio configuradas.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lines.map(line => (
                  <label
                    key={line.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedLines.includes(line.id) ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLines.includes(line.id)}
                      onChange={() => toggleLine(line.id)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
                    />
                    <span className="text-sm text-gray-900">
                      {line.name}
                      {!line.active && <span className="text-xs text-gray-400"> (inactiva)</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {removedLines.length > 0 && executive && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="min-w-0 break-words">
                  Le quitas {removedLineNames.join(', ')}. Si guardas así, sus médicos de{' '}
                  {removedLines.length === 1 ? 'esa línea' : 'esas líneas'} quedan sin visitante y la cobertura deja de
                  darle esas zonas. <strong>Para pasar sus médicos y zonas usa Traspasar.</strong>
                  {!onTraspasar && ' (Lo puede hacer un administrador o el director comercial.)'}
                </p>
                {onTraspasar && (
                  <button
                    type="button"
                    onClick={() => onTraspasar(executive, removedLines)}
                    disabled={saving}
                    className="shrink-0 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
                    title="Abre el asistente con estas líneas; los demás cambios de este formulario no se guardan"
                  >
                    Traspasar
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">Líneas permitidas (restricción de la dirección)</span>
            <p className="text-xs text-gray-500 mb-2">
              Toca una línea para permitirla o quitarla (etiquetas). Sin ninguna marcada, puede tener cualquier línea y cualquier líder
              puede darle la suya desde Zonas. Las líneas asignadas deben estar entre las permitidas.
            </p>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500">No hay líneas de negocio configuradas.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Líneas permitidas">
                {lines.map(line => {
                  const permitida = allowedLines.includes(line.id)
                  const fuera = linesOutsideAllowed.includes(line.id)
                  return (
                    <button
                      key={line.id}
                      type="button"
                      aria-pressed={permitida}
                      onClick={() => toggleAllowedLine(line.id)}
                      title={fuera ? 'La lleva, pero no está permitida: permítela o quítasela' : permitida ? 'Quitar de las permitidas' : 'Permitir'}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        fuera
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : permitida
                            ? 'border-gray-900 bg-gray-900 text-white hover:bg-gray-800'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span aria-hidden="true" className="text-xs">{permitida ? '✓' : '+'}</span>
                      {line.name}
                      {!line.active && <span className="text-xs opacity-70">(inactiva)</span>}
                    </button>
                  )
                })}
                <span className="text-xs text-gray-500">
                  {allowedLines.length === 0 ? 'Sin restricción: puede tener cualquier línea.' : `Solo puede tener ${allowedLines.length === 1 ? 'esta línea' : `estas ${allowedLines.length} líneas`}.`}
                </span>
                {linesOutsideAllowed.length > 0 && (
                  <span className="basis-full text-xs text-amber-700">Lleva líneas que no están permitidas (en ámbar): permítelas o quítaselas antes de guardar.</span>
                )}
              </div>
            )}
            {allowedLines.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                Solo puede tener: {allowedLines.map(lineName).join(', ')}. La API rechaza darle cualquier otra línea.
              </p>
            )}
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Color en el mapa</span>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={HEX_COLOR_RE.test(color) ? color : '#9ca3af'}
                onChange={e => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1"
                aria-label="Elegir color"
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#RRGGBB"
                maxLength={7}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-700"
              />
              <div className="flex flex-wrap gap-1.5">
                {EXECUTIVE_PALETTE.map(swatch => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      color.toLowerCase() === swatch ? 'border-gray-900' : 'border-white shadow'
                    }`}
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                    aria-label={`Usar color ${swatch}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Colorea en el mapa por línea las zonas que cubre. Usa un color distinto al de las demás.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              className={inputClass}
            />
          </div>

          </fieldset>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              {soloLectura ? 'Cerrar' : 'Cancelar'}
            </button>
            {!soloLectura && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
              >
                {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
