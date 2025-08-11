import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// GET /api/providers/[id]/finances - Obtener datos financieros del proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const proveedorId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const anio = searchParams.get('anio');
    
    let query = supabase
      .from('proveedor_finanzas')
      .select(`
        *,
        indicadores:proveedor_indicadores(*)
      `)
      .eq('proveedor_id', proveedorId)
      .order('anio', { ascending: false });
    
    if (anio) {
      query = query.eq('anio', parseInt(anio));
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching financial data:', error);
      return NextResponse.json(
        { error: 'Error al obtener datos financieros', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      data: data || [],
      success: true
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers/[id]/finances:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/providers/[id]/finances - Crear datos financieros
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const proveedorId = params.id;
    const body = await request.json();
    
    // Validar que el proveedor existe
    const { data: provider } = await supabase
      .from('proveedores')
      .select('id')
      .eq('id', proveedorId)
      .single();
    
    if (!provider) {
      return NextResponse.json(
        { error: 'Proveedor no encontrado' },
        { status: 404 }
      );
    }
    
    // Validar año
    if (!body.anio || body.anio < 2000 || body.anio > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: 'Año inválido' },
        { status: 400 }
      );
    }
    
    // Validar campos numéricos con precisión 10,4 (máximo 999999.9999)
    const numericFields10_4 = [
      'tipo_cambio', 'indice_liquidez', 'prueba_acida', 'indice_endeudamiento',
      'apalancamiento_financiero', 'cobertura_intereses', 'margen_bruto',
      'margen_operacional', 'margen_neto', 'margen_ebitda', 'roe', 'roa', 'roic',
      'rotacion_activos', 'rotacion_cartera', 'rotacion_inventarios'
    ];
    
    for (const field of numericFields10_4) {
      if (body[field] !== undefined && body[field] !== null) {
        const value = parseFloat(body[field]);
        if (isNaN(value)) {
          return NextResponse.json(
            { error: `El campo ${field} debe ser un número válido` },
            { status: 400 }
          );
        }
        if (Math.abs(value) >= 1000000) {
          return NextResponse.json(
            { 
              error: `El campo ${field} excede el valor máximo permitido`,
              details: `El valor ${value} es muy grande. El máximo permitido es 999,999.9999`,
              suggestion: 'Verifique que los valores estén en las unidades correctas (ej: porcentajes como 0.15 en lugar de 15)'
            },
            { status: 400 }
          );
        }
        // Asegurar que el valor tiene máximo 4 decimales
        body[field] = Math.round(value * 10000) / 10000;
      }
    }
    
    // Validar campos numéricos grandes (15,2)
    const numericFields15_2 = [
      'activo_corriente', 'activo_no_corriente', 'activo_total',
      'pasivo_corriente', 'pasivo_no_corriente', 'pasivo_total',
      'patrimonio', 'ingresos_operacionales', 'costos_ventas',
      'utilidad_bruta', 'gastos_operacionales', 'utilidad_operacional',
      'gastos_intereses', 'otros_ingresos', 'otros_gastos',
      'utilidad_antes_impuestos', 'impuestos', 'utilidad_neta',
      'inventarios', 'cuentas_por_cobrar', 'efectivo',
      'capital_trabajo', 'ebitda', 'capital_trabajo_neto'
    ];
    
    for (const field of numericFields15_2) {
      if (body[field] !== undefined && body[field] !== null) {
        const value = parseFloat(body[field]);
        if (isNaN(value)) {
          return NextResponse.json(
            { error: `El campo ${field} debe ser un número válido` },
            { status: 400 }
          );
        }
        // Asegurar que el valor tiene máximo 2 decimales
        body[field] = Math.round(value * 100) / 100;
      }
    }
    
    // Verificar si ya existen datos para ese año
    const { data: existing } = await supabase
      .from('proveedor_finanzas')
      .select('id')
      .eq('proveedor_id', proveedorId)
      .eq('anio', body.anio)
      .single();
    
    let result;
    
    if (existing) {
      // Actualizar datos existentes
      const { data, error } = await supabase
        .from('proveedor_finanzas')
        .update({
          ...body,
          proveedor_id: proveedorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating financial data:', error);
        
        if (error.code === '42501') {
          return NextResponse.json(
            { error: 'No tiene permisos para actualizar datos financieros. Las políticas RLS pueden estar bloqueando el acceso.' },
            { status: 403 }
          );
        }
        
        return NextResponse.json(
          { 
            error: 'Error al actualizar datos financieros',
            details: error.message,
            suggestion: 'Verifique que todos los valores numéricos sean válidos'
          },
          { status: 500 }
        );
      }
      
      result = data;
    } else {
      // Crear nuevos datos
      const { data, error } = await supabase
        .from('proveedor_finanzas')
        .insert({
          ...body,
          proveedor_id: proveedorId
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating financial data:', error);
        console.error('Environment check:', {
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          nodeEnv: process.env.NODE_ENV
        });
        
        if (error.code === '42501') {
          // Incluir información adicional para debugging
          const debugInfo = process.env.NODE_ENV === 'development' ? 
            ` (Service key: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY})` : '';
          
          return NextResponse.json(
            { 
              error: `No tiene permisos para crear datos financieros. Las políticas RLS pueden estar bloqueando el acceso${debugInfo}.`,
              suggestion: 'Verifique que la service key esté configurada correctamente en las variables de entorno.'
            },
            { status: 403 }
          );
        }
        
        if (error.code === '23502') {
          return NextResponse.json(
            { error: 'Faltan campos requeridos. Verifique que el año esté especificado.' },
            { status: 400 }
          );
        }
        
        if (error.code === '23503') {
          return NextResponse.json(
            { error: 'El proveedor especificado no existe.' },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { 
            error: 'Error al crear datos financieros',
            details: error.message,
            suggestion: 'Verifique que todos los valores numéricos sean válidos y que el año esté especificado'
          },
          { status: 500 }
        );
      }
      
      result = data;
    }
    
    // Los indicadores se calculan automáticamente por el trigger en la base de datos
    
    return NextResponse.json({
      data: result,
      success: true,
      message: existing ? 'Datos financieros actualizados' : 'Datos financieros creados'
    });
    
  } catch (error) {
    console.error('Error in POST /api/providers/[id]/finances:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/providers/[id]/finances/[financeId] - Actualizar datos financieros específicos
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; financeId: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('proveedor_finanzas')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.financeId)
      .eq('proveedor_id', params.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating financial data:', error);
      return NextResponse.json(
        { error: 'Error al actualizar datos financieros', details: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Datos financieros no encontrados' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      data,
      success: true,
      message: 'Datos financieros actualizados'
    });
    
  } catch (error) {
    console.error('Error in PUT /api/providers/[id]/finances:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/providers/[id]/finances/[financeId] - Eliminar datos financieros
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; financeId: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from('proveedor_finanzas')
      .delete()
      .eq('id', params.financeId)
      .eq('proveedor_id', params.id);
    
    if (error) {
      console.error('Error deleting financial data:', error);
      return NextResponse.json(
        { error: 'Error al eliminar datos financieros', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Datos financieros eliminados'
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/providers/[id]/finances:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}