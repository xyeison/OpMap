import * as dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env.local') })

async function testAPI() {
  console.log('🔍 Probando API /api/travel-times/unassigned-all\n')

  try {
    const response = await fetch('http://localhost:3000/api/travel-times/unassigned-optimized')
    const data = await response.json()
    
    console.log('Respuesta de la API:')
    console.log(`- Total hospitales sin asignar: ${data.total}`)
    console.log(`- Con tiempos de viaje: ${data.debug?.with_travel_times}`)
    console.log(`- Sin tiempos de viaje: ${data.debug?.without_travel_times}`)
    console.log(`- Total tiempos cargados: ${data.debug?.total_travel_times_loaded}`)
    
    // Buscar los hospitales específicos
    const joseCayetano = data.unassigned_hospitals?.find((h: any) => 
      h.name.includes('José Cayetano Vásquez')
    )
    
    const alfonsoJaramillo = data.unassigned_hospitals?.find((h: any) => 
      h.name.includes('Alfonso Jaramillo Salazar')
    )
    
    console.log('\n🏥 Hospital José Cayetano Vásquez:')
    if (joseCayetano) {
      console.log('✅ ENCONTRADO en la respuesta')
      console.log(`- ID: ${joseCayetano.id}`)
      console.log(`- Municipio: ${joseCayetano.municipality_name}`)
      console.log(`- Tiempos de viaje: ${joseCayetano.travel_times?.length || 0}`)
      if (joseCayetano.travel_times?.length > 0) {
        console.log('- 3 KAMs más cercanos:')
        joseCayetano.travel_times.slice(0, 3).forEach((tt: any, idx: number) => {
          console.log(`  ${idx + 1}. ${tt.kam_name}: ${Math.round(tt.travel_time / 60)} minutos`)
        })
      }
    } else {
      console.log('❌ NO encontrado en la respuesta')
    }
    
    console.log('\n🏥 Hospital Alfonso Jaramillo Salazar:')
    if (alfonsoJaramillo) {
      console.log('✅ ENCONTRADO en la respuesta')
      console.log(`- ID: ${alfonsoJaramillo.id}`)
      console.log(`- Municipio: ${alfonsoJaramillo.municipality_name}`)
      console.log(`- Tiempos de viaje: ${alfonsoJaramillo.travel_times?.length || 0}`)
      if (alfonsoJaramillo.travel_times?.length > 0) {
        console.log('- 3 KAMs más cercanos:')
        alfonsoJaramillo.travel_times.slice(0, 3).forEach((tt: any, idx: number) => {
          console.log(`  ${idx + 1}. ${tt.kam_name}: ${Math.round(tt.travel_time / 60)} minutos`)
        })
      }
    } else {
      console.log('❌ NO encontrado en la respuesta')
    }
    
    // Mostrar algunos hospitales sin asignar como ejemplo
    console.log('\n📋 Primeros 5 hospitales sin asignar en la respuesta:')
    data.unassigned_hospitals?.slice(0, 5).forEach((h: any, idx: number) => {
      console.log(`${idx + 1}. ${h.name} (${h.municipality_name}) - Tiempos: ${h.travel_times?.length || 0}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Verificar si el servidor está corriendo
console.log('⚠️ NOTA: Asegúrate de que el servidor Next.js esté corriendo en http://localhost:3000')
console.log('Si no está corriendo, ejecuta: npm run dev\n')

testAPI()