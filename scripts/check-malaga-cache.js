const fs = require('fs');

// Cargar el caché de tiempos
const cache = JSON.parse(fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8'));

console.log('Buscando tiempos de viaje relacionados con Málaga...\n');

// Coordenadas aproximadas
// Bucaramanga: 7.126714307270854, -73.11446761061566
// Málaga está aproximadamente a: 6.7, -72.7

let found = 0;
const results = [];

// Buscar en todas las entradas del caché
for (const [key, value] of Object.entries(cache)) {
  // Las claves tienen formato: "lat1,lng1_lat2,lng2"
  const parts = key.split('_');
  if (parts.length === 2) {
    const [origin, dest] = parts;
    const [originLat, originLng] = origin.split(',').map(Number);
    const [destLat, destLng] = dest.split(',').map(Number);
    
    // Buscar rutas desde Bucaramanga (7.126, -73.114)
    const isBucaramangaOrigin = Math.abs(originLat - 7.126) < 0.01 && Math.abs(originLng - (-73.114)) < 0.01;
    
    // Buscar destinos en área de Málaga (aproximadamente 6.7, -72.7)
    const isMalagaArea = Math.abs(destLat - 6.7) < 0.2 && Math.abs(destLng - (-72.7)) < 0.2;
    
    if (isBucaramangaOrigin && isMalagaArea) {
      const minutes = Math.round(value.duration / 60);
      results.push({
        origin: `${originLat}, ${originLng}`,
        dest: `${destLat}, ${destLng}`,
        minutes: minutes,
        hours: (minutes / 60).toFixed(1),
        distance: value.distance
      });
      found++;
    }
  }
}

if (found > 0) {
  console.log(`Encontradas ${found} rutas desde Bucaramanga hacia área de Málaga:\n`);
  results.forEach(r => {
    console.log(`De: ${r.origin}`);
    console.log(`A: ${r.dest}`);
    console.log(`Tiempo: ${r.minutes} minutos (${r.hours} horas)`);
    console.log(`Distancia: ${r.distance} metros\n`);
  });
} else {
  console.log('No se encontraron rutas en caché entre Bucaramanga y Málaga');
  console.log('\nBuscando cualquier ruta que mencione coordenadas cercanas a Málaga...');
  
  let malagaRoutes = 0;
  for (const [key, value] of Object.entries(cache)) {
    if (key.includes('6.7') || key.includes('6.6')) {
      console.log(`\nRuta: ${key}`);
      console.log(`Tiempo: ${Math.round(value.duration/60)} minutos`);
      malagaRoutes++;
      if (malagaRoutes > 5) break;
    }
  }
}

console.log(`\nTotal de rutas en caché: ${Object.keys(cache).length}`);

// Buscar hospitales en los datos
try {
  const hospitals = JSON.parse(fs.readFileSync('../data/hospitals.json', 'utf8'));
  const malagaHospitals = hospitals.filter(h => 
    h.municipality_name && h.municipality_name.toLowerCase().includes('málaga') ||
    h.municipality_name && h.municipality_name.toLowerCase().includes('malaga')
  );
  
  if (malagaHospitals.length > 0) {
    console.log('\nHospitales encontrados en Málaga:');
    malagaHospitals.forEach(h => {
      console.log(`- ${h.name} (${h.code})`);
      console.log(`  Coordenadas: ${h.lat}, ${h.lng}`);
      console.log(`  Municipio: ${h.municipality_id}`);
    });
  }
} catch (e) {
  console.log('\nNo se pudo cargar hospitals.json');
}