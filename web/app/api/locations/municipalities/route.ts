import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireUser } from '@/lib/require-role'
import { serverError } from '../../_lib/api-error'

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response

  try {
    const departmentId = request.nextUrl.searchParams.get('departmentId')

    if (!departmentId || !/^\d{1,2}$/.test(departmentId)) {
      return NextResponse.json({ error: 'departmentId es requerido' }, { status: 400 })
    }

    const deptId = departmentId.padStart(2, '0')

    const { data: municipalities, error } = await supabaseAdmin
      .from('municipalities')
      .select('code, name')
      .eq('department_code', deptId)
      .order('name')

    if (error) return serverError('locations/municipalities GET', error, 'Error al obtener municipios')

    return NextResponse.json((municipalities || []).map(m => ({ id: m.code, name: m.name })))
  } catch (error) {
    return serverError('locations/municipalities GET', error, 'Error al obtener municipios')
  }
}
