'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecalculateButtonFixed() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState('')
  const router = useRouter()

  const handleRecalculate = async () => {
    if (!confirm('¿Estás seguro? Esto recalculará todas las asignaciones automáticas.')) {
      return
    }

    setLoading(true)
    setMessage('')
    setProgress('Iniciando...')
    
    // Log para debug
    console.log('🚀 Iniciando recálculo de asignaciones...')
    const startTime = Date.now()

    try {
      setProgress('Conectando con el servidor...')
      
      const response = await fetch('/api/recalculate-simplified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('📡 Respuesta recibida:', response.status)
      setProgress('Procesando respuesta...')

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }

      const data = await response.json()
      console.log('📊 Datos recibidos:', data)

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)

      if (data.success) {
        setMessage(`✅ ${data.message} (${elapsedTime}s)`)
        setProgress('')
        
        // Refrescar la página después de 2 segundos
        setTimeout(() => {
          console.log('🔄 Refrescando página...')
          router.refresh()
          window.location.reload() // Forzar recarga completa
        }, 2000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
        setProgress('')
      }
    } catch (error) {
      console.error('❌ Error en recálculo:', error)
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
      
      if (error instanceof Error) {
        setMessage(`❌ Error: ${error.message} (después de ${elapsedTime}s)`)
      } else {
        setMessage(`❌ Error desconocido (después de ${elapsedTime}s)`)
      }
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRecalculate}
        disabled={loading}
        className={`px-4 py-2 rounded font-medium ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {loading ? 'Recalculando...' : 'Recalcular Asignaciones (Simplificado)'}
      </button>
      
      {progress && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span>{progress}</span>
        </div>
      )}
      
      {message && (
        <p className="text-sm">{message}</p>
      )}
      
      {loading && (
        <p className="text-xs text-gray-500">
          Si el proceso tarda mucho, revisa la consola del navegador (F12)
        </p>
      )}
    </div>
  )
}