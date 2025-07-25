const fs = require('fs')

console.log('🚀 Preparando comandos SQL simples (sin ON CONFLICT)...\n')

// Cargar el caché de Google Maps
const googleCache = JSON.parse(
  fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8')
)

console.log(`Total de rutas en caché: ${Object.keys(googleCache).length}`)

// Convertir a comandos SQL simples
const sqlCommands = []

for (const [key, minutes] of Object.entries(googleCache)) {
  const [origin, dest] = key.split('|')
  if (!origin || !dest) continue
  
  const [originLat, originLng] = origin.split(',').map(Number)
  const [destLat, destLng] = dest.split(',').map(Number)
  
  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    continue
  }
  
  // INSERT simple sin ON CONFLICT
  sqlCommands.push(
    `INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time) ` +
    `VALUES (${originLat}, ${originLng}, ${destLat}, ${destLng}, ${Math.round(minutes)});`
  )
}

// Guardar en archivo SQL
const outputFile = 'insert-google-cache-simple.sql'
const sqlContent = [
  '-- Insertar caché de Google Maps en travel_time_cache',
  '-- Total de rutas: ' + sqlCommands.length,
  '',
  '-- IMPORTANTE: Primero limpia la tabla si es necesario:',
  '-- DELETE FROM travel_time_cache;',
  '',
  'BEGIN;',
  '',
  ...sqlCommands.slice(0, 100), // Primeras 100 para prueba
  '',
  'COMMIT;',
  '',
  '-- Verificar que se insertaron:',
  '-- SELECT COUNT(*) FROM travel_time_cache;',
  '',
  '-- Para insertar TODAS las rutas (3603), ejecuta este archivo completo:',
  '-- scripts/insert-all-google-cache.sql'
].join('\n')

// Crear archivo con TODAS las rutas
const allSqlContent = [
  '-- Insertar TODAS las rutas del caché de Google Maps',
  '-- Total de rutas: ' + sqlCommands.length,
  '',
  '-- Limpiar tabla primero (opcional):',
  '-- TRUNCATE TABLE travel_time_cache;',
  '',
  'BEGIN;',
  '',
  ...sqlCommands,
  '',
  'COMMIT;',
  '',
  '-- Verificar:',
  `-- SELECT COUNT(*) FROM travel_time_cache; -- Debería mostrar ${sqlCommands.length}`
].join('\n')

fs.writeFileSync(outputFile, sqlContent)
fs.writeFileSync('insert-all-google-cache.sql', allSqlContent)

console.log(`\n✅ Archivos SQL creados:`)
console.log(`   1. ${outputFile} - Primeras 100 rutas para prueba`)
console.log(`   2. insert-all-google-cache.sql - TODAS las ${sqlCommands.length} rutas`)

// Mostrar ejemplo específico
const bucaMalagaKey = '7.126714307270854,-73.11446761061566|6.70220917848447,-72.7294593322646'
if (googleCache[bucaMalagaKey]) {
  console.log('\n📍 Ejemplo - Ruta Bucaramanga → Málaga:')
  console.log(`INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time)`)
  console.log(`VALUES (7.126714307270854, -73.11446761061566, 6.70220917848447, -72.7294593322646, ${Math.round(googleCache[bucaMalagaKey])});`)
  console.log(`-- Tiempo real de Google Maps: ${Math.round(googleCache[bucaMalagaKey])} minutos (${(googleCache[bucaMalagaKey]/60).toFixed(1)} horas)`)
}

console.log('\n📝 Instrucciones:')
console.log('1. Primero ejecuta fix-travel-time-cache-table.sql para agregar el constraint')
console.log('2. Luego ejecuta insert-google-cache-simple.sql para las primeras 100 rutas')
console.log('3. Si todo funciona, ejecuta insert-all-google-cache.sql para todas las rutas')