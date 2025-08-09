import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/auth-server'

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseServiceKey
)

// GET: Obtener todos los comentarios/historial del hospital
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const hospitalId = params.id
    
    // Obtener actividad combinada de la vista hospital_activity
    const { data, error } = await supabase
      .from('hospital_activity')
      .select('*')
      .eq('hospital_id', hospitalId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching hospital activity:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Formatear los datos para el frontend
    const formattedData = data?.map(entry => ({
      id: entry.id,
      type: entry.type,
      hospitalId: entry.hospital_id,
      userId: entry.user_id,
      action: entry.action,
      message: entry.message,
      previousState: entry.previous_state,
      newState: entry.new_state,
      createdAt: entry.created_at,
      user: entry.user_id ? {
        id: entry.user_id,
        name: entry.user_name,
        email: entry.user_email,
        role: entry.user_role
      } : null
    })) || []

    return NextResponse.json({ 
      success: true, 
      data: formattedData,
      count: formattedData.length 
    })
  } catch (error) {
    console.error('Error in GET /api/hospitals/[id]/comments:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST: Agregar un nuevo comentario
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const hospitalId = params.id
    const body = await request.json()
    
    // Validación de datos
    if (!body.message || !body.message.trim()) {
      return NextResponse.json({ error: 'El mensaje es requerido' }, { status: 400 })
    }

    // Verificar que el hospital existe
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name')
      .eq('id', hospitalId)
      .single()

    if (hospitalError || !hospital) {
      return NextResponse.json({ error: 'Hospital no encontrado' }, { status: 404 })
    }

    // Insertar el comentario en la nueva tabla hospital_comments
    const { data, error } = await supabase
      .from('hospital_comments')
      .insert({
        hospital_id: hospitalId,
        user_id: user.id,
        comment: body.message.trim()
      })
      .select(`
        *,
        users:user_id (
          id,
          full_name,
          email,
          role
        )
      `)
      .single()

    if (error) {
      console.error('Error adding comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Formatear la respuesta
    const formattedComment = {
      id: data.id,
      type: 'comment',
      hospitalId: data.hospital_id,
      userId: data.user_id,
      action: 'noted',
      message: data.comment,
      createdAt: data.created_at,
      user: data.users ? {
        id: data.users.id,
        name: data.users.full_name,
        email: data.users.email,
        role: data.users.role
      } : null
    }

    return NextResponse.json({ 
      success: true, 
      data: formattedComment,
      message: 'Comentario agregado exitosamente' 
    })
  } catch (error) {
    console.error('Error in POST /api/hospitals/[id]/comments:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar un comentario (solo admin o el autor)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const commentId = url.searchParams.get('commentId')
    
    if (!commentId) {
      return NextResponse.json({ error: 'ID del comentario requerido' }, { status: 400 })
    }

    // Obtener el comentario para verificar permisos
    const { data: comment, error: fetchError } = await supabase
      .from('hospital_comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 })
    }

    // Verificar permisos: solo admin o el autor pueden eliminar
    if (user.role !== 'admin' && comment.user_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este comentario' }, { status: 403 })
    }

    // Eliminar el comentario
    const { error } = await supabase
      .from('hospital_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('Error deleting comment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Comentario eliminado exitosamente' 
    })
  } catch (error) {
    console.error('Error in DELETE /api/hospitals/[id]/comments:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}