// POST /api/executives/[id]/contratar (executives:edit) — la vacante ([id], estado placeholder) pasa
// a ser la persona contratada: la MISMA fila queda activa con su nombre, email y fecha de ingreso (started_at), y
// conserva todo lo que la vacante tenía (zona base, líneas, ajustes manuales de cobertura, nombre del territorio y
// médicos). Su usuario de OpMap es el del email de la persona contratada (si existe y no está enlazado con otro
// Ejecutivo Comercial) o ninguno: el de quien ocupaba antes la ficha (p. ej. una persona pasada a Vacante desde
// Editar) se desenlaza siempre, para que no vea los médicos, la configuración ni el territorio de la contratada.
// Cuerpo: contratarSchema (lib/traspaso-schemas.ts) { full_name, email?, fecha_ingreso? (por defecto hoy) }.
// 200 { executive, usuario_enlazado }; 400 datos no válidos o no es una vacante; 404 no existe; 409 email de otro
// Ejecutivo Comercial. No recalcula la cobertura: una vacante y una persona activa cuentan igual en ella.
// Spec: docs/specs/2026-10-12-traspaso-ejecutivo-comercial.md ("Contratar").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE } from '@/lib/fase1-schemas'
import { contratarSchema } from '@/lib/traspaso-schemas'
import type { Executive, ExecutiveStatus } from '@/lib/types/lines'
import { loadExecutives, resolveUserIdByEmail, todayInBogota } from '../../_lib/executive-shared'

type Params = { params: { id: string } }

const CONTEXTO = 'POST /api/executives/[id]/contratar'
const MENSAJE_SOLO_VACANTE = 'Solo se puede contratar en una vacante'
const MENSAJE_EMAIL_EN_USO = 'Ya hay otro Ejecutivo Comercial con ese email'

/** ¿Otro Ejecutivo Comercial (no este) tiene ya ese email? Sin distinguir mayúsculas. */
async function emailDeOtro(email: string, executiveId: string): Promise<boolean> {
  const patron = email.replace(/[\\%_]/g, caracter => `\\${caracter}`)
  const { data, error } = await supabaseAdmin
    .from('executives')
    .select('id')
    .ilike('email', patron)
    .neq('id', executiveId)
    .limit(1)
  if (error) throw error
  return Boolean(data && data.length > 0)
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'executives:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de Ejecutivo Comercial no válido', 400)
  const executiveId = params.id.toLowerCase()

  try {
    const parsed = contratarSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('executives')
      .select('id, status')
      .eq('id', executiveId)
      .limit(1)
    if (actualError) throw actualError
    const actual =
      actualData && actualData.length > 0
        ? (actualData[0] as { id: string; status: ExecutiveStatus })
        : null
    if (!actual) return jsonError('Ejecutivo Comercial no encontrado', 404)
    if (actual.status !== 'placeholder') return jsonError(MENSAJE_SOLO_VACANTE, 400)

    if (input.email && (await emailDeOtro(input.email, executiveId))) return jsonError(MENSAJE_EMAIL_EN_USO, 409)

    // El usuario de OpMap es el de la persona contratada (por su email) o ninguno, como al cambiar el email en
    // Editar: nunca se conserva el de quien ocupaba antes la ficha.
    const userId = input.email ? await resolveUserIdByEmail(input.email, executiveId) : null

    // En su lugar: misma fila (conserva líneas, zona, ajustes, nombre del territorio y médicos). Solo si sigue siendo
    // vacante (si otro la cambió entretanto, no se pisa).
    const { data: actualizadas, error: updateError } = await supabaseAdmin
      .from('executives')
      .update({
        full_name: input.full_name,
        email: input.email,
        user_id: userId,
        status: 'active',
        started_at: input.fecha_ingreso ?? todayInBogota(),
        left_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', executiveId)
      .eq('status', 'placeholder')
      .select('id')
    if (updateError) {
      if (updateError.code === '23505') {
        return jsonError(
          /user_id/.test(`${updateError.details ?? ''} ${updateError.message ?? ''}`)
            ? 'Ese usuario ya está enlazado con otro Ejecutivo Comercial'
            : MENSAJE_EMAIL_EN_USO,
          409
        )
      }
      throw updateError
    }
    if (!actualizadas || actualizadas.length === 0) {
      return jsonError('La vacante cambió mientras tanto (ya no es una vacante); recarga e inténtalo de nuevo', 409)
    }

    const usuarioEnlazado = userId !== null

    const [executive] = await loadExecutives(executiveId)
    if (!executive) return jsonError('Ejecutivo Comercial no encontrado', 404)

    const body: { executive: Executive; usuario_enlazado: boolean } = { executive, usuario_enlazado: usuarioEnlazado }
    return NextResponse.json(body)
  } catch (error) {
    console.error(`Error en ${CONTEXTO}:`, error)
    return jsonError('Error interno del servidor', 500)
  }
}
