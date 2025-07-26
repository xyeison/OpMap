'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function HospitalsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [hospitalsWithKam, setHospitalsWithKam] = useState<any[]>([])
  const queryClient = useQueryClient()
  
  const { data: hospitals, isLoading } = useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      // Cargar hospitales
      const { data: hospitalsData } = await supabase
        .from('hospitals')
        .select('*')
        .eq('active', true)
        .order('name')
      
      // Cargar asignaciones con detalles de KAM
      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          hospital_id,
          kam_id,
          kams!inner (
            id,
            name
          )
        `)
      
      // Crear mapa de hospital_id -> kam_name
      const kamMap = new Map()
      assignments?.forEach((a: any) => {
        if (a.kams && typeof a.kams === 'object' && 'name' in a.kams) {
          kamMap.set(a.hospital_id, a.kams.name)
        }
      })
      
      // Combinar datos
      const hospitalsWithKamData = hospitalsData?.map(h => ({
        ...h,
        assigned_kam_name: kamMap.get(h.id) || null
      }))
      
      return hospitalsWithKamData
    },
  })
  
  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['hospitals'] })
  }

  const filteredHospitals = hospitals?.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.code.includes(searchTerm)
  )
  
  console.log('Hospitals loaded:', hospitals?.length)

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

      {/* Vista móvil */}
      <div className="block md:hidden">
        {filteredHospitals?.slice(0, 20).map((hospital) => (
          <div key={hospital.id} className="bg-white rounded-lg shadow mb-4 p-4">
            <div className="mb-2">
              <p className="text-sm text-gray-500">Código: {hospital.code}</p>
              <h3 className="font-semibold">{hospital.name}</h3>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p>Municipio: {hospital.municipality_id}</p>
              <p>Camas: {hospital.beds || '-'}</p>
              <p className="font-medium">KAM: {hospital.assigned_kam_name || 'Sin asignar'}</p>
            </div>
            <button
              onClick={() => {
                console.log('Navigating to hospital:', hospital.id);
                window.location.href = `/hospitals/${hospital.id}`;
              }}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              Ver detalle del hospital
            </button>
          </div>
        ))}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hospital
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Municipio
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                <td className="px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{hospital.name}</div>
                    <div className="text-xs text-gray-500">{hospital.code}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                  {hospital.municipality_id}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <span className="text-gray-900">
                    {hospital.assigned_kam_name || '-'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => {
                      console.log('Navigating to hospital:', hospital.id);
                      window.location.href = `/hospitals/${hospital.id}`;
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded cursor-pointer"
                  >
                    Ver detalle
                  </button>
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