'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Territory {
  id: string
  name: string
  type: 'municipality' | 'locality'
  hospitalCount: number
  totalBeds: number
  forcedKamId?: string
  forcedKamName?: string
  forcedReason?: string
}

interface KAM {
  id: string
  name: string
  color: string
  active: boolean
}

export default function ForcedAssignmentsPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [kams, setKams] = useState<KAM[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [selectedKam, setSelectedKam] = useState<string>('')
  const [reason, setReason] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'municipality' | 'locality'>('all')
  const [showOnlyForced, setShowOnlyForced] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Cargar KAMs activos
    const { data: kamsData } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (kamsData) {
      setKams(kamsData)
    }

    // Cargar territorios con estadísticas
    const { data: statsData } = await supabase
      .from('territory_statistics')
      .select('*')
      .order('territory_name')
    
    if (statsData) {
      const formattedTerritories = statsData.map(stat => ({
        id: stat.territory_id,
        name: stat.territory_name,
        type: stat.territory_type as 'municipality' | 'locality',
        hospitalCount: stat.hospital_count || 0,
        totalBeds: stat.total_beds || 0,
        forcedKamId: stat.forced_kam_id,
        forcedKamName: stat.forced_kam_name,
        forcedReason: stat.forced_reason
      }))
      setTerritories(formattedTerritories)
    }
    
    setLoading(false)
  }

  const handleAssignForced = async () => {
    if (!selectedTerritory || !selectedKam) {
      alert('Por favor selecciona un territorio y un KAM')
      return
    }

    setLoading(true)
    
    try {
      // Si ya existe una asignación forzada, desactivarla primero
      if (selectedTerritory.forcedKamId) {
        await supabase
          .from('forced_assignments')
          .update({ active: false })
          .eq('territory_id', selectedTerritory.id)
          .eq('active', true)
      }

      // Crear nueva asignación forzada
      const { error } = await supabase
        .from('forced_assignments')
        .insert({
          territory_id: selectedTerritory.id,
          territory_type: selectedTerritory.type,
          territory_name: selectedTerritory.name,
          kam_id: selectedKam,
          reason: reason || null,
          active: true
        })

      if (error) throw error

      // Ejecutar recálculo de asignaciones
      const response = await fetch('/api/recalculate-assignments', {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`Territorio ${selectedTerritory.name} asignado forzosamente. ${result.message}`)
        await loadData()
        setSelectedTerritory(null)
        setSelectedKam('')
        setReason('')
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveForced = async (territoryId: string, territoryName: string) => {
    if (!confirm(`¿Eliminar asignación forzada de ${territoryName}?`)) {
      return
    }

    setLoading(true)
    
    try {
      // Desactivar asignación forzada
      const { error } = await supabase
        .from('forced_assignments')
        .update({ active: false })
        .eq('territory_id', territoryId)
        .eq('active', true)

      if (error) throw error

      // Ejecutar recálculo
      const response = await fetch('/api/recalculate-assignments', {
        method: 'POST'
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`Asignación forzada eliminada. ${result.message}`)
        await loadData()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const filteredTerritories = territories.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.id.includes(searchTerm)
    const matchesType = filterType === 'all' || t.type === filterType
    const matchesForced = !showOnlyForced || t.forcedKamId
    
    return matchesSearch && matchesType && matchesForced
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
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Volver al mapa
        </Link>
        <h1 className="text-3xl font-bold">Asignaciones Forzadas de Territorios</h1>
        <p className="text-gray-600 mt-2">
          Asigna municipios o localidades específicas a KAMs, sobrescribiendo la lógica del algoritmo
        </p>
      </div>

      {/* Panel de asignación */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Nueva Asignación Forzada</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Territorio</label>
            <select
              value={selectedTerritory?.id || ''}
              onChange={(e) => {
                const territory = territories.find(t => t.id === e.target.value)
                setSelectedTerritory(territory || null)
              }}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Seleccionar territorio...</option>
              {territories
                .filter(t => !t.forcedKamId)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type === 'locality' ? 'Localidad' : 'Municipio'}) - {t.hospitalCount} IPS, {t.totalBeds} camas
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Asignar a KAM</label>
            <select
              value={selectedKam}
              onChange={(e) => setSelectedKam(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || !selectedTerritory}
            >
              <option value="">Seleccionar KAM...</option>
              {kams.map(kam => (
                <option key={kam.id} value={kam.id}>
                  {kam.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Razón (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Solicitud comercial"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || !selectedTerritory}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAssignForced}
              disabled={loading || !selectedTerritory || !selectedKam}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Procesando...' : 'Asignar Forzosamente'}
            </button>
          </div>
        </div>

        {selectedTerritory && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm">
              <strong>{selectedTerritory.name}</strong> tiene {selectedTerritory.hospitalCount} hospitales con un total de {selectedTerritory.totalBeds} camas
            </p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <option value="municipality">Solo Municipios</option>
              <option value="locality">Solo Localidades</option>
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

      {/* Tabla de territorios */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Territorio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hospitales
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Camas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                KAM Asignado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Razón
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTerritories.map(territory => {
              const kam = kams.find(k => k.id === territory.forcedKamId)
              return (
                <tr key={territory.id} className={territory.forcedKamId ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{territory.name}</div>
                    <div className="text-xs text-gray-500">{territory.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      territory.type === 'locality' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {territory.type === 'locality' ? 'Localidad' : 'Municipio'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {territory.hospitalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                    {territory.totalBeds}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {territory.forcedKamId ? (
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-2" 
                          style={{ backgroundColor: kam?.color || '#888' }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {territory.forcedKamName}
                        </span>
                        <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                          FORZADO
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Asignación normal</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {territory.forcedReason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {territory.forcedKamId ? (
                      <button
                        onClick={() => handleRemoveForced(territory.id, territory.name)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        Eliminar forzado
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {filteredTerritories.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No se encontraron territorios con los filtros aplicados
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900">{territories.length}</div>
          <div className="text-sm text-gray-600">Total Territorios</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {territories.filter(t => t.forcedKamId).length}
          </div>
          <div className="text-sm text-gray-600">Asignaciones Forzadas</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">
            {territories.reduce((sum, t) => sum + t.hospitalCount, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Hospitales</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {territories.reduce((sum, t) => sum + t.totalBeds, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Camas</div>
        </div>
      </div>
    </div>
  )
}