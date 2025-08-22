import { useQuery } from '@tanstack/react-query'

interface Visit {
  id: string
  kam_id: string
  kam_name: string
  visit_type: string
  contact_type: string
  lat: number
  lng: number
  visit_date: string
  hospital_id?: string | null
}

export function useVisits(filters?: {
  month?: number
  months?: number[]  // Para múltiples meses
  year?: number
  startYear?: number  // Para rango de años
  endYear?: number    // Para rango de años
  allMonths?: boolean // Para incluir todos los meses en el rango
  visitType?: string
  contactType?: string
  kamId?: string
  kamIds?: string[]  // Para múltiples KAMs
} | null) {
  return useQuery({
    queryKey: ['visits', JSON.stringify(filters)], // Stringificar para forzar nueva query cuando cambian filtros
    enabled: !!filters, // Solo habilitar si hay filtros
    staleTime: 0, // No cachear, siempre hacer nueva consulta
    gcTime: 0, // No mantener en caché (garbage collection time)
    queryFn: async () => {
      // Si no hay filtros, retornar array vacío
      if (!filters) {
        console.log('useVisits - Sin filtros, retornando array vacío')
        return []
      }
      console.log('useVisits - INICIANDO QUERY con filtros:', {
        ...filters,
        monthName: filters?.month ? new Date(2000, filters.month - 1, 1).toLocaleString('es', {month: 'long'}) : 'N/A',
        kamCount: filters?.kamIds?.length || 0
      })
      
      // Construir parámetros de query
      const params = new URLSearchParams()
      
      // Para modo de rango de años
      if (filters?.startYear && filters?.endYear) {
        params.append('startYear', filters.startYear.toString())
        params.append('endYear', filters.endYear.toString())
        if (filters.allMonths) {
          params.append('allMonths', 'true')
        }
      } 
      // Para modo de mes(es) único(s)
      else {
        if (filters?.month) {
          params.append('month', filters.month.toString())
        }
        if (filters?.months && filters.months.length > 0) {
          params.append('months', filters.months.join(','))
        }
        if (filters?.year) {
          params.append('year', filters.year.toString())
        }
      }
      
      if (filters?.visitType) {
        params.append('visitType', filters.visitType)
      }
      if (filters?.contactType) {
        params.append('contactType', filters.contactType)
      }
      if (filters?.kamIds && filters.kamIds.length > 0) {
        params.append('kamIds', filters.kamIds.join(','))
      } else if (filters?.kamId) {
        params.append('kamIds', filters.kamId)
      }
      
      // Hacer la llamada a la API que usa Service Role Key
      const response = await fetch(`/api/visits/filtered?${params.toString()}`)
      
      if (!response.ok) {
        const error = await response.json()
        console.error('useVisits - ERROR en API:', error)
        throw new Error(error.error || 'Error al cargar visitas')
      }
      
      const data = await response.json()
      
      console.log('useVisits - Resultado final:', { 
        count: data?.length || 0,
        primeras_3: data?.slice(0, 3)
      })
      
      console.log('useVisits - Devolviendo', data?.length || 0, 'visitas')
      return data as Visit[]
    }
  })
}