// POST /api/executives/[id]/traspaso/vista-previa (executives:transfer) — lo que haría el traspaso de lo de este
// Ejecutivo Comercial (quien entrega = [id]) con el cuerpo de traspasoSchema, SIN escribir nada: por línea, sus
// zonas, ajustes manuales, nombre del territorio, médicos que pasan, que solo se terminan y omitidos, la versión
// final del anexo y los avisos de cobertura; y el resumen con el mismo conteo que devuelve ejecutivas_traspasar.
// 200 VistaPreviaTraspaso (con ok = false y la lista de errores si el traspaso se rechazaría); 400 cuerpo no válido;
// 404 si quien entrega no existe. No necesita la migración 0820.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md. La lógica es planearTraspaso (lib/traspaso.ts).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { traspasoSchema } from '@/lib/traspaso-schemas'
import { planearTraspaso, type VistaPreviaTraspaso } from '@/lib/traspaso'
import { UUID_RE } from '@/lib/fase1-schemas'
import { todayInBogota } from '../../../_lib/executive-shared'
import { cargarDatosTraspaso } from '../../../_lib/traspaso-server'

type Params = { params: { id: string } }

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:transfer')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de Ejecutivo Comercial no válido', 400)
  const origenId = params.id.toLowerCase()

  try {
    const parsed = traspasoSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

    const datos = await cargarDatosTraspaso(origenId, parsed.data, todayInBogota(), auth.user.id)
    if (!datos.ejecutivas.some(ejecutiva => ejecutiva.id === origenId)) {
      return jsonError('Ejecutivo Comercial no encontrado', 404)
    }

    const body: VistaPreviaTraspaso = planearTraspaso(datos)
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en POST /api/executives/[id]/traspaso/vista-previa:', error)
    return jsonError('Error al preparar la vista previa del traspaso', 500)
  }
}
