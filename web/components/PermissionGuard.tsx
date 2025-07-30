'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { type Permission } from '@/lib/permissions'
import { ReactNode } from 'react'

interface PermissionGuardProps {
  children: ReactNode
  permission?: Permission
  permissions?: Permission[]
  requireAll?: boolean // Si es true, requiere TODOS los permisos. Si es false (default), requiere AL MENOS UNO
  fallback?: ReactNode
}

export default function PermissionGuard({ 
  children, 
  permission, 
  permissions = [], 
  requireAll = false,
  fallback = null 
}: PermissionGuardProps) {
  const { can, canAny, canAll, loading, role } = usePermissions()
  
  if (loading) {
    return <div className="animate-pulse">Cargando...</div>
  }
  
  // Debug log temporalmente
  console.log('PermissionGuard check:', { permission, permissions, role, loading })
  
  let hasAccess = false
  
  if (permission) {
    hasAccess = can(permission)
  } else if (permissions.length > 0) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions)
  } else {
    // Si no se especifican permisos, siempre mostrar
    hasAccess = true
  }
  
  if (!hasAccess) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}