// Coordenadas
const cartagena = { lat: 10.420495819286762, lng: -75.53385812286801 }
const barranquilla = { lat: 11.002689878603764, lng: -74.81448489302309 }

// Función Haversine
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

const distance = haversineDistance(cartagena.lat, cartagena.lng, barranquilla.lat, barranquilla.lng)
const timeAt60kmh = (distance / 60) * 60 // minutos

console.log('=== Distancia Cartagena - Barranquilla ===')
console.log(`Distancia en línea recta: ${distance.toFixed(2)} km`)
console.log(`Tiempo estimado a 60 km/h: ${Math.round(timeAt60kmh)} minutos (${(timeAt60kmh/60).toFixed(1)} horas)`)
console.log(`¿Dentro del límite de 4 horas?: ${timeAt60kmh <= 240 ? 'SÍ' : 'NO'}`)

// Google Maps real: ~120km por carretera, ~2 horas
console.log('\nComparación con Google Maps:')
console.log('Distancia real por carretera: ~120 km')
console.log('Tiempo real: ~2 horas (120 minutos)')
console.log('\nEl algoritmo subestima el tiempo porque usa línea recta.')