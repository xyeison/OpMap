'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

interface Territory {
  id: string
  name: string
  type: 'municipality' | 'locality'
  departmentName?: string
  hospitalCount?: number
  currentKam?: string
}

interface KAM {
  id: string
  name: string
  color: string
  area_id: string
  active: boolean
}

interface ForcedAssignmentModalProps {
  territory: Territory | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ForcedAssignmentModal({ 
  territory, 
  isOpen, 
  onClose, 
  onSuccess 
}: ForcedAssignmentModalProps) {
  const [kams, setKams] = useState<KAM[]>([])
  const [selectedKam, setSelectedKam] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOpen) {
      loadKams()
      setSelectedKam('')
      setReason('')
      setError('')
    }
  }, [isOpen])

  const loadKams = async () => {
    try {
      const { data, error } = await supabase
        .from('kams')
        .select('*')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setKams(data || [])
    } catch (err) {
      console.error('Error loading KAMs:', err)
      setError('Error al cargar los KAMs')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!territory || !selectedKam) {
      setError('Debe seleccionar un KAM')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Llamar al API que maneja todo: inserción y recálculo
      const response = await fetch('/api/territories/force-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: territory.id,
          territoryName: territory.name,
          territoryType: territory.type,
          kamId: selectedKam,
          reason: reason || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al recalcular asignaciones')
      }

      // Invalidar queries para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['map-data'] })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al asignar territorio')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAssignment = async () => {
    if (!territory) return

    setLoading(true)
    setError('')

    try {
      // Desactivar asignación forzada
      const { error: deactivateError } = await supabase
        .from('forced_assignments')
        .update({ active: false })
        .eq('territory_id', territory.id)
        .eq('active', true)

      if (deactivateError) throw deactivateError

      // Recalcular asignaciones normales
      const response = await fetch('/api/territories/remove-forced-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          territoryId: territory.id,
          territoryType: territory.type
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al remover asignación')
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['territories'] })
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['map-data'] })

      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error al remover asignación')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !territory) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all animate-slideUp">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 text-white rounded-t-2xl flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">Asignación Forzada de Territorio</h3>
              <p className="text-gray-300 text-sm mt-1">{territory.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              <strong>⚠️ Importante:</strong> La asignación forzada sobrescribe el algoritmo OpMap. 
              Todos los hospitales del {territory.type === 'locality' ? 'localidad' : 'municipio'} se asignarán al KAM seleccionado, 
              independientemente de la distancia.
            </p>
          </div>

          <form id="assignment-form" onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Información del Territorio
                </label>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tipo:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {territory.type === 'locality' ? 'Localidad' : 'Municipio'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Código:</span>
                    <span className="text-sm font-medium text-gray-900">{territory.id}</span>
                  </div>
                  {territory.hospitalCount !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Hospitales:</span>
                      <span className="text-sm font-medium text-gray-900">{territory.hospitalCount}</span>
                    </div>
                  )}
                  {territory.currentKam && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">KAM Actual:</span>
                      <span className="text-sm font-medium text-gray-900">{territory.currentKam}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asignar a KAM <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedKam}
                  onChange={(e) => setSelectedKam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all text-sm"
                  required
                  disabled={loading}
                >
                  <option value="">Seleccionar KAM...</option>
                  {kams.map((kam) => (
                    <option key={kam.id} value={kam.id}>
                      {kam.name} ({kam.area_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razón de la asignación (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all text-sm"
                  rows={2}
                  placeholder="Ej: Cliente estratégico, relación comercial existente..."
                  disabled={loading}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
          <div className="flex justify-between gap-3">
            {territory.currentKam && (
              <button
                type="button"
                onClick={handleRemoveAssignment}
                className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                disabled={loading}
              >
                Remover Asignación
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                form="assignment-form"
                type="submit"
                onClick={handleSubmit}
                className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg hover:from-gray-900 hover:to-black transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                disabled={loading || !selectedKam}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Asignando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Asignar Territorio
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  )
}