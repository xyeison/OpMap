'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { kamService } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function KamsPage() {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const router = useRouter()
  
  const { data: kams, isLoading } = useQuery({
    queryKey: ['kams'],
    queryFn: kamService.getAll,
  })

  const handleDeactivateKam = async (kamId: string, kamName: string) => {
    if (!confirm(`¿Estás seguro de desactivar a ${kamName}? Sus hospitales se reasignarán automáticamente.`)) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/deactivate-kam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kamId })
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        // Refrescar datos
        queryClient.invalidateQueries({ queryKey: ['kams'] })
        router.refresh()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Error al desactivar KAM')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) return <div className="p-6">Cargando...</div>

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Key Account Managers</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Agregar KAM
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Municipio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hospitales
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tiempo Max
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nivel 2
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {kams?.map((kam) => (
              <tr key={kam.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{ backgroundColor: kam.color }}
                    />
                    <div className="text-sm font-medium text-gray-900">{kam.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {kam.area_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {kam.max_travel_time} min
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    kam.enable_level2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {kam.enable_level2 ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeactivateKam(kam.id, kam.name)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Desactivar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}