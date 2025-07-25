const fs = require('fs')

// Este script prepara los comandos SQL para insertar manualmente

console.log('🚀 Preparando comandos SQL para insertar caché de Google Maps...\n')

// Cargar el caché de Google Maps
const googleCache = JSON.parse(
  fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8')
)

console.log(`Total de rutas en caché: ${Object.keys(googleCache).length}`)

// Convertir a comandos SQL
const sqlCommands = []

for (const [key, minutes] of Object.entries(googleCache)) {
  const [origin, dest] = key.split('|')
  if (!origin || !dest) continue
  
  const [originLat, originLng] = origin.split(',').map(Number)
  const [destLat, destLng] = dest.split(',').map(Number)
  
  if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
    continue
  }
  
  sqlCommands.push(
    `INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time) ` +
    `VALUES (${originLat}, ${originLng}, ${destLat}, ${destLng}, ${Math.round(minutes)}) ` +
    `ON CONFLICT (origin_lat, origin_lng, dest_lat, dest_lng) DO UPDATE SET travel_time = ${Math.round(minutes)};`
  )
}

// Guardar en archivo SQL
const outputFile = 'insert-google-cache.sql'
const sqlContent = [
  '-- Insertar caché de Google Maps en travel_time_cache',
  '-- Total de rutas: ' + sqlCommands.length,
  '',
  'BEGIN;',
  '',
  ...sqlCommands.slice(0, 100), // Primeras 100 para prueba
  '',
  'COMMIT;',
  '',
  '-- Para insertar todas las rutas, descomentar las siguientes líneas:',
  '/*',
  'BEGIN;',
  ...sqlCommands,
  'COMMIT;',
  '*/'
].join('\n')

fs.writeFileSync(outputFile, sqlContent)

console.log(`\n✅ Archivo SQL creado: ${outputFile}`)
console.log(`   - Contiene ${sqlCommands.length} comandos INSERT`)
console.log(`   - Las primeras 100 rutas están listas para ejecutar`)
console.log(`   - Para todas las rutas, descomenta el bloque al final`)

// Mostrar ejemplo de Bucaramanga-Málaga
const bucaMalagaKey = '7.126714307270854,-73.11446761061566|6.70220917848447,-72.7294593322646'
if (googleCache[bucaMalagaKey]) {
  console.log('\n📍 Ejemplo - Ruta Bucaramanga → Málaga:')
  console.log(`INSERT INTO travel_time_cache (origin_lat, origin_lng, dest_lat, dest_lng, travel_time)`)
  console.log(`VALUES (7.126714307270854, -73.11446761061566, 6.70220917848447, -72.7294593322646, ${Math.round(googleCache[bucaMalagaKey])});`)
  console.log(`-- Tiempo: ${Math.round(googleCache[bucaMalagaKey])} minutos (${(googleCache[bucaMalagaKey]/60).toFixed(1)} horas)`)
}

console.log('\n📝 Próximos pasos:')
console.log('1. Abre el archivo insert-google-cache.sql')
console.log('2. Copia el contenido')
console.log('3. Ve a Supabase → SQL Editor')
console.log('4. Pega y ejecuta el SQL')
console.log('5. Verifica que los datos se insertaron correctamente')