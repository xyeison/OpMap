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
      // Usar el algoritmo original que YA funciona
      const response = await fetch('/api/recalculate-original', {
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
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Sistema de Asignación Territorial</h3>
      
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <p className="mb-2 font-medium">El algoritmo OpMap asigna hospitales a KAMs considerando:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Territorio base</strong>: Cada KAM tiene prioridad en su municipio/localidad</li>
            <li><strong>Expansión geográfica</strong>: 
              <ul className="ml-4 mt-1 text-xs">
                <li>• Nivel 1: Departamentos limítrofes directos</li>
                <li>• Nivel 2: Departamentos limítrofes de los limítrofes</li>
              </ul>
            </li>
            <li><strong>Tiempos de viaje</strong>: Máximo 4 horas por carretera</li>
            <li><strong>Competencia</strong>: El KAM más cercano gana el territorio</li>
            <li><strong>Regla de mayoría</strong>: En territorios compartidos, gana quien tenga más hospitales</li>
          </ul>
        </div>

        <div className="bg-blue-50 p-3 rounded text-sm">
          <p className="font-medium text-blue-900 mb-1">Nota sobre nuevos KAMs:</p>
          <p className="text-blue-700">Al agregar un nuevo KAM, ejecute este recálculo para que compita por hospitales en departamentos limítrofes según las reglas del algoritmo.</p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={loading}
          className={`w-full px-4 py-3 rounded font-medium transition-colors ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Procesando...
            </span>
          ) : (
            '🔄 Recalcular Asignaciones'
          )}
        </button>

        {message && (
          <div className={`p-3 rounded text-sm ${
            message.includes('✅') ? 'bg-green-100 text-green-800' : 
            message.includes('❌') ? 'bg-red-100 text-red-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {message}
          </div>
        )}

        {details && (
          <div className="bg-gray-100 p-3 rounded text-sm">
            <h4 className="font-semibold mb-2">Resumen del recálculo:</h4>
            <ul className="space-y-1">
              <li>• Total asignaciones: {details.totalAssignments}</li>
              <li>• Cache hits: {details.cacheHits}</li>
              <li>• Cache misses: {details.cacheMisses}</li>
              {details.googleCalculations !== undefined && (
                <li className="text-green-600 font-bold">• Llamadas a Google Maps API: {details.googleCalculations}</li>
              )}
              {details.hospitalsWithoutTravelTime !== undefined && (
                <li>• Hospitales sin tiempo de viaje: {details.hospitalsWithoutTravelTime}</li>
              )}
              {details.totalHospitals !== undefined && (
                <li>• Total hospitales activos: {details.totalHospitals}</li>
              )}
              {details.assignedHospitals !== undefined && (
                <li>• Hospitales asignados: {details.assignedHospitals}</li>
              )}
              {details.unassignedHospitals !== undefined && (
                <li>• Hospitales sin asignar: {details.unassignedHospitals}</li>
              )}
              {details.newTravelTimes !== undefined && (
                <li>• Nuevos tiempos calculados con Google Maps: {details.newTravelTimes}</li>
              )}
              {details.existingTravelTimes !== undefined && (
                <li>• Tiempos ya existentes en caché: {details.existingTravelTimes}</li>
              )}
              {details.routesCalculated !== undefined && (
                <li>• Rutas calculadas: {details.routesCalculated}</li>
              )}
              {details.routesPending !== undefined && details.routesPending > 0 && (
                <li className="text-orange-600">• Rutas pendientes: {details.routesPending}</li>
              )}
              {details.failedCalculations > 0 && (
                <li className="text-red-600">• Cálculos fallidos: {details.failedCalculations}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}