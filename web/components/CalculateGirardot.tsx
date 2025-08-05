'use client'

import { useState } from 'react'

export default function CalculateGirardot() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  const handleCalculate = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('/api/calculate-girardot', {
        method: 'POST'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Error al calcular' })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="bg-green-50 p-4 rounded-lg mb-4">
      <h3 className="font-semibold mb-2">🎯 Calcular Rutas de Girardot</h3>
      <p className="text-sm text-gray-600 mb-3">
        Calcula específicamente las rutas hacia Girardot desde todos los KAMs elegibles
      </p>
      
      <button
        onClick={handleCalculate}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {loading ? 'Calculando...' : 'Calcular Girardot'}
      </button>
      
      {result && (
        <div className="mt-4">
          <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}