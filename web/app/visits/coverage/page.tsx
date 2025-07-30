'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

interface UnvisitedZone {
  municipality_id: string
  municipality_name: string
  department_name: string
  count: number
  hospitals: Array<{
    id: string
    name: string
    code: string
    kam_name?: string
    kam_color?: string
  }>
}

export default function CoveragePage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [selectedKam, setSelectedKam] = useState<string>('all')
  const [kams, setKams] = useState<any[]>([])

  const month = searchParams.get('month') || new Date().getMonth() + 1
  const year = searchParams.get('year') || new Date().getFullYear()

  useEffect(() => {
    loadKams()
    loadCoverageData()
  }, [month, year, selectedKam])

  const loadKams = async () => {
    try {
      const response = await fetch('/api/kams')
      if (response.ok) {
        const data = await response.json()
        setKams(data)
      }
    } catch (error) {
      console.error('Error loading KAMs:', error)
    }
  }

  const loadCoverageData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        month: month.toString(),
        year: year.toString()
      })
      
      if (selectedKam !== 'all') {
        params.append('kamId', selectedKam)
      }

      const response = await fetch(`/api/visits/unvisited-zones?${params}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error loading coverage data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatMonth = () => {
    const date = new Date(parseInt(year.toString()), parseInt(month.toString()) - 1)
    return date.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  }

  return (
    <ProtectedRoute>
      <PermissionGuard permission="visits:view">
        <div className="container mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Análisis de Cobertura - {formatMonth()}</h1>

          {/* Filtro de KAM */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por KAM
            </label>
            <select
              value={selectedKam}
              onChange={(e) => setSelectedKam(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos los KAMs</option>
              {kams.map(kam => (
                <option key={kam.id} value={kam.id}>
                  {kam.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center py-8">Cargando análisis...</div>
          ) : data && (
            <>
              {/* Estadísticas generales */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Total Hospitales</p>
                  <p className="text-2xl font-bold">{data.totalHospitals}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Hospitales Visitados</p>
                  <p className="text-2xl font-bold text-green-600">{data.visitedHospitals}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Hospitales NO Visitados</p>
                  <p className="text-2xl font-bold text-red-600">{data.unvisitedHospitals}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Cobertura</p>
                  <p className="text-2xl font-bold text-blue-600">{data.coveragePercentage}%</p>
                </div>
              </div>

              {/* Zonas no visitadas */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-xl font-semibold">Zonas con Hospitales No Visitados</h2>
                </div>
                <div className="p-6">
                  {data.unvisitedZones.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      ¡Excelente! Todos los hospitales han sido visitados en este período.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {data.unvisitedZones.slice(0, 10).map((zone: UnvisitedZone) => (
                        <div key={zone.municipality_id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">
                                {zone.municipality_name}
                              </h3>
                              <p className="text-sm text-gray-600">{zone.department_name}</p>
                            </div>
                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                              {zone.count} hospital{zone.count > 1 ? 'es' : ''} no visitado{zone.count > 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 mb-1">Hospitales:</p>
                            <ul className="text-sm text-gray-600 space-y-1">
                              {zone.hospitals.map(hospital => (
                                <li key={hospital.id} className="flex items-center gap-2">
                                  <span className="text-gray-400">•</span>
                                  <span>{hospital.name}</span>
                                  {hospital.kam_name && (
                                    <span 
                                      className="text-xs px-2 py-0.5 rounded"
                                      style={{ 
                                        backgroundColor: hospital.kam_color + '20',
                                        color: hospital.kam_color
                                      }}
                                    >
                                      {hospital.kam_name}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mensaje informativo */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Un hospital se considera "visitado" si existe al menos una visita 
                  registrada en un radio de 5km durante el período seleccionado.
                </p>
              </div>
            </>
          )}
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}