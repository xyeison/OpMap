'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import PermissionGuard from '@/components/PermissionGuard'
import { createClient } from '@supabase/supabase-js'
import { getRoleTitle, type Role } from '@/lib/permissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role>('viewer')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: Role) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      await fetchUsers()
      setEditingUser(null)
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Error al actualizar el rol')
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      
      await fetchUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      alert('Error al actualizar el estado')
    }
  }

  return (
    <ProtectedRoute>
      <PermissionGuard 
        permission="users:manage"
        fallback={
          <div className="container mx-auto p-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Acceso denegado:</strong> No tienes permisos para administrar usuarios.
            </div>
          </div>
        }
      >
        <div className="container mx-auto p-6">
          <h1 className="text-3xl font-bold mb-6">Gestión de Usuarios</h1>

          {loading ? (
            <div className="animate-pulse">Cargando usuarios...</div>
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
                      Creado
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
                        {editingUser === user.id ? (
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as Role)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="admin">Administrador</option>
                            <option value="sales_manager">Gerente de Ventas</option>
                            <option value="contract_manager">Gestor de Contratos</option>
                            <option value="data_manager">Gestor de Datos</option>
                            <option value="viewer">Usuario</option>
                          </select>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {getRoleTitle(user.role as Role)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingUser === user.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateUserRole(user.id, selectedRole)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingUser(user.id)
                                setSelectedRole(user.role as Role)
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Editar Rol
                            </button>
                            <button
                              onClick={() => toggleUserStatus(user.id, user.active)}
                              className={user.active 
                                ? "text-red-600 hover:text-red-900" 
                                : "text-green-600 hover:text-green-900"
                              }
                            >
                              {user.active ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
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
                <h3 className="font-semibold text-blue-600">Administrador</h3>
                <p className="text-sm text-gray-600">Control total del sistema</p>
              </div>
              <div>
                <h3 className="font-semibold text-green-600">Gerente de Ventas</h3>
                <p className="text-sm text-gray-600">Gestiona KAMs y ve estadísticas</p>
              </div>
              <div>
                <h3 className="font-semibold text-purple-600">Gestor de Contratos</h3>
                <p className="text-sm text-gray-600">Administra contratos y oportunidades</p>
              </div>
              <div>
                <h3 className="font-semibold text-orange-600">Gestor de Datos</h3>
                <p className="text-sm text-gray-600">Actualiza hospitales y KAMs</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-600">Usuario</h3>
                <p className="text-sm text-gray-600">Solo consulta mapa e información básica</p>
              </div>
            </div>
          </div>
        </div>
      </PermissionGuard>
    </ProtectedRoute>
  )
}