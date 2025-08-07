import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function checkCacheDates() {
  // Hospital en Armenia con más rutas
  const hospitalLat = 4.545222
  const hospitalLng = -75.660754
  
  console.log('Analizando rutas hacia hospital en Armenia (Quindío)...\n')
  
  // Obtener rutas con precisión de 4 decimales
  const { data: routes, error } = await supabase
    .from('travel_time_cache')
    .select('origin_lat, origin_lng, travel_time, calculated_at')
    .gte('dest_lat', hospitalLat - 0.0001)
    .lte('dest_lat', hospitalLat + 0.0001)
    .gte('dest_lng', hospitalLng - 0.0001)
    .lte('dest_lng', hospitalLng + 0.0001)
    .order('calculated_at', { ascending: true })
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log(`Total de rutas encontradas: ${routes?.length}\n`)
  
  // Obtener KAMs
  const { data: kams } = await supabase
    .from('kams')
    .select('name, area_id, lat, lng')
  
  // Mapear y analizar
  const routesWithKams = routes?.map(route => {
    const kam = kams?.find(k => 
      Math.abs(k.lat - route.origin_lat) < 0.001 && 
      Math.abs(k.lng - route.origin_lng) < 0.001
    )
    
    const kamDept = kam?.area_id?.substring(0, 2) || 'XX'
    const date = new Date(route.calculated_at)
    
    // Departamentos que SÍ deberían tener ruta a Quindío
    const validDepts = [
      '66', // Risaralda (adyacente)
      '73', // Tolima (adyacente)
      '76', // Valle (adyacente)
      '05', // Antioquia (nivel 2 vía Risaralda)
      '17', // Caldas (nivel 2 vía Risaralda/Tolima)
      '25', // Cundinamarca (nivel 2 vía Tolima)
      '11', // Bogotá (nivel 2 vía Tolima -> Cundinamarca)
      '41', // Huila (nivel 2 vía Tolima)
      '19', // Cauca (nivel 2 vía Valle)
      '52'  // Nariño (nivel 2 vía Valle -> Cauca)
    ]
    
    const isValid = validDepts.includes(kamDept)
    
    return {
      kam: kam?.name || 'Unknown',
      dept: kamDept,
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      travel_min: Math.round(route.travel_time / 60),
      valid: isValid
    }
  })
  
  // Agrupar por fecha
  const byDate: Record<string, any[]> = {}
  routesWithKams?.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })
  
  // Mostrar por fecha
  console.log('CÁLCULOS POR FECHA:')
  console.log('==================')
  Object.entries(byDate).forEach(([date, routes]) => {
    console.log(`\n${date}: ${routes.length} rutas`)
    routes.forEach(r => {
      const marker = r.valid ? '✅' : '❌'
      console.log(`  ${marker} ${r.kam} (${r.dept}) - ${r.time} - ${r.travel_min} min`)
    })
  })
  
  // Resumen de violaciones
  const violations = routesWithKams?.filter(r => !r.valid) || []
  console.log('\n' + '='.repeat(50))
  console.log('RESUMEN:')
  console.log(`Total rutas: ${routes?.length}`)
  console.log(`Rutas válidas: ${routes?.length - violations.length}`)
  console.log(`Violaciones: ${violations.length}`)
  
  if (violations.length > 0) {
    console.log('\nKAMs que NO deberían tener ruta a Armenia:')
    const uniqueViolations = [...new Set(violations.map(v => `${v.kam} (${v.dept})`))];
    uniqueViolations.forEach(v => console.log(`  ❌ ${v}`))
  }
}

checkCacheDates()