'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import ZoneModal from '@/components/ZoneModal'
import { Zone } from '@/lib/types/zones'

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    loadZones()
  }, [])

  const loadZones = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/zones')
      if (response.ok) {
        const data = await response.json()
        setZones(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading zones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateZone = () => {
    setEditingZone(null)
    setShowModal(true)
  }

  const handleEditZone = (zone: Zone) => {
    setEditingZone(zone)
    setShowModal(true)
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta zona?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('zones')
        .delete()
        .eq('id', zoneId)

      if (error) throw error

      await loadZones()
    } catch (error) {
      console.error('Error deleting zone:', error)
      alert('Error al eliminar la zona')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingZone(null)
  }

  const handleModalSuccess = () => {
    setShowModal(false)
    setEditingZone(null)
    loadZones()
    queryClient.invalidateQueries({ queryKey: ['zones'] })
  }

  const filteredZones = zones.filter(zone =>
    zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    zone.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (zone.coordinator_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const formatColor = (color: string | undefined) => {
    return color || '#808080'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Cargando zonas...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard
        permission="zones:view"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                  <strong className="font-semibold">Acceso denegado</strong>
                  <p className="text-sm mt-1">No tienes permisos para ver las zonas.</p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white">Zonas Comerciales</h1>
                <p className="text-gray-300 mt-2">Gestión de zonas y coordinadores regionales</p>
              </div>
              <button
                onClick={handleCreateZone}
                className="px-6 py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Agregar Zona
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Zonas</p>
              <p className="text-2xl font-bold text-gray-900">{zones.length}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Zonas Activas</p>
              <p className="text-2xl font-bold text-gray-900">
                {zones.filter(z => z.active).length}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Con Coordinador</p>
              <p className="text-2xl font-bold text-gray-900">
                {zones.filter(z => z.coordinator_name && z.coordinator_name !== 'Por Asignar').length}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, código o coordinador..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Zona</span>
                  </th>
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Código</span>
                  </th>
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Coordinador</span>
                  </th>
                  <th className="px-6 py-5 text-left">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Contacto</span>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</span>
                  </th>
                  <th className="px-6 py-5 text-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredZones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-gray-50 transition-all duration-150">
                    <td className="px-6 py-5">
                      <div className="flex items-center">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                          style={{ backgroundColor: formatColor(zone.color) }}
                        >
                          {zone.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">
                            {zone.name}
                          </div>
                          {zone.description && (
                            <div className="text-xs text-gray-500 max-w-xs truncate">
                              {zone.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-gray-700">
                        {zone.code}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-medium text-gray-900">
                        {zone.coordinator_name || 'Por Asignar'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        {zone.coordinator_email && (
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                            </svg>
                            {zone.coordinator_email}
                          </div>
                        )}
                        {zone.coordinator_phone && (
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                            </svg>
                            {zone.coordinator_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${
                        zone.active
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200'
                          : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${zone.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {zone.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditZone(zone)}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all group"
                          title="Editar zona"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all group"
                          title="Eliminar zona"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredZones.length === 0 && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path>
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron zonas</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega la primera zona para comenzar'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <ZoneModal
            zone={editingZone}
            isOpen={showModal}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        )}
      </PermissionGuard>
    </ProtectedRoute>
  )
}