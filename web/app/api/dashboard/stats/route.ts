import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { fetchAllRows, serverError } from '../../_lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    // Conteos con count exacto (sin traer filas) y lecturas paginadas para no truncar a 1.000 filas
    const [kamsResult, hospitalsResult, assignmentsResult, contractsResult, departmentsResult] =
      await Promise.all([
        supabaseAdmin.from('kams').select('id', { count: 'exact', head: true }).eq('active', true),
        supabaseAdmin.from('hospitals').select('id', { count: 'exact', head: true }).eq('active', true),
        supabaseAdmin.from('assignments').select('id', { count: 'exact', head: true }),
        fetchAllRows<{ contract_value: number | string | null }>((from, to) =>
          supabaseAdmin
            .from('hospital_contracts')
            .select('contract_value')
            .eq('active', true)
            .order('id')
            .range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabaseAdmin
            .from('assignments')
            .select('id, hospitals!inner(department_id)')
            .eq('hospitals.active', true)
            .order('id')
            .range(from, to)
        ),
      ])

    const firstError =
      kamsResult.error ||
      hospitalsResult.error ||
      assignmentsResult.error ||
      contractsResult.error ||
      departmentsResult.error
    if (firstError) return serverError('dashboard/stats GET', firstError)

    const uniqueDepartments = new Set(
      departmentsResult.data.map((a: any) => a.hospitals?.department_id).filter(Boolean)
    )

    const totalContractValue = contractsResult.data.reduce(
      (sum, c) => sum + (Number(c.contract_value) || 0),
      0
    )

    const stats = {
      totalKams: kamsResult.count || 0,
      totalHospitals: hospitalsResult.count || 0,
      assignedHospitals: assignmentsResult.count || 0,
      totalContractValue,
      activeDepartments: uniqueDepartments.size,
      coveragePercentage: 0,
    }

    if (stats.totalHospitals > 0) {
      stats.coveragePercentage = Number(
        ((stats.assignedHospitals / stats.totalHospitals) * 100).toFixed(1)
      )
    }

    return NextResponse.json(stats)
  } catch (error) {
    return serverError('dashboard/stats GET', error)
  }
}
