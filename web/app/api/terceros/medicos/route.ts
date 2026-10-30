// /api/terceros/medicos — lista sin documento (terceros:view) y creación de un médico COMPLETO (terceros:create).
// Contrato: docs/fases/fase6-visitas-f1-terceros.md. El médico y sus sedes se guardan juntos con la función
// terceros_crear_medico (PostgREST no tiene transacciones): o queda completo, con al menos una sede, o no queda.
// Un segundo médico con el mismo documento se rechaza con 409 y { existente: { id, nombre } }.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { busquedaMedicosSchema, medicoCreateSchema } from '@/lib/terceros-schemas'
import { listarMedicos } from '../_lib/listas'
import {
  MEDICO_REPETIDO,
  MUNICIPIO_NO_EXISTE,
  cargarMedicoDetalle,
  errorInterno,
  esViolacionUnica,
  medicoDeLasLineasDeSuLider,
  medicoPorDocumento,
  mensajeRegla,
  nombreMunicipio,
  puedeAdministrar,
} from '../_lib/terceros-server'

export const dynamic = 'force-dynamic'

// GET /api/terceros/medicos?q=&municipio=&visitante=me&activo=&page=
// q: SOLO el nombre (todas las palabras, sin importar tildes): un documento no se busca por la URL (quedaría en los
// logs de peticiones); con terceros:manage se busca por POST /api/terceros/medicos/buscar, que usa la interfaz.
// visitante=me: solo los médicos de los que el usuario (su Ejecutivo Comercial enlazado) es visitante vigente.
// Nunca lleva el documento. 50 por página.
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:view')
  if (!auth.ok) return auth.response

  const parsed = busquedaMedicosSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)

  try {
    return NextResponse.json(await listarMedicos(auth.user, parsed.data, { buscarDocumentos: false }))
  } catch (error) {
    return errorInterno('GET /api/terceros/medicos', error, 'Error al cargar los médicos')
  }
}

// POST /api/terceros/medicos — { tipo_documento, numero_documento, nombre, especialidades[], municipality_id,
// telefono?, email?, notas?, sedes: [{ sede_id, rol, principal? }] (mínimo 1) }.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'terceros:create')
  if (!auth.ok) return auth.response
  const user = auth.user

  try {
    const parsed = medicoCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) return jsonError(zodMessage(parsed.error), 400)
    const input = parsed.data

    const previo = await medicoPorDocumento(input.tipo_documento, input.numero_documento)
    if (previo) return jsonError(`${MEDICO_REPETIDO}: ${previo.nombre}`, 409, { existente: previo })

    if (!(await nombreMunicipio(input.municipality_id))) return jsonError(MUNICIPIO_NO_EXISTE, 400)

    const sedeIds = input.sedes.map(sede => sede.sede_id)
    const { data: sedesData, error: sedesError } = await supabaseAdmin.from('sedes').select('id, activo').in('id', sedeIds)
    if (sedesError) throw sedesError
    const sedes = new Map(((sedesData || []) as Array<{ id: string; activo: boolean }>).map(sede => [sede.id, sede]))
    if (sedeIds.some(id => !sedes.has(id))) return jsonError('Alguna de las sedes elegidas no existe', 400)
    if (sedeIds.some(id => !sedes.get(id)?.activo)) return jsonError('Alguna de las sedes elegidas está inactiva', 400)

    const { data, error } = await supabaseAdmin.rpc('terceros_crear_medico', {
      p_medico: {
        tipo_documento: input.tipo_documento,
        numero_documento: input.numero_documento,
        nombre: input.nombre,
        especialidades: input.especialidades,
        municipality_id: input.municipality_id,
        telefono: input.telefono ?? null,
        email: input.email ?? null,
        notas: input.notas ?? null,
      },
      p_sedes: input.sedes.map(sede => ({ sede_id: sede.sede_id, rol: sede.rol, principal: sede.principal ?? false })),
      p_user: user.id,
    })
    if (error) {
      if (esViolacionUnica(error)) {
        const existente = await medicoPorDocumento(input.tipo_documento, input.numero_documento)
        return jsonError(existente ? `${MEDICO_REPETIDO}: ${existente.nombre}` : MEDICO_REPETIDO, 409, existente ? { existente } : {})
      }
      if (error.code === '23514') return jsonError(mensajeRegla(error, 'Los datos del médico no son válidos'), 400)
      if (error.code === '23503') return jsonError('Alguna de las sedes elegidas no existe', 400)
      if (error.code === '22P02') return jsonError('Datos del médico no válidos', 400)
      throw error
    }
    const id = typeof data === 'string' ? data : null
    if (!id) return jsonError('No se pudo crear el médico', 500)

    // El de una líder queda de sus líneas de líder (0950): lo agenda y lo reporta enseguida. Si falla, el médico ya
    // quedó: la dirección le asigna el visitante.
    try {
      await medicoDeLasLineasDeSuLider(id, user.id)
    } catch (errorLineas) {
      console.error('[terceros] no se pudieron guardar las líneas de la líder del médico nuevo:', errorLineas)
    }

    const medico = await cargarMedicoDetalle(id, puedeAdministrar(user))
    return NextResponse.json({ id, medico }, { status: 201 })
  } catch (error) {
    return errorInterno('POST /api/terceros/medicos', error, 'Error al crear el médico')
  }
}
