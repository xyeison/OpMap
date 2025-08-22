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

    // Obtener datos del request
    const { kamId, updateData } = await request.json()

    if (!kamId) {
      return NextResponse.json({ error: 'ID del KAM es requerido' }, { status: 400 })
    }

    // Agregar timestamp de actualización
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString()
    }

    // Actualizar el KAM usando Service Role (bypass RLS)
    const { data, error: updateError } = await supabase
      .from('kams')
      .update(dataToUpdate)
      .eq('id', kamId)
      .select()
      .single()

    if (updateError) {
      console.error('Error al actualizar KAM:', updateError)
      return NextResponse.json({ 
        error: `Error al actualizar el KAM: ${updateError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: 'KAM actualizado exitosamente' 
    })

  } catch (error) {
    console.error('Error en POST /api/kams/update:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}