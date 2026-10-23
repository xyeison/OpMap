// POST /api/coverage/simular — vista previa de la cobertura antes de guardar un cambio desde la pantalla "Zonas"
// (spec docs/specs/2026-10-23-zonas-por-linea-para-lideres.md: "toda escritura muestra antes la vista previa simulada").
//
// Cuerpo: { cambios: Cambio[] } (1 a 20; lib/types/zonas.ts):
//   linea_agregar / linea_quitar { executive_id, line_id } · ajuste { line_id, kam_id, executive_id } ·
//   quitar_ajuste { override_id }.
// Quién: cualquier sesión, pero cada cambio debe ser de una línea que el usuario ve (resolveUserLines): si no, 403.
// En quitar_ajuste la línea es la del ajuste activo (400 si no existe). La respuesta (SimularResponse) trae el diff de
// celdas que cambian de kind o de persona, con nombres (línea, Zona, quién antes y después, estados), y el resumen por
// estado de cada línea del usuario DESPUÉS de los cambios; las dos cosas recortadas a sus líneas, aunque el cambio
// mueva celdas de otras (una persona que pierde una línea, por ejemplo). Y, por cada linea_quitar, cuántos médicos de
// esa persona en esa línea perderían visitante al guardar (medico_visitantes vigentes; el disparador de la 0820 los
// termina y nada los reabre): la pantalla lo muestra y exige confirmarlo antes de habilitar "Quitarle" (spec E2).
// NUNCA escribe: carga las entradas del motor (loadCoverageInputs), calcula antes y después en memoria
// (simularCobertura, lib/cobertura-simulacion.ts), cuenta médicos con una lectura y responde. Sin Google: la matriz
// sale de las distancias ya pagadas.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { UUID_RE } from '@/lib/fase1-schemas'
import { computeZoneMatrix, loadCoverageInputs, resolveUserLines } from '@/lib/coverage'
import { estadoDePlaza, resumenPorEstado, simularCobertura } from '@/lib/cobertura-simulacion'
import { zoneDisplayName } from '@/lib/zone-names'
import { isMissingRelationError } from '@/app/api/intelligence/_lib/giros-server'
import type { CoverageKind, CoverageInputs } from '@/lib/types/coverage'
import type { Cambio, MedicosQuePierdenVisitante, SimularDiffCelda, SimularResponse } from '@/lib/types/zonas'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Tope de cambios por vista previa (la pantalla manda uno o unos pocos). */
const MAX_CAMBIOS = 20

const idSchema = (label: string) =>
  z
    .string({ required_error: `Falta ${label}`, invalid_type_error: `${label} no válido` })
    .regex(UUID_RE, `${label} no válido`)
    .transform(id => id.toLowerCase())

// Allow-list: cualquier otra clave se descarta; el tipo decide qué campos se exigen.
const cambioSchema = z.discriminatedUnion(
  'tipo',
  [
    z.object({ tipo: z.literal('linea_agregar'), executive_id: idSchema('executive_id'), line_id: idSchema('line_id') }),
    z.object({ tipo: z.literal('linea_quitar'), executive_id: idSchema('executive_id'), line_id: idSchema('line_id') }),
    z.object({ tipo: z.literal('ajuste'), line_id: idSchema('line_id'), kam_id: idSchema('kam_id'), executive_id: idSchema('executive_id') }),
    z.object({ tipo: z.literal('quitar_ajuste'), override_id: idSchema('override_id') }),
  ],
  { errorMap: () => ({ message: 'Tipo de cambio no válido (linea_agregar, linea_quitar, ajuste o quitar_ajuste)' }) }
)

const bodySchema = z.object({
  cambios: z
    .array(cambioSchema, { required_error: 'Faltan los cambios', invalid_type_error: 'cambios debe ser una lista' })
    .min(1, 'Indica al menos un cambio')
    .max(MAX_CAMBIOS, `Máximo ${MAX_CAMBIOS} cambios por vista previa`),
})

/**
 * Médicos distintos con visitante vigente (hasta IS NULL) de esa persona en esa línea: los que el disparador de la 0820
 * terminaría al borrar la fila de executive_lines. Sin la tabla (migración 0800 sin aplicar) no hay médicos: 0.
 */
async function contarMedicosVigentes(executiveId: string, lineId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('medico_visitantes')
    .select('medico_id')
    .eq('executive_id', executiveId)
    .eq('line_id', lineId)
    .is('hasta', null)
    .range(0, 9999)
  if (error) {
    if (isMissingRelationError(error)) return 0
    throw error
  }
  return new Set(((data || []) as Array<{ medico_id: string }>).map(row => row.medico_id)).size
}

