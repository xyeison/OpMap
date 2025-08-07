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

    // Verificar permisos - solo Admin y Gestor de Datos pueden remover asignaciones forzadas
    if (!hasPermission(user.role as any, 'territories:manage')) {
      return NextResponse.json(
        { error: 'No tienes permisos para remover asignaciones forzadas de territorio' },
        { status: 403 }
      )
    }

    const { territoryId, territoryType } = await request.json()

    if (!territoryId || !territoryType) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Obtener todos los hospitales del territorio
    let hospitalsQuery = supabase
      .from('hospitals')
      .select('id, lat, lng, municipality_id')
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

    // Eliminar asignaciones forzadas actuales
    const hospitalIds = hospitals.map(h => h.id)
    
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .in('hospital_id', hospitalIds)
      .eq('assignment_type', 'forced')

    if (deleteError) throw deleteError

    // Recalcular asignaciones normales basadas en distancia
    // Aquí simplemente eliminamos las asignaciones forzadas
    // El algoritmo OpMap se ejecutará posteriormente para reasignar
    
    // Por ahora, buscar el KAM más cercano para cada hospital basado en el territorio base
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id, area_id, lat, lng')
      .eq('active', true)

    if (kamsError) throw kamsError

    const newAssignments = []
    
    for (const hospital of hospitals) {
      // Buscar si algún KAM tiene este municipio como territorio base
      const baseKam = kams.find(kam => kam.area_id === hospital.municipality_id)
      
      if (baseKam) {
        newAssignments.push({
          hospital_id: hospital.id,
          kam_id: baseKam.id,
          assignment_type: 'base_territory',
          is_base_territory: true
        })
      }
      // Si no hay KAM base, el hospital quedará sin asignar hasta que se ejecute el algoritmo completo
    }

    if (newAssignments.length > 0) {
      const { error: insertError } = await supabase
        .from('assignments')
        .insert(newAssignments)

      if (insertError) throw insertError
    }

    return NextResponse.json({
      success: true,
      message: `Asignación forzada removida. ${newAssignments.length} hospitales reasignados a territorios base.`,
      hospitalsUpdated: hospitals.length,
      baseAssignments: newAssignments.length
    })
  } catch (error: any) {
    console.error('Error removing forced assignment:', error)
    return NextResponse.json(
      { error: error.message || 'Error al remover asignación forzada' },
      { status: 500 }
    )
  }
}