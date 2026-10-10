// Reglas de elegibilidad KAM -> IPS para las rutas API.
// La lógica vive en lib/opmap-algorithm-simplified.ts (fuente única, también la usa
// SimplifiedOpMapAlgorithm); este módulo solo la re-exporta con los tipos que usan las rutas
// y añade la carga de la matriz de adyacencia con el cliente service_role.
import type { SupabaseAdminClient } from '@/lib/supabase-admin'
import type { AdjacencyMatrix } from '@/lib/opmap-algorithm-simplified'

export {
  canKamCompeteForHospital,
  eligibleKamsForHospital,
  hasValidKamArea,
  isBaseTerritory,
  isBogotaHospital,
  isBogotaKam,
} from '@/lib/opmap-algorithm-simplified'
export type { AdjacencyMatrix } from '@/lib/opmap-algorithm-simplified'

export interface EligibilityKam {
  id: string
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2: boolean | null
  max_travel_time: number | null // minutos
  priority: number | null
}

export interface EligibilityHospital {
  id: string
  department_id: string
  municipality_id: string
  locality_id?: string | null
}

export async function loadAdjacency(supabase: SupabaseAdminClient): Promise<AdjacencyMatrix> {
  const { data, error } = await supabase
    .from('department_adjacency')
    .select('department_code, adjacent_department_code')
  if (error) throw error

  const matrix: AdjacencyMatrix = {}
  for (const row of data || []) {
    if (!matrix[row.department_code]) matrix[row.department_code] = []
    matrix[row.department_code].push(row.adjacent_department_code)
  }
  return matrix
}
