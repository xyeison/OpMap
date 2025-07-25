'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { hospitalService } from '@/lib/supabase'
import HospitalActions from './HospitalActions'

export default function HospitalsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()
  
  const { data: hospitals, isLoading } = useQuery({
    queryKey: ['hospitals'],
    queryFn: hospitalService.getAll,
  })
  
  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['hospitals'] })
  }

  const filteredHospitals = hospitals?.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.code.includes(searchTerm)
  )

  if (isLoading) return <div className="p-6">Cargando...</div>

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Hospitales / IPS</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Agregar Hospital
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          className="w-full max-w-md px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Código
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Municipio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Camas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                KAM Asignado
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHospitals?.slice(0, 20).map((hospital) => (
              <tr key={hospital.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {hospital.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{hospital.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {hospital.municipality_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {hospital.beds || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <HospitalActions 
                    hospital={hospital} 
                    onUpdate={handleUpdate}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredHospitals && filteredHospitals.length > 20 && (
          <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600">
            Mostrando 20 de {filteredHospitals.length} hospitales
          </div>
        )}
      </div>
    </div>
  )
}