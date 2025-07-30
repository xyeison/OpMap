'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'sales_manager' | 'contract_manager' | 'data_manager' | 'viewer' | 'user'
  active: boolean
  created_at: string
}

export default function UsersPage() {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as any // Temporalmente usar 'user' si la BD lo requiere
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

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

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Usuario creado exitosamente')
        setShowCreateForm(false)
        setFormData({ email: '', password: '', full_name: '', role: 'viewer' })
        loadUsers()
      } else {
        setError(data.error || 'Error al crear usuario')
      }
    } catch (error) {
      setError('Error al crear usuario')
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

  const handleRoleChange = async (userId: string, newRole: User['role']) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      })

      const data = await response.json()

      if (response.ok) {
        loadUsers()
        setSuccess('Rol actualizado exitosamente')
      } else {
        setError(data.error || 'Error al actualizar rol')
      }
    } catch (error) {
      setError('Error al actualizar rol')
    }
  }

  const roleLabels = {
    admin: 'Administrador',
    sales_manager: 'Ventas',
    contract_manager: 'Contratos',
    data_manager: 'Datos',
    viewer: 'Visualizador',
    user: 'Usuario'
  }

  const roleColors = {
    admin: 'bg-purple-100 text-purple-800',
    sales_manager: 'bg-blue-100 text-blue-800',
    contract_manager: 'bg-green-100 text-green-800',
    data_manager: 'bg-yellow-100 text-yellow-800',
    viewer: 'bg-gray-100 text-gray-800',
    user: 'bg-gray-100 text-gray-800'
  }

  // Solo admin puede ver esta página
  if (currentUser?.role !== 'admin') {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Acceso denegado:</strong> Solo los administradores pueden gestionar usuarios.
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="users:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Acceso denegado:</strong> No tienes permisos para gestionar usuarios.
            </div>
          </div>
        }
      >
        <div className="container mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">Gestión de Usuarios</h2>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Crear Usuario
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {/* Modal de crear usuario */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h3>
                <form onSubmit={handleCreateUser}>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Rol
                    </label>
                    <select
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                    >
                      <option value="user">Usuario</option>
                      <option value="data_manager">Datos</option>
                      <option value="contract_manager">Contratos</option>
                      <option value="sales_manager">Ventas</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setFormData({ email: '', password: '', full_name: '', role: 'viewer' })
                        setError('')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Crear Usuario
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">Cargando usuarios...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha Creación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.id === currentUser?.id ? (
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[user.role]}`}>
                            {roleLabels[user.role]}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as User['role'])}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="user">Usuario</option>
                            <option value="data_manager">Datos</option>
                            <option value="contract_manager">Contratos</option>
                            <option value="sales_manager">Ventas</option>
                            <option value="admin">Administrador</option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleActive(user.id, user.active)}
                            className={`${
                              user.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                            }`}
                          >
                            {user.active ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Información sobre roles */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Información sobre Roles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold text-purple-600">Administrador</h3>
                <p className="text-sm text-gray-600">Control total del sistema, gestión de usuarios</p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-600">Ventas</h3>
                <p className="text-sm text-gray-600">Gestiona KAMs, ve estadísticas y reportes</p>
              </div>
              <div>
                <h3 className="font-semibold text-green-600">Contratos</h3>
                <p className="text-sm text-gray-600">Administra contratos y oportunidades comerciales</p>
              </div>
              <div>
                <h3 className="font-semibold text-yellow-600">Datos</h3>
                <p className="text-sm text-gray-600">Actualiza información de hospitales y KAMs</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-600">Visualizador</h3>
                <p className="text-sm text-gray-600">Solo puede consultar el mapa e información básica</p>
              </div>
            </div>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}