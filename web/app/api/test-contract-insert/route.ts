import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // 1. Obtener un hospital válido para la prueba
    const { data: hospital, error: hospitalError } = await supabase
      .from('hospitals')
      .select('id, name')
      .limit(1)
      .single()

    if (hospitalError || !hospital) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo obtener un hospital para la prueba',
        details: hospitalError
      })
    }

    // 2. Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      return NextResponse.json({
        success: false,
        error: 'Error de autenticación',
        details: authError
      })
    }

    // 3. Intentar insertar un contrato de prueba
    const testContract = {
      hospital_id: hospital.id,
      contract_number: `TEST-${Date.now()}`,
      contract_type: 'capita',
      contract_value: 1000000,
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      duration_months: 12,
      current_provider: 'Proveedor Test',
      description: 'Contrato de prueba para diagnosticar problemas',
      active: true,
      created_by: user?.id || null
    }

    console.log('Intentando insertar:', testContract)

    const { data: contractData, error: contractError } = await supabase
      .from('hospital_contracts')
      .insert(testContract)
      .select()
      .single()

    if (contractError) {
      return NextResponse.json({
        success: false,
        phase: 'insert_contract',
        error: contractError.message,
        code: contractError.code,
        details: contractError.details,
        hint: contractError.hint,
        testData: testContract,
        user: user ? { id: user.id, email: user.email } : null
      })
    }

    // 4. Si el contrato se creó, intentar eliminarlo
    if (contractData) {
      const { error: deleteError } = await supabase
        .from('hospital_contracts')
        .delete()
        .eq('id', contractData.id)

      return NextResponse.json({
        success: true,
        message: 'Contrato creado y eliminado exitosamente',
        contractCreated: contractData,
        deleteError: deleteError || null,
        user: user ? { id: user.id, email: user.email } : null
      })
    }

    return NextResponse.json({
      success: false,
      message: 'Estado inesperado',
      data: contractData
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error inesperado',
      details: error
    })
  }
}