import { createClient } from '@supabase/supabase-js'

// Cliente administrativo ÚNICO con service_role (bypass de RLS). Solo para código de servidor
// (rutas API, server components). NUNCA importarlo desde componentes 'use client'.
// Si falta SUPABASE_SERVICE_ROLE_KEY se lanza un error: no hay fallback a la anon key.

// Next.js 14 guarda en su Data Cache (sin caducidad) los fetch de las rutas GET con
// `export const dynamic = 'force-dynamic'`: en esas rutas no se rastrea el acceso a la petición y
// el fetch de supabase-js quedaba cacheado para siempre (giros, sesión de usuario, cola de
// pendientes… devolvían datos viejos). Los datos de la base nunca deben salir de esa caché:
// todas las consultas de este cliente van con cache: 'no-store'.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: noStoreFetch },
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
