import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/require-role';
import { isUuid, serverError } from '../../../_lib/api-error';

// GET /api/providers/[id]/contracts - Obtener contratos del proveedor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'providers:view');
  if (!auth.ok) return auth.response;

  try {
    const proveedorId = params.id;
    if (!isUuid(proveedorId)) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }
    
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
    
    if (error) return serverError('providers/[id]/contracts GET', error, 'Error al obtener contratos');
    
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