import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE, businessLineUpdateSchema } from '@/lib/fase1-schemas'
import type { BusinessLineResponse } from '@/lib/types/lines'
import { loadBusinessLines } from '../_lib/line-shared'
import { MENSAJE_FALTA_0960, faltaLa0960, listarEmpresas } from '@/lib/empresas'
import { EMPRESA_VG_ID, tienePermiso } from '@/lib/empresas-reglas'
import { isLineLeader } from '@/lib/coverage'

type Params = { params: { id: string } }

type PlanDeEmpresas = { agregar: string[]; quitar: string[] } | { respuesta: NextResponse }

/**
 * Qué empresas agrega y quita un PATCH con empresa_ids, o la respuesta de error (sin escribir nada):
 * 503 sin la migración 0960, 404 si la línea no existe, 400 si alguna empresa no existe o está inactiva, y 409 si se
 * quita una empresa donde la línea tiene un líder de negocio activo o asignaciones (en VG, también executive_lines).
 * Las filas de empresas inactivas no se tocan (no se muestran ni se eligen).
 */
async function planearEmpresas(lineId: string, pedidas: string[]): Promise<PlanDeEmpresas> {
  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from('linea_empresas')
    .select('empresa_id')
    .eq('line_id', lineId)
  if (faltaLa0960(vinculosError)) return { respuesta: jsonError(MENSAJE_FALTA_0960, 503) }
  if (vinculosError) throw vinculosError

  const { data: existe, error: existeError } = await supabaseAdmin.from('business_lines').select('id').eq('id', lineId).limit(1)
  if (existeError) throw existeError
  if (!existe || existe.length === 0) return { respuesta: jsonError('Línea no encontrada', 404) }

  const activas = await listarEmpresas()
  const activasPorId = new Map(activas.map(empresa => [empresa.id, empresa]))
  if (pedidas.some(id => !activasPorId.has(id))) return { respuesta: jsonError('Empresa no válida', 400) }

  const actuales = new Set(((vinculos || []) as Array<{ empresa_id: string }>).map(v => v.empresa_id))
  const agregar = pedidas.filter(id => !actuales.has(id))
  const quitar = Array.from(actuales).filter(id => activasPorId.has(id) && !pedidas.includes(id))
  if (quitar.length === 0) return { agregar, quitar }

  // En VG, entre la 0960 y la 0970, la verdad de quién lleva la línea en Zonas es executive_lines (las asignaciones son
  // el espejo de la semilla): quitar VG también se bloquea si alguien la lleva allí
  const quitaVG = quitar.includes(EMPRESA_VG_ID)
  const [lideres, asignaciones, enZonas] = await Promise.all([
    supabaseAdmin
      .from('papeles')
      .select('empresa_id')
      .eq('papel', 'line_leader')
      .eq('line_id', lineId)
      .eq('activo', true)
      .in('empresa_id', quitar),
    supabaseAdmin.from('asignaciones').select('empresa_id').eq('line_id', lineId).in('empresa_id', quitar),
    quitaVG
      ? supabaseAdmin.from('executive_lines').select('line_id').eq('line_id', lineId).limit(1)
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])
  for (const resultado of [lideres, asignaciones, enZonas]) {
    if (faltaLa0960(resultado.error)) return { respuesta: jsonError(MENSAJE_FALTA_0960, 503) }
    if (resultado.error) throw resultado.error
  }
  const ocupadas = new Set([...(lideres.data || []), ...(asignaciones.data || [])].map(fila => (fila as { empresa_id: string }).empresa_id))
  if (quitaVG && (enZonas.data || []).length > 0) ocupadas.add(EMPRESA_VG_ID)
  const conflicto = quitar.filter(id => ocupadas.has(id))
  if (conflicto.length > 0) {
    const nombres = conflicto.map(id => activasPorId.get(id)?.nombre_corto ?? id).join(', ')
    return { respuesta: jsonError(`Esa línea tiene líder o asignaciones en ${nombres}`, 409) }
  }
  return { agregar, quitar }
}

