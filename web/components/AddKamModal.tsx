'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

interface Municipality {
  code: string
  name: string
  lat: number
  lng: number
  department_code: string
}

interface AddKamModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#48C9B0', '#F39C12', '#E74C3C',
  '#9B59B6', '#3498DB', '#1ABC9C', '#34495E', '#16A085'
]

export default function AddKamModal({ isOpen, onClose, onSuccess }: AddKamModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    area_id: '',
    lat: 0,
    lng: 0,
    max_travel_time: 240,
    enable_level2: true,
    priority: 2,
    participates_in_assignment: true,
    color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
  })
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [filteredMunicipalities, setFilteredMunicipalities] = useState<Municipality[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOpen) {
      loadMunicipalities()
    }
  }, [isOpen])

  const loadMunicipalities = async () => {
    const { data, error } = await supabase
      .from('municipalities')
      .select('*')
      .order('name')
    
    if (data && !error) {
      setMunicipalities(data)
      setFilteredMunicipalities(data)
    }
  }

  useEffect(() => {
    if (searchTerm) {
      const filtered = municipalities.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredMunicipalities(filtered)
    } else {
      setFilteredMunicipalities(municipalities)
    }
  }, [searchTerm, municipalities])

  const handleMunicipalitySelect = (municipality: Municipality) => {
    setFormData({
      ...formData,
      area_id: municipality.code,
      lat: municipality.lat,
      lng: municipality.lng
    })
    setSearchTerm(municipality.name)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validaciones
      if (!formData.name.trim()) {
        throw new Error('El nombre es requerido')
      }
      if (!formData.area_id) {
        throw new Error('Debe seleccionar un municipio')
      }

      // Preparar datos para insertar (omitir participates_in_assignment si causa error)
      const kamData: any = {
        name: formData.name.trim(),
        area_id: formData.area_id,
        lat: formData.lat,
        lng: formData.lng,
        max_travel_time: formData.max_travel_time,
        enable_level2: formData.enable_level2,
        priority: formData.priority,
        color: formData.color,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Solo agregar participates_in_assignment si es false (para evitar error si no existe la columna)
      if (formData.participates_in_assignment === false) {
        kamData.participates_in_assignment = false
      }

      // Insertar el nuevo KAM
      const { error: insertError } = await supabase
        .from('kams')
        .insert(kamData)

      if (insertError) throw insertError

      // Si el KAM participa en asignación territorial, ejecutar recálculo
      if (formData.participates_in_assignment) {
        const response = await fetch('/api/recalculate-simplified', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })

        if (!response.ok) {
          console.warn('Error al recalcular asignaciones:', await response.text())
        }
      }

      queryClient.invalidateQueries({ queryKey: ['kams'] })
      onSuccess()
      handleClose()
    } catch (err: any) {
      setError(err.message || 'Error al crear el KAM')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      name: '',
      area_id: '',
      lat: 0,
      lng: 0,
      max_travel_time: 240,
      enable_level2: true,
      priority: 2,
      participates_in_assignment: true,
      color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]
    })
    setSearchTerm('')
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Agregar Nuevo KAM</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Información Básica */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del KAM
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Ej: KAM Bogotá Norte"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Municipio Base
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                placeholder="Buscar municipio..."
                required
              />
              {searchTerm && filteredMunicipalities.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg shadow-lg">
                  {filteredMunicipalities.slice(0, 10).map((municipality) => (
                    <button
                      key={municipality.code}
                      type="button"
                      onClick={() => handleMunicipalitySelect(municipality)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="font-medium">{municipality.name}</div>
                      <div className="text-xs text-gray-500">Código: {municipality.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {formData.area_id && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Municipio seleccionado:</span> {searchTerm}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Coordenadas: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          {/* Configuración */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Configuración</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiempo máximo de viaje (minutos)
              </label>
              <input
                type="number"
                value={formData.max_travel_time}
                onChange={(e) => setFormData({ ...formData, max_travel_time: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                min="30"
                max="480"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              >
                <option value={1}>Baja (1)</option>
                <option value={2}>Normal (2)</option>
                <option value={3}>Alta (3)</option>
                <option value={4}>Muy Alta (4)</option>
                <option value={5}>Crítica (5)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_level2}
                  onChange={(e) => setFormData({ ...formData, enable_level2: e.target.checked })}
                  className="w-5 h-5 text-gray-700 rounded focus:ring-gray-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Habilitar expansión Nivel 2
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Permite buscar en departamentos adyacentes de segundo nivel
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.participates_in_assignment}
                  onChange={(e) => setFormData({ ...formData, participates_in_assignment: e.target.checked })}
                  className="w-5 h-5 text-gray-700 rounded focus:ring-gray-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Participa en asignación territorial
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.participates_in_assignment 
                      ? "El KAM tendrá territorio asignado y aparecerá en el mapa"
                      : "KAM administrativo sin territorio (no aparece en el mapa)"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color del KAM
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <span className="text-sm text-gray-600">{formData.color}</span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creando...
                </>
              ) : (
                'Crear KAM'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}