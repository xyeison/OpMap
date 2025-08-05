import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Verificar si podemos listar los buckets
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()

    if (bucketsError) {
      return NextResponse.json({
        success: false,
        error: 'Error al listar buckets',
        details: bucketsError
      })
    }

    // Buscar el bucket 'contracts'
    const contractsBucket = buckets?.find(b => b.id === 'contracts')

    // Intentar listar archivos en el bucket (para verificar permisos)
    const { data: files, error: filesError } = await supabase
      .storage
      .from('contracts')
      .list()

    return NextResponse.json({
      success: true,
      buckets: buckets || [],
      contractsBucket: contractsBucket || null,
      canListFiles: !filesError,
      filesError: filesError?.message || null,
      totalBuckets: buckets?.length || 0,
      hasContractsBucket: !!contractsBucket
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error inesperado',
      details: error
    })
  }
}