// POST /api/config-visitas/vista-previa (visits:config) — qué haría un cambio de configuración ANTES de guardarlo:
// qué valor se corta, cuál se anula, qué continúa después de un valor temporal, hasta cuándo rige el nuevo y qué
// meses se recalculan. NO escribe nada: planearCambio (lógica pura, espejo de config_registrar) sobre las filas
// reales de esa clave. Cuerpo: cambioConfigSchema. Si el cuerpo no trae la clave "motivo", el motivo no se revisa
// (la pantalla muestra el plan antes de que lo escriban; con "motivo" se revisa igual que al guardar).
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { cambioConfigSchema } from '@/lib/visits-config-schemas'
import { mesesAfectados, planearCambio, type VistaPreviaResponse } from '@/lib/visits-rules'
import { errorVisitas, filasDeLaClave, hoyActual, validarReferencias } from '../_lib/visitas-server'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  try {
    const cuerpo = await readJson(request)
    const parsed = cambioConfigSchema.safeParse(cuerpo)
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const cambio = parsed.data

    const referencia = await validarReferencias(cambio)
    if (referencia) return jsonError(referencia, 400)

    const hoy = hoyActual()
    const conMotivo = cuerpo !== null && typeof cuerpo === 'object' && 'motivo' in cuerpo
    const plan = planearCambio(
      await filasDeLaClave(cambio),
      { desde: cambio.desde, hasta: cambio.hasta, ...(conMotivo ? { motivo: cambio.motivo } : {}) },
      hoy
    )
    const respuesta: VistaPreviaResponse = {
      plan,
      meses_recalculados: plan.error ? [] : mesesAfectados(cambio.desde, plan.hastaEfectivo, hoy),
    }
    return NextResponse.json(respuesta)
  } catch (error) {
    return errorVisitas('POST /api/config-visitas/vista-previa', error, 'Error al preparar la vista previa del cambio')
  }
}
