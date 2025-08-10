import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Props {
  params: {
    type: 'departments' | 'municipalities' | 'localities'
    id: string
  }
}

export async function GET(request: NextRequest, { params }: Props) {
  const { type, id } = params

  try {
    // Descargar desde Supabase Storage
    const { data, error } = await supabase.storage
      .from('geojson')
      .download(`${type}/${id}.geojson`)

    if (error) {
      console.error('Error downloading GeoJSON:', error)
      return NextResponse.json(
        { error: `GeoJSON file not found: ${type}/${id}` },
        { status: 404 }
      )
    }

    // Convertir blob a JSON
    const text = await data.text()
    const geojson = JSON.parse(text)

    // Retornar con headers de cache
    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      }
    })
  } catch (error) {
    console.error('Error fetching GeoJSON:', error)
    return NextResponse.json(
      { error: 'Failed to fetch GeoJSON file' },
      { status: 500 }
    )
  }
}