const fs = require('fs')

// Cargar el caché de Google Maps
const googleCache = JSON.parse(
  fs.readFileSync('../data/cache/google_distance_matrix_cache.json', 'utf8')
)

console.log('📊 Análisis del caché de Google Maps\n')
console.log(`Total de rutas: ${Object.keys(googleCache).length}`)

// Buscar específicamente la ruta Bucaramanga-Málaga
const bucaMalagaKey = '7.126714307270854,-73.11446761061566|6.70220917848447,-72.7294593322646'
const bucaMalagaTime = googleCache[bucaMalagaKey]

console.log('\n🔍 Ruta Bucaramanga → Málaga:')
console.log(`Clave: ${bucaMalagaKey}`)
console.log(`Tiempo: ${bucaMalagaTime} minutos`)
console.log(`Tiempo formateado: ${Math.floor(bucaMalagaTime/60)}h ${Math.round(bucaMalagaTime%60)}min`)
console.log(`\n⚠️  Este tiempo (${(bucaMalagaTime/60).toFixed(1)} horas) excede el límite de 4 horas`)

// Buscar otras rutas desde Bucaramanga
console.log('\n📍 Otras rutas desde Bucaramanga:')
let count = 0
for (const [key, time] of Object.entries(googleCache)) {
  if (key.startsWith('7.126714307270854,-73.11446761061566|')) {
    if (count < 5 && key !== bucaMalagaKey) {
      const dest = key.split('|')[1]
      console.log(`- A ${dest}: ${Math.round(time)} min (${(time/60).toFixed(1)}h)`)
      count++
    }
  }
}

// Buscar hospitales sin tiempos calculados
console.log('\n⚠️  IMPORTANTE:')
console.log('Para hospitales sin datos en este caché, NO debemos mostrar estimaciones incorrectas.')
console.log('Es mejor mostrar "Sin datos disponibles" que información errónea.')