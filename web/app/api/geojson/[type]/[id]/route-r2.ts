import { NextRequest, NextResponse } from 'next/server'

interface Props {
  params: {
    type: 'departments' | 'municipalities' | 'localities'
    id: string
  }
}

// URL base de tu bucket R2 (actualizar con tu URL real)
const R2_BASE_URL = process.env.R2_BASE_URL || 'https://opmap-geojson.YOUR-SUBDOMAIN.r2.dev'

export async function GET(request: NextRequest, { params }: Props) {
  const { type, id } = params

  try {
    // Construir URL del archivo en R2
    const url = `${R2_BASE_URL}/${type}/${id}.geojson`
    
    // Fetch desde R2
    const response = await fetch(url, {
      // Cache por 1 hora para mejorar performance
      next: { revalidate: 3600 }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `GeoJSON file not found: ${type}/${id}` },
        { status: 404 }
      )
    }

    const geojson = await response.json()
    
    // Retornar con headers de cache
    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      }
    })
  } catch (error) {
    console.error(`Error fetching GeoJSON from R2:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch GeoJSON file' },
      { status: 500 }
    )
  }
}