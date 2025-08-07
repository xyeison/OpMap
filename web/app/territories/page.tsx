'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ForcedAssignmentModal from '@/components/ForcedAssignmentModal'
import PermissionGuard from '@/components/PermissionGuard'
import { useAuth } from '@/contexts/AuthContext'

interface Territory {
  id: string
  name: string
  type: 'municipality' | 'locality'
  departmentName?: string
  hospitalCount: number
  totalBeds: number
  highLevelHospitals: number
  activeHospitals: number
  assignedKamName?: string
  assignedKamColor?: string
  isForced: boolean
  forcedReason?: string
  population?: number
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'municipality' | 'locality'>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])
  const [showOnlyForced, setShowOnlyForced] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'beds' | 'hospitals'>('name')
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    try {
      // Cargar territorios con estadísticas
      const { data: statsData } = await supabase
        .from('territory_statistics')
        .select('*')
      
      // Cargar asignaciones actuales para obtener KAM asignado
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select(`
          hospital_id,
          kam_id,
          kams!inner(id, name, color),
          hospitals!inner(
            municipality_id,
            locality_id,
            department_name
          )
        `)
      
      // Cargar datos de población de municipios
      const { data: municipalitiesData } = await supabase
        .from('municipalities')
        .select('code, name, population_2025')
      
      // Procesar datos
      if (statsData) {
        const territoryMap = new Map<string, Territory>()
        const departmentSet = new Set<string>()
        
        // Crear mapa de población
        const populationMap = new Map<string, number>()
        municipalitiesData?.forEach(m => {
          populationMap.set(m.code, m.population_2025)
        })
        
        // Procesar estadísticas
        statsData.forEach(stat => {
          const territory: Territory = {
            id: stat.territory_id,
            name: stat.territory_name,
            type: stat.territory_type as 'municipality' | 'locality',
            hospitalCount: stat.hospital_count || 0,
            totalBeds: stat.total_beds || 0,
            highLevelHospitals: stat.high_level_hospitals || 0,
            activeHospitals: stat.active_hospitals || 0,
            isForced: stat.is_forced || false,
            forcedReason: stat.forced_reason,
            population: populationMap.get(stat.territory_id) || 0
          }
          
          // Si es asignación forzada, usar esos datos
          if (stat.is_forced) {
            territory.assignedKamName = stat.forced_kam_name
            territory.assignedKamColor = stat.forced_kam_color
          }
          
          territoryMap.set(stat.territory_id, territory)
        })
        
        // Agregar información de KAM asignado (no forzado)
        if (assignmentsData) {
          assignmentsData.forEach((assignment: any) => {
            const territoryId = assignment.hospitals.locality_id || assignment.hospitals.municipality_id
            const territory = territoryMap.get(territoryId)
            
            if (territory && !territory.isForced && !territory.assignedKamName) {
              territory.assignedKamName = assignment.kams.name
              territory.assignedKamColor = assignment.kams.color
              territory.departmentName = assignment.hospitals.department_name
              
              if (assignment.hospitals.department_name) {
                departmentSet.add(assignment.hospitals.department_name)
              }
            }
          })
        }
        
        setTerritories(Array.from(territoryMap.values()))
        setDepartments(Array.from(departmentSet).sort())
      }
    } catch (error) {
      console.error('Error loading territories:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTerritories = territories
    .filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.id.includes(searchTerm)
      const matchesType = filterType === 'all' || t.type === filterType
      const matchesDepartment = filterDepartment === 'all' || t.departmentName === filterDepartment
      const matchesForced = !showOnlyForced || t.isForced
      
      return matchesSearch && matchesType && matchesDepartment && matchesForced
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'beds':
          return b.totalBeds - a.totalBeds
        case 'hospitals':
          return b.hospitalCount - a.hospitalCount
        default:
          return a.name.localeCompare(b.name)
      }
    })

  if (loading && territories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando territorios...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/" className="text-blue-600 hover:text-blue-800">
            ← Volver
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Municipios</h1>
        <p className="text-gray-600 mt-2">
          Gestión de municipios y localidades con sus hospitales y asignaciones
        </p>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900">{territories.length}</div>
          <div className="text-sm text-gray-600">Territorios Totales</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">
            {territories.filter(t => t.type === 'municipality').length}
          </div>
          <div className="text-sm text-gray-600">Municipios</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">
            {territories.filter(t => t.type === 'locality').length}
          </div>
          <div className="text-sm text-gray-600">Localidades</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {territories.reduce((sum, t) => sum + t.hospitalCount, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Hospitales</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {territories.reduce((sum, t) => sum + t.totalBeds, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Camas</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre o código..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="municipality">Municipios</option>
              <option value="locality">Localidades</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Departamento</label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Nombre</option>
              <option value="beds">Número de Camas</option>
              <option value="hospitals">Número de Hospitales</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyForced}
                onChange={(e) => setShowOnlyForced(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Solo asignaciones forzadas</span>
            </label>
          </div>
        </div>
      </div>

      {/* Grid de territorios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTerritories.map(territory => (
          <div
            key={territory.id}
            onClick={() => router.push(`/territories/${territory.id}`)}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 overflow-hidden"
          >
            {/* Header con tipo y estado */}
            <div className={`px-4 py-2 ${territory.type === 'locality' ? 'bg-purple-50' : 'bg-blue-50'} border-b`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-1 rounded ${
                  territory.type === 'locality' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {territory.type === 'locality' ? 'LOCALIDAD' : 'MUNICIPIO'}
                </span>
                {territory.isForced && (
                  <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-800 rounded">
                    FORZADO
                  </span>
                )}
              </div>
            </div>

            {/* Contenido principal */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1">{territory.name}</h3>
              <p className="text-xs text-gray-500 mb-3">{territory.id}</p>

              {/* Estadísticas */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Hospitales:</span>
                  <span className="font-semibold">{territory.hospitalCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Camas:</span>
                  <span className="font-semibold">{territory.totalBeds}</span>
                </div>
                {territory.highLevelHospitals > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nivel Alto:</span>
                    <span className="font-semibold">{territory.highLevelHospitals}</span>
                  </div>
                )}
                {territory.population && territory.population > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Población:</span>
                    <span className="font-semibold">{territory.population.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* KAM asignado */}
              {territory.assignedKamName && (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: territory.assignedKamColor || '#888' }}
                    />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600">KAM Asignado</p>
                      <p className="text-sm font-semibold text-gray-900">{territory.assignedKamName}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="px-4 py-2 bg-gray-50 border-t flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/territories/${territory.id}`)
                }}
                className="flex-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver detalles
              </button>
              <PermissionGuard permission="territories:manage">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedTerritory({
                      ...territory,
                      currentKam: territory.assignedKamName
                    } as any)
                    setShowAssignmentModal(true)
                  }}
                  className="flex-1 text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-1"
                  title="Asignación forzada"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Asignar
                </button>
              </PermissionGuard>
            </div>
          </div>
        ))}
      </div>

      {filteredTerritories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No se encontraron territorios con los filtros aplicados</p>
        </div>
      )}

      {/* Modal de asignación forzada */}
      <ForcedAssignmentModal
        territory={selectedTerritory}
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false)
          setSelectedTerritory(null)
        }}
        onSuccess={() => {
          loadData()
          setShowAssignmentModal(false)
          setSelectedTerritory(null)
        }}
      />
    </div>
  )
}