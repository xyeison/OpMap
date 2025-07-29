import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Colores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

async function fixEverything() {
  console.log(`${colors.bright}${colors.blue}🔧 SCRIPT INTEGRAL PARA ARREGLAR TODO EL SISTEMA OpMap${colors.reset}\n`)
  
  try {
    // 1. VERIFICAR ESTADO ACTUAL
    console.log(`${colors.cyan}1. VERIFICANDO ESTADO ACTUAL...${colors.reset}`)
    
    const { count: totalHospitals } = await supabase
      .from('hospitals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
    
    const { count: totalAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalTravelTimes } = await supabase
      .from('travel_time_cache')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'google_maps')
    
    console.log(`   - Hospitales activos: ${totalHospitals}`)
    console.log(`   - Asignaciones actuales: ${totalAssignments}`)
    console.log(`   - Tiempos de viaje (Google Maps): ${totalTravelTimes}`)
    
    // 2. EJECUTAR ALGORITMO DE ASIGNACIÓN
    console.log(`\n${colors.cyan}2. EJECUTANDO ALGORITMO DE ASIGNACIÓN...${colors.reset}`)
    
    const response = await fetch('http://localhost:3000/api/recalculate-assignments', {
      method: 'POST'
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log(`   ${colors.green}✅ Asignaciones recalculadas: ${result.assignments}${colors.reset}`)
    } else {
      console.log(`   ${colors.red}❌ Error: ${result.error}${colors.reset}`)
      return
    }
    
    // 3. IDENTIFICAR HOSPITALES SIN ASIGNAR
    console.log(`\n${colors.cyan}3. IDENTIFICANDO HOSPITALES SIN ASIGNAR...${colors.reset}`)
    
    const { data: allHospitals } = await supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)
    
    const { data: assignments } = await supabase
      .from('assignments')
      .select('hospital_id')
    
    const assignedIds = new Set((assignments || []).map(a => a.hospital_id))
    const unassignedHospitals = (allHospitals || []).filter(h => !assignedIds.has(h.id))
    
    console.log(`   - Hospitales sin asignar: ${unassignedHospitals.length}`)
    
    if (unassignedHospitals.length > 0) {
      console.log(`   - Ejemplos:`)
      unassignedHospitals.slice(0, 5).forEach(h => {
        console.log(`     • ${h.name} (${h.municipality_name})`)
      })
    }
    
    // 4. CALCULAR TIEMPOS PARA HOSPITALES SIN ASIGNAR
    console.log(`\n${colors.cyan}4. CALCULANDO TIEMPOS DE VIAJE PARA HOSPITALES SIN ASIGNAR...${colors.reset}`)
    
    const { data: kams } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)
    
    if (!kams || kams.length === 0) {
      console.log(`   ${colors.red}❌ No hay KAMs activos${colors.reset}`)
      return
    }
    
    let newTravelTimes = 0
    let updatedTravelTimes = 0
    
    // Procesar en lotes para evitar sobrecarga
    const batchSize = 5
    for (let i = 0; i < unassignedHospitals.length; i += batchSize) {
      const batch = unassignedHospitals.slice(i, i + batchSize)
      
      console.log(`   Procesando hospitales ${i + 1}-${Math.min(i + batchSize, unassignedHospitals.length)} de ${unassignedHospitals.length}...`)
      
      for (const hospital of batch) {
        // Para cada hospital, calcular tiempo a TODOS los KAMs
        for (const kam of kams) {
          // Verificar si ya existe el tiempo
          const { data: existingTime } = await supabase
            .from('travel_time_cache')
            .select('*')
            .eq('origin_lat', kam.lat)
            .eq('origin_lng', kam.lng)
            .eq('dest_lat', hospital.lat)
            .eq('dest_lng', hospital.lng)
            .single()
          
          if (!existingTime) {
            // Si no existe, calcular con Google Maps
            try {
              const response = await fetch('http://localhost:3000/api/google-maps/distance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  origin: { lat: kam.lat, lng: kam.lng },
                  destination: { lat: hospital.lat, lng: hospital.lng }
                })
              })
              
              if (response.ok) {
                const data = await response.json()
                
                // Guardar en caché
                await supabase
                  .from('travel_time_cache')
                  .insert({
                    origin_lat: kam.lat,
                    origin_lng: kam.lng,
                    dest_lat: hospital.lat,
                    dest_lng: hospital.lng,
                    travel_time: data.duration,
                    distance: data.distance / 1000, // Convertir a km
                    source: 'google_maps'
                  })
                
                newTravelTimes++
                console.log(`     ${colors.green}✓${colors.reset} ${kam.name} → ${hospital.name}: ${Math.round(data.duration / 60)} min`)
              }
            } catch (error) {
              console.log(`     ${colors.red}✗${colors.reset} Error calculando ${kam.name} → ${hospital.name}`)
            }
            
            // Esperar un poco entre llamadas para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      }
    }
    
    // 5. LIMPIAR TIEMPOS INCORRECTOS
    console.log(`\n${colors.cyan}5. LIMPIANDO TIEMPOS INCORRECTOS...${colors.reset}`)
    
    // Identificar tiempos sospechosamente bajos (menos de 10 minutos para más de 50km)
    const { data: suspiciousTimes } = await supabase
      .from('travel_time_cache')
      .select('*')
      .eq('source', 'google_maps')
      .lt('travel_time', 600) // Menos de 10 minutos
    
    let fixedTimes = 0
    if (suspiciousTimes) {
      for (const time of suspiciousTimes) {
        // Calcular distancia Haversine
        const R = 6371
        const dLat = (time.dest_lat - time.origin_lat) * Math.PI / 180
        const dLon = (time.dest_lng - time.origin_lng) * Math.PI / 180
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(time.origin_lat * Math.PI / 180) * Math.cos(time.dest_lat * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        const distance = R * c
        
        // Si la distancia es mayor a 50km y el tiempo es menor a 10 minutos, es sospechoso
        if (distance > 50 && time.travel_time < 600) {
          console.log(`   ${colors.yellow}⚠️  Tiempo sospechoso: ${Math.round(time.travel_time / 60)} min para ${Math.round(distance)} km${colors.reset}`)
          
          // Marcar como necesita recálculo cambiando source
          await supabase
            .from('travel_time_cache')
            .update({ source: 'needs_recalculation' })
            .eq('id', time.id)
          
          fixedTimes++
        }
      }
    }
    
    // 6. RESUMEN FINAL
    console.log(`\n${colors.bright}${colors.green}📊 RESUMEN DE ACCIONES:${colors.reset}`)
    console.log(`   - Asignaciones recalculadas: ${result.assignments}`)
    console.log(`   - Hospitales sin asignar identificados: ${unassignedHospitals.length}`)
    console.log(`   - Nuevos tiempos de viaje calculados: ${newTravelTimes}`)
    console.log(`   - Tiempos sospechosos marcados para recálculo: ${fixedTimes}`)
    
    // 7. VERIFICACIÓN FINAL
    console.log(`\n${colors.cyan}7. VERIFICACIÓN FINAL...${colors.reset}`)
    
    const { count: finalAssignments } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
    
    const { count: finalUnassigned } = await supabase
      .from('hospitals')
      .select('h.*', { count: 'exact', head: true })
      .from('hospitals as h')
      .leftJoin('assignments as a', 'h.id', 'a.hospital_id')
      .is('a.hospital_id', null)
      .eq('h.active', true)
    
    console.log(`   - Total asignaciones finales: ${finalAssignments}`)
    console.log(`   - Hospitales sin asignar finales: ${finalUnassigned || 0}`)
    
    console.log(`\n${colors.bright}${colors.green}✅ PROCESO COMPLETADO${colors.reset}`)
    
  } catch (error) {
    console.error(`\n${colors.red}❌ ERROR FATAL:${colors.reset}`, error)
  }
  
  process.exit(0)
}

// Verificar que el servidor esté corriendo
console.log(`${colors.yellow}⚠️  NOTA: Este script requiere que el servidor Next.js esté corriendo en http://localhost:3000${colors.reset}`)
console.log(`${colors.yellow}   Si no está corriendo, ejecuta: npm run dev${colors.reset}\n`)

// Dar tiempo para leer el mensaje
setTimeout(() => {
  fixEverything()
}, 2000)