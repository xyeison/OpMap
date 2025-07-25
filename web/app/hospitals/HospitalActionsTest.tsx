'use client'

export default function HospitalActionsTest({ hospital }: any) {
  return (
    <div className="flex gap-2">
      <button className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
        Editar
      </button>
      <button className="px-2 py-1 text-xs bg-green-500 text-white rounded">
        Contratos
      </button>
    </div>
  )
}