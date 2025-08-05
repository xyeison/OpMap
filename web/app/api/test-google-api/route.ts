import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_MAPS_API_KEY no está configurada en las variables de entorno'
      })
    }
    
    // Hacer una prueba simple: calcular distancia entre Bogotá e Ibagué
    const origin = '4.60971,-74.08175' // Bogotá
    const destination = '4.43889,-75.23222' // Ibagué
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&language=es&units=metric&key=${apiKey}`
    
    console.log('🔍 Probando Google Maps API...')
    
    const response = await fetch(url)
    const data = await response.json()
    
    console.log('📡 Respuesta:', JSON.stringify(data, null, 2))
    
    return NextResponse.json({
      success: true,
      apiKeyLength: apiKey.length,
      googleResponse: data,
      status: data.status,
      result: data.rows?.[0]?.elements?.[0]
    })
    
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    })
  }
}