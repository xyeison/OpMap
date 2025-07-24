const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')
const glob = require('glob').promises

require('dotenv').config({ path: '../web/.env.local' })

// IMPORTANTE: Necesitamos el Service Role Key para operaciones administrativas
// NO uses este key en el frontend - solo para scripts de administración
const SUPABASE_SERVICE_ROLE_KEY = 'TU_SERVICE_ROLE_KEY_AQUI'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function uploadGeoJSONFiles() {
  console.log('🚀 Subiendo archivos GeoJSON a Supabase Storage...\n')
  
  const baseDir = '/Users/yeison/Documents/GitHub/OpMap/data/geojson'
  const folders = ['departments', 'localities', 'municipalities']
  
  // Crear bucket si no existe
  const { error: bucketError } = await supabase.storage.createBucket('geojson', {
    public: true,
    fileSizeLimit: 52428800 // 50MB
  })
  
  if (bucketError && !bucketError.message.includes('already exists')) {
    console.error('Error creando bucket:', bucketError)
    return
  }
  
  let totalUploaded = 0
  let totalFailed = 0
  
  for (const folder of folders) {
    console.log(`\n📁 Subiendo ${folder}...`)
    
    const files = await glob(`${baseDir}/${folder}/*.geojson`)
    console.log(`   Encontrados: ${files.length} archivos`)
    
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
        process.stdout.write(`\r   ✅ Subidos: ${totalUploaded} archivos`)
      } catch (error) {
        totalFailed++
        console.error(`\n   ❌ Error con ${fileName}:`, error.message)
      }
    }
  }
  
  console.log('\n\n✨ Subida completa!')
  console.log(`   Total subidos: ${totalUploaded}`)
  console.log(`   Total fallidos: ${totalFailed}`)
  
  // Obtener URL base
  const { data: { publicUrl } } = supabase.storage
    .from('geojson')
    .getPublicUrl('test')
  
  const baseUrl = publicUrl.replace('/test', '')
  console.log(`\n📝 URL base para tu API: ${baseUrl}`)
}

// Ejecutar
uploadGeoJSONFiles().catch(console.error)