import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { headers } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Matriz de adyacencia de departamentos
const adjacencyMatrix: Record<string, string[]> = {
  '05': ['06', '07', '08', '14', '23', '27'], // Antioquia
  '08': ['05', '13', '20', '23', '44', '47'], // Atlántico
  '11': ['25', '50', '70', '73'], // Bogotá DC
  '13': ['08', '20', '23', '44', '47', '70'], // Bolívar
  '15': ['19', '25', '50', '52', '63'], // Boyacá
  '17': ['18', '19', '27', '50', '66', '73'], // Caldas
  '18': ['17', '19', '86'], // Caquetá
  '19': ['15', '17', '18', '25', '41', '50', '52', '76', '86'], // Cauca
  '20': ['08', '13', '44', '47'], // Cesar
  '23': ['05', '08', '13', '27', '70'], // Córdoba
  '25': ['11', '15', '19', '50', '73'], // Cundinamarca
  '27': ['05', '17', '23', '76'], // Chocó
  '41': ['19', '25', '50', '52', '63', '73', '76'], // Huila
  '44': ['08', '13', '20', '47'], // La Guajira
  '47': ['08', '13', '20', '44'], // Magdalena
  '50': ['11', '15', '17', '19', '25', '41', '73', '85', '86', '94', '95', '99'], // Meta
  '52': ['15', '19', '41', '63', '76', '86'], // Nariño
  '54': ['20', '68', '81'], // Norte de Santander
  '63': ['15', '17', '41', '52', '66', '73', '76'], // Quindío
  '66': ['17', '27', '63', '76'], // Risaralda
  '68': ['05', '13', '54', '73', '81'], // Santander
  '70': ['05', '08', '13', '23'], // Sucre
  '73': ['11', '15', '25', '41', '50', '63', '68'], // Tolima
  '76': ['19', '27', '41', '52', '63', '66'], // Valle del Cauca
  '81': ['54', '68', '85'], // Arauca
  '85': ['50', '81', '86', '94', '95'], // Casanare
  '86': ['18', '19', '50', '52', '85', '91'], // Putumayo
  '88': [], // San Andrés y Providencia (isla)
  '91': ['86', '94', '95', '97'], // Amazonas
  '94': ['50', '85', '91', '95', '99'], // Guainía
  '95': ['50', '85', '91', '94', '99'], // Guaviare
  '97': ['91', '94', '95'], // Vaupés
  '99': ['50', '94', '95'] // Vichada
}

// Obtener departamentos vecinos hasta nivel 2
function getNeighborDepartments(deptCode: string, level: number = 2): Set<string> {
  const neighbors = new Set<string>()
  neighbors.add(deptCode) // Incluir el departamento mismo
  
  // Nivel 1: vecinos directos
  const level1 = adjacencyMatrix[deptCode] || []
  level1.forEach(dept => neighbors.add(dept))
  
  // Nivel 2: vecinos de vecinos
  if (level >= 2) {
    level1.forEach(dept => {
      const level2 = adjacencyMatrix[dept] || []
      level2.forEach(d => neighbors.add(d))
    })
  }
  
  return neighbors
}

