import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-role'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { TERRITORY_UUID_RE, canManageTerritoryLine, createSnapshot, listSnapshots } from '@/lib/territory'
import { readLineAndExecutive } from '../_lib/territory-route'

export const dynamic = 'force-dynamic'

const idSchema = (label: string) =>
  z
    .string({ required_error: `Falta ${label}`, invalid_type_error: `${label} no válido` })
    .regex(TERRITORY_UUID_RE, `${label} no válido`)
    .transform(value => value.toLowerCase())

// Allow-list: cualquier otra clave se descarta
const snapshotSchema = z.object({
  line_id: idSchema('line_id'),
  executive_id: idSchema('executive_id'),
  version_label: z
    .string({ required_error: 'La etiqueta de la versión es obligatoria', invalid_type_error: 'Etiqueta no válida' })
    .trim()
    .min(1, 'La etiqueta de la versión es obligatoria')
    .max(60, 'La etiqueta no puede superar 60 caracteres'),
  note: z
    .string({ invalid_type_error: 'Nota no válida' })
    .trim()
    .max(1000, 'La nota no puede superar 1000 caracteres')
    .nullish()
    .transform(value => (value ? value : null)),
})

// GET /api/territory/snapshots?line=<code>&executive=<id> — versiones guardadas (más reciente primero).
// territory:view con las mismas reglas de acceso que GET /api/territory.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'territory:view')
  if (!auth.ok) return auth.response

  try {
    const parsed = await readLineAndExecutive(request, auth.user, { requireExecutive: true })
    if (!parsed.ok) return parsed.response

    const result = await listSnapshots(parsed.access.line.id, parsed.executiveId!)
    if (!result.ok) return jsonError(result.error, result.status)
    return NextResponse.json({ snapshots: result.value }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en GET /api/territory/snapshots:', error)
    return jsonError('Error al cargar las versiones', 500)
  }
}

// POST /api/territory/snapshots { line_id, executive_id, version_label, note } — guarda una versión
// INMUTABLE del territorio vigente (anexos A y B, resumen y content_hash). territory:snapshot;
// line_leader solo en la línea que lidera. 409 si la etiqueta ya existe para ese ejecutivo y línea.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'territory:snapshot')
  if (!auth.ok) return auth.response

  const body = await readJson(request)
  if (body === null) return jsonError('Cuerpo JSON no válido', 400)
  const parsed = snapshotSchema.safeParse(body)
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const input = parsed.data

  try {
    if (!(await canManageTerritoryLine(auth.user, input.line_id, 'territory:snapshot'))) {
      return jsonError('Solo puedes guardar versiones de la línea que lideras', 403)
    }

    const result = await createSnapshot({
      lineId: input.line_id,
      executiveId: input.executive_id,
      versionLabel: input.version_label,
      note: input.note,
      userId: auth.user.id,
    })
    if (!result.ok) return jsonError(result.error, result.status)
    return NextResponse.json({ snapshot: result.value }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/territory/snapshots:', error)
    return jsonError('Error al guardar la versión', 500)
  }
}
