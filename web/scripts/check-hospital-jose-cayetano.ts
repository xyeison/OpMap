import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkHospitalJoseCayetano() {
  console.log('🔍 Verificando Hospital José Cayetano Vásquez\n')

  // 1. Buscar el hospital
  const { data: hospitals } = await supabase
    .from('hospitals')
    .select('*')
    .ilike('name', '%José Cayetano Vásquez%')
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
  
  // 2. Verificar si tiene asignación
  const { data: assignment } = await supabase
    .from('assignments')
    .select(`
      *,
      sellers!inner(name)
    `)
    .eq('hospital_id', hospital.id)
    .single()

  if (assignment) {
    console.log(`\n⚠️ Hospital está asignado a: ${(assignment.sellers as any).name}`)
    console.log(`- Tiempo de viaje: ${assignment.travel_time} minutos`)
  } else {
    console.log('\n✅ Hospital NO está asignado (correcto)')
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
      console.log(`   Tiempo: ${Math.round(tt.travel_time / 60)} minutos`)
    })
    
    // Obtener información de los KAMs (usar tabla 'kams')
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (kamsError) {
      console.error('Error obteniendo KAMs:', kamsError)
      return
    }

    console.log('\nKAMs activos:')
    kams?.forEach(kam => {
      console.log(`- ${kam.name}: ${kam.lat}, ${kam.lng} (${kam.active ? 'ACTIVO' : 'INACTIVO'})`)
    })
    
    // Verificar si algún KAM coincide con las coordenadas de origen
    console.log('\nVerificando coincidencias con coordenadas de origen:')
    travelTimes.forEach((tt, idx) => {
      const matchingKam = kams?.find(k => 
        Math.abs(k.lat - tt.origin_lat) < 0.00001 && 
        Math.abs(k.lng - tt.origin_lng) < 0.00001
      )
      if (matchingKam) {
        console.log(`✅ Tiempo ${idx + 1} coincide con KAM: ${matchingKam.name}`)
      } else {
        // Buscar el KAM más cercano
        let closestKam = null
        let minDistance = Infinity
        kams?.forEach(kam => {
          const dist = Math.sqrt(
            Math.pow(kam.lat - tt.origin_lat, 2) + 
            Math.pow(kam.lng - tt.origin_lng, 2)
          )
          if (dist < minDistance) {
            minDistance = dist
            closestKam = kam
          }
        })
        console.log(`❌ Tiempo ${idx + 1} NO coincide. KAM más cercano: ${closestKam?.name} (distancia: ${minDistance.toFixed(6)})`)
      }
    })

    // Mapear tiempos con KAMs
    const timesWithKams = travelTimes.map(tt => {
      const kam = kams?.find(k => 
        Math.abs(k.lat - tt.origin_lat) < 0.0001 && 
        Math.abs(k.lng - tt.origin_lng) < 0.0001
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
    
    // 4. Calcular tiempos estimados (Haversine) para los KAMs
    console.log('\n📏 Calculando distancias estimadas (línea recta):')
    
    const { data: kams } = await supabase
      .from('sellers')
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

checkHospitalJoseCayetano().catch(console.error)