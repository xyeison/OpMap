'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'sales_manager' | 'contract_manager' | 'data_manager' | 'viewer' | 'user'
}

interface UserContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Verificar si hay sesión guardada
  useEffect(() => {
    checkSession()
  }, [])
  
  const checkSession = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const { user } = await response.json()
        setUser(user)
        localStorage.setItem('opmap_user', JSON.stringify(user))
      } else {
        // Si no hay sesión válida, limpiar localStorage
        localStorage.removeItem('opmap_user')
      }
    } catch (error) {
      console.error('Error verificando sesión:', error)
      localStorage.removeItem('opmap_user')
    }
    setIsLoading(false)
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const { user } = await response.json()
        setUser(user)
        localStorage.setItem('opmap_user', JSON.stringify(user))
        return true
      }
      return false
    } catch (error) {
      console.error('Error en login:', error)
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Error en logout:', error)
    }
    
    setUser(null)
    localStorage.removeItem('opmap_user')
    window.location.href = '/login'
  }

  return (
    <UserContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser debe ser usado dentro de UserProvider')
  }
  return context
}