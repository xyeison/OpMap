// PUT y DELETE /api/executives/[id]/lineas/[lineId] — darle o quitarle UNA línea a un Ejecutivo Comercial o a una
// vacante desde la pantalla "Zonas" (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md; decisión del dueño en
// docs/decisiones/2026-10-23-zonas-por-linea-las-lideres-asignan.md: "a la comercial de Pereira le pongo mi línea").
//
// Quién: executives:lines (admin, dirección comercial y líder de línea) y además canEditCoverageLine: la líder solo
// en la línea que lidera (403 "Solo puedes asignar la línea que lideras"); admin y dirección, cualquiera.
// Reglas:
//   - El Ejecutivo Comercial debe estar active o placeholder (una vacante cuenta como persona) y tener zona base; la
//     línea debe existir y estar activa. Si no, 400 (404 si no existen).
//   - PUT: si la dirección limitó a esa persona (executive_allowed_lines, migración 0860) y la línea no está entre las
//     permitidas → 409 { error: 'La dirección limitó a <nombre> a: <líneas>', lineasPermitidas: [codes] }. Sin filas (o
//     sin la tabla) no hay restricción. Inserta la fila de executive_lines si falta: idempotente.
//   - DELETE: cuenta ANTES de borrar los médicos (medico_visitantes vigentes, hasta IS NULL) de esa persona en esa línea,
//     porque el disparador executive_lines_termina_visitantes de la migración 0820 los termina al borrar la fila
//     ("si alguien pierde una línea, ya no está"); borra la fila (idempotente) y devuelve medicosTerminados.
//   - Las dos recalculan la cobertura con recalcularCobertura (executive-shared: global, sin Google). Si el recálculo
//     falla, el cambio ya quedó guardado: cobertura.recalculada = false y un aviso, como en PATCH /api/executives/[id].
// Respuesta: { ejecutivo: { id, nombre, status, lineas: codes }, medicosTerminados, cobertura: { recalculada }, aviso? }.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE } from '@/lib/fase1-schemas'
import { canEditCoverageLine, joinNamesEs } from '@/lib/coverage'
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import type { SessionUser } from '@/lib/auth-server'
import { AVISO_COBERTURA_SIN_RECALCULAR, recalcularCobertura } from '../../../_lib/executive-shared'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string; lineId: string } }

/** PUT y DELETE /api/executives/[id]/lineas/[lineId] */
export interface LineaEjecutivoResponse {
  ejecutivo: { id: string; nombre: string; status: 'active' | 'placeholder'; lineas: string[] }
  /** DELETE: médicos de esa línea que pierden a esta persona como visitante (disparador 0820). PUT: 0. */
  medicosTerminados: number
  cobertura: { recalculada: boolean }
  /** Solo cuando el cambio se guardó pero la cobertura no se pudo recalcular. */
  aviso?: string
}

const NO_STORE = { 'Cache-Control': 'no-store' }

interface LineaFila {
  id: string
  code: string
  name: string
  active: boolean
}

interface EjecutivoFila {
  id: string
  full_name: string
  status: 'active' | 'placeholder' | 'inactive'
  base_kam_id: string | null
}

interface Contexto {
  user: SessionUser
  executiveId: string
  lineId: string
  /** Todas las líneas (activas e inactivas), en orden de sort_order: para códigos y nombres. */
  lineas: LineaFila[]
  linea: LineaFila
  ejecutivo: EjecutivoFila & { status: 'active' | 'placeholder' }
}

async function loadLineas(): Promise<LineaFila[]> {
  const { data, error } = await supabaseAdmin
    .from('business_lines')
    .select('id, code, name, active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range(0, 999)
  if (error) throw error
  return (data || []) as LineaFila[]
}

async function loadEjecutivo(executiveId: string): Promise<EjecutivoFila | null> {
  const { data, error } = await supabaseAdmin.from('executives').select('id, full_name, status, base_kam_id').eq('id', executiveId).limit(1)
  if (error) throw error
  return data && data.length > 0 ? (data[0] as EjecutivoFila) : null
}

/** Permiso, ids, línea y Ejecutivo Comercial válidos; o la respuesta de error que corresponde. */
async function preparar(request: NextRequest, params: Params['params']): Promise<{ ok: true; ctx: Contexto } | { ok: false; response: NextResponse }> {
  const auth = await requirePermission(request, 'executives:lines')
  if (!auth.ok) return { ok: false, response: auth.response }

  if (!UUID_RE.test(params.id)) return { ok: false, response: jsonError('ID de Ejecutivo Comercial no válido', 400) }
  if (!UUID_RE.test(params.lineId)) return { ok: false, response: jsonError('ID de línea no válido', 400) }
  const executiveId = params.id.toLowerCase()
  const lineId = params.lineId.toLowerCase()

  if (!(await canEditCoverageLine(auth.user, lineId))) {
    return { ok: false, response: jsonError('Solo puedes asignar la línea que lideras', 403) }
  }

  const lineas = await loadLineas()
  const linea = lineas.find(item => item.id === lineId)
  if (!linea) return { ok: false, response: jsonError('Línea no encontrada', 404) }
  if (!linea.active) return { ok: false, response: jsonError('La línea está inactiva', 400) }

  const ejecutivo = await loadEjecutivo(executiveId)
  if (!ejecutivo) return { ok: false, response: jsonError('Ejecutivo Comercial no encontrado', 404) }
  if (ejecutivo.status !== 'active' && ejecutivo.status !== 'placeholder') {
    return { ok: false, response: jsonError('El Ejecutivo Comercial está inactivo: ya no está', 400) }
  }
  if (!ejecutivo.base_kam_id) return { ok: false, response: jsonError('El Ejecutivo Comercial no tiene zona base', 400) }

  return { ok: true, ctx: { user: auth.user, executiveId, lineId, lineas, linea, ejecutivo: { ...ejecutivo, status: ejecutivo.status } } }
}

/** Ids de línea permitidos por la dirección; null = sin restricción (sin filas, o sin la tabla 0860). */
async function loadLineasPermitidas(executiveId: string): Promise<string[] | null> {
  const { data, error } = await supabaseAdmin.from('executive_allowed_lines').select('line_id').eq('executive_id', executiveId).range(0, 999)
  if (error) {
    if (isMissingRelationError(error)) return null
    throw error
  }
  const ids = ((data || []) as Array<{ line_id: string }>).map(row => row.line_id)
  return ids.length > 0 ? ids : null
}

/** Códigos de las líneas activas que lleva hoy, en orden de sort_order. */
async function lineasDe(ctx: Contexto): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('executive_lines').select('line_id').eq('executive_id', ctx.executiveId).range(0, 999)
  if (error) throw error
  const lleva = new Set(((data || []) as Array<{ line_id: string }>).map(row => row.line_id))
  return ctx.lineas.filter(linea => linea.active && lleva.has(linea.id)).map(linea => linea.code)
}

