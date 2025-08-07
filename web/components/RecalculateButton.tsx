'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RecalculateButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleRecalculate = async () => {
    if (!confirm('¿Estás seguro? Esto recalculará todas las asignaciones automáticas.')) {
      return
    }

    setLoading(true)
    setMessage('⏳ Procesando... esto puede tomar unos segundos')

    try {
      const response = await fetch('/api/recalculate-simplified', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setMessage(`✅ ${data.message}`)
        // Refrescar la página después de 2 segundos
        setTimeout(() => {
          router.refresh()
        }, 2000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error en recálculo:', error)
      setMessage('❌ Error al recalcular asignaciones')
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
        {loading ? 'Recalculando...' : 'Recalcular Asignaciones'}
      </button>
      {message && (
        <p className="text-sm">{message}</p>
      )}
    </div>
  )
}