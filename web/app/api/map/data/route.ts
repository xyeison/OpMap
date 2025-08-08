import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Cargar todos los datos necesarios para el mapa
    const [kamsResult, assignmentsResult, municipalitiesResult, hospitalsResult, contractsResult] = await Promise.all([
      supabase.from('kams').select('*').eq('active', true),
      supabase.from('assignments').select('*, hospitals!inner(*), kams!inner(*)'),
      supabase.from('municipalities').select('id, name, population_2025'),
      supabase.from('hospitals').select('*').eq('active', true),
      supabase.from('hospital_contracts').select('hospital_id, contract_value, provider').eq('active', true)
    ])

    console.log('Map data loaded:', {
      kams: kamsResult.data?.length || 0,
      assignments: assignmentsResult.data?.length || 0,
      hospitals: hospitalsResult.data?.length || 0,
      contracts: contractsResult.data?.length || 0
    })

    // Crear mapas de población y nombres por municipio
    const populationMap: Record<string, number> = {}
    const municipalityNames: Record<string, string> = {}
    municipalitiesResult.data?.forEach(m => {
      populationMap[m.id] = m.population_2025 || 0
      municipalityNames[m.id] = m.name
    })

    // Crear mapa de valores de contratos activos y proveedores por hospital
    const contractValuesByHospital: Record<string, number> = {}
    const contractProvidersByHospital: Record<string, string[]> = {}
    
    contractsResult.data?.forEach(contract => {
      if (!contractValuesByHospital[contract.hospital_id]) {
        contractValuesByHospital[contract.hospital_id] = 0
        contractProvidersByHospital[contract.hospital_id] = []
      }
      contractValuesByHospital[contract.hospital_id] += Number(contract.contract_value) || 0
      
      // Agregar proveedor si existe y no está duplicado
      if (contract.provider && !contractProvidersByHospital[contract.hospital_id].includes(contract.provider)) {
        contractProvidersByHospital[contract.hospital_id].push(contract.provider)
      }
    })

    // Identificar hospitales sin asignar (zonas vacantes)
    const assignedHospitalIds = new Set(assignmentsResult.data?.map(a => a.hospitals.id) || [])
    const unassignedHospitals = hospitalsResult.data?.filter(h => !assignedHospitalIds.has(h.id)) || []

    // Calcular estadísticas por territorio
    const territoryStats: Record<string, any> = {}
    
    // Estadísticas de hospitales asignados
    assignmentsResult.data?.forEach(assignment => {
      const territoryId = assignment.hospitals.locality_id || assignment.hospitals.municipality_id
      if (!territoryId) return
      
      if (!territoryStats[territoryId]) {
        territoryStats[territoryId] = {
          totalHospitals: 0,
          totalBeds: 0,
          totalAmbulances: 0,
          totalSurgeries: 0,
          totalContracts: 0,
          contractValue: 0,
          providers: new Set(),
          kamId: assignment.kams.id,
          kamName: assignment.kams.name
        }
      }
      
      territoryStats[territoryId].totalHospitals++
      territoryStats[territoryId].totalBeds += assignment.hospitals.beds || 0
      territoryStats[territoryId].totalAmbulances += assignment.hospitals.ambulances || 0
      territoryStats[territoryId].totalSurgeries += assignment.hospitals.surgeries || 0
      
      // Agregar información de contratos
      if (contractValuesByHospital[assignment.hospitals.id]) {
        territoryStats[territoryId].totalContracts++
        territoryStats[territoryId].contractValue += contractValuesByHospital[assignment.hospitals.id]
      }
      if (contractProvidersByHospital[assignment.hospitals.id]) {
        contractProvidersByHospital[assignment.hospitals.id].forEach(provider => {
          territoryStats[territoryId].providers.add(provider)
        })
      }
    })
    
    // Estadísticas de hospitales sin asignar
    unassignedHospitals.forEach(hospital => {
      const territoryId = hospital.locality_id || hospital.municipality_id
      if (!territoryId) return
      
      if (!territoryStats[territoryId]) {
        territoryStats[territoryId] = {
          totalHospitals: 0,
          totalBeds: 0,
          totalAmbulances: 0,
          totalSurgeries: 0,
          totalContracts: 0,
          contractValue: 0,
          providers: new Set(),
          kamId: null,
          kamName: 'Sin asignar'
        }
      }
      
      territoryStats[territoryId].totalHospitals++
      territoryStats[territoryId].totalBeds += hospital.beds || 0
      territoryStats[territoryId].totalAmbulances += hospital.ambulances || 0
      territoryStats[territoryId].totalSurgeries += hospital.surgeries || 0
      
      // Agregar información de contratos
      if (contractValuesByHospital[hospital.id]) {
        territoryStats[territoryId].totalContracts++
        territoryStats[territoryId].contractValue += contractValuesByHospital[hospital.id]
      }
      if (contractProvidersByHospital[hospital.id]) {
        contractProvidersByHospital[hospital.id].forEach(provider => {
          territoryStats[territoryId].providers.add(provider)
        })
      }
    })
    
    // Convertir Sets a arrays
    Object.keys(territoryStats).forEach(key => {
      territoryStats[key].providers = Array.from(territoryStats[key].providers)
    })

    return NextResponse.json({
      kams: kamsResult.data || [],
      assignments: assignmentsResult.data || [],
      hospitals: hospitalsResult.data || [],
      unassignedHospitals,
      populationMap,
      municipalityNames,
      contractValuesByHospital,
      contractProvidersByHospital,
      territoryStats
    })
  } catch (error) {
    console.error('Error in GET /api/map/data:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}