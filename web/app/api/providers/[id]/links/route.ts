import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('proveedor_enlaces')
      .select('*')
      .eq('proveedor_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching links:', error);
      return NextResponse.json(
        { error: 'Error al obtener enlaces' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET links:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('proveedor_enlaces')
      .insert({
        proveedor_id: params.id,
        tipo: body.tipo,
        titulo: body.titulo,
        url: body.url,
        descripcion: body.descripcion
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating link:', error);
      return NextResponse.json(
        { error: 'Error al crear enlace' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in POST link:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}