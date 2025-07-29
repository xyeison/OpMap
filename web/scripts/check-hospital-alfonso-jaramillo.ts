import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkHospitalAlfonsoJaramillo() {
  console.log('🔍 Verificando Hospital Regional Alfonso Jaramillo Salazar E.S.E.\n')

  // 1. Buscar el hospital
  const { data: hospitals } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('name', '%Alfonso Jaramillo Salazar%')
    .eq('active', true)

  if (!hospitals || hospitals.length === 0) {
    console.log('❌ Hospital no encontrado')
    return
  }

  const hospital = hospitals[0]
  console.log('✅ Hospital encontrado:')
  console.log(`- ID: ${hospital.id}`)
  console.log(`- Nombre: ${hospital.name}`)
  console.log(`- Municipio: ${hospital.municipality_name} (${hospital.municipality_id})`)
  console.log(`- Departamento: ${hospital.department_name} (${hospital.department_id})`)
  console.log(`- Coordenadas: ${hospital.lat}, ${hospital.lng}`)
  console.log(`- Camas: ${hospital.beds || 0}`)
  console.log(`- Nivel de servicio: ${hospital.service_level || 'N/A'}`)
  console.log(`- Activo: ${hospital.active ? 'SÍ' : 'NO'}`)
  
  // 2. Verificar si tiene asignación
  const { data: assignment } = await supabase
    .from('assignments')
    .select(`
      *,
      kams!inner(name)
    `)
    .eq('hospital_id', hospital.id)
    .single()

  if (assignment) {
    console.log(`\n⚠️ Hospital está asignado a: ${(assignment.kams as any).name}`)
    console.log(`- Tiempo de viaje: ${assignment.travel_time ? Math.round(assignment.travel_time / 60) + ' minutos' : 'No especificado'}`)
  } else {
    console.log('\n✅ Hospital NO está asignado (correcto - debería mostrar 3 KAMs más cercanos)')
  }

  // 3. Buscar tiempos de viaje calculados
  console.log('\n🚗 Buscando tiempos de viaje calculados para este hospital:')
  
  const { data: travelTimes } = await supabase
    .from('travel_time_cache')
    .select('*')
    .eq('dest_lat', hospital.lat)
    .eq('dest_lng', hospital.lng)

  console.log(`\nTiempos encontrados: ${travelTimes?.length || 0}`)
  
  if (travelTimes && travelTimes.length > 0) {
    // Mostrar las coordenadas exactas encontradas
    console.log('\nCoordenadas en travel_time_cache:')
    travelTimes.forEach((tt, idx) => {
      console.log(`${idx + 1}. origen: ${tt.origin_lat}, ${tt.origin_lng} -> destino: ${tt.dest_lat}, ${tt.dest_lng}`)
      console.log(`   Tiempo: ${Math.round(tt.travel_time / 60)} minutos (${tt.source})`)
    })
    
    // Obtener información de los KAMs
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)

    console.log('\nKAMs activos:', kams?.length || 0)

    // Mapear tiempos con KAMs
    const timesWithKams = travelTimes.map(tt => {
      const kam = kams?.find(k => 
        Math.abs(k.lat - tt.origin_lat) < 0.00001 && 
        Math.abs(k.lng - tt.origin_lng) < 0.00001
      )
      return {
        ...tt,
        kam_name: kam?.name || 'Desconocido',
        kam_id: kam?.id
      }
    }).filter(t => t.kam_id)

    // Ordenar por tiempo y mostrar los 3 más cercanos
    timesWithKams.sort((a, b) => a.travel_time - b.travel_time)
    
    console.log('\n3 KAMs más cercanos:')
    timesWithKams.slice(0, 3).forEach((tt, index) => {
      console.log(`${index + 1}. ${tt.kam_name}: ${Math.round(tt.travel_time / 60)} minutos`)
    })
    
    console.log(`\nKAMs identificados: ${timesWithKams.length} de ${travelTimes.length} tiempos`)
  } else {
    console.log('❌ No hay tiempos de viaje calculados para este hospital')
    
    // 4. Buscar con tolerancia de coordenadas
    console.log('\n🔍 Buscando con tolerancia de coordenadas (6 decimales):')
    
    const { data: travelTimesWithTolerance } = await supabase
      .from('travel_time_cache')
      .select('*')
      .gte('dest_lat', hospital.lat - 0.000001)
      .lte('dest_lat', hospital.lat + 0.000001)
      .gte('dest_lng', hospital.lng - 0.000001)
      .lte('dest_lng', hospital.lng + 0.000001)
    
    console.log(`Tiempos encontrados con tolerancia: ${travelTimesWithTolerance?.length || 0}`)
    
    if (travelTimesWithTolerance && travelTimesWithTolerance.length > 0) {
      console.log('\nCoordenadas encontradas:')
      travelTimesWithTolerance.forEach((tt, idx) => {
        console.log(`${idx + 1}. destino: ${tt.dest_lat}, ${tt.dest_lng} (diferencia: ${Math.abs(tt.dest_lat - hospital.lat)}, ${Math.abs(tt.dest_lng - hospital.lng)})`)
      })
    }
    
    // 5. Calcular tiempos estimados (Haversine) para los KAMs
    console.log('\n📏 Calculando distancias estimadas (línea recta):')
    
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)

    if (kams) {
      const distances = kams.map(kam => {
        // Fórmula Haversine
        const R = 6371 // Radio de la Tierra en km
        const dLat = (kam.lat - hospital.lat) * Math.PI / 180
        const dLon = (kam.lng - hospital.lng) * Math.PI / 180
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(hospital.lat * Math.PI / 180) * Math.cos(kam.lat * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        const distance = R * c
        
        return {
          kam_name: kam.name,
          kam_id: kam.id,
          distance: distance,
          estimated_time: distance * 1.2 // Estimación: 50 km/h promedio
        }
      })

      distances.sort((a, b) => a.distance - b.distance)
      
      console.log('\n3 KAMs más cercanos (estimado):')
      distances.slice(0, 3).forEach((d, index) => {
        console.log(`${index + 1}. ${d.kam_name}: ${Math.round(d.distance)} km (~${Math.round(d.estimated_time)} minutos)`)
      })

      console.log('\n⚠️ NOTA: Estos son tiempos estimados en línea recta.')
      console.log('Para obtener tiempos reales, se debe ejecutar el cálculo con Google Maps.')
    }
  }

  process.exit(0)
}

checkHospitalAlfonsoJaramillo().catch(console.error)