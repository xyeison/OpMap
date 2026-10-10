import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/require-role';
import { badJson, readJsonBody, serverError } from '../../_lib/api-error';
import { escapeLike, sanitizeSearchTerm } from '../../_lib/allow-list';

// GET /api/providers/search - Búsqueda rápida de proveedores
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'providers:view');
  if (!auth.ok) return auth.response;

  try {
    const supabase = supabaseAdmin;
    const searchParams = request.nextUrl.searchParams;
    const query = sanitizeSearchTerm(searchParams.get('q') || '');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10));
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
      .select('id, nit, nombre, estado')
      .or(`nombre.ilike.%${query}%,nit.ilike.%${query}%`)
      .order('nombre')
      .limit(limit);
    
    // Filtrar solo activos si se requiere
    if (onlyActive) {
      dbQuery = dbQuery.eq('estado', 'activo');
    }
    
    const { data, error } = await dbQuery;
    
    if (error) return serverError('providers/search GET', error, 'Error al buscar proveedores');
    
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
  const auth = await requirePermission(request, 'providers:edit');
  if (!auth.ok) return auth.response;

  try {
    const supabase = supabaseAdmin;
    const body = (await readJsonBody(request)) as { nombre?: unknown; nit?: unknown } | undefined;
    if (!body || typeof body !== 'object') return badJson();
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 300) : '';
    const nit = typeof body.nit === 'string' ? body.nit.trim().slice(0, 50) : '';
    
    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }
    
    // Generar NIT temporal si no se proporciona
    const finalNit = nit || `TEMP-${Date.now()}`;
    
    // Verificar si ya existe (dos consultas: sin interpolar texto del usuario en un filtro .or())
    const [byName, byNit] = await Promise.all([
      supabase.from('proveedores').select('id, nombre').ilike('nombre', escapeLike(nombre)).limit(1),
      supabase.from('proveedores').select('id, nombre').eq('nit', finalNit).limit(1),
    ]);
    if (byName.error) return serverError('providers/search POST (nombre)', byName.error);
    if (byNit.error) return serverError('providers/search POST (nit)', byNit.error);
    const existing = byName.data?.[0] || byNit.data?.[0];
    
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
        created_by: auth.user.id,
        notas_internas: 'Proveedor creado rápidamente desde selector. Completar información.'
      })
      .select()
      .single();
    
    if (error) return serverError('providers/search POST', error, 'Error al crear proveedor');
    
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