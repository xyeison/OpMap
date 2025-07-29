import { createClient } from '@supabase/supabase-js'

// Tipos para la tabla travel_time_cache
export interface TravelTimeCache {
  id?: string
  origin_lat: number
  origin_lng: number
  dest_lat: number
  dest_lng: number
  travel_time: number
  distance?: number
  source?: string
  calculated_at?: string
}

// Crear cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funciones helper para el caché
export async function getTravelTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('travel_time_cache')
      .select('travel_time')
      .eq('origin_lat', Math.round(originLat * 1000000) / 1000000)
      .eq('origin_lng', Math.round(originLng * 1000000) / 1000000)
      .eq('dest_lat', Math.round(destLat * 1000000) / 1000000)
      .eq('dest_lng', Math.round(destLng * 1000000) / 1000000)
      .single()

    if (error || !data) return null
    return data.travel_time
  } catch (error) {
    console.error('Error getting travel time:', error)
    return null
  }
}

export async function saveTravelTime(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  travelTime: number,
  distance?: number,
  source: string = 'google_maps'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('travel_time_cache')
      .upsert({
        origin_lat: Math.round(originLat * 1000000) / 1000000,
        origin_lng: Math.round(originLng * 1000000) / 1000000,
        dest_lat: Math.round(destLat * 1000000) / 1000000,
        dest_lng: Math.round(destLng * 1000000) / 1000000,
        travel_time: travelTime,
        distance: distance,
        source: source,
        calculated_at: new Date().toISOString()
      })

    return !error
  } catch (error) {
    console.error('Error saving travel time:', error)
    return false
  }
}

export async function getAllTravelTimes(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')
      .eq('source', 'google_maps') // Solo cargar tiempos de Google Maps

    if (error || !data) return {}

    // Convertir a formato de caché
    const cache: Record<string, number> = {}
    data.forEach(record => {
      const key = `${record.origin_lat},${record.origin_lng},${record.dest_lat},${record.dest_lng}`
      cache[key] = record.travel_time
    })

    return cache
  } catch (error) {
    console.error('Error loading all travel times:', error)
    return {}
  }
}

export async function getTravelTimesCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('travel_time_cache')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'google_maps')

    if (error || count === null) return 0
    return count
  } catch (error) {
    console.error('Error getting travel times count:', error)
    return 0
  }
}