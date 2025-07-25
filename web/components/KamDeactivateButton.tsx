'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface KamDeactivateButtonProps {
  kam: {
    id: string
    name: string
    active: boolean
  }
  onUpdate?: () => void
}

export default function KamDeactivateButton({ kam, onUpdate }: KamDeactivateButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [result, setResult] = useState<any>(null)
  const router = useRouter()

  const handleDeactivate = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/kams/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kamId: kam.id })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
        
        // Actualizar después de 3 segundos
        setTimeout(() => {
          if (onUpdate) onUpdate()
          router.refresh()
          setShowModal(false)
          setResult(null)
        }, 3000)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error al desactivar KAM')
    } finally {
      setLoading(false)
    }
  }

  if (!kam.active) {
    return (
      <span className="text-gray-400 text-sm">Inactivo</span>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded"
        disabled={loading}
      >
        Desactivar
      </button>

      {/* Modal de confirmación */}
      {showModal && !result && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Desactivar KAM</h3>
            
            <p className="mb-4">
              ¿Estás seguro de desactivar a <strong>{kam.name}</strong>?
            </p>
            
            <p className="text-sm text-gray-600 mb-4">
              Los hospitales asignados a este KAM serán reasignados automáticamente
              al KAM activo más cercano.
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Desactivar y Reasignar'}
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
            
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="text-sm"><strong>Total de hospitales:</strong> {result.stats.totalHospitals}</p>
              <p className="text-sm"><strong>Reasignados:</strong> {result.stats.reassigned}</p>
              <p className="text-sm"><strong>Sin asignar:</strong> {result.stats.unassigned}</p>
            </div>

            {result.reassignments.length > 0 && (
              <>
                <h4 className="font-semibold mb-2">Ejemplos de reasignaciones:</h4>
                <div className="space-y-2 mb-4">
                  {result.reassignments.map((r: any, i: number) => (
                    <div key={i} className="text-sm bg-blue-50 p-2 rounded">
                      <strong>{r.hospital}</strong>
                      <br />
                      {r.oldKam} → {r.newKam} ({Math.round(r.travelTime)} min)
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