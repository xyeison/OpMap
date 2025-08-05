import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    console.log('🎯 PRUEBA ESPECÍFICA: IBAGUÉ → GIRARDOT')
    
    // 1. Obtener KAM Ibagué
    const { data: kamIbague } = await supabase
      .from('kams')
      .select('*')
      .eq('area_id', '73001')
      .single()
    
    // 2. Obtener un hospital de Girardot
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('municipality_id', '25307')
      .eq('active', true)
      .limit(1)
    
    if (!kamIbague || !hospitals || hospitals.length === 0) {
      return NextResponse.json({ error: 'No se encontró KAM Ibagué o hospitales en Girardot' })
    }
    
    const hospital = hospitals[0]
    
    // 3. Intentar calcular con Google Maps
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    console.log('API Key disponible:', !!apiKey)
    console.log('API Key length:', apiKey?.length || 0)
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${kamIbague.lat},${kamIbague.lng}&destinations=${hospital.lat},${hospital.lng}&mode=driving&language=es&units=metric&key=${apiKey}`
    
    console.log('🚀 Llamando a Google Maps...')
    const response = await fetch(url)
    const data = await response.json()
    
    console.log('📡 Respuesta de Google:', JSON.stringify(data, null, 2))
    
    return NextResponse.json({
      success: true,
      kam: {
        name: kamIbague.name,
        location: `${kamIbague.lat}, ${kamIbague.lng}`
      },
      hospital: {
        name: hospital.name,
        location: `${hospital.lat}, ${hospital.lng}`
      },
      googleResponse: data,
      apiKeyConfigured: !!apiKey
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    })
  }
}