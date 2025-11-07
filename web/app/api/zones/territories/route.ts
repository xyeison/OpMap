import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');

    let query = supabase.from('zone_territory_assignments').select('*');

    if (zoneId) {
      query = query.eq('zone_id', zoneId);
    }

    const { data, error } = await query.order('territory_name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching zone territories:', error);
    return NextResponse.json(
      { error: 'Error fetching zone territories' },
      { status: 500 }
    );
  }
}