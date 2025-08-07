'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

export default function RecalculateUnified() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<any>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleRecalculate = async () => {
    const confirmed = confirm(
      '¿Estás seguro? Este proceso:\n\n' +
      '1. Analizará qué tiempos de viaje faltan según las reglas territoriales\n' +
      '2. Calculará SOLO las rutas necesarias con Google Maps\n' +
      '3. Asignará hospitales según:\n' +
      '   • Territorios base de cada KAM (automático)\n' +
      '   • Expansión territorial (Nivel 1 y 2)\n' +
      '   • Tiempos de viaje reales (máx. 4 horas)\n' +
      '   • Competencia entre KAMs (gana el más cercano)\n\n' +
      '⚠️ IMPORTANTE: Si hay muchas rutas, puede ejecutarse varias veces'
    )
    
    if (!confirmed) return

    setLoading(true)
    setMessage('Ejecutando recálculo de asignaciones...')
    setDetails(null)

    try {
      // Usar el algoritmo simplificado mejorado
      const response = await fetch('/api/recalculate-simplified', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setMessage('✅ ' + (data.message || 'Recálculo exitoso'))
        setDetails(data.summary)
        
        // Mostrar información de depuración si está disponible
        if (data.debug) {
          console.log('🔍 Debug info:', data.debug)
        }
        
        // Invalidar caché y refrescar
        await queryClient.invalidateQueries({ queryKey: ['map-data'] })
        
        // Si quedan rutas pendientes, mostrar opción de continuar
        if (data.summary?.routesPending > 0) {
          setMessage(`✅ Progreso guardado. ${data.summary.routesCalculated} rutas calculadas, ${data.summary.routesPending} pendientes. Ejecute nuevamente para continuar.`)
        } else {
          setTimeout(() => {
            router.refresh()
            window.location.reload()
          }, 2000)
        }
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error al ejecutar recálculo')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">      
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Recálculo de Asignaciones</h3>
            <p className="text-sm text-gray-600 mt-1">Actualiza las asignaciones territoriales con Google Maps</p>
          </div>
          <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </div>
        </div>
        
        <button
          onClick={handleRecalculate}
          disabled={loading}
          className={`w-full px-6 py-4 rounded-xl font-medium transition-all duration-200 ${
            loading 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-gray-900 text-white hover:bg-black transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Recalcular Asignaciones
            </span>
          )}
        </button>

        {message && (
          <div className={`p-5 rounded-xl text-sm font-medium flex items-center gap-3 shadow-md ${
            message.includes('✅') ? 'bg-gray-50 border border-gray-300 text-gray-800' : 
            message.includes('❌') ? 'bg-gray-100 border border-gray-400 text-gray-900' : 
            'bg-gray-50 border border-gray-200 text-gray-700'
          }`}>
            {message.includes('✅') && (
              <svg className="w-5 h-5 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            {message.includes('❌') && (
              <svg className="w-5 h-5 text-gray-800 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            <span>{message.replace('✅', '').replace('❌', '').trim()}</span>
          </div>
        )}

        {details && (
          <div className="bg-gray-50 border border-gray-300 rounded-xl p-6 shadow-inner">
            <h4 className="font-semibold text-sm text-gray-700 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Resumen de Operación
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Total asignaciones:</span>
                <span>{details.totalAssignments}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache hits:</span>
                <span>{details.cacheHits}</span>
              </div>
              <div className="flex justify-between">
                <span>Cache misses:</span>
                <span>{details.cacheMisses}</span>
              </div>
              {details.googleCalculations !== undefined && (
                <div className="flex justify-between font-semibold">
                  <span>Google Maps API:</span>
                  <span>{details.googleCalculations}</span>
                </div>
              )}
              {details.hospitalsWithoutTravelTime !== undefined && (
                <div className="flex justify-between">
                  <span>Sin tiempo de viaje:</span>
                  <span>{details.hospitalsWithoutTravelTime}</span>
                </div>
              )}
              {details.totalHospitals !== undefined && (
                <div className="flex justify-between">
                  <span>Hospitales activos:</span>
                  <span>{details.totalHospitals}</span>
                </div>
              )}
              {details.assignedHospitals !== undefined && (
                <div className="flex justify-between">
                  <span>Hospitales asignados:</span>
                  <span>{details.assignedHospitals}</span>
                </div>
              )}
              {details.unassignedHospitals !== undefined && (
                <div className="flex justify-between">
                  <span>Hospitales sin asignar:</span>
                  <span>{details.unassignedHospitals}</span>
                </div>
              )}
              {details.newTravelTimes !== undefined && (
                <div className="flex justify-between">
                  <span>Nuevos tiempos Google Maps:</span>
                  <span>{details.newTravelTimes}</span>
                </div>
              )}
              {details.existingTravelTimes !== undefined && (
                <div className="flex justify-between">
                  <span>Tiempos en caché:</span>
                  <span>{details.existingTravelTimes}</span>
                </div>
              )}
              {details.routesCalculated !== undefined && (
                <div className="flex justify-between">
                  <span>Rutas calculadas:</span>
                  <span>{details.routesCalculated}</span>
                </div>
              )}
              {details.routesPending !== undefined && details.routesPending > 0 && (
                <div className="flex justify-between text-gray-700 font-semibold">
                  <span>Rutas pendientes:</span>
                  <span>{details.routesPending}</span>
                </div>
              )}
              {details.failedCalculations > 0 && (
                <div className="flex justify-between text-gray-800 font-semibold">
                  <span>Cálculos fallidos:</span>
                  <span>{details.failedCalculations}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}