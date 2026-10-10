import { getSupabaseAdmin } from './supabase-admin'

/**
 * Cliente de Supabase para el servidor con service_role (bypass de RLS).
 * Se mantiene por compatibilidad con las rutas que ya lo importan: delega en el cliente
 * único de lib/supabase-admin.ts, que lanza si falta SUPABASE_SERVICE_ROLE_KEY (sin fallback a anon).
 * @deprecated Usar getSupabaseAdmin() o supabaseAdmin de '@/lib/supabase-admin'.
 */
export function createServerSupabaseClient() {
  return getSupabaseAdmin()
}
