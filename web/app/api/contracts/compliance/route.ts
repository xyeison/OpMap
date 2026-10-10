import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response

  try {
    // Vista contract_compliance
    const { data: contracts, error } = await supabaseAdmin
      .from('contract_compliance')
      .select('*')
      .order('contract_number', { ascending: true })

    if (error) return serverError('contracts/compliance GET', error, 'Error al obtener el cumplimiento')

    // contract_id -> id para compatibilidad con el frontend (se mantiene contract_id)
    const transformedContracts = (contracts || []).map(contract => ({
      ...contract,
      id: contract.contract_id,
    }))

    return NextResponse.json({ contracts: transformedContracts, success: true })
  } catch (error) {
    return serverError('contracts/compliance GET', error)
  }
}
