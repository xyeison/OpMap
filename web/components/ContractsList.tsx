'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Contract {
  id: string
  contract_value: number
  start_date: string
  duration_months: number
  current_provider: string
  description: string | null
  active: boolean
  created_at: string
}

interface ContractsListProps {
  hospitalId: string
  onClose: () => void
}

export default function ContractsList({ hospitalId, onClose }: ContractsListProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContract, setNewContract] = useState({
    contract_value: '',
    start_date: '',
    duration_months: '',
    current_provider: '',
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
    if (!newContract.contract_value || !newContract.start_date || !newContract.duration_months || !newContract.current_provider) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    const { error } = await supabase
      .from('hospital_contracts')
      .insert({
        hospital_id: hospitalId,
        contract_value: parseFloat(newContract.contract_value),
        start_date: newContract.start_date,
        duration_months: parseInt(newContract.duration_months),
        current_provider: newContract.current_provider,
        description: newContract.description || null,
        active: newContract.active,
        created_by: typeof window !== 'undefined' 
          ? (JSON.parse(localStorage.getItem('opmap_user') || '{}')).id
          : null
      })

    if (!error) {
      setNewContract({
        contract_value: '',
        start_date: '',
        duration_months: '',
        current_provider: '',
        description: '',
        active: true
      })
      setShowAddForm(false)
      loadContracts()
    }
  }

  const toggleActive = async (contractId: string, currentActive: boolean) => {
    await supabase
      .from('hospital_contracts')
      .update({ active: !currentActive })
      .eq('id', contractId)
    
    loadContracts()
  }

  const calculateEndDate = (startDate: string, months: number) => {
    const date = new Date(startDate)
    date.setMonth(date.getMonth() + months)
    return date.toLocaleDateString('es-CO')
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
                  Proveedor actual *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newContract.current_provider}
                  onChange={(e) => setNewContract({...newContract, current_provider: e.target.value})}
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
                  Vigencia (meses) *
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={newContract.duration_months}
                  onChange={(e) => setNewContract({...newContract, duration_months: e.target.value})}
                />
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Descripción
                </label>
                <textarea
                  className="w-full p-2 border rounded"
                  rows={2}
                  value={newContract.description}
                  onChange={(e) => setNewContract({...newContract, description: e.target.value})}
                />
              </div>
              
              <div className="col-span-2">
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
                      <h4 className="font-semibold">{contract.current_provider}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        contract.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Valor:</span>
                        <span className="ml-2 font-medium">
                          ${contract.contract_value.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Vigencia:</span>
                        <span className="ml-2">{contract.duration_months} meses</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Inicio:</span>
                        <span className="ml-2">{new Date(contract.start_date).toLocaleDateString('es-CO')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Fin:</span>
                        <span className="ml-2">{calculateEndDate(contract.start_date, contract.duration_months)}</span>
                      </div>
                    </div>
                    {contract.description && (
                      <p className="text-sm text-gray-600 mt-2">{contract.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleActive(contract.id, contract.active)}
                    className={`px-3 py-1 text-sm rounded ${
                      contract.active 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {contract.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}