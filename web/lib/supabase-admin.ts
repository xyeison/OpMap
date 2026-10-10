import { createClient } from '@supabase/supabase-js'

// Cliente administrativo ÚNICO con service_role (bypass de RLS). Solo para código de servidor
// (rutas API, server components). NUNCA importarlo desde componentes 'use client'.
// Si falta SUPABASE_SERVICE_ROLE_KEY se lanza un error: no hay fallback a la anon key.

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export type SupabaseAdminClient = ReturnType<typeof createAdminClient>

let adminClient: SupabaseAdminClient | null = null

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (adminClient) return adminClient

  if (typeof window !== 'undefined') {
    throw new Error('El cliente service_role solo puede usarse en el servidor')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurada')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  }

  adminClient = createAdminClient(url, serviceRoleKey)
  return adminClient
}

// Acceso directo (supabaseAdmin.from(...)). Se crea de forma perezosa en el primer uso para que
// importar el módulo no falle durante el build; si falta la clave, lanza al usarlo.
export const supabaseAdmin: SupabaseAdminClient = new Proxy({} as SupabaseAdminClient, {
  get(_target, property) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
