import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from('hospital_contracts')
      .select(`
        indice_liquidez_requerido,
        indice_endeudamiento_maximo,
        cobertura_intereses_minimo,
        patrimonio_minimo,
        capital_trabajo_minimo,
        experiencia_anos_minimo,
        facturacion_anual_minima,
        rentabilidad_minima,
        otros_requisitos,
        requisitos_financieros
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching requirements:', error);
      return NextResponse.json(
        { error: 'Error al obtener requisitos' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET requirements:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('hospital_contracts')
      .update({
        indice_liquidez_requerido: body.indice_liquidez_requerido,
        indice_endeudamiento_maximo: body.indice_endeudamiento_maximo,
        cobertura_intereses_minimo: body.cobertura_intereses_minimo,
        patrimonio_minimo: body.patrimonio_minimo,
        capital_trabajo_minimo: body.capital_trabajo_minimo,
        experiencia_anos_minimo: body.experiencia_anos_minimo,
        facturacion_anual_minima: body.facturacion_anual_minima,
        rentabilidad_minima: body.rentabilidad_minima,
        otros_requisitos: body.otros_requisitos,
        fecha_validacion_requisitos: null, // Reset validation when requirements change
        cumple_requisitos: null
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating requirements:', error);
      return NextResponse.json(
        { error: 'Error al actualizar requisitos' },
        { status: 500 }
      );
    }

    // Trigger validation
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validar_cumplimiento_contrato', { p_contract_id: params.id });

    if (validationError) {
      console.error('Error validating compliance:', validationError);
    }

    return NextResponse.json({ 
      data,
      validation: validationResult 
    });
  } catch (error) {
    console.error('Error in PUT requirements:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}