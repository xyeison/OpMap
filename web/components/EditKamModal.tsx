'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

interface KAM {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  color: string
  active: boolean
  max_travel_time: number
  enable_level2: boolean
  priority: number
  participates_in_assignment?: boolean
}

interface EditKamModalProps {
  kam: KAM
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function EditKamModal({ kam, isOpen, onClose, onUpdate }: EditKamModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    max_travel_time: 240,
    enable_level2: true,
    priority: 2,
    active: true,
    color: '',
    participates_in_assignment: true
  })
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'activate' | 'deactivate' | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (kam && isOpen) {
      setFormData({
        name: kam.name,
        max_travel_time: kam.max_travel_time,
        enable_level2: kam.enable_level2,
        priority: kam.priority,
        active: kam.active,
        participates_in_assignment: kam.participates_in_assignment !== false,
        color: kam.color
      })
      setError('')
    }
  }, [kam, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const statusChanged = kam.active !== formData.active
    
    // Si cambia el estado, mostrar modal de confirmación
    if (statusChanged) {
      setPendingAction(formData.active ? 'activate' : 'deactivate')
      setShowConfirmModal(true)
      return
    }
    
    // Si no cambia el estado, guardar directamente
    await saveChanges()
  }

  const saveChanges = async () => {
    setLoading(true)
    setError('')
    setShowConfirmModal(false)

    try {
      const statusChanged = kam.active !== formData.active
      
      if (statusChanged) {
        // Si cambió el estado, usar el endpoint de activar/desactivar que hace todo
        setRecalculating(true)
        setError('')
        
        const endpoint = formData.active ? '/api/kams/activate' : '/api/kams/deactivate'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kamId: kam.id })
        })

        const result = await response.json()
        setRecalculating(false)
        
        if (!result.success) {
          throw new Error(result.error || 'Error al cambiar estado del KAM')
        }
        
        // Preparar datos para actualizar
        const updateData = {
          name: formData.name,
          max_travel_time: formData.max_travel_time,
          enable_level2: formData.enable_level2,
          priority: formData.priority,
          participates_in_assignment: formData.participates_in_assignment,
          color: formData.color,
          updated_at: new Date().toISOString()
        }
        
        // Ahora actualizar los otros campos (si es necesario)
        const { error: updateError } = await supabase
          .from('kams')
          .update(updateData)
          .eq('id', kam.id)
        
        if (updateError) throw updateError
        
      } else {
        // Preparar datos para actualizar
        const updateData = {
          name: formData.name,
          max_travel_time: formData.max_travel_time,
          enable_level2: formData.enable_level2,
          priority: formData.priority,
          participates_in_assignment: formData.participates_in_assignment,
          color: formData.color,
          updated_at: new Date().toISOString()
        }
        
        // Si NO cambió el estado, solo actualizar los campos normales
        const { error: updateError } = await supabase
          .from('kams')
          .update(updateData)
          .eq('id', kam.id)

        if (updateError) throw updateError
      }

      queryClient.invalidateQueries({ queryKey: ['kams'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      onUpdate()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al actualizar KAM')
    } finally {
      setLoading(false)
      setPendingAction(null)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden transform transition-all animate-slideUp">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-8 py-6 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                  style={{ backgroundColor: formData.color }}
                >
                  {kam.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Editar KAM</h3>
                  <p className="text-gray-300 text-sm">Configuración de {kam.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {recalculating && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Recalculando asignaciones de hospitales...
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información Básica */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Información Básica
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del KAM
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estado
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, active: true })}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                          formData.active 
                            ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                            : 'bg-white text-gray-600 border-2 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Activo
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, active: false })}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                          !formData.active 
                            ? 'bg-red-100 text-red-700 border-2 border-red-500' 
                            : 'bg-white text-gray-600 border-2 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Inactivo
                        </span>
                      </button>
                    </div>
                    {!formData.active && kam.active && (
                      <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Los hospitales se reasignarán automáticamente
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Ubicación */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Ubicación
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Área
                    </label>
                    <input
                      type="text"
                      value={kam.area_id}
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-600"
                      readOnly
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Latitud
                    </label>
                    <input
                      type="text"
                      value={kam.lat.toFixed(6)}
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-600"
                      readOnly
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Longitud
                    </label>
                    <input
                      type="text"
                      value={kam.lng.toFixed(6)}
                      className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-600"
                      readOnly
                      disabled
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Las coordenadas no se pueden modificar
                </p>
              </div>

              {/* Configuración de Territorio */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configuración de Territorio
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tiempo Máximo de Viaje
                    </label>
                    <div className="relative">
                      <input
                        type="range"
                        value={formData.max_travel_time}
                        onChange={(e) => setFormData({ ...formData, max_travel_time: parseInt(e.target.value) })}
                        className="w-full mb-2"
                        min="60"
                        max="480"
                        step="30"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>1h</span>
                        <span>4h</span>
                        <span>8h</span>
                      </div>
                      <div className="text-center mt-2">
                        <span className="text-2xl font-bold text-gray-900">{formData.max_travel_time}</span>
                        <span className="text-sm text-gray-600 ml-1">minutos</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prioridad
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                    >
                      <option value={1}>⭐ Baja</option>
                      <option value={2}>⭐⭐ Normal</option>
                      <option value={3}>⭐⭐⭐ Alta</option>
                      <option value={4}>⭐⭐⭐⭐ Muy Alta</option>
                      <option value={5}>⭐⭐⭐⭐⭐ Crítica</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Mayor prioridad gana en caso de empate
                    </p>
                  </div>
                </div>

                <div>
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
                    {formData.enable_level2 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
                        Activo
                      </span>
                    )}
                  </label>
                </div>

                <div>
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
                          ? "El KAM tiene territorio asignado y aparece en el mapa"
                          : "KAM administrativo sin territorio (no aparece en el mapa)"}
                      </p>
                    </div>
                    {formData.participates_in_assignment ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg">
                        Territorial
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">
                        Administrativo
                      </span>
                    )}
                  </label>
                </div>
              </div>

              {/* Personalización Visual */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Personalización Visual
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color del Territorio
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-16 h-16 border-2 border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all font-mono"
                      placeholder="#FF6B6B"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200">
                      <div 
                        className="w-8 h-8 rounded-full shadow-inner"
                        style={{ backgroundColor: formData.color }}
                      />
                      <span className="text-sm text-gray-600">Vista previa</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  disabled={loading || recalculating}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl hover:from-gray-900 hover:to-black transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={loading || recalculating}
                >
                  {(loading || recalculating) ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {recalculating ? 'Recalculando...' : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Confirmación */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all animate-slideUp">
            <div className={`flex items-center justify-center w-16 h-16 ${pendingAction === 'activate' ? 'bg-green-100' : 'bg-orange-100'} rounded-full mx-auto mb-6`}>
              <svg className={`w-8 h-8 ${pendingAction === 'activate' ? 'text-green-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {pendingAction === 'activate' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                )}
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">
              {pendingAction === 'activate' ? 'Activar KAM' : 'Desactivar KAM'}
            </h3>
            
            <p className="text-center text-gray-600 mb-6">
              {pendingAction === 'activate' 
                ? `¿Estás seguro de activar a ${kam.name}?`
                : `¿Estás seguro de desactivar a ${kam.name}?`
              }
            </p>
            
            <div className={`${pendingAction === 'activate' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'} border rounded-xl p-4 mb-6`}>
              <p className={`text-sm ${pendingAction === 'activate' ? 'text-green-800' : 'text-orange-800'}`}>
                <strong>{pendingAction === 'activate' ? '✅' : '⚠️'} Importante:</strong> Se recalcularán TODAS las asignaciones del sistema.
                {pendingAction === 'activate' 
                  ? ' El algoritmo OpMap asignará hospitales según proximidad.'
                  : ' Los hospitales de este KAM serán reasignados automáticamente.'
                }
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={saveChanges}
                className={`flex-1 px-6 py-3 ${
                  pendingAction === 'activate' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                } text-white rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={loading}
              >
                {pendingAction === 'activate' ? 'Activar y Optimizar' : 'Desactivar y Reasignar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  )
}