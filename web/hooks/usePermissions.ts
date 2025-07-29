'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { hasPermission, getNavigationMenu, getAllowedRoutes, type Role, type Permission } from '@/lib/permissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function usePermissions() {
  const [userRole, setUserRole] = useState<Role | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchUserRole() {
      try {
        // Obtener el usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        
        if (user) {
          // Obtener el rol del usuario desde la base de datos
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()
          
          setUserRole((userData?.role as Role) || 'viewer')
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchUserRole()
  }, [])
  
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
    loading,
    can,
    canAny,
    canAll,
    navigationMenu: getNavigationMenu(userRole),
    allowedRoutes: getAllowedRoutes(userRole)
  }
}