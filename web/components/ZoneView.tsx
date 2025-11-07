'use client'

import { useState, useEffect } from 'react'
import { Zone, ZoneStatistics } from '@/lib/types/zones'

interface ZoneViewProps {
  searchTerm: string
  onZoneClick?: (zoneId: string) => void
}

export default function ZoneView({ searchTerm, onZoneClick }: ZoneViewProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [zoneStatistics, setZoneStatistics] = useState<ZoneStatistics[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadZones()
  }, [])

  const loadZones = async () => {
    setLoading(true)
    try {
      // Cargar zonas
      const zonesResponse = await fetch('/api/zones')
      const zonesData = await zonesResponse.json()
      setZones(zonesData)

      // Cargar estadísticas de zonas
      const statsResponse = await fetch('/api/zones/statistics')
      const statsData = await statsResponse.json()
      setZoneStatistics(statsData)
    } catch (error) {
      console.error('Error loading zones:', error)
    } finally {
      setLoading(false)
    }
  }

  const getZoneStats = (zoneId: string) => {
    return zoneStatistics.find(stat => stat.zone_id === zoneId)
  }

  const filteredZones = zones.filter(zone =>
    zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    zone.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (zone.coordinator_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando zonas...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Tabla responsive con vista de tarjetas en móvil */}
      <div className="hidden lg:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <th className="px-6 py-5 text-left">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Zona</span>
              </th>
              <th className="px-6 py-5 text-left">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Coordinador</span>
              </th>
              <th className="px-6 py-5 text-center">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">KAMs</span>
              </th>
              <th className="px-6 py-5 text-center">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Hospitales</span>
              </th>
              <th className="px-6 py-5 text-center">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Municipios</span>
              </th>
              <th className="px-6 py-5 text-right">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Valor Contratos</span>
              </th>
              <th className="px-6 py-5 text-center">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredZones.map((zone, index) => {
              const stats = getZoneStats(zone.id)
              return (
                <tr
                  key={zone.id}
                  className="hover:bg-gray-50 transition-all duration-150"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                          style={{ backgroundColor: zone.color || '#6B7280' }}
                        >
                          {zone.code.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">
                          {zone.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {zone.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {zone.coordinator_name || 'Por Asignar'}
                      </div>
                      {zone.coordinator_email && (
                        <div className="text-xs text-gray-500">
                          {zone.coordinator_email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-gray-900">
                        {stats?.total_kams || 0}
                      </span>
                      <span className="text-xs text-gray-500">KAMs</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-gray-900">
                        {stats?.total_hospitals || 0}
                      </span>
                      <span className="text-xs text-gray-500">hospitales</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-gray-900">
                        {stats?.total_municipalities || 0}
                      </span>
                      <span className="text-xs text-gray-500">municipios</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(stats?.total_contract_value || 0)}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onZoneClick?.(zone.id)}
                        className="px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Ver en Mapa
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Vista de tarjetas para móvil */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredZones.map((zone) => {
          const stats = getZoneStats(zone.id)
          return (
            <div
              key={zone.id}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                    style={{ backgroundColor: zone.color || '#6B7280' }}
                  >
                    {zone.code.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {zone.name}
                    </h3>
                    <p className="text-sm text-gray-500">{zone.code}</p>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-sm text-gray-600">Coordinador:</p>
                <p className="text-sm font-medium text-gray-900">
                  {zone.coordinator_name || 'Por Asignar'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.total_kams || 0}
                  </p>
                  <p className="text-xs text-gray-500">KAMs</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.total_hospitals || 0}
                  </p>
                  <p className="text-xs text-gray-500">Hospitales</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">
                    {stats?.total_municipalities || 0}
                  </p>
                  <p className="text-xs text-gray-500">Municipios</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-600">Valor contratos:</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(stats?.total_contract_value || 0)}
                </p>
              </div>

              <button
                onClick={() => onZoneClick?.(zone.id)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                Ver en Mapa
              </button>
            </div>
          )
        })}
      </div>

      {filteredZones.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron zonas</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No hay zonas configuradas'}
          </p>
        </div>
      )}
    </>
  )
}