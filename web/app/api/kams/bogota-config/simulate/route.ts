import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { parseSimulationQuery, validateBogotaConfigInput } from '@/lib/bogota-admin'
import { serverError } from '../../../_lib/api-error'
import { loadBogotaCells, readBogotaConfig } from '../../../_lib/bogota-config'
import { runBogotaSimulation } from '../../_lib/bogota-simulation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Carga todas las distancias y ejecuta el algoritmo completo en memoria
export const maxDuration = 60

// GET /api/kams/bogota-config/simulate?k=&max=&norte=&occidente=&sur=&oriente=
// Ejecuta el motor de asignación EN MEMORIA con la configuración propuesta (sin parámetros: la guardada)
// y devuelve el resumen frente a las asignaciones guardadas hoy: por celda antes/después, cambios, IPS
// fuera de alcance, IPS sin corredor y asignaciones forzadas. SOLO LECTURA: no guarda nada, no llama a
// Google. Permiso recalculate:complete (el mismo del recálculo).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'recalculate:complete')
  if (!auth.ok) return auth.response

  try {
    const cells = await loadBogotaCells()
    let proposal: unknown = parseSimulationQuery(request.nextUrl.searchParams)
    if (proposal === null) {
      const saved = await readBogotaConfig()
      if (!saved) {
        return NextResponse.json(
          { error: 'No hay configuración de Bogotá guardada: envía k, max y la celda de cada corredor.' },
          { status: 400 }
        )
      }
      proposal = saved.config
    }

    const validation = validateBogotaConfigInput(proposal, new Set(cells.map(c => c.id)))
    if (!validation.ok) {
      return NextResponse.json({ error: validation.errors.join(' '), errors: validation.errors }, { status: 400 })
    }

    const result = await runBogotaSimulation(validation.value, cells)
    return NextResponse.json(result)
  } catch (error) {
    return serverError('kams/bogota-config/simulate GET', error, 'Error al simular la configuración de Bogotá')
  }
}
