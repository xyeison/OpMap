'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/auth-helper'
import { useQuery } from '@tanstack/react-query'

interface Hospital {
  id: string
  name: string
  code: string
  lat: number
  lng: number
  municipality_name: string
  department_name: string
  locality_name?: string
}

interface KAM {
  id: string
  name: string
  lat: number
  lng: number
  area_id: string
  enable_level2: boolean
  max_travel_time: number
}

interface MissingRoute {
  hospital_id: string
  hospital_name: string
  hospital_location: string
  kam_id: string
  kam_name: string
  search_zones: string[]
  hospital_coords: { lat: number; lng: number }
  kam_coords: { lat: number; lng: number }
}

export default function RouteCalculator() {
  const [isLoading, setIsLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [missingRoutes, setMissingRoutes] = useState<MissingRoute[]>([])
  const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set())
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showFinalConfirm, setShowFinalConfirm] = useState(false)
  const [calculationProgress, setCalculationProgress] = useState(0)
  const [calculationStatus, setCalculationStatus] = useState('')
  const [results, setResults] = useState<any>(null)
  const [connectionTest, setConnectionTest] = useState<any>(null)

  // Test de conexión al montar el componente
  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch('/api/routes/test')
        const data = await response.json()
        console.log('RouteCalculator: Connection test:', data)
        setConnectionTest(data)
      } catch (error) {
        console.error('RouteCalculator: Connection test failed:', error)
      }
    }
    testConnection()
  }, [])

  // IDs de hospitales específicos para la prueba
  const testHospitalIds = [
    '0a014185-801f-40f0-9cee-8cd7706068df',
    '18bb319b-00f7-4e4b-99a8-edacecbb8b41',
    '1f720e20-d731-437e-897b-134de313519b',
    '38b7b8b8-bb6d-45e5-963a-328d710c61dc',
    '3aa8f43e-a3ed-467f-8d22-e2f721f6e598',
    '4be1cf19-30ad-4592-bd96-ad7ec6193988',
    '6e7ea424-3994-48a7-82b8-db873e5847e9',
    '6faa1bb8-017c-4c8b-a422-ffe09c0109bf',
    '73c43c4d-328b-4714-a028-b333cc957f8c',
    '8018788c-6a13-4710-97aa-fb03e9a7c0a4',
    '998c9305-61cb-4a43-b642-01dab3d7b42d',
    '9ecb17a9-944b-40f0-8e83-971ca215a5a7',
    'ad06741c-6bc2-46aa-9863-dc65e3022763',
    'b0e473d6-93d7-458e-a2ea-74bb4058a84b',
    'd1eb637b-2414-43c5-a796-d80e3da4f77e',
    'd749b48d-0c77-4182-8a9e-c78afbe0237a',
    'ea4675de-180f-4fc1-b8e3-ee2dcfa1ba55',
    'fb53e3f3-73b7-4066-b46e-1661d02b6c65'
  ]

  // Analizar rutas faltantes
  const analyzeMissingRoutes = async () => {
    setAnalyzing(true)
    setMissingRoutes([])
    
    try {
      // Siempre usar endpoint seguro con autenticación
      const headers = await getAuthHeaders()
      console.log('RouteCalculator: Analyzing missing routes...')
      
      const response = await fetch('/api/routes/analyze-missing-optimized', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          hospitalIds: null, // null = analizar TODOS los hospitales activos
          includeAll: true   // true = incluir todos según restricciones geográficas
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('RouteCalculator: Error response:', errorData)
        throw new Error(errorData.error || 'Error al analizar rutas faltantes')
      }

      const data = await response.json()
      setMissingRoutes(data.missingRoutes || [])
      
      // Seleccionar todas las rutas por defecto
      const allRouteKeys = data.missingRoutes?.map((r: MissingRoute) => 
        `${r.hospital_id}-${r.kam_id}`
      ) || []
      setSelectedRoutes(new Set(allRouteKeys))
      
    } catch (error) {
      console.error('RouteCalculator: Error analyzing routes:', error)
      alert(`Error al analizar rutas faltantes: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // Agrupar rutas por hospital
  const groupedRoutes = missingRoutes.reduce((acc, route) => {
    if (!acc[route.hospital_id]) {
      acc[route.hospital_id] = {
        hospital_name: route.hospital_name,
        hospital_location: route.hospital_location,
        hospital_coords: route.hospital_coords,
        kams: []
      }
    }
    acc[route.hospital_id].kams.push(route)
    return acc
  }, {} as Record<string, any>)

  // Toggle selección de ruta
  const toggleRoute = (hospitalId: string, kamId: string) => {
    const key = `${hospitalId}-${kamId}`
    const newSelected = new Set(selectedRoutes)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedRoutes(newSelected)
  }

  // Toggle selección de todas las rutas de un hospital
  const toggleHospital = (hospitalId: string) => {
    const hospitalRoutes = missingRoutes.filter(r => r.hospital_id === hospitalId)
    const allSelected = hospitalRoutes.every(r => 
      selectedRoutes.has(`${r.hospital_id}-${r.kam_id}`)
    )
    
    const newSelected = new Set(selectedRoutes)
    hospitalRoutes.forEach(route => {
      const key = `${route.hospital_id}-${route.kam_id}`
      if (allSelected) {
        newSelected.delete(key)
      } else {
        newSelected.add(key)
      }
    })
    setSelectedRoutes(newSelected)
  }

  // Calcular rutas seleccionadas
  const calculateSelectedRoutes = async () => {
    setShowFinalConfirm(false)
    setIsLoading(true)
    setCalculationProgress(0)
    setCalculationStatus('Iniciando cálculo de rutas...')
    setResults(null)

    try {
      // Preparar las rutas seleccionadas
      const routesToCalculate = missingRoutes.filter(r => 
        selectedRoutes.has(`${r.hospital_id}-${r.kam_id}`)
      )

      console.log(`RouteCalculator: Calculando ${routesToCalculate.length} rutas en lotes de 1000`)

      let allResults = {
        calculated: 0,
        failed: 0,
        saved: 0,
        details: [],
        errors: []
      }

      // Procesar en lotes de 1000
      const BATCH_SIZE = 1000
      let batchStart = 0
      
      while (batchStart < routesToCalculate.length) {
        const currentBatch = Math.floor(batchStart / BATCH_SIZE) + 1
        const totalBatches = Math.ceil(routesToCalculate.length / BATCH_SIZE)
        
        setCalculationStatus(`Procesando lote ${currentBatch} de ${totalBatches}...`)
        setCalculationProgress((batchStart / routesToCalculate.length) * 100)
        
        // Siempre usar endpoint seguro con autenticación
        const headers = await getAuthHeaders()
        console.log(`RouteCalculator: Calculando batch ${currentBatch}/${totalBatches}`)
        
        const response = await fetch('/api/routes/calculate-batch-secure', {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            routes: routesToCalculate,
            saveToDatabase: true,
            batchStart: batchStart
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error(`RouteCalculator: Error en batch ${currentBatch}:`, errorData)
          // Continuar con el siguiente lote aunque este falle
        } else {
          const data = await response.json()
          
          // Acumular resultados
          allResults.calculated += data.calculated || 0
          allResults.failed += data.failed || 0
          allResults.saved += data.saved || 0
          if (data.details) allResults.details.push(...data.details)
          if (data.errors) allResults.errors.push(...data.errors)
          
          console.log(`RouteCalculator: Batch ${currentBatch} completado - ${data.calculated} calculadas, ${data.saved} guardadas`)
          
          // Si hay más lotes, actualizar batchStart
          if (data.batch && data.batch.hasMore) {
            batchStart = data.batch.nextStart
          } else {
            break // No hay más lotes
          }
        }
      }

      setResults(allResults)
      setCalculationStatus(`¡Completado! ${allResults.calculated} rutas calculadas, ${allResults.saved} guardadas`)
      setCalculationProgress(100)
      
      // Limpiar selección después del cálculo exitoso
      setSelectedRoutes(new Set())
      setMissingRoutes([])
      
    } catch (error) {
      console.error('RouteCalculator: Error calculating routes:', error)
      setCalculationStatus('Error en el cálculo')
      alert(`Error al calcular las rutas: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Calcular costo estimado
  const estimatedCost = (selectedRoutes.size * 0.005).toFixed(2) // $0.005 por consulta

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 p-7 transform transition-all duration-300">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-black rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Calculador de Rutas con Google Maps
            </h2>
            <p className="text-sm text-gray-600">
              Detecta y calcula rutas faltantes usando Distance Matrix API
            </p>
          </div>
        </div>
        
        {/* Mostrar estado de conexión si hay problemas */}
        {connectionTest && !connectionTest.success && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error de conexión: {connectionTest.error}</span>
          </div>
        )}
        
        {connectionTest && connectionTest.success && !connectionTest.tests?.hasDistanceTable && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>La tabla hospital_kam_distances no existe. Ejecute el script SQL proporcionado.</span>
          </div>
        )}
      </div>

      {/* Botón de análisis */}
      {!missingRoutes.length && !analyzing && (
        <div>
          <button
            onClick={analyzeMissingRoutes}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-4 rounded-xl hover:from-gray-900 hover:to-black transition-all duration-200 font-medium transform hover:scale-[1.02] hover:shadow-lg flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Analizar Rutas Faltantes</span>
          </button>
        </div>
      )}

      {/* Analizando */}
      {analyzing && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="animate-spin h-8 w-8 text-gray-800" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <p className="text-gray-800 font-medium">Analizando rutas faltantes...</p>
          <p className="text-sm text-gray-500 mt-2">
            Verificando TODOS los hospitales activos según restricciones geográficas
          </p>
        </div>
      )}

      {/* Resultados del análisis */}
      {missingRoutes.length > 0 && !isLoading && (
        <div>
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Rutas Faltantes Detectadas
            </h3>
            <div className="text-sm text-amber-800 space-y-1">
              <p>• Hospitales con rutas faltantes: {Object.keys(groupedRoutes).length}</p>
              <p>• Total de rutas a calcular: {missingRoutes.length}</p>
              <p>• Rutas seleccionadas: {selectedRoutes.size}</p>
              <p>• Costo estimado: ${estimatedCost} USD</p>
            </div>
          </div>

          {/* Lista de hospitales y rutas faltantes */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg mb-4">
            {Object.entries(groupedRoutes).map(([hospitalId, data]) => {
              const hospitalRoutes = data.kams as MissingRoute[]
              const allSelected = hospitalRoutes.every(r => 
                selectedRoutes.has(`${r.hospital_id}-${r.kam_id}`)
              )
              
              return (
                <div key={hospitalId} className="border-b last:border-b-0">
                  <div className="p-3 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="flex items-start cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleHospital(hospitalId)}
                            className="mt-1 mr-2"
                          />
                          <div>
                            <p className="font-medium text-sm">{data.hospital_name}</p>
                            <p className="text-xs text-gray-600">{data.hospital_location}</p>
                            <p className="text-xs text-gray-500">
                              Coordenadas: {data.hospital_coords.lat.toFixed(6)}, {data.hospital_coords.lng.toFixed(6)}
                            </p>
                          </div>
                        </label>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {hospitalRoutes.length} KAMs
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-2 bg-white">
                    {hospitalRoutes.map(route => {
                      const isSelected = selectedRoutes.has(`${route.hospital_id}-${route.kam_id}`)
                      return (
                        <div key={route.kam_id} className="mb-2 last:mb-0 pl-6">
                          <label className="flex items-start cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRoute(route.hospital_id, route.kam_id)}
                              className="mt-0.5 mr-2"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                KAM: {route.kam_name}
                              </p>
                              <p className="text-gray-600">
                                Desde: {route.kam_coords.lat.toFixed(4)}, {route.kam_coords.lng.toFixed(4)}
                              </p>
                              <div className="mt-1">
                                <span className="text-gray-500">Zonas de búsqueda: </span>
                                <span className="text-gray-700">
                                  {route.search_zones.join(', ')}
                                </span>
                              </div>
                            </div>
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={selectedRoutes.size === 0}
              className={`flex-1 px-5 py-3 rounded-xl font-medium transition-all duration-200 transform flex items-center justify-center gap-2 ${
                selectedRoutes.size > 0
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-900 hover:to-black hover:scale-[1.02] hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Calcular {selectedRoutes.size} Rutas</span>
            </button>
            <button
              onClick={() => {
                setMissingRoutes([])
                setSelectedRoutes(new Set())
              }}
              className="px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Primera confirmación */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-slideUp">
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Confirmar Cálculo de Rutas</h3>
                  <p className="text-white/80 text-sm">Revise los detalles antes de continuar</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-sm font-medium text-gray-900">Resumen de la operación:</p>
                  <ul className="mt-2 text-sm text-gray-700 space-y-1">
                    <li>• Rutas a calcular: {selectedRoutes.size}</li>
                    <li>• Hospitales afectados: {
                      [...new Set(Array.from(selectedRoutes).map(key => key.split('-')[0]))].length
                    }</li>
                    <li>• Costo estimado: ${estimatedCost} USD</li>
                    <li>• Tiempo estimado: ~{Math.ceil(selectedRoutes.size / 10)} minutos</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Importante
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Esta operación consumirá créditos de Google Maps API. 
                    Los resultados se guardarán en la base de datos.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false)
                  setShowFinalConfirm(true)
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl hover:from-gray-900 hover:to-black transition-all font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segunda confirmación (final) */}
      {showFinalConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all animate-slideUp">
            {/* Header con gradiente rojo */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">¿Está seguro de continuar?</h3>
                  <p className="text-white/80 text-sm">Esta acción consumirá créditos de la API</p>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-gray-700">
                  Se realizarán <span className="font-bold text-red-600">{selectedRoutes.size}</span> consultas 
                  a Google Maps con un costo aproximado de <span className="font-bold">${estimatedCost} USD</span>.
                </p>
              </div>
              
              <p className="text-sm text-gray-500 text-center">
                Esta acción no se puede deshacer y consumirá créditos de la API.
              </p>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowFinalConfirm(false)}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={calculateSelectedRoutes}
                className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sí, calcular rutas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progreso del cálculo */}
      {isLoading && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Calculando rutas...</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-blue-700">{calculationStatus}</span>
              <span className="text-blue-900 font-medium">{calculationProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${calculationProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">✅ Cálculo Completado</h4>
          <div className="text-sm text-green-800 space-y-1">
            <p>• Rutas calculadas: {results.calculated || 0}</p>
            <p>• Rutas guardadas: {results.saved || 0}</p>
            <p>• Errores: {results.failed || results.errors?.length || 0}</p>
            {results.totalTime && (
              <p>• Tiempo total: {results.totalTime} segundos</p>
            )}
            {results.costEstimate && (
              <p>• Costo estimado: {results.costEstimate}</p>
            )}
          </div>
          {results.details && results.details.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-green-700 hover:text-green-900">
                Ver detalles
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs bg-white p-2 rounded border border-green-200">
                {results.details.map((detail: any, idx: number) => (
                  <div key={idx} className="mb-1">
                    {detail.hospital} → {detail.kam}: {detail.time} ({detail.distance})
                  </div>
                ))}
              </div>
            </details>
          )}
          {results.errors && results.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-red-700 hover:text-red-900">
                Ver errores ({results.errors.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto text-xs bg-white p-2 rounded border border-red-200">
                {results.errors.map((error: any, idx: number) => (
                  <div key={idx} className="mb-1 text-red-600">
                    {error.hospital} → {error.kam}: {error.error}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

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
    </div>
  )
}