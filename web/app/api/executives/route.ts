import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-role'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { asegurarExecutiveEmpresa } from '@/lib/empresas'
import { EMPRESA_VG_ID } from '@/lib/empresas-reglas'
import { jsonError, readJson, zodMessage } from '@/app/api/kams/_lib/kam-shared'
import { executiveCreateSchema } from '@/lib/fase1-schemas'
import type { ExecutiveResponse, ExecutivesResponse } from '@/lib/types/lines'
import {
  MENSAJE_LINEAS_FUERA_DE_PERMITIDAS,
  MENSAJE_SIN_TABLA_PERMITIDAS,
  allLinesExist,
  allowedLinesAvailable,
  kamExists,
  lineasFueraDePermitidas,
  loadExecutives,
  replaceAllowedLines,
  replaceExecutiveLines,
  resolveUserIdByEmail,
  todayInBogota,
  uniqueViolationMessage,
} from './_lib/executive-shared'

// GET /api/executives — todas las ejecutivas (activas, placeholder e inactivas) con zona base, líneas y líneas
// permitidas (lineas_permitidas: ids, o null = sin restricción; también null si la migración 0860 no está aplicada).
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'executives:view')
  if (!auth.ok) return auth.response

  try {
    const executives = await loadExecutives()
    const body: ExecutivesResponse = { executives }
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error en GET /api/executives:', error)
    return jsonError('Error al cargar las ejecutivas', 500)
  }
}

// POST /api/executives — crea una ejecutiva (o un cupo "placeholder" por contratar) con sus líneas y, si la dirección
// lo pide, sus líneas permitidas (lineas_permitidas: null o [] = sin restricción; con valores, lines debe caber, 400).
// user_id se enlaza solo si existe un usuario de OpMap con el mismo email. Empresas (capa 1): la persona o vacante
// queda en executive_empresas con empresa_id del cuerpo (400 si no es una de las empresas de quien la crea) o, sin él,
// con la empresa activa de la sesión; sin empresa en la sesión (0960 sin aplicar) no se escribe.
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'executives:edit')
  if (!auth.ok) return auth.response

  try {
    const parsed = executiveCreateSchema.safeParse(await readJson(request))
    if (!parsed.success) {
      return jsonError(zodMessage(parsed.error), 400)
    }
    const input = parsed.data

    const empresa = input.empresa_id ? auth.user.empresas.find(e => e.id === input.empresa_id) : auth.user.empresa
    if (input.empresa_id && !empresa) return jsonError('Esa empresa no es tuya', 400)

    if (!(await kamExists(input.base_kam_id))) {
      return jsonError('La zona base seleccionada no existe', 400)
    }
    if (!(await allLinesExist(input.lines))) {
      return jsonError('Alguna de las líneas indicadas no existe', 400)
    }

    // Restricción de la dirección: solo si llega con valores. Se comprueba todo antes de crear nada.
    const permitidas = input.lineas_permitidas && input.lineas_permitidas.length > 0 ? input.lineas_permitidas : null
    if (permitidas && !(await allLinesExist(permitidas))) {
      return jsonError('Alguna de las líneas permitidas indicadas no existe', 400)
    }
    if (lineasFueraDePermitidas(input.lines, permitidas).length > 0) {
      return jsonError(MENSAJE_LINEAS_FUERA_DE_PERMITIDAS, 400)
    }
    if (permitidas && !(await allowedLinesAvailable())) {
      return jsonError(MENSAJE_SIN_TABLA_PERMITIDAS, 500)
    }

    const email = input.email ?? null
    const status = input.status ?? 'active'
    const userId = await resolveUserIdByEmail(email)

    const { data, error } = await supabaseAdmin
      .from('executives')
      .insert({
        full_name: input.full_name,
        email,
        company: input.company ?? (empresa && empresa.id !== EMPRESA_VG_ID ? empresa.nombre_corto : 'VG Medical'),
        base_kam_id: input.base_kam_id,
        status,
        user_id: userId,
        odoo_employee_id: input.odoo_employee_id ?? null,
        notes: input.notes,
        ...(input.color !== undefined ? { color: input.color } : {}),
        left_at: status === 'inactive' ? todayInBogota() : null,
      })
      .select('id')

    if (error) {
      if (error.code === '23505') return jsonError(uniqueViolationMessage(error.details || error.message), 409)
      if (error.code === '23503') return jsonError('La zona base seleccionada no existe', 400)
      console.error('Error creando ejecutiva:', error)
      return jsonError('Error al crear la ejecutiva', 500)
    }
    const created = data && data.length > 0 ? (data[0].id as string) : null
    if (!created) {
      console.error('Insert de executives sin fila devuelta')
      return jsonError('Error al crear la ejecutiva', 500)
    }

    // Sin la tabla (0960 sin aplicar) no escribe nada y sigue
    if (empresa) await asegurarExecutiveEmpresa(created, empresa.id)
    if (!(await replaceExecutiveLines(created, input.lines))) {
      return jsonError('La ejecutiva se creó, pero no se pudieron guardar sus líneas', 500)
    }
    if (permitidas) {
      const resultado = await replaceAllowedLines(created, permitidas, auth.user.id)
      if (resultado !== 'ok') {
        return jsonError('La ejecutiva se creó, pero no se pudieron guardar sus líneas permitidas', 500)
      }
    }

    const [executive] = await loadExecutives(created)
    if (!executive) return jsonError('Error al crear la ejecutiva', 500)

    const body: ExecutiveResponse = { executive }
    return NextResponse.json(body, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/executives:', error)
    return jsonError('Error interno del servidor', 500)
  }
}
