import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Visit {
  id: string
  kam_id: string
  kam_name: string
  visit_type: string
  contact_type: string
  lat: number
  lng: number
  visit_date: string
  hospital_name: string | null
  observations: string | null
}

export function useVisits(filters?: {
  month?: number
  months?: number[]  // Para múltiples meses
  year?: number
  visitType?: string
  contactType?: string
  kamId?: string
  kamIds?: string[]  // Para múltiples KAMs
}) {
  return useQuery({
    queryKey: ['visits', filters],
    queryFn: async () => {
      console.log('useVisits - Filtros recibidos:', filters)
      
      let query = supabase
        .from('visits')
        .select('*')
        .is('deleted_at', null)
        .order('visit_date', { ascending: false })

      // Aplicar filtros si existen
      if (filters?.months && filters?.months.length > 0 && filters?.year) {
        console.log('useVisits - Aplicando filtro de múltiples meses:', filters.months)
        
        // Para múltiples meses, hacer queries separadas y combinar
        const allVisits: Visit[] = []
        
        for (const month of filters.months) {
          const startDate = `${filters.year}-${String(month).padStart(2, '0')}-01`
          const endDate = month === 12 
            ? `${filters.year + 1}-01-01`
            : `${filters.year}-${String(month + 1).padStart(2, '0')}-01`
          
          let monthQuery = supabase
            .from('visits')
            .select('*')
            .is('deleted_at', null)
            .gte('visit_date', startDate)
            .lt('visit_date', endDate)
          
          // Aplicar otros filtros
          if (filters?.visitType) {
            monthQuery = monthQuery.eq('visit_type', filters.visitType)
          }
          if (filters?.contactType) {
            monthQuery = monthQuery.eq('contact_type', filters.contactType)
          }
          if (filters?.kamIds && filters.kamIds.length > 0) {
            monthQuery = monthQuery.in('kam_id', filters.kamIds)
          }
          
          const { data: monthData, error } = await monthQuery
          if (error) throw error
          if (monthData) {
            allVisits.push(...(monthData as Visit[]))
          }
        }
        
        // Ordenar por fecha descendente y eliminar duplicados
        const uniqueVisits = Array.from(new Map(allVisits.map(v => [v.id, v])).values())
        uniqueVisits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())
        
        console.log('useVisits - Total visitas múltiples meses:', uniqueVisits.length)
        return uniqueVisits
      } else if (filters?.month && filters?.year) {
        // Un solo mes
        const startDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`
        const endDate = filters.month === 12 
          ? `${filters.year + 1}-01-01`
          : `${filters.year}-${String(filters.month + 1).padStart(2, '0')}-01`
        
        query = query
          .gte('visit_date', startDate)
          .lt('visit_date', endDate)
      }

      if (filters?.visitType) {
        query = query.eq('visit_type', filters.visitType)
      }

      if (filters?.contactType) {
        query = query.eq('contact_type', filters.contactType)
      }

      if (filters?.kamIds && filters.kamIds.length > 0) {
        // Múltiples KAMs
        query = query.in('kam_id', filters.kamIds)
      } else if (filters?.kamId) {
        // Un solo KAM
        query = query.eq('kam_id', filters.kamId)
      }

      const { data, error } = await query

      console.log('useVisits - Resultado final de la query:', { 
        count: data?.length || 0, 
        error: error?.message,
        primeras_3: data?.slice(0, 3)
      })
      
      if (error) throw error
      return data as Visit[]
    },
    staleTime: 60000, // 1 minuto
  })
}