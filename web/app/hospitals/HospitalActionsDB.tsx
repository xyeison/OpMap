'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProviderSelect from '@/components/providers/ProviderSelect'

interface HospitalActionsProps {
  hospital: any
  onUpdate: () => void
  userRole?: string
}

// CAMBIAR ESTE ID POR EL ID REAL DEL USUARIO
// Ve a Supabase > Table Editor > users y copia un ID
const CURRENT_USER_ID = '146cef24-b60a-4903-ab24-ac013866ff5b'

export default function HospitalActions({ hospital, onUpdate, userRole = 'user' }: HospitalActionsProps) {
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [contract, setContract] = useState({
    contract_value: '',
    start_date: '',
    duration_months: '',
    current_provider: '',
    proveedor_id: '',
    description: ''
  })

  const handleToggleActive = async () => {
    if (!reason.trim()) {
      alert('Por favor ingrese una razón')
      return
    }

    setLoading(true)
    try {
      // 1. Registrar en historial
      const { error: historyError } = await supabase.from('hospital_history').insert({
        hospital_id: hospital.id,
        user_id: CURRENT_USER_ID,
        action: hospital.active ? 'deactivated' : 'activated',
        reason: reason,
        previous_state: hospital.active,
        new_state: !hospital.active
      })

      if (historyError) throw historyError

      // 2. Actualizar estado del hospital
      const { error: updateError } = await supabase
        .from('hospitals')
        .update({ active: !hospital.active })
        .eq('id', hospital.id)

      if (updateError) throw updateError

      alert(`Hospital ${hospital.active ? 'desactivado' : 'activado'} exitosamente`)
      setShowReasonModal(false)
      setReason('')
      onUpdate()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert(`Error: ${error.message || 'No se pudo actualizar el hospital'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContract = async () => {
    if (!contract.contract_value || !contract.start_date || !contract.duration_months || !contract.current_provider) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('hospital_contracts').insert({
        hospital_id: hospital.id,
        contract_value: parseFloat(contract.contract_value),
        start_date: contract.start_date,
        duration_months: parseInt(contract.duration_months),
        current_provider: contract.current_provider,
        proveedor_id: contract.proveedor_id || null,
        description: contract.description || null,
        created_by: CURRENT_USER_ID
      })

      if (error) throw error

      alert('Contrato agregado exitosamente')
      setShowContractModal(false)
      setContract({
        contract_value: '',
        start_date: '',
        duration_months: '',
        current_provider: '',
        proveedor_id: '',
        description: ''
      })
      
    } catch (error: any) {
      console.error('Error:', error)
      alert(`Error: ${error.message || 'No se pudo agregar el contrato'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowReasonModal(true)}
          className={`px-3 py-1 text-sm rounded ${
            hospital.active 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {hospital.active ? 'Desactivar' : 'Activar'}
        </button>
        
        <button
          onClick={() => setShowContractModal(true)}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
        >
          + Contrato
        </button>
      </div>

      {/* Modal para razón de activar/desactivar */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">
              {hospital.active ? 'Desactivar' : 'Activar'} Hospital
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Hospital: <strong>{hospital.name}</strong>
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              rows={4}
              placeholder="Ingrese la razón..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowReasonModal(false)
                  setReason('')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleActive}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar contrato */}
      {showContractModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">Agregar Contrato</h3>
            <p className="mb-4 text-sm text-gray-600">
              Hospital: <strong>{hospital.name}</strong>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor del contrato <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={contract.contract_value}
                  onChange={(e) => setContract({...contract, contract_value: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={contract.start_date}
                  onChange={(e) => setContract({...contract, start_date: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Plazo (meses) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={contract.duration_months}
                  onChange={(e) => setContract({...contract, duration_months: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <ProviderSelect
                  value={contract.proveedor_id}
                  onChange={(providerId, provider) => {
                    setContract({ 
                      ...contract, 
                      proveedor_id: providerId || '',
                      current_provider: provider?.nombre || contract.current_provider
                    })
                  }}
                  placeholder="Buscar o crear proveedor..."
                  className="w-full"
                />
                {/* Campo manual temporal para corregir datos antiguos */}
                <div className="mt-2">
                  <label className="block mb-1 text-xs text-gray-600">Proveedor (texto manual - temporal):</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded text-sm"
                    value={contract.current_provider}
                    onChange={(e) => setContract({...contract, current_provider: e.target.value})}
                    disabled={loading}
                    placeholder="Solo para corregir contratos antiguos"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  className="w-full p-2 border rounded"
                  rows={3}
                  value={contract.description}
                  onChange={(e) => setContract({...contract, description: e.target.value})}
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowContractModal(false)
                  setContract({
                    contract_value: '',
                    start_date: '',
                    duration_months: '',
                    current_provider: '',
                    description: '',
                    proveedor_id: ''
                  })
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddContract}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}