/**
 * Por cada linea_quitar (sin repetir persona y línea), la cuenta de médicos que perderían visitante. Si la persona no
 * lleva la línea hoy, el disparador no correría: 0 sin leer nada.
 */
async function medicosQuePierden(inputs: CoverageInputs, cambios: Cambio[]): Promise<MedicosQuePierdenVisitante[]> {
  const lleva = new Set(inputs.executiveLines.map(link => `${link.executive_id}:${link.line_id}`))
  const vistos = new Set<string>()
  const out: MedicosQuePierdenVisitante[] = []
  for (const cambio of cambios) {
    if (cambio.tipo !== 'linea_quitar') continue
    const clave = `${cambio.executive_id}:${cambio.line_id}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    const medicos = lleva.has(clave) ? await contarMedicosVigentes(cambio.executive_id, cambio.line_id) : 0
    out.push({ executive_id: cambio.executive_id, line_id: cambio.line_id, medicos })
  }
  return out
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const user = auth.user

  const parsed = bodySchema.safeParse(await readJson(request))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
  const cambios: Cambio[] = parsed.data.cambios

  try {
    const [me, inputs] = await Promise.all([resolveUserLines(user), loadCoverageInputs()])
    const visibles = new Set(me.lines.map(line => line.id))
    const veLinea = (lineId: string) => me.canSeeAll || visibles.has(lineId)

    // Cada cambio debe ser de una línea que el usuario ve (la de quitar_ajuste es la del ajuste activo).
    for (const cambio of cambios) {
      if (cambio.tipo === 'quitar_ajuste') {
        const override = inputs.overrides.find(item => item.id === cambio.override_id && item.active)
        if (!override) return jsonError('El ajuste manual no existe o ya no está activo', 400)
        if (!veLinea(override.line_id)) return jsonError('Solo puedes simular cambios en las líneas que lideras o llevas', 403)
      } else if (!veLinea(cambio.line_id)) {
        return jsonError('Solo puedes simular cambios en las líneas que lideras o llevas', 403)
      }
    }

    const matrix = computeZoneMatrix(inputs.zones, inputs.hospitals, inputs.distances)
    const { despues, diff } = simularCobertura(inputs, matrix, cambios)
    // Solo después de comprobar las líneas: quien no ve la línea no dispara ni esta lectura.
    const medicosQuePierdenVisitante = await medicosQuePierden(inputs, cambios)

    const lineasUsuario = inputs.lines.filter(line => line.active && veLinea(line.id))
    const lineaPorId = new Map(lineasUsuario.map(line => [line.id, line]))
    const nombreZona = new Map(inputs.zones.map(zone => [zone.id, zoneDisplayName(zone.name) || 'Zona sin nombre']))
    const ejecutivos = new Map(inputs.executives.map(executive => [executive.id, executive]))
    const nombreDe = (executiveId: string | null) => (executiveId ? ejecutivos.get(executiveId)?.full_name ?? 'Ejecutivo Comercial' : null)
    const estadoDe = (kind: CoverageKind, executiveId: string | null) =>
      estadoDePlaza(kind, executiveId ? ejecutivos.get(executiveId) ?? null : null, true)

    const diffVisible: SimularDiffCelda[] = diff
      .filter(celda => lineaPorId.has(celda.line_id))
      .map(celda => {
        const line = lineaPorId.get(celda.line_id)!
        return {
          ...celda,
          line_code: line.code,
          line_name: line.name,
          zona: nombreZona.get(celda.kam_id) ?? 'Zona sin nombre',
          antesEstado: estadoDe(celda.antes.kind, celda.antes.executive_id),
          despuesEstado: estadoDe(celda.despues.kind, celda.despues.executive_id),
          antesNombre: nombreDe(celda.antes.executive_id),
          despuesNombre: nombreDe(celda.despues.executive_id),
        }
      })

    const resumen: SimularResponse['resumen'] = {}
    for (const line of lineasUsuario) {
      resumen[line.code] = resumenPorEstado(
        despues
          .filter(row => row.line_id === line.id)
          .map(row => ({ kind: row.kind, executive: row.executive_id ? ejecutivos.get(row.executive_id) ?? null : null }))
      )
    }

    const body: SimularResponse = { diff: diffVisible, resumen, medicosQuePierdenVisitante }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error en POST /api/coverage/simular:', error)
    return jsonError('Error al simular la cobertura', 500)
  }
}
