'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PreviewData {
  totalKams: number
  totalHospitals: number
  totalRoutesNeeded: number
  routesInCache: number
  missingRoutes: number
  googleMapsApiCalls: number
  estimatedTimeSeconds: number
  estimatedCostUSD: string
  cacheInfo: {
    percentage: string
    lastUpdate: string
  }
}

export default function RecalculateButtonEnhanced() {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const loadPreview = async () => {
    try {
      const response = await fetch('/api/recalculate-preview')
      const data = await response.json()
      if (data.success) {
        setPreview(data.preview)
      }
    } catch (error) {
      console.error('Error loading preview:', error)
    }
  }

  const handleRecalculate = async () => {
    setLoading(true)
    setProgress(0)
    setMessage('')
    setShowModal(false)

    try {
      // Simular progreso mientras se ejecuta
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 1000)

      setCurrentStep('Obteniendo KAMs activos...')
      
      const response = await fetch('/api/recalculate-assignments', {
        method: 'POST',
      })

      const data = await response.json()

      clearInterval(progressInterval)
      setProgress(100)

      if (data.success) {
        setMessage(`✅ ${data.message}`)
        setCurrentStep('¡Recálculo completado!')
        
        // Refrescar la página después de 3 segundos
        setTimeout(() => {
          router.refresh()
          setProgress(0)
          setCurrentStep('')
        }, 3000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
        setCurrentStep('Error en el proceso')
      }
    } catch (error) {
      setMessage('❌ Error al recalcular asignaciones')
      setCurrentStep('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} segundos`
    const minutes = Math.floor(seconds / 60)
    return `${minutes} minuto${minutes > 1 ? 's' : ''}`
  }

  return (
    <>
      <button
        onClick={() => {
          loadPreview()
          setShowModal(true)
        }}
        disabled={loading}
        className={`px-4 py-2 rounded font-medium ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {loading ? 'Recalculando...' : 'Recalcular Asignaciones'}
      </button>

      {/* Modal de confirmación con preview */}
      {showModal && preview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Análisis de Recálculo</h3>
            
            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm"><strong>KAMs activos:</strong> {preview.totalKams}</p>
                <p className="text-sm"><strong>Hospitales activos:</strong> {preview.totalHospitals}</p>
                <p className="text-sm"><strong>Total de rutas necesarias:</strong> {preview.totalRoutesNeeded.toLocaleString()}</p>
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm font-semibold text-blue-800">Estado del Caché</p>
                <p className="text-sm"><strong>Rutas en caché:</strong> {preview.routesInCache.toLocaleString()} ({preview.cacheInfo.percentage}%)</p>
                <p className="text-sm"><strong>Rutas faltantes:</strong> {preview.missingRoutes.toLocaleString()}</p>
              </div>

              {preview.missingRoutes > 0 && (
                <div className="bg-yellow-50 p-3 rounded">
                  <p className="text-sm font-semibold text-yellow-800">Llamadas a Google Maps API</p>
                  <p className="text-sm"><strong>Consultas necesarias:</strong> {preview.googleMapsApiCalls.toLocaleString()}</p>
                  <p className="text-sm"><strong>Tiempo estimado:</strong> {formatTime(preview.estimatedTimeSeconds)}</p>
                  <p className="text-sm"><strong>Costo estimado:</strong> ${preview.estimatedCostUSD} USD</p>
                </div>
              )}

              {preview.missingRoutes === 0 && (
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-sm font-semibold text-green-800">✅ Caché Completo</p>
                  <p className="text-sm">Todas las rutas están en caché. No se necesitan llamadas a la API.</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecalculate}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirmar Recálculo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de progreso */}
      {loading && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 w-96">
          <h4 className="font-semibold mb-2">Recalculando Asignaciones</h4>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{currentStep}</p>
          <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% completado</p>
        </div>
      )}

      {/* Mensaje de resultado */}
      {message && !loading && (
        <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 max-w-md">
          <p className="text-sm">{message}</p>
        </div>
      )}
    </>
  )
}