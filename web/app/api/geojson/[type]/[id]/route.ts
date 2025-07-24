import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const { type, id } = params
    
    // Validate type
    if (!['municipalities', 'localities'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    
    // Validate id format
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid id format' }, { status: 400 })
    }
    
    // Construct file path - use absolute path for now
    const filePath = path.join('/Users/yeison/Documents/GitHub/OpMap', 'data', 'geojson', type, `${id}.geojson`)
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const geoJson = JSON.parse(fileContent)
      
      return NextResponse.json(geoJson)
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return NextResponse.json({ error: 'GeoJSON file not found' }, { status: 404 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error serving GeoJSON:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}