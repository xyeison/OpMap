import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Obtener todas las asignaciones actuales
    const { data: assignments } = await supabase
      .from('assignments')
      .select(`
        id,
        kam_id,
        hospital_id,
        assignment_type,
        hospitals!inner (
          municipality_id,
          name,
          department_id
        ),
        kams!inner (
          name,
          id
        )
      `)
    
    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No hay asignaciones en la base de datos' 
      })
    }
    
    // Verificar consistencia por municipio
    const municipalityData: Record<string, { 
      kams: Set<string>, 
      hospitals: Array<{name: string, kam: string}> 
    }> = {}
    
    assignments.forEach(assignment => {
      const municipalityId = assignment.hospitals.municipality_id
      const kamName = assignment.kams.name
      const hospitalName = assignment.hospitals.name
      
      if (!municipalityData[municipalityId]) {
        municipalityData[municipalityId] = {
          kams: new Set(),
          hospitals: []
        }
      }
      
      municipalityData[municipalityId].kams.add(kamName)
      municipalityData[municipalityId].hospitals.push({ 
        name: hospitalName, 
        kam: kamName 
      })
    })
    
    // Encontrar municipios con múltiples KAMs
    const inconsistentMunicipalities = Object.entries(municipalityData)
      .filter(([_, data]) => data.kams.size > 1)
      .map(([municipalityId, data]) => ({
        municipalityId,
        kamCount: data.kams.size,
        kams: Array.from(data.kams),
        hospitals: data.hospitals
      }))
    
    // Caso específico de Ibagué
    const ibagueData = municipalityData['73001']
    
    return NextResponse.json({
      success: true,
      summary: {
        totalAssignments: assignments.length,
        totalMunicipalities: Object.keys(municipalityData).length,
        inconsistentMunicipalities: inconsistentMunicipalities.length,
        algorithmVersion: 'municipality-based'
      },
      inconsistentMunicipalities: inconsistentMunicipalities.slice(0, 10), // Primeros 10
      ibague: ibagueData ? {
        kams: Array.from(ibagueData.kams),
        hospitalCount: ibagueData.hospitals.length,
        distribution: Array.from(ibagueData.kams).map(kam => ({
          kam,
          count: ibagueData.hospitals.filter(h => h.kam === kam).length
        }))
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}