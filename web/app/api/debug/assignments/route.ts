import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const kamId = searchParams.get('kam')

    // Obtener asignaciones por KAM
    let query = supabase
      .from('assignments')
      .select('*, hospitals!inner(*), kams!inner(*)')
    
    if (kamId) {
      query = query.eq('kam_id', kamId)
    }

    const { data: assignments, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Error obteniendo asignaciones', details: error }, { status: 500 })
    }

    // Agrupar por KAM
    const byKam: Record<string, any> = {}
    assignments?.forEach(assignment => {
      const kamId = assignment.kams.id
      if (!byKam[kamId]) {
        byKam[kamId] = {
          kam: assignment.kams,
          totalHospitals: 0,
          municipalities: new Set(),
          localities: new Set(),
          hospitals: []
        }
      }
      byKam[kamId].totalHospitals++
      if (assignment.hospitals.municipality_id) {
        byKam[kamId].municipalities.add(assignment.hospitals.municipality_id)
      }
      if (assignment.hospitals.locality_id) {
        byKam[kamId].localities.add(assignment.hospitals.locality_id)
      }
      byKam[kamId].hospitals.push({
        code: assignment.hospitals.code,
        name: assignment.hospitals.name,
        municipality_id: assignment.hospitals.municipality_id,
        locality_id: assignment.hospitals.locality_id
      })
    })

    // Convertir Sets a Arrays
    Object.values(byKam).forEach((data: any) => {
      data.municipalities = Array.from(data.municipalities)
      data.localities = Array.from(data.localities)
      data.totalTerritories = data.municipalities.length + data.localities.length
    })

    return NextResponse.json({
      totalAssignments: assignments?.length || 0,
      kamSummary: byKam,
      allKams: Object.keys(byKam).sort()
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}