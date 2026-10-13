// POST /api/config-visitas/cerrar (visits:config) — { tabla, id, hasta, motivo? } termina un valor de configuración
// (vigente_hasta = hasta) o, si hasta es anterior a su inicio, lo anula. Lo hace la función config_cerrar de la base
// (motivo obligatorio si hasta es anterior a hoy). Si el valor había cortado o reemplazado otro al registrarse, en el
// hueco vuelve a regir ese valor anterior (decisión 12 del contrato). 404 si no existe; 409 si ya estaba anulado;
// 400 sin motivo.
// Respuesta: { id, accion: 'cerrar' | 'anular' | 'nada', vigente_hasta, restaura, meses_recalculados }.
// Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { cerrarConfigSchema } from '@/lib/visits-config-schemas'
import { MENSAJE_VALOR_NO_EXISTE, mesesAfectados, planearCierre, sumarDias } from '@/lib/visits-rules'
import { errorVisitas, hoyActual, leerConfig, leerFilaConfig, respuestaErrorBase } from '../_lib/visitas-server'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  try {
    const parsed = cerrarConfigSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const { tabla, id, hasta, motivo } = parsed.data

    const fila = await leerFilaConfig(tabla, id)
    if (!fila) return jsonError(MENSAJE_VALOR_NO_EXISTE, 404)

    const hoy = hoyActual()
    // Solo para describir el resultado (y qué valor vuelve a regir): quien decide (y rechaza) es config_cerrar.
    const filasClave = await leerConfig(tabla, { clave: fila.clave })
    const plan = planearCierre(fila, { hasta, motivo }, hoy, filasClave)

    const { error } = await supabaseAdmin.rpc('config_cerrar', {
      p_tabla: tabla,
      p_id: id,
      p_hasta: hasta,
      p_motivo: motivo,
      p_user: auth.user.id,
    })
    if (error) {
      const traducido = respuestaErrorBase(error, 'No se pudo cerrar ese valor de configuración')
      if (traducido) return traducido
      throw error
    }

    const meses =
      plan.accion === 'anular'
        ? mesesAfectados(fila.vigente_desde, fila.vigente_hasta, hoy)
        : plan.accion === 'cerrar'
          ? mesesAfectados(sumarDias(hasta, 1), fila.vigente_hasta, hoy)
          : []
    return NextResponse.json({
      id,
      accion: plan.accion,
      vigente_hasta: plan.vigente_hasta,
      restaura: plan.restaura,
      meses_recalculados: meses,
    })
  } catch (error) {
    return errorVisitas('POST /api/config-visitas/cerrar', error, 'Error al cerrar el valor de configuración')
  }
}
