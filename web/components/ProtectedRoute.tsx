'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    console.log('ProtectedRoute - isLoading:', isLoading, 'user:', user)
    if (!isLoading && !user) {
      console.log('ProtectedRoute - Redirigiendo a /login')
      router.push('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Cargando...</div>
      </div>
    )
  }

  if (!user) {
    console.log('ProtectedRoute - No hay usuario, retornando pantalla de espera')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Redirigiendo al login...</div>
      </div>
    )
  }

  return <>{children}</>
}