// PATCH /api/business-lines/[id] — cambia nombre, líder, alcance máximo o estado de una línea. Con la 0960 el líder
// (leader_user_id) ya no se cambia aquí: 409, se cambia en Usuarios (papel line_leader).
// code y sort_order no se editan desde la API. empresa_ids reemplaza las empresas de la línea (linea_empresas).
// Fase 2: line_leader (lines:edit sin map:all-lines) solo edita la línea que lidera, y no puede
// cambiar su líder ni su estado (eso queda para admin y dirección comercial).
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'lines:edit')
  if (!auth.ok) return auth.response

  if (!UUID_RE.test(params.id)) return jsonError('ID de línea no válido', 400)
  const lineId = params.id.toLowerCase()

  try {
    const parsed = businessLineUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const changes = parsed.data

    if (!tienePermiso(auth.user.papeles, 'map:all-lines')) {
      if (!(await isLineLeader(auth.user, lineId))) {
        return jsonError('Solo puedes editar la línea que lideras', 403)
      }
      if (changes.leader_user_id !== undefined || changes.active !== undefined) {
        return jsonError('Solo un administrador o la dirección comercial puede cambiar el líder o el estado de la línea', 403)
      }
      if (changes.empresa_ids !== undefined) {
        return jsonError('Solo un administrador o la dirección comercial puede cambiar las empresas de la línea', 403)
      }
    }

    // Con la 0960 el líder es un papel (line_leader) y leader_user_id solo su caché: se cambia en Usuarios
    if (changes.leader_user_id !== undefined) {
      const { error: sondeoError } = await supabaseAdmin.from('papeles').select('id').limit(1)
      if (!sondeoError) return jsonError('El líder se cambia en Usuarios', 409)
      if (!faltaLa0960(sondeoError)) throw sondeoError
    }

    // El líder debe ser un usuario activo de OpMap
    if (changes.leader_user_id) {
      const { data: leader, error: leaderError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', changes.leader_user_id)
        .eq('active', true)
        .limit(1)
      if (leaderError) throw leaderError
      if (!leader || leader.length === 0) {
        return jsonError('El líder seleccionado no existe o está inactivo', 400)
      }
    }

    // Empresas de la línea: se valida TODO antes de escribir algo (también los demás campos)
    let empresasPorAgregar: string[] = []
    let empresasPorQuitar: string[] = []
    if (changes.empresa_ids !== undefined) {
      const plan = await planearEmpresas(lineId, changes.empresa_ids)
      if ('respuesta' in plan) return plan.respuesta
      empresasPorAgregar = plan.agregar
      empresasPorQuitar = plan.quitar
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (changes.name !== undefined) update.name = changes.name
    if (changes.leader_user_id !== undefined) update.leader_user_id = changes.leader_user_id
    if (changes.max_reach_minutes !== undefined) update.max_reach_minutes = changes.max_reach_minutes
    if (changes.active !== undefined) update.active = changes.active

    const { data, error } = await supabaseAdmin
      .from('business_lines')
      .update(update)
      .eq('id', lineId)
      .select('id')

    if (error) {
      if (error.code === '23503') {
        return jsonError('El líder seleccionado no existe', 400)
      }
      console.error('Error actualizando línea de negocio:', error)
      return jsonError('Error al actualizar la línea', 500)
    }
    if (!data || data.length === 0) {
      return jsonError('Línea no encontrada', 404)
    }

    // Primero se agregan las nuevas y luego se quitan las viejas: la línea nunca se queda sin empresa
    if (empresasPorAgregar.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('linea_empresas')
        .insert(empresasPorAgregar.map(empresa_id => ({ line_id: lineId, empresa_id })))
      if (insertError) {
        if (faltaLa0960(insertError)) return jsonError(MENSAJE_FALTA_0960, 503)
        throw insertError
      }
    }
    if (empresasPorQuitar.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('linea_empresas')
        .delete()
        .eq('line_id', lineId)
        .in('empresa_id', empresasPorQuitar)
      if (deleteError) throw deleteError
    }

    const [line] = await loadBusinessLines(lineId)
    if (!line) return jsonError('Línea no encontrada', 404)

    const body: BusinessLineResponse = { line }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en PATCH /api/business-lines/[id]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
