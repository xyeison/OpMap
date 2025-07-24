const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')
const { glob } = require('glob')

require('dotenv').config({ path: '../web/.env.local' })

// Usar anon key está bien si el bucket ya existe y es público
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function uploadGeoJSONFiles() {
  console.log('🚀 Subiendo archivos GeoJSON a Supabase Storage...\n')
  console.log('⚠️  Asegúrate de haber creado el bucket "geojson" como público en el dashboard\n')
  
  const baseDir = '/Users/yeison/Documents/GitHub/OpMap/data/geojson'
  const folders = ['departments', 'localities', 'municipalities']
  
  let totalUploaded = 0
  let totalFailed = 0
  
  for (const folder of folders) {
    console.log(`\n📁 Procesando ${folder}...`)
    
    const pattern = `${baseDir}/${folder}/*.geojson`
    const files = await glob(pattern)
    console.log(`   Encontrados: ${files.length} archivos`)
    
    let folderUploaded = 0
    
    for (const filePath of files) {
      const fileName = path.basename(filePath)
      const storagePath = `${folder}/${fileName}`
      
      try {
        // Leer archivo
        const fileData = await fs.readFile(filePath)
        
        // Subir a Supabase
        const { error } = await supabase.storage
          .from('geojson')
          .upload(storagePath, fileData, {
            contentType: 'application/geo+json',
            upsert: true
          })
        
        if (error) throw error
        
        totalUploaded++
        folderUploaded++
        process.stdout.write(`\r   ✅ Subidos: ${folderUploaded}/${files.length} archivos`)
      } catch (error) {
        totalFailed++
        console.error(`\n   ❌ Error con ${fileName}:`, error.message)
      }
    }
    console.log() // Nueva línea
  }
  
  console.log('\n✨ Subida completa!')
  console.log(`   Total subidos: ${totalUploaded}`)
  console.log(`   Total fallidos: ${totalFailed}`)
  
  // Mostrar URL de ejemplo
  if (totalUploaded > 0) {
    const { data: { publicUrl } } = supabase.storage
      .from('geojson')
      .getPublicUrl('departments/08.geojson')
    
    console.log(`\n📝 URL de ejemplo: ${publicUrl}`)
    console.log('   Usa esta URL base en tu API')
  }
}

// Verificar que el bucket existe
async function checkBucket() {
  const { data, error } = await supabase.storage.listBuckets()
  
  if (error) {
    console.error('❌ Error verificando buckets:', error.message)
    return false
  }
  
  const hasGeojsonBucket = data?.some(bucket => bucket.name === 'geojson')
  
  if (!hasGeojsonBucket) {
    console.error('❌ El bucket "geojson" no existe.')
    console.log('📝 Por favor créalo en el dashboard de Supabase:')
    console.log('   1. Ve a Storage')
    console.log('   2. Create a new bucket')
    console.log('   3. Name: geojson')
    console.log('   4. Public bucket: ✅')
    return false
  }
  
  console.log('✅ Bucket "geojson" encontrado\n')
  return true
}

// Ejecutar
async function main() {
  // Comentamos la verificación porque sabemos que el bucket existe
  // const bucketExists = await checkBucket()
  // if (bucketExists) {
  //   await uploadGeoJSONFiles()
  // }
  
  console.log('✅ Asumiendo que el bucket "geojson" existe (verificado via SQL)\n')
  await uploadGeoJSONFiles()
}

main().catch(console.error)