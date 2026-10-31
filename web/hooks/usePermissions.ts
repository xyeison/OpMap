'use client'

import { useUser } from '@/contexts/UserContext'
import { tienePermiso } from '@/lib/empresas-reglas'
import { menuDePapeles, rutasDePapeles, type Role, type Permission } from '@/lib/permissions'

export function usePermissions() {
  const { user, isLoading } = useUser()
  const userRole = user?.role as Role | undefined
  // Lo que puede hacer la persona es la SUMA de sus papeles en la empresa activa (empresas, capa 1)
  const papeles = user?.papeles ?? []

  // Función para verificar un permiso específico
  const can = (permission: Permission): boolean => {
    return tienePermiso(papeles, permission)
  }

  // Función para verificar múltiples permisos (OR)
  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some(permission => tienePermiso(papeles, permission))
  }

  // Función para verificar múltiples permisos (AND)
  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every(permission => tienePermiso(papeles, permission))
  }

  return {
    role: userRole,
    papeles,
    empresa: user?.empresa ?? null,
    empresas: user?.empresas ?? [],
    loading: isLoading,
    can,
    canAny,
    canAll,
    navigationMenu: menuDePapeles(papeles),
    allowedRoutes: rutasDePapeles(papeles)
  }
}
