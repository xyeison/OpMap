import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Obtener todas las zonas
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('*')
      .eq('active', true)
      .order('name');

    if (zonesError) throw zonesError;

    // Para cada zona, obtener los KAMs asociados
    const formattedZones = await Promise.all(
      (zones || []).map(async (zone) => {
        const { data: kams } = await supabase
          .from('kams')
          .select('id, name, area_id, color')
          .eq('zone_id', zone.id)
          .eq('active', true);

        return {
          ...zone,
          kams: kams || []
        };
      })
    );

    return NextResponse.json(formattedZones);
  } catch (error) {
    console.error('Error fetching zones:', error);
    return NextResponse.json(
      { error: 'Error fetching zones' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, name, description, coordinator_name, coordinator_email, coordinator_phone, color } = body;

    // Crear nueva zona
    const { data, error } = await supabase
      .from('zones')
      .insert({
        code,
        name,
        description,
        coordinator_name,
        coordinator_email,
        coordinator_phone,
        color
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating zone:', error);
    return NextResponse.json(
      { error: 'Error creating zone' },
      { status: 500 }
    );
  }
}