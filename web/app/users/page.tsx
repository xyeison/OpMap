'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { getRoleTitle, type Role } from '@/lib/permissions'
import { tituloDePapeles, type PapelActivo } from '@/lib/empresas-reglas'
import type { EmpresaMovil } from '@/lib/reporte-visitas'
import ExecutiveAccountsPanel from '@/components/ExecutiveAccountsPanel'
import PapelesEditor, { PapelesNuevoUsuario, type LineaOpcion, type PapelEntradaEditor, type ZonaOpcion } from './PapelesEditor'

// Perfiles en el orden en que se eligen: los cuatro del negocio primero (dueño, 2026-10-29)
const ROLES_EN_ORDEN: Role[] = ['admin', 'commercial_director', 'line_leader', 'sales_manager', 'contract_manager', 'data_manager', 'hr', 'viewer', 'user']

const DESCRIPCION_PERFIL: Record<Role, string> = {
  admin: 'Todo: usuarios, configuración, asignaciones y cargas de datos.',
  commercial_director: 'Asigna Ejecutivos Comerciales a líneas y Zonas, ajusta la cobertura, traspasa y aprueba días libres.',
  line_leader: 'Consulta su línea en Zonas, el mapa, Ejecutivos e Inteligencia, sin asignar. Si también es Ejecutiva Comercial, reporta visitas en la app.',
  sales_manager: 'Consulta su Zona, el mapa y las IPS, y reporta sus visitas desde la app.',
  contract_manager: 'Administra los contratos y su documentación.',
  data_manager: 'Mantiene al día la información de IPS y Zonas e importa datos (REPS, ADRES).',
  hr: 'Gestiona los días libres y el calendario del equipo.',
  viewer: 'Solo lectura del mapa y de la información básica.',
  user: 'Acceso limitado de consulta.',
}

interface User {
  id: string
  email: string
  full_name: string
  role: Role
  active: boolean
  created_at: string
  // Papeles activos en todas sus empresas (vacío sin la migración 0960)
  papeles: PapelActivo[]
}

type PapelesNuevos = { ok: true; papeles: (PapelEntradaEditor & { empresa_id: string })[] } | { ok: false; error: string }
const SIN_PAPELES_NUEVOS: PapelesNuevos = { ok: false, error: 'Elige al menos un papel en alguna empresa' }

