// POST /api/config-visitas/cambios (visits:config) — registra un valor nuevo de configuración (metas, qué cuenta,
// general o personas) con su vigencia. Nunca edita el valor anterior: la función config_registrar de la base corta,
// anula o continúa lo que haga falta en una sola transacción (cambiar el pasado exige motivo). Cuerpo:
// cambioConfigSchema (los valores se validan por tabla y, en general, por parámetro; la zona, el Ejecutivo Comercial
// y el subtipo deben existir). 201 { id, meses_recalculados }; 400 validación o motivo; 409 si el rango se superpone
// con un valor que empieza después (23P01). Contrato: docs/fases/fase7-visitas-f2-config-calendario.md.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { cambioConfigSchema } from '@/lib/visits-config-schemas'
import { mesesAfectados, type CambioConfigResponse } from '@/lib/visits-rules'
import {
  errorVisitas,
  hoyActual,
  leerFilaConfig,
  respuestaErrorBase,
  validarReferencias,
} from '../_lib/visitas-server'

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  try {
    const parsed = cambioConfigSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const cambio = parsed.data

    const referencia = await validarReferencias(cambio)
    if (referencia) return jsonError(referencia, 400)

    const { data, error } = await supabaseAdmin.rpc('config_registrar', {
      p_tabla: cambio.tabla,
      p_valores: cambio.valores,
      p_desde: cambio.desde,
      p_hasta: cambio.hasta,
      p_motivo: cambio.motivo,
      p_user: auth.user.id,
    })
    if (error) {
      const traducido = respuestaErrorBase(error, 'Los datos del cambio no son válidos')
      if (traducido) return traducido
      throw error
    }
    const id = String(data)

    // Meses que se recalculan con lo que de verdad quedó guardado (hasta efectivo de la fila nueva).
    const hoy = hoyActual()
    const fila = await leerFilaConfig(cambio.tabla, id)
    const respuesta: CambioConfigResponse = {
      id,
      meses_recalculados: mesesAfectados(cambio.desde, fila ? fila.vigente_hasta : cambio.hasta, hoy),
    }
    return NextResponse.json(respuesta, { status: 201 })
  } catch (error) {
    return errorVisitas('POST /api/config-visitas/cambios', error, 'Error al guardar el cambio de configuración')
  }
}
