// POST /api/config-visitas/subtipos (visits:config) — crea un subtipo de visita institucional (código único
// ^[a-z_]{2,40}$, nombre, para qué, cargos sugeridos, orden, vigente_desde) y su conteo inicial "solo seguimiento"
// peso 1 desde la misma fecha, con config_registrar (nada mide hasta que la directora diga a qué suma). 409 si el
// código ya existe. Si el conteo inicial no se puede guardar, el subtipo recién creado se quita (no queda a medias).
// 201 { subtipo, conteo_id }. Contrato: docs/fases/fase7-visitas-f2-config-calendario.md (sección "API").
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { subtipoCreateSchema } from '@/lib/visits-config-schemas'
import type { Subtipo } from '@/lib/visits-rules'
import { esViolacionUnica } from '@/app/api/terceros/_lib/terceros-server'
import { errorVisitas, respuestaErrorBase } from '../_lib/visitas-server'

const COLUMNAS_SUBTIPO =
  'id, codigo, nombre, para_que, roles_sugeridos, orden, vigente_desde, vigente_hasta, created_by, created_at, updated_at'

/** Motivo del conteo inicial (config_registrar lo exige si el subtipo empieza antes de hoy). */
const MOTIVO_CONTEO_INICIAL = 'Conteo inicial de un subtipo nuevo: solo seguimiento'

const codigoRepetido = (codigo: string) => `Ya existe un subtipo con el código "${codigo}"`

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'visits:config')
  if (!auth.ok) return auth.response

  try {
    const parsed = subtipoCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const datos = parsed.data

    const { data: existente, error: existenteError } = await supabaseAdmin
      .from('subtipos_institucionales')
      .select('id')
      .eq('codigo', datos.codigo)
      .limit(1)
    if (existenteError) throw existenteError
    if (existente && existente.length > 0) return jsonError(codigoRepetido(datos.codigo), 409)

    const { data, error } = await supabaseAdmin
      .from('subtipos_institucionales')
      .insert({
        codigo: datos.codigo,
        nombre: datos.nombre,
        para_que: datos.para_que,
        roles_sugeridos: datos.roles_sugeridos,
        orden: datos.orden,
        vigente_desde: datos.vigente_desde,
        created_by: auth.user.id,
      })
      .select(COLUMNAS_SUBTIPO)
    if (error) {
      if (esViolacionUnica(error)) return jsonError(codigoRepetido(datos.codigo), 409)
      const traducido = respuestaErrorBase(error, 'Los datos del subtipo no son válidos')
      if (traducido) return traducido
      throw error
    }
    const subtipo = (data || [])[0] as unknown as Subtipo | undefined
    if (!subtipo) throw new Error('La base no devolvió el subtipo creado')

    const { data: conteoId, error: conteoError } = await supabaseAdmin.rpc('config_registrar', {
      p_tabla: 'config_conteo',
      p_valores: { subtipo_id: subtipo.id, modo: 'seguimiento', peso: 1 },
      p_desde: datos.vigente_desde,
      p_hasta: null,
      p_motivo: MOTIVO_CONTEO_INICIAL,
      p_user: auth.user.id,
    })
    if (conteoError) {
      // Sin conteo el subtipo quedaría a medias: se quita (todavía nada apunta a él).
      const { error: borrarError } = await supabaseAdmin.from('subtipos_institucionales').delete().eq('id', subtipo.id)
      if (borrarError) console.error('No se pudo quitar el subtipo sin conteo inicial:', borrarError)
      const traducido = respuestaErrorBase(conteoError, 'No se pudo guardar el conteo inicial del subtipo')
      if (traducido) return traducido
      throw conteoError
    }

    return NextResponse.json({ subtipo, conteo_id: String(conteoId) }, { status: 201 })
  } catch (error) {
    return errorVisitas('POST /api/config-visitas/subtipos', error, 'Error al crear el subtipo')
  }
}
