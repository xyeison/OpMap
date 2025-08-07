import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Obtener todos los hospitales no asignados
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = assignments?.map(a => a.hospital_id) || []
    
    // Obtener hospitales no asignados agrupados por departamento
    const { data: unassignedHospitals } = await supabase
      .from('hospitals')
      .select('id, name, department_id, department_name, municipality_name, lat, lng')
      .eq('active', true)
      .not('id', 'in', assignedIds.length > 0 ? `(${assignedIds.join(',')})` : '(null)')
      .order('department_id')
    
    // Agrupar por departamento
    const byDepartment: Record<string, any[]> = {}
    let totalUnassigned = 0
    
    unassignedHospitals?.forEach(hospital => {
      const deptName = hospital.department_name || 'Unknown'
      if (!byDepartment[deptName]) {
        byDepartment[deptName] = []
      }
      byDepartment[deptName].push({
        name: hospital.name,
        municipality: hospital.municipality_name,
        coords: `${hospital.lat}, ${hospital.lng}`
      })
      totalUnassigned++
    })
    
    // Crear resumen
    const summary = Object.entries(byDepartment).map(([dept, hospitals]) => ({
      department: dept,
      count: hospitals.length,
      sample: hospitals.slice(0, 3)
    })).sort((a, b) => b.count - a.count)
    
    // Verificar departamentos excluidos
    const excludedDepts = ['27', '97', '99', '88', '95', '94', '91']
    const hospitalsInExcluded = unassignedHospitals?.filter(h => 
      excludedDepts.includes(h.department_id)
    )
    
    return NextResponse.json({
      totalUnassigned,
      byDepartment: summary,
      excludedDepartments: {
        count: hospitalsInExcluded?.length || 0,
        list: hospitalsInExcluded?.map(h => ({
          name: h.name,
          department: h.department_name
        }))
      },
      topUnassigned: unassignedHospitals?.slice(0, 10).map(h => ({
        name: h.name,
        location: `${h.municipality_name}, ${h.department_name}`,
        coords: `${h.lat}, ${h.lng}`
      }))
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error analyzing unassigned hospitals' }, { status: 500 })
  }
}