'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'

export default function Navigation() {
  const { user, logout } = useUser()
  
  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">OpMap</h1>
        <div className="flex items-center space-x-4">
          {user && (
            <>
              <Link href="/" className="hover:text-blue-200">Dashboard</Link>
              <Link href="/kams" className="hover:text-blue-200">KAMs</Link>
              <Link href="/hospitals" className="hover:text-blue-200">Hospitales</Link>
              <Link href="/contracts" className="hover:text-blue-200">Contratos</Link>
              <Link href="/map" className="hover:text-blue-200">Mapa</Link>
              {user.role === 'admin' && (
                <Link href="/users" className="hover:text-blue-200">Usuarios</Link>
              )}
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