'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { usePermissions } from '@/hooks/usePermissions'

export default function Navigation() {
  const { user, logout } = useUser()
  const { navigationMenu } = usePermissions()
  
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">OpMap</h1>
        <div className="flex items-center space-x-4">
          {user && (
            <>
              {navigationMenu.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="hover:text-blue-200"
                >
                  {item.name}
                </Link>
              ))}
              <span className="text-sm">|</span>
              <span className="text-sm">{user.full_name}</span>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm"
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}