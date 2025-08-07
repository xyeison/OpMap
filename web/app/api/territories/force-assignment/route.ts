import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'
import { hasPermission } from '@/lib/permissions'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar permisos - solo Admin y Gestor de Datos pueden hacer asignaciones forzadas
    if (!hasPermission(user.role as any, 'territories:manage')) {
      return NextResponse.json(
        { error: 'No tienes permisos para realizar asignaciones forzadas de territorio' },
        { status: 403 }
      )
    }

    const { territoryId, territoryType, kamId, territoryName, reason } = await request.json()

    if (!territoryId || !territoryType || !kamId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Primero desactivar cualquier asignación forzada existente para este territorio
    const { error: deactivateError } = await supabase
      .from('forced_assignments')
      .update({ active: false })
      .eq('territory_id', territoryId)
      .eq('active', true)

    if (deactivateError) {
      console.error('Error desactivando asignaciones anteriores:', deactivateError)
    }

    // Crear nueva asignación forzada
    const { error: insertError } = await supabase
      .from('forced_assignments')
      .insert({
        territory_id: territoryId,
        territory_type: territoryType,
        territory_name: territoryName || territoryId,
        kam_id: kamId,
        reason: reason || null,
        active: true
      })

    if (insertError) {
      console.error('Error insertando asignación forzada:', insertError)
      return NextResponse.json(
        { error: 'Error al crear asignación forzada: ' + insertError.message },
        { status: 500 }
      )
    }

    // Obtener todos los hospitales del territorio
    let hospitalsQuery = supabase
      .from('hospitals')
      .select('id')
      .eq('active', true)

    if (territoryType === 'locality') {
      hospitalsQuery = hospitalsQuery.eq('locality_id', territoryId)
    } else {
      hospitalsQuery = hospitalsQuery.eq('municipality_id', territoryId)
    }

    const { data: hospitals, error: hospitalsError } = await hospitalsQuery

    if (hospitalsError) throw hospitalsError

    if (!hospitals || hospitals.length === 0) {
      return NextResponse.json(
        { message: 'No hay hospitales en este territorio', hospitalsUpdated: 0 },
        { status: 200 }
      )
    }

    // Eliminar asignaciones anteriores para estos hospitales
    const hospitalIds = hospitals.map(h => h.id)
    
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .in('hospital_id', hospitalIds)

    if (deleteError) throw deleteError

    // Crear nuevas asignaciones
    const newAssignments = hospitals.map(hospital => ({
      hospital_id: hospital.id,
      kam_id: kamId,
      assignment_type: 'forced',
      is_base_territory: false
    }))

    const { error: assignmentsError } = await supabase
      .from('assignments')
      .insert(newAssignments)

    if (assignmentsError) throw assignmentsError

    return NextResponse.json({
      success: true,
      message: `${hospitals.length} hospitales asignados correctamente`,
      hospitalsUpdated: hospitals.length
    })
  } catch (error: any) {
    console.error('Error in force-assignment:', error)
    return NextResponse.json(
      { error: error.message || 'Error al procesar asignación forzada' },
      { status: 500 }
    )
  }
}