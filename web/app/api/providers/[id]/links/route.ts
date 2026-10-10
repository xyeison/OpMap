import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/require-role';
import { badJson, isUuid, readJsonBody } from '../../../_lib/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'providers:view');
  if (!auth.ok) return auth.response;

  try {
    const supabase = supabaseAdmin;
    
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
  const auth = await requirePermission(request, 'providers:edit');
  if (!auth.ok) return auth.response;

  try {
    const supabase = supabaseAdmin;
    if (!isUuid(params.id)) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }
    const body = (await readJsonBody(request)) as Record<string, any> | undefined;
    if (!body || typeof body !== 'object') return badJson();

    // Solo enlaces http(s): evita javascript: u otros esquemas en href
    let validUrl = false;
    try {
      const parsedUrl = new URL(String(body.url));
      validUrl = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      validUrl = false;
    }
    if (!validUrl) {
      return NextResponse.json({ error: 'URL no válida (debe empezar por http:// o https://)' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('proveedor_enlaces')
      .insert({
        proveedor_id: params.id,
        tipo_enlace: body.tipo_enlace,
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