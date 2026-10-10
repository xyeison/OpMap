// Recálculo completo de asignaciones con SimplifiedOpMapAlgorithm (sin fetch HTTP a la propia app).
// Lo usan /api/recalculate-simplified y /api/recalculate-smart-hospital.
import { SimplifiedOpMapAlgorithm } from '@/lib/opmap-algorithm-simplified'

export interface FullRecalculationResult {
  totalAssignments: number
  assignmentFor: (hospitalId: string) => { kam_id: string; travel_time: number | null; assignment_type: string } | undefined
}

export async function runFullRecalculation(): Promise<FullRecalculationResult> {
  const algorithm = new SimplifiedOpMapAlgorithm()
  await algorithm.loadData()
  const assignments = await algorithm.calculateAssignments()
  await algorithm.saveAssignments(assignments)

  const byHospital = new Map(assignments.map(a => [a.hospital_id, a]))
  return {
    totalAssignments: assignments.length,
    assignmentFor: (hospitalId: string) => byHospital.get(hospitalId),
  }
}
