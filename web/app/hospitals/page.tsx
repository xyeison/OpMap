'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'

export default function HospitalsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [hospitalsWithKam, setHospitalsWithKam] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newHospital, setNewHospital] = useState({
    name: '',
    code: '',
    municipality_id: '',
    department_id: '',
    locality_id: '',
    lat: '',
    lng: '',
    beds: '',
    service_level: '',
    active: true
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [localities, setLocalities] = useState<any[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const queryClient = useQueryClient()
  
  const { data: hospitals, isLoading } = useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      // Cargar hospitales
      const { data: hospitalsData } = await supabase
        .from('hospitals')
        .select('*')
        .eq('active', true)
        .order('name')
      
      // Cargar asignaciones con detalles de KAM
      const { data: assignments } = await supabase
        .from('assignments')
        .select(`
          hospital_id,
          kam_id,
          kams!inner (
            id,
            name
          )
        `)
      
      // Crear mapa de hospital_id -> kam_name
      const kamMap = new Map()
      assignments?.forEach((a: any) => {
        if (a.kams && typeof a.kams === 'object' && 'name' in a.kams) {
          kamMap.set(a.hospital_id, a.kams.name)
        }
      })
      
      // Combinar datos
      const hospitalsWithKamData = hospitalsData?.map(h => ({
        ...h,
        assigned_kam_name: kamMap.get(h.id) || null
      }))
      
      return hospitalsWithKamData
    },
  })
  
  const handleUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['hospitals'] })
  }

  // Cargar departamentos al abrir el modal
  useEffect(() => {
    if (showAddModal) {
      loadDepartments()
    }
  }, [showAddModal])

  const loadDepartments = async () => {
    setLoadingLocations(true)
    try {
      const response = await fetch('/api/locations/departments')
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setDepartments(data)
      } else {
        console.error('Invalid departments response:', data)
        setDepartments([])
      }
    } catch (error) {
      console.error('Error loading departments:', error)
      setDepartments([])
    } finally {
      setLoadingLocations(false)
    }
  }

  const loadMunicipalities = async (departmentId: string) => {
    setLoadingLocations(true)
    setMunicipalities([])
    setLocalities([])
    setNewHospital(prev => ({ ...prev, municipality_id: '', locality_id: '' }))
    
    try {
      const response = await fetch(`/api/locations/municipalities?departmentId=${departmentId}`)
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setMunicipalities(data)
      } else {
        console.error('Invalid municipalities response:', data)
        setMunicipalities([])
      }
    } catch (error) {
      console.error('Error loading municipalities:', error)
      setMunicipalities([])
    } finally {
      setLoadingLocations(false)
    }
  }

  const loadLocalities = async (municipalityId: string) => {
    setLoadingLocations(true)
    setLocalities([])
    setNewHospital(prev => ({ ...prev, locality_id: '' }))
    
    try {
      const response = await fetch(`/api/locations/localities?municipalityId=${municipalityId}`)
      const data = await response.json()
      if (response.ok && Array.isArray(data)) {
        setLocalities(data)
      } else {
        console.error('Invalid localities response:', data)
        setLocalities([])
      }
    } catch (error) {
      console.error('Error loading localities:', error)
      setLocalities([])
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleAddHospital = async () => {
    if (!newHospital.name || !newHospital.code || !newHospital.municipality_id || !newHospital.lat || !newHospital.lng) {
      alert('Por favor complete todos los campos obligatorios')
      return
    }

    setIsSubmitting(true)
    try {
      const hospitalData = {
        name: newHospital.name,
        code: newHospital.code,
        municipality_id: newHospital.municipality_id,
        department_id: newHospital.department_id,
        locality_id: newHospital.locality_id || null,
        lat: parseFloat(newHospital.lat),
        lng: parseFloat(newHospital.lng),
        beds: newHospital.beds ? parseInt(newHospital.beds) : null,
        service_level: newHospital.service_level || null,
        active: newHospital.active
      }

      const { data, error } = await supabase
        .from('hospitals')
        .insert(hospitalData)
        .select()
        .single()

      if (error) throw error

      // Asignar el hospital al KAM más cercano
      if (data) {
        try {
          const assignResponse = await fetch('/api/hospitals/assign-to-kam', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              hospitalId: data.id,
              hospitalLat: data.lat,
              hospitalLng: data.lng,
              municipalityId: data.municipality_id
            })
          })

          const assignResult = await assignResponse.json()
          
          if (!assignResponse.ok) {
            console.error('Error asignando hospital:', assignResult.error)
            alert(`Hospital agregado pero no se pudo asignar a un KAM: ${assignResult.error}`)
          } else {
            alert(`Hospital agregado y asignado exitosamente a ${assignResult.kamName}`)
          }
        } catch (assignError) {
          console.error('Error en asignación:', assignError)
          alert('Hospital agregado pero hubo un error al asignarlo a un KAM')
        }
      }

      setShowAddModal(false)
      setNewHospital({
        name: '',
        code: '',
        municipality_id: '',
        department_id: '',
        locality_id: '',
        lat: '',
        lng: '',
        beds: '',
        service_level: '',
        active: true
      })
      setMunicipalities([])
      setLocalities([])
      handleUpdate()
    } catch (error: any) {
      console.error('Error adding hospital:', error)
      alert(`Error al agregar hospital: ${error.message || 'Error desconocido'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredHospitals = hospitals?.filter(hospital =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.code.includes(searchTerm)
  )
  
  console.log('Hospitals loaded:', hospitals?.length)

  if (isLoading) return <div className="p-6">Cargando...</div>

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Hospitales / IPS</h2>
        <PermissionGuard permission="hospitals:edit">
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Agregar Hospital
          </button>
        </PermissionGuard>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          className="w-full max-w-md px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Vista móvil */}
      <div className="block md:hidden">
        {filteredHospitals?.slice(0, 20).map((hospital) => (
          <div key={hospital.id} className="bg-white rounded-lg shadow mb-4 p-4">
            <div className="mb-2">
              <p className="text-sm text-gray-500">Código: {hospital.code}</p>
              <h3 className="font-semibold">{hospital.name}</h3>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              <p>Municipio: {hospital.municipality_id}</p>
              <p>Camas: {hospital.beds || '-'}</p>
              <p className="font-medium">KAM: {hospital.assigned_kam_name || 'Sin asignar'}</p>
            </div>
            <button
              onClick={() => {
                console.log('Navigating to hospital:', hospital.id);
                window.location.href = `/hospitals/${hospital.id}`;
              }}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              Ver detalle del hospital
            </button>
          </div>
        ))}
      </div>

      {/* Vista desktop */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hospital
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Municipio
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                KAM Asignado
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredHospitals?.slice(0, 20).map((hospital) => (
              <tr key={hospital.id}>
                <td className="px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{hospital.name}</div>
                    <div className="text-xs text-gray-500">{hospital.code}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                  {hospital.municipality_id}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <span className="text-gray-900">
                    {hospital.assigned_kam_name || '-'}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <button
                    onClick={() => {
                      console.log('Navigating to hospital:', hospital.id);
                      window.location.href = `/hospitals/${hospital.id}`;
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded cursor-pointer"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredHospitals && filteredHospitals.length > 20 && (
          <div className="bg-gray-50 px-6 py-3 text-sm text-gray-600">
            Mostrando 20 de {filteredHospitals.length} hospitales
          </div>
        )}
      </div>

      {/* Modal para agregar hospital */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Agregar Nuevo Hospital</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewHospital({
                    name: '',
                    code: '',
                    municipality_id: '',
                    department_id: '',
                    locality_id: '',
                    lat: '',
                    lng: '',
                    beds: '',
                    service_level: '',
                    active: true
                  })
                  setMunicipalities([])
                  setLocalities([])
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Nombre del Hospital *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newHospital.name}
                  onChange={(e) => setNewHospital({...newHospital, name: e.target.value})}
                  placeholder="Ej: Hospital San José"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Código NIT *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newHospital.code}
                  onChange={(e) => setNewHospital({...newHospital, code: e.target.value})}
                  placeholder="Ej: 900123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Departamento *
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={newHospital.department_id}
                  onChange={(e) => {
                    setNewHospital({...newHospital, department_id: e.target.value})
                    if (e.target.value) {
                      loadMunicipalities(e.target.value)
                    }
                  }}
                  disabled={loadingLocations}
                >
                  <option value="">Seleccione un departamento</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Municipio *
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={newHospital.municipality_id}
                  onChange={(e) => {
                    setNewHospital({...newHospital, municipality_id: e.target.value})
                    if (e.target.value) {
                      loadLocalities(e.target.value)
                    }
                  }}
                  disabled={!newHospital.department_id || loadingLocations}
                >
                  <option value="">
                    {!newHospital.department_id 
                      ? 'Primero seleccione un departamento' 
                      : 'Seleccione un municipio'}
                  </option>
                  {municipalities.map(mun => (
                    <option key={mun.id} value={mun.id}>
                      {mun.name}
                    </option>
                  ))}
                </select>
              </div>

              {localities.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Localidad (Solo para Bogotá)
                  </label>
                  <select
                    className="w-full p-2 border rounded"
                    value={newHospital.locality_id}
                    onChange={(e) => setNewHospital({...newHospital, locality_id: e.target.value})}
                  >
                    <option value="">Seleccione una localidad (opcional)</option>
                    {localities.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Latitud *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newHospital.lat}
                  onChange={(e) => setNewHospital({...newHospital, lat: e.target.value})}
                  placeholder="Ej: 4.710989"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Longitud *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newHospital.lng}
                  onChange={(e) => setNewHospital({...newHospital, lng: e.target.value})}
                  placeholder="Ej: -74.072092"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Número de Camas
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={newHospital.beds}
                  onChange={(e) => setNewHospital({...newHospital, beds: e.target.value})}
                  placeholder="Ej: 250"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nivel de Servicio
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={newHospital.service_level}
                  onChange={(e) => setNewHospital({...newHospital, service_level: e.target.value})}
                >
                  <option value="">Seleccione...</option>
                  <option value="1">Nivel 1</option>
                  <option value="2">Nivel 2</option>
                  <option value="3">Nivel 3</option>
                  <option value="4">Nivel 4</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newHospital.active}
                    onChange={(e) => setNewHospital({...newHospital, active: e.target.checked})}
                  />
                  <span className="text-sm font-medium">Hospital activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewHospital({
                    name: '',
                    code: '',
                    municipality_id: '',
                    department_id: '',
                    locality_id: '',
                    lat: '',
                    lng: '',
                    beds: '',
                    service_level: '',
                    active: true
                  })
                  setMunicipalities([])
                  setLocalities([])
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddHospital}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Agregando...' : 'Agregar Hospital'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProtectedRoute>
  )
}