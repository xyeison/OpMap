import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('Test route: Starting connection test...')
    
    // Test 1: Verificar conexión con Supabase
    const { data: testConnection, error: connectionError } = await supabase
      .from('hospitals')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      return NextResponse.json({
        success: false,
        error: 'Error de conexión con Supabase',
        details: connectionError.message
      }, { status: 500 })
    }
    
    // Test 2: Verificar tabla hospital_kam_distances
    const { data: distanceTable, error: distanceError } = await supabase
      .from('hospital_kam_distances')
      .select('count')
      .limit(1)
    
    let hasDistanceTable = true
    if (distanceError) {
      console.log('Tabla hospital_kam_distances no existe o error:', distanceError.message)
      hasDistanceTable = false
    }
    
    // Test 3: Contar registros
    const { data: hospitals, error: hospitalsError } = await supabase
      .from('hospitals')
      .select('id', { count: 'exact', head: true })
    
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('id', { count: 'exact', head: true })
    
    // Test 4: Verificar un hospital específico de la lista
    const testHospitalId = '0a014185-801f-40f0-9cee-8cd7706068df'
    const { data: testHospital, error: testHospitalError } = await supabase
      .from('hospitals')
      .select('id, name, lat, lng, municipality_name, department_name')
      .eq('id', testHospitalId)
      .single()
    
    return NextResponse.json({
      success: true,
      tests: {
        connection: 'OK',
        hasDistanceTable,
        hospitalCount: hospitals?.length || 0,
        kamCount: kams?.length || 0,
        testHospital: testHospital ? {
          found: true,
          name: testHospital.name,
          hasCoordinates: !!(testHospital.lat && testHospital.lng)
        } : {
          found: false,
          error: testHospitalError?.message
        }
      }
    })
    
  } catch (error) {
    console.error('Test route error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}