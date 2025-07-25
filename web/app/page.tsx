'use client'

import RecalculateButton from '@/components/RecalculateButton'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function HomePage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <RecalculateButton />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Total KAMs</h3>
          <p className="text-3xl font-bold text-blue-600">16</p>
          <p className="text-green-600 text-sm">+2 este mes</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Total Hospitales</h3>
          <p className="text-3xl font-bold text-blue-600">768</p>
          <p className="text-gray-600 text-sm">728 asignados</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Oportunidades</h3>
          <p className="text-3xl font-bold text-green-600">$45.2M</p>
          <p className="text-gray-600 text-sm">Valor anual estimado</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-medium">Cobertura</h3>
          <p className="text-3xl font-bold text-purple-600">94.8%</p>
          <p className="text-gray-600 text-sm">IPS asignadas</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">KAMs con más hospitales</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Chapinero</span>
              <span className="font-bold">142</span>
            </div>
            <div className="flex justify-between items-center">
              <span>San Cristóbal</span>
              <span className="font-bold">125</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Neiva</span>
              <span className="font-bold">78</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">Mayores oportunidades</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Hospital San Juan de Dios</span>
                <span className="text-green-600 font-bold">$2.5M</span>
              </div>
              <span className="text-sm text-gray-600">Proveedor actual: Synthes</span>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Clínica Nueva</span>
                <span className="text-green-600 font-bold">$1.8M</span>
              </div>
              <span className="text-sm text-gray-600">Proveedor actual: Stryker</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ProtectedRoute>
  )
}