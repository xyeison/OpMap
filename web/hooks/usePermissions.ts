'use client'

import { useUser } from '@/contexts/UserContext'
import { hasPermission, getNavigationMenu, getAllowedRoutes, type Role, type Permission } from '@/lib/permissions'

export function usePermissions() {
  const { user, isLoading } = useUser()
  const userRole = user?.role as Role | undefined
  
  // Función para verificar un permiso específico
  const can = (permission: Permission): boolean => {
    return hasPermission(userRole, permission)
  }
  
  // Función para verificar múltiples permisos (OR)
  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(userRole, permission))
  }
  
  // Función para verificar múltiples permisos (AND)
  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(userRole, permission))
  }
  
  return {
    role: userRole,
    loading: isLoading,
    can,
    canAny,
    canAll,
    navigationMenu: getNavigationMenu(userRole),
    allowedRoutes: getAllowedRoutes(userRole)
  }
}