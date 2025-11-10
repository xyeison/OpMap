'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface KamZoneModalProps {
  kam: any
  zones: any[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function KamZoneModal({ kam, zones, isOpen, onClose, onSuccess }: KamZoneModalProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (kam && isOpen) {
      setSelectedZoneId(kam.zone_id || '')
      setError('')
    }
  }, [kam, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase
        .from('kams')
        .update({
          zone_id: selectedZoneId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', kam.id)

      if (error) throw error

      onSuccess()
    } catch (err: any) {
      console.error('Error updating KAM zone:', err)
      setError(err.message || 'Error al asignar la zona')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Filtrar solo zonas activas
  const activeZones = zones.filter(z => z.active !== false)

  // Obtener la zona actual del KAM si existe
  const currentZone = zones.find(z => z.id === kam.zone_id)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                Asignar Zona
              </h2>
              <p className="text-sm text-gray-300 mt-1">
                KAM: {kam?.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Información actual */}
          {currentZone && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm text-gray-600 mb-1">Zona actual:</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: currentZone.color }}
                />
                <span className="font-medium text-gray-900">{currentZone.name}</span>
              </div>
              {currentZone.coordinator_name && (
                <div className="text-xs text-gray-500 mt-2">
                  Coordinador: {currentZone.coordinator_name}
                </div>
              )}
            </div>
          )}

          {/* Selector de zona */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Zona
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {/* Opción para quitar zona */}
              <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="zone"
                  value=""
                  checked={selectedZoneId === ''}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                  selectedZoneId === '' ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                }`}>
                  {selectedZoneId === '' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-700">Sin zona asignada</div>
                  <div className="text-xs text-gray-500">Remover asignación de zona actual</div>
                </div>
              </label>

              {/* Opciones de zonas activas */}
              {activeZones.map(zone => (
                <label
                  key={zone.id}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="zone"
                    value={zone.id}
                    checked={selectedZoneId === zone.id}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                    selectedZoneId === zone.id ? 'border-gray-900 bg-gray-900' : 'border-gray-300'
                  }`}>
                    {selectedZoneId === zone.id && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div
                    className="w-4 h-4 rounded-full border border-gray-300 mr-3"
                    style={{ backgroundColor: zone.color }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{zone.name}</div>
                    {zone.coordinator_name && (
                      <div className="text-xs text-gray-500">
                        Coordinador: {zone.coordinator_name}
                      </div>
                    )}
                    {zone.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {zone.description}
                      </div>
                    )}
                  </div>
                  {zone.kams && zone.kams.length > 0 && (
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                      {zone.kams.length} KAMs
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}