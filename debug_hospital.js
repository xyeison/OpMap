// Script para debuggear el hospital específico
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function debugHospital() {
  const hospitalId = 'b0e473d6-93d7-458e-a2ea-74bb4058a84b'
  
  console.log('🔍 Debuggeando hospital:', hospitalId)
  
  try {
    // 1. Obtener información del hospital
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .single()
    
    if (hospitalError) {
      console.error('❌ Error obteniendo hospital:', hospitalError)
      return
    }
    
    console.log('\n📋 INFORMACIÓN DEL HOSPITAL:')
    console.log('Nombre:', hospital.name)
    console.log('Código:', hospital.code)
    console.log('Departamento ID:', hospital.department_id)
    console.log('Municipio ID:', hospital.municipality_id)
    console.log('Localidad ID:', hospital.locality_id)
    console.log('Coordenadas:', hospital.lat, hospital.lng)
    console.log('Activo:', hospital.active)
    
    // 2. Verificar si el departamento está excluido
    const { data: department, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('code', hospital.department_id)
      .single()
    
    if (deptError) {
      console.error('❌ Error obteniendo departamento:', deptError)
    } else {
      console.log('\n🏛️ INFORMACIÓN DEL DEPARTAMENTO:')
      console.log('Nombre:', department.name)
      console.log('Excluido:', department.excluded)
    }
    
    // 3. Verificar si tiene asignación actual
    const { data: assignment, error: assignError } = await supabase
      .from('assignments')
      .select('*, kams(*)')
      .eq('hospital_id', hospitalId)
      .single()
    
    if (assignError && assignError.code !== 'PGRST116') {
      console.error('❌ Error obteniendo asignación:', assignError)
    } else if (assignment) {
      console.log('\n👤 ASIGNACIÓN ACTUAL:')
      console.log('KAM:', assignment.kams?.name)
      console.log('Tipo:', assignment.assignment_type)
      console.log('Tiempo de viaje:', assignment.travel_time, 'segundos')
    } else {
      console.log('\n❌ SIN ASIGNACIÓN ACTUAL')
    }
    
    // 4. Verificar si hay rutas calculadas
    const { data: routes, error: routesError } = await supabase
      .from('hospital_kam_distances')
      .select('*')
      .eq('hospital_id', hospitalId)
    
    if (routesError) {
      console.error('❌ Error obteniendo rutas:', routesError)
    } else {
      console.log('\n🛣️ RUTAS CALCULADAS:')
      console.log('Total rutas:', routes?.length || 0)
      
      if (routes && routes.length > 0) {
        routes.forEach(route => {
          console.log(`  - KAM ${route.kam_id}: ${route.travel_time} segundos (${Math.round(route.travel_time/60)} min)`)
        })
      }
    }
    
    // 5. Verificar KAMs activos
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (kamsError) {
      console.error('❌ Error obteniendo KAMs:', kamsError)
    } else {
      console.log('\n👥 KAMS ACTIVOS:')
      console.log('Total KAMs activos:', kams?.length || 0)
      
      // 6. Verificar qué KAMs podrían competir por este hospital
      console.log('\n🔍 ANÁLISIS DE COMPETENCIA:')
      
      if (kams) {
        for (const kam of kams) {
          const kamDept = kam.area_id.substring(0, 2)
          const hospitalDept = hospital.department_id
          
          console.log(`\nKAM: ${kam.name}`)
          console.log(`  Departamento KAM: ${kamDept}`)
          console.log(`  Departamento Hospital: ${hospitalDept}`)
          console.log(`  Mismo departamento: ${kamDept === hospitalDept}`)
          
          // Verificar si es territorio base
          const isBaseTerritory = kam.area_id === hospital.municipality_id || 
                                 kam.area_id === hospital.locality_id
          console.log(`  Es territorio base: ${isBaseTerritory}`)
          
          // Verificar si hay ruta calculada
          const route = routes?.find(r => r.kam_id === kam.id)
          console.log(`  Tiene ruta calculada: ${!!route}`)
          if (route) {
            console.log(`  Tiempo: ${route.travel_time} segundos (${Math.round(route.travel_time/60)} min)`)
            console.log(`  Límite KAM: ${kam.max_travel_time} minutos`)
            console.log(`  Dentro del límite: ${(route.travel_time/60) <= kam.max_travel_time}`)
          }
        }
      }
    }
    
    // 7. Verificar matriz de adyacencia
    const { data: adjacency, error: adjError } = await supabase
      .from('department_adjacency')
      .select('*')
      .eq('department_code', hospital.department_id)
    
    if (adjError) {
      console.error('❌ Error obteniendo adyacencia:', adjError)
    } else {
      console.log('\n🗺️ DEPARTAMENTOS ADYACENTES:')
      const adjacentDepts = adjacency?.map(a => a.adjacent_department_code) || []
      console.log('Departamentos adyacentes a', hospital.department_id, ':', adjacentDepts.join(', '))
    }
    
  } catch (error) {
    console.error('❌ Error general:', error)
  }
}

debugHospital()
