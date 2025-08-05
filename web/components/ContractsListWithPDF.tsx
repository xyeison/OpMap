'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ContractEditModal from './ContractEditModal'

interface Contract {
  id: string
  hospital_id: string
  contract_number: string
  contract_type: string
  contract_value: number
  start_date: string
  end_date: string
  description?: string
  active: boolean
  created_at: string
  pdf_url?: string
  pdf_filename?: string
  pdf_uploaded_at?: string
}

interface ContractsListWithPDFProps {
  hospitalId: string
  onClose: () => void
}

export default function ContractsListWithPDF({ hospitalId, onClose }: ContractsListWithPDFProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const [newContract, setNewContract] = useState({
    contract_number: '',
    contract_type: 'capita',
    contract_value: '',
    start_date: '',
    end_date: '',
    description: '',
    active: true
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  useEffect(() => {
    loadContracts()
  }, [hospitalId])

  const loadContracts = async () => {
    const { data, error } = await supabase
      .from('hospital_contracts')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (data) setContracts(data)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!newContract.contract_number || !newContract.contract_value || !newContract.start_date || !newContract.end_date) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    const userId = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('opmap_user') || '{}').id
      : null

    try {
      // Calcular duration_months a partir de las fechas
      const startDate = new Date(newContract.start_date)
      const endDate = new Date(newContract.end_date)
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                        (endDate.getMonth() - startDate.getMonth())
      const durationMonths = Math.max(1, Math.round(monthsDiff))

      // Primero crear el contrato
      // Primero obtener el usuario actual de Supabase
      const { data: { user } } = await supabase.auth.getUser()
      
      // Si no hay usuario autenticado, obtener un usuario por defecto
      let createdBy = user?.id || userId
      
      if (!createdBy) {
        // Intentar obtener el ID del usuario admin por defecto
        const { data: adminUser } = await supabase
          .from('users')
          .select('id')
          .or('email.eq.admin@opmap.com,role.eq.admin')
          .limit(1)
          .single()
        
        createdBy = adminUser?.id
      }
      
      const { data, error } = await supabase
        .from('hospital_contracts')
        .insert({
          hospital_id: hospitalId,
          contract_number: newContract.contract_number,
          contract_type: newContract.contract_type,
          contract_value: parseFloat(newContract.contract_value),
          start_date: newContract.start_date,
          end_date: newContract.end_date,
          duration_months: durationMonths,
          current_provider: 'Proveedor',
          description: newContract.description || null,
          active: newContract.active,
          created_by: createdBy // Sin || null porque necesita un valor
        })
        .select()
        .single()

      if (error) {
        console.error('Error detallado al agregar contrato:', error)
        console.error('Datos enviados:', {
          hospital_id: hospitalId,
          contract_number: newContract.contract_number,
          contract_type: newContract.contract_type,
          contract_value: parseFloat(newContract.contract_value),
          start_date: newContract.start_date,
          end_date: newContract.end_date,
          duration_months: durationMonths,
          current_provider: 'Proveedor',
          description: newContract.description || null,
          active: newContract.active,
          created_by: user?.id || userId || null
        })
        alert(`Error al agregar contrato: ${error.message}\n\nCódigo: ${error.code}\nDetalles: ${error.details}\nHint: ${error.hint}`)
        return
      }

      // Si hay un PDF, subirlo
      if (pdfFile && data) {
        await uploadPdf(data.id, pdfFile)
      }

      // Limpiar formulario
      setNewContract({
        contract_number: '',
        contract_type: 'capita',
        contract_value: '',
        start_date: '',
        end_date: '',
        description: '',
        active: true
      })
      setPdfFile(null)
      setShowAddForm(false)
      loadContracts()
      alert('Contrato agregado exitosamente')
    } catch (err) {
      console.error('Error inesperado:', err)
      alert('Error inesperado al agregar contrato')
    }
  }

  const uploadPdf = async (contractId: string, file: File) => {
    setUploadingPdf(contractId)
    
    try {
      // Primero verificar si el bucket existe
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      
      if (bucketsError) {
        console.error('Error al listar buckets:', bucketsError)
        alert('Error: No se puede acceder al sistema de storage. Contacte al administrador.')
        return
      }

      const contractsBucket = buckets?.find(b => b.id === 'contracts' || b.name === 'contracts')
      
      if (!contractsBucket) {
        alert('Error: El bucket "contracts" no existe.\n\nPor favor, solicite al administrador que:\n1. Vaya a Storage en Supabase\n2. Cree un nuevo bucket llamado "contracts"\n3. Configure las políticas de acceso')
        return
      }

      // Generar un nombre único para el archivo
      const timestamp = new Date().getTime()
      const filename = `${contractId}/${timestamp}_${file.name}`

      // Subir el archivo a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filename, file, {
          contentType: 'application/pdf',
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error('Error detallado al subir PDF:', uploadError)
        let errorMessage = 'Error al subir el PDF'
        
        if (uploadError.message) {
          errorMessage += ': ' + uploadError.message
        }
        
        if (uploadError.statusCode === 400) {
          errorMessage += '\n\nError 400 puede indicar:\n- El bucket no acepta archivos PDF\n- Problema con el nombre del archivo\n- Políticas de acceso incorrectas'
        } else if (uploadError.statusCode === 403) {
          errorMessage += '\n\nError 403: Sin permisos para subir archivos'
        }
        
        alert(errorMessage)
        return
      }

      // Obtener la URL pública del archivo
      const { data: urlData } = supabase.storage
        .from('contracts')
        .getPublicUrl(filename)

      // Actualizar el registro del contrato con la información del PDF
      const { error: updateError } = await supabase
        .from('hospital_contracts')
        .update({
          pdf_url: urlData.publicUrl,
          pdf_filename: file.name,
          pdf_uploaded_at: new Date().toISOString()
        })
        .eq('id', contractId)

      if (updateError) {
        console.error('Error al actualizar contrato con PDF:', updateError)
        alert('Error al asociar el PDF con el contrato')
        return
      }

      alert('PDF subido exitosamente')
      loadContracts()
    } catch (err) {
      console.error('Error inesperado al subir PDF:', err)
      alert('Error inesperado al subir el PDF')
    } finally {
      setUploadingPdf(null)
    }
  }

  const downloadPdf = async (contract: Contract) => {
    if (!contract.pdf_url) return

    setDownloadingPdf(contract.id)
    
    try {
      // Descargar el archivo
      const response = await fetch(contract.pdf_url)
      const blob = await response.blob()
      
      // Crear un enlace temporal para descargar
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = contract.pdf_filename || `contrato_${contract.contract_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Error al descargar PDF:', err)
      alert('Error al descargar el PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const deletePdf = async (contractId: string, pdfUrl: string) => {
    if (!confirm('¿Está seguro de eliminar el PDF del contrato?')) return

    try {
      // Extraer el path del archivo de la URL
      const urlParts = pdfUrl.split('/storage/v1/object/public/contracts/')
      if (urlParts.length < 2) {
        alert('Error al obtener la ruta del archivo')
        return
      }
      const filePath = urlParts[1]

      // Eliminar el archivo de Storage
      const { error: deleteError } = await supabase.storage
        .from('contracts')
        .remove([filePath])

      if (deleteError) {
        console.error('Error al eliminar PDF:', deleteError)
        alert('Error al eliminar el PDF')
        return
      }

      // Actualizar el registro del contrato
      const { error: updateError } = await supabase
        .from('hospital_contracts')
        .update({
          pdf_url: null,
          pdf_filename: null,
          pdf_uploaded_at: null
        })
        .eq('id', contractId)

      if (updateError) {
        console.error('Error al actualizar contrato:', updateError)
        alert('Error al actualizar el contrato')
        return
      }

      alert('PDF eliminado exitosamente')
      loadContracts()
    } catch (err) {
      console.error('Error inesperado al eliminar PDF:', err)
      alert('Error inesperado al eliminar el PDF')
    }
  }

  const toggleActive = async (contractId: string, currentActive: boolean) => {
    await supabase
      .from('hospital_contracts')
      .update({ active: !currentActive })
      .eq('id', contractId)
    
    loadContracts()
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
    return new Date(dateString).toLocaleDateString('es-CO')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Contratos del Hospital</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Agregar Contrato
          </button>
        )}

        {showAddForm && (
          <div className="bg-gray-50 p-4 rounded mb-4">
            <h4 className="font-semibold mb-3">Nuevo Contrato</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Número de Contrato *
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={newContract.contract_number}
                  onChange={(e) => setNewContract({...newContract, contract_number: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tipo de Contrato *
                </label>
                <select
                  className="w-full p-2 border rounded"
                  value={newContract.contract_type}
                  onChange={(e) => setNewContract({...newContract, contract_type: e.target.value})}
                >
                  <option value="capita">Cápita</option>
                  <option value="evento">Evento</option>
                  <option value="pgp">PGP</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Valor del contrato *
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={newContract.contract_value}
                  onChange={(e) => setNewContract({...newContract, contract_value: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha inicio *
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={newContract.start_date}
                  onChange={(e) => setNewContract({...newContract, start_date: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Fecha fin *
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded"
                  value={newContract.end_date}
                  onChange={(e) => setNewContract({...newContract, end_date: e.target.value})}
                  min={newContract.start_date}
                />
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newContract.active}
                    onChange={(e) => setNewContract({...newContract, active: e.target.checked})}
                  />
                  <span className="text-sm font-medium">Contrato activo</span>
                </label>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Descripción de la oportunidad
              </label>
              <textarea
                className="w-full p-2 border rounded"
                rows={4}
                placeholder="Describa los detalles de la oportunidad..."
                value={newContract.description}
                onChange={(e) => setNewContract({...newContract, description: e.target.value})}
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Documento PDF del Contrato
              </label>
              <input
                type="file"
                accept=".pdf"
                className="w-full p-2 border rounded"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              />
              {pdfFile && (
                <p className="text-sm text-gray-600 mt-1">
                  Archivo seleccionado: {pdfFile.name}
                </p>
              )}
            </div>
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setPdfFile(null)
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p>Cargando contratos...</p>
        ) : contracts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay contratos registrados</p>
        ) : (
          <div className="space-y-3">
            {contracts.map((contract) => (
              <div key={contract.id} className={`border rounded p-4 ${!contract.active ? 'bg-gray-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{contract.contract_number}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        contract.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contract.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {contract.contract_type === 'capita' ? 'Cápita' : 
                         contract.contract_type === 'evento' ? 'Evento' : 'PGP'}
                      </span>
                      {contract.pdf_url && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                          📄 PDF
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Valor:</span>
                        <span className="ml-2 font-medium">
                          {formatCurrency(contract.contract_value)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Inicio:</span>
                        <span className="ml-2">{formatDate(contract.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Fin:</span>
                        <span className="ml-2">{formatDate(contract.end_date)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duración:</span>
                        <span className="ml-2">
                          {Math.round((new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses
                        </span>
                      </div>
                    </div>
                    {contract.description && (
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Descripción:</span>
                        <p className="text-gray-800 mt-1">{contract.description}</p>
                      </div>
                    )}
                    {contract.pdf_url && (
                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Documento PDF:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-800">{contract.pdf_filename}</span>
                          {contract.pdf_uploaded_at && (
                            <span className="text-xs text-gray-500">
                              (subido el {formatDate(contract.pdf_uploaded_at)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {contract.pdf_url ? (
                      <>
                        <button
                          onClick={() => downloadPdf(contract)}
                          disabled={downloadingPdf === contract.id}
                          className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          {downloadingPdf === contract.id ? 'Descargando...' : 'Descargar PDF'}
                        </button>
                        <button
                          onClick={() => deletePdf(contract.id, contract.pdf_url!)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Eliminar PDF
                        </button>
                      </>
                    ) : (
                      <label className="text-blue-600 hover:text-blue-800 cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              await uploadPdf(contract.id, file)
                            }
                          }}
                          disabled={uploadingPdf === contract.id}
                        />
                        {uploadingPdf === contract.id ? 'Subiendo...' : 'Subir PDF'}
                      </label>
                    )}
                    <button
                      onClick={() => setEditingContract(contract)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(contract.id, contract.active)}
                      className={contract.active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}
                    >
                      {contract.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingContract && (
        <ContractEditModal
          contract={editingContract}
          onClose={() => setEditingContract(null)}
          onSave={() => {
            setEditingContract(null)
            loadContracts()
          }}
        />
      )}
    </div>
  )
}