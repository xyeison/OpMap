'use client'

import Link from 'next/link'
import RecalculateUnified from '@/components/RecalculateUnified'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { usePermissions } from '@/hooks/usePermissions'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const { can } = usePermissions()
  const [stats, setStats] = useState({
    totalKams: 0,
    totalHospitals: 0,
    assignedHospitals: 0,
    coveragePercentage: 0,
    totalContractValue: 0,
    activeDepartments: 0
  })
  
  // Cargar estadísticas reales desde la API
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/stats')
      if (!response.ok) {
        throw new Error('Error al cargar estadísticas')
      }
      return response.json()
    },
    refetchInterval: 60000 // Actualizar cada minuto
  })
  
  useEffect(() => {
    if (dashboardData) {
      setStats({
        ...dashboardData
      })
    }
  }, [dashboardData])
  
  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="dashboard:view" 
        fallback={
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="max-w-md w-full p-8 border border-gray-200 rounded-none">
              <p className="text-gray-900 font-light">Acceso limitado</p>
              <Link href="/map" className="mt-4 inline-block text-black underline underline-offset-4 hover:no-underline">
                → Ir al mapa
              </Link>
            </div>
          </div>
        }
      >
        <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
          <div className="max-w-7xl mx-auto p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
              <div>
                <h1 className="text-5xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-2">Sistema de Asignación Territorial Optimizada</p>
              </div>
            </div>
      
            {/* Stats Grid */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                <p className="text-gray-600 mt-4">Cargando estadísticas...</p>
              </div>
            )}
            {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-7 transform hover:-translate-y-1 transition-all duration-300 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-800 to-black rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-3 py-1 rounded-full">
                    <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
                    </svg>
                    +14%
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Total KAMs</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalKams}</p>
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  <span className="w-2 h-2 bg-gray-600 rounded-full mr-1 animate-pulse"></span>
                  Activos en el sistema
                </p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-7 transform hover:-translate-y-1 transition-all duration-300 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-900">{stats.coveragePercentage}%</span>
                    <p className="text-xs text-gray-500">cobertura</p>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Hospitales</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalHospitals}</p>
                <div className="mt-3 bg-gray-100 rounded-lg p-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Asignados</span>
                    <span className="font-semibold text-gray-900">{stats.assignedHospitals}</span>
                  </div>
                  <div className="mt-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-900 h-full" style={{width: `${stats.coveragePercentage}%`}}></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-7 transform hover:-translate-y-1 transition-all duration-300 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                    <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"></path>
                    </svg>
                    +8.3%
                  </span>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Oportunidades</h3>
                <p className="text-3xl font-bold text-gray-900">${(stats.totalContractValue / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  <span className="text-gray-600 mr-1">●</span>
                  Valor anual proyectado
                </p>
              </div>
              
              <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-7 transform hover:-translate-y-1 transition-all duration-300 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                    </svg>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-gray-900">{stats.coveragePercentage}</span>
                      <span className="text-lg text-gray-500">%</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Cobertura Nacional</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.activeDepartments}</p>
                <p className="text-xs text-gray-500 mt-1">departamentos activos</p>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  <div className="h-1 bg-gray-800 rounded-full"></div>
                  <div className="h-1 bg-gray-800 rounded-full"></div>
                  <div className="h-1 bg-gray-400 rounded-full"></div>
                </div>
              </div>
            </div>
            )}

            {/* System Administration */}
            <PermissionGuard permissions={['recalculate:simple', 'recalculate:complete']}>
              <div className="border-t border-gray-200 pt-8">
                <h2 className="text-2xl font-light mb-6">Administración del Sistema</h2>
                
                {/* Botones de administración */}
                <div className="space-y-4">
                  <RecalculateUnified />
                </div>
              </div>
            </PermissionGuard>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}