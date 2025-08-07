import { NextResponse } from 'next/server'

export async function GET() {
  // Verificar qué variables de entorno están configuradas (sin exponer valores)
  const envCheck = {
    has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    node_env: process.env.NODE_ENV,
    // Verificar primeros caracteres para confirmar que son válidos
    url_starts: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 8),
    anon_key_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
  }
  
  return NextResponse.json(envCheck)
}