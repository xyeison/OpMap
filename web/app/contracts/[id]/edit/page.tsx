'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import ProtectedRoute from '@/components/ProtectedRoute'

interface Contract {
  id?: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contracting_model?: string
  contract_value: number
  start_date: string
  end_date: string
  duration_months?: number
  current_provider?: string
  proveedor_id?: string
  description?: string
  documents_link?: string
  active: boolean
  // Indicadores requeridos
  requires_liquidez?: boolean
  min_liquidez?: number
  requires_endeudamiento?: boolean
  max_endeudamiento?: number
  requires_cobertura?: boolean
  min_cobertura?: number
  requires_capital_trabajo?: boolean
  min_capital_trabajo?: number
  requires_experiencia?: boolean
  min_experiencia_years?: number
  custom_requirements?: string
}

interface Hospital {
  id: string
  name: string
  municipality_name: string
  department_name: string
}

interface Provider {
  id: string
  nombre: string
  nit: string
}

export default function ContractEditPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const contractId = params.id as string
  const isNew = contractId === 'new'
  
  // Get hospital_id from URL params if creating new contract
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSearchParams(new URLSearchParams(window.location.search))
    }
  }, [])
  
  const preselectedHospitalId = searchParams?.get('hospital_id') || ''
  const preselectedHospitalName = searchParams?.get('hospital_name') || ''
  const preselectedMunicipalityName = searchParams?.get('municipality_name') || ''
  
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [hospitalSearch, setHospitalSearch] = useState('')
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false)
  
  const [contract, setContract] = useState<Contract>({
    hospital_id: '',
    contract_number: '',
    contract_type: 'evento',
    contracting_model: 'contratacion_directa',
    contract_value: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    duration_months: 12,
    current_provider: '',
    proveedor_id: undefined,
    description: '',
    documents_link: '',
    active: true,
    // Indicadores por defecto
    requires_liquidez: true,
    min_liquidez: 1.2,
    requires_endeudamiento: true,
    max_endeudamiento: 0.7,
    requires_cobertura: true,
    min_cobertura: 1.5,
    requires_capital_trabajo: false,
    min_capital_trabajo: 0,
    requires_experiencia: false,
    min_experiencia_years: 0,
    custom_requirements: ''
  })

  useEffect(() => {
    loadData()
  }, [contractId])
  
  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hospital-search-container')) {
        setShowHospitalDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [])
  
  useEffect(() => {
    // Set preselected hospital immediately
    if (preselectedHospitalId && isNew) {
      setContract(prev => ({
        ...prev,
        hospital_id: preselectedHospitalId
      }))
    }
  }, [preselectedHospitalId, isNew])

  const loadData = async () => {
    try {
      // Cargar hospitales y proveedores en paralelo
      const promises = []
      
      // Hospitales
      promises.push(
        fetch('/api/hospitals')
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              console.log('Hospitals API response:', data);
              // La API devuelve directamente el array, no un objeto con 'data'
              const hospitalsData = Array.isArray(data) ? data : (data.data || []);
              console.log('Setting hospitals:', hospitalsData.length);
              setHospitals(hospitalsData);
            }
          })
      )
      
      // Proveedores
      promises.push(
        fetch('/api/providers')
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setProviders(data.data || [])
            }
          })
      )
      
      // Si no es nuevo, cargar contrato existente
      if (!isNew) {
        promises.push(
          fetch(`/api/contracts/${contractId}`)
            .then(res => {
              if (!res.ok) throw new Error('Error al cargar contrato')
              return res.json()
            })
            .then(data => setContract(data))
        )
      }
      
      await Promise.all(promises)
    } catch (error) {
      console.error('Error loading data:', error)
      if (!isNew) {
        alert('Error al cargar el contrato')
        router.back()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = isNew ? '/api/contracts' : `/api/contracts/${contractId}`
      const method = isNew ? 'POST' : 'PUT'
      
      // Clean proveedor_id
      const { proveedor_id, ...contractData } = contract
      
      // Only include proveedor_id if it has a valid value
      const dataToSend = {
        ...contractData,
        proveedor_id: proveedor_id && proveedor_id !== '' ? proveedor_id : null
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      })

      if (!response.ok) {
        throw new Error('Error al guardar contrato')
      }

      const data = await response.json()
      alert(isNew ? 'Contrato creado exitosamente' : 'Contrato actualizado exitosamente')
      router.push(`/contracts/${isNew ? data.id : contractId}`)
    } catch (error) {
      console.error('Error saving contract:', error)
      alert('Error al guardar el contrato')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof Contract, value: any) => {
    setContract(prev => ({
      ...prev,
      [field]: value
    }))
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

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {isNew ? 'Nuevo Contrato' : `Editar Contrato #${contract.contract_number}`}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Información Básica */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Información Básica</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Hospital */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hospital *
                </label>
                {preselectedHospitalId ? (
                  // Si viene desde un hospital, mostrar como campo de solo lectura
                  <div>
                    <div className="relative">
                      <input
                        type="hidden"
                        value={contract.hospital_id || preselectedHospitalId}
                        required
                      />
                      <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                        {(() => {
                          // Si tenemos el nombre del hospital desde la URL, mostrarlo inmediatamente
                          if (preselectedHospitalName) {
                            return `${preselectedHospitalName}${preselectedMunicipalityName ? ` - ${preselectedMunicipalityName}` : ''}`;
                          }
                          
                          // Si no, buscar en la lista completa de hospitales
                          const hospitalId = contract.hospital_id || preselectedHospitalId;
                          const hospital = hospitals.find(h => h.id === hospitalId);
                          
                          if (hospital) {
                            return `${hospital.name} - ${hospital.municipality_name}`;
                          }
                          
                          // Fallback - solo mostrar si realmente no hay datos
                          return 'Hospital seleccionado';
                        })()}
                      </div>
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Hospital preseleccionado desde la página del hospital
                    </p>
                  </div>
                ) : (
                  // Si no viene desde un hospital, permitir búsqueda y selección libre
                  <div className="relative hospital-search-container">
                    <input
                      type="text"
                      placeholder="Buscar hospital por nombre..."
                      value={hospitalSearch || (contract.hospital_id ? hospitals.find(h => h.id === contract.hospital_id)?.name : '')}
                      onChange={(e) => {
                        setHospitalSearch(e.target.value);
                        setShowHospitalDropdown(true);
                        // Si se borra el texto, limpiar la selección
                        if (!e.target.value) {
                          handleChange('hospital_id', '');
                        }
                      }}
                      onFocus={() => setShowHospitalDropdown(true)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                      required={!contract.hospital_id}
                    />
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    
                    {/* Dropdown con resultados de búsqueda */}
                    {showHospitalDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {(() => {
                          // Si no hay búsqueda, mostrar mensaje inicial
                          if (!hospitalSearch) {
                            return (
                              <div className="px-4 py-2 text-gray-500">
                                Escribe para buscar un hospital...
                              </div>
                            );
                          }
                          
                          // Si aún no se han cargado los hospitales
                          if (hospitals.length === 0) {
                            return (
                              <div className="px-4 py-2 text-gray-500">
                                Cargando hospitales...
                              </div>
                            );
                          }
                          
                          const search = hospitalSearch.toLowerCase();
                          const filtered = hospitals.filter(h => 
                            h.name.toLowerCase().includes(search) ||
                            (h.municipality_name && h.municipality_name.toLowerCase().includes(search)) ||
                            (h.department_name && h.department_name.toLowerCase().includes(search))
                          );
                          
                          if (filtered.length === 0) {
                            return (
                              <div className="px-4 py-2 text-gray-500">
                                No se encontraron hospitales con "{hospitalSearch}"
                              </div>
                            );
                          }
                          
                          return filtered.slice(0, 50).map(hospital => (
                            <button
                              key={hospital.id}
                              type="button"
                              onClick={() => {
                                handleChange('hospital_id', hospital.id);
                                setHospitalSearch(hospital.name);
                                setShowHospitalDropdown(false);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            >
                              <div className="font-medium text-gray-900">{hospital.name}</div>
                              <div className="text-sm text-gray-500">
                                {hospital.municipality_name}, {hospital.department_name}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                    
                    {contract.hospital_id && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Hospital seleccionado: {hospitals.find(h => h.id === contract.hospital_id)?.municipality_name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Número de Contrato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Contrato *
                </label>
                <input
                  type="text"
                  value={contract.contract_number}
                  onChange={(e) => handleChange('contract_number', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>

              {/* Proveedor con búsqueda */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="providers-list"
                    placeholder="Buscar proveedor por nombre o NIT..."
                    value={contract.current_provider || ''}
                    onChange={(e) => {
                      const searchValue = e.target.value;
                      handleChange('current_provider', searchValue);
                      
                      // Buscar coincidencia exacta con el nombre
                      const foundProvider = providers.find(p => 
                        p.nombre === searchValue
                      );
                      
                      if (foundProvider) {
                        handleChange('proveedor_id', foundProvider.id);
                      } else {
                        // Si no hay coincidencia exacta, limpiar proveedor_id
                        handleChange('proveedor_id', undefined);
                      }
                    }}
                    onBlur={(e) => {
                      // Al salir del campo, buscar coincidencia parcial
                      const searchValue = e.target.value.toLowerCase();
                      if (searchValue) {
                        const foundProvider = providers.find(p => 
                          p.nombre.toLowerCase() === searchValue || 
                          p.nit.toLowerCase() === searchValue
                        );
                        
                        if (foundProvider) {
                          handleChange('proveedor_id', foundProvider.id);
                          handleChange('current_provider', foundProvider.nombre);
                        }
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <datalist id="providers-list">
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.nombre}>
                        NIT: {provider.nit}
                      </option>
                    ))}
                  </datalist>
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {contract.proveedor_id && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Proveedor vinculado: {providers.find(p => p.id === contract.proveedor_id)?.nit}
                  </p>
                )}
              </div>

              {/* Valor del Contrato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor del Contrato (COP) *
                </label>
                <input
                  type="number"
                  value={contract.contract_value}
                  onChange={(e) => handleChange('contract_value', parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                  min="0"
                />
              </div>

              {/* Tipo de Contrato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Contrato *
                </label>
                <select
                  value={contract.contract_type}
                  onChange={(e) => handleChange('contract_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                >
                  <option value="capita">Cápita</option>
                  <option value="evento">Evento</option>
                  <option value="pgp">PGP</option>
                </select>
              </div>

              {/* Modelo de Contratación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo de Contratación
                </label>
                <select
                  value={contract.contracting_model || ''}
                  onChange={(e) => handleChange('contracting_model', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="contratacion_directa">Contratación Directa</option>
                  <option value="licitacion">Licitación</option>
                  <option value="invitacion_privada">Invitación Privada (Presentación de Oferta)</option>
                  <option value="subasta_inversa">Subasta Inversa</option>
                </select>
              </div>

              {/* Fechas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={contract.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Finalización *
                </label>
                <input
                  type="date"
                  value={contract.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>


              {/* Descripción */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={contract.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  rows={3}
                />
              </div>

              {/* Link de Documentos */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link de Documentos
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={contract.documents_link || ''}
                    onChange={(e) => handleChange('documents_link', e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="https://ejemplo.com/documentos-contrato"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  URL del repositorio de documentos o carpeta compartida con los documentos del contrato
                </p>
              </div>

              {/* Estado */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={contract.active}
                    onChange={(e) => handleChange('active', e.target.checked)}
                    className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Contrato Activo
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Indicadores Requeridos */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Indicadores Requeridos para Participación</h2>
            <p className="text-gray-600 mb-6">
              Define los indicadores financieros mínimos que debe cumplir un proveedor para participar en este contrato.
            </p>
            
            <div className="space-y-6">
              {/* Índice de Liquidez */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contract.requires_liquidez}
                      onChange={(e) => handleChange('requires_liquidez', e.target.checked)}
                      className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                    />
                    <span className="font-medium text-gray-900">Índice de Liquidez</span>
                  </label>
                  {contract.requires_liquidez && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Mínimo:</span>
                      <input
                        type="number"
                        value={contract.min_liquidez || 1.2}
                        onChange={(e) => handleChange('min_liquidez', parseFloat(e.target.value))}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        step="0.1"
                        min="0"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Capacidad de la empresa para cumplir con sus obligaciones a corto plazo.
                </p>
              </div>

              {/* Índice de Endeudamiento */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contract.requires_endeudamiento}
                      onChange={(e) => handleChange('requires_endeudamiento', e.target.checked)}
                      className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                    />
                    <span className="font-medium text-gray-900">Índice de Endeudamiento</span>
                  </label>
                  {contract.requires_endeudamiento && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Máximo:</span>
                      <input
                        type="number"
                        value={(contract.max_endeudamiento || 0.7) * 100}
                        onChange={(e) => handleChange('max_endeudamiento', parseFloat(e.target.value) / 100)}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        step="1"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Proporción de activos financiados con deuda. Menor es mejor.
                </p>
              </div>

              {/* Cobertura de Intereses */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contract.requires_cobertura}
                      onChange={(e) => handleChange('requires_cobertura', e.target.checked)}
                      className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                    />
                    <span className="font-medium text-gray-900">Cobertura de Intereses</span>
                  </label>
                  {contract.requires_cobertura && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Mínimo:</span>
                      <input
                        type="number"
                        value={contract.min_cobertura || 1.5}
                        onChange={(e) => handleChange('min_cobertura', parseFloat(e.target.value))}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        step="0.1"
                        min="0"
                      />
                      <span className="text-sm text-gray-600">veces</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Capacidad de pagar intereses sobre deudas con las ganancias operativas.
                </p>
              </div>

              {/* Capital de Trabajo */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contract.requires_capital_trabajo}
                      onChange={(e) => handleChange('requires_capital_trabajo', e.target.checked)}
                      className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                    />
                    <span className="font-medium text-gray-900">Capital de Trabajo Neto</span>
                  </label>
                  {contract.requires_capital_trabajo && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Mínimo (MM):</span>
                      <input
                        type="number"
                        value={contract.min_capital_trabajo || 0}
                        onChange={(e) => handleChange('min_capital_trabajo', parseFloat(e.target.value))}
                        className="w-32 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        step="100"
                        min="0"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Recursos disponibles para operación diaria (en millones de pesos).
                </p>
              </div>


              {/* Experiencia */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={contract.requires_experiencia}
                      onChange={(e) => handleChange('requires_experiencia', e.target.checked)}
                      className="w-5 h-5 text-gray-900 rounded focus:ring-gray-900"
                    />
                    <span className="font-medium text-gray-900">Experiencia en el Sector</span>
                  </label>
                  {contract.requires_experiencia && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Mínimo:</span>
                      <input
                        type="number"
                        value={contract.min_experiencia_years || 0}
                        onChange={(e) => handleChange('min_experiencia_years', parseInt(e.target.value))}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                        step="1"
                        min="0"
                      />
                      <span className="text-sm text-gray-600">años</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Años de experiencia comprobada en el sector salud.
                </p>
              </div>

              {/* Requisitos Adicionales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requisitos Adicionales o Especiales
                </label>
                <textarea
                  value={contract.custom_requirements || ''}
                  onChange={(e) => handleChange('custom_requirements', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  rows={4}
                  placeholder="Ej: Certificaciones ISO, presencia regional, experiencia específica en cierto tipo de servicios..."
                />
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : (isNew ? 'Crear Contrato' : 'Guardar Cambios')}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  )
}