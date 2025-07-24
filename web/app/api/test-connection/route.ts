import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test queries
    const [kamsResult, hospitalsResult, assignmentsResult] = await Promise.all([
      supabase.from('kams').select('*', { count: 'exact', head: true }),
      supabase.from('hospitals').select('*', { count: 'exact', head: true }),
      supabase.from('assignments').select('*', { count: 'exact', head: true })
    ])

    return NextResponse.json({
      connected: true,
      stats: {
        kams: kamsResult.count,
        hospitals: hospitalsResult.count,
        assignments: assignmentsResult.count
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    })
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}