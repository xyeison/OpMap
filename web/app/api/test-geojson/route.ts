import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const cwd = process.cwd()
    const projectRoot = path.join(cwd, '..')
    const testPath = path.join(projectRoot, 'data', 'geojson', 'municipalities', '05001.geojson')
    
    // Check if file exists
    const exists = fs.existsSync(testPath)
    
    if (exists) {
      const content = fs.readFileSync(testPath, 'utf-8')
      const geoJson = JSON.parse(content)
      
      return NextResponse.json({
        success: true,
        cwd,
        projectRoot,
        testPath,
        fileExists: exists,
        geoJsonType: geoJson.type,
        features: geoJson.features?.length || 0
      })
    } else {
      // Try alternative paths
      const altPath1 = path.join(cwd, '..', '..', 'data', 'geojson', 'municipalities', '05001.geojson')
      const altPath2 = '/Users/yeison/Documents/GitHub/OpMap/data/geojson/municipalities/05001.geojson'
      
      return NextResponse.json({
        success: false,
        cwd,
        projectRoot,
        testPath,
        fileExists: exists,
        altPath1,
        altPath1Exists: fs.existsSync(altPath1),
        altPath2,
        altPath2Exists: fs.existsSync(altPath2)
      })
    }
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error testing path',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}