import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Get compliance dashboard data from the view
    const { data, error } = await supabase
      .from('v_cumplimiento_contratos')
      .select('*')
      .order('cumple_requisitos', { ascending: false })
      .order('prioridad_temporal')
      .order('valor_oportunidad', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching compliance dashboard:', error);
      return NextResponse.json(
        { error: 'Error al obtener dashboard de cumplimiento' },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const total = data?.length || 0;
    const cumple = data?.filter(c => c.cumple_requisitos === true).length || 0;
    const noCumple = data?.filter(c => c.cumple_requisitos === false).length || 0;
    const sinValidar = data?.filter(c => c.cumple_requisitos === null).length || 0;
    
    const valorTotalCumple = data
      ?.filter(c => c.cumple_requisitos === true)
      .reduce((sum, c) => sum + (c.contract_value || 0), 0) || 0;
    
    const valorTotalNoCumple = data
      ?.filter(c => c.cumple_requisitos === false)
      .reduce((sum, c) => sum + (c.contract_value || 0), 0) || 0;

    return NextResponse.json({
      data,
      summary: {
        total,
        cumple,
        noCumple,
        sinValidar,
        valorTotalCumple,
        valorTotalNoCumple,
        porcentajeCumplimiento: total > 0 ? (cumple / total * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error in GET compliance dashboard:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Validate all contracts
    const { data: contracts, error: fetchError } = await supabase
      .from('hospital_contracts')
      .select('id')
      .eq('active', true);

    if (fetchError) {
      console.error('Error fetching contracts:', fetchError);
      return NextResponse.json(
        { error: 'Error al obtener contratos' },
        { status: 500 }
      );
    }

    let validatedCount = 0;
    let errors = [];

    for (const contract of contracts || []) {
      const { data, error } = await supabase
        .rpc('validar_cumplimiento_contrato', { p_contract_id: contract.id });

      if (error) {
        errors.push({ contractId: contract.id, error: error.message });
      } else {
        validatedCount++;
      }
    }

    return NextResponse.json({
      message: `Validación completada: ${validatedCount} contratos procesados`,
      validatedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in POST compliance validation:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}