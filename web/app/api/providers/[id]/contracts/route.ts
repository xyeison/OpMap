import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/providers/[id]/contracts - Obtener contratos del proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proveedorId = params.id;
    
    // Obtener contratos del proveedor con información del hospital
    const { data: contracts, error } = await supabase
      .from('hospital_contracts')
      .select(`
        *,
        hospital:hospitals(
          id,
          name,
          municipality_name,
          department_name,
          beds
        )
      `)
      .eq('proveedor_id', proveedorId)
      .order('end_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching provider contracts:', error);
      return NextResponse.json(
        { error: 'Error al obtener contratos', details: error.message },
        { status: 500 }
      );
    }
    
    // Formatear los contratos con información adicional
    const formattedContracts = contracts?.map(contract => ({
      ...contract,
      hospital_name: contract.hospital?.name,
      municipality_name: contract.hospital?.municipality_name,
      department_name: contract.hospital?.department_name,
      hospital_beds: contract.hospital?.beds,
      estado_vigencia: getContractStatus(contract.end_date),
      dias_vigencia: getDaysToExpiry(contract.end_date)
    })) || [];
    
    return NextResponse.json({
      contracts: formattedContracts,
      total: formattedContracts.length,
      success: true
    });
    
  } catch (error) {
    console.error('Error in GET /api/providers/[id]/contracts:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Funciones auxiliares
function getContractStatus(endDate: string): string {
  const today = new Date();
  const end = new Date(endDate);
  
  if (end < today) {
    const daysSince = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 30) return 'vencido_reciente';
    if (daysSince <= 90) return 'vencido';
    return 'vencido_antiguo';
  }
  
  const daysUntil = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 30) return 'por_vencer_pronto';
  if (daysUntil <= 90) return 'por_vencer';
  return 'vigente';
}

function getDaysToExpiry(endDate: string): number {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}