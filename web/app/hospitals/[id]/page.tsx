'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import ContractsList from '@/components/ContractsList'

export default function HospitalDetailPage() {
  const params = useParams()
  const router = useRouter()
  const hospitalId = params.id as string
  
  const [hospital, setHospital] = useState<any>(null)
  const [kam, setKam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showContracts, setShowContracts] = useState(false)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

      // Actualizar estado del hospital
      const { error: updateError } = await supabase
        .from('hospitals')
        .update({ active: !hospital.active })
        .eq('id', hospitalId)

      if (updateError) throw updateError

      // Si se está desactivando, registrar en el historial
      if (hospital.active) {
        const { error: historyError } = await supabase
          .from('hospital_history')
          .insert({
            hospital_id: hospitalId,
            action: 'deactivated',
            reason: deactivateReason,
            created_by: userId
          })

        if (historyError) throw historyError
      }

      // Recargar datos
      await loadHospitalData()
      setShowDeactivateModal(false)
      setDeactivateReason('')
      
      alert(`Hospital ${hospital.active ? 'desactivado' : 'activado'} exitosamente`)
    } catch (error) {
      console.error('Error toggling hospital status:', error)
      alert('Error al cambiar el estado del hospital')
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
          </div>
        </div>

        {/* Información general */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Información General</h2>
            <div className="space-y-3">
              <div>
                <span className="text-gray-600">Municipio:</span>
                <span className="ml-2 font-medium">{hospital.municipality_id}</span>
              </div>
              <div>
                <span className="text-gray-600">Departamento:</span>
                <span className="ml-2 font-medium">{hospital.department_id}</span>
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
                  <span className="ml-2 font-medium">{kam.area_id}</span>
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

        {/* Estadísticas */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Estadísticas y Métricas</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">0</p>
              <p className="text-gray-600">Contratos activos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">$0</p>
              <p className="text-gray-600">Valor total contratos</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">0</p>
              <p className="text-gray-600">Oportunidades</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">0</p>
              <p className="text-gray-600">Visitas este mes</p>
            </div>
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Ubicación</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-gray-600">Latitud:</span>
              <span className="ml-2 font-medium">{hospital.lat}</span>
            </div>
            <div>
              <span className="text-gray-600">Longitud:</span>
              <span className="ml-2 font-medium">{hospital.lng}</span>
            </div>
          </div>
          <div className="bg-gray-100 rounded h-64 flex items-center justify-center">
            <p className="text-gray-500">Mapa próximamente</p>
          </div>
        </div>

        {/* Modal de contratos */}
        {showContracts && (
          <ContractsList
            hospitalId={hospitalId}
            onClose={() => setShowContracts(false)}
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
      </div>
    </ProtectedRoute>
  )
}