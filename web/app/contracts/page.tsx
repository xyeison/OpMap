'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useRouter } from 'next/navigation'
import ContractEditModal from '@/components/ContractEditModal'

interface Contract {
  id: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contract_value: number
  start_date: string
  end_date: string
  description?: string
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

      // Cargar lista de KAMs para filtro
      const { data: kamsData } = await supabase
        .from('kams')
        .select('id, name')
        .eq('active', true)
        .order('name')

      setKams(kamsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
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
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Contratos</h1>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Contratos</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Contratos Activos</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Valor Total</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.totalValue)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Valor Promedio</p>
            <p className="text-2xl font-bold">
              {formatCurrency(stats.averageValue)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <input
                type="text"
                placeholder="Hospital, contrato o KAM..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Contrato
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KAM
              </label>
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          </div>
        </div>

        {/* Tabla de contratos */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Número de Contrato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vigencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KAM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredContracts.map(contract => (
                  <tr key={contract.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {contract.hospital?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {contract.hospital?.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contract.contract_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {contract.contract_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(contract.contract_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{formatDate(contract.start_date)}</div>
                        <div className="text-gray-500">
                          hasta {formatDate(contract.end_date)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {contract.kam?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        contract.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {contract.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={contract.description || ''}>
                        {contract.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditingContract(contract)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => router.push(`/hospitals/${contract.hospital_id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver Hospital
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredContracts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No se encontraron contratos con los filtros aplicados
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