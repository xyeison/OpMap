import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fetchAllRows } from '../_lib/kam-shared'

interface KamStats {
  kam_id: string
  hospital_count: number
  municipality_count: number
  contract_value_total: number
  // Minutos, promedio de las asignaciones no forzadas con tiempo conocido (null si no hay)
  avg_travel_time: number | null
  area_name: string | null
}

// GET /api/kams/stats — métricas por KAM leídas con service_role (A-10: con la anon key todo salía en cero).
// Sin Región: las Regiones (tabla zones) se quitaron de la web el 2026-10-14 y aquí ya no se leen.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'kams:view')
  if (!auth.ok) return auth.response

  try {
    const [kams, assignments, contracts] = await Promise.all([
      fetchAllRows<{ id: string; area_id: string }>((from, to) =>
        supabaseAdmin.from('kams').select('id, area_id').order('id').range(from, to)
      ),
      fetchAllRows<{
        id: string
        kam_id: string
        hospital_id: string
        travel_time: number | null
        assignment_type: string | null
        hospitals: { municipality_id: string | null } | { municipality_id: string | null }[] | null
      }>((from, to) =>
        supabaseAdmin
          .from('assignments')
          .select('id, kam_id, hospital_id, travel_time, assignment_type, hospitals(municipality_id)')
          .order('id')
          .range(from, to)
      ),
      fetchAllRows<{ id: string; hospital_id: string; contract_value: number | null }>((from, to) =>
        supabaseAdmin
          .from('hospital_contracts')
          .select('id, hospital_id, contract_value')
          .eq('active', true)
          .order('id')
          .range(from, to)
      ),
    ])

    // Nombres de área: municipios (5 dígitos) y localidades de Bogotá (7 dígitos)
    const municipalityCodes = Array.from(new Set(kams.map(k => k.area_id).filter(a => a && a.length === 5)))
    const localityCodes = Array.from(new Set(kams.map(k => k.area_id).filter(a => a && a.length === 7)))
    const areaNames = new Map<string, string>()

    if (municipalityCodes.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('municipalities')
        .select('code, name')
        .in('code', municipalityCodes)
      if (error) throw error
      data?.forEach(m => areaNames.set(m.code, m.name))
    }
    if (localityCodes.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('hospitals')
        .select('locality_id, locality_name')
        .in('locality_id', localityCodes)
        .not('locality_name', 'is', null)
      if (error) throw error
      data?.forEach(h => {
        if (h.locality_id && h.locality_name && !areaNames.has(h.locality_id)) {
          areaNames.set(h.locality_id, h.locality_name)
        }
      })
    }

    const contractValueByHospital = new Map<string, number>()
    contracts.forEach(c => {
      contractValueByHospital.set(
        c.hospital_id,
        (contractValueByHospital.get(c.hospital_id) || 0) + Number(c.contract_value || 0)
      )
    })

    const acc = new Map<
      string,
      { hospitals: number; municipalities: Set<string>; value: number; timeSum: number; timeCount: number }
    >()
    kams.forEach(k => acc.set(k.id, { hospitals: 0, municipalities: new Set(), value: 0, timeSum: 0, timeCount: 0 }))

    assignments.forEach(a => {
      const entry = acc.get(a.kam_id)
      if (!entry) return
      entry.hospitals += 1
      const hospital = Array.isArray(a.hospitals) ? a.hospitals[0] : a.hospitals
      if (hospital?.municipality_id) entry.municipalities.add(hospital.municipality_id)
      entry.value += contractValueByHospital.get(a.hospital_id) || 0
      // travel_time está en SEGUNDOS; las forzadas no tienen un tiempo comparable
      if (a.assignment_type !== 'forced' && a.travel_time !== null && a.travel_time !== undefined) {
        entry.timeSum += Number(a.travel_time)
        entry.timeCount += 1
      }
    })

    const stats: KamStats[] = kams.map(k => {
      const entry = acc.get(k.id)!
      return {
        kam_id: k.id,
        hospital_count: entry.hospitals,
        municipality_count: entry.municipalities.size,
        contract_value_total: entry.value,
        avg_travel_time: entry.timeCount > 0 ? Math.round((entry.timeSum / entry.timeCount / 60) * 10) / 10 : null,
        area_name: areaNames.get(k.area_id) || null,
      }
    })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error en GET /api/kams/stats:', error)
    return NextResponse.json({ error: 'Error al cargar las estadísticas de zonas' }, { status: 500 })
  }
}
