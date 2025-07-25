import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching unassigned hospitals travel times...')
    
    // Get unassigned hospitals
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = (assignments || []).map(a => a.hospital_id)
    
    // Get unassigned hospitals
    const query = supabase
      .from('hospitals')
      .select('id, code, name, lat, lng, municipality_id, department_id, municipality_name, beds, service_level')
      .eq('active', true)
    
    if (assignedIds.length > 0) {
      query.not('id', 'in', `(${assignedIds.join(',')})`)
    }

    const { data: hospitals, error: hospitalsError } = await query

    if (hospitalsError) {
      console.error('Error fetching hospitals:', hospitalsError)
      return NextResponse.json({ error: hospitalsError.message }, { status: 500 })
    }

    console.log(`Found ${hospitals?.length || 0} unassigned hospitals`)

    // Get all active KAMs
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id, name, lat, lng')
      .eq('active', true)

    if (kamsError) {
      console.error('Error fetching KAMs:', kamsError)
      return NextResponse.json({ error: kamsError.message }, { status: 500 })
    }

    console.log(`Found ${kams?.length || 0} active KAMs`)

    // Get ALL travel times from cache in one query
    const { data: allTravelTimes, error: cacheError } = await supabase
      .from('travel_time_cache')
      .select('origin_lat, origin_lng, dest_lat, dest_lng, travel_time')

    if (cacheError) {
      console.error('Error fetching travel time cache:', cacheError)
      return NextResponse.json({ error: 'Failed to fetch travel times' }, { status: 500 })
    }

    console.log(`Loaded ${allTravelTimes?.length || 0} travel time records from cache`)

    // Create a map for fast lookup
    const travelTimeMap = new Map<string, number>()
    allTravelTimes?.forEach(tt => {
      const key = `${tt.origin_lat.toFixed(4)}_${tt.origin_lng.toFixed(4)}_${tt.dest_lat.toFixed(4)}_${tt.dest_lng.toFixed(4)}`
      travelTimeMap.set(key, tt.travel_time)
    })

    // Process each unassigned hospital
    const unassignedWithTimes = (hospitals || []).map(hospital => {
      const travelTimes = (kams || []).map(kam => {
        // Try to find travel time in cache with tolerance
        let travelTime = null
        
        // Try exact match first
        const exactKey = `${kam.lat.toFixed(4)}_${kam.lng.toFixed(4)}_${hospital.lat.toFixed(4)}_${hospital.lng.toFixed(4)}`
        if (travelTimeMap.has(exactKey)) {
          travelTime = travelTimeMap.get(exactKey)
        } else {
          // Try with slight variations (for floating point differences)
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              const nearKey = `${(kam.lat + i * 0.0001).toFixed(4)}_${(kam.lng + j * 0.0001).toFixed(4)}_${hospital.lat.toFixed(4)}_${hospital.lng.toFixed(4)}`
              if (travelTimeMap.has(nearKey)) {
                travelTime = travelTimeMap.get(nearKey)
                break
              }
            }
            if (travelTime) break
          }
        }

        return {
          kam_id: kam.id,
          kam_name: kam.name,
          travel_time: travelTime
        }
      })

      // Sort by travel time and filter out nulls
      const sortedTimes = travelTimes
        .filter(tt => tt.travel_time !== null)
        .sort((a, b) => (a.travel_time || 0) - (b.travel_time || 0))

      return {
        ...hospital,
        travel_times: sortedTimes
      }
    })

    console.log('Successfully processed all hospitals')

    return NextResponse.json({ 
      unassigned_hospitals: unassignedWithTimes,
      total: unassignedWithTimes.length,
      debug: {
        total_hospitals: hospitals?.length || 0,
        total_kams: kams?.length || 0,
        cache_size: allTravelTimes?.length || 0
      }
    })
  } catch (error) {
    console.error('Error in unassigned travel times API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}