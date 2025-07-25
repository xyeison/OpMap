import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // First get assigned hospital IDs
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('hospital_id')

    if (assignmentsError) {
      return NextResponse.json({ error: assignmentsError.message }, { status: 500 })
    }

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
      return NextResponse.json({ error: hospitalsError.message }, { status: 500 })
    }

    // Get all active KAMs
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id, name, lat, lng')
      .eq('active', true)

    if (kamsError) {
      return NextResponse.json({ error: kamsError.message }, { status: 500 })
    }

    // For each unassigned hospital, get travel times to all KAMs
    const unassignedWithTimes = await Promise.all(
      (hospitals || []).map(async (hospital) => {
        // Query travel times from cache for this hospital to all KAMs
        const travelTimes = await Promise.all(
          (kams || []).map(async (kam) => {
            // Use a small tolerance for floating point comparison
            const { data: cacheData } = await supabase
              .from('travel_time_cache')
              .select('travel_time')
              .gte('origin_lat', kam.lat - 0.0001)
              .lte('origin_lat', kam.lat + 0.0001)
              .gte('origin_lng', kam.lng - 0.0001)
              .lte('origin_lng', kam.lng + 0.0001)
              .gte('dest_lat', hospital.lat - 0.0001)
              .lte('dest_lat', hospital.lat + 0.0001)
              .gte('dest_lng', hospital.lng - 0.0001)
              .lte('dest_lng', hospital.lng + 0.0001)
              .limit(1)
              .single()

            return {
              kam_id: kam.id,
              kam_name: kam.name,
              travel_time: cacheData?.travel_time || null
            }
          })
        )

        // Sort by travel time (shortest first)
        const sortedTimes = travelTimes
          .filter(tt => tt.travel_time !== null)
          .sort((a, b) => (a.travel_time || 0) - (b.travel_time || 0))

        return {
          ...hospital,
          travel_times: sortedTimes
        }
      })
    )

    return NextResponse.json({ 
      unassigned_hospitals: unassignedWithTimes,
      total: unassignedWithTimes.length 
    })
  } catch (error) {
    console.error('Error fetching unassigned hospital travel times:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}