import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/providers/search - Búsqueda rápida de proveedores
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const onlyActive = searchParams.get('active') === 'true';
    
    if (!query || query.length < 2) {
      return NextResponse.json({
        data: [],
        success: true,
        message: 'Ingrese al menos 2 caracteres para buscar'
      });
    }
    
    // Construir búsqueda
    let dbQuery = supabase
      .from('proveedores')
      .select('id, nit, nombre, tipo_empresa, estado')
      .or(`nombre.ilike.%${query}%,nit.ilike.%${query}%`)
      .order('nombre')
      .limit(limit);
    
    // Filtrar solo activos si se requiere
    if (onlyActive) {
      dbQuery = dbQuery.eq('estado', 'activo');
    }
    
    const { data, error } = await dbQuery;
    
    if (error) {
      console.error('Error searching providers:', error);
      return NextResponse.json(
        { error: 'Error al buscar proveedores', details: error.message },
        { status: 500 }
      );
    }
    
    // Formatear respuesta para uso en select/autocomplete
    const formattedData = data?.map(p => ({
      value: p.id,
      label: `${p.nombre} (${p.nit})`,
      data: {
        id: p.id,
        nit: p.nit,
        nombre: p.nombre,
        estado: p.estado
      }
    })) || [];
    
    // Si no hay coincidencias exactas, sugerir crear nuevo
    const exactMatch = data?.some(p => 
      p.nombre.toLowerCase() === query.toLowerCase() ||
      p.nit === query
    );
    
    if (!exactMatch && query.length >= 3) {
      formattedData.push({
        value: 'create-new',
        label: `Crear nuevo proveedor "${query}"`,
        data: {
          id: 'create-new',
          nit: '',
          nombre: query,
          estado: null
        } as any
      });
    }
    
    return NextResponse.json({
      data: formattedData,
      success: true,
      exactMatch
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers/search:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/providers/search/quick-create - Creación rápida desde el selector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, nit } = body;
    
    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }
    
    // Generar NIT temporal si no se proporciona
    const finalNit = nit || `TEMP-${Date.now()}`;
    
    // Verificar si ya existe
    const { data: existing } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .or(`nombre.ilike.${nombre},nit.eq.${finalNit}`)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { 
          error: 'Ya existe un proveedor similar',
          existing: {
            id: existing.id,
            nombre: existing.nombre
          }
        },
        { status: 409 }
      );
    }
    
    // Crear el proveedor con información mínima
    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        nombre,
        nit: finalNit,
        estado: 'activo',
        tipo_empresa: 'competidor', // Por defecto, se puede cambiar después
        notas_internas: 'Proveedor creado rápidamente desde selector. Completar información.'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating provider:', error);
      return NextResponse.json(
        { error: 'Error al crear proveedor', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      data: {
        value: data.id,
        label: `${data.nombre} (${data.nit})`,
        data
      },
      success: true,
      message: 'Proveedor creado exitosamente. Recuerde completar la información.',
      requiresUpdate: !nit // Indica si necesita actualizar el NIT
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error in POST /api/providers/search/quick-create:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}