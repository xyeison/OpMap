'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

interface KamActivateButtonProps {
  kam: {
    id: string
    name: string
    active: boolean
  }
  onUpdate?: () => void
  className?: string
}

export default function KamActivateButton({ kam, onUpdate, className }: KamActivateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [result, setResult] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleActivate = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/kams/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kamId: kam.id })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
        
        // Actualizar después de 3 segundos
        setTimeout(() => {
          // Invalidar todas las queries relevantes
          queryClient.invalidateQueries({ queryKey: ['map-data'] })
          queryClient.invalidateQueries({ queryKey: ['kams'] })
          queryClient.invalidateQueries({ queryKey: ['hospitals'] })
          queryClient.invalidateQueries({ queryKey: ['assignments'] })
          
          if (onUpdate) onUpdate()
          router.refresh()
          setShowModal(false)
          setResult(null)
        }, 3000)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error al activar KAM')
    } finally {
      setLoading(false)
    }
  }

  if (kam.active) {
    return null // No mostrar si ya está activo
  }

  const defaultClassName = "p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all group"

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || defaultClassName}
        disabled={loading}
        title="Activar KAM"
      >
        {className?.includes('p-2') ? (
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        ) : (
          'Activar'
        )}
      </button>

      {/* Modal de confirmación mejorado */}
      {showModal && !result && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all animate-slideUp">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">Activar KAM</h3>
            
            <p className="text-center text-gray-600 mb-6">
              ¿Deseas activar a <strong className="text-gray-900">{kam.name}</strong>?
            </p>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-800 font-medium mb-2">Al activar este KAM:</p>
              <ul className="list-disc list-inside ml-2 space-y-1 text-sm text-green-700">
                <li>Se recalcularán TODAS las asignaciones del sistema</li>
                <li>El algoritmo OpMap asignará hospitales según proximidad</li>
                <li>Respetará los territorios base de cada KAM</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </>
                ) : (
                  'Activar y Optimizar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultados mejorado */}
      {result && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto transform transition-all animate-slideUp">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">
              {result.message}
            </h3>
            
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{result.stats.totalAssignments}</p>
                  <p className="text-sm text-gray-600">Asignaciones recalculadas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{result.stats.kamAssignments}</p>
                  <p className="text-sm text-gray-600">Hospitales para {kam.name}</p>
                </div>
              </div>
              {result.stats.hospitalsInMunicipality !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600">
                    <strong className="text-gray-900">{result.stats.hospitalsInMunicipality}</strong> hospitales en su municipio base
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Actualizando vista en 3 segundos...
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