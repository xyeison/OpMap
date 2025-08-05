import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const diagnosis = {
    timestamp: new Date().toISOString(),
    checks: {
      buckets: { status: 'pending' as 'pending' | 'error' | 'warning' | 'success', details: null as any },
      contractsBucket: { status: 'pending' as 'pending' | 'error' | 'warning' | 'success', details: null as any },
      policies: { status: 'pending' as 'pending' | 'error' | 'warning' | 'success', details: null as any },
      testUpload: { status: 'pending' as 'pending' | 'error' | 'warning' | 'success', details: null as any }
    },
    recommendations: [] as string[]
  }

  try {
    // 1. Verificar si podemos listar buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      diagnosis.checks.buckets = {
        status: 'error',
        details: `No se pueden listar buckets: ${bucketsError.message}`
      }
      diagnosis.recommendations.push('Verificar que el usuario tenga permisos para acceder a storage')
    } else {
      diagnosis.checks.buckets = {
        status: 'success',
        details: `Se encontraron ${buckets?.length || 0} buckets`
      }
      
      // 2. Buscar el bucket contracts
      const contractsBucket = buckets?.find(b => b.id === 'contracts' || b.name === 'contracts')
      
      if (!contractsBucket) {
        diagnosis.checks.contractsBucket = {
          status: 'error',
          details: 'El bucket "contracts" no existe'
        }
        diagnosis.recommendations.push(
          'Crear el bucket "contracts" en Storage',
          'Configurar: Public = false, Size = 10MB, MIME = application/pdf'
        )
      } else {
        diagnosis.checks.contractsBucket = {
          status: 'success',
          details: contractsBucket
        }
      }
    }

    // 3. Intentar listar archivos (para verificar políticas de lectura)
    const { data: files, error: filesError } = await supabase.storage
      .from('contracts')
      .list()

    if (filesError) {
      diagnosis.checks.policies = {
        status: 'warning',
        details: `No se pueden listar archivos: ${filesError.message}`
      }
      if (filesError.message.includes('not found')) {
        diagnosis.recommendations.push('El bucket "contracts" no existe')
      } else {
        diagnosis.recommendations.push('Verificar políticas RLS del bucket')
      }
    } else {
      diagnosis.checks.policies = {
        status: 'success',
        details: 'Políticas de lectura funcionando'
      }
    }

    // 4. Generar resumen
    const allChecks = Object.values(diagnosis.checks)
    const hasErrors = allChecks.some(check => check.status === 'error')
    const hasWarnings = allChecks.some(check => check.status === 'warning')

    return NextResponse.json({
      success: !hasErrors,
      diagnosis,
      summary: {
        status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'success',
        message: hasErrors 
          ? 'Se encontraron errores críticos en la configuración'
          : hasWarnings 
          ? 'La configuración tiene advertencias'
          : 'La configuración parece correcta'
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error inesperado al diagnosticar',
      details: error
    })
  }
}