export async function POST(request: NextRequest) {
  try {
    console.log('analyze-missing: Starting route analysis...')
    
    // Verificar autenticación
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    console.log('analyze-missing: Auth header present:', !!authHeader)
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    // Verificar que sea administrador
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const { hospitalIds, includeAll } = await request.json()
    console.log('analyze-missing: Request params:', { 
      hospitalIds: hospitalIds?.length || 0, 
      includeAll 
    })

    // Obtener hospitales
    let hospitalsQuery = supabase
      .from('hospitals')
      .select('*')
      .eq('active', true)

    if (!includeAll && hospitalIds && hospitalIds.length > 0) {
      hospitalsQuery = hospitalsQuery.in('id', hospitalIds)
    }

    const { data: hospitals, error: hospitalsError } = await hospitalsQuery

    if (hospitalsError) {
      console.error('analyze-missing: Error fetching hospitals:', hospitalsError)
      throw new Error(`Error al obtener hospitales: ${hospitalsError.message}`)
    }
    
    console.log('analyze-missing: Hospitals fetched:', hospitals?.length || 0)

    // Obtener KAMs activos
    const { data: kams, error: kamsError } = await supabase
      .from('kams')
      .select('*')
      .eq('active', true)

    if (kamsError) {
      throw new Error(`Error al obtener KAMs: ${kamsError.message}`)
    }

    // Obtener rutas existentes
    const { data: existingRoutes, error: routesError } = await supabase
      .from('hospital_kam_distances')
      .select('hospital_id, kam_id')

    if (routesError) {
      throw new Error(`Error al obtener rutas existentes: ${routesError.message}`)
    }

    // Crear set de rutas existentes para búsqueda rápida
    const existingRoutesSet = new Set(
      existingRoutes?.map(r => `${r.hospital_id}-${r.kam_id}`) || []
    )

    // Analizar rutas faltantes
    const missingRoutes = []
    console.log('analyze-missing: Starting analysis for hospitals...')

    for (const hospital of hospitals || []) {
      // Validar datos del hospital
      if (!hospital.lat || !hospital.lng) {
        console.warn(`analyze-missing: Hospital ${hospital.id} sin coordenadas, omitiendo`)
        continue
      }
      
      // Determinar qué KAMs deben tener ruta con este hospital
      const hospitalDept = hospital.department_id?.substring(0, 2)
      const isInBogota = hospital.locality_id?.startsWith('11')
      
      for (const kam of kams || []) {
        // Validar datos del KAM
        if (!kam.lat || !kam.lng) {
          console.warn(`analyze-missing: KAM ${kam.id} sin coordenadas, omitiendo`)
          continue
        }
        
        // Verificar si ya existe la ruta
        if (existingRoutesSet.has(`${hospital.id}-${kam.id}`)) {
          continue
        }

        const kamDept = kam.area_id?.substring(0, 2)
        const kamIsInBogota = kam.area_id?.startsWith('11')
        
        // Lógica especial para Bogotá
        if (isInBogota) {
          // Para hospitales en Bogotá, primero todos los KAMs de Bogotá
          if (kamIsInBogota) {
            missingRoutes.push({
              hospital_id: hospital.id,
              hospital_name: hospital.name,
              hospital_location: `${hospital.municipality_name || hospital.locality_name}, ${hospital.department_name}`,
              hospital_coords: { lat: hospital.lat, lng: hospital.lng },
              kam_id: kam.id,
              kam_name: kam.name,
              kam_coords: { lat: kam.lat, lng: kam.lng },
              search_zones: ['Bogotá D.C.']
            })
            continue
          }
          
          // Luego KAMs de Cundinamarca y vecinos
          const bogotaNeighbors = getNeighborDepartments('11', 2)
          if (bogotaNeighbors.has(kamDept)) {
            const searchZones = ['Cundinamarca']
            if (kamDept !== '25') {
              const deptName = getDepartmentName(kamDept)
              if (deptName) searchZones.push(deptName)
            }
            
            missingRoutes.push({
              hospital_id: hospital.id,
              hospital_name: hospital.name,
              hospital_location: `${hospital.locality_name}, Bogotá D.C.`,
              hospital_coords: { lat: hospital.lat, lng: hospital.lng },
              kam_id: kam.id,
              kam_name: kam.name,
              kam_coords: { lat: kam.lat, lng: kam.lng },
              search_zones: searchZones
            })
          }
        } else {
          // Para hospitales fuera de Bogotá
          const hospitalNeighbors = getNeighborDepartments(hospitalDept, kam.enable_level2 ? 2 : 1)
          
          if (hospitalNeighbors.has(kamDept)) {
            const searchZones = []
            
            // Agregar zonas de búsqueda
            if (hospitalDept === kamDept) {
              searchZones.push(getDepartmentName(hospitalDept) || hospitalDept)
            } else {
              searchZones.push(getDepartmentName(hospitalDept) || hospitalDept)
              
              // Si el KAM está en un departamento vecino
              const directNeighbors = adjacencyMatrix[hospitalDept] || []
              if (directNeighbors.includes(kamDept)) {
                searchZones.push(`${getDepartmentName(kamDept)} (vecino)`)
              } else {
                searchZones.push(`${getDepartmentName(kamDept)} (vecino nivel 2)`)
              }
            }
            
            missingRoutes.push({
              hospital_id: hospital.id,
              hospital_name: hospital.name,
              hospital_location: `${hospital.municipality_name}, ${hospital.department_name}`,
              hospital_coords: { lat: hospital.lat, lng: hospital.lng },
              kam_id: kam.id,
              kam_name: kam.name,
              kam_coords: { lat: kam.lat, lng: kam.lng },
              search_zones: searchZones
            })
          }
        }
      }
    }

    // Ordenar por hospital y luego por KAM
    missingRoutes.sort((a, b) => {
      if (a.hospital_name !== b.hospital_name) {
        return a.hospital_name.localeCompare(b.hospital_name)
      }
      return a.kam_name.localeCompare(b.kam_name)
    })

    console.log('analyze-missing: Analysis complete:', {
      hospitalsAnalyzed: hospitals?.length || 0,
      kamsAnalyzed: kams?.length || 0,
      existingRoutes: existingRoutes?.length || 0,
      missingRoutesCount: missingRoutes.length
    })
    
    return NextResponse.json({
      success: true,
      hospitalsAnalyzed: hospitals?.length || 0,
      kamsAnalyzed: kams?.length || 0,
      existingRoutes: existingRoutes?.length || 0,
      missingRoutes,
      missingRoutesCount: missingRoutes.length,
      affectedHospitals: [...new Set(missingRoutes.map(r => r.hospital_id))].length
    })

  } catch (error) {
    console.error('analyze-missing: Fatal error:', error)
    console.error('analyze-missing: Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al analizar rutas',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// Función auxiliar para obtener nombre del departamento
function getDepartmentName(code: string): string | null {
  const departments: Record<string, string> = {
    '05': 'Antioquia',
    '08': 'Atlántico',
    '11': 'Bogotá D.C.',
    '13': 'Bolívar',
    '15': 'Boyacá',
    '17': 'Caldas',
    '18': 'Caquetá',
    '19': 'Cauca',
    '20': 'Cesar',
    '23': 'Córdoba',
    '25': 'Cundinamarca',
    '27': 'Chocó',
    '41': 'Huila',
    '44': 'La Guajira',
    '47': 'Magdalena',
    '50': 'Meta',
    '52': 'Nariño',
    '54': 'Norte de Santander',
    '63': 'Quindío',
    '66': 'Risaralda',
    '68': 'Santander',
    '70': 'Sucre',
    '73': 'Tolima',
    '76': 'Valle del Cauca',
    '81': 'Arauca',
    '85': 'Casanare',
    '86': 'Putumayo',
    '88': 'San Andrés',
    '91': 'Amazonas',
    '94': 'Guainía',
    '95': 'Guaviare',
    '97': 'Vaupés',
    '99': 'Vichada'
  }
  return departments[code] || null
}