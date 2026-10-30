'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Role } from '@/lib/permissions'
import { marcarSalidaPendienteAppCampo, olvidarSesionAppCampo } from '@/lib/app-campo'

interface User {
  id: string
  email: string
  full_name: string
  role: Role
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
    console.log('UserContext - Verificando sesión...')
    try {
      // Primero intentar recuperar de localStorage
      const cachedUser = localStorage.getItem('opmap_user')
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser)
          console.log('UserContext - Usuario en caché:', parsedUser)
          setUser(parsedUser)
        } catch (e) {
          console.error('Error parseando usuario en caché:', e)
          localStorage.removeItem('opmap_user')
        }
      }
      
      // Luego verificar con el servidor
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        cache: 'no-cache'
      })
      console.log('UserContext - Respuesta de /api/auth/me:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('UserContext - Usuario validado:', data.user)
        setUser(data.user)
        localStorage.setItem('opmap_user', JSON.stringify(data.user))
      } else {
        // Si no hay sesión válida, limpiar localStorage
        console.log('UserContext - No hay sesión válida, status:', response.status)
        localStorage.removeItem('opmap_user')
        setUser(null)
      }
    } catch (error) {
      console.error('Error verificando sesión:', error)
      // No limpiar el usuario si es solo un error de red
      if (!navigator.onLine) {
        console.log('Sin conexión, manteniendo usuario en caché')
      } else {
        localStorage.removeItem('opmap_user')
        setUser(null)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // El servidor emite la cookie httpOnly de sesión (__Host-opmap_session en producción) si las credenciales son válidas
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const { user } = await response.json()
        setUser(user)
        localStorage.setItem('opmap_user', JSON.stringify(user))
        // Un solo ingreso (2026-10-30): la app de campo toma esta sesión la próxima vez que se abra
        olvidarSesionAppCampo(localStorage)
        return true
      }
      
      // Registrar el motivo (401 credenciales, 429 demasiados intentos, 500 configuración)
      const errorData = await response.json().catch(() => null)
      console.error('Error de login:', response.status, errorData?.error)
      
      return false
    } catch (error) {
      console.error('Error en login:', error)
      return false
    }
  }

  const logout = async () => {
    let avisado = false
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      avisado = response.ok
    } catch (error) {
      console.error('Error en logout:', error)
    }
    
    setUser(null)
    localStorage.removeItem('opmap_user')
    // Cerrar sesión en OpMap cierra también la app de campo en este navegador (no su cola sin señal). Si el servidor no
    // se enteró, la cookie pudo quedar viva: la marca evita que la app entre sola con ella
    olvidarSesionAppCampo(localStorage)
    if (!avisado) marcarSalidaPendienteAppCampo(localStorage)
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