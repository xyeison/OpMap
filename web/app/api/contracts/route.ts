import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../_lib/api-error'
import { CONTRACT_EDITABLE_COLUMNS, pickAllowed } from '../_lib/allow-list'

export async function GET(request: NextRequest) {
  // admin, contract_manager y sales_manager (contracts:view)
  const auth = await requirePermission(request, 'contracts:view')
  if (!auth.ok) return auth.response

  try {
    const { data: contractsData, error } = await supabaseAdmin
      .from('hospital_contracts')
      .select(`
        *,
        hospitals (
          id,
          name,
          code,
          municipality_id,
          department_id
        )
      `)
      .order('created_at', { ascending: false })

    if (error) return serverError('contracts GET', error, 'Error al cargar los contratos')

    // KAM asignado a cada hospital: dos consultas en bloque en lugar de 2 por contrato
    const hospitalIds = Array.from(
      new Set((contractsData || []).map(c => c.hospital_id).filter(Boolean))
    )

    const kamByHospital = new Map<string, { name: string }>()
    if (hospitalIds.length > 0) {
      const { data: assignments, error: assignmentsError } = await supabaseAdmin
        .from('assignments')
        .select('hospital_id, kam_id')
        .in('hospital_id', hospitalIds)
      if (assignmentsError) return serverError('contracts GET (assignments)', assignmentsError)

      const kamIds = Array.from(new Set((assignments || []).map(a => a.kam_id).filter(Boolean)))
      if (kamIds.length > 0) {
        const { data: kams, error: kamsError } = await supabaseAdmin
          .from('kams')
          .select('id, name')
          .in('id', kamIds)
        if (kamsError) return serverError('contracts GET (kams)', kamsError)

        const kamNames = new Map((kams || []).map(k => [k.id, k.name as string]))
        for (const a of assignments || []) {
          const name = kamNames.get(a.kam_id)
          if (name) kamByHospital.set(a.hospital_id, { name })
        }
      }
    }

    const contractsWithKams = (contractsData || []).map(contract => ({
      ...contract,
      hospital: contract.hospitals,
      kam: kamByHospital.get(contract.hospital_id) || null,
    }))

    return NextResponse.json(contractsWithKams)
  } catch (error) {
    return serverError('contracts GET', error)
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'contracts:edit')
  if (!auth.ok) return auth.response

  try {
    const body = await readJsonBody(request)
    if (!body || typeof body !== 'object') return badJson()

    // Allow-list de columnas reales de hospital_contracts
    const contractData = pickAllowed(body as Record<string, unknown>, CONTRACT_EDITABLE_COLUMNS)
    contractData.proveedor_id = isUuid(contractData.proveedor_id) ? contractData.proveedor_id : null

    if (!isUuid(contractData.hospital_id)) {
      return NextResponse.json({ error: 'hospital_id es requerido' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('hospital_contracts')
      .insert({ ...contractData, created_by: auth.user.id })
      .select()
      .single()

    if (error) return serverError('contracts POST', error, 'Error al crear el contrato')

    return NextResponse.json(data)
  } catch (error) {
    return serverError('contracts POST', error)
  }
}
