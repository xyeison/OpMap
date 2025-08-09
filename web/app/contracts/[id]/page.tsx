'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'

interface Contract {
  id: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contracting_model?: string
  contract_value: number
  start_date: string
  end_date: string
  duration_months?: number
  current_provider?: string
  description?: string
  active: boolean
  created_at: string
  updated_at: string
  hospital?: {
    id: string
    name: string
    municipality_name: string
    department_name: string
  }
}

export default function ContractDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)

  const contractId = params.id as string

  useEffect(() => {
    loadContract()
  }, [contractId])

  const loadContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) throw new Error('Error al cargar contrato')
      
      const data = await response.json()
      setContract(data)
    } catch (error) {
      console.error('Error loading contract:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getContractTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      capita: 'Cápita',
      evento: 'Evento',
      pgp: 'PGP'
    }
    return types[type] || type
  }

  const getContractingModelLabel = (model?: string) => {
    const models: Record<string, string> = {
      contratacion_directa: 'Contratación Directa',
      licitacion: 'Licitación',
      invitacion_privada: 'Invitación Privada'
    }
    return models[model || ''] || model || 'No especificado'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!contract) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Contrato no encontrado</h1>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Volver
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              Contrato #{contract.contract_number}
            </h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            contract.active 
              ? 'bg-gray-900 text-white' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {contract.active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Hospital Info */}
      {contract.hospital && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Hospital Asociado</h2>
          <Link 
            href={`/hospitals/${contract.hospital_id}`}
            className="text-gray-700 hover:text-gray-900 font-medium text-lg"
          >
            {contract.hospital.name}
          </Link>
          <p className="text-gray-600 mt-1">
            {contract.hospital.municipality_name}, {contract.hospital.department_name}
          </p>
        </div>
      )}

      {/* Contract Details */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Detalles del Contrato</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Valor */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Valor del Contrato</label>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(contract.contract_value)}
            </p>
          </div>

          {/* Tipo */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Tipo de Contrato</label>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {getContractTypeLabel(contract.contract_type)}
            </p>
          </div>

          {/* Modelo de Contratación */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Modelo de Contratación</label>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {getContractingModelLabel(contract.contracting_model)}
            </p>
          </div>

          {/* Proveedor Actual */}
          {contract.current_provider && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-sm font-semibold text-gray-600">Proveedor Actual</label>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {contract.current_provider}
              </p>
            </div>
          )}

          {/* Fechas */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Fecha de Inicio</label>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {formatDate(contract.start_date)}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Fecha de Finalización</label>
            <p className="text-lg font-medium text-gray-900 mt-1">
              {formatDate(contract.end_date)}
            </p>
          </div>

          {/* Duración */}
          {contract.duration_months && (
            <div className="bg-gray-50 rounded-lg p-4">
              <label className="text-sm font-semibold text-gray-600">Duración</label>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {contract.duration_months} meses
              </p>
            </div>
          )}
        </div>

        {/* Descripción */}
        {contract.description && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <label className="text-sm font-semibold text-gray-600">Descripción</label>
            <p className="text-gray-700 mt-2">
              {contract.description}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <span className="font-medium">Creado:</span> {formatDate(contract.created_at)}
            </div>
            <div>
              <span className="font-medium">Última actualización:</span> {formatDate(contract.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}