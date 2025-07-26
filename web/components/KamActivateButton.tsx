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
}

export default function KamActivateButton({ kam, onUpdate }: KamActivateButtonProps) {
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

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded"
        disabled={loading}
      >
        Activar
      </button>

      {/* Modal de confirmación */}
      {showModal && !result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Activar KAM</h3>
            
            <p className="mb-4">
              ¿Deseas activar a <strong>{kam.name}</strong>?
            </p>
            
            <div className="text-sm text-gray-600 mb-4 space-y-2">
              <p>Al activar este KAM:</p>
              <ul className="list-disc list-inside ml-2">
                <li>Recuperará automáticamente los hospitales de su municipio base</li>
                <li>Se le asignarán hospitales cercanos si está más cerca que el KAM actual</li>
                <li>Optimizará las rutas para reducir tiempos de viaje</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleActivate}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Activar y Optimizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de resultados */}
      {result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 text-green-600">
              ✅ {result.message}
            </h3>
            
            <div className="bg-gray-50 p-4 rounded mb-4 space-y-2">
              <p className="text-sm">
                <strong>Territorio base recuperado:</strong> {result.stats.territoryBase} hospitales
              </p>
              <p className="text-sm">
                <strong>Hospitales optimizados:</strong> {result.stats.optimized} 
                <span className="text-gray-500"> (estaban más lejos con otros KAMs)</span>
              </p>
              <p className="text-sm font-semibold">
                <strong>Total ganado:</strong> {result.stats.totalGained} hospitales
              </p>
            </div>

            {result.changes.length > 0 && (
              <>
                <h4 className="font-semibold mb-2">Cambios realizados:</h4>
                <div className="space-y-2 mb-4">
                  {result.changes.map((change: any, i: number) => (
                    <div key={i} className="text-sm bg-blue-50 p-2 rounded">
                      <strong>{change.hospital}</strong>
                      <br />
                      {change.action === 'Recuperado (territorio base)' ? (
                        <span className="text-green-600">
                          Recuperado de {change.previousKam} (territorio base)
                        </span>
                      ) : (
                        <>
                          <span className="text-blue-600">
                            {change.previousKam} → {kam.name}
                          </span>
                          <br />
                          <span className="text-gray-600">
                            Tiempo: {change.previousTime} min → {change.newTime} min 
                            <span className="text-green-600 font-semibold">
                              {' '}(-{change.timeSaved} min ahorro)
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p className="text-sm text-gray-600">
              Actualizando vista en 3 segundos...
            </p>
          </div>
        </div>
      )}
    </>
  )
}