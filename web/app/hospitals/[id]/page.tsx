'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import ContractsInlineManager from '@/components/ContractsInlineManager'
import { useQueryClient } from '@tanstack/react-query'

export default function HospitalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hospitalId = params.id as string
  
  const [hospital, setHospital] = useState<any>(null)
  const [kam, setKam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [activateReason, setActivateReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [contractStats, setContractStats] = useState({ activeCount: 0, totalValue: 0 })
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [municipalityName, setMunicipalityName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [kamMunicipalityName, setKamMunicipalityName] = useState('')
  const [editingDoctors, setEditingDoctors] = useState(false)
  const [doctors, setDoctors] = useState('')

  useEffect(() => {
    loadHospitalData()
  }, [hospitalId])

  const loadHospitalData = async () => {
    try {
      // Cargar datos del hospital desde el API
      const response = await fetch(`/api/hospitals/${hospitalId}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar datos del hospital')
      }
      
      const data = await response.json()
      
      if (data.hospital) {
        setHospital(data.hospital)
        setDoctors(data.hospital.doctors || '')
        setMunicipalityName(data.municipalityName || '')
        setDepartmentName(data.departmentName || '')
        setKam(data.kam)
        setKamMunicipalityName(data.kamMunicipalityName || '')
        setContractStats(data.contractStats)
        
        // Cargar historial si existe
        if (data.history) {
          setHistory(data.history)
        }
      }
    } catch (error) {
      console.error('Error loading hospital:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleHospitalStatus = async () => {
    if (hospital.active && !deactivateReason.trim()) {
      alert('Por favor ingrese el motivo de desactivación')
      return
    }

    setIsSubmitting(true)
    try {
      console.log('Toggling hospital:', hospitalId, 'from', hospital.active, 'to', !hospital.active)

      // Usar el API endpoint apropiado
      const endpoint = hospital.active 
        ? `/api/hospitals/${hospitalId}/deactivate`
        : `/api/hospitals/${hospitalId}/activate`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: hospital.active ? deactivateReason : activateReason
        })
      })

      console.log('API Response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al cambiar el estado del hospital')
      }

      const result = await response.json()
      console.log('Toggle result:', result)

      // El historial ya se registra en el API endpoint

      // Recalcular asignaciones para actualizar territorios
      setIsRecalculating(true)
      console.log('Recalculando asignaciones después de cambiar estado del hospital...')
      const recalcResponse = await fetch('/api/recalculate-smart-hospital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hospitalId: hospitalId,
          action: hospital.active ? 'deactivated' : 'activated'
        })
      })

      if (!recalcResponse.ok) {
        console.error('Error al recalcular asignaciones')
        throw new Error('Error al recalcular asignaciones territoriales')
      }

      const recalcResult = await recalcResponse.json()
      console.log('Recálculo completado:', recalcResult)

      // Invalidar caché del mapa para que se actualice
      await queryClient.invalidateQueries({ queryKey: ['map-data'] })

      // Recargar datos
      await loadHospitalData()
      setShowDeactivateModal(false)
      setShowActivateModal(false)
      setDeactivateReason('')
      setActivateReason('')
      setIsRecalculating(false)
      
      alert(`Hospital ${hospital.active ? 'desactivado' : 'activado'} exitosamente. Las asignaciones territoriales han sido actualizadas.`)
    } catch (error: any) {
      console.error('Error toggling hospital status:', error)
      alert(`Error al cambiar el estado del hospital: ${error.message || 'Error desconocido'}`)
      setIsRecalculating(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <p>Cargando...</p>
        </div>
      </ProtectedRoute>
    )
  }

  if (!hospital) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <p>Hospital no encontrado</p>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <button
              onClick={() => router.push('/hospitals')}
              className="text-gray-700 hover:text-gray-900 mb-4 flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Volver a hospitales
            </button>
            <h1 className="text-4xl font-bold text-gray-900">{hospital.name}</h1>
            <p className="text-gray-600 mt-2">Código NIT: {hospital.code}</p>
          </div>
          <div className="flex gap-3">
            <PermissionGuard permission="hospitals:edit">
              <button
                onClick={() => {
                  console.log('Botón clickeado, hospital.active:', hospital.active)
                  if (hospital.active) {
                    console.log('Mostrando modal de desactivación')
                    setShowDeactivateModal(true)
                  } else {
                    console.log('Mostrando modal de activación')
                    setShowActivateModal(true)
                  }
                }}
                className={`group relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md flex items-center gap-2 ${
                  hospital.active 
                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700' 
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                }`}
              >
                {hospital.active ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Desactivar
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Activar
                  </>
                )}
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Información general */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Información General</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">Municipio:</span>
                <span className="ml-2 font-medium">{municipalityName || hospital.municipality_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Departamento:</span>
                <span className="ml-2 font-medium">{departmentName || hospital.department_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Número de camas:</span>
                <span className="ml-2 font-medium">{hospital.beds || 'No especificado'}</span>
              </div>
              <div>
                <span className="text-gray-600">Nivel de servicio:</span>
                <span className="ml-2 font-medium">{hospital.service_level || 'No especificado'}</span>
              </div>
              <div>
                <span className="text-gray-600">Estado:</span>
                <span className={`ml-2 font-medium ${hospital.active ? 'text-gray-900' : 'text-gray-500'}`}>
                  {hospital.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">
                  {hospital.type ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      hospital.type === 'Publico' ? 'bg-gray-200 text-gray-800' :
                      hospital.type === 'Privada' ? 'bg-gray-800 text-white' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {hospital.type}
                    </span>
                  ) : (
                    'No especificado'
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">KAM Asignado</h2>
            {kam ? (
              <div className="space-y-3">
                <div>
                  <span className="text-gray-600">Nombre:</span>
                  <span className="ml-2 font-medium">{kam.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Municipio base:</span>
                  <span className="ml-2 font-medium">{kamMunicipalityName || kam.area_id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Teléfono:</span>
                  <span className="ml-2 font-medium">{kam.phone || 'No especificado'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-medium">{kam.email || 'No especificado'}</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No hay KAM asignado</p>
            )}
          </div>
        </div>

        {/* Doctores */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Doctores</h2>
            <PermissionGuard permission="hospitals:edit">
              {!editingDoctors && (
                <button
                  onClick={() => setEditingDoctors(true)}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-all"
                >
                  Editar
                </button>
              )}
            </PermissionGuard>
          </div>
          {editingDoctors ? (
            <div>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                rows={6}
                value={doctors}
                onChange={(e) => setDoctors(e.target.value)}
                placeholder="Ingrese los nombres de los doctores, uno por línea..."
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/hospitals/${hospitalId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ doctors })
                      })
                      
                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || 'Error al actualizar')
                      }
                      
                      setHospital({ ...hospital, doctors })
                      setEditingDoctors(false)
                      alert('Doctores actualizados exitosamente')
                    } catch (error: any) {
                      console.error('Error updating doctors:', error)
                      alert('Error al actualizar doctores: ' + error.message)
                    }
                  }}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setDoctors(hospital.doctors || '')
                    setEditingDoctors(false)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-700 whitespace-pre-wrap">
              {doctors || <span className="text-gray-400 italic">No hay doctores registrados</span>}
            </div>
          )}
        </div>

        {/* Contratos y Oportunidades */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Contratos y Oportunidades</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-900">{contractStats.activeCount}</p>
              <p className="text-gray-600 mt-2">Contratos activos</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-900">
                ${contractStats.totalValue.toLocaleString('es-CO')}
              </p>
              <p className="text-gray-600 mt-2">Valor total contratos</p>
            </div>
          </div>
          <PermissionGuard permission="contracts:edit" fallback={
            <div className="text-center py-8 text-gray-500">
              No tienes permisos para gestionar contratos
            </div>
          }>
            <ContractsInlineManager
              hospitalId={hospitalId}
              onUpdate={() => {
                loadHospitalData() // Recargar datos para actualizar estadísticas
              }}
            />
          </PermissionGuard>
        </div>


        {/* Historial de cambios */}
        {history && history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Historial de Cambios</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((entry: any, index: number) => (
                <div key={index} className="border-l-4 border-gray-200 pl-4 py-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.action === 'activated' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Activado
                          </span>
                        ) : entry.action === 'deactivated' ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            Desactivado
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            {entry.action}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        <strong>Razón:</strong> {entry.reason}
                      </p>
                      <p className="text-xs text-gray-500">
                        Por: {entry.users?.full_name || entry.users?.email || 'Usuario desconocido'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de confirmación para desactivar */}
        {showDeactivateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-slideUp">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Desactivar Hospital</h3>
                    <p className="text-white/80 text-sm">Esta acción afectará las asignaciones</p>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-gray-700">
                    Está a punto de desactivar el hospital:
                  </p>
                  <p className="font-semibold text-gray-900 mt-1">{hospital.name}</p>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de desactivación <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
                  rows={4}
                  placeholder="Ej: Cierre temporal por remodelación, cambio de administración..."
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  disabled={isSubmitting}
                />
                
                {!deactivateReason.trim() && (
                  <p className="text-xs text-gray-500 mt-2">
                    El motivo es obligatorio para el registro de auditoría
                  </p>
                )}
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeactivateModal(false)
                    setDeactivateReason('')
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={toggleHospitalStatus}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isSubmitting || !deactivateReason.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Desactivando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Confirmar Desactivación
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de activación */}
        {showActivateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="bg-white bg-opacity-20 p-3 rounded-full">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Activar Hospital</h3>
                    <p className="text-white/80 text-sm">Esta acción afectará las asignaciones</p>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-gray-700">
                    Está a punto de activar el hospital:
                  </p>
                  <p className="font-semibold text-gray-900 mt-1">{hospital.name}</p>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo de activación <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                  rows={4}
                  placeholder="Ej: Reapertura tras remodelación, nuevo convenio activo..."
                  value={activateReason}
                  onChange={(e) => setActivateReason(e.target.value)}
                  disabled={isSubmitting}
                />
                
                {!activateReason.trim() && (
                  <p className="text-xs text-gray-500 mt-2">
                    El motivo es obligatorio para el registro de auditoría
                  </p>
                )}
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowActivateModal(false)
                    setActivateReason('')
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={toggleHospitalStatus}
                  disabled={!activateReason.trim() || isSubmitting}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 
                    ${!activateReason.trim() 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transform hover:scale-[1.02] hover:shadow-md'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Confirmar Activación
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de recálculo de territorios */}
        {isRecalculating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Actualizando Territorios</h3>
              <p className="text-gray-600">
                Recalculando asignaciones territoriales...
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </ProtectedRoute>
  )
}