import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('zone_statistics')
      .select('*')
      .order('zone_name');

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching zone statistics:', error);
    return NextResponse.json(
      { error: 'Error fetching zone statistics' },
      { status: 500 }
    );
  }
}