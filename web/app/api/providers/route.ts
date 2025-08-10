import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Proveedor, CreateProveedorDTO, ProveedorFilters } from '@/types/providers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/providers - Listar proveedores con filtros
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extraer filtros
    const filters: ProveedorFilters = {
      search: searchParams.get('search') || undefined,
      estado: searchParams.get('estado') as any || undefined,
      cumple_requisitos: searchParams.get('cumple_requisitos') === 'true' ? true : undefined,
      categoria_riesgo: searchParams.get('categoria_riesgo') || undefined,
      departamento: searchParams.get('departamento') || undefined,
    };
    
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;
    
    // Construir query base
    let query = supabase
      .from('proveedores')
      .select(`
        *,
        indicadores:proveedor_indicadores(
          indice_liquidez,
          indice_endeudamiento,
          cobertura_intereses,
          cumple_todos_requisitos,
          score_salud_financiera,
          categoria_riesgo,
          anio
        ),
        contratos:hospital_contracts(count)
      `, { count: 'exact' });
    
    // Aplicar filtros
    if (filters.search) {
      query = query.or(`nombre.ilike.%${filters.search}%,nit.ilike.%${filters.search}%`);
    }
    
    if (filters.estado) {
      query = query.eq('estado', filters.estado);
    }
    
    if (filters.departamento) {
      query = query.eq('departamento', filters.departamento);
    }
    
    // Aplicar paginación
    query = query
      .order('nombre')
      .range(offset, offset + pageSize - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching providers:', error);
      return NextResponse.json(
        { error: 'Error al obtener proveedores', details: error.message },
        { status: 500 }
      );
    }
    
    // Filtrar por cumple_requisitos si es necesario (post-procesamiento)
    let filteredData = data || [];
    if (filters.cumple_requisitos !== undefined) {
      filteredData = filteredData.filter((p: any) => {
        const ultimoIndicador = p.indicadores
          ?.sort((a: any, b: any) => b.anio - a.anio)[0];
        return ultimoIndicador?.cumple_todos_requisitos === filters.cumple_requisitos;
      });
    }
    
    if (filters.categoria_riesgo) {
      filteredData = filteredData.filter((p: any) => {
        const ultimoIndicador = p.indicadores
          ?.sort((a: any, b: any) => b.anio - a.anio)[0];
        return ultimoIndicador?.categoria_riesgo === filters.categoria_riesgo;
      });
    }
    
    return NextResponse.json({
      data: filteredData,
      total: count || 0,
      page,
      pageSize,
      success: true
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/providers - Crear nuevo proveedor
export async function POST(request: NextRequest) {
  try {
    const body: CreateProveedorDTO = await request.json();
    
    // Validar campos requeridos
    if (!body.nit || !body.nombre) {
      return NextResponse.json(
        { error: 'NIT y nombre son requeridos' },
        { status: 400 }
      );
    }
    
    // Verificar si el NIT ya existe
    const { data: existing } = await supabase
      .from('proveedores')
      .select('id')
      .eq('nit', body.nit)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un proveedor con ese NIT' },
        { status: 409 }
      );
    }
    
    // Crear el proveedor
    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        ...body,
        estado: 'activo'
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
      data,
      success: true,
      message: 'Proveedor creado exitosamente'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error in POST /api/providers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}