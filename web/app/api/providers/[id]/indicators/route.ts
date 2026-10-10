import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { requirePermission } from '@/lib/require-role'
import { badJson, isUuid, readJsonBody, serverError } from '../../../_lib/api-error'
import { pickAllowed, PROVIDER_INDICATOR_COLUMNS } from '../../../_lib/allow-list'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'providers:view')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  try {

    const providerId = params.id

    // Obtener indicadores del proveedor
    const { data: indicators, error } = await supabase
      .from('proveedor_indicadores')
      .select('*')
      .eq('proveedor_id', providerId)
      .order('anio', { ascending: false })

    if (error) return serverError('providers/[id]/indicators GET', error, 'Error al cargar los indicadores')

    return NextResponse.json(indicators || [])
  } catch (error) {
    console.error('Error in GET /api/providers/[id]/indicators:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission(request, 'providers:edit')
  if (!auth.ok) return auth.response
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
  }

  try {

    const providerId = params.id
    const rawBody = await readJsonBody(request)
    if (!rawBody || typeof rawBody !== 'object') return badJson()
    // Allow-list de columnas de proveedor_indicadores (nunca el body entero)
    const body = pickAllowed(rawBody as Record<string, unknown>, PROVIDER_INDICATOR_COLUMNS) as Record<string, any>
    if (!Number.isInteger(Number(body.anio))) {
      return NextResponse.json({ error: 'Año inválido' }, { status: 400 })
    }

    // Calcular indicadores derivados
    const indicatorData = {
      ...body,
      proveedor_id: providerId,
      // Los valores booleanos de cumplimiento se calculan aquí si es necesario
      cumple_liquidez: body.indice_liquidez >= 1.2,
      cumple_endeudamiento: body.indice_endeudamiento <= 0.7,
      cumple_cobertura: body.cobertura_intereses >= 1.5,
      cumple_todos_requisitos: 
        body.indice_liquidez >= 1.2 && 
        body.indice_endeudamiento <= 0.7 && 
        body.cobertura_intereses >= 1.5
    }

    const { data, error } = await supabase
      .from('proveedor_indicadores')
      .upsert(indicatorData, {
        onConflict: 'proveedor_id,anio'
      })
      .select()
      .single()

    if (error) return serverError('providers/[id]/indicators POST', error, 'Error al guardar los indicadores')

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/providers/[id]/indicators:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Alias de POST (upsert); misma autorización
  const auth = await requirePermission(request, 'providers:edit')
  if (!auth.ok) return auth.response
  return POST(request, { params })
}