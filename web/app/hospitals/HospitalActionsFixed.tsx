'use client'

import { useState } from 'react'
import ContractsList from '@/components/ContractsList'

interface HospitalActionsProps {
  hospital: any
  onUpdate: () => void
}

export default function HospitalActionsFixed({ hospital, onUpdate }: HospitalActionsProps) {
  const [showContractsList, setShowContractsList] = useState(false)
  
  return (
    <>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
        >
          Editar
        </button>
        
        <button
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

      {showContractsList && (
        <ContractsList 
          hospitalId={hospital.id} 
          onClose={() => setShowContractsList(false)}
        />
      )}
    </>
  )
}