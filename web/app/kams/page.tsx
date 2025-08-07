'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { kamService, supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import KamDeactivateButton from '@/components/KamDeactivateButton'
import KamActivateButton from '@/components/KamActivateButton'
import EditKamModal from '@/components/EditKamModal'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

interface KamWithData {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  color: string
  active: boolean
  max_travel_time: number
  enable_level2: boolean
  priority: number
  municipalityName?: string
  hospitalCount?: number
  contractsValue?: number
}

export default function KamsPage() {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [kamsWithData, setKamsWithData] = useState<KamWithData[]>([])
  const [editingKam, setEditingKam] = useState<KamWithData | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()
  const router = useRouter()
  
  const { data: kams, isLoading } = useQuery({
    queryKey: ['kams'],
    queryFn: kamService.getAll,
  })

  useEffect(() => {
    if (kams) {
      loadAdditionalData()
    }
  }, [kams])

  const loadAdditionalData = async () => {
    if (!kams) return

    const updatedKams = await Promise.all(
      kams.map(async (kam) => {
        // Cargar nombre del municipio
        const { data: municipality } = await supabase
          .from('municipalities')
          .select('name')
          .eq('code', kam.area_id)
          .single()

        // Contar hospitales asignados
        const { count } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('kam_id', kam.id)

        // Calcular valor total de contratos
        const { data: assignments } = await supabase
          .from('assignments')
          .select('hospital_id')
          .eq('kam_id', kam.id)

        let totalValue = 0
        if (assignments && assignments.length > 0) {
          const hospitalIds = assignments.map(a => a.hospital_id)
          const { data: contracts } = await supabase
            .from('hospital_contracts')
            .select('contract_value')
            .in('hospital_id', hospitalIds)
            .eq('active', true)
          
          if (contracts) {
            totalValue = contracts.reduce((sum, c) => sum + (c.contract_value || 0), 0)
          }
        }

        return {
          ...kam,
          municipalityName: municipality?.name,
          hospitalCount: count || 0,
          contractsValue: totalValue
        }
      })
    )

    setKamsWithData(updatedKams)
  }

  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['kams'] })
    router.refresh()
  }

  const handleEditClick = (kam: KamWithData) => {
    setEditingKam(kam)
    setShowEditModal(true)
  }

  const handleEditClose = () => {
    setEditingKam(null)
    setShowEditModal(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const filteredKams = kamsWithData.filter(kam => 
    kam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (kam.municipalityName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const activeKams = filteredKams.filter(k => k.active).length
  const totalHospitals = filteredKams.reduce((sum, k) => sum + (k.hospitalCount || 0), 0)
  const totalValue = filteredKams.reduce((sum, k) => sum + (k.contractsValue || 0), 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando KAMs...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="kams:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                  <strong className="font-semibold">Acceso denegado</strong>
                  <p className="text-sm mt-1">No tienes permisos para ver los KAMs.</p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white">Key Account Managers</h1>
                <p className="text-gray-300 mt-2">Gestión de vendedores y territorios comerciales</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => router.push('/kams/colors')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
                  </svg>
                  <span className="hidden sm:inline">Configurar</span> Colores
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  Agregar KAM
                </button>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total KAMs</p>
              <p className="text-2xl font-bold text-gray-900">{filteredKams.length}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  {filteredKams.length > 0 ? Math.round((activeKams / filteredKams.length) * 100) : 0}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">KAMs Activos</p>
              <p className="text-2xl font-bold text-gray-900">{activeKams}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Hospitales Asignados</p>
              <p className="text-2xl font-bold text-gray-900">{totalHospitals}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Valor Contratos</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre o municipio..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Tabla responsive con vista de tarjetas en móvil */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">KAM</span>
                  </th>
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Ubicación</span>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hospitales</span>
                  </th>
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Configuración</span>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</span>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredKams.map((kam, index) => (
                  <tr 
                    key={kam.id} 
                    className="hover:bg-gray-50 transition-all duration-150"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${!kam.active ? 'opacity-50' : ''}`}
                            style={{ backgroundColor: kam.color }}
                          >
                            {kam.name.substring(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`text-sm font-semibold ${kam.active ? 'text-gray-900' : 'text-gray-400'}`}>
                            {kam.name}
                          </div>
                          {!kam.active && (
                            <span className="text-xs text-gray-500">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {kam.municipalityName || kam.area_id}
                          </div>
                          <div className="text-xs text-gray-500">
                            Código: {kam.area_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-gray-900">{kam.hospitalCount || 0}</span>
                        <span className="text-xs text-gray-500">hospitales</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span className="text-sm text-gray-600">Máx: {kam.max_travel_time} min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            kam.enable_level2 
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                          }`}>
                            {kam.enable_level2 ? '✓ Nivel 2 activo' : 'Solo nivel 1'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${
                        kam.active 
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
                          : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${kam.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {kam.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleEditClick(kam)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                          title="Editar KAM"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        {kam.active ? (
                          <KamDeactivateButton 
                            kam={kam} 
                            onUpdate={handleUpdate}
                            className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-all group"
                          />
                        ) : (
                          <KamActivateButton 
                            kam={kam} 
                            onUpdate={handleUpdate}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-all group"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista de tarjetas para móvil */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredKams.map((kam) => (
              <div 
                key={kam.id} 
                className={`bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all ${
                  !kam.active ? 'opacity-75' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md ${!kam.active ? 'opacity-50' : ''}`}
                      style={{ backgroundColor: kam.color }}
                    >
                      {kam.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <h3 className={`text-lg font-semibold ${kam.active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {kam.name}
                      </h3>
                      <p className="text-sm text-gray-500">{kam.municipalityName || kam.area_id}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                    kam.active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {kam.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{kam.hospitalCount || 0}</p>
                    <p className="text-xs text-gray-500">Hospitales</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-bold text-gray-900">{kam.max_travel_time} min</p>
                    <p className="text-xs text-gray-500">Tiempo máx</p>
                  </div>
                </div>

                <div className="mb-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    kam.enable_level2 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}>
                    {kam.enable_level2 ? '✓ Nivel 2 activo' : 'Solo nivel 1'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditClick(kam)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Editar
                  </button>
                  {kam.active ? (
                    <KamDeactivateButton 
                      kam={kam} 
                      onUpdate={handleUpdate}
                      className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                    />
                  ) : (
                    <KamActivateButton 
                      kam={kam} 
                      onUpdate={handleUpdate}
                      className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredKams.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron KAMs</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega el primer KAM para comenzar'}
              </p>
            </div>
          )}

          {/* Modal de edición */}
          {editingKam && (
            <EditKamModal
              kam={editingKam}
              isOpen={showEditModal}
              onClose={handleEditClose}
              onUpdate={handleUpdate}
            />
          )}
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}