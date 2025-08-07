import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const hospitalId = params.id
    const body = await request.json()
    const { reason } = body

    // Validar que se proporcione una razón
    if (!reason || reason.trim() === '') {
      return NextResponse.json({ 
        error: 'La razón de activación es obligatoria' 
      }, { status: 400 })
    }

    // Obtener el hospital actual
    const { data: hospital, error: fetchError } = await supabase
      .from('hospitals')
      .select('*')
      .eq('id', hospitalId)
      .single()

    if (fetchError || !hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    // Actualizar el estado del hospital
    const { data: updatedHospital, error: updateError } = await supabase
      .from('hospitals')
      .update({ active: true })
      .eq('id', hospitalId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating hospital:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Registrar en el historial
    const historyData = {
      hospital_id: hospitalId,
      user_id: user.id,
      action: 'activated',
      reason: reason,
      previous_state: false,
      new_state: true
    }

    const { error: historyError } = await supabase
      .from('hospital_history')
      .insert(historyData)

    if (historyError) {
      console.error('Error inserting history:', historyError)
      // No fallar si el historial no se puede guardar
    }

    return NextResponse.json({
      success: true,
      hospital: updatedHospital,
      message: 'Hospital activado exitosamente'
    })
  } catch (error) {
    console.error('Error in POST /api/hospitals/[id]/activate:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}