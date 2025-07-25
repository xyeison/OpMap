'use client'

export default function HospitalActionsSimple({ hospital, onUpdate }: any) {
  return (
    <div className="flex gap-2">
      <button
        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
        onClick={() => alert('Editar: ' + hospital.name)}
      >
        Editar
      </button>
      
      <button
        className={`px-3 py-1 text-sm rounded ${
          hospital.active 
            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
        onClick={() => alert('Activar/Desactivar: ' + hospital.name)}
      >
        {hospital.active ? 'Desactivar' : 'Activar'}
      </button>
      
      <button
        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
        onClick={() => alert('Agregar contrato: ' + hospital.name)}
      >
        + Contrato
      </button>
    </div>
  )
}