import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener todas las estadísticas en paralelo
    const [kamsResult, hospitalsResult, assignmentsResult, contractsResult, departmentsResult] = await Promise.all([
      supabase.from('kams').select('*').eq('active', true),
      supabase.from('hospitals').select('*').eq('active', true),
      supabase.from('assignments').select('*'),
      supabase.from('hospital_contracts').select('contract_value').eq('active', true),
      supabase.from('assignments').select('hospitals!inner(department_id)').eq('hospitals.active', true)
    ])

    // Calcular departamentos únicos
    const uniqueDepartments = new Set(
      departmentsResult.data?.map((a: any) => a.hospitals?.department_id).filter(Boolean) || []
    )

    // Calcular valor total de contratos
    const totalContractValue = contractsResult.data?.reduce((sum, c) => sum + (Number(c.contract_value) || 0), 0) || 0

    const stats = {
      totalKams: kamsResult.data?.length || 0,
      totalHospitals: hospitalsResult.data?.length || 0,
      assignedHospitals: assignmentsResult.data?.length || 0,
      totalContractValue: totalContractValue,
      activeDepartments: uniqueDepartments.size,
      coveragePercentage: 0
    }

    // Calcular porcentaje de cobertura
    if (stats.totalHospitals > 0) {
      stats.coveragePercentage = Number(((stats.assignedHospitals / stats.totalHospitals) * 100).toFixed(1))
    }

    console.log('Dashboard stats:', stats)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in GET /api/dashboard/stats:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}