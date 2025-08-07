import { NextResponse } from 'next/server'
import { OpMapAlgorithmBogotaFixed } from '@/lib/opmap-algorithm-bogota-fixed'
import { supabase } from '@/lib/supabase'

// Forzar esta ruta como dinámica
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

interface HospitalData {
  code: string
  name: string
  department_id: string
  municipality_id: string
  locality_id?: string
  lat: number
  lng: number
  beds?: number
  address?: string
  phone?: string
  email?: string
  service_level?: number
  type?: string
  active?: boolean
}

export async function POST(request: Request) {
  try {
    const { action, hospitalId, hospitalData } = await request.json()
    
    // Validar acción
    if (!['create', 'activate', 'deactivate', 'update'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción no válida' },
        { status: 400 }
      )
    }
    
    // Para crear, necesitamos los datos
    if (action === 'create' && !hospitalData) {
      return NextResponse.json(
        { success: false, error: 'Datos del hospital requeridos para crear' },
        { status: 400 }
      )
    }
    
    // Para otras acciones, necesitamos el ID
    if (action !== 'create' && !hospitalId) {
      return NextResponse.json(
        { success: false, error: 'ID del hospital requerido' },
        { status: 400 }
      )
    }

    console.log(`🏥 OPERACIÓN HOSPITAL - Acción: ${action}`)
    const startTime = Date.now()
    
    let hospital: any
    let message = ''
    
    // Ejecutar la acción correspondiente
    switch (action) {
      case 'create':
        // Crear nuevo hospital
        const { data: newHospital, error: createError } = await supabase
          .from('hospitals')
          .insert({
            ...hospitalData,
            active: hospitalData.active !== false, // Por defecto activo
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (createError) {
          return NextResponse.json(
            { success: false, error: 'Error creando hospital: ' + createError.message },
            { status: 500 }
          )
        }
        
        hospital = newHospital
        message = `Hospital ${hospital.name} creado exitosamente`
        
        // Registrar en historial
        await supabase.from('hospital_history').insert({
          hospital_id: hospital.id,
          action: 'CREACIÓN',
          reason: 'Nuevo hospital creado desde la interfaz',
          new_state: true,
          changes: { created: hospitalData }
        })
        break
      
      case 'activate':
      case 'deactivate':
        // Obtener hospital actual
        const { data: existingHospital } = await supabase
          .from('hospitals')
          .select('*')
          .eq('id', hospitalId)
          .single()
        
        if (!existingHospital) {
          return NextResponse.json(
            { success: false, error: 'Hospital no encontrado' },
            { status: 404 }
          )
        }
        
        const newStatus = action === 'activate'
        
        // Actualizar estado
        const { data: updatedHospital, error: updateError } = await supabase
          .from('hospitals')
          .update({ 
            active: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', hospitalId)
          .select()
          .single()
        
        if (updateError) {
          return NextResponse.json(
            { success: false, error: 'Error actualizando hospital' },
            { status: 500 }
          )
        }
        
        hospital = updatedHospital
        message = `${hospital.name} ${newStatus ? 'activado' : 'desactivado'}`
        
        // Registrar en historial
        await supabase.from('hospital_history').insert({
          hospital_id: hospitalId,
          action: newStatus ? 'ACTIVACIÓN' : 'DESACTIVACIÓN',
          reason: `Hospital ${newStatus ? 'activado' : 'desactivado'} desde la interfaz`,
          previous_state: !newStatus,
          new_state: newStatus,
          changes: { active: { from: !newStatus, to: newStatus } }
        })
        break
      
      case 'update':
        // Actualizar datos del hospital
        const { data: currentHospital } = await supabase
          .from('hospitals')
          .select('*')
          .eq('id', hospitalId)
          .single()
        
        if (!currentHospital) {
          return NextResponse.json(
            { success: false, error: 'Hospital no encontrado' },
            { status: 404 }
          )
        }
        
        // Detectar cambios críticos que requieren recálculo
        const criticalChanges = hospitalData.lat !== undefined || 
                               hospitalData.lng !== undefined ||
                               hospitalData.department_id !== undefined ||
                               hospitalData.municipality_id !== undefined ||
                               hospitalData.locality_id !== undefined
        
        // Actualizar hospital
        const { data: modifiedHospital, error: modifyError } = await supabase
          .from('hospitals')
          .update({
            ...hospitalData,
            updated_at: new Date().toISOString()
          })
          .eq('id', hospitalId)
          .select()
          .single()
        
        if (modifyError) {
          return NextResponse.json(
            { success: false, error: 'Error actualizando hospital' },
            { status: 500 }
          )
        }
        
        hospital = modifiedHospital
        message = `${hospital.name} actualizado`
        
        // Registrar cambios
        const changes: any = {}
        Object.keys(hospitalData).forEach(key => {
          if (currentHospital[key] !== hospitalData[key]) {
            changes[key] = {
              from: currentHospital[key],
              to: hospitalData[key]
            }
          }
        })
        
        await supabase.from('hospital_history').insert({
          hospital_id: hospitalId,
          action: 'ACTUALIZACIÓN',
          reason: 'Hospital actualizado desde la interfaz',
          changes
        })
        
        // Si no hubo cambios críticos, no recalcular
        if (!criticalChanges) {
          return NextResponse.json({
            success: true,
            message: message + ' (sin cambios que requieran recálculo)',
            hospital
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
    
    // Analizar impacto específico del hospital
    let impact = ''
    if (hospital) {
      const { data: assignment } = await supabase
        .from('assignments')
        .select('*, kams(name)')
        .eq('hospital_id', hospital.id)
        .single()
      
      if (assignment) {
        const minutes = Math.round((assignment.travel_time || 0) / 60)
        impact = ` Asignado a ${assignment.kams?.name} (${minutes} min).`
      } else if (hospital.active) {
        impact = ' Sin cobertura (fuera de alcance de todos los KAMs).'
      }
    }
    
    const elapsed = Date.now() - startTime
    console.log(`✅ Proceso completado en ${elapsed}ms`)
    
    return NextResponse.json({
      success: true,
      message: message + '.' + impact + ` Sistema recalculado en ${elapsed}ms.`,
      summary: {
        action,
        hospital: {
          id: hospital.id,
          name: hospital.name,
          code: hospital.code,
          municipality: hospital.municipality_name,
          department: hospital.department_name,
          beds: hospital.beds,
          active: hospital.active
        },
        totalAssignments: assignments.length,
        timeElapsed: elapsed
      }
    })
    
  } catch (error) {
    console.error('Error en operación de hospital:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}