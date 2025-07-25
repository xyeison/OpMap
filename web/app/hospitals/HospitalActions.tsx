'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface HospitalActionsProps {
  hospital: any
  onUpdate: () => void
  userRole?: string
}

export default function HospitalActions({ hospital, onUpdate, userRole = 'user' }: HospitalActionsProps) {
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [reason, setReason] = useState('')
  const [contract, setContract] = useState({
    contract_value: '',
    start_date: '',
    duration_months: '',
    current_provider: '',
    description: ''
  })

  const handleToggleActive = async () => {
    if (!reason.trim()) {
      alert('Por favor ingrese una razón')
      return
    }

    try {
      // Por ahora solo mostrar alert
      alert(`Hospital ${hospital.active ? 'desactivado' : 'activado'}.\nRazón: ${reason}`)
      
      // TODO: Implementar guardado en BD cuando las tablas estén creadas
      /*
      await supabase.from('hospital_history').insert({
        hospital_id: hospital.id,
        user_id: 'TEMP_USER_ID',
        action: hospital.active ? 'deactivated' : 'activated',
        reason: reason,
        previous_state: hospital.active,
        new_state: !hospital.active
      })

      await supabase
        .from('hospitals')
        .update({ active: !hospital.active })
        .eq('id', hospital.id)
      */
      
      setShowReasonModal(false)
      setReason('')
      onUpdate()
    } catch (error) {
      console.error('Error:', error)
      alert('Error al actualizar el hospital')
    }
  }

  const handleAddContract = async () => {
    try {
      // Por ahora solo mostrar los datos
      alert(`Contrato agregado:\n` +
        `Valor: $${contract.contract_value}\n` +
        `Fecha inicio: ${contract.start_date}\n` +
        `Duración: ${contract.duration_months} meses\n` +
        `Proveedor: ${contract.current_provider}`)
      
      // TODO: Implementar guardado en BD cuando las tablas estén creadas
      /*
      await supabase.from('hospital_contracts').insert({
        hospital_id: hospital.id,
        contract_value: parseFloat(contract.contract_value),
        start_date: contract.start_date,
        duration_months: parseInt(contract.duration_months),
        current_provider: contract.current_provider,
        description: contract.description,
        created_by: 'TEMP_USER_ID'
      })
      */
      
      setShowContractModal(false)
      setContract({
        contract_value: '',
        start_date: '',
        duration_months: '',
        current_provider: '',
        description: ''
      })
    } catch (error) {
      console.error('Error:', error)
      alert('Error al agregar el contrato')
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
              Hospital: {hospital.name}
            </p>
            <textarea
              className="w-full p-2 border rounded mb-4"
              rows={4}
              placeholder="Ingrese la razón..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowReasonModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleActive}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirmar
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
              Hospital: {hospital.name}
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor del contrato</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={contract.contract_value}
                  onChange={(e) => setContract({...contract, contract_value: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Fecha inicio</label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={contract.start_date}
                  onChange={(e) => setContract({...contract, start_date: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Plazo (meses)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={contract.duration_months}
                  onChange={(e) => setContract({...contract, duration_months: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor actual</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={contract.current_provider}
                  onChange={(e) => setContract({...contract, current_provider: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  className="w-full p-2 border rounded"
                  rows={3}
                  value={contract.description}
                  onChange={(e) => setContract({...contract, description: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowContractModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddContract}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Guardar Contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}