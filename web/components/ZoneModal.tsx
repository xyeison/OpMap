'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Zone } from '@/lib/types/zones'

interface ZoneModalProps {
  zone?: Zone | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const PRESET_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#8B4513', '#1DD1A1', '#FF7675',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00D2D3',
  '#2ECC71', '#E74C3C', '#3498DB', '#F39C12', '#9B59B6'
]

export default function ZoneModal({ zone, isOpen, onClose, onSuccess }: ZoneModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    coordinator_name: '',
    coordinator_email: '',
    coordinator_phone: '',
    color: '#FF6B6B',
    active: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (zone) {
      setFormData({
        code: zone.code || '',
        name: zone.name || '',
        description: zone.description || '',
        coordinator_name: zone.coordinator_name || '',
        coordinator_email: zone.coordinator_email || '',
        coordinator_phone: zone.coordinator_phone || '',
        color: zone.color || '#FF6B6B',
        active: zone.active !== false
      })
    } else {
      // Reset form for new zone
      setFormData({
        code: '',
        name: '',
        description: '',
        coordinator_name: '',
        coordinator_email: '',
        coordinator_phone: '',
        color: '#FF6B6B',
        active: true
      })
    }
  }, [zone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (zone) {
        // Update existing zone
        const { error } = await supabase
          .from('zones')
          .update({
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            coordinator_name: formData.coordinator_name || null,
            coordinator_email: formData.coordinator_email || null,
            coordinator_phone: formData.coordinator_phone || null,
            color: formData.color,
            active: formData.active,
            updated_at: new Date().toISOString()
          })
          .eq('id', zone.id)

        if (error) throw error
      } else {
        // Create new zone
        const { error } = await supabase
          .from('zones')
          .insert({
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            coordinator_name: formData.coordinator_name || null,
            coordinator_email: formData.coordinator_email || null,
            coordinator_phone: formData.coordinator_phone || null,
            color: formData.color,
            active: formData.active
          })

        if (error) throw error
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error saving zone:', err)
      setError(err.message || 'Error al guardar la zona')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {zone ? 'Editar Zona' : 'Crear Nueva Zona'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                placeholder="ej. ZONA_NORTE"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                placeholder="ej. Zona Norte"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
              placeholder="ej. Comprende Costa Atlántica y región Caribe"
              rows={3}
            />
          </div>

          {/* Información del coordinador */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Coordinador</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Coordinador
                </label>
                <input
                  type="text"
                  value={formData.coordinator_name}
                  onChange={(e) => setFormData({ ...formData, coordinator_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                  placeholder="ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.coordinator_email}
                  onChange={(e) => setFormData({ ...formData, coordinator_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                  placeholder="coordinador@empresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.coordinator_phone}
                  onChange={(e) => setFormData({ ...formData, coordinator_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                  placeholder="+57 300 123 4567"
                />
              </div>
            </div>
          </div>

          {/* Color y estado */}
          <div className="border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Color de la Zona
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                    style={{ backgroundColor: formData.color }}
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'color'
                      input.value = formData.color
                      input.onchange = (e) => {
                        setFormData({ ...formData, color: (e.target as HTMLInputElement).value })
                      }
                      input.click()
                    }}
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent font-mono text-sm"
                    placeholder="#FF6B6B"
                  />
                </div>
                <div className="mt-3 grid grid-cols-10 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className="w-8 h-8 rounded-md border border-gray-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Estado
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    {formData.active ? 'Activa' : 'Inactiva'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="border-t pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Guardando...' : (zone ? 'Actualizar' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}