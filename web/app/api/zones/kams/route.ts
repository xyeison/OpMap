import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { zone_id, kam_id, is_primary } = body;

    // Asignar KAM a zona
    const { data, error } = await supabase
      .from('zone_kams')
      .insert({
        zone_id,
        kam_id,
        is_primary
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error assigning KAM to zone:', error);
    return NextResponse.json(
      { error: 'Error assigning KAM to zone' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const kamId = searchParams.get('kamId');

    if (!zoneId || !kamId) {
      return NextResponse.json(
        { error: 'Zone ID and KAM ID are required' },
        { status: 400 }
      );
    }

    // Desasignar KAM de zona
    const { error } = await supabase
      .from('zone_kams')
      .delete()
      .eq('zone_id', zoneId)
      .eq('kam_id', kamId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing KAM from zone:', error);
    return NextResponse.json(
      { error: 'Error removing KAM from zone' },
      { status: 500 }
    );
  }
}