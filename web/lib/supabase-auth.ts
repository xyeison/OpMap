'use client'

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Crear cliente con autenticación personalizada
export function createAuthenticatedClient() {
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('sb-access-token='))
    ?.split('=')[1]

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        ...(token ? { 'X-Custom-Auth-Token': token } : {})
      }
    }
  })

  return client
}

// Cliente singleton para usar en toda la aplicación
export const supabaseAuth = createAuthenticatedClient()