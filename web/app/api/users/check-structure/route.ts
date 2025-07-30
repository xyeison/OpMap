import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener información de las columnas de la tabla users
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(0)

    if (error) {
      // Si hay error, intentar obtener la estructura de otra forma
      const { data: schemaData, error: schemaError } = await supabase.rpc('get_table_columns', {
        table_name: 'users'
      }).single()

      if (schemaError) {
        return NextResponse.json({ 
          error: 'No se pudo obtener la estructura de la tabla',
          details: schemaError 
        }, { status: 500 })
      }

      return NextResponse.json({ columns: schemaData })
    }

    // Obtener un usuario para ver la estructura
    const { data: sampleUser } = await supabase
      .from('users')
      .select('*')
      .limit(1)
      .single()

    const columns = sampleUser ? Object.keys(sampleUser) : []

    return NextResponse.json({
      columns,
      sampleUser: sampleUser ? {
        ...sampleUser,
        password: '[HIDDEN]'
      } : null,
      message: 'Estructura de la tabla users'
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}