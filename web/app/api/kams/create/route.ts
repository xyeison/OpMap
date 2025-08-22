import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

// Usar Service Role Key para bypass RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener datos del KAM
    const kamData = await request.json()

    // Validaciones básicas
    if (!kamData.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }
    if (!kamData.area_id) {
      return NextResponse.json({ error: 'El área es requerida' }, { status: 400 })
    }

    // Agregar timestamps y valores por defecto
    const kamToInsert = {
      ...kamData,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Insertar el KAM usando Service Role (bypass RLS)
    const { data, error: insertError } = await supabase
      .from('kams')
      .insert(kamToInsert)
      .select()
      .single()

    if (insertError) {
      console.error('Error al insertar KAM:', insertError)
      return NextResponse.json({ 
        error: `Error al crear el KAM: ${insertError.message}` 
      }, { status: 500 })
    }

    // Si el KAM participa en asignación territorial, ejecutar recálculo
    if (kamData.participates_in_assignment !== false) {
      try {
        // Llamar al endpoint de recálculo
        const recalcUrl = new URL('/api/recalculate-simplified', request.url)
        const recalcResponse = await fetch(recalcUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          }
        })

        if (!recalcResponse.ok) {
          console.warn('Error al recalcular asignaciones:', await recalcResponse.text())
        }
      } catch (recalcError) {
        console.error('Error al recalcular:', recalcError)
        // No fallar la creación del KAM por error en recálculo
      }
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'KAM creado exitosamente' 
    })

  } catch (error) {
    console.error('Error en POST /api/kams/create:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}