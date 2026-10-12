// PATCH /api/terceros/sedes/[id] (terceros:manage) — edita la sede, confirma su ubicación o la vuelve la principal
// de su cuenta (es_principal: true quita la marca a la principal anterior). Contrato:
// docs/fases/fase6-visitas-f1-terceros.md.
// Una sede que ES una IPS de OpMap (hospital_id) copia de hospitals nombre, dirección, municipio, ciudad,
// coordenadas, ubicación confirmada, código de habilitación y activo (disparador hospitals_terceros_sync de la
// migración 0800): esos campos se cambian en la ficha de la IPS. Aquí solo se puede volverla la principal; lo
// demás responde 400 en vez de guardarse y perderse en la siguiente sincronización.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { sedeUpdateSchema } from '@/lib/terceros-schemas'
import type { SedeRow } from '@/lib/terceros'
import {
  MUNICIPIO_NO_EXISTE,
  errorInterno,
  esViolacionUnica,
  idDeRuta,
  nombreMunicipio,
  respuestaRepsRepetido,
  sedePorRepsCode,
} from '../../_lib/terceros-server'

type Params = { params: { id: string } }

/** Campos que terceros_sincronizar_hospitals copia de hospitals a la sede de una IPS de OpMap. */
const CAMPOS_DE_LA_IPS = [
  'nombre',
  'reps_code',
  'direccion',
  'ciudad',
  'municipality_id',
  'lat',
  'lng',
  'ubicacion_confirmada',
  'activo',
] as const

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePermission(request, 'terceros:manage')
  if (!auth.ok) return auth.response

  const sedeId = idDeRuta(params.id)
  if (!sedeId) return jsonError('ID de sede no válido', 400)

  try {
    const parsed = sedeUpdateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const { data: actualData, error: actualError } = await supabaseAdmin
      .from('sedes')
      .select('id, cuenta_id, es_principal, hospital_id')
      .eq('id', sedeId)
      .limit(1)
    if (actualError) throw actualError
    const actual =
      actualData && actualData.length > 0
        ? (actualData[0] as Pick<SedeRow, 'id' | 'cuenta_id' | 'es_principal' | 'hospital_id'>)
        : null
    if (!actual) return jsonError('Sede no encontrada', 404)

    if (actual.hospital_id) {
      const sincronizados = CAMPOS_DE_LA_IPS.filter(campo => input[campo] !== undefined)
      if (sincronizados.length > 0) {
        return jsonError(
          'Esta sede es una IPS de OpMap: su nombre, dirección, municipio, coordenadas, código de habilitación y estado se cambian en la ficha de la IPS. Aquí solo se puede marcar como principal.',
          400
        )
      }
    }

    // Latitud y longitud llegan juntas (lo exige sedeUpdateSchema, como el CHECK de la base).
    if (input.reps_code && (await sedePorRepsCode(input.reps_code, sedeId))) {
      return respuestaRepsRepetido(input.reps_code, sedeId)
    }

    const cambios: Record<string, unknown> = {}
    if (input.nombre !== undefined) cambios.nombre = input.nombre
    if (input.reps_code !== undefined) cambios.reps_code = input.reps_code
    if (input.direccion !== undefined) cambios.direccion = input.direccion
    if (input.ciudad !== undefined) cambios.ciudad = input.ciudad
    if (input.municipality_id !== undefined) {
      const municipio = await nombreMunicipio(input.municipality_id)
      if (!municipio) return jsonError(MUNICIPIO_NO_EXISTE, 400)
      cambios.municipality_id = input.municipality_id
      if (input.ciudad === undefined || input.ciudad === null) cambios.ciudad = municipio
    }
    if (input.lat !== undefined) cambios.lat = input.lat
    if (input.lng !== undefined) cambios.lng = input.lng
    if (input.ubicacion_confirmada !== undefined) cambios.ubicacion_confirmada = input.ubicacion_confirmada
    if (input.activo !== undefined) cambios.activo = input.activo

    // Cambiar la principal: primero se quita la marca a la anterior (índice único de una principal por cuenta).
    let principalAnterior: string | null = null
    if (input.es_principal === true && !actual.es_principal) {
      const { data: anterior, error: anteriorError } = await supabaseAdmin
        .from('sedes')
        .update({ es_principal: false })
        .eq('cuenta_id', actual.cuenta_id)
        .eq('es_principal', true)
        .select('id')
      if (anteriorError) throw anteriorError
      principalAnterior = anterior && anterior.length > 0 ? String((anterior[0] as { id: string }).id) : null
      cambios.es_principal = true
    }

    if (Object.keys(cambios).length === 0) {
      const { data } = await supabaseAdmin.from('sedes').select('*').eq('id', sedeId).limit(1)
      return NextResponse.json({ sede: (data || [])[0] as SedeRow })
    }

    const { data, error } = await supabaseAdmin.from('sedes').update(cambios).eq('id', sedeId).select('*')
    if (error || !data || data.length === 0) {
      if (principalAnterior) {
        const { error: restaurarError } = await supabaseAdmin
          .from('sedes')
          .update({ es_principal: true })
          .eq('id', principalAnterior)
        if (restaurarError) console.error('No se pudo restaurar la sede principal', principalAnterior, restaurarError)
      }
      if (!error) return jsonError('Sede no encontrada', 404)
      if (esViolacionUnica(error, 'sedes_reps_code_key') && input.reps_code) {
        return respuestaRepsRepetido(input.reps_code, sedeId)
      }
      if (error.code === '23514') return jsonError('Los datos de la sede no son válidos', 400)
      throw error
    }
    return NextResponse.json({ sede: data[0] as SedeRow })
  } catch (error) {
    return errorInterno('PATCH /api/terceros/sedes/[id]', error, 'Error al guardar la sede')
  }
}
