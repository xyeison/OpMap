'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ContractEditModal from './ContractEditModal'

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
}

interface ContractsListImprovedProps {
  hospitalId: string
  onClose: () => void
}

export default function ContractsListImproved({ hospitalId, onClose }: ContractsListImprovedProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [newContract, setNewContract] = useState({
    contract_number: '',
    contract_type: 'capita',
    contract_value: '',
    start_date: '',
    end_date: '',
    description: '',
    active: true
  })

  useEffect(() => {
    loadContracts()
  }, [hospitalId])

  const loadContracts = async () => {
    const { data, error } = await supabase
      .from('hospital_contracts')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (data) setContracts(data)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newContract.contract_number || !newContract.contract_value || !newContract.start_date || !newContract.end_date) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    const userId = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('opmap_user') || '{}').id
      : null

    try {
      // Calcular duration_months a partir de las fechas
      const startDate = new Date(newContract.start_date)
      const endDate = new Date(newContract.end_date)
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth())
      const durationMonths = Math.max(1, Math.round(monthsDiff))

      const { data, error } = await supabase
        .from('hospital_contracts')
        .insert({
          hospital_id: hospitalId,
          contract_number: newContract.contract_number,
          contract_type: newContract.contract_type,
          contract_value: parseFloat(newContract.contract_value),
          start_date: newContract.start_date,
          end_date: newContract.end_date,
          duration_months: durationMonths,
          current_provider: 'Proveedor', // Agregar valor por defecto
          description: newContract.description || null,
          active: newContract.active,
          created_by: userId || null
        })
        .select()

      if (error) {
        console.error('Error detallado al agregar contrato:', error)
        alert(`Error al agregar contrato: ${error.message}\n${error.details || ''}\n${error.hint || ''}`)
        return
      }

      setNewContract({
        contract_number: '',
        contract_type: 'capita',
        contract_value: '',
        start_date: '',
        end_date: '',
        description: '',
        active: true
      })
      setShowAddForm(false)
      loadContracts()
      alert('Contrato agregado exitosamente')
    } catch (err) {
      console.error('Error inesperado:', err)
      alert('Error inesperado al agregar contrato')
    }
  }

  const toggleActive = async (contractId: string, currentActive: boolean) => {
    await supabase
      .from('hospital_contracts')
      .update({ active: !currentActive })
      .eq('id', contractId)
    
    loadContracts()
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Contratos del Hospital</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Agregar Contrato
          </button>
        )}

        {showAddForm && (
          <div className="bg-gray-50 p-4 rounded mb-4">
            <h4 className="font-semibold mb-3">Nuevo Contrato</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Número de Contrato *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newContract.contract_number}
                  onChange={(e) => setNewContract({...newContract, contract_number: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tipo de Contrato *
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={newContract.contract_type}
                  onChange={(e) => setNewContract({...newContract, contract_type: e.target.value})}
                >
                  <option value="capita">Cápita</option>
                  <option value="evento">Evento</option>
                  <option value="pgp">PGP</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor del contrato *
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={newContract.contract_value}
                  onChange={(e) => setNewContract({...newContract, contract_value: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha inicio *
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={newContract.start_date}
                  onChange={(e) => setNewContract({...newContract, start_date: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha fin *
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={newContract.end_date}
                  onChange={(e) => setNewContract({...newContract, end_date: e.target.value})}
                  min={newContract.start_date}
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newContract.active}
                    onChange={(e) => setNewContract({...newContract, active: e.target.checked})}
                  />
                  <span className="text-sm font-medium">Contrato activo</span>
                </label>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Descripción de la oportunidad
              </label>
              <textarea
                className="w-full p-2 border rounded"
                rows={4}
                placeholder="Describa los detalles de la oportunidad..."
                value={newContract.description}
                onChange={(e) => setNewContract({...newContract, description: e.target.value})}
              />
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p>Cargando contratos...</p>
        ) : contracts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay contratos registrados</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.id} className={`border rounded p-4 ${!contract.active ? 'bg-gray-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{contract.contract_number}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        contract.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {contract.contract_type === 'capita' ? 'Cápita' : 
                         contract.contract_type === 'evento' ? 'Evento' : 'PGP'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Valor:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency(contract.contract_value)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Inicio:</span>
                        <span className="ml-2">{formatDate(contract.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Fin:</span>
                        <span className="ml-2">{formatDate(contract.end_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duración:</span>
                        <span className="ml-2">
                          {Math.round((new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses
                        </span>
                      </div>
                    </div>
                    {contract.description && (
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Descripción:</span>
                        <p className="text-gray-800 mt-1">{contract.description}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingContract(contract)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(contract.id, contract.active)}
                      className={contract.active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}
                    >
                      {contract.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSave={() => {
            setEditingContract(null)
            loadContracts()
          }}
        />
      )}
    </div>
  )
}