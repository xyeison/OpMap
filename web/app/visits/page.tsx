'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface ImportHistory {
  id: string
  import_batch: string
  filename: string
  month: number
  year: number
  total_records: number
  successful_records: number
  failed_records: number
  imported_at: string
  deleted_at: string | null
}

export default function VisitsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [showImportSection, setShowImportSection] = useState(false)
  const [stats, setStats] = useState({
    totalVisits: 0,
    effectiveVisits: 0,
    inPersonVisits: 0,
    virtualVisits: 0,
    loadingStats: true
  })

  useEffect(() => {
    loadImportHistory()
    loadStats()
  }, [])

  const loadImportHistory = async () => {
    try {
      console.log('Cargando historial de importaciones...')
      const response = await fetch('/api/visits/imports')
      
      if (!response.ok) {
        const error = await response.json()
        console.error('Error al cargar historial:', error)
        return
      }

      const data = await response.json()
      console.log('Historial cargado:', data.length, 'registros')
      setImportHistory(data || [])
    } catch (error) {
      console.error('Error loading import history:', error)
      setImportHistory([])
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch('/api/visits/stats')
      
      if (response.ok) {
        const data = await response.json()
        setStats({
          ...data,
          loadingStats: false
        })
      } else {
        console.error('Error loading stats:', await response.json())
        setStats(prev => ({ ...prev, loadingStats: false }))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats(prev => ({ ...prev, loadingStats: false }))
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0]
    if (uploadedFile) {
      setFile(uploadedFile)
      setImportErrors([])
      setImportSuccess(null)
    }
  }

  const processExcel = async () => {
    if (!file) {
      setImportErrors(['Por favor seleccione un archivo'])
      return
    }

    if (!selectedMonth || !selectedYear) {
      setImportErrors(['Por favor seleccione el mes y año de las visitas'])
      return
    }

    setLoading(true)
    setImportErrors([])
    setImportSuccess(null)

    try {
      // Leer el archivo Excel
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { 
        type: 'array',
        raw: false,
        dateNF: 'yyyy-mm-dd',
        cellDates: true
      })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        dateNF: 'yyyy-mm-dd'
      })

      // Validar y preparar datos
      const errors: string[] = []
      const validVisits: any[] = []

      // Obtener KAMs de la base de datos
      const { data: kams, error: kamsError } = await supabase
        .from('kams')
        .select('id, name')
        .eq('active', true)
      
      if (kamsError) {
        console.error('Error obteniendo KAMs:', kamsError)
        setImportErrors(['Error al obtener la lista de KAMs'])
        setLoading(false)
        return
      }

      // Función para normalizar acentos
      const normalizeAccents = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      }

      // Crear múltiples mapas para búsqueda flexible
      const kamLookupMap = new Map<string, string>()
      
      if (kams) {
        for (const kam of kams) {
          // Agregar por ID exacto
          kamLookupMap.set(kam.id.toLowerCase(), kam.id)
          
          // Agregar por nombre completo
          kamLookupMap.set(kam.name.toLowerCase(), kam.id)
          
          // Agregar por nombre sin acentos
          kamLookupMap.set(normalizeAccents(kam.name.toLowerCase()), kam.id)
          
          // Si el nombre empieza con "KAM ", agregar también sin el prefijo
          if (kam.name.toLowerCase().startsWith('kam ')) {
            const withoutPrefix = kam.name.toLowerCase().substring(4)
            kamLookupMap.set(withoutPrefix, kam.id)
            kamLookupMap.set(normalizeAccents(withoutPrefix), kam.id)
          }
        }
      }

      jsonData.forEach((row: any, index: number) => {
        const rowNum = index + 2 // +2 porque Excel empieza en 1 y tiene headers

        // Mapear nombres de columnas del formato real
        const kamInput = row.Representante || row.kam_id || row.kam || row.kam_name
        const tipoVisita = row['Tipo de visitas'] || row.tipo_visita
        const tipoContacto = row['Tipo de contacto'] || row.tipo_contacto
        const latitud = row.Latitud || row.latitud
        const longitud = row.Longitud || row.longitud

        // Validar campos requeridos
        if (!kamInput) {
          errors.push(`Fila ${rowNum}: Falta el KAM (use formato 'Kam Barranquilla', 'Kam Cali', etc.)`)
          return
        }

        // Procesar el input del KAM
        const kamInputLower = kamInput.trim().toLowerCase()
        
        // Intentar múltiples formas de búsqueda
        let kamId = null
        
        // 1. Buscar input completo
        kamId = kamLookupMap.get(kamInputLower)
        
        // 2. Si empieza con "kam ", buscar sin el prefijo
        if (!kamId && kamInputLower.startsWith('kam ')) {
          const withoutPrefix = kamInputLower.substring(4)
          kamId = kamLookupMap.get(withoutPrefix)
        }
        
        // 3. Buscar versión sin acentos
        if (!kamId) {
          const normalized = normalizeAccents(kamInputLower)
          kamId = kamLookupMap.get(normalized)
          
          // 4. Si tiene "kam ", buscar sin prefijo y sin acentos
          if (!kamId && normalized.startsWith('kam ')) {
            kamId = kamLookupMap.get(normalized.substring(4))
          }
        }
        
        let kamName = kamInput
        
        if (kamId) {
          // Si se encontró el KAM, obtener su nombre real
          const kamData = kams?.find(k => k.id === kamId)
          kamName = kamData?.name || kamInput
        } else {
          errors.push(`Fila ${rowNum}: KAM '${kamInput}' no encontrado (use formato 'Kam Barranquilla' o 'Kam Cali')`)
          return
        }

        // Validar tipo de visita
        const validVisitTypes = ['Visita efectiva', 'Visita extra', 'Visita no efectiva']
        if (!tipoVisita || !validVisitTypes.includes(tipoVisita)) {
          errors.push(`Fila ${rowNum}: Tipo de visita inválido '${tipoVisita}'`)
          return
        }

        // Validar tipo de contacto
        const validContactTypes = ['Visita presencial', 'Visita virtual']
        if (!tipoContacto || !validContactTypes.includes(tipoContacto)) {
          errors.push(`Fila ${rowNum}: Tipo de contacto inválido '${tipoContacto}'`)
          return
        }

        // Validar coordenadas
        const lat = parseFloat(latitud)
        const lng = parseFloat(longitud)
        if (isNaN(lat) || lat < -90 || lat > 90) {
          errors.push(`Fila ${rowNum}: Latitud inválida '${latitud}'`)
          return
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
          errors.push(`Fila ${rowNum}: Longitud inválida '${longitud}'`)
          return
        }

        // Generar fecha aleatoria dentro del mes/año seleccionado
        // Esto distribuye las visitas a lo largo del mes para mejor visualización
        if (!selectedYear || !selectedMonth) {
          errors.push(`Fila ${rowNum}: No se ha seleccionado mes/año para la importación`)
          return
        }
        const randomDay = Math.floor(Math.random() * 28) + 1 // Días 1-28 para evitar problemas con febrero
        const visitDate = new Date(selectedYear, selectedMonth - 1, randomDay)

        validVisits.push({
          kam_id: kamId,
          kam_name: kamName,
          visit_type: tipoVisita,
          contact_type: tipoContacto,
          lat: lat,
          lng: lng,
          visit_date: visitDate.toISOString().split('T')[0]
        })
      })

      if (errors.length > 0) {
        setImportErrors(errors)
        if (validVisits.length === 0) {
          setLoading(false)
          return
        }
      }

      // Llamar a la API para procesar las visitas
      const response = await fetch('/api/visits/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visits: validVisits,
          month: selectedMonth,
          year: selectedYear,
          filename: file.name
        })
      })

      const result = await response.json()

      if (response.ok) {
        setImportSuccess(`✅ Importación exitosa: ${result.successful} visitas procesadas`)
        loadImportHistory()
        loadStats()
        setFile(null)
        setSelectedMonth(null)
        setSelectedYear(null)
        setShowImportSection(false)
        // Resetear el input de archivo
        const fileInput = document.getElementById('file-upload') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        setImportErrors([result.error || 'Error al procesar las visitas'])
      }
    } catch (error) {
      console.error('Error processing file:', error)
      setImportErrors(['Error al procesar el archivo Excel'])
    } finally {
      setLoading(false)
    }
  }

  const deleteImport = async (importBatch: string) => {
    if (!confirm('¿Estás seguro de eliminar todas las visitas de esta importación?')) {
      return
    }

    try {
      const response = await fetch(`/api/visits/imports?batch=${importBatch}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadImportHistory()
        loadStats()
        alert('Importación eliminada exitosamente')
      } else {
        const error = await response.json()
        alert('Error al eliminar: ' + (error.error || 'Error desconocido'))
      }
    } catch (error) {
      console.error('Error deleting import:', error)
      alert('Error al eliminar la importación')
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Representante': 'Kam Barranquilla',
        'Tipo de visitas': 'Visita efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 10.963889,
        'Longitud': -74.796387
      },
      {
        'Representante': 'Kam Cali',
        'Tipo de visitas': 'Visita extra',
        'Tipo de contacto': 'Visita virtual',
        'Latitud': 3.451647,
        'Longitud': -76.531985
      },
      {
        'Representante': 'Kam Medellin',
        'Tipo de visitas': 'Visita no efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 6.244203,
        'Longitud': -75.581211
      }
    ]

    // Crear archivo Excel
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Visitas')
    XLSX.writeFile(wb, 'plantilla_visitas_opmap.xlsx')
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num)
  }

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="visits:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                  <strong className="font-semibold">Acceso denegado</strong>
                  <p className="text-sm mt-1">No tienes permisos para gestionar visitas.</p>
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
                <h1 className="text-3xl lg:text-4xl font-bold text-white">Gestión de Visitas</h1>
                <p className="text-gray-300 mt-2">Control y seguimiento de visitas comerciales</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={downloadTemplate}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Plantilla Excel
                </button>
                <button
                  onClick={() => setShowImportSection(!showImportSection)}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  Importar Visitas
                </button>
              </div>
            </div>
          </div>

          {/* Estadísticas Mejoradas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Visitas</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.totalVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.effectiveVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Efectivas</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.effectiveVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.inPersonVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Presenciales</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.inPersonVisits)
                )}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </div>
                {stats.totalVisits > 0 && (
                  <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                    {getPercentage(stats.virtualVisits, stats.totalVisits)}%
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-600">Visitas Virtuales</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.loadingStats ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  formatNumber(stats.virtualVisits)
                )}
              </p>
            </div>
          </div>

          {/* Sección de importación mejorada */}
          {showImportSection && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 animate-slideDown">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Importar Visitas desde Excel</h2>
                <button
                  onClick={() => setShowImportSection(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Instrucciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Instrucciones de importación:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Descarga la plantilla Excel con el formato correcto</li>
                      <li>Completa los datos de las visitas (Representante, Tipo, Coordenadas, Fecha)</li>
                      <li>Selecciona el período (mes y año) de las visitas a importar</li>
                      <li>Sube el archivo Excel y haz clic en "Importar"</li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Mes de las visitas
                    </span>
                  </label>
                  <select
                    value={selectedMonth || ''}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                  >
                    <option value="">Seleccione el mes...</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleString('es', { month: 'long' }).charAt(0).toUpperCase() + 
                         new Date(2000, i, 1).toLocaleString('es', { month: 'long' }).slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Año de las visitas
                    </span>
                  </label>
                  <select
                    value={selectedYear || ''}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                  >
                    <option value="">Seleccione el año...</option>
                    {[2023, 2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Archivo Excel
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors bg-gray-50 hover:bg-gray-100"
                  >
                    {file ? (
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Haz clic para cambiar el archivo</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900">Haz clic para seleccionar un archivo</p>
                        <p className="text-xs text-gray-500 mt-1">o arrastra y suelta aquí</p>
                        <p className="text-xs text-gray-400 mt-2">XLSX, XLS o CSV (máx. 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Mensajes de error */}
              {importErrors.length > 0 && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-semibold mb-2">Errores encontrados:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {importErrors.slice(0, 5).map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                        {importErrors.length > 5 && (
                          <li className="text-sm font-medium">... y {importErrors.length - 5} errores más</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensaje de éxito */}
              {importSuccess && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-medium">{importSuccess}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={processExcel}
                  disabled={!file || loading || !selectedMonth || !selectedYear}
                  className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    !file || loading || !selectedMonth || !selectedYear
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-900 hover:to-black transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Importar Visitas
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Historial de importaciones mejorado */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Historial de Importaciones</h2>
              <p className="text-sm text-gray-600 mt-1">Últimas importaciones realizadas</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Archivo</span>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Período</span>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Registros</span>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Fecha Importación</span>
                    </th>
                    <th className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {importHistory.map((imp) => (
                    <tr key={imp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-900 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {imp.filename}
                            </div>
                            <div className="text-xs text-gray-500">
                              Batch: {imp.import_batch.substring(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-800">
                          {new Date(2000, imp.month - 1, 1).toLocaleString('es', { month: 'long' }).charAt(0).toUpperCase() + 
                           new Date(2000, imp.month - 1, 1).toLocaleString('es', { month: 'long' }).slice(1)} {imp.year}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-green-600">{imp.successful_records}</span>
                          <span className="text-xs text-gray-500">exitosos</span>
                          {imp.failed_records > 0 && (
                            <>
                              <span className="text-xs text-red-600 mt-1">{imp.failed_records} fallidos</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(imp.imported_at).toLocaleDateString('es')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(imp.imported_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => deleteImport(imp.import_batch)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all group"
                          title="Eliminar importación"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importHistory.length === 0 && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No hay importaciones</h3>
                  <p className="mt-1 text-sm text-gray-500">Comienza importando tu primer archivo de visitas.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .animate-slideDown {
            animation: slideDown 0.3s ease-out;
          }
        `}</style>
      </PermissionGuard>
    </ProtectedRoute>
  )
}