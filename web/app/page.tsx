'use client'

import Link from 'next/link'
import RecalculateUnified from '@/components/RecalculateUnified'
import TestGoogleAPI from '@/components/TestGoogleAPI'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'

export default function HomePage() {
  const { can } = usePermissions()
  
  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="dashboard:view" 
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
              <strong>Acceso limitado:</strong> No tienes permisos para ver el dashboard completo.
              <Link href="/map" className="ml-2 underline">Ir al mapa</Link>
            </div>
          </div>
        }
      >
        <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="flex gap-3">
          <PermissionGuard permission="users:manage">
            <Link href="/users" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              Gestionar Usuarios
            </Link>
          </PermissionGuard>
          <PermissionGuard permission="diagnostics:view">
            <a href="/diagnostics" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
              Diagnóstico del Sistema
            </a>
          </PermissionGuard>
        </div>
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

      {/* Sección de Administración del Sistema */}
      <PermissionGuard permissions={['recalculate:simple', 'recalculate:complete']}>
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Administración del Sistema</h2>
          <TestGoogleAPI />
          <RecalculateUnified />
        </div>
      </PermissionGuard>

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
      </PermissionGuard>
    </ProtectedRoute>
  )
}