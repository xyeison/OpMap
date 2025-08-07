import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'
import { supabase } from '@/lib/supabase'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

interface KamData {
  name: string
  area_id: string
  lat: number
  lng: number
  enable_level2?: boolean
  max_travel_time?: number
  priority?: number
  color?: string
  active?: boolean
}

export async function POST(request: Request) {
  try {
    const { action, kamId, kamData } = await request.json()
    
    // Validar acción
    if (!['create', 'activate', 'deactivate', 'update'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción no válida' },
        { status: 400 }
      )
    }
    
    // Para crear, necesitamos los datos
    if (action === 'create' && !kamData) {
      return NextResponse.json(
        { success: false, error: 'Datos del KAM requeridos para crear' },
        { status: 400 }
      )
    }
    
    // Para otras acciones, necesitamos el ID
    if (action !== 'create' && !kamId) {
      return NextResponse.json(
        { success: false, error: 'ID del KAM requerido' },
        { status: 400 }
      )
    }

    console.log(`👤 OPERACIÓN KAM - Acción: ${action}`)
    const startTime = Date.now()
    
    let kam: any
    let message = ''
    let requiresRecalculation = true
    
    // Ejecutar la acción correspondiente
    switch (action) {
      case 'create':
        // Crear nuevo KAM
        const { data: newKam, error: createError } = await supabase
          .from('kams')
          .insert({
            ...kamData,
            active: kamData.active !== false, // Por defecto activo
            enable_level2: kamData.enable_level2 !== false, // Por defecto true
            max_travel_time: kamData.max_travel_time || 240, // Por defecto 4 horas
            priority: kamData.priority || 2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (createError) {
          return NextResponse.json(
            { success: false, error: 'Error creando KAM: ' + createError.message },
            { status: 500 }
          )
        }
        
        kam = newKam
        message = `KAM ${kam.name} creado exitosamente`
        break
      
      case 'activate':
      case 'deactivate':
        // Obtener KAM actual
        const { data: existingKam } = await supabase
          .from('kams')
          .select('*')
          .eq('id', kamId)
          .single()
        
        if (!existingKam) {
          return NextResponse.json(
            { success: false, error: 'KAM no encontrado' },
            { status: 404 }
          )
        }
        
        const newStatus = action === 'activate'
        
        // Si el estado no cambia, no hacer nada
        if (existingKam.active === newStatus) {
          return NextResponse.json({
            success: true,
            message: `${existingKam.name} ya está ${newStatus ? 'activo' : 'inactivo'}`,
            kam: existingKam
          })
        }
        
        // Actualizar estado
        const { data: updatedKam, error: updateError } = await supabase
          .from('kams')
          .update({ 
            active: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', kamId)
          .select()
          .single()
        
        if (updateError) {
          return NextResponse.json(
            { success: false, error: 'Error actualizando KAM' },
            { status: 500 }
          )
        }
        
        kam = updatedKam
        message = `${kam.name} ${newStatus ? 'activado' : 'desactivado'}`
        break
      
      case 'update':
        // Obtener KAM actual para comparar
        const { data: currentKam } = await supabase
          .from('kams')
          .select('*')
          .eq('id', kamId)
          .single()
        
        if (!currentKam) {
          return NextResponse.json(
            { success: false, error: 'KAM no encontrado' },
            { status: 404 }
          )
        }
        
        // Detectar cambios críticos que requieren recálculo
        const criticalChanges = 
          kamData.lat !== undefined && kamData.lat !== currentKam.lat ||
          kamData.lng !== undefined && kamData.lng !== currentKam.lng ||
          kamData.area_id !== undefined && kamData.area_id !== currentKam.area_id ||
          kamData.enable_level2 !== undefined && kamData.enable_level2 !== currentKam.enable_level2 ||
          kamData.max_travel_time !== undefined && kamData.max_travel_time !== currentKam.max_travel_time ||
          kamData.active !== undefined && kamData.active !== currentKam.active
        
        requiresRecalculation = criticalChanges
        
        // Actualizar KAM
        const { data: modifiedKam, error: modifyError } = await supabase
          .from('kams')
          .update({
            ...kamData,
            updated_at: new Date().toISOString()
          })
          .eq('id', kamId)
          .select()
          .single()
        
        if (modifyError) {
          return NextResponse.json(
            { success: false, error: 'Error actualizando KAM' },
            { status: 500 }
          )
        }
        
        kam = modifiedKam
        
        // Construir mensaje con cambios
        const changes = []
        if (kamData.lat !== undefined && kamData.lat !== currentKam.lat) {
          changes.push('ubicación')
        }
        if (kamData.enable_level2 !== undefined && kamData.enable_level2 !== currentKam.enable_level2) {
          changes.push(`nivel 2 ${kamData.enable_level2 ? 'activado' : 'desactivado'}`)
        }
        if (kamData.max_travel_time !== undefined && kamData.max_travel_time !== currentKam.max_travel_time) {
          changes.push(`tiempo máximo: ${kamData.max_travel_time} min`)
        }
        
        message = `${kam.name} actualizado`
        if (changes.length > 0) {
          message += ` (${changes.join(', ')})`
        }
        
        // Si no hubo cambios críticos, no recalcular
        if (!requiresRecalculation) {
          return NextResponse.json({
            success: true,
            message: message + ' (sin cambios que requieran recálculo)',
            kam
          })
        }
        break
    }
    
    // RECÁLCULO AUTOMÁTICO DEL SISTEMA
    console.log('🔄 Ejecutando recálculo completo del sistema...')
    
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY
    const algorithm = new OpMapAlgorithmBogotaFixed()
    await algorithm.initialize(googleApiKey)
    
    const assignments = await algorithm.calculateAssignments()
    await algorithm.saveAssignments(assignments)
    
    // Analizar impacto del KAM
    let impact = ''
    if (kam && kam.active) {
      const { data: kamAssignments } = await supabase
        .from('assignments')
        .select('*, hospitals(name, beds)')
        .eq('kam_id', kam.id)
      
      if (kamAssignments && kamAssignments.length > 0) {
        const totalBeds = kamAssignments.reduce((sum, a) => sum + (a.hospitals?.beds || 0), 0)
        impact = ` ${kamAssignments.length} hospitales asignados (${totalBeds} camas).`
      } else {
        impact = ' Sin hospitales asignados.'
      }
    }
    
    const elapsed = Date.now() - startTime
    console.log(`✅ Proceso completado en ${elapsed}ms`)
    
    return NextResponse.json({
      success: true,
      message: message + '.' + impact + ` Sistema recalculado en ${elapsed}ms.`,
      summary: {
        action,
        kam: {
          id: kam.id,
          name: kam.name,
          area_id: kam.area_id,
          enable_level2: kam.enable_level2,
          max_travel_time: kam.max_travel_time,
          active: kam.active
        },
        totalAssignments: assignments.length,
        timeElapsed: elapsed
      }
    })
    
  } catch (error) {
    console.error('Error en operación de KAM:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}