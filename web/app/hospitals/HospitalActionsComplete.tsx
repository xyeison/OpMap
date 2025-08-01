'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/contexts/UserContext'
import ContractsList from '@/components/ContractsList'

interface HospitalActionsProps {
  hospital: any
  onUpdate: () => void
}

export default function HospitalActionsComplete({ hospital, onUpdate }: HospitalActionsProps) {
  const { user } = useUser()
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showContractsList, setShowContractsList] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  
  // Debug: verificar si el componente se está renderizando
  console.log('HospitalActionsComplete renderizando para:', hospital.name, 'Usuario:', user?.email)
  
  const [editData, setEditData] = useState({
    name: hospital.name,
    beds: hospital.beds || 0,
    service_level: hospital.service_level || '',
    active: hospital.active
  })
  

  const handleToggleActive = async () => {
    if (!reason.trim()) {
      alert('Por favor ingrese una razón')
      return
    }

    if (!user) {
      alert('Debe iniciar sesión')
      return
    }

    setLoading(true)
    try {
      // 1. Registrar en historial
      const { error: historyError } = await supabase.from('hospital_history').insert({
        hospital_id: hospital.id,
        user_id: user.id, // Usando el ID del usuario logueado
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

  const handleEdit = async () => {
    if (!user) {
      alert('Debe iniciar sesión')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('hospitals')
        .update({
          name: editData.name,
          beds: parseInt(editData.beds.toString()) || 0,
          service_level: editData.service_level,
          active: editData.active
        })
        .eq('id', hospital.id)

      if (error) throw error

      alert('Hospital actualizado exitosamente')
      setShowEditModal(false)
      onUpdate()
      
    } catch (error: any) {
      console.error('Error:', error)
      alert(`Error: ${error.message || 'No se pudo actualizar el hospital'}`)
    } finally {
      setLoading(false)
    }
  }


  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowEditModal(true)}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
        >
          Editar
        </button>
        
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
          onClick={() => setShowContractsList(true)}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
        >
          Contratos
        </button>
      </div>

      {/* Modal para editar hospital */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">Editar Hospital</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={editData.name}
                  onChange={(e) => setEditData({...editData, name: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Número de camas</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={editData.beds}
                  onChange={(e) => setEditData({...editData, beds: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Nivel de servicio</label>
                <select
                  className="w-full p-2 border rounded"
                  value={editData.service_level}
                  onChange={(e) => setEditData({...editData, service_level: e.target.value})}
                  disabled={loading}
                >
                  <option value="">Seleccionar...</option>
                  <option value="1">Nivel 1</option>
                  <option value="2">Nivel 2</option>
                  <option value="3">Nivel 3</option>
                  <option value="4">Nivel 4</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData.active}
                    onChange={(e) => setEditData({...editData, active: e.target.checked})}
                    disabled={loading}
                  />
                  <span className="text-sm font-medium">Hospital activo</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Lista de contratos */}
      {showContractsList && (
        <ContractsList 
          hospitalId={hospital.id} 
          onClose={() => setShowContractsList(false)}
        />
      )}
    </>
  )
}