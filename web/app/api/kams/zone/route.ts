import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { kam_id, zone_id } = body;

    // Actualizar la zona del KAM
    const { data, error } = await supabase
      .from('kams')
      .update({ zone_id: zone_id || null })
      .eq('id', kam_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating KAM zone:', error);
    return NextResponse.json(
      { error: 'Error updating KAM zone' },
      { status: 500 }
    );
  }
}