'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'

interface KAM {
  id: string
  name: string
  area_id: string
  active: boolean
  enable_level2: boolean
  max_travel_time: number
  priority: number
  department_id: string
  department_name?: string
  municipality_name?: string
}

interface Department {
  id: string
  name: string
  adjacent_to: string[]
}

export default function DiagnosticsPage() {
  const [kams, setKams] = useState<KAM[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [adjacencyMatrix, setAdjacencyMatrix] = useState<any>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Cargar KAMs
      const { data: kamsData } = await supabase
        .from('sellers')
        .select('*')
        .order('name')

      if (kamsData) {
        const processedKams = kamsData.map(kam => ({
          ...kam,
          department_id: kam.area_id.substring(0, 2)
        }))
        setKams(processedKams)
      }

      // Cargar departamentos
      const { data: deptsData } = await supabase
        .from('departments')
        .select('*')
        .order('name')

      if (deptsData) {
        setDepartments(deptsData)
      }

      // Cargar matriz de adyacencia
      const response = await fetch('/data/json/adjacency_matrix.json')
      const adjacency = await response.json()
      setAdjacencyMatrix(adjacency)

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const getDepartmentName = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId)
    return dept?.name || `Departamento ${deptId}`
  }

  const getAdjacentDepartments = (deptId: string) => {
    const adjacent = adjacencyMatrix[deptId]?.closeDepartments || {}
    return Object.keys(adjacent).map(id => ({
      id,
      name: adjacent[id].name
    }))
  }

  const canKamCompeteForDepartment = (kam: KAM, targetDeptId: string) => {
    const kamDept = kam.department_id
    
    // Mismo departamento
    if (kamDept === targetDeptId) return 'Mismo departamento'
    
    // Departamento adyacente
    const adjacentDepts = getAdjacentDepartments(kamDept)
    if (adjacentDepts.some(d => d.id === targetDeptId)) return 'Departamento adyacente (Nivel 1)'
    
    // Nivel 2 (si está habilitado)
    if (kam.enable_level2) {
      for (const adj of adjacentDepts) {
        const level2Depts = getAdjacentDepartments(adj.id)
        if (level2Depts.some(d => d.id === targetDeptId)) {
          return 'Departamento adyacente (Nivel 2)'
        }
      }
    }
    
    return 'No puede competir'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <p>Cargando diagnóstico...</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Diagnóstico del Sistema</h1>
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            Volver al Dashboard
          </Link>
        </div>

        {/* Análisis de cobertura territorial */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">Análisis de Cobertura Territorial</h2>
          
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Ejemplo: ¿Por qué Santa Marta no recibe hospitales de Barranquilla?</h3>
            <div className="bg-blue-50 p-4 rounded">
              <p className="mb-2">
                <strong>Situación:</strong> Al desactivar Barranquilla (Atlántico), sus hospitales se reasignan a Cartagena (Bolívar), no a Santa Marta (Magdalena).
              </p>
              <p className="mb-2">
                <strong>Razón:</strong> No existe un KAM activo en el departamento de Magdalena (47) donde está Santa Marta.
              </p>
              <p>
                <strong>Solución:</strong> Crear un KAM en Santa Marta o en otro municipio de Magdalena para cubrir esa zona.
              </p>
            </div>
          </div>

          <h3 className="text-lg font-medium mb-3">KAMs por Departamento</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border text-left">Departamento</th>
                  <th className="px-4 py-2 border text-left">KAMs Activos</th>
                  <th className="px-4 py-2 border text-left">Departamentos Adyacentes</th>
                </tr>
              </thead>
              <tbody>
                {departments.map(dept => {
                  const deptKams = kams.filter(k => k.department_id === dept.id && k.active)
                  const adjacentDepts = getAdjacentDepartments(dept.id)
                  
                  return (
                    <tr key={dept.id} className={deptKams.length === 0 ? 'bg-red-50' : ''}>
                      <td className="px-4 py-2 border">
                        {dept.name} ({dept.id})
                      </td>
                      <td className="px-4 py-2 border">
                        {deptKams.length > 0 ? (
                          <ul>
                            {deptKams.map(kam => (
                              <li key={kam.id}>{kam.name}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-red-600 font-semibold">Sin cobertura</span>
                        )}
                      </td>
                      <td className="px-4 py-2 border text-sm">
                        {adjacentDepts.map(adj => adj.name).join(', ') || 'Ninguno'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matriz de competencia */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Matriz de Competencia entre KAMs</h2>
          <p className="text-sm text-gray-600 mb-4">
            Esta tabla muestra qué KAMs pueden competir por hospitales en cada departamento según las reglas de adyacencia.
          </p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 border text-left">KAM</th>
                  <th className="px-3 py-2 border text-left">Ubicación</th>
                  <th className="px-3 py-2 border text-center">Config</th>
                  {departments.slice(0, 10).map(dept => (
                    <th key={dept.id} className="px-2 py-2 border text-center" title={dept.name}>
                      {dept.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kams.filter(k => k.active).map(kam => (
                  <tr key={kam.id}>
                    <td className="px-3 py-2 border font-medium">{kam.name}</td>
                    <td className="px-3 py-2 border">{getDepartmentName(kam.department_id)}</td>
                    <td className="px-3 py-2 border text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        kam.enable_level2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {kam.enable_level2 ? 'L2' : 'L1'}
                      </span>
                    </td>
                    {departments.slice(0, 10).map(dept => {
                      const status = canKamCompeteForDepartment(kam, dept.id)
                      return (
                        <td key={dept.id} className={`px-2 py-2 border text-center ${
                          status.includes('Mismo') ? 'bg-green-100' :
                          status.includes('Nivel 1') ? 'bg-blue-100' :
                          status.includes('Nivel 2') ? 'bg-yellow-100' :
                          'bg-gray-50'
                        }`} title={status}>
                          {status.includes('Mismo') ? '●' :
                           status.includes('Nivel 1') ? '◐' :
                           status.includes('Nivel 2') ? '○' :
                           '✗'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Leyenda:</strong></p>
            <ul className="mt-2 space-y-1">
              <li>● = Mismo departamento (prioridad máxima)</li>
              <li>◐ = Departamento adyacente Nivel 1</li>
              <li>○ = Departamento adyacente Nivel 2 (requiere enable_level2)</li>
              <li>✗ = No puede competir</li>
            </ul>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}