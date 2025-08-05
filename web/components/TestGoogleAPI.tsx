'use client'

import { useState } from 'react'

export default function TestGoogleAPI() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [testType, setTestType] = useState<'general' | 'girardot'>('general')
  
  const handleTest = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const endpoint = testType === 'general' ? '/api/test-google-api' : '/api/test-girardot-ibague'
      const response = await fetch(endpoint)
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Error al probar la API' })
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="bg-yellow-50 p-4 rounded-lg mb-4">
      <h3 className="font-semibold mb-2">🧪 Prueba de Google Maps API</h3>
      
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTestType('general')}
          className={`px-3 py-1 rounded text-sm ${
            testType === 'general' 
              ? 'bg-yellow-700 text-white' 
              : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
          }`}
        >
          Prueba General
        </button>
        <button
          onClick={() => setTestType('girardot')}
          className={`px-3 py-1 rounded text-sm ${
            testType === 'girardot' 
              ? 'bg-yellow-700 text-white' 
              : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
          }`}
        >
          Prueba Ibagué → Girardot
        </button>
      </div>
      
      <button
        onClick={handleTest}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-yellow-600 hover:bg-yellow-700 text-white'
        }`}
      >
        {loading ? 'Probando...' : `Ejecutar ${testType === 'general' ? 'Prueba General' : 'Prueba Ibagué → Girardot'}`}
      </button>
      
      {result && (
        <div className="mt-4">
          <pre className="bg-white p-3 rounded text-xs overflow-auto max-h-60">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}