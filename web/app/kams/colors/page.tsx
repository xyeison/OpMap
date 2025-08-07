'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { useRouter } from 'next/navigation'

export default function KamColorsPage() {
  const router = useRouter()
  const [kams, setKams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedColors, setEditedColors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadKams()
  }, [])

  const loadKams = async () => {
    const { data } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (data) {
      setKams(data)
      // Inicializar colores editados
      const colors: Record<string, string> = {}
      data.forEach(kam => {
        colors[kam.id] = kam.color || '#888888'
      })
      setEditedColors(colors)
    }
    setLoading(false)
  }

  const handleColorChange = (kamId: string, newColor: string) => {
    setEditedColors(prev => ({
      ...prev,
      [kamId]: newColor
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    
    try {
      // Actualizar cada KAM con su nuevo color
      for (const kam of kams) {
        if (editedColors[kam.id] !== kam.color) {
          await supabase
            .from('kams')
            .update({ color: editedColors[kam.id] })
            .eq('id', kam.id)
        }
      }
      
      alert('Colores actualizados exitosamente. El mapa se actualizará al recargar.')
      loadKams() // Recargar para confirmar cambios
    } catch (error) {
      console.error('Error updating colors:', error)
      alert('Error al actualizar colores')
    } finally {
      setSaving(false)
    }
  }

  const resetColors = () => {
    const defaultColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#8B4513', '#1DD1A1', '#FF7675',
      '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7', '#00D2D3',
      '#2ECC71'
    ]
    
    const colors: Record<string, string> = {}
    kams.forEach((kam, index) => {
      colors[kam.id] = defaultColors[index % defaultColors.length]
    })
    setEditedColors(colors)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <p>Cargando...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard permission="kams:edit">
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <button
                onClick={() => router.push('/kams')}
                className="text-gray-700 hover:text-gray-900 mb-4 flex items-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Volver a KAMs
              </button>
              <h1 className="text-4xl font-bold text-gray-900">Colores de Territorios</h1>
              <p className="text-gray-600 mt-2">Personaliza los colores de cada territorio KAM en el mapa</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetColors}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Restaurar Colores
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>

          {/* Lista de KAMs con selector de color */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kams.map(kam => (
              <div key={kam.id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{kam.name}</h3>
                  <div 
                    className="w-12 h-12 rounded-lg border-2 border-gray-300"
                    style={{ backgroundColor: editedColors[kam.id] }}
                  />
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Color del Territorio
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editedColors[kam.id]}
                        onChange={(e) => handleColorChange(kam.id, e.target.value)}
                        className="w-20 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editedColors[kam.id]}
                        onChange={(e) => handleColorChange(kam.id, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>Área base: {kam.area_id}</p>
                    {kam.phone && <p>Tel: {kam.phone}</p>}
                  </div>
                </div>

                {/* Vista previa del color en contexto */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Vista previa:</p>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: editedColors[kam.id] }}
                    />
                    <span className="text-xs">Marcador hospital</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-6 h-3 rounded"
                      style={{ backgroundColor: editedColors[kam.id], opacity: 0.3 }}
                    />
                    <span className="text-xs">Territorio en mapa</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nota informativa */}
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Nota:</strong> Los cambios en los colores se reflejarán inmediatamente en el mapa después de guardar.
              Los colores afectan tanto a los territorios como a los marcadores de hospitales asignados a cada KAM.
            </p>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}