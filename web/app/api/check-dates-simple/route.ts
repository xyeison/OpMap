import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Consulta simple para obtener las fechas
    const { data, error } = await supabase
      .from('travel_time_cache')
      .select('calculated_at')
      .gte('dest_lat', 4.545)
      .lte('dest_lat', 4.546)
      .gte('dest_lng', -75.661)
      .lte('dest_lng', -75.660)
      .order('calculated_at', { ascending: true })
      .limit(20)
    
    if (error) throw error
    
    // Extraer fechas únicas
    const dates = data?.map(d => {
      const date = new Date(d.calculated_at)
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString(),
        full: d.calculated_at
      }
    })
    
    // Primera y última fecha
    const first = dates?.[0]
    const last = dates?.[dates.length - 1]
    
    return NextResponse.json({
      total: dates?.length,
      firstDate: first,
      lastDate: last,
      allDates: dates
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 })
  }
}