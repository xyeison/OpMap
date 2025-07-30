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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalVisits: 0,
    effectiveVisits: 0,
    inPersonVisits: 0,
    virtualVisits: 0
  })

  useEffect(() => {
    loadImportHistory()
    loadStats()
  }, [])

  const loadImportHistory = async () => {
    try {
      const { data } = await supabase
        .from('visit_imports')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(10)

      if (data) {
        setImportHistory(data)
      }
    } catch (error) {
      console.error('Error loading import history:', error)
    }
  }

  const loadStats = async () => {
    try {
      const { data } = await supabase
        .from('visits')
        .select('visit_type, contact_type')
        .is('deleted_at', null)

      if (data) {
        setStats({
          totalVisits: data.length,
          effectiveVisits: data.filter(v => v.visit_type === 'Visita efectiva').length,
          inPersonVisits: data.filter(v => v.contact_type === 'Visita presencial').length,
          virtualVisits: data.filter(v => v.contact_type === 'Visita virtual').length
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
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
    if (!file) return

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
      const importBatch = crypto.randomUUID()

      // Obtener KAMs de la base de datos
      const { data: kams } = await supabase
        .from('kams')
        .select('id, name')
        .eq('active', true)

      // Función para normalizar acentos
      const normalizeAccents = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      }

      // Crear mapa tanto por nombre como por ID
      const kamMapByName = new Map(kams?.map(k => [k.name.toLowerCase(), k.id]) || [])
      const kamMapByNameNormalized = new Map(kams?.map(k => [normalizeAccents(k.name.toLowerCase()), k.id]) || [])
      const kamMapById = new Map(kams?.map(k => [k.id.toLowerCase(), k.id]) || [])

      jsonData.forEach((row: any, index: number) => {
        const rowNum = index + 2 // +2 porque Excel empieza en 1 y tiene headers

        // Mapear nombres de columnas del formato real
        const kamInput = row.Representante || row.kam_id || row.kam || row.kam_name
        const tipoVisita = row['Tipo de visitas'] || row.tipo_visita
        const tipoContacto = row['Tipo de contacto'] || row.tipo_contacto
        const latitud = row.Latitud || row.latitud
        const longitud = row.Longitud || row.longitud
        const fechaVisita = row['Fecha de la visita'] || row.fecha_reporte || row.fecha_visita

        // Validar campos requeridos
        if (!kamInput) {
          errors.push(`Fila ${rowNum}: Falta el KAM (use formato 'Kam Barranquilla', 'Kam Cali', etc.)`)
          return
        }

        // Procesar el input del KAM
        let processedInput = kamInput.trim().toLowerCase()
        
        // Si viene como "Kam Barranquilla" o "KAM Barranquilla", extraer solo "barranquilla"
        if (processedInput.startsWith('kam ')) {
          processedInput = processedInput.substring(4) // Quitar "kam "
        }
        
        // Normalizar el input
        const processedInputNormalized = normalizeAccents(processedInput)
        
        // Buscar KAM por ID
        let kamId = kamMapById.get(processedInput) || kamMapById.get(processedInputNormalized)
        let kamName = kamInput
        
        if (!kamId) {
          // Si no se encontró por ID, buscar por nombre completo
          kamId = kamMapByName.get(processedInput) || kamMapByNameNormalized.get(processedInputNormalized)
        }
        
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

        // Validar y procesar fecha
        let visitDate: Date
        try {
          // Intentar parsear diferentes formatos de fecha
          if (fechaVisita) {
            // Si es string con formato "23 Ene 2025 3:58:35"
            if (typeof fechaVisita === 'string' && fechaVisita.includes(' ')) {
              // Mapear nombres de meses en español
              const monthMap: { [key: string]: string } = {
                'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'
              }
              
              const parts = fechaVisita.split(' ')
              if (parts.length >= 3) {
                const day = parts[0].padStart(2, '0')
                const month = monthMap[parts[1]] || parts[1]
                const year = parts[2]
                visitDate = new Date(`${year}-${month}-${day}`)
              } else {
                visitDate = new Date(fechaVisita)
              }
            } else {
              visitDate = new Date(fechaVisita)
            }
            
            if (isNaN(visitDate.getTime())) {
              throw new Error('Fecha inválida')
            }
          } else {
            throw new Error('Fecha vacía')
          }
        } catch {
          errors.push(`Fila ${rowNum}: Fecha inválida '${fechaVisita}'`)
          return
        }

        validVisits.push({
          kam_id: kamId,
          kam_name: kamName,  // Usar el nombre correcto del KAM
          visit_type: tipoVisita,
          contact_type: tipoContacto,
          lat: lat,
          lng: lng,
          visit_date: visitDate.toISOString().split('T')[0],
          hospital_name: null,  // Simplificado - no se requiere
          observations: null,   // Simplificado - no se requiere
          import_batch: importBatch
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
          filename: file.name,
          importBatch
        })
      })

      const result = await response.json()

      if (response.ok) {
        setImportSuccess(`Importación exitosa: ${result.successful} visitas procesadas`)
        loadImportHistory()
        loadStats()
        setFile(null)
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
      const response = await fetch(`/api/visits/import/${importBatch}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadImportHistory()
        loadStats()
      }
    } catch (error) {
      console.error('Error deleting import:', error)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Representante': 'Kam Barranquilla',
        'Tipo de visitas': 'Visita efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 10.963889,
        'Longitud': -74.796387,
        'Fecha de la visita': '15 Ene 2024 09:00:00'
      },
      {
        'Representante': 'Kam Cali',
        'Tipo de visitas': 'Visita extra',
        'Tipo de contacto': 'Visita virtual',
        'Latitud': 3.451647,
        'Longitud': -76.531985,
        'Fecha de la visita': '16 Ene 2024 14:30:00'
      },
      {
        'Representante': 'Kam Medellin',
        'Tipo de visitas': 'Visita no efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 6.244203,
        'Longitud': -75.581211,
        'Fecha de la visita': '17 Ene 2024 11:15:00'
      },
      {
        'Representante': 'Kam Chapinero',
        'Tipo de visitas': 'Visita efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 4.645530,
        'Longitud': -74.064644,
        'Fecha de la visita': '18 Ene 2024 16:45:00'
      },
      {
        'Representante': 'Kam Engativá',
        'Tipo de visitas': 'Visita efectiva',
        'Tipo de contacto': 'Visita presencial',
        'Latitud': 4.703464,
        'Longitud': -74.113736,
        'Fecha de la visita': '19 Ene 2024 10:00:00'
      }
    ]

    // Crear archivo Excel
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Visitas')
    XLSX.writeFile(wb, 'plantilla_visitas.xlsx')
  }

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="visits:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Acceso denegado:</strong> No tienes permisos para gestionar visitas.
            </div>
          </div>
        }
      >
        <div className="container mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Gestión de Visitas</h1>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Total Visitas</p>
              <p className="text-2xl font-bold">{stats.totalVisits}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Visitas Efectivas</p>
              <p className="text-2xl font-bold text-green-600">{stats.effectiveVisits}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Visitas Presenciales</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inPersonVisits}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-gray-600 text-sm">Visitas Virtuales</p>
              <p className="text-2xl font-bold text-purple-600">{stats.virtualVisits}</p>
            </div>
          </div>

          {/* Sección de importación */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Importar Visitas</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mes
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleString('es', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Año
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2023, 2024, 2025].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  &nbsp;
                </label>
                <button
                  onClick={downloadTemplate}
                  className="w-full px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
                >
                  Descargar Plantilla
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo Excel
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Archivo seleccionado: {file.name}
                </p>
              )}
            </div>

            {/* Mensajes de error */}
            {importErrors.length > 0 && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p className="font-bold mb-2">Errores encontrados:</p>
                <ul className="list-disc pl-5">
                  {importErrors.slice(0, 10).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {importErrors.length > 10 && (
                    <li className="text-sm">... y {importErrors.length - 10} errores más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Mensaje de éxito */}
            {importSuccess && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {importSuccess}
              </div>
            )}

            <button
              onClick={processExcel}
              disabled={!file || loading}
              className={`px-4 py-2 rounded-lg ${
                !file || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Procesando...' : 'Importar Visitas'}
            </button>
          </div>

          {/* Historial de importaciones */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Historial de Importaciones</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Archivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registros
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Importación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importHistory.map((imp) => (
                    <tr key={imp.id} className={imp.deleted_at ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {imp.filename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(2000, imp.month - 1, 1).toLocaleString('es', { month: 'long' })} {imp.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>
                          <span className="text-green-600">{imp.successful_records} exitosos</span>
                          {imp.failed_records > 0 && (
                            <span className="text-red-600 ml-2">/ {imp.failed_records} fallidos</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(imp.imported_at).toLocaleString('es')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!imp.deleted_at && (
                          <button
                            onClick={() => deleteImport(imp.import_batch)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importHistory.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay importaciones registradas
                </div>
              )}
            </div>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}