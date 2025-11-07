import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET() {
  try {
    // Obtener todas las zonas con sus KAMs
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select(`
        *,
        zone_kams (
          *,
          kams (
            id,
            name,
            area_id,
            color
          )
        )
      `)
      .eq('active', true)
      .order('name');

    if (zonesError) throw zonesError;

    // Transformar los datos para una estructura más limpia
    const formattedZones = zones?.map(zone => ({
      ...zone,
      kams: zone.zone_kams?.map((zk: any) => ({
        ...zk.kams,
        is_primary: zk.is_primary
      }))
    }));

    return NextResponse.json(formattedZones || []);
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