import { supabase } from './supabase'

export async function getAuthHeaders() {
  try {
    // Primero intentar obtener la sesión de Supabase
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    }
    
    // Si no hay sesión, intentar refrescar
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
    
    if (refreshedSession?.access_token) {
      return {
        'Authorization': `Bearer ${refreshedSession.access_token}`,
        'Content-Type': 'application/json'
      }
    }
    
    // Como último recurso, usar el token de las cookies si existe
    const cookies = document.cookie.split(';')
    const authCookie = cookies.find(c => c.trim().startsWith('sb-'))
    
    if (authCookie) {
      const token = authCookie.split('=')[1]
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
    
    throw new Error('No se pudo obtener token de autenticación')
  } catch (error) {
    console.error('Error getting auth headers:', error)
    throw error
  }
}