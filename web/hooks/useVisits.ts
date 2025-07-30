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
  year?: number
  visitType?: string
  contactType?: string
  kamId?: string
}) {
  return useQuery({
    queryKey: ['visits', filters],
    queryFn: async () => {
      let query = supabase
        .from('visits')
        .select('*')
        .is('deleted_at', null)
        .order('visit_date', { ascending: false })

      // Aplicar filtros si existen
      if (filters?.month && filters?.year) {
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

      if (filters?.kamId) {
        query = query.eq('kam_id', filters.kamId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Visit[]
    },
    staleTime: 60000, // 1 minuto
  })
}