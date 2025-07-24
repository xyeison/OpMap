import { NextResponse } from 'next/server'

// Base URL de Supabase Storage
const STORAGE_BASE_URL = 'https://norvxqgohddgsdkggqzq.supabase.co/storage/v1/object/public/geojson'

export async function GET(
  request: Request,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const { type, id } = params
    
    // Validate type - ahora incluimos departments
    if (!['departments', 'municipalities', 'localities'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    
    // Validate id format
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 })
    }
    
    // Construir URL del archivo en Supabase Storage
    const url = `${STORAGE_BASE_URL}/${type}/${id}.geojson`
    
    try {
      // Fetch desde Supabase Storage con cache
      const response = await fetch(url, {
        next: { revalidate: 3600 } // Cache por 1 hora
      })

      if (!response.ok) {
        console.error(`GeoJSON not found at: ${url}`)
        return NextResponse.json({ error: 'GeoJSON file not found' }, { status: 404 })
      }

      const geoJson = await response.json()
      
      // Retornar con headers de cache para el browser
      return NextResponse.json(geoJson, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        }
      })
    } catch (error) {
      console.error(`Error fetching from Supabase Storage:`, error)
      return NextResponse.json({ error: 'Failed to fetch GeoJSON' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error serving GeoJSON:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}