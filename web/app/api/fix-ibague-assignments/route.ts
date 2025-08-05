import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Cliente para Google Maps
async function calculateGoogleMapsTime(
  originLat: number, 
  originLng: number, 
  destLat: number, 
  destLng: number
): Promise<{ duration: number; distance: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&language=es&units=metric&key=${apiKey}`
  
  try {
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0]
      return {
        duration: element.duration.value,
        distance: element.distance.value / 1000
      }
    }
  } catch (error) {
    console.error('Error calling Google Maps:', error)
  }
  
  return null
}

export async function POST() {
  try {
    console.log('🔧 FIX PARA KAM IBAGUÉ INICIADO')
    
    // 1. Limpiar tiempos incorrectos (menores a 5 minutos = 300 segundos)
    console.log('1. Limpiando tiempos incorrectos del caché...')
    
    const { data: incorrectTimes, error: selectError } = await supabase
      .from('travel_time_cache')
      .select('id, travel_time, origin_lat, origin_lng, dest_lat, dest_lng')
      .lt('travel_time', 300) // Menos de 5 minutos
    
    if (incorrectTimes && incorrectTimes.length > 0) {
      console.log(`   Encontrados ${incorrectTimes.length} tiempos menores a 5 minutos`)
      
      // Eliminar tiempos incorrectos
      const { error: deleteError } = await supabase
        .from('travel_time_cache')
        .delete()
        .lt('travel_time', 300)
      
      if (!deleteError) {
        console.log(`   ✅ ${incorrectTimes.length} tiempos incorrectos eliminados`)
      }
    }
    
    // 2. Obtener datos del KAM de Ibagué
    console.log('2. Obteniendo datos del KAM de Ibagué...')
    
    const { data: ibagueKam } = await supabase
      .from('kams')
      .select('*')
      .eq('area_id', '73001')
      .eq('active', true)
      .single()
    
    if (!ibagueKam) {
      throw new Error('KAM de Ibagué no encontrado')
    }
    
    console.log(`   ✅ KAM: ${ibagueKam.name} (${ibagueKam.lat}, ${ibagueKam.lng})`)
    
    // 3. Identificar hospitales en departamentos donde Ibagué puede competir
    console.log('3. Identificando hospitales objetivo para Ibagué...')
    
    // Tolima (73) limita con: Caldas (17), Caquetá (18), Cundinamarca (25), 
    // Huila (41), Quindío (63), Risaralda (66), Valle del Cauca (76)
    const targetDepartments = ['73', '17', '18', '25', '41', '63', '66', '76']
    
    // Con nivel 2, agregar más departamentos
    const level2Departments = [
      '05', // Antioquia (vía Caldas)
      '11', // Bogotá (vía Cundinamarca)
      '15', // Boyacá (vía Cundinamarca)
      '19', // Cauca (vía Valle/Huila)
      '27', // Chocó (vía Valle/Risaralda)
      '50', // Meta (vía Cundinamarca/Huila)
      '52', // Nariño (vía Cauca)
      '85', // Casanare (vía Cundinamarca)
      '86', // Putumayo (vía Caquetá)
    ]
    
    const allTargetDepts = [...targetDepartments, ...level2Departments]
    
    const { data: targetHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .in('department_id', allTargetDepts)
      .eq('active', true)
    
    console.log(`   📊 ${targetHospitals?.length || 0} hospitales en departamentos objetivo`)
    
    // 4. Calcular rutas específicas para hospitales clave
    console.log('4. Calculando rutas críticas para Ibagué...')
    
    // Hospitales específicos importantes
    const criticalMunicipalities = [
      '25307', // Girardot
      '25269', // Facatativá
      '25175', // Chía
      '25286', // Funza
      '73268', // Espinal
      '73443', // Melgar
      '41001', // Neiva
      '63001', // Armenia
      '66001', // Pereira
      '76520', // Palmira
    ]
    
    const criticalHospitals = targetHospitals?.filter(h => 
      criticalMunicipalities.includes(h.municipality_id)
    ) || []
    
    console.log(`   🎯 ${criticalHospitals.length} hospitales críticos identificados`)
    
    let calculatedRoutes = 0
    
    for (const hospital of criticalHospitals) {
      // Verificar si ya existe
      const { data: existing } = await supabase
        .from('travel_time_cache')
        .select('id')
        .eq('origin_lat', ibagueKam.lat)
        .eq('origin_lng', ibagueKam.lng)
        .eq('dest_lat', hospital.lat)
        .eq('dest_lng', hospital.lng)
        .single()
      
      if (!existing) {
        const result = await calculateGoogleMapsTime(
          ibagueKam.lat, ibagueKam.lng,
          hospital.lat, hospital.lng
        )
        
        if (result) {
          await supabase
            .from('travel_time_cache')
            .insert({
              origin_lat: ibagueKam.lat,
              origin_lng: ibagueKam.lng,
              dest_lat: hospital.lat,
              dest_lng: hospital.lng,
              travel_time: result.duration,
              distance: result.distance,
              source: 'google_maps'
            })
          
          calculatedRoutes++
          const minutes = Math.round(result.duration/60)
          console.log(`      ✅ ${hospital.municipality_id} (${hospital.municipality_name}): ${minutes} min`)
          
          if (minutes <= 240) {
            console.log(`         → ¡Dentro del límite de 4 horas!`)
          }
          
          // Pequeña pausa
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
    }
    
    console.log(`   ✅ ${calculatedRoutes} nuevas rutas calculadas`)
    
    // 5. Recalcular todas las asignaciones
    console.log('5. Recalculando todas las asignaciones...')
    
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize()
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // 6. Verificar asignaciones del KAM de Ibagué
    console.log('6. Verificando resultados para Ibagué...')
    
    const { data: ibagueAssignments } = await supabase
      .from('assignments')
      .select('*, hospitals!inner(municipality_id, municipality_name)')
      .eq('kam_id', ibagueKam.id)
    
    const municipalities = new Set(ibagueAssignments?.map(a => 
      `${a.hospitals.municipality_id} - ${a.hospitals.municipality_name}`
    ))
    
    console.log(`\n📊 RESULTADO FINAL:`)
    console.log(`   KAM Ibagué ahora tiene ${ibagueAssignments?.length || 0} hospitales`)
    console.log(`   Municipios asignados:`)
    municipalities.forEach(m => console.log(`      - ${m}`))
    
    // Verificar específicamente Girardot
    const hasGirardot = ibagueAssignments?.some(a => 
      a.hospitals.municipality_id === '25307'
    )
    
    if (hasGirardot) {
      console.log(`\n   ✅ ¡ÉXITO! Girardot ahora está asignado a Ibagué`)
    } else {
      console.log(`\n   ❌ Girardot NO se asignó a Ibagué`)
      
      // Verificar quién tiene Girardot
      const { data: girardotAssignment } = await supabase
        .from('assignments')
        .select('*, kams!inner(name), hospitals!inner(municipality_id)')
        .eq('hospitals.municipality_id', '25307')
        .limit(1)
        .single()
      
      if (girardotAssignment) {
        console.log(`      Girardot está asignado a: ${girardotAssignment.kams.name}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Fix para Ibagué completado',
      summary: {
        incorrectTimesDeleted: incorrectTimes?.length || 0,
        newRoutesCalculated: calculatedRoutes,
        ibagueHospitals: ibagueAssignments?.length || 0,
        hasGirardot: hasGirardot
      }
    })
    
  } catch (error) {
    console.error('Error en fix de Ibagué:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}