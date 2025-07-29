'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecalculateCompleteButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState<any>(null)
  const router = useRouter()

  const handleRecalculate = async () => {
    const confirmed = confirm(
      '¿Estás seguro? Esto hará lo siguiente:\n\n' +
      '1. Recalcular TODAS las asignaciones automáticas\n' +
      '2. Identificar hospitales sin asignar\n' +
      '3. Calcular tiempos de viaje para hospitales sin asignar\n' +
      '4. Limpiar datos incorrectos\n\n' +
      'Este proceso puede tardar varios minutos.'
    )
    
    if (!confirmed) return

    setLoading(true)
    setMessage('Iniciando recálculo completo...')
    setDetails(null)

    try {
      const response = await fetch('/api/recalculate-complete', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setMessage('✅ Recálculo completo exitoso')
        setDetails(data.summary)
        
        // Refrescar la página después de 3 segundos
        setTimeout(() => {
          router.refresh()
          window.location.reload()
        }, 3000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error al ejecutar recálculo completo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Recálculo Completo del Sistema</h3>
      
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          <p className="mb-2">Este botón ejecutará un recálculo completo que incluye:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Recalcular todas las asignaciones automáticas</li>
            <li>Identificar hospitales sin cobertura de KAM</li>
            <li>Calcular tiempos de viaje faltantes</li>
            <li>Limpiar datos incorrectos o inconsistentes</li>
          </ul>
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
            '🔧 Ejecutar Recálculo Completo'
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
            <h4 className="font-semibold mb-2">Resumen de resultados:</h4>
            <ul className="space-y-1">
              <li>Total hospitales: {details.totalHospitals}</li>
              <li>Hospitales asignados: {details.assignedHospitals}</li>
              <li>Hospitales sin asignar: {details.unassignedHospitals}</li>
              <li>Tiempos de viaje nuevos: {details.newTravelTimes}</li>
              <li>Tiempos existentes: {details.existingTravelTimes}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}