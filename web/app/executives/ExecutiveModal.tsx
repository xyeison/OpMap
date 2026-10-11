'use client'

import { useState } from 'react'
import type { BusinessLine, Executive, ExecutiveStatus } from '@/lib/types/lines'
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

interface ExecutiveModalProps {
  executive: Executive | null // null = crear
  zones: ZoneOption[] // todas las zonas (activas e inactivas)
  lines: BusinessLine[]
  onClose: () => void
  onSaved: (executive: Executive) => void
}

export default function ExecutiveModal({ executive, zones, lines, onClose, onSaved }: ExecutiveModalProps) {
  const isEdit = executive !== null
  const [fullName, setFullName] = useState(executive?.full_name ?? '')
  const [email, setEmail] = useState(executive?.email ?? '')
  const [company, setCompany] = useState(executive?.company ?? 'VG Medical')
  const [baseKamId, setBaseKamId] = useState(executive?.base_kam_id ?? '')
  const [status, setStatus] = useState<ExecutiveStatus>(executive?.status ?? 'active')
  const [selectedLines, setSelectedLines] = useState<string[]>(executive?.lines ?? [])
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

  const toggleLine = (lineId: string) => {
    setSelectedLines(prev => (prev.includes(lineId) ? prev.filter(id => id !== lineId) : [...prev, lineId]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
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

    const body: Record<string, unknown> = {
      full_name: trimmedName,
      email: trimmedEmail || null,
      company: trimmedCompany,
      base_kam_id: baseKamId,
      status,
      lines: selectedLines,
      odoo_employee_id: odooEmployeeId,
      notes: notes.trim() || null,
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
      onSaved(data.executive as Executive)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-white">{isEdit ? 'Editar ejecutiva' : 'Nueva ejecutiva'}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white" aria-label="Cerrar">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

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
              <p className="text-xs text-gray-500 mt-1">Opcional para cargos por contratar.</p>
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
