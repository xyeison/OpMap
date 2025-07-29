'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleTitle } from '@/lib/permissions'

export default function NavigationWithPermissions() {
  const { user, logout } = useUser()
  const { role, navigationMenu, loading } = usePermissions()
  
  if (!user) return null
  
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">OpMap</h1>
        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="animate-pulse">Cargando menú...</div>
          ) : (
            <>
              {/* Enlaces dinámicos según permisos */}
              {navigationMenu.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className="hover:text-blue-200 transition-colors"
                >
                  {item.name}
                </Link>
              ))}
              
              <span className="text-sm opacity-75">|</span>
              
              {/* Información del usuario */}
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className="text-sm font-medium">{user.full_name}</div>
                  <div className="text-xs opacity-75">{role && getRoleTitle(role)}</div>
                </div>
                
                <button
                  onClick={logout}
                  className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm transition-colors"
                >
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}