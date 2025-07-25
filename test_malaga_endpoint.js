const fetch = require('node-fetch');

async function testMalagaEndpoint() {
  console.log('🔍 Probando endpoint de hospitales sin asignar...\n');
  
  try {
    // Ajustar la URL según sea necesario
    const response = await fetch('http://localhost:3000/api/travel-times/unassigned-real-v2');
    const data = await response.json();
    
    console.log(`Total hospitales sin asignar: ${data.total}`);
    console.log(`Debug info:`, data.debug);
    
    // Buscar específicamente Málaga
    const malagaHospital = data.unassigned_hospitals?.find(h => 
      h.municipality_name?.toLowerCase().includes('málaga') ||
      h.municipality_name?.toLowerCase().includes('malaga')
    );
    
    if (malagaHospital) {
      console.log('\n✅ Hospital de Málaga encontrado:');
      console.log(`- ${malagaHospital.name}`);
      console.log(`- Coordenadas: ${malagaHospital.lat}, ${malagaHospital.lng}`);
      console.log(`- Tiempos de viaje encontrados: ${malagaHospital.travel_times.length}`);
      
      if (malagaHospital.travel_times.length > 0) {
        console.log('\nTiempos de viaje:');
        malagaHospital.travel_times.forEach(tt => {
          console.log(`  - ${tt.kam_name}: ${tt.travel_time} minutos (${(tt.travel_time/60).toFixed(1)} horas)`);
        });
      }
    } else {
      console.log('\n❌ Hospital de Málaga NO encontrado en la respuesta');
      console.log('\nPrimeros 5 hospitales devueltos:');
      data.unassigned_hospitals?.slice(0, 5).forEach(h => {
        console.log(`- ${h.name} (${h.municipality_name})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMalagaEndpoint();