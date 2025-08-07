'use client'

import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

export default function TerritoryDetailPage() {
  const params = useParams()
  const territoryId = params.id as string
  
  // Query para datos del territorio
  const { data: territory, isLoading: loadingTerritory } = useQuery({
    queryKey: ['territory-detail', territoryId],
    queryFn: async () => {
      // Primero intentar obtener de municipalities
      let { data: municData, error: municError } = await supabase
        .from('municipalities')
        .select(`
          *,
          departments!inner(name)
        `)
        .eq('code', territoryId)
        .single()
      
      if (municData && !municError) {
        return {
          id: municData.code,
          name: municData.name,
          type: 'municipality' as const,
          department_name: municData.departments?.name,
          population: municData.population_2025,
          lat: municData.lat,
          lng: municData.lng
        }
      }
      
      // Si no es municipio, buscar en localities (Bogotá)
      const { data: localityData } = await supabase
        .from('hospitals')
        .select('locality_id, locality_name')
        .eq('locality_id', territoryId)
        .not('locality_id', 'is', null)
        .limit(1)
        .single()
      
      if (localityData) {
        return {
          id: localityData.locality_id,
          name: localityData.locality_name,
          type: 'locality' as const,
          department_name: 'Bogotá D.C.'
        }
      }
      
      return null
    },
    enabled: !!territoryId
  })

  // Query para hospitales del territorio
  const { data: hospitals = [], isLoading: loadingHospitals } = useQuery({
    queryKey: ['territory-hospitals', territoryId],
    queryFn: async () => {
      const isLocality = territoryId.length > 5
      const field = isLocality ? 'locality_id' : 'municipality_id'
      
      const { data, error } = await supabase
        .from('hospitals')
        .select('*')
        .eq(field, territoryId)
        .order('beds', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    enabled: !!territoryId
  })

  // Query para contratos
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['territory-contracts', territoryId],
    queryFn: async () => {
      const hospitalIds = hospitals.map(h => h.id)
      if (hospitalIds.length === 0) return []
      
      const { data, error } = await supabase
        .from('hospital_contracts')
        .select(`
          *,
          hospitals!inner(name)
        `)
        .in('hospital_id', hospitalIds)
        .eq('active', true)
        .order('contract_value', { ascending: false })
      
      if (error) throw error
      return data?.map(c => ({
        ...c,
        hospital_name: c.hospitals?.name
      })) || []
    },
    enabled: hospitals.length > 0
  })

  // Query para asignación de KAM
  const { data: assignment } = useQuery({
    queryKey: ['territory-assignment', territoryId],
    queryFn: async () => {
      // Primero verificar asignación forzada
      const { data: forcedData } = await supabase
        .from('forced_assignments')
        .select(`
          *,
          kams!inner(name, color)
        `)
        .eq('territory_id', territoryId)
        .eq('active', true)
        .single()
      
      if (forcedData) {
        return {
          kam_id: forcedData.kam_id,
          kam_name: forcedData.kams.name,
          kam_color: forcedData.kams.color,
          is_forced: true,
          forced_reason: forcedData.reason
        }
      }
      
      // Si no hay asignación forzada, buscar en assignments
      if (hospitals.length > 0) {
        const { data: assignmentData } = await supabase
          .from('assignments')
          .select(`
            kam_id,
            kams!inner(name, color)
          `)
          .eq('hospital_id', hospitals[0].id)
          .single()
        
        if (assignmentData) {
          const kamData = Array.isArray(assignmentData.kams) 
            ? assignmentData.kams[0] 
            : assignmentData.kams
          
          return {
            kam_id: assignmentData.kam_id,
            kam_name: kamData?.name,
            kam_color: kamData?.color,
            is_forced: false
          }
        }
      }
      
      return null
    },
    enabled: !!territoryId
  })

  // Calcular estadísticas
  const stats = {
    hospital_count: hospitals.length,
    active_hospitals: hospitals.filter(h => h.active).length,
    total_beds: hospitals.reduce((sum, h) => sum + (h.beds || 0), 0),
    high_level_hospitals: hospitals.filter(h => h.service_level >= 3).length,
    total_contract_value: contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0),
    total_surgeries: hospitals.reduce((sum, h) => sum + (h.surgeries || 0), 0),
    total_ambulances: hospitals.reduce((sum, h) => sum + (h.ambulances || 0), 0)
  }

  const isLoading = loadingTerritory || loadingHospitals || loadingContracts

  if (isLoading) {
    return (
      <ProtectedRoute>
        <PermissionGuard permission="territories:view">
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </PermissionGuard>
      </ProtectedRoute>
    )
  }

  if (!territory) {
    return (
      <ProtectedRoute>
        <PermissionGuard permission="territories:view">
          <div className="container mx-auto px-4 py-8">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              Territorio no encontrado
            </div>
            <Link href="/territories" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
              ← Volver a territorios
            </Link>
          </div>
        </PermissionGuard>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard permission="territories:view">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <Link href="/territories" className="text-gray-600 hover:text-gray-800 mb-4 inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver a territorios
            </Link>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{territory.name}</h1>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-gray-500">
                      {territory.type === 'locality' ? 'Localidad' : 'Municipio'}
                    </span>
                    {territory.department_name && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{territory.department_name}</span>
                      </>
                    )}
                    {territory.population && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">
                          Población: {territory.population.toLocaleString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {assignment && (
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">Asignado a</div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: assignment.kam_color }}
                      />
                      <span className="font-medium">{assignment.kam_name}</span>
                      {assignment.is_forced && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Forzado
                        </span>
                      )}
                    </div>
                    {assignment.forced_reason && (
                      <div className="text-xs text-gray-500 mt-1">
                        Razón: {assignment.forced_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Hospitales</div>
              <div className="text-2xl font-bold text-gray-900">{stats.hospital_count}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.active_hospitals} activos
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Total Camas</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_beds}</div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.high_level_hospitals} alta complejidad
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Valor Contratos</div>
              <div className="text-2xl font-bold text-gray-900">
                ${(stats.total_contract_value / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {contracts.length} contratos activos
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-500">Recursos</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_ambulances}</div>
              <div className="text-xs text-gray-500 mt-1">
                ambulancias • {stats.total_surgeries} cirugías
              </div>
            </div>
          </div>

          {/* Hospitals Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Hospitales ({hospitals.length})
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hospital
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nivel
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Camas
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ambulancias
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {hospitals.map((hospital) => (
                    <tr key={hospital.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {hospital.name}
                          </div>
                          {hospital.address && (
                            <div className="text-xs text-gray-500">{hospital.address}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {hospital.code}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          hospital.service_level >= 3 
                            ? 'bg-purple-100 text-purple-800' 
                            : hospital.service_level === 2
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          Nivel {hospital.service_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {hospital.beds || 0}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {hospital.ambulances || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          hospital.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {hospital.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/hospitals/${hospital.id}`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {hospitals.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay hospitales en este territorio
                </div>
              )}
            </div>
          </div>

          {/* Contracts Table */}
          {contracts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Contratos Activos ({contracts.length})
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hospital
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor Anual
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vigencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {contracts.map((contract) => (
                      <tr key={contract.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {contract.hospital_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {contract.contract_type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">
                          ${(contract.contract_value / 1000000).toFixed(2)}M
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {new Date(contract.end_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}