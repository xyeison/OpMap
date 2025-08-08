'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Contract {
  id: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contracting_model?: string
  contract_value: number
  start_date: string
  end_date: string
  description?: string
  provider?: string
  active: boolean
  created_at: string
  isEditing?: boolean
  isNew?: boolean
}

interface ContractsInlineManagerProps {
  hospitalId: string
  onUpdate?: () => void
}

export default function ContractsInlineManager({ hospitalId, onUpdate }: ContractsInlineManagerProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContracts()
  }, [hospitalId])

  const loadContracts = async () => {
    const { data, error } = await supabase
      .from('hospital_contracts')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (data) {
      setContracts(data.map(c => ({ ...c, isEditing: false })))
    }
    setLoading(false)
    onUpdate?.()
  }

  const handleAddNew = () => {
    const newContract: Contract = {
      id: `new-${Date.now()}`,
      hospital_id: hospitalId,
      contract_number: '',
      contract_type: 'capita',
      contracting_model: 'contratacion_directa',
      contract_value: 0,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: '',
      provider: '',
      active: true,
      created_at: new Date().toISOString(),
      isEditing: true,
      isNew: true
    }
    setContracts([newContract, ...contracts])
  }

  const handleSave = async (contract: Contract) => {
    if (!contract.contract_number || !contract.contract_value || !contract.start_date || !contract.end_date) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    try {
      // Calcular duration_months
      const startDate = new Date(contract.start_date)
      const endDate = new Date(contract.end_date)
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth())
      const durationMonths = Math.max(1, Math.round(monthsDiff))

      if (contract.isNew) {
        // Crear nuevo contrato
        const { data, error } = await supabase
          .from('hospital_contracts')
          .insert({
            hospital_id: hospitalId,
            contract_number: contract.contract_number,
            contract_type: contract.contract_type,
            contracting_model: contract.contracting_model || 'contratacion_directa',
            contract_value: contract.contract_value,
            start_date: contract.start_date,
            end_date: contract.end_date,
            duration_months: durationMonths,
            current_provider: contract.provider || 'Proveedor',
            provider: contract.provider || null,
            description: contract.description || null,
            active: contract.active
          })
          .select()

        if (error) throw error
        
        if (data && data[0]) {
          setContracts(contracts.map(c => 
            c.id === contract.id ? { ...data[0], isEditing: false } : c
          ))
        }
      } else {
        // Actualizar contrato existente
        const { error } = await supabase
          .from('hospital_contracts')
          .update({
            contract_number: contract.contract_number,
            contract_type: contract.contract_type,
            contracting_model: contract.contracting_model || 'contratacion_directa',
            contract_value: contract.contract_value,
            start_date: contract.start_date,
            end_date: contract.end_date,
            duration_months: durationMonths,
            provider: contract.provider,
            description: contract.description,
            active: contract.active
          })
          .eq('id', contract.id)

        if (error) throw error

        setContracts(contracts.map(c => 
          c.id === contract.id ? { ...contract, isEditing: false, isNew: false } : c
        ))
      }
      
      onUpdate?.()
    } catch (err: any) {
      console.error('Error saving contract:', err)
      alert(`Error al guardar contrato: ${err.message}`)
    }
  }

  const handleDelete = async (contractId: string) => {
    if (!confirm('¿Está seguro de eliminar este contrato?')) return

    try {
      const { error } = await supabase
        .from('hospital_contracts')
        .delete()
        .eq('id', contractId)

      if (error) throw error

      setContracts(contracts.filter(c => c.id !== contractId))
      onUpdate?.()
    } catch (err: any) {
      console.error('Error deleting contract:', err)
      alert(`Error al eliminar contrato: ${err.message}`)
    }
  }

  const handleCancel = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId)
    if (contract?.isNew) {
      setContracts(contracts.filter(c => c.id !== contractId))
    } else {
      loadContracts()
    }
  }

  const handleEdit = (contractId: string) => {
    setContracts(contracts.map(c => 
      c.id === contractId ? { ...c, isEditing: true } : c
    ))
  }

  const handleFieldChange = (contractId: string, field: keyof Contract, value: any) => {
    setContracts(contracts.map(c => 
      c.id === contractId ? { ...c, [field]: value } : c
    ))
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
    return <div className="text-gray-500">Cargando contratos...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Lista de Contratos</h3>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Agregar Contrato
        </button>
      </div>

      <div className="space-y-3">
        {contracts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay contratos registrados. Haga clic en "Agregar Contrato" para crear uno.
          </div>
        ) : (
          contracts.map((contract) => (
            <div key={contract.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              {contract.isEditing ? (
                // Modo edición
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Número de Contrato *</label>
                    <input
                      type="text"
                      value={contract.contract_number}
                      onChange={(e) => handleFieldChange(contract.id, 'contract_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Tipo</label>
                    <select
                      value={contract.contract_type}
                      onChange={(e) => handleFieldChange(contract.id, 'contract_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    >
                      <option value="capita">Cápita</option>
                      <option value="evento">Evento</option>
                      <option value="pgp">PGP</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Modelo de Contratación</label>
                    <select
                      value={contract.contracting_model || 'contratacion_directa'}
                      onChange={(e) => handleFieldChange(contract.id, 'contracting_model', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    >
                      <option value="contratacion_directa">Contratación Directa</option>
                      <option value="licitacion">Licitación</option>
                      <option value="invitacion_privada">Invitación Privada</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Valor *</label>
                    <input
                      type="number"
                      value={contract.contract_value}
                      onChange={(e) => handleFieldChange(contract.id, 'contract_value', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Fecha Inicio *</label>
                    <input
                      type="date"
                      value={contract.start_date}
                      onChange={(e) => handleFieldChange(contract.id, 'start_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Fecha Fin *</label>
                    <input
                      type="date"
                      value={contract.end_date}
                      onChange={(e) => handleFieldChange(contract.id, 'end_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Proveedor</label>
                    <input
                      type="text"
                      value={contract.provider || ''}
                      onChange={(e) => handleFieldChange(contract.id, 'provider', e.target.value)}
                      placeholder="Nombre del proveedor"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Estado</label>
                    <select
                      value={contract.active ? 'active' : 'inactive'}
                      onChange={(e) => handleFieldChange(contract.id, 'active', e.target.value === 'active')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="text-xs font-semibold text-gray-700">Descripción</label>
                    <textarea
                      value={contract.description || ''}
                      onChange={(e) => handleFieldChange(contract.id, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700"
                      rows={2}
                    />
                  </div>
                  
                  <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-2">
                    <button
                      onClick={() => handleCancel(contract.id)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSave(contract)}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                // Modo visualización
                <div>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">{contract.contract_number}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          contract.contract_type === 'capita' ? 'bg-gray-200 text-gray-800' :
                          contract.contract_type === 'evento' ? 'bg-gray-700 text-white' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {contract.contract_type.toUpperCase()}
                        </span>
                        {contract.contracting_model && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            contract.contracting_model === 'licitacion' ? 'bg-blue-100 text-blue-800' :
                            contract.contracting_model === 'invitacion_privada' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {contract.contracting_model === 'licitacion' ? 'Licitación' :
                             contract.contracting_model === 'invitacion_privada' ? 'Invitación Privada' :
                             'Contratación Directa'}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          contract.active ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-700'
                        }`}>
                          {contract.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Valor:</span>
                          <span className="ml-2 font-medium text-gray-900">{formatCurrency(contract.contract_value)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Inicio:</span>
                          <span className="ml-2 font-medium text-gray-900">{formatDate(contract.start_date)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fin:</span>
                          <span className="ml-2 font-medium text-gray-900">{formatDate(contract.end_date)}</span>
                        </div>
                      </div>
                      
                      {contract.provider && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">Proveedor:</span>
                          <span className="ml-2 font-medium text-gray-900">{contract.provider}</span>
                        </div>
                      )}
                      
                      {contract.description && (
                        <div className="mt-2 text-sm text-gray-600">
                          {contract.description}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(contract.id)}
                        className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(contract.id)}
                        className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}