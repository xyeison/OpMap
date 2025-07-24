import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Verificar si existe el KAM Medellín
    const { data: kam, error: kamError } = await supabase
      .from('kams')
      .select('*')
      .eq('id', 'medellin')
      .single()
    
    if (kamError) {
      return NextResponse.json({ error: 'KAM Medellín no encontrado', details: kamError }, { status: 404 })
    }

    // Obtener asignaciones de Medellín
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('*, hospitals!inner(*)')
      .eq('kam_id', 'medellin')
    
    if (assignError) {
      return NextResponse.json({ error: 'Error obteniendo asignaciones', details: assignError }, { status: 500 })
    }

    // Obtener municipios únicos asignados
    const uniqueMunicipalities = new Set(assignments?.map(a => a.hospitals.municipality_id) || [])
    const uniqueLocalities = new Set(assignments?.filter(a => a.hospitals.locality_id).map(a => a.hospitals.locality_id) || [])

    // Obtener algunos hospitales de Antioquia para verificar
    const { data: antioquiaHospitals } = await supabase
      .from('hospitals')
      .select('id, name, municipality_id, department_id')
      .eq('department_id', '05')
      .limit(10)

    return NextResponse.json({
      kam,
      totalAssignments: assignments?.length || 0,
      uniqueMunicipalities: Array.from(uniqueMunicipalities),
      uniqueLocalities: Array.from(uniqueLocalities),
      sampleAssignments: assignments?.slice(0, 5),
      antioquiaHospitalsSample: antioquiaHospitals
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}