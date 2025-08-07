import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  try {
    const { territoryId, territoryType, kamId } = await request.json()

    if (!territoryId || !territoryType || !kamId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
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

    const { error: insertError } = await supabase
      .from('assignments')
      .insert(newAssignments)

    if (insertError) throw insertError

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