import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UpdateProveedorDTO } from '@/types/providers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/providers/[id] - Obtener un proveedor específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const { data, error } = await supabase
      .from('proveedores')
      .select(`
        *,
        finanzas:proveedor_finanzas(*),
        indicadores:proveedor_indicadores(*),
        contactos:proveedor_contactos(*),
        documentos:proveedor_documentos(*),
        contratos:hospital_contracts(
          *,
          hospital:hospitals(
            id,
            name,
            municipality_name,
            department_name
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Proveedor no encontrado' },
          { status: 404 }
        );
      }
      console.error('Error fetching provider:', error);
      return NextResponse.json(
        { error: 'Error al obtener proveedor', details: error.message },
        { status: 500 }
      );
    }
    
    // Ordenar finanzas e indicadores por año
    if (data.finanzas) {
      data.finanzas.sort((a: any, b: any) => b.anio - a.anio);
    }
    if (data.indicadores) {
      data.indicadores.sort((a: any, b: any) => b.anio - a.anio);
    }
    
    return NextResponse.json({
      data,
      success: true
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/providers/[id] - Actualizar un proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: UpdateProveedorDTO = await request.json();
    
    // Verificar que el proveedor existe
    const { data: existing } = await supabase
      .from('proveedores')
      .select('id')
      .eq('id', id)
      .single();
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }
    
    // Si se está actualizando el NIT, verificar que no exista otro con el mismo
    if (body.nit) {
      const { data: duplicateNit } = await supabase
        .from('proveedores')
        .select('id')
        .eq('nit', body.nit)
        .neq('id', id)
        .single();
      
      if (duplicateNit) {
        return NextResponse.json(
          { error: 'Ya existe otro proveedor con ese NIT' },
          { status: 409 }
        );
      }
    }
    
    // Actualizar el proveedor
    const { data, error } = await supabase
      .from('proveedores')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating provider:', error);
      return NextResponse.json(
        { error: 'Error al actualizar proveedor', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      data,
      success: true,
      message: 'Proveedor actualizado exitosamente'
    });
    
  } catch (error) {
    console.error('Error in PUT /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/providers/[id] - Eliminar un proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Verificar si tiene contratos asociados
    const { data: contracts } = await supabase
      .from('hospital_contracts')
      .select('id')
      .eq('proveedor_id', id)
      .limit(1);
    
    if (contracts && contracts.length > 0) {
      return NextResponse.json(
        { 
          error: 'No se puede eliminar el proveedor porque tiene contratos asociados',
          suggestion: 'Puede cambiar el estado a "inactivo" en lugar de eliminarlo'
        },
        { status: 409 }
      );
    }
    
    // Eliminar el proveedor (esto eliminará en cascada finanzas, indicadores, etc.)
    const { error } = await supabase
      .from('proveedores')
      .delete()
      .eq('id', id);
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Proveedor no encontrado' },
          { status: 404 }
        );
      }
      console.error('Error deleting provider:', error);
      return NextResponse.json(
        { error: 'Error al eliminar proveedor', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/providers/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}