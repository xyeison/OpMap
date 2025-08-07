'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { useRouter } from 'next/navigation'
import ContractEditModal from '@/components/ContractEditModal'
import { usePermissions } from '@/hooks/usePermissions'

interface Contract {
  id: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contract_value: number
  start_date: string
  end_date: string
  description?: string
  provider?: string
  active: boolean
  created_at: string
  hospital?: {
    name: string
    code: string
    municipality_id: string
    department_id: string
  }
  kam?: {
    name: string
  }
}

export default function ContractsPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    contractType: 'all',
    status: 'all',
    kam: 'all'
  })
  const [kams, setKams] = useState<any[]>([])
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalValue: 0,
    averageValue: 0
  })
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const canViewKams = can('kams:view')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [contracts, filters])

  const loadData = async () => {
    try {
      // Cargar contratos con información del hospital
      const { data: contractsData } = await supabase
        .from('hospital_contracts')
        .select(`
          *,
          hospitals (
            name,
            code,
            municipality_id,
            department_id
          )
        `)
        .order('created_at', { ascending: false })

      if (contractsData) {
        // Obtener KAMs para cada hospital
        const contractsWithKams = await Promise.all(
          contractsData.map(async (contract) => {
            const { data: assignment } = await supabase
              .from('assignments')
              .select('kam_id')
              .eq('hospital_id', contract.hospital_id)
              .single()

            if (assignment?.kam_id) {
              const { data: kam } = await supabase
                .from('kams')
                .select('name')
                .eq('id', assignment.kam_id)
                .single()
              
              return {
                ...contract,
                hospital: contract.hospitals,
                kam: kam
              }
            }

            return {
              ...contract,
              hospital: contract.hospitals,
              kam: null
            }
          })
        )

        setContracts(contractsWithKams)
        calculateStats(contractsWithKams)
      }

      // Cargar lista de KAMs para filtro solo si el usuario tiene permisos
      if (canViewKams) {
        const { data: kamsData } = await supabase
          .from('kams')
          .select('id, name')
          .eq('active', true)
          .order('name')

        setKams(kamsData || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este contrato?')) {
      return
    }

    const { error } = await supabase
      .from('hospital_contracts')
      .delete()
      .eq('id', contractId)

    if (error) {
      alert('Error al eliminar el contrato: ' + error.message)
    } else {
      await loadData()
    }
  }

  const calculateStats = (contractsList: Contract[]) => {
    const activeContracts = contractsList.filter(c => c.active)
    const totalValue = activeContracts.reduce((sum, c) => sum + (c.contract_value || 0), 0)
    
    setStats({
      total: contractsList.length,
      active: activeContracts.length,
      totalValue: totalValue,
      averageValue: activeContracts.length > 0 ? totalValue / activeContracts.length : 0
    })
  }

  const applyFilters = () => {
    let filtered = [...contracts]

    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(contract => 
        contract.hospital?.name.toLowerCase().includes(searchLower) ||
        contract.contract_number.toLowerCase().includes(searchLower) ||
        contract.kam?.name.toLowerCase().includes(searchLower)
      )
    }

    // Filtro de tipo
    if (filters.contractType !== 'all') {
      filtered = filtered.filter(contract => 
        contract.contract_type === filters.contractType
      )
    }

    // Filtro de estado
    if (filters.status === 'active') {
      filtered = filtered.filter(contract => contract.active)
    } else if (filters.status === 'inactive') {
      filtered = filtered.filter(contract => !contract.active)
    }

    // Filtro de KAM
    if (filters.kam !== 'all') {
      filtered = filtered.filter(contract => 
        contract.kam?.name === filters.kam
      )
    }

    setFilteredContracts(filtered)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO')
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <p>Cargando contratos...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-600 mt-2">Gestión de contratos hospitalarios</p>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">Total Contratos</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-1 rounded-full">
                {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600">Contratos Activos</p>
            <p className="text-3xl font-bold text-gray-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">Valor Total</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.totalValue)}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">Valor Promedio</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(stats.averageValue)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros de Búsqueda</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Hospital, contrato o KAM..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Contrato
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
                value={filters.contractType}
                onChange={(e) => setFilters({ ...filters, contractType: e.target.value })}
              >
                <option value="all">Todos</option>
                <option value="capita">Cápita</option>
                <option value="evento">Evento</option>
                <option value="pgp">PGP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            <PermissionGuard permission="kams:view">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KAM
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all bg-white"
                  value={filters.kam}
                  onChange={(e) => setFilters({ ...filters, kam: e.target.value })}
                >
                  <option value="all">Todos</option>
                  {kams.map(kam => (
                    <option key={kam.id} value={kam.name}>
                      {kam.name}
                    </option>
                  ))}
                </select>
              </div>
            </PermissionGuard>
          </div>
        </div>

        {/* Tabla de contratos */}
        {/* Vista de tabla mejorada para desktop */}
        <div className="hidden lg:block">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hospital</span>
                    </th>
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Contrato</span>
                    </th>
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tipo</span>
                    </th>
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Valor</span>
                    </th>
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Vigencia</span>
                    </th>
                    <th className="px-6 py-5 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Proveedor</span>
                    </th>
                    {can('kams:view') && (
                      <th className="px-6 py-5 text-left">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">KAM</span>
                      </th>
                    )}
                    <th className="px-6 py-5 text-center">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</span>
                    </th>
                    <th className="px-6 py-5 text-center">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredContracts.map((contract, index) => (
                    <tr 
                      key={contract.id} 
                      className="hover:bg-gray-50 transition-colors duration-150"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-900 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {contract.hospital?.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              NIT: {contract.hospital?.code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {contract.contract_number}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {contract.id.substring(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          contract.contract_type === 'capita' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          contract.contract_type === 'evento' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-gray-50 text-gray-700 border border-gray-200'
                        }`}>
                          <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                          </svg>
                          <span className="capitalize">{contract.contract_type}</span>
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(contract.contract_value)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Anual
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(contract.start_date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              hasta {formatDate(contract.end_date)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {contract.provider || 'No especificado'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {can('kams:view') && (
                        <td className="px-6 py-5">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mr-2">
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {contract.kam?.name || 'Sin asignar'}
                            </span>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${
                          contract.active 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
                            : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${contract.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          {contract.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <PermissionGuard permission="contracts:edit">
                          <button
                            onClick={() => setEditingContract(contract)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                            title="Editar contrato"
                          >
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                          </button>
                        </PermissionGuard>
                        <button
                          onClick={() => router.push(`/hospitals/${contract.hospital_id}`)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                          title="Ver hospital"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                        </button>
                        <PermissionGuard permission="contracts:delete">
                          <button
                            onClick={() => handleDeleteContract(contract.id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all group"
                            title="Eliminar contrato"
                          >
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          </button>
                        </PermissionGuard>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredContracts.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron contratos</h3>
              <p className="mt-1 text-sm text-gray-500">Ajusta los filtros o agrega un nuevo contrato.</p>
            </div>
          )}
        </div>
        </div>

        {/* Vista de tarjetas para móvil */}
        <div className="lg:hidden space-y-4">
          {filteredContracts.map(contract => (
            <div key={contract.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {contract.hospital?.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {contract.hospital?.code}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  contract.active ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-700'
                }`}>
                  {contract.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div>
                  <span className="text-gray-600">Contrato:</span>
                  <p className="font-medium text-gray-900">{contract.contract_number}</p>
                </div>
                <div>
                  <span className="text-gray-600">Tipo:</span>
                  <p className="font-medium text-gray-900">{contract.contract_type}</p>
                </div>
                <div>
                  <span className="text-gray-600">Valor:</span>
                  <p className="font-medium text-gray-900">{formatCurrency(contract.contract_value)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Vigencia:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(contract.start_date).toLocaleDateString()} - {new Date(contract.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Proveedor:</span>
                  <p className="font-medium text-gray-900">{contract.provider || 'No especificado'}</p>
                </div>
                {can('kams:view') && contract.kam && (
                  <div className="col-span-2">
                    <span className="text-gray-600">KAM:</span>
                    <p className="font-medium text-gray-900">{contract.kam.name}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 justify-end">
                {can('contracts:edit') && (
                  <button
                    onClick={() => setEditingContract(contract)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() => router.push(`/hospitals/${contract.hospital_id}`)}
                  className="px-3 py-1 text-xs bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
                >
                  Ver Hospital
                </button>
              </div>
            </div>
          ))}
          
          {filteredContracts.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron contratos</h3>
              <p className="mt-1 text-sm text-gray-500">Ajusta los filtros o agrega un nuevo contrato.</p>
            </div>
          )}
        </div>

        {/* Modal de edición */}
        {editingContract && (
          <ContractEditModal
            contract={editingContract}
            onClose={() => setEditingContract(null)}
            onSave={() => {
              setEditingContract(null)
              loadData()
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}