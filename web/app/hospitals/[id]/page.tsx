'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import ContractsListImproved from '@/components/ContractsListImproved'
import { useQueryClient } from '@tanstack/react-query'

export default function HospitalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hospitalId = params.id as string
  
  const [hospital, setHospital] = useState<any>(null)
  const [kam, setKam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showContracts, setShowContracts] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contractStats, setContractStats] = useState({ activeCount: 0, totalValue: 0 })
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [municipalityName, setMunicipalityName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [kamMunicipalityName, setKamMunicipalityName] = useState('')

  useEffect(() => {
    loadHospitalData()
  }, [hospitalId])

  const loadHospitalData = async () => {
    try {
      // Cargar datos del hospital
      const { data: hospitalData } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', hospitalId)
        .single()
      
      if (hospitalData) {
        setHospital(hospitalData)
        
        // Cargar nombre del municipio
        const { data: municipality } = await supabase
          .from('municipalities')
          .select('name')
          .eq('code', hospitalData.municipality_id)
          .single()
        
        if (municipality) {
          setMunicipalityName(municipality.name)
        }
        
        // Cargar nombre del departamento
        const { data: department } = await supabase
          .from('departments')
          .select('name')
          .eq('code', hospitalData.department_id)
          .single()
        
        if (department) {
          setDepartmentName(department.name)
        }
        
        // Buscar la asignación del hospital
        const { data: assignment } = await supabase
          .from('assignments')
          .select('kam_id')
          .eq('hospital_id', hospitalId)
          .single()
        
        // Si tiene KAM asignado, cargar sus datos
        if (assignment?.kam_id) {
          const { data: kamData } = await supabase
            .from('kams')
            .select('*')
            .eq('id', assignment.kam_id)
            .single()
          
          setKam(kamData)
          
          // Cargar nombre del municipio del KAM
          if (kamData) {
            const { data: kamMunicipality } = await supabase
              .from('municipalities')
              .select('name')
              .eq('code', kamData.area_id)
              .single()
            
            if (kamMunicipality) {
              setKamMunicipalityName(kamMunicipality.name)
            }
          }
        }
        
        // Cargar estadísticas de contratos
        const { data: contracts } = await supabase
          .from('hospital_contracts')
          .select('contract_value')
          .eq('hospital_id', hospitalId)
          .eq('active', true)
        
        if (contracts) {
          const activeCount = contracts.length
          const totalValue = contracts.reduce((sum, contract) => sum + (contract.contract_value || 0), 0)
          setContractStats({ activeCount, totalValue })
        }
      }
    } catch (error) {
      console.error('Error loading hospital:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    if (hospital.active && !deactivateReason.trim()) {
      alert('Por favor ingrese el motivo de desactivación')
      return
    }

    setIsSubmitting(true)
    try {
      const userId = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('opmap_user') || '{}').id
        : null

      console.log('Toggling hospital:', hospitalId, 'from', hospital.active, 'to', !hospital.active)
      console.log('User ID:', userId)

      // Actualizar estado del hospital
      const { data: updateData, error: updateError } = await supabase
        .from('hospitals')
        .update({ active: !hospital.active })
        .eq('id', hospitalId)
        .select()

      console.log('Update result:', { data: updateData, error: updateError })

      if (updateError) throw updateError

      // Si se está desactivando, registrar en el historial
      if (hospital.active) {
        const historyData: any = {
          hospital_id: hospitalId,
          action: 'deactivated',
          reason: deactivateReason,
          previous_state: true,
          new_state: false
        }
        
        // Usar user_id en lugar de created_by
        if (userId) {
          historyData.user_id = userId
        }
        
        console.log('Inserting deactivation history:', historyData)
        
        const { data: historyInsertData, error: historyError } = await supabase
          .from('hospital_history')
          .insert(historyData)
          .select()

        console.log('History insert result:', { data: historyInsertData, error: historyError })

        if (historyError) throw historyError
      } else {
        // Si se está activando, también registrar en el historial
        const historyData: any = {
          hospital_id: hospitalId,
          action: 'activated',
          reason: 'Reactivación del hospital',
          previous_state: false,
          new_state: true
        }
        
        if (userId) {
          historyData.user_id = userId
        }
        
        console.log('Inserting activation history:', historyData)
        
        const { data: historyInsertData, error: historyError } = await supabase
          .from('hospital_history')
          .insert(historyData)
          .select()

        console.log('History insert result:', { data: historyInsertData, error: historyError })

        if (historyError) throw historyError
      }

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
      setDeactivateReason('')
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
        <div className="flex justify-between items-start mb-6">
          <div>
            <button
              onClick={() => router.push('/hospitals')}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
            >
              ← Volver a hospitales
            </button>
            <h1 className="text-3xl font-bold">{hospital.name}</h1>
            <p className="text-gray-600">Código: {hospital.code}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowContracts(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Gestionar Contratos/Oportunidades
            </button>
            <PermissionGuard permission="hospitals:edit">
              <button
                onClick={() => {
                  if (hospital.active) {
                    setShowDeactivateModal(true)
                  } else {
                    handleToggleActive()
                  }
                }}
                className={`px-4 py-2 rounded ${
                  hospital.active 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {hospital.active ? 'Desactivar Hospital' : 'Activar Hospital'}
              </button>
            </PermissionGuard>
          </div>
        </div>

        {/* Información general */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Información General</h2>
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
                <span className={`ml-2 font-medium ${hospital.active ? 'text-green-600' : 'text-red-600'}`}>
                  {hospital.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tipo:</span>
                <span className="ml-2 font-medium">
                  {hospital.type ? (
                    <span className={`px-2 py-1 rounded text-xs ${
                      hospital.type === 'Publico' ? 'bg-blue-100 text-blue-800' :
                      hospital.type === 'Privada' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
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

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">KAM Asignado</h2>
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

        {/* Estadísticas de Contratos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Contratos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center p-4">
              <p className="text-3xl font-bold text-blue-600">{contractStats.activeCount}</p>
              <p className="text-gray-600">Contratos activos</p>
            </div>
            <div className="text-center p-4">
              <p className="text-3xl font-bold text-green-600">
                ${contractStats.totalValue.toLocaleString('es-CO')}
              </p>
              <p className="text-gray-600">Valor total contratos</p>
            </div>
          </div>
        </div>

        {/* Modal de contratos */}
        {showContracts && (
          <ContractsListImproved
            hospitalId={hospitalId}
            onClose={() => {
              setShowContracts(false)
              loadHospitalData() // Recargar datos para actualizar estadísticas
            }}
          />
        )}

        {/* Modal de confirmación para desactivar */}
        {showDeactivateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Desactivar Hospital</h3>
              <p className="text-gray-600 mb-4">
                Está a punto de desactivar el hospital <strong>{hospital.name}</strong>.
                Por favor, indique el motivo:
              </p>
              <textarea
                className="w-full p-3 border rounded-lg mb-4"
                rows={4}
                placeholder="Motivo de desactivación..."
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowDeactivateModal(false)
                    setDeactivateReason('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleToggleActive}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  disabled={isSubmitting || !deactivateReason.trim()}
                >
                  {isSubmitting ? 'Desactivando...' : 'Confirmar Desactivación'}
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
    </ProtectedRoute>
  )
}