/** Recalcula la cobertura (el cambio ya está guardado) y arma la respuesta. */
async function responder(ctx: Contexto, medicosTerminados: number, contexto: string): Promise<NextResponse> {
  const recalculada = await recalcularCobertura(contexto)
  const body: LineaEjecutivoResponse = {
    ejecutivo: { id: ctx.ejecutivo.id, nombre: ctx.ejecutivo.full_name, status: ctx.ejecutivo.status, lineas: await lineasDe(ctx) },
    medicosTerminados,
    cobertura: { recalculada },
    ...(recalculada ? {} : { aviso: AVISO_COBERTURA_SIN_RECALCULAR }),
  }
  return NextResponse.json(body, { headers: NO_STORE })
}

// PUT /api/executives/[id]/lineas/[lineId] — "Darle <línea> a…": inserta la fila de executive_lines si falta.
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const preparado = await preparar(request, params)
    if (!preparado.ok) return preparado.response
    const { ctx } = preparado

    const permitidas = await loadLineasPermitidas(ctx.executiveId)
    if (permitidas && !permitidas.includes(ctx.lineId)) {
      const lineasPermitidas = ctx.lineas.filter(linea => permitidas.includes(linea.id))
      return jsonError(`La dirección limitó a ${ctx.ejecutivo.full_name} a: ${joinNamesEs(lineasPermitidas.map(linea => linea.name))}`, 409, {
        lineasPermitidas: lineasPermitidas.map(linea => linea.code),
      })
    }

    const { data: existente, error: existenteError } = await supabaseAdmin
      .from('executive_lines')
      .select('line_id')
      .eq('executive_id', ctx.executiveId)
      .eq('line_id', ctx.lineId)
      .limit(1)
    if (existenteError) throw existenteError

    if (!existente || existente.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from('executive_lines')
        .insert({ executive_id: ctx.executiveId, line_id: ctx.lineId })
        .select('line_id')
      if (insertError && insertError.code !== '23505') {
        // 23505: otra petición la insertó al mismo tiempo; el resultado es el mismo (idempotente)
        if (insertError.code === '23503') return jsonError('La línea o el Ejecutivo Comercial no existe', 400)
        console.error('Error dando la línea al Ejecutivo Comercial:', insertError)
        return jsonError('No se pudo dar la línea', 500)
      }
    }

    return responder(ctx, 0, 'PUT /api/executives/[id]/lineas/[lineId]')
  } catch (error) {
    console.error('Error en PUT /api/executives/[id]/lineas/[lineId]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}

// DELETE /api/executives/[id]/lineas/[lineId] — "Quitarle <línea>": borra la fila de executive_lines. Cuenta antes los
// médicos que pierden visitante (el disparador de la 0820 los termina al borrar).
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const preparado = await preparar(request, params)
    if (!preparado.ok) return preparado.response
    const { ctx } = preparado

    let medicos = new Set<string>()
    const { data: vigentes, error: vigentesError } = await supabaseAdmin
      .from('medico_visitantes')
      .select('medico_id')
      .eq('executive_id', ctx.executiveId)
      .eq('line_id', ctx.lineId)
      .is('hasta', null)
      .range(0, 9999)
    if (vigentesError) {
      // Sin la migración 0800 no hay médicos que terminar
      if (!isMissingRelationError(vigentesError)) throw vigentesError
    } else {
      medicos = new Set(((vigentes || []) as Array<{ medico_id: string }>).map(row => row.medico_id))
    }

    const { data: borradas, error: deleteError } = await supabaseAdmin
      .from('executive_lines')
      .delete()
      .eq('executive_id', ctx.executiveId)
      .eq('line_id', ctx.lineId)
      .select('line_id')
    if (deleteError) {
      console.error('Error quitando la línea al Ejecutivo Comercial:', deleteError)
      return jsonError('No se pudo quitar la línea', 500)
    }

    // Si no llevaba la línea, el disparador no corre y nadie pierde visitante
    const medicosTerminados = borradas && borradas.length > 0 ? medicos.size : 0
    return responder(ctx, medicosTerminados, 'DELETE /api/executives/[id]/lineas/[lineId]')
  } catch (error) {
    console.error('Error en DELETE /api/executives/[id]/lineas/[lineId]:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