export default function UsersPage() {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: ''
  })
  const [papelesNuevos, setPapelesNuevos] = useState<PapelesNuevos>(SIN_PAPELES_NUEVOS)
  const [errorCrear, setErrorCrear] = useState('')
  const [empresas, setEmpresas] = useState<EmpresaMovil[]>([])
  const [lineas, setLineas] = useState<LineaOpcion[]>([])
  const [zonas, setZonas] = useState<ZonaOpcion[]>([])
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    loadUsers()
    loadOpcionesDePapeles()
  }, [])

  // Empresas, líneas y Zonas que ofrece el editor de papeles
  const loadOpcionesDePapeles = async () => {
    try {
      const [rEmpresas, rLineas, rZonas] = await Promise.all([
        fetch('/api/empresas'),
        fetch('/api/business-lines'),
        fetch('/api/kams'),
      ])
      if (rEmpresas.ok) setEmpresas((await rEmpresas.json()).empresas ?? [])
      if (rLineas.ok) setLineas(((await rLineas.json()).lines ?? []) as LineaOpcion[])
      if (rZonas.ok) {
        const datos = await rZonas.json()
        setZonas((Array.isArray(datos) ? datos : []).map((z: { id: string; name: string }) => ({ id: z.id, name: z.name })))
      }
    } catch {
      setError('Error al cargar las empresas, líneas y Zonas')
    }
  }

  const cerrarCrear = () => {
    setShowCreateForm(false)
    setFormData({ email: '', password: '', full_name: '' })
    setPapelesNuevos(SIN_PAPELES_NUEVOS)
    setErrorCrear('')
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data.users)
      } else {
        setError(data.error || 'Error al cargar usuarios')
      }
    } catch (error) {
      setError('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setErrorCrear('')

    if (!papelesNuevos.ok) {
      setErrorCrear(papelesNuevos.error)
      return
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, papeles: papelesNuevos.papeles })
      })

      const data = await response.json()

      if (response.ok) {
        // El servidor dice si el usuario quedó enlazado con su Ejecutiva Comercial (mismo email)
        setSuccess(typeof data.message === 'string' ? data.message : 'Usuario creado exitosamente')
        cerrarCrear()
        loadUsers()
      } else {
        // Mostrar más detalles del error
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error
        setErrorCrear(errorMsg || 'Error al crear usuario')
        console.error('Error detallado:', data)
      }
    } catch (error) {
      setErrorCrear('Error al crear usuario')
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      })

      const data = await response.json()

      if (response.ok) {
        loadUsers()
      } else {
        setError(data.error || 'Error al actualizar usuario')
      }
    } catch (error) {
      setError('Error al actualizar usuario')
    }
  }

  const handlePasswordChange = async () => {
    if (!selectedUser) return
    
    setError('')
    setSuccess('')
    setIsChangingPassword(true)

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setIsChangingPassword(false)
      return
    }

    if (passwordData.newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setIsChangingPassword(false)
      return
    }

    try {
      const response = await fetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordData.newPassword })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Contraseña actualizada exitosamente')
        setShowPasswordModal(false)
        setPasswordData({ newPassword: '', confirmPassword: '' })
        setSelectedUser(null)
        setError('')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(data.error || 'Error al actualizar contraseña')
      }
    } catch (error) {
      console.error('Error cambiando contraseña:', error)
      setError('Error al actualizar contraseña')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Nombres de los perfiles: los mismos de todo OpMap (getRoleTitle)
  const roleLabels = Object.fromEntries(ROLES_EN_ORDEN.map(role => [role, getRoleTitle(role)])) as Record<Role, string>

  const roleColors: Record<Role, string> = {
    admin: 'from-purple-600 to-purple-700',
    sales_manager: 'from-blue-600 to-blue-700',
    contract_manager: 'from-green-600 to-green-700',
    data_manager: 'from-yellow-600 to-yellow-700',
    viewer: 'from-gray-500 to-gray-600',
    user: 'from-gray-400 to-gray-500',
    line_leader: 'from-teal-600 to-teal-700',
    commercial_director: 'from-indigo-600 to-indigo-700',
    hr: 'from-rose-600 to-rose-700'
  }

  // Lo que se ve de los papeles de una persona: "VG: Líder de negocio · Ejecutivo comercial" por empresa
  const resumenDePapeles = (user: User): { empresa: string; titulo: string }[] =>
    empresas
      .map(empresa => ({ empresa: empresa.nombre_corto, papeles: user.papeles.filter(p => p.empresa_id === empresa.id) }))
      .filter(e => e.papeles.length > 0)
      .map(e => ({ empresa: e.empresa, titulo: tituloDePapeles(e.papeles) }))

  const textoDePapeles = (user: User) =>
    user.papeles.length > 0
      ? resumenDePapeles(user).map(r => `${r.empresa} ${r.titulo}`).join(' ')
      : roleLabels[user.role] || user.role || ''

  const filteredUsers = users.filter(user => 
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    textoDePapeles(user).toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeUsers = filteredUsers.filter(u => u.active).length
  const adminUsers = filteredUsers.filter(u => u.role === 'admin' || u.papeles.some(p => p.papel === 'admin')).length
  const usuarioEditado = editandoId ? users.find(u => u.id === editandoId) ?? null : null

  const renderPapeles = (user: User) => {
    const resumen = resumenDePapeles(user)
    if (resumen.length === 0) {
      return <span className="text-sm text-gray-500">{user.papeles.length === 0 ? 'Sin papeles' : roleLabels[user.role]}</span>
    }
    return (
      <div className="space-y-1">
        {resumen.map(r => (
          <div key={r.empresa} className="text-sm text-gray-900">
            <span className="font-semibold">{r.empresa}:</span> {r.titulo}
          </div>
        ))}
      </div>
    )
  }

  const botonEditarPapeles = (user: User, className: string) =>
    user.id !== currentUser?.id && (
      <button type="button" onClick={() => setEditandoId(user.id)} className={className}>
        Editar papeles
      </button>
    )

  // Debugging - Verificar el usuario actual
  useEffect(() => {
    if (currentUser) {
      console.log('Usuario actual:', currentUser)
      console.log('Rol del usuario:', currentUser.role)
    }
  }, [currentUser])

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="users:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-gray-100 border border-gray-400 text-gray-800 px-6 py-4 rounded-xl shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div>
                  <strong className="font-semibold">Acceso denegado</strong>
                  <p className="text-sm mt-1">No tienes permisos para gestionar usuarios.</p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-xl p-6 mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white">Gestión de Usuarios</h1>
                <p className="text-gray-300 mt-2">Administra los accesos y permisos del sistema</p>
              </div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transform hover:-translate-y-0.5 transition-all duration-200 shadow-md hover:shadow-lg font-medium flex items-center gap-2 text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Crear Usuario
              </button>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{filteredUsers.length}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full">
                  {filteredUsers.length > 0 ? Math.round((activeUsers / filteredUsers.length) * 100) : 0}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
              <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Administradores</p>
              <p className="text-2xl font-bold text-gray-900">{adminUsers}</p>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">Último Acceso</p>
              <p className="text-lg font-bold text-gray-900">Hoy</p>
            </div>
          </div>

          {/* Barra de búsqueda */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-6">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, email o rol..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl shadow-md mb-4 flex items-center gap-3 animate-slideDown">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-xl shadow-md mb-4 flex items-center gap-3 animate-slideDown">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>{success}</span>
            </div>
          )}

          {/* Usuarios de las Ejecutivas Comerciales que aún no tienen (app de visita) */}
          <ExecutiveAccountsPanel onDone={loadUsers} />

          {/* Modal de crear usuario mejorado */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transform transition-all animate-slideUp">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-8 py-6 text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold">Crear Nuevo Usuario</h3>
                      <p className="text-gray-300 text-sm mt-1">Configura los datos de acceso</p>
                    </div>
                    <button
                      onClick={() => {
                        cerrarCrear()
                        setError('')
                      }}
                      className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  {errorCrear && (
                    <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {errorCrear}
                    </div>
                  )}
                  <form onSubmit={handleCreateUser}>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          placeholder="Ej: Juan Pérez"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="usuario@ejemplo.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contraseña Inicial
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent transition-all"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>

                      <div>
                        <span className="block text-sm font-medium text-gray-700 mb-2">
                          Papeles del Usuario
                        </span>
                        <PapelesNuevoUsuario
                          empresas={empresas}
                          lineas={lineas}
                          zonas={zonas}
                          descripcion={DESCRIPCION_PERFIL}
                          onChange={setPapelesNuevos}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          cerrarCrear()
                          setError('')
                        }}
                        className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl hover:from-gray-900 hover:to-black transition-all font-medium flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Crear Usuario
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Modal para editar los papeles de una persona, por empresa */}
          {usuarioEditado && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transform transition-all animate-slideUp">
                <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-8 py-6 text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold">Editar papeles</h3>
                      <p className="text-gray-300 text-sm mt-1">Usuario: {usuarioEditado.full_name}</p>
                    </div>
                    <button
                      onClick={() => setEditandoId(null)}
                      aria-label="Cerrar"
                      className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-8">
                  <PapelesEditor
                    usuario={usuarioEditado}
                    empresas={empresas}
                    lineas={lineas}
                    zonas={zonas}
                    descripcion={DESCRIPCION_PERFIL}
                    onGuardado={loadUsers}
                  />
                  <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setEditandoId(null)}
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal para cambiar contraseña */}
          {showPasswordModal && selectedUser && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden transform transition-all animate-slideUp">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-8 py-6 text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold">Cambiar Contraseña</h3>
                      <p className="text-gray-300 text-sm mt-1">Usuario: {selectedUser.full_name}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowPasswordModal(false)
                        setPasswordData({ newPassword: '', confirmPassword: '' })
                        setSelectedUser(null)
                        setError('')
                      }}
                      className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {error}
                    </div>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nueva Contraseña
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                            passwordData.newPassword
                              ? passwordData.newPassword.length >= 6
                                ? 'border-green-500 focus:ring-green-500'
                                : 'border-amber-500 focus:ring-amber-500'
                              : 'border-gray-300 focus:ring-gray-700'
                          }`}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder="Mínimo 6 caracteres"
                        />
                        {passwordData.newPassword && passwordData.newPassword.length < 6 && (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠ La contraseña debe tener al menos 6 caracteres ({passwordData.newPassword.length}/6)
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmar Contraseña
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                            passwordData.confirmPassword && passwordData.newPassword
                              ? passwordData.confirmPassword === passwordData.newPassword
                                ? 'border-green-500 focus:ring-green-500'
                                : 'border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:ring-gray-700'
                          }`}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder="Repite la contraseña"
                        />
                        {passwordData.confirmPassword && passwordData.newPassword && (
                          <p className={`text-xs mt-1 ${
                            passwordData.confirmPassword === passwordData.newPassword
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {passwordData.confirmPassword === passwordData.newPassword
                              ? '✓ Las contraseñas coinciden'
                              : '✗ Las contraseñas no coinciden'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordModal(false)
                          setPasswordData({ newPassword: '', confirmPassword: '' })
                          setSelectedUser(null)
                          setError('')
                        }}
                        disabled={isChangingPassword}
                        className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword || isChangingPassword}
                        className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                          !passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword || isChangingPassword
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white hover:from-gray-900 hover:to-black'
                        }`}
                      >
                        {isChangingPassword ? (
                          <>
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Cambiando...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            Cambiar Contraseña
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-gray-700 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-600">Cargando usuarios...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabla para desktop */}
              <div className="hidden lg:block bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <th className="px-6 py-5 text-left">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Usuario</span>
                      </th>
                      <th className="px-6 py-5 text-left">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Papeles</span>
                      </th>
                      <th className="px-6 py-5 text-center">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Estado</span>
                      </th>
                      <th className="px-6 py-5 text-left">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Creación</span>
                      </th>
                      <th className="px-6 py-5 text-center">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredUsers.map((user, index) => (
                      <tr 
                        key={user.id} 
                        className="hover:bg-gray-50 transition-all duration-150"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${roleColors[user.role]} flex items-center justify-center text-white font-bold shadow-md`}>
                                {user.full_name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">
                                {user.full_name}
                                {user.id === currentUser?.id && (
                                  <span className="ml-2 text-xs text-gray-500">(Tú)</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col items-start gap-2">
                            {renderPapeles(user)}
                            {botonEditarPapeles(user, 'px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors')}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold ${
                            user.active 
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200' 
                              : 'bg-gradient-to-r from-red-50 to-pink-50 text-red-700 border border-red-200'
                          }`}>
                            <span className={`w-2 h-2 rounded-full mr-2 ${user.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            {user.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-center gap-1">
                            {user.id !== currentUser?.id && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedUser(user)
                                    setShowPasswordModal(true)
                                  }}
                                  className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all group"
                                  title="Cambiar contraseña"
                                >
                                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleToggleActive(user.id, user.active)}
                                  className={`p-2 ${
                                    user.active 
                                      ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' 
                                      : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                  } rounded-lg transition-all group`}
                                  title={user.active ? 'Desactivar' : 'Activar'}
                                >
                                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {user.active ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    )}
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista de tarjetas para móvil */}
              <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className={`bg-white rounded-xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition-all ${
                      !user.active ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${roleColors[user.role]} flex items-center justify-center text-white font-bold shadow-md`}>
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {user.full_name}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-gray-500">(Tú)</span>
                            )}
                          </h3>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-start gap-3">
                        <span className="text-sm text-gray-600">Papeles:</span>
                        <div className="text-right">{renderPapeles(user)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Estado:</span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          user.active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Creado:</span>
                        <span className="text-sm text-gray-900">
                          {new Date(user.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {user.id !== currentUser?.id && (
                      <div className="flex flex-wrap gap-2">
                        {botonEditarPapeles(user, 'flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium')}
                        <button
                          onClick={() => {
                            setSelectedUser(user)
                            setShowPasswordModal(true)
                          }}
                          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                        >
                          Contraseña
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.id, user.active)}
                          className={`flex-1 px-3 py-2 ${
                            user.active 
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          } rounded-lg transition-colors text-sm font-medium`}
                        >
                          {user.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-100">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron usuarios</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega el primer usuario para comenzar'}
              </p>
            </div>
          )}

          {/* Información sobre roles mejorada */}
          <div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Perfiles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ROLES_EN_ORDEN.map(role => (
                <div key={role} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${roleColors[role]} rounded-lg flex items-center justify-center`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                    </div>
                    <h3 className="font-bold text-gray-900">{getRoleTitle(role)}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{DESCRIPCION_PERFIL[role]}</p>
                </div>
              ))}
            </div>
          </div>

          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
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
            
            .animate-fadeIn {
              animation: fadeIn 0.2s ease-out;
            }
            
            .animate-slideUp {
              animation: slideUp 0.3s ease-out;
            }

            .animate-slideDown {
              animation: slideDown 0.2s ease-out;
            }
          `}</style>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}