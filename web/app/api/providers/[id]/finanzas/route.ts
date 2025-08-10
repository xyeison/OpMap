import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreateProveedorFinanzasDTO } from '@/types/providers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/providers/[id]/finanzas - Obtener información financiera del proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const anio = searchParams.get('anio');
    
    let query = supabase
      .from('proveedor_finanzas')
      .select(`
        *,
        indicadores:proveedor_indicadores(*)
      `)
      .eq('proveedor_id', id);
    
    if (anio) {
      query = query.eq('anio', parseInt(anio));
    } else {
      query = query.order('anio', { ascending: false });
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching provider finances:', error);
      return NextResponse.json(
        { error: 'Error al obtener información financiera', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      data: anio ? data[0] : data,
      success: true
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers/[id]/finanzas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/providers/[id]/finanzas - Agregar información financiera
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: CreateProveedorFinanzasDTO = await request.json();
    
    // Validar que el proveedor existe
    const { data: provider } = await supabase
      .from('proveedores')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }
    
    // Validar año
    const currentYear = new Date().getFullYear();
    if (body.anio < 2000 || body.anio > currentYear + 1) {
      return NextResponse.json(
        { error: `El año debe estar entre 2000 y ${currentYear + 1}` },
        { status: 400 }
      );
    }
    
    // Verificar si ya existe información para ese año
    const { data: existing } = await supabase
      .from('proveedor_finanzas')
      .select('id')
      .eq('proveedor_id', id)
      .eq('anio', body.anio)
      .single();
    
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe información financiera para el año ${body.anio}` },
        { status: 409 }
      );
    }
    
    // Calcular valores derivados si es necesario
    const finanzasData = {
      ...body,
      proveedor_id: id,
      // Calcular activo_total si no se proporciona
      activo_total: body.activo_total || 
        ((body.activo_corriente || 0) + (body.activo_no_corriente || 0)) || undefined,
      // Calcular pasivo_total si no se proporciona
      pasivo_total: body.pasivo_total || 
        ((body.pasivo_corriente || 0) + (body.pasivo_no_corriente || 0)) || undefined,
      // Calcular patrimonio si no se proporciona
      patrimonio: body.patrimonio || 
        (body.activo_total && body.pasivo_total ? 
          body.activo_total - body.pasivo_total : undefined),
      // Establecer valores por defecto
      fuente: body.fuente || 'manual',
      moneda: body.moneda || 'COP',
      tipo_cambio: body.tipo_cambio || 1
    };
    
    // Insertar la información financiera
    const { data, error } = await supabase
      .from('proveedor_finanzas')
      .insert(finanzasData)
      .select(`
        *,
        indicadores:proveedor_indicadores(*)
      `)
      .single();
    
    if (error) {
      console.error('Error creating provider finances:', error);
      return NextResponse.json(
        { error: 'Error al guardar información financiera', details: error.message },
        { status: 500 }
      );
    }
    
    // Los indicadores se calculan automáticamente por el trigger
    
    return NextResponse.json({
      data,
      success: true,
      message: 'Información financiera guardada exitosamente. Los indicadores se han calculado automáticamente.'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error in POST /api/providers/[id]/finanzas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/providers/[id]/finanzas/[anio] - Actualizar información financiera
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const anio = searchParams.get('anio');
    
    if (!anio) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro "anio" en la URL' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Verificar que existe la información financiera
    const { data: existing } = await supabase
      .from('proveedor_finanzas')
      .select('id')
      .eq('proveedor_id', id)
      .eq('anio', parseInt(anio))
      .single();
    
    if (!existing) {
      return NextResponse.json(
        { error: `No existe información financiera para el año ${anio}` },
        { status: 404 }
      );
    }
    
    // Recalcular valores derivados si es necesario
    const updateData = { ...body };
    
    // Si se actualizan activos, recalcular totales
    if (body.activo_corriente !== undefined || body.activo_no_corriente !== undefined) {
      const { data: current } = await supabase
        .from('proveedor_finanzas')
        .select('activo_corriente, activo_no_corriente')
        .eq('id', existing.id)
        .single();
      
      const activo_corriente = body.activo_corriente ?? current?.activo_corriente ?? 0;
      const activo_no_corriente = body.activo_no_corriente ?? current?.activo_no_corriente ?? 0;
      updateData.activo_total = activo_corriente + activo_no_corriente;
    }
    
    // Si se actualizan pasivos, recalcular totales
    if (body.pasivo_corriente !== undefined || body.pasivo_no_corriente !== undefined) {
      const { data: current } = await supabase
        .from('proveedor_finanzas')
        .select('pasivo_corriente, pasivo_no_corriente')
        .eq('id', existing.id)
        .single();
      
      const pasivo_corriente = body.pasivo_corriente ?? current?.pasivo_corriente ?? 0;
      const pasivo_no_corriente = body.pasivo_no_corriente ?? current?.pasivo_no_corriente ?? 0;
      updateData.pasivo_total = pasivo_corriente + pasivo_no_corriente;
    }
    
    // Recalcular patrimonio si cambian activos o pasivos totales
    if (updateData.activo_total !== undefined || updateData.pasivo_total !== undefined) {
      const { data: current } = await supabase
        .from('proveedor_finanzas')
        .select('activo_total, pasivo_total')
        .eq('id', existing.id)
        .single();
      
      const activo_total = updateData.activo_total ?? current?.activo_total ?? 0;
      const pasivo_total = updateData.pasivo_total ?? current?.pasivo_total ?? 0;
      updateData.patrimonio = activo_total - pasivo_total;
    }
    
    // Actualizar la información financiera
    const { data, error } = await supabase
      .from('proveedor_finanzas')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('proveedor_id', id)
      .eq('anio', parseInt(anio))
      .select(`
        *,
        indicadores:proveedor_indicadores(*)
      `)
      .single();
    
    if (error) {
      console.error('Error updating provider finances:', error);
      return NextResponse.json(
        { error: 'Error al actualizar información financiera', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      data,
      success: true,
      message: 'Información financiera actualizada. Los indicadores se han recalculado automáticamente.'
    });
    
  } catch (error) {
    console.error('Error in PUT /api/providers/[id]/finanzas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/providers/[id]/finanzas/[anio] - Eliminar información financiera
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const anio = searchParams.get('anio');
    
    if (!anio) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro "anio" en la URL' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('proveedor_finanzas')
      .delete()
      .eq('proveedor_id', id)
      .eq('anio', parseInt(anio));
    
    if (error) {
      console.error('Error deleting provider finances:', error);
      return NextResponse.json(
        { error: 'Error al eliminar información financiera', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Información financiera del año ${anio} eliminada exitosamente`
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/providers/[id]/finanzas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}