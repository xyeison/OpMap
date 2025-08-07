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

    // 1. Contar total de visitas
    const { count: totalVisits } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)

    // 2. Obtener años y meses disponibles
    const { data: availableDates } = await supabase
      .from('visits')
      .select('visit_date')
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
      .limit(100)

    // Procesar fechas para obtener años y meses únicos
    const dateMap = new Map<string, Set<number>>()
    if (availableDates) {
      availableDates.forEach(row => {
        const date = new Date(row.visit_date)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        
        if (!dateMap.has(year.toString())) {
          dateMap.set(year.toString(), new Set())
        }
        dateMap.get(year.toString())?.add(month)
      })
    }

    // Convertir a formato más legible
    const availableYearsMonths: any = {}
    dateMap.forEach((months, year) => {
      availableYearsMonths[year] = Array.from(months).sort((a, b) => a - b)
    })

    // 3. Obtener conteo por año
    const yearCounts: any = {}
    for (const year of Object.keys(availableYearsMonths)) {
      const { count } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('visit_date', `${year}-01-01`)
        .lt('visit_date', `${Number(year) + 1}-01-01`)
      
      yearCounts[year] = count || 0
    }

    // 4. Obtener algunas visitas de muestra
    const { data: sampleVisits } = await supabase
      .from('visits')
      .select('*')
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
      .limit(5)

    // 5. Verificar estructura de coordenadas
    let coordinateCheck = null
    if (sampleVisits && sampleVisits.length > 0) {
      const firstVisit = sampleVisits[0]
      coordinateCheck = {
        hasLat: 'lat' in firstVisit,
        hasLng: 'lng' in firstVisit,
        latType: typeof firstVisit.lat,
        lngType: typeof firstVisit.lng,
        latValue: firstVisit.lat,
        lngValue: firstVisit.lng,
        isValidLat: firstVisit.lat && !isNaN(Number(firstVisit.lat)),
        isValidLng: firstVisit.lng && !isNaN(Number(firstVisit.lng))
      }
    }

    return NextResponse.json({
      totalVisits,
      availableYearsMonths,
      yearCounts,
      sampleVisits,
      coordinateCheck,
      message: totalVisits === 0 
        ? 'No hay visitas en la base de datos. Necesitas importar visitas desde la página de Visitas.'
        : `Hay ${totalVisits} visitas disponibles en los siguientes años: ${Object.keys(availableYearsMonths).join(', ')}`
    })
  } catch (error) {
    console.error('Error in GET /api/visits/check-data:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 }
    )
  }
}