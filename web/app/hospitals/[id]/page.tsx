'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import ContractsInlineManager from '@/components/ContractsInlineManager'
import { useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/usePermissions'
import { useUser } from '@/contexts/UserContext'

export default function HospitalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { role } = usePermissions()
  const { user } = useUser()
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
  const [kamDistances, setKamDistances] = useState<any[]>([])
  const [editingDocumentsUrl, setEditingDocumentsUrl] = useState(false)
  const [documentsUrl, setDocumentsUrl] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [userRole, setUserRole] = useState<string>('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentForm, setCommentForm] = useState({
    message: ''
  })
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [activityLog, setActivityLog] = useState<any[]>([])

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
        setDocumentsUrl(data.hospital.documents_url || '')
        setMunicipalityName(data.municipalityName || '')
        setDepartmentName(data.departmentName || '')
        setKam(data.kam)
        setKamMunicipalityName(data.kamMunicipalityName || '')
        setContractStats(data.contractStats)
        setUserRole(role || '')
        
        // Inicializar formulario de edición
        setEditForm({
          name: data.hospital.name,
          code: data.hospital.code,
          beds: data.hospital.beds || 0,
          service_level: data.hospital.service_level || 1,
          address: data.hospital.address || '',
          phone: data.hospital.phone || '',
          email: data.hospital.email || '',
          lat: data.hospital.lat,
          lng: data.hospital.lng,
          hospital_type: data.hospital.hospital_type || 'Publico',
          services: data.hospital.services || '',
          surgeries: data.hospital.surgeries || 0,
          ambulances: data.hospital.ambulances || 0
        })
        
        // Cargar historial si existe
        if (data.history) {
          setHistory(data.history)
        }
        
        // Cargar actividad completa (comentarios + sistema)
        const commentsResponse = await fetch(`/api/hospitals/${hospitalId}/comments`)
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json()
          setActivityLog(commentsData.data || [])
        }
        
        // Cargar distancias de KAMs desde hospital_kam_distances
        const distResponse = await fetch(`/api/hospitals/${hospitalId}/kam-distances`)
        if (distResponse.ok) {
          const distData = await distResponse.json()
          setKamDistances(distData.distances || [])
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
            {/* Botón de Editar Hospital - Visible para todos los usuarios autenticados */}
            <button
              onClick={() => {
                console.log('Botón Editar clickeado')
                setEditForm({
                  name: hospital.name,
                  code: hospital.code,
                  beds: hospital.beds || 0,
                  service_level: hospital.service_level || 1,
                  address: hospital.address || '',
                  phone: hospital.phone || '',
                  email: hospital.email || '',
                  lat: hospital.lat,
                  lng: hospital.lng,
                  hospital_type: hospital.hospital_type || 'Publico',
                  services: hospital.services || '',
                  surgeries: hospital.surgeries || 0,
                  ambulances: hospital.ambulances || 0
                })
                setShowEditModal(true)
              }}
              className="group px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
            >
              <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar Información
            </button>
            
            {/* Botón de Activar/Desactivar - Solo para usuarios con permisos */}
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
                  {hospital.hospital_type ? (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      hospital.hospital_type === 'Publico' ? 'bg-blue-100 text-blue-700' :
                      hospital.hospital_type === 'Privado' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {hospital.hospital_type}
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

        {/* Distancias a KAMs */}
        {kamDistances.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Distancias desde KAMs</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-gray-600 font-medium">KAM</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Tiempo de Viaje</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Distancia</th>
                    <th className="text-center py-2 text-gray-600 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {kamDistances.map((dist: any, idx: number) => {
                    const minutes = Math.round(dist.travel_time / 60)
                    const isAssigned = kam && kam.id === dist.kam_id
                    const isOverLimit = minutes > (dist.max_travel_time || 240)
                    
                    return (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3">
                          <span className={`font-medium ${isAssigned ? 'text-green-600' : 'text-gray-900'}`}>
                            {dist.kam_name}
                            {isAssigned && ' ✓'}
                          </span>
                        </td>
                        <td className={`text-right py-3 ${isOverLimit ? 'text-red-600' : 'text-gray-700'}`}>
                          {Math.floor(minutes / 60)}h {minutes % 60}m
                        </td>
                        <td className="text-right py-3 text-gray-700">
                          {dist.distance ? `${dist.distance.toFixed(1)} km` : '-'}
                        </td>
                        <td className="text-center py-3">
                          {isAssigned ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Asignado
                            </span>
                          ) : isOverLimit ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              Fuera de rango
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                              Disponible
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* URL de Documentos */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Carpeta de Documentos</h2>
            <PermissionGuard permission="hospitals:edit">
              {!editingDocumentsUrl && (
                <button
                  onClick={() => setEditingDocumentsUrl(true)}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  title="Editar URL de documentos"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                  </svg>
                </button>
              )}
            </PermissionGuard>
          </div>
          {editingDocumentsUrl ? (
            <div>
              <input
                type="url"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
                value={documentsUrl}
                onChange={(e) => setDocumentsUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/... o https://docs.zoho.com/folder/..."
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/hospitals/${hospitalId}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ documents_url: documentsUrl })
                      })
                      
                      if (!response.ok) {
                        throw new Error('Error al actualizar URL')
                      }
                      
                      setHospital({ ...hospital, documents_url: documentsUrl })
                      setEditingDocumentsUrl(false)
                      alert('URL de documentos actualizada exitosamente')
                    } catch (error: any) {
                      console.error('Error updating documents URL:', error)
                      alert('Error al actualizar URL: ' + error.message)
                    }
                  }}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setDocumentsUrl(hospital.documents_url || '')
                    setEditingDocumentsUrl(false)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Ingrese la URL de la carpeta compartida en Google Drive o Zoho Docs donde se almacenan todos los contratos y documentos del hospital
              </p>
            </div>
          ) : (
            <div>
              {documentsUrl ? (
                <div className="flex items-center gap-3">
                  <a 
                    href={documentsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                    <span className="font-medium">Ver carpeta de documentos</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                  </a>
                  <span className="text-sm text-gray-500">
                    ({documentsUrl.includes('google') ? 'Google Drive' : documentsUrl.includes('zoho') ? 'Zoho Docs' : 'Carpeta externa'})
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 italic">No hay carpeta de documentos configurada</span>
              )}
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


        {/* Actividad y Comentarios */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Actividad y Comentarios</h2>
            <button
              onClick={() => setShowCommentModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Comentario
            </button>
          </div>
          {activityLog && activityLog.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityLog.map((entry: any, index: number) => {
                const isComment = entry.entryType !== 'system'
                
                return (
                  <div key={entry.id || index} className="border-l-4 border-gray-200 pl-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {entry.action === 'activated' ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              ✓ Hospital Activado
                            </span>
                          ) : entry.action === 'deactivated' ? (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              ✗ Hospital Desactivado
                            </span>
                          ) : null}
                          <span className="text-xs text-gray-500">
                            {new Date(entry.createdAt).toLocaleString('es-CO')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">
                          {entry.message || entry.reason}
                        </p>
                        <p className="text-xs text-gray-600 font-medium">
                          {entry.user?.name || entry.user?.email || 'Sistema'}
                          {entry.user?.role && ` - ${entry.user.role === 'admin' ? 'Administrador' : entry.user.role === 'sales' ? 'KAM' : entry.user.role}`}
                        </p>
                      </div>
                      {isComment && (role === 'admin' || entry.userId === user?.id) && (
                        <button
                          onClick={async () => {
                            if (confirm('¿Está seguro de eliminar este comentario?')) {
                              try {
                                const response = await fetch(`/api/hospitals/${hospitalId}/comments?commentId=${entry.id}`, {
                                  method: 'DELETE'
                                })
                                if (response.ok) {
                                  await loadHospitalData()
                                } else {
                                  alert('Error al eliminar el comentario')
                                }
                              } catch (error) {
                                console.error('Error deleting comment:', error)
                                alert('Error al eliminar el comentario')
                              }
                            }
                          }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Eliminar comentario"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-gray-500 text-sm">No hay actividad registrada</p>
              <p className="text-gray-400 text-xs mt-1">Los comentarios y eventos aparecerán aquí</p>
            </div>
          )}
        </div>

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

        {/* Modal de edición general */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all animate-slideUp">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Editar Hospital</h3>
                      <p className="text-white/80 text-sm">Actualizar información del hospital</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white/80 hover:text-white transition-colors"
                    disabled={isSavingEdit}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content - scrollable */}
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Información básica */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Información Básica</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre del Hospital <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Código NIT <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={editForm.code || ''}
                        onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Hospital <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={editForm.hospital_type || 'Publico'}
                        onChange={(e) => setEditForm({...editForm, hospital_type: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="Publico">Público</option>
                        <option value="Privado">Privado</option>
                        <option value="Mixto">Mixto</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Camas
                      </label>
                      <input
                        type="number"
                        value={editForm.beds || 0}
                        onChange={(e) => setEditForm({...editForm, beds: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nivel de Servicio
                      </label>
                      <select
                        value={editForm.service_level || 1}
                        onChange={(e) => setEditForm({...editForm, service_level: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1">Nivel 1</option>
                        <option value="2">Nivel 2</option>
                        <option value="3">Nivel 3</option>
                        <option value="4">Nivel 4</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Información de contacto y ubicación */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Contacto y Ubicación</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dirección
                      </label>
                      <input
                        type="text"
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={editForm.phone || ''}
                        onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    {/* Coordenadas - Solo editable por admin */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Latitud {role !== 'admin' && <span className="text-xs text-gray-500">(Solo lectura)</span>}
                      </label>
                      <input
                        type="number"
                        value={editForm.lat || 0}
                        onChange={(e) => role === 'admin' && setEditForm({...editForm, lat: parseFloat(e.target.value)})}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none ${
                          role === 'admin' ? 'focus:ring-2 focus:ring-blue-500 focus:border-transparent' : 'bg-gray-100 cursor-not-allowed'
                        }`}
                        step="0.000001"
                        readOnly={role !== 'admin'}
                        disabled={role !== 'admin'}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Longitud {role !== 'admin' && <span className="text-xs text-gray-500">(Solo lectura)</span>}
                      </label>
                      <input
                        type="number"
                        value={editForm.lng || 0}
                        onChange={(e) => role === 'admin' && setEditForm({...editForm, lng: parseFloat(e.target.value)})}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none ${
                          role === 'admin' ? 'focus:ring-2 focus:ring-blue-500 focus:border-transparent' : 'bg-gray-100 cursor-not-allowed'
                        }`}
                        step="0.000001"
                        readOnly={role !== 'admin'}
                        disabled={role !== 'admin'}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Información adicional */}
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Información Adicional</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Cirugías
                      </label>
                      <input
                        type="number"
                        value={editForm.surgeries || 0}
                        onChange={(e) => setEditForm({...editForm, surgeries: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Ambulancias
                      </label>
                      <input
                        type="number"
                        value={editForm.ambulances || 0}
                        onChange={(e) => setEditForm({...editForm, ambulances: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Servicios
                    </label>
                    <textarea
                      value={editForm.services || ''}
                      onChange={(e) => setEditForm({...editForm, services: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Lista de servicios que ofrece el hospital..."
                    />
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  disabled={isSavingEdit}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    setIsSavingEdit(true)
                    try {
                      const response = await fetch(`/api/hospitals/${hospitalId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(editForm)
                      })
                      
                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || 'Error al actualizar hospital')
                      }
                      
                      await loadHospitalData()
                      setShowEditModal(false)
                      alert('Hospital actualizado exitosamente')
                    } catch (error: any) {
                      console.error('Error updating hospital:', error)
                      alert('Error al actualizar hospital: ' + error.message)
                    } finally {
                      setIsSavingEdit(false)
                    }
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isSavingEdit || !editForm.name || !editForm.code}
                >
                  {isSavingEdit ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para agregar comentario */}
        {showCommentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all animate-slideUp">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Agregar Comentario</h3>
                      <p className="text-white/80 text-sm">Registrar observación o nota sobre este hospital</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowCommentModal(false)
                      setCommentForm({
                        message: ''
                      })
                    }}
                    className="text-white/80 hover:text-white transition-colors"
                    disabled={isSubmittingComment}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Escriba su comentario <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    rows={5}
                    placeholder="Ej: Este hospital fue cerrado definitivamente hace 2 meses..."
                    value={commentForm.message}
                    onChange={(e) => setCommentForm({message: e.target.value})}
                    disabled={isSubmittingComment}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Su comentario será visible para todos los usuarios del sistema
                  </p>
                </div>
              </div>
              
              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
                <button
                  onClick={() => {
                    setShowCommentModal(false)
                    setCommentForm({
                      message: ''
                    })
                  }}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  disabled={isSubmittingComment}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!commentForm.message.trim()) {
                      alert('Por favor ingrese un mensaje')
                      return
                    }
                    
                    setIsSubmittingComment(true)
                    try {
                      const response = await fetch(`/api/hospitals/${hospitalId}/comments`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(commentForm)
                      })
                      
                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || 'Error al agregar comentario')
                      }
                      
                      await loadHospitalData()
                      setShowCommentModal(false)
                      setCommentForm({
                        message: ''
                      })
                      alert('Comentario agregado exitosamente')
                    } catch (error: any) {
                      console.error('Error adding comment:', error)
                      alert('Error al agregar comentario: ' + error.message)
                    } finally {
                      setIsSubmittingComment(false)
                    }
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isSubmittingComment || !commentForm.message.trim()}
                >
                  {isSubmittingComment ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Agregar Comentario
                    </>
                  )}
                </button>
              </div>
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