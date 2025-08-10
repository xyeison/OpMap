import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase para el servidor con Service Role Key
// Este cliente bypasea RLS y tiene permisos completos
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  // Intentar obtener service key con diferentes nombres posibles
  const supabaseServiceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||  // Nombre correcto
    process.env.SUPABASE_SERVICE_KEY ||        // Posible variación
    process.env.SERVICE_ROLE_KEY;              // Otra variación

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  // Log para debugging (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔑 Service Key Status:', {
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      usingKey: supabaseServiceKey ? 'service' : 'anon'
    });
  }

  // Si no hay service key, usar anon key con advertencia
  if (!supabaseServiceKey) {
    console.warn('⚠️ No service key found. Using anon key which respects RLS.');
    console.warn('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', '));
    
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!anonKey) {
      throw new Error('Neither service key nor NEXT_PUBLIC_SUPABASE_ANON_KEY found');
    }
    
    return createClient(supabaseUrl, anonKey);
  }

  // Log cuando se usa service key exitosamente
  console.log('✅ Using service role key - RLS bypassed');

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Cliente de Supabase con clave anónima (respeta RLS)
export function createAnonSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}