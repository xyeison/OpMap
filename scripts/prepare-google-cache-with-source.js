const fs = require('fs')

console.log('🚀 Preparando comandos SQL con columna source...\n')

// Cargar el caché de Google Maps
const googleCache = JSON.parse(
  fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8')
)

console.log(`Total de rutas en caché: ${Object.keys(googleCache).length}`)

// Primero, generar comando para limpiar datos existentes de google_maps
const deleteCommand = `-- Eliminar datos existentes de Google Maps para evitar duplicados
DELETE FROM travel_time_cache WHERE source = 'google_maps';
`

// Convertir a comandos SQL con source
const sqlCommands = []

for (const [key, minutes] of Object.entries(googleCache)) {
  const [origin, dest] = key.split('|')
  if (!origin || !dest) continue
  
  const [originLat, originLng] = origin.split(',').map(Number)
  const [destLat, destLng] = dest.split(',').map(Number)
  
  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    continue
  }
  
  // INSERT con columna source
  sqlCommands.push(
    `INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, source) ` +
    `VALUES (${originLat}, ${originLng}, ${destLat}, ${destLng}, ${Math.round(minutes)}, 'google_maps');`
  )
}

// Guardar en archivo SQL
const outputFile = 'insert-google-cache-with-source.sql'
const sqlContent = [
  '-- Insertar caché de Google Maps en travel_time_cache',
  '-- Total de rutas: ' + sqlCommands.length,
  '',
  '-- Primero, eliminar datos existentes de google_maps para evitar duplicados:',
  deleteCommand,
  '',
  '-- Ahora insertar los nuevos datos:',
  'BEGIN;',
  '',
  ...sqlCommands.slice(0, 50), // Primeras 50 para prueba
  '',
  'COMMIT;',
  '',
  '-- Verificar que se insertaron:',
  "SELECT COUNT(*) FROM travel_time_cache WHERE source = 'google_maps';",
  '',
  '-- Ver ejemplo de Málaga:',
  `SELECT * FROM travel_time_cache 
WHERE origin_lat BETWEEN 7.12 AND 7.13 
  AND origin_lng BETWEEN -73.12 AND -73.11
  AND dest_lat BETWEEN 6.70 AND 6.71
  AND source = 'google_maps';`
].join('\n')

// Crear archivo con TODAS las rutas
const allSqlContent = [
  '-- Insertar TODAS las rutas del caché de Google Maps',
  '-- Total de rutas: ' + sqlCommands.length,
  '',
  deleteCommand,
  '',
  'BEGIN;',
  '',
  ...sqlCommands,
  '',
  'COMMIT;',
  '',
  '-- Verificar:',
  `SELECT COUNT(*) FROM travel_time_cache WHERE source = 'google_maps'; -- Debería mostrar ${sqlCommands.length}`
].join('\n')

fs.writeFileSync(outputFile, sqlContent)
fs.writeFileSync('insert-all-google-cache-with-source.sql', allSqlContent)

console.log(`\n✅ Archivos SQL creados:`)
console.log(`   1. ${outputFile} - Primeras 50 rutas para prueba`)
console.log(`   2. insert-all-google-cache-with-source.sql - TODAS las ${sqlCommands.length} rutas`)

// Mostrar ejemplo específico
const bucaMalagaKey = '7.126714307270854,-73.11446761061566|6.70220917848447,-72.7294593322646'
if (googleCache[bucaMalagaKey]) {
  console.log('\n📍 Ejemplo - Ruta Bucaramanga → Málaga:')
  console.log(`INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time, source)`)
  console.log(`VALUES (7.126714307270854, -73.11446761061566, 6.70220917848447, -72.7294593322646, ${Math.round(googleCache[bucaMalagaKey])}, 'google_maps');`)
  console.log(`-- Tiempo real de Google Maps: ${Math.round(googleCache[bucaMalagaKey])} minutos (${(googleCache[bucaMalagaKey]/60).toFixed(1)} horas)`)
}

console.log('\n📝 Instrucciones:')
console.log('1. Ejecuta insert-google-cache-with-source.sql para las primeras 50 rutas')
console.log('2. Si funciona bien, ejecuta insert-all-google-cache-with-source.sql para todas')
console.log('\nNOTA: El DELETE inicial eliminará datos existentes de google_maps para evitar duplicados')