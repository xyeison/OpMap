import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { origin, destination } = body

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origin and destination are required' },
        { status: 400 }
      )
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key not configured')
      return NextResponse.json(
        { error: 'Google Maps API not configured' },
        { status: 500 }
      )
    }

    // Construir URL para Distance Matrix API
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.append('origins', `${origin.lat},${origin.lng}`)
    url.searchParams.append('destinations', `${destination.lat},${destination.lng}`)
    url.searchParams.append('mode', 'driving')
    url.searchParams.append('language', 'es')
    url.searchParams.append('key', GOOGLE_MAPS_API_KEY)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data)
      return NextResponse.json(
        { error: 'Error calling Google Maps API' },
        { status: 500 }
      )
    }

    const element = data.rows[0]?.elements[0]
    if (element?.status === 'OK') {
      return NextResponse.json({
        distance: element.distance.value, // metros
        duration: element.duration.value, // segundos
        distance_text: element.distance.text,
        duration_text: element.duration.text
      })
    } else {
      console.error('No route found:', element)
      return NextResponse.json(
        { error: 'No route found between points' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error in distance API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}